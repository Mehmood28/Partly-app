import { ComponentCategory } from '../../../types';

export interface ExtractedPartInput {
  id: string;
  category: ComponentCategory;
  name: string;
  quantity: number;
  unitCost: number;
  isLocked?: boolean;
  tags?: string[];
}

export const CATEGORY_WEIGHTS: Record<ComponentCategory, number> = {
  GPU: 0.38,
  CPU: 0.22,
  Motherboard: 0.12,
  RAM: 0.08,
  Cooling: 0.03,
  Storage: 0.06,
  PSU: 0.06,
  Case: 0.05,
  Fans: 0.02,
  Accessories: 0.02,
  Other: 0.02,
};

export const STANDARD_8_CATEGORIES: ComponentCategory[] = [
  'GPU',
  'CPU',
  'Motherboard',
  'RAM',
  'Cooling',
  'Storage',
  'PSU',
  'Case',
];

export const createInitialParts = (): ExtractedPartInput[] => {
  return STANDARD_8_CATEGORIES.map((category, idx) => ({
    id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    category,
    name: '',
    quantity: 1,
    unitCost: 0,
    isLocked: false,
    tags: [],
  }));
};

export interface CostAllocationResult {
  success: boolean;
  parts: ExtractedPartInput[];
  error?: string;
}

/**
 * Allocates an exact whole-PC cost basis across only the named component rows.
 * Manually priced (locked) rows are preserved and the remaining cents are
 * distributed by category weight. Blank rows are intentionally ignored.
 */
