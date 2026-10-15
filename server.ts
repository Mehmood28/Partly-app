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
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
] as const;

const BULK_IMPORT_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
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

function parseDateToIso(str: string | null | undefined): string | undefined {
  if (!str) return undefined;
  const trimmed = String(str).trim();
  if (!trimmed) return undefined;
  const isoMatch = trimmed.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const usMatch = trimmed.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (usMatch) {
    const first = parseInt(usMatch[1], 10);
    const second = parseInt(usMatch[2], 10);
    const year = usMatch[3];
    let day = first;
    let month = second;
    if (second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const monthMatch = trimmed.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if (monthMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const m = months[monthMatch[1].toLowerCase().slice(0, 3)];
    const d = monthMatch[2].padStart(2, '0');
    const y = monthMatch[3];
    return `${y}-${m}-${d}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

function normalizeTag(tag: string): string {
  const trimmed = String(tag || '').trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'gen5') return 'GEN5';
  if (lower === 'gen4') return 'GEN4';
  if (lower === 'gen3') return 'GEN3';
  if (lower === 'sata') return 'SATA';
  return trimmed;
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
  temperature?: number;
  thinkingLevel?: 'LOW' | 'HIGH';
}) {
  const ai = getAI();
  let lastError: any = null;

  const models = params.fastBulkImport ? BULK_IMPORT_MODELS : GEMINI_MODEL_CANDIDATES;
  const timeoutMs = params.timeoutMs || 25000;

  for (const model of models) {
    const started = performance.now();
    let useThinking = Boolean(params.fastBulkImport || params.thinkingLevel === 'LOW');

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config: any = {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseSchema ? 'application/json' : undefined,
          responseSchema: params.responseSchema,
          temperature: params.temperature !== undefined ? params.temperature : undefined,
        };

        if (useThinking) {
          config.thinkingConfig = { thinkingLevel: 'LOW' as any };
        }

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
        const errMsg = String(err?.message || '');

        // If model threw an invalid argument error on thinkingConfig, retry once without thinkingConfig on this model
        if (useThinking && (errMsg.includes('thinkingConfig') || errMsg.includes('thinking_config') || errMsg.includes('thinkingLevel') || errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('unknown field'))) {
          console.warn(`[AI generate] ${model} rejected thinkingConfig (${errMsg}), retrying once without thinkingConfig...`);
          useThinking = false;
          continue;
        }

        const isTransient =
          err?.status === 503 ||
          err?.code === 503 ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand');

        if (isTransient && attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        // On 429 (per-model quota limit), 404 (not found), timeout, or non-transient failure,
        // log and fall over to next candidate model immediately without aborting the loop
        console.warn(`[AI generate] ${model} failed (${errMsg || err?.status || 'error'}), falling over to next model candidate...`);
        break;
      }
    }
  }

  console.warn(`[AI generate notice] All candidate models exhausted:`, lastError?.message || lastError);
  throw lastError || new Error('All Gemini model endpoints are currently unavailable. Please retry in a moment.');
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
  if (response.status === 413) {
    throw new Error('Image attachment exceeds Discord webhook file limit (8MB). Please compress or capture at lower resolution.');
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
  
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/parse-bulk-entry', async (req, res) => {
    const started = performance.now();
    const { text, images, catalog } = req.body;
    try {
      let parts: any[] = [];
      if (Array.isArray(catalog) && catalog.length > 0) {
        const formattedCatalog = catalog
          .map((c: any) => `${c?.category || 'Other'} | ${c?.name || ''}${c?.tags?.length ? ` | ${c.tags.join(', ')}` : ''}`)
          .join('\n');
        parts.push({
          text: `EXISTING INVENTORY CATALOG:\n${formattedCatalog}\n`
        });
      }
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
      
      const systemInstruction = `You are an expert PC hardware inventory parser. Extract every individual PC hardware component from the user's raw text or receipt/label images into a structured JSON array.

Use your built-in world knowledge of all PC hardware brands, product lines, and specifications (across all manufacturers of CPUs, GPUs, Motherboards, RAM, Storage drives, Coolers, PSUs, Cases, and Fans):

1. SMART CANONICAL PRODUCT NAMING ('name'):
   - Convert shorthand, bare model numbers, or messy notes for ANY brand into a clean, canonical product name (Brand + Series/Line + Model + Key Spec/Capacity), while preserving all user-provided details (exact chipset, capacity, speed, latency, Ti/Super/XT/X3D suffix, edition).
   - If the user writes a bare or partial model (e.g. '7600X', '9950X3D', '14700K', '265K', 'WD SN850X 1TB', 'MP44L 2TB', 'Peerless Assassin 120', 'LT720', 'RM850e'), supply the full manufacturer and product family using your hardware knowledge (e.g. 'AMD Ryzen 5 7600X', 'AMD Ryzen 9 9950X3D', 'Intel Core i7-14700K', 'Intel Core Ultra 7 265K', 'WD_BLACK SN850X 1TB Gen4 NVMe SSD', 'TeamGroup MP44L 2TB Gen4 NVMe SSD', 'Thermalright Peerless Assassin 120', 'DeepCool LT720 360mm AIO', 'Corsair RM850e 850W').
   - NEVER include quantities ('1x', '2 pcs'), prices ('$250'), seller names, conditions, or health percentages ('0%', '98%') inside 'name'.
   - Do NOT output standalone section header lines (like 'Storage', 'CPUs', 'Seller: Bob') as items; instead, apply their context to the items below them.

2. ACCURATE CATEGORY CLASSIFICATION ('category'):
   - Must be one of: 'GPU', 'CPU', 'Motherboard', 'RAM', 'Cooling', 'Storage', 'PSU', 'Case', 'Fans', 'Accessories', 'Other'.
   - Classify using your hardware knowledge of the model (e.g. any NVMe/M.2/SSD/HDD is 'Storage'; any AIO or CPU air cooler is 'Cooling'; standalone case fans/fan packs are 'Fans').

3. AUTOMATIC TECHNICAL TAG INFERENCE ('tags'):
   - Using your real-world hardware knowledge of each component's specifications, automatically assign all applicable tags from the allowed list for that category—even when the user did not explicitly type the tag:
     * CPU: ['AM5', 'AM4', 'Intel'] (infer 'AM5' for Ryzen 7000/8000/9000; 'AM4' for Ryzen 1000-5000; 'Intel' for Intel CPUs).
     * GPU: ['50 Series', '40 Series', '30 Series', 'AMD', 'Black', 'White'] (infer '50 Series' for RTX 50xx, '40 Series' for RTX 40xx, '30 Series' for RTX 30xx, 'AMD' for Radeon RX).
     * Motherboard: ['AM5', 'AM4', 'Intel', 'ATX', 'mATX', 'ITX', 'Black', 'White'] (infer socket from chipset e.g. B650/X670/B850/X870 -> 'AM5', B450/B550/X570 -> 'AM4', B660/B760/Z690/Z790/Z890 -> 'Intel'; infer form factor 'mATX' for M-suffix boards like B650M, 'ITX' for I/ITX boards, 'ATX' for standard ATX boards).
     * RAM: ['DDR5', 'DDR4', 'Black', 'White', 'RGB', 'Non-RGB'] (infer 'DDR5' or 'DDR4' from speed/model; infer 'RGB' or 'Non-RGB' if known from the kit name).
     * Storage: ['GEN5', 'GEN4', 'GEN3', 'SATA'] (infer PCIe interface generation 'GEN5', 'GEN4', 'GEN3', or 'SATA' from the drive model's real-world specs).
     * Cooling: ['360mm', '240mm', 'Air Cooler', 'Black', 'White'] (infer '360mm' or '240mm' for liquid coolers of that size, or 'Air Cooler' for heatsink/tower air coolers).
     * PSU: ['ATX', 'SFX', 'ATX 3.0 / 3.1', 'Standard', 'Black', 'White'] (infer 'SFX' vs 'ATX' and 'ATX 3.0 / 3.1' vs 'Standard' from the PSU model).
     * Case: ['ATX', 'mATX', 'ITX', 'Black', 'White'] (infer form factor from the case model).
   - Color rule: Only include 'Black' or 'White' if mentioned in the input OR if the specific model/edition is inherently that color (e.g. 'Snow', 'ICE', 'White', 'Black').

4. QUANTITY & UNIT COST ('quantity', 'unitCost'):
   - 'quantity': integer count of units (default 1).
   - 'unitCost': price per single unit. If a total price is given for multiple units (e.g. '2x RAM $200 total'), divide by quantity to output unitCost (100).

5. STORAGE HEALTH ('healthPercent'):
   - For 'Storage' items, if ANY percentage (0% to 100%) appears on that item's line (even without the word 'health', e.g. '1x WD SN850X 1TB $100 0%' or '98%'), set 'healthPercent' to that integer (0 to 100). If no percentage is mentioned for that item, set 'healthPercent' to null.

6. BATCH METADATA ('seller', 'date', 'condition', 'paymentMethod'):
   - Propagate batch-level headers (Seller, Date, Condition, Payment Method) to all items under that batch until a new batch header appears.
   - Interpret numeric dates as day-first DD/MM/YYYY (Canadian format) and output 'YYYY-MM-DD'.
   - Default 'condition' to 'Used Open Box' and 'paymentMethod' to 'Cash' if not specified.

7. EXISTING CATALOG MATCHING (CRITICAL FOR DEDUPLICATION):
   - Whenever an imported part matches an existing model, capacity, chipset, and color/edition from the EXISTING INVENTORY CATALOG provided above, output the exact 'name', 'category', and 'tags' from that catalog entry. This ensures exact inventory deduplication and consistent naming across purchases.`;

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: [
                'GPU',
                'CPU',
                'RAM',
                'Storage',
                'Motherboard',
                'PSU',
                'Case',
                'Cooling',
                'Fans',
                'Accessories',
                'Other',
              ],
            },
            quantity: { type: Type.INTEGER },
            unitCost: { type: Type.NUMBER },
            condition: {
              type: Type.STRING,
              enum: ['Sealed', 'New Open Box', 'New No Box', 'Used Open Box', 'Used No Box'],
            },
            seller: { type: Type.STRING, nullable: true },
            date: { type: Type.STRING, nullable: true },
            paymentMethod: {
              type: Type.STRING,
              enum: ['Cash', 'E-Transfer', 'Credit Card'],
            },
            healthPercent: { type: Type.INTEGER, nullable: true },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['name', 'category', 'quantity', 'unitCost', 'condition', 'paymentMethod', 'tags'],
        },
      };

      const response = await generateGeminiContent({
        systemInstruction,
        contents: { parts },
        responseSchema,
        fastBulkImport: true,
        temperature: 0.1,
        thinkingLevel: 'LOW',
      });

      const rawData = parseModelJsonResponse(response.text, 'array');
      const rawArray = Array.isArray(rawData) ? rawData : [];

      const data = rawArray
        .filter((item: any) => item && typeof item.name === 'string' && item.name.trim().length >= 2)
        .map((item: any) => {
          const rawTags = Array.isArray(item.tags) ? item.tags : [];
          const normalizedTags = rawTags.map(normalizeTag).filter(Boolean);

          const date = item.date ? (parseDateToIso(item.date) || String(item.date).trim()) : undefined;

          const healthPercent =
            item.category === 'Storage' &&
            typeof item.healthPercent === 'number' &&
            Number.isFinite(item.healthPercent)
              ? Math.min(100, Math.max(0, Math.round(item.healthPercent)))
              : undefined;

          return {
            name: String(item.name).trim(),
            category: item.category,
            quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
            unitCost: Math.max(0, Number(item.unitCost) || 0),
            condition: item.condition || 'Used Open Box',
            seller: item.seller ? String(item.seller).trim() : undefined,
            date,
            paymentMethod: item.paymentMethod || 'Cash',
            healthPercent,
            tags: normalizedTags,
          };
        });

      res.setHeader('Server-Timing', `bulk-import;dur=${Math.round(performance.now() - started)}`);
      return res.status(200).json(data);
    } catch (err: any) {
      console.error('Bulk entry error:', err?.message || err);
      res.status(502).json({ error: 'AI parsing service failed. Please try again.' });
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

function deterministicGenerateTierBuilds(inventory: any[]): any[] {
  if (!Array.isArray(inventory) || inventory.length === 0) return [];

  const getPartsByCategory = (cat: string) =>
    inventory.filter((item) => (item.category || '').toLowerCase() === cat.toLowerCase());

  const gpus = getPartsByCategory('GPU').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const cpus = getPartsByCategory('CPU').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const mobos = getPartsByCategory('Motherboard').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const rams = getPartsByCategory('RAM').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const storages = getPartsByCategory('Storage').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const psus = getPartsByCategory('PSU').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const cases = getPartsByCategory('Case').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));
  const coolings = getPartsByCategory('Cooling').sort((a, b) => (b.unitCost || 0) - (a.unitCost || 0));

  const pickForTier = (arr: any[], index: number) => {
    if (arr.length === 0) return undefined;
    return arr[Math.min(index, arr.length - 1)];
  };

  const tiers = [
    { tier: 'tier1', tierName: 'HIGH-END FLAGSHIP', index: 0 },
    { tier: 'tier2', tierName: 'MID-RANGE PERFORMANCE', index: Math.floor(Math.max(1, gpus.length / 2)) },
    { tier: 'tier3', tierName: 'ENTRY / BUDGET', index: Math.max(0, gpus.length - 1) },
  ];

  return tiers.map(({ tier, tierName, index }) => {
    const gpu = pickForTier(gpus, index);
    const cpu = pickForTier(cpus, index);
    const mobo = pickForTier(mobos, index);
    const ram = pickForTier(rams, index);
    const storage = pickForTier(storages, index);
    const psu = pickForTier(psus, index);
    const cCase = pickForTier(cases, index);
    const cooling = pickForTier(coolings, index);

    const partIds = [gpu?.id, cpu?.id, mobo?.id, ram?.id, storage?.id, psu?.id, cCase?.id, cooling?.id].filter(Boolean);
    const buildName = cpu && gpu ? `${cpu.name} + ${gpu.name}` : cpu ? cpu.name : gpu ? gpu.name : `${tierName} Build`;

    return {
      tier,
      tierName,
      buildName,
      partIds,
      notes: 'Deterministic hardware synergy optimized from current stock.',
    };
  });
}

  app.post('/api/generate-tier-builds', async (req, res) => {
    const { inventory, seed } = req.body;
    try {
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
      console.error('AI tier build generation error:', err?.message || err);
      try {
        const fallbackBuilds = deterministicGenerateTierBuilds(inventory);
        if (fallbackBuilds.length > 0) {
          console.info('[Tier Builds] Falling back to deterministic tier allocation.');
          return res.json({ builds: fallbackBuilds });
        }
      } catch (fallbackErr) {
        console.error('Deterministic tier fallback error:', fallbackErr);
      }
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

      if (parsedImage && parsedImage.buffer.length > 7.5 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Build photo is too large for Discord webhook (max 7.5MB). Please resize or capture at lower resolution.'
        });
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

      if (parsedImage.buffer.length > 7.5 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Build card image is too large for Discord webhook (max 7.5MB). Please resize or compress.'
        });
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

  // Fallback for unmatched API routes to ensure they return JSON 404 instead of falling through to Vite's HTML SPA
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.path} not found` });
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
