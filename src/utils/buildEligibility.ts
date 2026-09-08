import { PCBuild, TransactionLogItem, InventoryComponent, ComponentCategory, COMPONENT_CATEGORIES } from '../types';

/**
 * 1. Delete Draft is allowed only when:
 * - Build exists.
 * - Build is not Sold.
 * - acquisitionSource !== 'Trade-In'.
 * - It has zero allocated parts.
 */
export function canDeleteBuildDraft(build: PCBuild | null | undefined): boolean {
  if (!build) return false;
  if (build.status === 'Sold') return false;
  if (build.acquisitionSource === 'Trade-In') return false;
  return !build.parts || build.parts.length === 0;
}

/**
 * 2. Dismantle is allowed only when:
 * - Build exists.
 * - Build is not Sold.
 * - acquisitionSource !== 'Trade-In'.
 * - It has at least one allocated part.
 */
export function canDismantleBuild(build: PCBuild | null | undefined): boolean {
  if (!build) return false;
  if (build.status === 'Sold') return false;
  if (build.acquisitionSource === 'Trade-In') return false;
  return Boolean(build.parts && build.parts.length > 0);
}

/**
 * 3. Part Out is allowed only when:
 * - Build exists.
 * - Build is not Sold.
 * - acquisitionSource === 'Trade-In'.
 */
export function canPartOutTradeInBuild(build: PCBuild | null | undefined): boolean {
  if (!build) return false;
  if (build.status === 'Sold') return false;
  return build.acquisitionSource === 'Trade-In';
}

/**
 * Legacy trade-in in "In Progress" status can be moved to "Trade-In Processing"
 */
export function canMoveToTradeIns(build: PCBuild | null | undefined): boolean {
  if (!build) return false;
  return build.acquisitionSource === 'Trade-In' && build.status === 'In Progress' && !build.sourceSaleTransactionId;
}

/**
 * Locates the exact sale transaction for a sold PC build.
 * Uses build.saleTransactionId if present.
 * For legacy sold builds, falls back to relatedComponentId only if exactly one SALE matches.
 * If zero or multiple match, returns an error without guessing.
 */
export function findLinkedSaleTransaction(
  build: PCBuild,
  transactions: TransactionLogItem[]
): { transaction?: TransactionLogItem; error?: string } {
  if (build.saleTransactionId) {
    const matchingById = transactions.filter((t) => t.id === build.saleTransactionId);
    if (matchingById.length === 0) {
      return { error: `Sale transaction "${build.saleTransactionId}" linked to this build was not found.` };
    }
    if (matchingById.length > 1) {
      return {
        error: `Ambiguous linkage: Multiple transactions share ID "${build.saleTransactionId}".`,
      };
    }
    const matched = matchingById[0];
    if (matched.type !== 'SALE' || matched.relatedComponentId !== build.id) {
      return { error: 'Mismatched linkage: Transaction does not correctly reference this build.' };
    }
    return { transaction: matched };
  }

  // Legacy fallback: find all SALE transactions tied to this build ID
  const matches = transactions.filter(
    (t) => t.type === 'SALE' && t.relatedComponentId === build.id
  );

  if (matches.length === 1) {
    const allWithSameId = transactions.filter((t) => t.id === matches[0].id);
    if (allWithSameId.length > 1) {
      return {
        error: `Ambiguous linkage: Multiple transactions share ID "${matches[0].id}".`,
      };
    }
    return { transaction: matches[0] };
  }

  if (matches.length === 0) {
    return { error: `No sale transaction was found matching build "${build.name}".` };
  }

  return {
    error: `Ambiguous linkage: ${matches.length} sale transactions match build "${build.name}". Operation blocked.`,
  };
}

/**
 * Checks if a trade-in build is untouched/pristine:
 * - status === 'Trade-In Processing'
 * - zero allocated upgrades
 * - no extracted purchase entries or downstream activity
 */