export const allocateOptionalPartCosts = (
  parts: ExtractedPartInput[],
  targetCost: number
): CostAllocationResult => {
  if (typeof targetCost !== 'number' || !Number.isFinite(targetCost) || targetCost < 0) {
    return { success: false, parts: [], error: 'Purchase price must be a valid non-negative amount.' };
  }

  const activeParts = parts
    .filter((part) => part.name.trim().length > 0)
    .map((part) => ({ ...part, name: part.name.trim(), tags: part.tags ? [...part.tags] : undefined }));

  if (activeParts.length === 0) {
    return { success: true, parts: [] };
  }

  for (const part of activeParts) {
    if (!Number.isInteger(part.quantity) || part.quantity <= 0) {
      return { success: false, parts: [], error: `${part.name} must have a positive whole quantity.` };
    }
    if (typeof part.unitCost !== 'number' || !Number.isFinite(part.unitCost) || part.unitCost < 0) {
      return { success: false, parts: [], error: `${part.name} must have a valid non-negative cost.` };
    }
  }

  const targetCents = Math.round(targetCost * 100);
  const lockedParts = activeParts.filter((part) => part.isLocked);
  const unlockedParts = activeParts.filter((part) => !part.isLocked);
  const lockedCents = lockedParts.reduce(
    (sum, part) => sum + part.quantity * Math.round(part.unitCost * 100),
    0
  );

  if (lockedCents > targetCents) {
    return {
      success: false,
      parts: [],
      error: 'Manually entered component costs exceed the total PC purchase price.',
    };
  }

  if (unlockedParts.length === 0) {
    if (lockedCents !== targetCents) {
      return {
        success: false,
        parts: [],
        error: 'Component costs must add up to the total PC purchase price.',
      };
    }
    return { success: true, parts: activeParts };
  }

  const remainingCents = targetCents - lockedCents;
  const totalWeight = unlockedParts.reduce(
    (sum, part) => sum + (CATEGORY_WEIGHTS[part.category] ?? 0.02),
    0
  );

  // 1. Compute ideal fractional line cents and floor unit cents (Largest Remainder Method)
  const items = unlockedParts.map((p) => {
    const weight = CATEGORY_WEIGHTS[p.category] ?? 0.02;
    const idealLine = (remainingCents * weight) / totalWeight;
    const unitFloor = Math.max(0, Math.floor(idealLine / p.quantity));
    const allocatedLine = unitFloor * p.quantity;
    const remainder = idealLine - allocatedLine;
    return {
      part: p,
      unitCents: unitFloor,
      quantity: p.quantity,
      remainder,
      weightRatio: remainder / p.quantity,
    };
  });

  let currentTotal = items.reduce((sum, it) => sum + it.unitCents * it.quantity, 0);
  let delta = remainingCents - currentTotal;

  // 2. Sort by largest fractional remainder per unit (Hamilton-Hare / Largest Remainder)
  const sortedIndices = items
    .map((_, idx) => idx)
    .sort((a, b) => items[b].weightRatio - items[a].weightRatio);

  for (const idx of sortedIndices) {
    if (delta >= items[idx].quantity) {
      items[idx].unitCents += 1;
      delta -= items[idx].quantity;
    }
  }

  // 3. If delta is 0, exact integer allocation achieved
  if (delta === 0) {
    const allocatedMap = new Map(items.map((it) => [it.part.id, it.unitCents / 100]));
    return {
      success: true,
      parts: activeParts.map((p) =>
        p.isLocked ? p : { ...p, unitCost: allocatedMap.get(p.id) ?? 0 }
      ),
    };
  }

  // 4. If delta > 0, check if an item with quantity === 1 exists to absorb remainder
  const unitOneIdx = items.findIndex((it) => it.quantity === 1);
  if (unitOneIdx !== -1) {
    items[unitOneIdx].unitCents += delta;
    const allocatedMap = new Map(items.map((it) => [it.part.id, it.unitCents / 100]));
    return {
      success: true,
      parts: activeParts.map((p) =>
        p.isLocked ? p : { ...p, unitCost: allocatedMap.get(p.id) ?? 0 }
      ),
    };
  }

  // 5. Integer search across unlocked items to absorb delta without remainder
  let searchFound = false;
  const maxSearchRange = 10;
  for (let i = 0; i < items.length && !searchFound; i++) {
    for (let adj = -maxSearchRange; adj <= maxSearchRange; adj++) {
      if (adj === 0 || items[i].unitCents + adj < 0) continue;
      if (adj * items[i].quantity === delta) {
        items[i].unitCents += adj;
        searchFound = true;
        break;
      }
    }
  }

  if (!searchFound && items.length >= 2) {
    for (let i = 0; i < items.length && !searchFound; i++) {
      for (let j = 0; j < items.length && !searchFound; j++) {
        if (i === j) continue;
        for (let a = -maxSearchRange; a <= maxSearchRange && !searchFound; a++) {
          if (items[i].unitCents + a < 0) continue;
          for (let b = -maxSearchRange; b <= maxSearchRange; b++) {
            if (items[j].unitCents + b < 0) continue;
            if (a * items[i].quantity + b * items[j].quantity === delta) {
              items[i].unitCents += a;
              items[j].unitCents += b;
              searchFound = true;
              break;
            }
          }
        }
      }
    }
  }

  if (searchFound) {
    const allocatedMap = new Map(items.map((it) => [it.part.id, it.unitCents / 100]));
    return {
      success: true,
      parts: activeParts.map((p) =>
        p.isLocked ? p : { ...p, unitCost: allocatedMap.get(p.id) ?? 0 }
      ),
    };
  }

  // 6. Absolute edge-case guarantee: if all parts have gcd > 1 and cannot divide delta,
  // split one multi-quantity part into (qty - 1) and 1 unit to absorb odd pennies perfectly
  const splitCandidateIdx = items.findIndex((it) => it.quantity > 1);
  if (splitCandidateIdx !== -1) {
    const candidate = items[splitCandidateIdx];
    const unitCentsBase = candidate.unitCents;
    const qty = candidate.quantity;
    const remainingForCandidate = unitCentsBase * qty + delta;
    const baseCents = Math.floor(remainingForCandidate / qty);
    const extraCents = remainingForCandidate % qty;

    const resultParts: ExtractedPartInput[] = [];
    for (const part of activeParts) {
      if (part.isLocked) {
        resultParts.push(part);
      } else if (part.id !== candidate.part.id) {
        const item = items.find((it) => it.part.id === part.id);
        resultParts.push({ ...part, unitCost: (item?.unitCents ?? 0) / 100 });
      } else {
        if (qty > 1) {
          resultParts.push({
            ...part,
            quantity: qty - 1,
            unitCost: baseCents / 100,
          });
        }
        resultParts.push({
          ...part,
          id: `${part.id}-bal`,
          name: `${part.name} (Unit ${qty})`,
          quantity: 1,
          unitCost: (baseCents + extraCents) / 100,
        });
      }
    }

    return { success: true, parts: resultParts };
  }

  // Fallback: assign remaining cents to the first unlocked part
  items[0].unitCents += Math.round(delta / items[0].quantity);
  const allocatedMap = new Map(items.map((it) => [it.part.id, it.unitCents / 100]));
  return {
    success: true,
    parts: activeParts.map((p) =>
      p.isLocked ? p : { ...p, unitCost: allocatedMap.get(p.id) ?? 0 }
    ),
  };
};
