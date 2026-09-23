import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return aiClient;
}

const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

// Inventory extraction is a short, structured task. Keep the more capable
// model ordering for build generation, where reasoning matters more.
const BULK_IMPORT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
] as const;

function parseModelJsonResponse(
  rawText: string | null | undefined,
  expectedType: 'array' | 'object'
): any {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Model returned an empty response.');
  }

  const trimmed = rawText.trim();
  let parsed: any = undefined;

  // 1. Direct JSON parse first
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // 2. Preserve support for response wrapped in one outer ```json code fence
    const codeFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (codeFenceMatch) {
      try {
        parsed = JSON.parse(codeFenceMatch[1].trim());
      } catch {
        // Fall through to bounded extraction
      }
    }

    // 3. Preserve a bounded fallback for surrounding model commentary if needed
    if (parsed === undefined) {
      const openChar = expectedType === 'array' ? '[' : '{';
      const closeChar = expectedType === 'array' ? ']' : '}';
      const firstIndex = trimmed.indexOf(openChar);
      const lastIndex = trimmed.lastIndexOf(closeChar);

      if (firstIndex !== -1 && lastIndex > firstIndex) {
        try {
          parsed = JSON.parse(trimmed.slice(firstIndex, lastIndex + 1));
        } catch {
          // Parsing failed
        }
      }
    }
  }

  if (parsed === undefined) {
    throw new Error('Failed to parse valid JSON from model response.');
  }

  // 4. Runtime validation of expected top-level JSON container type
  if (expectedType === 'array') {
    if (!Array.isArray(parsed)) {
      throw new Error('Expected model response to be a JSON array, but received a different type.');
    }
  } else if (expectedType === 'object') {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Expected model response to be a JSON object, but received a different type.');
    }
  }

  return parsed;
}

async function generateGeminiContent(params: {
  systemInstruction?: string;
  contents: any;
  responseSchema?: any;
  fastBulkImport?: boolean;
}) {
  const ai = getAI();
  let lastError: any = null;

  const models = params.fastBulkImport ? BULK_IMPORT_MODELS : GEMINI_MODEL_CANDIDATES;
  for (const model of models) {
    for (let attempt = 0; attempt < (params.fastBulkImport ? 1 : 2); attempt++) {
      const started = performance.now();
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: params.responseSchema ? 'application/json' : undefined,
            responseSchema: params.responseSchema,
            thinkingConfig: params.fastBulkImport ? {
              thinkingLevel: model.includes('flash-lite') ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
            } : undefined,
          },
        });
        if (response && response.text) {
          if (params.fastBulkImport) console.info(`[bulk import] ${model} completed in ${Math.round(performance.now() - started)}ms`);
          return response;
        }
      } catch (err: any) {
        lastError = err;
        if (params.fastBulkImport) console.warn(`[bulk import] ${model} failed after ${Math.round(performance.now() - started)}ms: ${err?.status || err?.code || 'request error'}`);
        const errMsg = err?.message || String(err);
        const isTransient = 
          err?.status === 'UNAVAILABLE' || 
          errMsg.includes('503') || 
          errMsg.includes('high demand') || 
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');
        
        if (isTransient && attempt === 0) {
          // Brief pause before retry for transient spikes
          await new Promise(resolve => setTimeout(resolve, 800));
          continue;
        }
        
        // If not transient or retry also failed, move to next model
        break;
      }
    }
  }
  
  throw lastError || new Error('All Gemini model endpoints are currently at peak capacity. Please retry in a moment.');
}

async function forwardToDiscordWebhook(webhookUrl: string, formData: FormData) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: formData,
  });

  if (response.ok || response.status === 204) {
    return { success: true };
  }

  let errorDetails = '';
  try {
    const errorJson: any = await response.json();
    if (errorJson?.message) {
      errorDetails = errorJson.message;
      if (errorJson.retry_after) {
        errorDetails += ` (Retry after ${Math.ceil(errorJson.retry_after)}s)`;
      }
    } else {
      errorDetails = JSON.stringify(errorJson);
    }
  } catch {
    try {
      errorDetails = await response.text();
    } catch {
      errorDetails = response.statusText;
    }
  }

  if (response.status === 401 || response.status === 404) {
    throw new Error('Invalid or deleted Discord webhook URL.');
  }
  if (response.status === 429) {
    throw new Error(`Discord rate limit reached: ${errorDetails || 'Too many requests. Please wait a moment.'}`);
  }
  if (response.status === 400) {
    throw new Error(`Discord rejected payload (400 Bad Request): ${errorDetails || 'Malformed payload or oversized fields.'}`);
  }

  throw new Error(`Discord request failed (${response.status}): ${errorDetails || response.statusText}`);
}