export function isTradeInBuildPristine(
  tradeInBuild: PCBuild | null | undefined,
  components: InventoryComponent[],
  saleTxId?: string
): { isPristine: boolean; reason?: string } {
  if (!tradeInBuild) {
    return { isPristine: false, reason: 'Incoming trade-in PC record not found.' };
  }

  if (tradeInBuild.acquisitionSource !== 'Trade-In') {
    return { isPristine: false, reason: 'Not a trade-in build' };
  }

  if (saleTxId && tradeInBuild.sourceSaleTransactionId !== saleTxId) {
    return { isPristine: false, reason: 'Source sale transaction mismatch' };
  }

  if (tradeInBuild.status !== 'Trade-In Processing') {
    return {
      isPristine: false,
      reason: `Trade-in build is currently "${tradeInBuild.status}" (must be "Trade-In Processing").`,
    };
  }

  if (tradeInBuild.parts && tradeInBuild.parts.length > 0) {
    return {
      isPristine: false,
      reason: 'Trade-in build has allocated upgrade parts.',
    };
  }

  if (tradeInBuild.tradeInComponentBreakdown && tradeInBuild.tradeInComponentBreakdown.length > 0) {
    return {
      isPristine: false,
      reason: 'Trade-in PC has a saved component breakdown.',
    };
  }

  // Check if any component has purchase entries extracted from this trade-in or sale
  const hasExtractedEntries = components.some((c) =>
    (c.purchaseHistory || []).some(
      (pe) =>
        pe.sourceTradeInBuildId === tradeInBuild.id ||
        (saleTxId && pe.sourceSaleTransactionId === saleTxId)
    )
  );

  if (hasExtractedEntries) {
    return {
      isPristine: false,
      reason: 'Trade-in PC has already been parted out into inventory stock.',
    };
  }

  return { isPristine: true };
}

export interface TradeInEditState {
  hasExistingTradeIn: boolean;
  isLocked: boolean;
  lockReason?: string;
  existingIncomingBuild?: PCBuild;
}

/**
 * Shared trade-in edit-state helper:
 * - Detects whether a sale transaction contains an existing trade-in (linkage, credit, name, notes).
 * - Determines whether its terms are locked.
 * - Explains why it is locked.
 */
export function getSaleTradeInEditState(
  saleTx: TransactionLogItem | null | undefined,
  builds: PCBuild[],
  components: InventoryComponent[]
): TradeInEditState {
  if (!saleTx) {
    return { hasExistingTradeIn: false, isLocked: false };
  }

  const hasIncomingId =
    typeof saleTx.incomingTradeInBuildId === 'string' &&
    saleTx.incomingTradeInBuildId.trim().length > 0;
  const hasPositiveCredit =
    typeof saleTx.tradeInCredit === 'number' &&
    Number.isFinite(saleTx.tradeInCredit) &&
    saleTx.tradeInCredit > 0;
  const hasBuildName =
    typeof saleTx.tradeInBuildName === 'string' &&
    saleTx.tradeInBuildName.trim().length > 0;
  const hasNotes =
    typeof saleTx.tradeInNotes === 'string' &&
    saleTx.tradeInNotes.trim().length > 0;

  const hasExistingTradeIn =
    hasIncomingId || hasPositiveCredit || hasBuildName || hasNotes;

  if (!hasExistingTradeIn) {
    return { hasExistingTradeIn: false, isLocked: false };
  }

  // If incomingTradeInBuildId exists:
  if (hasIncomingId) {
    const incomingBuild = builds.find((b) => b.id === saleTx.incomingTradeInBuildId);
    if (!incomingBuild) {
      return {
        hasExistingTradeIn: true,
        isLocked: true,
        lockReason: 'Incoming trade-in PC record not found.',
      };
    }

    const pristineCheck = isTradeInBuildPristine(incomingBuild, components, saleTx.id);
    if (!pristineCheck.isPristine) {
      return {
        hasExistingTradeIn: true,
        isLocked: true,
        lockReason: pristineCheck.reason || 'Trade-in build has downstream activity.',
        existingIncomingBuild: incomingBuild,
      };
    }

    return {
      hasExistingTradeIn: true,
      isLocked: false,
      existingIncomingBuild: incomingBuild,
    };
  }

  // Trade-in financial metadata or linkage exists without an incomingTradeInBuildId:
  return {
    hasExistingTradeIn: true,
    isLocked: true,
    lockReason: 'Trade-in metadata exists without a linked incoming build and cannot be safely modified.',
  };
}

