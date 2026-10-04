import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

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
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
] as const;

// Fast, high-quota structured extraction models
const BULK_IMPORT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
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

function deterministicParseBulkText(text: string): any[] {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(item|part|name|qty|price|cost|seller|notes)\b/i.test(l));

  if (lines.length === 0) return [];

  return lines.map((line) => {
    let remaining = line;

    // 1. Quantity (e.g. 10x, 2x, 5 pcs)
    let quantity = 1;
    const qtyMatch = remaining.match(/^(\d+)\s*(?:x|pcs|units|ct)?\s+/i) || remaining.match(/\b(\d+)\s*(?:x|pcs|units|ct)\b/i);
    if (qtyMatch) {
      quantity = Math.max(1, parseInt(qtyMatch[1], 10) || 1);
      remaining = remaining.replace(qtyMatch[0], ' ').trim();
    }

    // 2. Unit cost or price ($225.99, $225)
    let unitCost = 0;
    const costMatch = remaining.match(/\$\s*(\d+(?:\.\d+)?)/) || remaining.match(/\b(\d+\.\d{2})\b/);
    if (costMatch) {
      unitCost = parseFloat(costMatch[1]) || 0;
      remaining = remaining.replace(costMatch[0], ' ').trim();
    }

    // 3. Health percent for storage (e.g. 98% health)
    let healthPercent: number | undefined = undefined;
    const healthMatch = remaining.match(/\b(\d{1,3})%\s*(?:health)?/i);
    if (healthMatch) {
      const parsedHealth = parseInt(healthMatch[1], 10);
      if (parsedHealth >= 0 && parsedHealth <= 100) {
        healthPercent = parsedHealth;
      }
      remaining = remaining.replace(healthMatch[0], ' ').trim();
    }

    // 4. Condition
    let condition = 'Used Open Box';
    if (/\b(sealed|brand new in box|bnib|nib)\b/i.test(remaining)) {
      condition = 'Sealed';
      remaining = remaining.replace(/\b(sealed|brand new in box|bnib|nib)\b/gi, ' ').trim();
    } else if (/\b(new open box|open box)\b/i.test(remaining)) {
      condition = 'New Open Box';
      remaining = remaining.replace(/\b(new open box|open box)\b/gi, ' ').trim();
    } else if (/\b(new no box)\b/i.test(remaining)) {
      condition = 'New No Box';
      remaining = remaining.replace(/\b(new no box)\b/gi, ' ').trim();
    } else if (/\b(used no box)\b/i.test(remaining)) {
      condition = 'Used No Box';
      remaining = remaining.replace(/\b(used no box)\b/gi, ' ').trim();
    } else if (/\b(used open box|used)\b/i.test(remaining)) {
      condition = 'Used Open Box';
      remaining = remaining.replace(/\b(used open box|used)\b/gi, ' ').trim();
    }

    // 5. Seller (Amazon, Newegg, Best Buy, Facebook, Memory Express, etc.)
    let seller: string | undefined = undefined;
    const sellerMatch = remaining.match(/\b(amazon|newegg|best buy|memory express|canada computers|facebook|kijiji|ebay|marketplace|fb marketplace|cc|me)\b/i);
    if (sellerMatch) {
      seller = sellerMatch[1];
      remaining = remaining.replace(sellerMatch[0], ' ').trim();
    }

    // 6. Category
    let category = 'Other';
    const lower = remaining.toLowerCase();
    if (/\b(rtx|gtx|radeon|rx\s*\d|geforce|graphics card|gpu|arc\s*a)\b/i.test(lower)) category = 'GPU';
    else if (/\b(ryzen|intel|core\s*i[3579]|cpu|processor|threadripper|7800x3d|7700|7600|5600|14900|13700|12600)\b/i.test(lower)) category = 'CPU';
    else if (/\b(ddr[45]|ram|memory|vengeance|trident|fury|corsair\s*rgb)\b/i.test(lower)) category = 'RAM';
    else if (/\b(ssd|nvme|m\.2|hard\s*drive|hdd|sata|evo|sn\d{3}|barracuda|kc3000|pm9a1)\b/i.test(lower)) category = 'Storage';
    else if (/\b(motherboard|mobo|b650|b550|z790|z690|x670|b850|am4|am5|lga)\b/i.test(lower)) category = 'Motherboard';
    else if (/\b(psu|power\s*supply|gold|bronze|platinum|watt|\b\d{3,4}w\b|corsair\s*rm)\b/i.test(lower)) category = 'PSU';
    else if (/\b(cooler|aio|liquid|fan|heatsink|noctua|kraken|assassin|360mm|240mm|hydroshift)\b/i.test(lower)) category = 'Cooling';
    else if (/\b(case|chassis|h9|h5|h7|o11|4000d|pop\s*air|ch160)\b/i.test(lower)) category = 'Case';

    let cleanName = remaining
      .replace(/^[,\-–—:\s]+|[,\-–—:\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!cleanName) {
      cleanName = line;
    }

    return {
      name: cleanName,
      category,
      quantity,
      unitCost,
      condition,
      seller,
      healthPercent: category === 'Storage' ? healthPercent : undefined,
      tags: [],
    };
  });
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(timeoutMsg);
      err.status = 'DEADLINE_EXCEEDED';
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function generateGeminiContent(params: {
  systemInstruction?: string;
  contents: any;
  responseSchema?: any;
  fastBulkImport?: boolean;
  timeoutMs?: number;
}) {
  const ai = getAI();
  let lastError: any = null;

  const models = params.fastBulkImport ? BULK_IMPORT_MODELS : GEMINI_MODEL_CANDIDATES;
  const timeoutMs = params.timeoutMs || (params.fastBulkImport ? 20000 : 30000);

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = performance.now();
      try {
        const config: any = {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseSchema ? 'application/json' : undefined,
          responseSchema: params.responseSchema,
        };

        const response = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: params.contents,
            config,
          }),
          timeoutMs,
          `Request to ${model} timed out after ${timeoutMs}ms`
        );

        if (response && response.text) {
          if (params.fastBulkImport) {
            console.info(`[AI generate] ${model} completed in ${Math.round(performance.now() - started)}ms`);
          }
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const isTimeout = err?.status === 'DEADLINE_EXCEEDED' || String(err?.message || '').includes('timed out');
        const isQuotaExceeded =
          err?.status === 429 ||
          err?.code === 429 ||
          err?.error?.code === 429 ||
          err?.status === 'RESOURCE_EXHAUSTED' ||
          String(err?.message || '').includes('429') ||
          String(err?.message || '').includes('quota') ||
          String(err?.message || '').includes('RESOURCE_EXHAUSTED');

        // If quota is exhausted or request timed out, fail over to the next candidate model immediately without looping
        if (isQuotaExceeded || isTimeout) {
          console.warn(`[AI generate] ${model} ${isQuotaExceeded ? 'quota limit reached' : 'timed out'}, falling over to next model candidate...`);
          break;
        }

        const isTransient =
          err?.status === 503 ||
          err?.code === 503 ||
          String(err?.message || '').includes('503') ||
          String(err?.message || '').includes('UNAVAILABLE') ||
          String(err?.message || '').includes('high demand');

        if (isTransient && attempt === 1) {
          // Brief 500ms backoff before retrying
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break;
      }
    }
  }

  if (lastError?.status === 429 || lastError?.code === 429 || String(lastError?.message || '').includes('429') || String(lastError?.message || '').includes('quota')) {
    console.warn(`[AI service quota reached]:`, lastError?.message || 'Daily free tier requests limit reached across model pool.');
    throw new Error('AI service quota reached for the day. Please retry later or use standard manual/deterministic workflows.');
  }

  console.warn(`[AI generate notice]`, lastError?.message || lastError);
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
    const started = performance.now();
    const { text, images } = req.body;
    try {
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
      
      const systemInstruction = `You are a high-precision PC hardware inventory parser.
Extract individual PC components, quantities, costs, and purchase metadata from the user's input text or images.
Accept ANY text format: formatted headers (e.g. 'Seller: Roop | Date: 2024-05-22'), multi-line notes, unstructured free-form lists, chat logs, single-line entries, or receipts.

CRITICAL FIELD RULES:
1. 'name': Clean product title ONLY (e.g. '1TB NVMe GEN4 SSD', 'Ryzen 7 7800X3D', 'RTX 4070 Super'). DO NOT include seller names, dates, or prices in the name.
2. 'seller': Concise seller or store name ONLY (e.g. 'Roop', 'Best Buy', 'Memory Express', 'Amazon', 'Facebook'). Maximum 1-3 words. NEVER concatenate item names, specs, conditions, prices, reasoning, commentary, or markdown into 'seller'. If no seller is mentioned or identifiable, leave it empty ("").
3. 'date': Purchase date formatted as YYYY-MM-DD (e.g. '2024-05-22'). If no date is found, leave it empty ("").
4. 'paymentMethod': One of 'Cash', 'E-Transfer', 'PayPal', 'Credit Card', 'Debit', 'Crypto', or 'Other'. If not mentioned, default to 'Cash'.
5. 'condition': Exactly one of 'Sealed', 'New Open Box', 'New No Box', 'Used Open Box', or 'Used No Box'. Default to 'Used Open Box' if used/unspecified.
6. 'quantity': Integer quantity (e.g. '5x' -> 5). Default to 1.
7. 'unitCost': Exact numeric per-unit cost without currency symbols (e.g. 100.00). If cost is not mentioned, omit or set to 0.
8. 'healthPercent': ONLY for Storage items when an explicit health percentage is stated (e.g. '98% health' -> 98). NEVER guess or default to 100—leave absent if not stated.
9. 'tags': Preset sub-category tags:
   - CPU: AM5, AM4, Intel
   - RAM: DDR5, DDR4
   - GPU: 50 Series, 40 Series, 30 Series, AMD
   - Storage: GEN5, GEN4, GEN3, SATA
   - Motherboard: AM5, AM4, Intel
   - PSU: Black, White
   - Case: Black, White
   - Cooling: 360mm, 240mm, Air Coolers

ABSOLUTE NEGATIVE CONSTRAINT:
NEVER output internal reasoning, thought process, explanations, or phrases like "(inferred...)" or "per instructions" into ANY field value. Every field must contain ONLY its clean extracted value.`;

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Full name of the component, e.g. Ryzen 7 7700" },
            category: { type: Type.STRING, description: "Category: GPU, CPU, RAM, Storage, Motherboard, PSU, Case, Cooling, Fans, Accessories, or Other" },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of sub-category tags matching allowed presets (e.g. ['AM5'], ['GEN4'], ['DDR5'], ['White'], ['SATA'])"
            },
            quantity: { type: Type.INTEGER, description: "Quantity of this item" },
            unitCost: { type: Type.NUMBER, description: "Exact cost per single unit as a decimal number without rounding" },
            condition: { type: Type.STRING, description: "Condition: Sealed, New Open Box, New No Box, Used Open Box, or Used No Box" },
            seller: { type: Type.STRING, description: "Clean seller or store name ONLY (e.g. 'Roop', 'Best Buy'). Maximum 1-3 words. Never include explanations." },
            date: { type: Type.STRING, description: "Purchase date in YYYY-MM-DD format" },
            paymentMethod: { type: Type.STRING, description: "Payment method: Cash, E-Transfer, PayPal, Credit Card, etc." },
            healthPercent: { type: Type.INTEGER, description: "SSD health percentage (0-100) if mentioned for storage items" }
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
      
      const rawData = parseModelJsonResponse(response.text, 'array');
      const data = (Array.isArray(rawData) ? rawData : []).map((item: any) => {
        const itemTags = Array.isArray(item.tags) ? item.tags : [];
        let cleanSeller = '';
        const rawSeller = item.seller || item.vendor;
        if (rawSeller && typeof rawSeller === 'string') {
          let str = rawSeller.trim();
          if (str.includes('\n')) str = str.split('\n')[0].trim();
          str = str.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
          str = str.replace(/^(?:Seller|Vendor)\s*:\s*/i, '').trim();
          if (str.length > 30) {
            const firstWord = str.split(/[\s,;|]/)[0];
            str = firstWord.length > 1 ? firstWord : str.slice(0, 30);
          }
          cleanSeller = str;
        }

        let cleanName = String(item.name || '').trim();
        if (cleanSeller && cleanName) {
          const escapedSeller = cleanSeller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleanName = cleanName.replace(new RegExp(`^${escapedSeller}\\s+`, 'i'), '').trim();
        }

        const { vendor: _v, ...restItem } = item;
        return {
          ...restItem,
          name: cleanName || item.name,
          seller: cleanSeller,
          tags: itemTags.map((t: string) => {
            const trimmed = String(t || '').trim();
            const lower = trimmed.toLowerCase();
            if (lower === 'gen5') return 'GEN5';
            if (lower === 'gen4') return 'GEN4';
            if (lower === 'gen3') return 'GEN3';
            if (lower === 'sata') return 'SATA';
            return trimmed;
          }).filter(Boolean),
        };
      });
      res.setHeader('Server-Timing', `bulk-import;dur=${Math.round(performance.now() - started)}`);
      res.json(data);
    } catch (err: any) {
      console.error('Bulk entry error:', err?.message || err);

      // Deterministic fallback if text was provided and AI is unavailable / quota exhausted
      if (text && typeof text === 'string' && text.trim().length > 0) {
        try {
          const fallbackData = deterministicParseBulkText(text);
          if (fallbackData.length > 0) {
            console.info(`[Bulk Import] Falling back to deterministic line parsing (${fallbackData.length} items parsed).`);
            res.setHeader('Server-Timing', `bulk-import-fallback;dur=${Math.round(performance.now() - started)}`);
            return res.json(fallbackData);
          }
        } catch (fallbackErr) {
          console.error('Deterministic fallback error:', fallbackErr);
        }
      }

      let errorMessage = err?.message || 'Error parsing bulk entry';
      if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('capacity')) {
        errorMessage = 'AI service is temporarily experiencing high demand from the provider. Please try extracting again in a few seconds.';
      }
      res.status(500).json({ error: errorMessage });
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
