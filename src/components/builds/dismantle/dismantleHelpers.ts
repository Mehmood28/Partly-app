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
  const balancingPart =
    unlockedParts.find((part) => part.quantity === 1) ||
    [...unlockedParts].sort((a, b) => a.quantity - b.quantity)[0];
  const unitCentsById = new Map<string, number>();
  let allocatedCents = 0;

  for (const part of unlockedParts) {
    if (part.id === balancingPart.id) continue;
    const weight = CATEGORY_WEIGHTS[part.category] ?? 0.02;
    const weightedLineCents = Math.floor((remainingCents * weight) / totalWeight);
    const unitCents = Math.floor(weightedLineCents / part.quantity);
    unitCentsById.set(part.id, unitCents);
    allocatedCents += unitCents * part.quantity;
  }

  let balancingCents = remainingCents - allocatedCents;
  if (balancingCents % balancingPart.quantity !== 0) {
    const adjustable = unlockedParts.filter(
      (part) => part.id !== balancingPart.id && (unitCentsById.get(part.id) || 0) > 0
    );
    let resolved = false;
    for (const part of adjustable) {
      const currentUnitCents = unitCentsById.get(part.id) || 0;
      const maxAdjustment = Math.min(currentUnitCents, balancingPart.quantity);
      for (let adjustment = 1; adjustment <= maxAdjustment; adjustment++) {
        const candidateBalancingCents = balancingCents + adjustment * part.quantity;
        if (candidateBalancingCents % balancingPart.quantity === 0) {
          unitCentsById.set(part.id, currentUnitCents - adjustment);
          balancingCents = candidateBalancingCents;
          resolved = true;
          break;
        }
      }
      if (resolved) break;
    }
    if (!resolved) {
      return {
        success: false,
        parts: [],
        error: 'The purchase price cannot be split exactly across these quantities. Enter one component cost manually or use a quantity of 1.',
      };
    }
  }

  unitCentsById.set(balancingPart.id, balancingCents / balancingPart.quantity);

  return {
    success: true,
    parts: activeParts.map((part) =>
      part.isLocked
        ? part
        : { ...part, unitCost: (unitCentsById.get(part.id) || 0) / 100 }
    ),
  };
};