export interface PartOutValidationPart {
  name: string;
  category: ComponentCategory;
  quantity: number;
  unitCost: number;
}

/**
 * Domain-level validation for trade-in part out:
 * - Target satisfies canPartOutTradeInBuild.
 * - estimatedCost is finite and non-negative.
 * - At least one extracted line exists.
 * - Every name is non-empty after trimming.
 * - Every category is valid.
 * - Every quantity is a finite positive integer.
 * - Every unit cost is finite and non-negative.
 * - Sum of quantity × unitCost must equal estimatedCost exactly in integer cents.
 */
export function validateCostBreakdownAccounting(
  estimatedCost: number | undefined,
  extractedParts: PartOutValidationPart[]
): { valid: boolean; error?: string } {
  if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return { valid: false, error: 'Target cost must be a finite, non-negative number.' };
  }

  if (!extractedParts || extractedParts.length === 0) {
    return { valid: false, error: 'At least one part line is required.' };
  }

  for (let i = 0; i < extractedParts.length; i++) {
    const p = extractedParts[i];
    if (!p.name || !p.name.trim()) {
      return { valid: false, error: `Part line #${i + 1} has an empty part name.` };
    }

    if (!COMPONENT_CATEGORIES.includes(p.category)) {
      return { valid: false, error: `Part line #${i + 1} (${p.name}) has an invalid category "${p.category}".` };
    }

    if (!Number.isInteger(p.quantity) || p.quantity <= 0) {
      return { valid: false, error: `Part line #${i + 1} (${p.name}) quantity must be a positive whole integer.` };
    }

    if (typeof p.unitCost !== 'number' || !Number.isFinite(p.unitCost) || p.unitCost < 0) {
      return { valid: false, error: `Part line #${i + 1} (${p.name}) unit cost must be a finite non-negative number.` };
    }
  }

  const targetCents = Math.round(estimatedCost * 100);
  let sumCents = 0;
  for (const p of extractedParts) {
    const lineCents = Math.round(p.quantity * Math.round(p.unitCost * 100));
    sumCents += lineCents;
  }

  if (sumCents !== targetCents) {
    const sumDollars = (sumCents / 100).toFixed(2);
    const targetDollars = (targetCents / 100).toFixed(2);
    return {
      valid: false,
      error: `Sum of parts ($${sumDollars}) must exactly match target cost ($${targetDollars}).`,
    };
  }

  return { valid: true };
}

export function validatePartOutAccounting(
  build: PCBuild,
  extractedParts: PartOutValidationPart[]
): { valid: boolean; error?: string } {
  if (!canPartOutTradeInBuild(build)) {
    return { valid: false, error: 'Build is not eligible to be parted out.' };
  }
  return validateCostBreakdownAccounting(build.estimatedCost, extractedParts);
}

export function validateItemizationAccounting(
  build: PCBuild,
  extractedParts: PartOutValidationPart[]
): { valid: boolean; error?: string } {
  if (build.acquisitionSource !== 'Trade-In') {
    return { valid: false, error: 'Only trade-in builds can have a component breakdown.' };
  }
  if (build.status === 'Sold') {
    return { valid: false, error: 'Cannot itemize a trade-in build that is already sold.' };
  }
  return validateCostBreakdownAccounting(build.estimatedCost, extractedParts);
}
