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
  const rawLines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(item|part|name|qty|price|cost|seller|notes)\b/i.test(l));

  if (rawLines.length === 0) return [];

  let batchSeller = '';
  let batchDate = '';
  let batchCondition = '';
  let batchPaymentMethod = '';

  const nonHeaderLines: string[] = [];

  for (const line of rawLines) {
    const isExplicitHeader =
      /^(?:supplier|seller|vendor|store|date|condition(?:\s+for\s+all)?|payment|notes?)\s*:/i.test(line) ||
      /^(?:batch\s+date|batch\s+condition|batch\s+seller)/i.test(line);

    const isDelimitedHeader =
      !isExplicitHeader &&
      !/\b(?:rtx|gtx|rx|ryzen|intel|core|ddr[45]|nvme|ssd|motherboard|b650|b850|x870|z790|am5|am4|360mm|240mm)\b/i.test(line) &&
      /(?:e-transfer|cash|paypal|credit card|debit|crypto|\b20\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})/i.test(line);

    if (isExplicitHeader || isDelimitedHeader) {
      if (/^(?:supplier|seller|vendor|store)\s*:\s*(.*)/i.test(line)) {
        batchSeller = line.replace(/^(?:supplier|seller|vendor|store)\s*:\s*/i, '').trim();
      } else if (/^(?:date)\s*:\s*(.*)/i.test(line)) {
        const rawDate = line.replace(/^(?:date)\s*:\s*/i, '').trim();
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          batchDate = parsed.toISOString().split('T')[0];
        } else {
          batchDate = rawDate;
        }
      } else if (/^(?:condition(?:\s+for\s+all)?)\s*:\s*(.*)/i.test(line)) {
        const rawC = line.replace(/^(?:condition(?:\s+for\s+all)?)\s*:\s*/i, '').trim().toLowerCase();
        if (/sealed/i.test(rawC)) batchCondition = 'Sealed';
        else if (/new\s+open\s+box/i.test(rawC)) batchCondition = 'New Open Box';
        else if (/new\s+no\s+box/i.test(rawC)) batchCondition = 'New No Box';
        else if (/used\s+no\s+box/i.test(rawC)) batchCondition = 'Used No Box';
        else if (/used/i.test(rawC)) batchCondition = 'Used Open Box';
        else batchCondition = 'New No Box';
      } else if (/^(?:payment)\s*:\s*(.*)/i.test(line)) {
        batchPaymentMethod = line.replace(/^(?:payment)\s*:\s*/i, '').trim();
      } else if (isDelimitedHeader) {
        const parts = line.split(/[•|·,\-\/]/).map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          if (/\b(e-transfer|cash|paypal|credit card|debit|crypto)\b/i.test(part)) {
            const pmMatch = part.match(/\b(e-transfer|cash|paypal|credit card|debit|crypto)\b/i);
            if (pmMatch) {
              const lower = pmMatch[1].toLowerCase();
              batchPaymentMethod = lower === 'e-transfer' ? 'E-Transfer' : lower === 'credit card' ? 'Credit Card' : lower.charAt(0).toUpperCase() + lower.slice(1);
            }
          } else if (/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[a-zA-Z]+\s+\d{1,2},?\s+\d{4})\b/.test(part)) {
            const parsed = new Date(part);
            if (!isNaN(parsed.getTime())) {
              batchDate = parsed.toISOString().split('T')[0];
            }
          } else if (!batchSeller && part.length >= 2 && !/^(date|payment|seller):/i.test(part)) {
            batchSeller = part.replace(/^(?:seller|store)\s*:\s*/i, '').trim();
          }
        }
      }
    } else {
      nonHeaderLines.push(line);
    }
  }

  // Group paired lines if formatted as (Category/Specs/Condition) followed by (Price/Qty/Product)
  const groupedEntries: string[] = [];
  for (let i = 0; i < nonHeaderLines.length; i++) {
    const curr = nonHeaderLines[i];
    const next = i + 1 < nonHeaderLines.length ? nonHeaderLines[i + 1] : null;

    if (
      next &&
      /^(?:Motherboard|CPU|GPU|RAM|Storage|PSU|Case|Cooling|Fans|Accessories|Other)\b/i.test(curr) &&
      /^\s*[\$•\d]/i.test(next) &&
      /\$\s*\d+/i.test(next)
    ) {
      groupedEntries.push(`${curr} • ${next}`);
      i++; // Skip paired line
    } else {
      groupedEntries.push(curr);
    }
  }

  return groupedEntries.map((line) => {
    let remaining = line;

    // 1. Quantity (e.g. 10x, 2x, 5 pcs, 1 x)
    let quantity = 1;
    const qtyMatch = remaining.match(/(\d+)\s*(?:x|pcs|units|ct)\s+/i) || remaining.match(/\b(\d+)\s*(?:x|pcs|units|ct)\b/i);
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

    // 4. Condition (Item-level condition overrides global batch condition)
    let condition = batchCondition || 'Used Open Box';
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

    // 5. Category (prioritize explicit hardware keywords over ambiguous sockets/chipsets)
    let category = 'Other';
    const lower = remaining.toLowerCase();
    if (/^(motherboard|mobo|mainboard)\b/i.test(remaining) || /\b(motherboard|mobo|mainboard|b650|b550|z790|z690|x670|b850|x870|b760|z890|a620)\b/i.test(lower)) {
      category = 'Motherboard';
    } else if (/^(gpu|graphics card)\b/i.test(remaining) || /\b(rtx|gtx|radeon|rx\s*\d|geforce|graphics card|gpu|arc\s*a)\b/i.test(lower)) {
      category = 'GPU';
    } else if (/^(cpu|processor)\b/i.test(remaining) || /\b(ryzen|intel|core\s*i[3579]|cpu|processor|threadripper|7800x3d|7700x?|7600x?|5600x?|14900k?|13700k?|12600k?)\b/i.test(lower)) {
      category = 'CPU';
    } else if (/^(ram|memory)\b/i.test(remaining) || /\b(ddr[45]|ram|memory|vengeance|trident|fury|corsair\s*rgb)\b/i.test(lower)) {
      category = 'RAM';
    } else if (/^(storage|ssd|nvme)\b/i.test(remaining) || /\b(ssd|nvme|m\.2|hard\s*drive|hdd|sata|evo|sn\d{3}|barracuda|kc3000|pm9a1)\b/i.test(lower)) {
      category = 'Storage';
    } else if (/^(cooling|cooler)\b/i.test(remaining) || /\b(cooler|aio|liquid\s*cool\w*|fan|heatsink|noctua|kraken|assassin|thermalright|\b\d{3}mm\b|hydroshift|prism|wraith)\b/i.test(lower)) {
      category = 'Cooling';
    } else if (/^(psu|power supply)\b/i.test(remaining) || /\b(psu|power\s*supply|gold|bronze|platinum|watt|\b\d{3,4}w\b|corsair\s*rm\w*|seasonic|superflower|toughpower)\b/i.test(lower)) {
      category = 'PSU';
    } else if (/^(case|chassis)\b/i.test(remaining) || /\b(case|chassis|h9|h5|h7|o11|4000d|5000d|pop\s*air|ch160|montech|lancool)\b/i.test(lower)) {
      category = 'Case';
    }

    // 6. Extract Tags
    const tags: string[] = [];
    if (/\bAM5\b/i.test(remaining)) tags.push('AM5');
    if (/\bAM4\b/i.test(remaining)) tags.push('AM4');
    if (/\bIntel\b/i.test(remaining)) tags.push('Intel');
    if (/\bATX\b/i.test(remaining)) tags.push('ATX');
    if (/\bmATX\b/i.test(remaining) || /\bMicro-ATX\b/i.test(remaining)) tags.push('mATX');
    if (/\bITX\b/i.test(remaining) || /\bMini-ITX\b/i.test(remaining)) tags.push('ITX');
    if (/\bWhite\b/i.test(remaining)) tags.push('White');
    if (/\bBlack\b/i.test(remaining)) tags.push('Black');
    if (/\bDDR5\b/i.test(remaining)) tags.push('DDR5');
    if (/\bDDR4\b/i.test(remaining)) tags.push('DDR4');
    if (/\bGEN5\b/i.test(remaining)) tags.push('GEN5');
    if (/\bGEN4\b/i.test(remaining)) tags.push('GEN4');
    if (/\bGEN3\b/i.test(remaining)) tags.push('GEN3');
    if (/\bSATA\b/i.test(remaining)) tags.push('SATA');

    // Clean leading/trailing category prefixes and bullet separators
    let cleanName = remaining
      .replace(/^(?:Motherboard|CPU|GPU|RAM|Storage|PSU|Case|Cooling|Fans|Accessories|Other)\s*[•|·,\-\/]?\s*/i, '')
      .replace(/[•|·,\-\/]+/g, ' ')
      .replace(/^[,\-–—:\s•]+|[,\-–—:\s•]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!cleanName) {
      cleanName = line;
    } else {
      // Deterministic canonical expansion for common hardware shorthand
      if (category === 'GPU') {
        const gpuShorthand = cleanName.match(/^(?:rtx\s*)?(50\d{2}|40\d{2}|30\d{2})(?:\s*(ti\s*super|ti|super))?$/i);
        if (gpuShorthand) {
          const mod = gpuShorthand[1];
          const suf = gpuShorthand[2] ? (gpuShorthand[2].toLowerCase().includes('ti super') ? 'Ti Super' : gpuShorthand[2].toLowerCase().includes('ti') ? 'Ti' : 'Super') : '';
          let canonicalVram = '';
          if (mod === '5090') canonicalVram = ' 32GB';
          else if (mod === '5080') canonicalVram = ' 16GB';
          else if (mod === '5070' && suf.includes('Ti')) canonicalVram = ' 16GB';
          else if (mod === '5070') canonicalVram = ' 12GB';
          else if (mod === '4090') canonicalVram = ' 24GB';
          else if (mod === '4080') canonicalVram = ' 16GB';
          else if (mod === '4070' && suf.includes('Ti Super')) canonicalVram = ' 16GB';
          else if (mod === '4070' && suf.includes('Ti')) canonicalVram = ' 12GB';
          else if (mod === '4070') canonicalVram = ' 12GB';
          else if (mod === '4060' && !suf.includes('Ti')) canonicalVram = ' 8GB';
          cleanName = `RTX ${mod}${suf ? ' ' + suf : ''}${canonicalVram}`;
        }
      } else if (category === 'CPU') {
        const ryzenShorthand = cleanName.match(/^(?:ryzen\s*[3579]\s*)?(9\d{3}x3d|7\d{3}x3d|5\d{3}x3d|\d{4}x?)$/i);
        if (ryzenShorthand) {
          const modelNum = ryzenShorthand[1].toUpperCase();
          const tier = modelNum.startsWith('9') || modelNum.startsWith('7') ? 'Ryzen 7' : 'Ryzen 5';
          const cores = modelNum.includes('9800X3D') || modelNum.includes('7800X3D') ? ' (8C/16T)' : '';
          cleanName = `AMD ${tier} ${modelNum}${cores}`;
        }
      } else if (category === 'Storage') {
        if (/^sn\d{3}\b/i.test(cleanName)) {
          cleanName = cleanName.replace(/^(sn\d{3})\b/i, 'WD_BLACK $1').trim();
          if (!/nvme|ssd/i.test(cleanName)) cleanName += ' Gen4 NVMe SSD';
          cleanName = cleanName.replace(/\s{2,}/g, ' ');
        } else if (/^990\s*pro\b/i.test(cleanName)) {
          cleanName = cleanName.replace(/^990\s*pro\b/i, 'Samsung 990 PRO').trim();
          if (!/nvme|ssd/i.test(cleanName)) cleanName += ' Gen4 NVMe SSD';
          cleanName = cleanName.replace(/\s{2,}/g, ' ');
        } else if (/^980\s*pro\b/i.test(cleanName)) {
          cleanName = cleanName.replace(/^980\s*pro\b/i, 'Samsung 980 PRO').trim();
          if (!/nvme|ssd/i.test(cleanName)) cleanName += ' Gen4 NVMe SSD';
          cleanName = cleanName.replace(/\s{2,}/g, ' ');
        }
      }
    }

    return {
      name: cleanName,
      category,
      quantity,
      unitCost,
      condition,
      seller: batchSeller || undefined,
      date: batchDate || undefined,
      paymentMethod: batchPaymentMethod || undefined,
      healthPercent: category === 'Storage' ? healthPercent : undefined,
      tags,
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
  
  app.use(express.json({ limit: '10mb' }));

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
Accept ANY text format: multi-line item blocks, bullet-separated notes, formatted headers (e.g. 'Seller: Roop | Date: 2024-05-22'), unstructured free-form lists, chat logs, single-line entries, or receipts.

CRITICAL RULE: BATCH METADATA HEADERS vs HARDWARE LINE ITEMS:
1. Lines indicating metadata for the batch (e.g., "Supplier: Roop", "Store: Best Buy", "Date: Oct 9th 2026", "Condition for all: new no box", "Payment: Cash") are NOT hardware items.
2. ABSOLUTE PROHIBITION: NEVER output a JSON item representing a header!
   - ❌ WRONG: { "name": "Supplier: Roop", "category": "Other", "unitCost": 0 }
   - ❌ WRONG: { "name": "Condition for all: new no box", "category": "Other" }
   - ❌ WRONG: { "name": "Date: Oct 9th 2026", "category": "Other" }
3. CASCADING RULE:
   - Extract the batch seller ("Roop"), batch date ("2026-10-09"), batch condition ("New No Box"), and batch payment ("Cash").
   - INJECT these values into every extracted hardware component item in that batch.
   - If an individual item states its own override (e.g. "5070ti used"), the item's individual condition takes precedence over the batch condition.

2. MULTI-LINE & DELIMITED ITEM BLOCKS:
   - Items are frequently formatted in 2-line blocks separated by bullets ('•'), pipes ('|'), commas, or dashes:
     Example:
       Motherboard • AM5 • ATX • White • New Open Box
       $274.52 • 1 x Gigabyte X870E Aorus Elite WiFi7 ICE
     -> This represents ONE SINGLE item:
       - name: "Gigabyte X870E Aorus Elite WiFi7 ICE"
       - category: "Motherboard"
       - tags: ["AM5", "ATX", "White"]
       - condition: "New Open Box"
       - unitCost: 274.52
       - quantity: 1
   - NEVER split a multi-line product entry into two separate items! Combine the category/specs line and the price/quantity/model line into one complete component item.

3. CLEAN PRODUCT NAME RULES:
   - 'name': Pure hardware brand and model name ONLY (e.g. 'Gigabyte X870E Aorus Elite WiFi7 ICE', 'ASUS ROG Strix X870-A Gaming WiFi', 'Ryzen 7 7800X3D', 'RTX 4070 Super', '1TB NVMe GEN4 SSD').
   - NEVER include category names (e.g. 'Motherboard •'), bullet symbols ('•', '-', '*'), prices ('$274.52'), or quantity markers ('1 x', '2x') in the 'name' field.

4. FIELD RULES:
   - 'category': One of 'GPU', 'CPU', 'RAM', 'Storage', 'Motherboard', 'PSU', 'Case', 'Cooling', 'Fans', 'Accessories', or 'Other'.
   - 'seller': Concise seller or store name ONLY (e.g. 'Outlut Electronics', 'Roop', 'Best Buy', 'Amazon', 'Memory Express'). Maximum 1-3 words. If no seller is mentioned or identifiable, leave empty ("").
   - 'date': Purchase date formatted as YYYY-MM-DD (e.g. '2026-10-06'). If no date is found, leave empty ("").
   - 'paymentMethod': One of 'Cash', 'E-Transfer', 'PayPal', 'Credit Card', 'Debit', 'Crypto', or 'Other'. Default to 'Cash' if not stated.
   - 'condition': Exactly one of 'Sealed', 'New Open Box', 'New No Box', 'Used Open Box', or 'Used No Box'. Default to 'Used Open Box' if used/unspecified.
   - 'quantity': Integer quantity (e.g. '1 x' -> 1, '2 x' -> 2, '3x' -> 3). Default to 1.
   - 'unitCost': Exact numeric per-unit cost without currency symbols (e.g. 274.52). If cost is not mentioned, set to 0.
   - 'healthPercent': ONLY for Storage items when an explicit health percentage is stated (e.g. '98% health' -> 98). Leave absent if not stated.
   - 'tags': Preset sub-category tags matching allowed values:
     * CPU: AM5, AM4, Intel
     * Motherboard: AM5, AM4, Intel, ATX, mATX, ITX, Black, White
     * RAM: DDR5, DDR4, Black, White, RGB, Non-RGB
     * GPU: 50 Series, 40 Series, 30 Series, AMD
     * Storage: GEN5, GEN4, GEN3, SATA
     * PSU: ATX, SFX, ATX 3.0 / 3.1, Standard, Black, White
     * Case: ATX, mATX, ITX, Black, White
     * Cooling: 360mm, 240mm, Air Cooler, Black, White

5. CANONICAL HARDWARE SHORTHAND EXPANSION RULES:
   - When the user inputs shorthand, slang, or truncated model names, standardize the 'name' field into clean canonical PC industry conventions while strictly preserving ALL stated brand and specification details:
     * CPU: Standardize brand and tier (e.g., "9800x3d" -> "AMD Ryzen 7 9800X3D", "7800x3d" -> "AMD Ryzen 7 7800X3D", "14700k" -> "Intel Core i7-14700K").
     * GPU: Preserve specific AIB brand, tier, and model name cleanly (e.g., "msi 5080 trio" -> "MSI GeForce RTX 5080 Gaming Trio", "7900xtx" -> "Radeon RX 7900 XTX").
     * RAM: Preserve exact sub-brands and specs (e.g., "T-Force RGB 32gb 6000 cl30" -> "T-Force Delta RGB 32GB (2x16GB) DDR5 6000MHz CL30"). Do not prepend parent companies unless explicitly typed.
     * Motherboard: "b650 eagle" -> "Gigabyte B650 Eagle AX", "b650 tomahawk" -> "MSI MAG B650 Tomahawk WiFi".
     * Storage: "990 pro 1tb" -> "Samsung 990 PRO 1TB Gen4 NVMe SSD", "sn850x 2tb" -> "WD_BLACK SN850X 2TB Gen4 NVMe SSD".
     * PSU: "rm850x" -> "Corsair RM850x 850W Gold PSU".

   - STRICT COLOR RULE: DO NOT guess, assume, or infer color tags (Black/White) unless explicitly stated in the input text! Never add "Black" or "White" into the name or tags unless the raw text explicitly specified it.
   - VERBATIM NAMES: DO NOT attempt to clean, standardize, or alter the component names. If the user provides a name with specific suffixes like '(8C/16T)' or color descriptors like 'White', you MUST extract the Name EXACTLY as it is written in the raw text.
   - TAG MAPPING: You must explicitly extract and map all subcategory tags provided in the text block headers (e.g., 'Black', 'White', 'RGB', '50 Series') directly into the JSON 'tags' array. Never ignore explicit color tags.

ABSOLUTE NEGATIVE CONSTRAINT:
NEVER output internal reasoning, commentary, or headers as items. Every item in the output array must represent a real hardware component.`;

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
      const rawArray = Array.isArray(rawData) ? rawData : [];

      // 1. Identify and extract batch metadata from any accidental header rows
      let batchSellerOverride = '';
      let batchDateOverride = '';
      let batchConditionOverride = '';
      let batchPaymentOverride = '';

      const nonHeaderItems = rawArray.filter((item: any) => {
        const name = String(item.name || '').trim();
        const isHeaderRow =
          /^(?:supplier|seller|vendor|store|date|condition(?:\s+for\s+all)?|payment|notes?)\s*:/i.test(name) ||
          /^(?:batch\s+date|batch\s+condition|batch\s+seller)/i.test(name);

        if (isHeaderRow) {
          if (/^(?:supplier|seller|vendor|store)\s*:\s*(.*)/i.test(name)) {
            batchSellerOverride = name.replace(/^(?:supplier|seller|vendor|store)\s*:\s*/i, '').trim();
          } else if (/^(?:date)\s*:\s*(.*)/i.test(name)) {
            const rawD = name.replace(/^(?:date)\s*:\s*/i, '').trim();
            const parsedD = new Date(rawD);
            if (!isNaN(parsedD.getTime())) {
              batchDateOverride = parsedD.toISOString().split('T')[0];
            } else {
              batchDateOverride = rawD;
            }
          } else if (/^(?:condition(?:\s+for\s+all)?)\s*:\s*(.*)/i.test(name)) {
            const rawC = name.replace(/^(?:condition(?:\s+for\s+all)?)\s*:\s*/i, '').trim().toLowerCase();
            if (/sealed/i.test(rawC)) batchConditionOverride = 'Sealed';
            else if (/new\s+open\s+box/i.test(rawC)) batchConditionOverride = 'New Open Box';
            else if (/new\s+no\s+box/i.test(rawC)) batchConditionOverride = 'New No Box';
            else if (/used\s+no\s+box/i.test(rawC)) batchConditionOverride = 'Used No Box';
            else if (/used/i.test(rawC)) batchConditionOverride = 'Used Open Box';
            else batchConditionOverride = 'New No Box';
          } else if (/^(?:payment)\s*:\s*(.*)/i.test(name)) {
            batchPaymentOverride = name.replace(/^(?:payment)\s*:\s*/i, '').trim();
          }
          return false; // Drop header row from line items
        }
        return true;
      });

      // Also harvest batch values from items if some items had them and others missed them
      for (const item of nonHeaderItems) {
        if (!batchSellerOverride && item.seller && String(item.seller).trim().length > 0) {
          batchSellerOverride = String(item.seller).trim();
        }
        if (!batchDateOverride && item.date && String(item.date).trim().length > 0) {
          batchDateOverride = String(item.date).trim();
        }
        if (!batchConditionOverride && item.condition && item.condition !== 'Used Open Box') {
          batchConditionOverride = item.condition;
        }
        if (!batchPaymentOverride && item.paymentMethod) {
          batchPaymentOverride = item.paymentMethod;
        }
      }

      const data = nonHeaderItems.map((item: any) => {
        const itemTags = Array.isArray(item.tags) ? item.tags : [];
        let cleanSeller = '';
        const rawSeller = item.seller || item.vendor || batchSellerOverride;
        if (rawSeller && typeof rawSeller === 'string') {
          let str = rawSeller.trim();
          if (str.includes('\n')) str = str.split('\n')[0].trim();
          str = str.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
          str = str.replace(/^(?:Seller|Vendor|Supplier|Store)\s*:\s*/i, '').trim();
          if (str.length > 30) {
            const firstWord = str.split(/[\s,;|]/)[0];
            str = firstWord.length > 1 ? firstWord : str.slice(0, 30);
          }
          cleanSeller = str;
        }

        let cleanName = String(item.name || '').trim();
        // Strip leading bullets, dots, dashes, and quantity indicators (e.g. "• 1 x " or "1 x ")
        cleanName = cleanName.replace(/^[•\-\*\s]+/, '');
        cleanName = cleanName.replace(/^\d+\s*x\s+/i, '');
        cleanName = cleanName.replace(/^[•\-\*\s]+/, '').trim();

        if (cleanSeller && cleanName) {
          const escapedSeller = cleanSeller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleanName = cleanName.replace(new RegExp(`^${escapedSeller}\\s+`, 'i'), '').trim();
        }

        // Apply cascaded condition if item's condition was absent or fallback 'Used Open Box' and batchConditionOverride exists
        let condition = item.condition || 'Used Open Box';
        if ((!item.condition || item.condition === 'Used Open Box') && batchConditionOverride) {
          condition = batchConditionOverride;
        }

        // Normalize condition
        const condLower = String(condition).toLowerCase();
        if (/sealed/i.test(condLower)) condition = 'Sealed';
        else if (/new\s+open\s+box/i.test(condLower)) condition = 'New Open Box';
        else if (/new\s+no\s+box/i.test(condLower)) condition = 'New No Box';
        else if (/used\s+no\s+box/i.test(condLower)) condition = 'Used No Box';
        else if (/used\s+open\s+box|used/i.test(condLower)) condition = 'Used Open Box';

        const date = item.date || batchDateOverride || undefined;
        const paymentMethod = item.paymentMethod || batchPaymentOverride || undefined;

        const { vendor: _v, ...restItem } = item;
        return {
          ...restItem,
          name: cleanName || item.name,
          seller: cleanSeller || undefined,
          date,
          paymentMethod,
          condition,
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
      }).filter((item: any) => {
        // Filter out accidental non-product rows (e.g. pure headers, empty rows)
        if (!item.name || item.name.trim().length < 2) return false;
        if (/^[•\-\*\s]+$/.test(item.name)) return false;
        if (/^(?:supplier|seller|vendor|store|date|condition(?:\s+for\s+all)?|payment|notes?)\s*:/i.test(item.name)) return false;
        return true;
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