function parseDataUri(dataUri: string) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUri.slice(0, commaIdx);
  const base64Str = dataUri.slice(commaIdx + 1).replace(/\s/g, '');
  const mimeMatch = header.match(/^data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream';
  const buffer = Buffer.from(base64Str, 'base64');
  let ext = 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  return { mimeType, buffer, ext };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '50mb' }));

  app.post('/api/parse-bulk-entry', async (req, res) => {
    try {
      const started = performance.now();
      const { text, images } = req.body;
      
      let parts: any[] = [];
      if (text) {
        parts.push({ text: "Parse the following text for PC components inventory:\n" + text });
      }
      if (images && images.length > 0) {
        parts.push({ text: "Parse the following images (receipts/invoices/boxes) for PC components inventory:\n" });
        for (const img of images) {
          const base64Data = img.split(',')[1];
          const mimeType = img.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
      }

      if (parts.length === 0) {
        return res.status(400).json({ error: 'No text or images provided' });
      }
      
      const systemInstruction = "You are a PC hardware inventory assistant.\nExtract PC parts from the provided text or images. Ensure you categorize them correctly.\nIMPORTANT PARSING RULES:\n1. Extract metadata from header lines formatted like 'Vendor: [Name] | Date: [Date] | Payment: [Method] | Condition: [Condition]'.\n2. Apply these parsed metadata values (Vendor, Date, Payment, Condition) directly to EVERY item parsed in the batch.\n3. Map payment methods exactly to allowed tags (e.g., 'E-Transfer', 'Cash', 'PayPal', 'Credit Card', etc.).\n4. Parse dates accurately as 'YYYY-MM-DD' (e.g., '2023-10-25').\n5. Ensure exact decimal unit prices (e.g., 157.93) are preserved precisely without rounding.\n6. If an item specifies a quantity (e.g., '5x'), ensure 'quantity' is 5 and 'unitCost' is the exact per-unit cost.";

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Full name of the component, e.g. Ryzen 7 7700" },
            category: { type: Type.STRING, description: "Category: GPU, CPU, RAM, Storage, Motherboard, PSU, Case, Cooling, Fans, Accessories, or Other" },
            quantity: { type: Type.INTEGER, description: "Quantity of this item" },
            unitCost: { type: Type.NUMBER, description: "Exact cost per single unit as a decimal number without rounding" },
            condition: { type: Type.STRING, description: "Condition: Sealed, New Open Box, New No Box, Used Open Box, or Used No Box" },
            vendor: { type: Type.STRING, description: "Vendor name from the metadata header" },
            date: { type: Type.STRING, description: "Purchase date in YYYY-MM-DD format" },
            paymentMethod: { type: Type.STRING, description: "Payment method: Cash, E-Transfer, PayPal, Credit Card, etc." }
          },
          required: ["name", "category", "quantity", "unitCost", "condition"]
        }
      };

      const response = await generateGeminiContent({
        systemInstruction,
        contents: { parts },
        responseSchema,
        fastBulkImport: true,
      });
      
      const data = parseModelJsonResponse(response.text, 'array');
      res.setHeader('Server-Timing', `bulk-import;dur=${Math.round(performance.now() - started)}`);
      res.json(data);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Error parsing bulk entry' });
    }
  });

  app.post('/api/generate-custom-build', async (req, res) => {
    try {
      const { prompt, inventory } = req.body;

      const systemInstruction = `You are an expert PC hardware builder assisting a custom PC business.
Given a customer's build prompt and the current available in-stock inventory:
1. Carefully match the customer's request (budget, specific GPU/CPU, color/theme, DDR4/DDR5, form factor).
2. Ensure strict hardware compatibility:
   - Motherboard socket MUST match CPU (AM5 for Ryzen 7000/9000; AM4 for Ryzen 3000/5000; LGA1700 for Intel 12th/13th/14th Gen; LGA1851 for Core Ultra).
   - RAM generation MUST match Motherboard (DDR4 for AM4 / DDR4 boards; DDR5 for AM5 / DDR5 boards).
   - PSU wattage must sufficiently support the CPU + GPU combination (e.g. 750W+ for 4070/5070, 850W+ for 4080/5080, 1000W+ for 4090/5090).
   - Case form factor must fit Motherboard (ATX, Micro-ATX, Mini-ITX).
   - If theme/color is specified (e.g. White), prioritize matching white parts.
3. You must select exactly one CPU, one Motherboard, one RAM, one Storage, one Case, one PSU, and if available/needed, one GPU and one Cooler.
4. Return a JSON object with:
   - "partIds": array of string IDs of the chosen parts from inventory.
   - "buildName": concise title like "Core i5-12600KF + RTX 4060 Ti"
   - "notes": brief sentence explaining why this build satisfies the prompt and its hardware synergy.`;

      const contents = [
        { text: `Customer Request: "${prompt}"\n\nAvailable In-Stock Inventory:\n${JSON.stringify(inventory)}` }
      ];
      
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          partIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of component IDs from inventory that form this build"
          },
          buildName: {
            type: Type.STRING,
            description: "Short title of the build, e.g. 'Ryzen 7 7800X3D + RTX 4070 Ti Super'"
          },
          notes: {
            type: Type.STRING,
            description: "Brief note explaining the hardware synergy and compatibility"
          }
        },
        required: ["partIds"]
      };

      const response = await generateGeminiContent({
        systemInstruction,
        contents,
        responseSchema
      });
      
      const result = parseModelJsonResponse(response.text, 'object');
      res.json(result);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Error generating custom build' });
    }
  });

  app.post('/api/generate-tier-builds', async (req, res) => {
    try {
      const { inventory, seed } = req.body;

      const systemInstruction = `You are a professional PC building engineer optimizing pre-built inventory into 3 distinct market tiers:
1. Tier 1: "High-End Flagship" - Premium gaming/creator rig using the highest-tier CPU, top GPU (e.g. RTX 5080/4090/4080/7900XTX), 360mm/240mm AIO cooler, 32GB/64GB high-speed RAM, fast Gen4/Gen5 NVMe, high-wattage PSU (850W-1000W+).
2. Tier 2: "Mid-Range Performance" - The ultimate 1440p value/sweet-spot gaming rig (e.g. RTX 4070/4060Ti/RX 7800XT with Ryzen 5/7 or Intel i5/i7, 32GB RAM, 1TB-2TB NVMe, 750W PSU).
3. Tier 3: "Entry / Budget" - Maximum profit margin, price-to-performance esports/entry 1080p rig (e.g. RTX 4060/3060/RX 6600 or entry CPU, DDR4/DDR5 value board, 16GB/32GB RAM, 650W PSU).

RULES FOR EACH TIER:
- Must be 100% physically and electronically compatible (CPU socket matches Motherboard, RAM generation matches Motherboard, PSU wattage covers GPU, Cooler fits Case).
- Parts should color-coordinate nicely if possible (e.g. all-white or all-black).
- Each tier must have exactly 1 CPU, 1 Motherboard, 1 RAM, 1 Storage, 1 GPU, 1 Case, 1 PSU, 1 Cooling (if available in inventory).
- Return an array of exactly 3 build objects for tier1, tier2, and tier3.`;

      const contents = [
        { text: `Reroll Seed: ${seed || 0}\n\nAvailable In-Stock Inventory:\n${JSON.stringify(inventory)}` }
      ];

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            tier: { type: Type.STRING, description: "tier1, tier2, or tier3" },
            tierName: { type: Type.STRING, description: "Tier title like 'HIGH-END FLAGSHIP', 'MID-RANGE PERFORMANCE', 'ENTRY / BUDGET'" },
            buildName: { type: Type.STRING, description: "Concise build name, e.g. 'Ryzen 7 7800X3D + RTX 4080 Super'" },
            partIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of selected inventory component IDs"
            },
            notes: { type: Type.STRING, description: "Short highlight of the build's target audience and strengths" }
          },
          required: ["tier", "buildName", "partIds"]
        }
      };

      const response = await generateGeminiContent({
        systemInstruction,
        contents,
        responseSchema
      });

      const builds = parseModelJsonResponse(response.text, 'array');
      res.json({ builds });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Error generating tier builds' });
    }
  });

  app.post('/api/share-build-discord', async (req, res) => {
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl || !webhookUrl.trim()) {
        return res.status(400).json({ error: 'Discord webhook not configured.' });
      }

      const { name, cost, specs, imageUrl } = req.body;
      const buildTitle = (name || 'Custom PC Build').slice(0, 256);
      
      const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

      // Row 1 Priority: GPU, CPU, Cost (clean 3-column grouping)
      if (specs?.GPU) {
        fields.push({
          name: 'GPU',
          value: String(specs.GPU).trim().slice(0, 1024),
          inline: true,
        });
      }

      if (specs?.CPU) {
        fields.push({
          name: 'CPU',
          value: String(specs.CPU).trim().slice(0, 1024),
          inline: true,
        });
      }

      if (cost !== undefined && cost !== null) {
        const formattedCost = typeof cost === 'number' 
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost)
          : String(cost);
        fields.push({
          name: 'Cost',
          value: formattedCost.slice(0, 1024),
          inline: true,
        });
      }

      // Secondary Rows: Motherboard, RAM, Cooler, Storage, PSU, Case
      const secondaryCategories = ['Motherboard', 'RAM', 'Cooler', 'Storage', 'PSU', 'Case'];
      if (specs && typeof specs === 'object') {
        for (const cat of secondaryCategories) {
          const val = specs[cat] || (cat === 'Cooler' ? specs['Cooling'] : undefined);
          if (val && String(val).trim()) {
            fields.push({
              name: cat,
              value: String(val).trim().slice(0, 1024),
              inline: true,
            });
          }
        }
      }

      let parsedImage: ReturnType<typeof parseDataUri> = null;
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
        parsedImage = parseDataUri(imageUrl);
      }

      const embed: any = {
        author: {
          name: 'Partly',
        },
        title: buildTitle,
        color: 0xF59E0B, // Amber accent (16096779)
        fields,
        footer: {
          text: 'Partly • PC Build Showcase',
        },
        timestamp: new Date().toISOString(),
      };

      const payloadJson: any = {
        embeds: [embed],
      };

      const formData = new FormData();

      if (parsedImage) {
        const fileName = `build.${parsedImage.ext}`;
        embed.image = {
          url: `attachment://${fileName}`,
        };
        payloadJson.attachments = [
          {
            id: 0,
            filename: fileName,
            description: 'Build photo',
          },
        ];
        const fileBlob = new Blob([parsedImage.buffer], { type: parsedImage.mimeType });
        formData.append('files[0]', fileBlob, fileName);
      }

      formData.append('payload_json', JSON.stringify(payloadJson));

      await forwardToDiscordWebhook(webhookUrl, formData);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Discord share error:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to share build to Discord' });
    }
  });

  app.post('/api/share-build-image-discord', async (req, res) => {
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl || !webhookUrl.trim()) {
        return res.status(400).json({ error: 'Discord webhook not configured.' });
      }

      const { buildName, imageBase64 } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Missing rendered image data.' });
      }

      const parsedImage = parseDataUri(imageBase64);
      if (!parsedImage) {
        return res.status(400).json({ error: 'Invalid image data URI format.' });
      }

      const fileName = `build-card.${parsedImage.ext}`;
      const contentText = buildName ? `**${String(buildName).slice(0, 200)}**` : 'PC Build Card';

      const formData = new FormData();
      formData.append('payload_json', JSON.stringify({
        content: contentText,
        attachments: [
          {
            id: 0,
            filename: fileName,
          },
        ],
      }));

      const fileBlob = new Blob([parsedImage.buffer], { type: parsedImage.mimeType });
      formData.append('files[0]', fileBlob, fileName);

      await forwardToDiscordWebhook(webhookUrl, formData);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Discord image share error:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to share image to Discord' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
