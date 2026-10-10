
import { AppState } from "../types";
import { InventoryComponent, PCBuild } from '../types';
import { classifyTransaction } from './transactionClassification';
import { isAcquiredPC } from './acquiredPC';

export function precomputeAssignedBatches(
  builds: PCBuild[],
  components?: InventoryComponent[]
): Record<string, { explicitSum: number, unlinkedSum: number, batches: Record<string, number> }> {
  const validEntriesByComp = components
    ? new Map<string, Set<string>>(components.map(c => [c.id, new Set((c.purchaseHistory || []).map(e => e.id))]))
    : null;

  const map: Record<string, { explicitSum: number, unlinkedSum: number, batches: Record<string, number> }> = {};
  (builds || []).forEach(b => {
    (b.parts || []).forEach(p => {
      if (!p.componentId) return;
      if (!map[p.componentId]) {
        map[p.componentId] = { explicitSum: 0, unlinkedSum: 0, batches: {} };
      }
      const qty = Number(p.quantity) || 0;
      const validSet = validEntriesByComp?.get(p.componentId);
      const isExplicit = Boolean(p.purchaseEntryId && (!validSet || validSet.has(p.purchaseEntryId)));

      if (isExplicit && p.purchaseEntryId) {
        map[p.componentId].batches[p.purchaseEntryId] = (map[p.componentId].batches[p.purchaseEntryId] || 0) + qty;
        map[p.componentId].explicitSum += qty;
      } else {
        map[p.componentId].unlinkedSum += qty;
      }
    });
  });
  return map;
}

export function calculateTotalQuantity(component: InventoryComponent): number {
  if (!component.purchaseHistory || component.purchaseHistory.length === 0) {
    return 0;
  }
  return component.purchaseHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
}

export function calculateAverageUnitCost(component: InventoryComponent): number {
  if (!component.purchaseHistory || component.purchaseHistory.length === 0) {
    return 0;
  }
  const totalQty = calculateTotalQuantity(component);
  if (totalQty === 0) return 0;

  const totalCost = component.purchaseHistory.reduce(
    (sum, entry) => sum + (entry.totalPrice || entry.unitPrice * (Number(entry.quantity) || 1)),
    0
  );
  return totalCost / totalQty;
}

export function calculateTotalValue(component: InventoryComponent): number {
  const totalQty = calculateTotalQuantity(component);
  const avgCost = calculateAverageUnitCost(component);
  return totalQty * avgCost;
}

export function calculateUnassignedQuantity(component: InventoryComponent): number {
  const totalQty = calculateTotalQuantity(component);
  const assigned = Number(component.assignedCount) || 0;
  return Math.max(0, totalQty - assigned);
}

export function formatCategoryPlural(category: string): string {
  const cat = (category || '').trim();
  const lower = cat.toLowerCase();
  if (lower === 'motherboard') return 'Motherboards';
  if (lower === 'cooling' || lower === 'cooler') return 'Coolers';
  if (lower === 'cpu') return 'CPUs';
  if (lower === 'gpu') return 'GPUs';
  if (lower === 'ram' || lower === 'memory') return 'RAM';
  if (lower === 'storage' || lower === 'ssd' || lower === 'hdd' || lower === 'nvme') return 'Storage Drives';
  if (lower === 'psu' || lower === 'power supply') return 'Power Supplies';
  if (lower === 'case') return 'Cases';
  if (lower === 'fan' || lower === 'fans') return 'Fans';
  if (lower === 'monitor') return 'Monitors';
  if (lower === 'peripheral' || lower === 'peripherals') return 'Peripherals';
  if (lower === 'accessory' || lower === 'accessories') return 'Accessories';
  if (lower === 'other') return 'Parts';
  if (cat.endsWith('s') || cat.endsWith('S')) return cat;
  return `${cat}s`;
}



/**
 * Computes how a component's current unresolved legacy allocation is reserved
 * across its existing purchase entries before appending/transferring a new batch.
 */
export function computeUnresolvedLegacyReservation(
  component: InventoryComponent,
  builds: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!component.purchaseHistory || component.purchaseHistory.length === 0) {
    return result;
  }

  const validEntryIds = new Set(component.purchaseHistory.map(e => e.id));
  let assignedPerBatch: Record<string, number> = {};
  let explicitSum = 0;
  let unlinkedFromBuilds = 0;

  if (precomputedMap && precomputedMap[component.id]) {
    const compPrecomputed = precomputedMap[component.id];
    unlinkedFromBuilds = compPrecomputed.unlinkedSum || 0;
    for (const [entryId, qty] of Object.entries(compPrecomputed.batches || {})) {
      if (validEntryIds.has(entryId)) {
        assignedPerBatch[entryId] = (assignedPerBatch[entryId] || 0) + qty;
        explicitSum += qty;
      } else {
        unlinkedFromBuilds += qty;
      }
    }
  } else {
    (builds || []).forEach(b => {
      (b.parts || []).forEach(p => {
        if (p.componentId === component.id) {
          const qty = Number(p.quantity) || 0;
          if (p.purchaseEntryId && validEntryIds.has(p.purchaseEntryId)) {
            assignedPerBatch[p.purchaseEntryId] = (assignedPerBatch[p.purchaseEntryId] || 0) + qty;
            explicitSum += qty;
          } else {
            unlinkedFromBuilds += qty;
          }
        }
      });
    });
  }

  const totalAssignedRecorded = Number(component.assignedCount) || 0;
  let unlinkedAssigned = Math.max(0, totalAssignedRecorded - explicitSum, unlinkedFromBuilds);
  if (unlinkedAssigned <= 0) {
    return result;
  }

  const rawAvailableMap: Record<string, number> = {};
  for (const entry of component.purchaseHistory) {
    const assigned = assignedPerBatch[entry.id] || 0;
    rawAvailableMap[entry.id] = Math.max(0, (Number(entry.quantity) || 0) - assigned);
  }

  // 1. Respect pre-existing reservations if present
  const existingRes = component.unresolvedLegacyReservationByPurchaseEntryId || {};
  for (const entry of component.purchaseHistory) {
    if (unlinkedAssigned <= 0) break;
    const rawAvail = rawAvailableMap[entry.id] || 0;
    const preserved = Number(existingRes[entry.id]) || 0;
    if (preserved > 0 && rawAvail > 0) {
      const take = Math.min(preserved, rawAvail, unlinkedAssigned);
      if (take > 0) {
        result[entry.id] = (result[entry.id] || 0) + take;
        unlinkedAssigned -= take;
      }
    }
  }

  // 2. Generic fallback distribution for remaining unlinked quantity
  for (const entry of component.purchaseHistory) {
    if (unlinkedAssigned <= 0) break;
    const rawAvail = rawAvailableMap[entry.id] || 0;
    const currentRes = result[entry.id] || 0;
    const remainingInBatch = Math.max(0, rawAvail - currentRes);
    if (remainingInBatch > 0) {
      const take = Math.min(remainingInBatch, unlinkedAssigned);
      result[entry.id] = currentRes + take;
      unlinkedAssigned -= take;
    }
  }

  // Clean and sanitize result
  const sanitized: Record<string, number> = {};
  for (const [k, v] of Object.entries(result)) {
    if (Number.isFinite(v) && v > 0) {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function getAllBatchesWithRemaining(
  component: InventoryComponent,
  builds: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): {
  unitCost: number;
  availableQuantity: number;
  allocatedQuantity: number;
  entry: import('../types').PurchaseEntry;
}[] {
  const validEntryIds = new Set((component.purchaseHistory || []).map(e => e.id));
  let assignedPerBatch: Record<string, number> = {};
  let explicitSum = 0;
  let unlinkedFromBuilds = 0;
  
  if (precomputedMap && precomputedMap[component.id]) {
    const compPrecomputed = precomputedMap[component.id];
    unlinkedFromBuilds = compPrecomputed.unlinkedSum || 0;
    for (const [entryId, qty] of Object.entries(compPrecomputed.batches || {})) {
      if (validEntryIds.has(entryId)) {
        assignedPerBatch[entryId] = (assignedPerBatch[entryId] || 0) + qty;
        explicitSum += qty;
      } else {
        // Missing or invalid purchaseEntryId for this component: count as unresolved legacy allocation
        unlinkedFromBuilds += qty;
      }
    }
  } else if (!precomputedMap) {
    (builds || []).forEach(b => {
      (b.parts || []).forEach(p => {
        if (p.componentId === component.id) {
          const qty = Number(p.quantity) || 0;
          if (p.purchaseEntryId && validEntryIds.has(p.purchaseEntryId)) {
            assignedPerBatch[p.purchaseEntryId] = (assignedPerBatch[p.purchaseEntryId] || 0) + qty;
            explicitSum += qty;
          } else {
            unlinkedFromBuilds += qty;
          }
        }
      });
    });
  }

  // Calculate unlinked/legacy assigned quantity that is not already represented by explicit batch allocations
  const totalAssignedRecorded = Number(component.assignedCount) || 0;
  let unlinkedAssigned = Math.max(0, totalAssignedRecorded - explicitSum, unlinkedFromBuilds);

  // Map each batch with rawAvailable and explicit allocatedQuantity
  const batches = (component.purchaseHistory || []).map(entry => {
    const assigned = assignedPerBatch[entry.id] || 0;
    const rawAvailable = Math.max(0, (Number(entry.quantity) || 0) - assigned);
    return {
      unitCost: entry.unitPrice || (entry.totalPrice / (entry.quantity || 1)),
      rawAvailable,
      allocatedQuantity: assigned,
      entry,
    };
  });

  if (unlinkedAssigned <= 0) {
    return batches.map(batch => ({
      unitCost: batch.unitCost,
      availableQuantity: batch.rawAvailable,
      allocatedQuantity: batch.allocatedQuantity,
      entry: batch.entry,
    }));
  }

  // 1. Apply preserved unresolved legacy reservations first (if any)
  const reservationMap = component.unresolvedLegacyReservationByPurchaseEntryId || {};
  const batchDeductions: Record<string, number> = {};

  for (const batch of batches) {
    if (unlinkedAssigned <= 0) break;
    const preserved = Number(reservationMap[batch.entry.id]) || 0;
    if (preserved > 0 && batch.rawAvailable > 0) {
      const take = Math.min(preserved, batch.rawAvailable, unlinkedAssigned);
      if (take > 0) {
        batchDeductions[batch.entry.id] = take;
        unlinkedAssigned -= take;
      }
    }
  }

  // 2. Generic fallback for any remaining unlinkedAssigned not covered by preserved reservations
  for (const batch of batches) {
    if (unlinkedAssigned <= 0) break;
    const currentDeduction = batchDeductions[batch.entry.id] || 0;
    const remainingAvailableInBatch = Math.max(0, batch.rawAvailable - currentDeduction);
    if (remainingAvailableInBatch > 0) {
      const take = Math.min(remainingAvailableInBatch, unlinkedAssigned);
      batchDeductions[batch.entry.id] = currentDeduction + take;
      unlinkedAssigned -= take;
    }
  }

  // Reconcile legacy unlinked allocations across available batches without double-subtracting
  return batches.map(batch => {
    const deduction = batchDeductions[batch.entry.id] || 0;
    const availableQuantity = Math.max(0, batch.rawAvailable - deduction);
    return {
      unitCost: batch.unitCost,
      availableQuantity,
      allocatedQuantity: batch.allocatedQuantity,
      entry: batch.entry,
    };
  });
}

export function getPurchaseEntryRemainingQuantity(
  component: InventoryComponent,
  purchaseEntryId: string,
  builds: PCBuild[]
): number {
  const batches = getAllBatchesWithRemaining(component, builds);
  const found = batches.find(b => b.entry.id === purchaseEntryId);
  return found ? found.availableQuantity : 0;
}

export function getUnassignedBatches(
  component: InventoryComponent,
  builds: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): { unitCost: number; availableQuantity: number; entry: import('../types').PurchaseEntry }[] {
  const all = getAllBatchesWithRemaining(component, builds, precomputedMap);
  return all
    .filter(b => b.availableQuantity > 0)
    .map(b => ({
      unitCost: b.unitCost,
      availableQuantity: b.availableQuantity,
      entry: b.entry,
    }));
}



export function calculateUnassignedQuantityStrict(
  component: InventoryComponent,
  builds: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): number {
  const batches = getUnassignedBatches(component, builds, precomputedMap);
  return batches.reduce((sum, batch) => sum + batch.availableQuantity, 0);
}


export function calculateUnassignedValueStrict(
  component: InventoryComponent,
  builds: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): number {
  const batches = getUnassignedBatches(component, builds, precomputedMap);
  return batches.reduce((sum, batch) => sum + (batch.unitCost * batch.availableQuantity), 0);
}

/**
 * Calculates the effective unit cost of a component.
 * When builds are provided, it computes the weighted average unit cost of unassigned in-stock units.
 * If out of stock or builds are not provided, it falls back to the historical all-time average unit cost.
 */
export function calculateEffectiveUnitCost(
  component: InventoryComponent,
  builds?: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): number {
  if (builds && builds.length > 0) {
    const unassignedQty = calculateUnassignedQuantityStrict(component, builds, precomputedMap);
    if (unassignedQty > 0) {
      const unassignedVal = calculateUnassignedValueStrict(component, builds, precomputedMap);
      return unassignedVal / unassignedQty;
    }
  }
  return calculateAverageUnitCost(component);
}


export function calculateBuildPartsCost(build: PCBuild): number {
  const parts = build.parts || [];
  let partsSum = 0;
  let hasValidPartQuantity = false;

  for (const part of parts) {
    const qty =
      typeof part.quantity === 'number' && Number.isFinite(part.quantity) && part.quantity > 0
        ? part.quantity
        : 0;
    
    if (qty > 0) {
      hasValidPartQuantity = true;
    }

    const unitCost =
      typeof part.unitCostAtAssignment === 'number' &&
      Number.isFinite(part.unitCostAtAssignment) &&
      part.unitCostAtAssignment >= 0
        ? part.unitCostAtAssignment
        : 0;
    
    partsSum += qty * unitCost;
  }

  const baseCost =
    typeof build.estimatedCost === 'number' && Number.isFinite(build.estimatedCost) && build.estimatedCost >= 0
      ? build.estimatedCost
      : 0;

  if (isAcquiredPC(build)) {
    return baseCost + partsSum;
  }

  if (hasValidPartQuantity) {
    return partsSum;
  }
  return baseCost;
}

export function roundToCents(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function normalizeDateString(dateStr: string, defaultYear = new Date().getFullYear()): string {
  if (!dateStr || !dateStr.trim()) {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  const trimmed = dateStr.trim();

  // 1. Strict ISO-like input: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return trimmed;
      }
    }
    // Invalid ISO-like input (e.g. "2026-02-31", "2026-02-29"):
    // Preserve and return original trimmed value without replacing with today or rolling over.
    return trimmed;
  }

  // 1b. Numeric YYYY/MM/DD or YYYY-M-D
  const slashYmdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (slashYmdMatch) {
    const year = parseInt(slashYmdMatch[1], 10);
    const month = parseInt(slashYmdMatch[2], 10);
    const day = parseInt(slashYmdMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return trimmed;
  }

  // 2. Month and Year: e.g. "August 2026", "Aug 2026" -> deterministically "2026-08-01"
  const monthYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const mName = monthYearMatch[1].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[mName];
    const year = parseInt(monthYearMatch[2], 10);
    if (month && year >= 1970 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-01`;
    }
    return trimmed;
  }

  // 3. Month and Day without year: e.g. "Aug 14", "August 14" -> uses defaultYear, validates calendar day
  const monthDayMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2})$/);
  if (monthDayMatch) {
    const mName = monthDayMatch[1].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[mName];
    const day = parseInt(monthDayMatch[2], 10);
    if (month && defaultYear >= 1970 && defaultYear <= 2100) {
      const maxDays = new Date(defaultYear, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${defaultYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return trimmed;
  }

  // 4. Month name, Day, and Year: e.g. "Aug 14, 2026", "August 14, 2026", "Aug 14 2026"
  const monthDayYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYearMatch) {
    const mName = monthDayYearMatch[1].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[mName];
    const day = parseInt(monthDayYearMatch[2], 10);
    const year = parseInt(monthDayYearMatch[3], 10);
    if (month && year >= 1970 && year <= 2100) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return trimmed;
  }

  // 5. Numeric MDY: e.g. "8/14/2026", "08/14/2026"
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10);
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return trimmed;
  }

  // Invalid non-empty values: preserve and return original trimmed value
  return trimmed;
}

export function normalizeTimestampString(timestampStr: string, defaultYear = new Date().getFullYear()): string {
  if (!timestampStr || !timestampStr.trim()) {
    return timestampStr || '';
  }

  const trimmed = timestampStr.trim();

  // If already starts with valid YYYY-MM-DD prefix with time or no time
  const isoPrefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})($|[T\s].*$)/);
  if (isoPrefixMatch) {
    const year = parseInt(isoPrefixMatch[1], 10);
    const month = parseInt(isoPrefixMatch[2], 10);
    const day = parseInt(isoPrefixMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        // Already-valid full timestamp (e.g. "2026-08-14 1:44 PM", "2026-08-14T12:00:00Z", "2026-08-14")
        return trimmed;
      }
    }
    // Invalid calendar date with ISO prefix (e.g. "2026-02-31 1:44 PM"):
    // Unparseable/invalid non-empty text remains unchanged rather than becoming today.
    return trimmed;
  }

  // Look for a time suffix at the end of the string, e.g. "1:44 PM", "11:05 AM", "14:30:00"
  const timeSuffixMatch = trimmed.match(/\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)$/);
  if (timeSuffixMatch) {
    const timeSuffix = timeSuffixMatch[1];
    const datePart = trimmed.slice(0, trimmed.length - timeSuffixMatch[0].length).trim();
    const normalizedDate = normalizeDateString(datePart, defaultYear);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) && normalizedDate !== datePart) {
      return `${normalizedDate} ${timeSuffix}`;
    }
    return trimmed;
  }

  // If no time suffix matched, normalize date part directly (e.g. "August 2026" -> "2026-08-01", "Aug 14, 2026" -> "2026-08-14")
  return normalizeDateString(trimmed, defaultYear);
}

export function parseDateLocal(dateStr?: string): { year: number; monthIndex: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Strict match for YYYY-MM-DD or YYYY/MM/DD (allows optional time suffix e.g. "2026-08-14 1:44 PM" or "2026-08-14T12:00:00Z")
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return {
          year,
          monthIndex: month - 1,
          day,
        };
      }
    }
    // Recognized numeric YMD format with invalid calendar date (e.g. 2026-02-31) -> return null immediately
    return null;
  }

  // 2. Numeric MDY format: M/D/YYYY or MM/DD/YYYY (with optional time suffix e.g. " 1:44 PM")
  const mdyNumericMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/);
  if (mdyNumericMatch) {
    const month = parseInt(mdyNumericMatch[1], 10);
    const day = parseInt(mdyNumericMatch[2], 10);
    const year = parseInt(mdyNumericMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return {
          year,
          monthIndex: month - 1,
          day,
        };
      }
    }
    // Recognized numeric MDY format with invalid calendar date -> return null immediately
    return null;
  }

  // 3. Month name / localized format e.g. "Aug 14, 2026", "August 14, 2026", "Aug 14 2026 1:44 PM"
  const monthNameDayYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+.*)?$/);
  if (monthNameDayYearMatch) {
    const mName = monthNameDayYearMatch[1].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[mName];
    const day = parseInt(monthNameDayYearMatch[2], 10);
    const year = parseInt(monthNameDayYearMatch[3], 10);
    if (month && year >= 1970 && year <= 2100) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return {
          year,
          monthIndex: month - 1,
          day,
        };
      }
    }
    // Recognized month-day-year with month name but invalid calendar date -> return null immediately
    return null;
  }

  // 4. Month name and Year only: e.g. "August 2026", "Aug 2026"
  const monthYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const mName = monthYearMatch[1].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[mName];
    const year = parseInt(monthYearMatch[2], 10);
    if (month && year >= 1970 && year <= 2100) {
      return {
        year,
        monthIndex: month - 1,
        day: 1,
      };
    }
    return null;
  }

  return null;
}

export function formatReadableDate(dateStr?: string): string | null {
  const parsed = parseDateLocal(dateStr);
  if (!parsed) return null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[parsed.monthIndex]} ${parsed.day}, ${parsed.year}`;
}

export interface RelativeDateOptions {
  referenceDate?: Date;
  fallbackText?: string;
  maxRelativeDays?: number;
}

export function getLocalCalendarTimestamp(dateInput?: string | number | Date | null): number {
  if (!dateInput && dateInput !== 0) return 0;
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? 0 : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  }
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? 0 : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 0, 0, 0, 0).getTime();
  }
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return 0;
    const parsed = parseDateLocal(trimmed);
    if (parsed) {
      return new Date(parsed.year, parsed.monthIndex, parsed.day, 0, 0, 0, 0).getTime();
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? 0 : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  }
  return 0;
}

export function formatRelativeCalendarDate(
  dateInput?: string | number | Date | null,
  options?: RelativeDateOptions
): string {
  const fallback = options?.fallbackText ?? 'Recently';
  if (!dateInput && dateInput !== 0) return fallback;

  const targetMidnight = getLocalCalendarTimestamp(dateInput);
  if (!targetMidnight) return fallback;

  const ref = options?.referenceDate ?? new Date();
  if (isNaN(ref.getTime())) return fallback;

  const referenceMidnight = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((referenceMidnight - targetMidnight) / msPerDay);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const maxRelative = options?.maxRelativeDays ?? 6;
  if (diffDays <= maxRelative) {
    return `${diffDays} days ago`;
  }

  const targetDate = new Date(targetMidnight);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = MONTHS[targetDate.getMonth()];
  const day = targetDate.getDate();

  if (targetDate.getFullYear() === ref.getFullYear()) {
    return `${monthName} ${day}`;
  }

  return `${monthName} ${day}, ${targetDate.getFullYear()}`;
}

export type SortOption = 
  | 'highest-price' 
  | 'lowest-price' 
  | 'highest-stock' 
  | 'lowest-stock' 
  | 'newest-purchase'
  | 'highest-health'
  | 'lowest-health';

export interface FilterSortOptions {
  builds?: PCBuild[];
  searchQuery?: string;
  category?: string;
  onlyAvailable?: boolean;
  subCategory?: string;
  subTags?: string[];
  sortBy?: SortOption;
}

export function getComponentStorageHealthStats(
  comp: InventoryComponent,
  builds?: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number; unlinkedSum?: number; batches: Record<string, number> }>
): { max: number; min: number; avg: number; hasHealth: boolean } {
  if (comp.category !== 'Storage') {
    return { max: -1, min: 101, avg: -1, hasHealth: false };
  }

  const batches = getUnassignedBatches(comp, builds || [], precomputedMap);
  const healthItems: { health: number; qty: number }[] = [];

  for (const b of batches) {
    if (typeof b.entry.healthPercent === 'number' && Number.isFinite(b.entry.healthPercent) && b.availableQuantity > 0) {
      healthItems.push({ health: b.entry.healthPercent, qty: b.availableQuantity });
    }
  }

  if (healthItems.length === 0) {
    if (typeof comp.healthPercent === 'number' && Number.isFinite(comp.healthPercent)) {
      return {
        max: comp.healthPercent,
        min: comp.healthPercent,
        avg: comp.healthPercent,
        hasHealth: true,
      };
    }
    if (comp.purchaseHistory && comp.purchaseHistory.length > 0) {
      for (const ph of comp.purchaseHistory) {
        if (typeof ph.healthPercent === 'number' && Number.isFinite(ph.healthPercent)) {
          return {
            max: ph.healthPercent,
            min: ph.healthPercent,
            avg: ph.healthPercent,
            hasHealth: true,
          };
        }
      }
    }
    return { max: -1, min: 101, avg: -1, hasHealth: false };
  }

  let totalQty = 0;
  let totalWeighted = 0;
  let max = -Infinity;
  let min = Infinity;

  for (const item of healthItems) {
    totalQty += item.qty;
    totalWeighted += item.health * item.qty;
    if (item.health > max) max = item.health;
    if (item.health < min) min = item.health;
  }

  const avg = totalQty > 0 ? totalWeighted / totalQty : (healthItems[0]?.health ?? 0);

  return {
    max,
    min,
    avg,
    hasHealth: true,
  };
}

/**
 * Calculates the most recent purchase batch timestamp for a component.
 * Instead of sorting by the parent component's original creation date,
 * it sorts by the most recent AVAILABLE batch date (skipping allocated/sold batches).
 * If no available batches exist with valid dates, it gracefully falls back to the component's creation date.
 */
export function getComponentLatestPurchaseTimestamp(
  comp: InventoryComponent,
  builds?: PCBuild[],
  precomputedMap?: Record<string, { explicitSum: number, unlinkedSum?: number, batches: Record<string, number> }>
): number {
  if (!comp) return 0;

  let max = 0;

  // 1. If explicit batches array is provided on the component (e.g. comp.batches)
  if (Array.isArray((comp as any).batches) && (comp as any).batches.length > 0) {
    const batches = (comp as any).batches;
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      if (!b) continue;

      // Strict availability check: skip if fully consumed, allocated, or sold
      if (b.status === 'allocated' || b.status === 'sold' || b.status === 'consumed') {
        continue;
      }
      if (typeof b.availableQuantity === 'number' && b.availableQuantity <= 0) {
        continue;
      }
      if (typeof b.remainingQuantity === 'number' && b.remainingQuantity <= 0) {
        continue;
      }
      if (typeof b.quantity === 'number' && b.quantity <= 0) {
        continue;
      }
      if (b.isAllocated || b.isSold || b.isConsumed) {
        continue;
      }

      // Check build allocations if builds or assignedCount are present and batch has an ID
      const batchId = b.id || b.entry?.id;
      if (batchId && (builds || (comp.assignedCount && comp.assignedCount > 0))) {
        if (typeof b.availableQuantity !== 'number' && typeof b.remainingQuantity !== 'number') {
          if (getPurchaseEntryRemainingQuantity(comp, batchId, builds || []) <= 0) {
            continue;
          }
        }
      }

      const dateStr = b.date || b.entry?.date;
      if (!dateStr) continue;

      const t = getLocalCalendarTimestamp(dateStr) || new Date(dateStr).getTime() || 0;
      if (t > max) max = t;
    }
  }

  // 2. Evaluate unassigned / available batches from component purchaseHistory
  if (comp.purchaseHistory && Array.isArray(comp.purchaseHistory) && comp.purchaseHistory.length > 0) {
    // Determine which batches still have unassigned/available stock
    const unassignedBatches = getUnassignedBatches(comp, builds || [], precomputedMap);
    for (let i = 0; i < unassignedBatches.length; i++) {
      const b = unassignedBatches[i];
      if (!b || b.availableQuantity <= 0) continue;
      const dateStr = b.entry?.date;
      if (!dateStr) continue;

      const t = getLocalCalendarTimestamp(dateStr) || new Date(dateStr).getTime() || 0;
      if (t > max) max = t;
    }
  }

  if (max > 0) return max;

  // 3. Gracefully fall back to component creation date if no available batches exist
  const creationDate = (comp as any).createdAt || (comp as any).createdDate || (comp as any).dateAdded;
  if (creationDate) {
    const t = getLocalCalendarTimestamp(creationDate) || new Date(creationDate).getTime() || 0;
    if (t > 0) return t;
  }

  // Fallback to ID timestamp if formatted as comp-<timestamp>-... or item-<timestamp>-...
  const idMatch = String(comp.id || '').match(/^(?:comp|item)-(\d{10,13})/);
  if (idMatch) {
    const idTime = parseInt(idMatch[1], 10);
    if (!isNaN(idTime) && idTime > 0) return idTime;
  }

  return 0;
}

export function filterAndSortComponents(
  components: InventoryComponent[],
  options: FilterSortOptions
): InventoryComponent[] {
  const precomputedMap = options.builds ? precomputeAssignedBatches(options.builds) : undefined;
  
  let filtered = components.filter((comp) => {
    // 1. Availability Filter (Strictly active, available stock)
    if (options.onlyAvailable !== false) {
      if (calculateUnassignedQuantityStrict(comp, options.builds || [], precomputedMap) <= 0) return false;
    }

    // 2. Search Query Filter
    if (options.searchQuery) {
      const queryWords = options.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const name = String(comp.name || "").toLowerCase();
      const specs = String(comp.specifications || "").toLowerCase();
      const tags = (comp.tags || []).map(t => typeof t === 'string' ? t.toLowerCase() : '');
      
      const matchesAllWords = queryWords.every(word => 
        name.includes(word) || 
        specs.includes(word) || 
        tags.some(t => t.includes(word))
      );
      
      if (!matchesAllWords) {
        return false;
      }
    }

    // 3. Category Filter
    if (options.category && options.category !== 'ALL' && options.category !== 'All') {
      if (comp.category !== options.category) {
        return false;
      }
    }

    // 4. Sub-Category / Sub-Tag Filter (Multi-select)
    if (options.subTags && options.subTags.length > 0) {
      const compTags = (comp.tags || []).map((t) => (typeof t === 'string' ? t.toLowerCase().trim() : ''));
      const compNameLower = String(comp.name || '').toLowerCase();
      const compSpecLower = String(comp.specifications || '').toLowerCase();
      
      const matchesAllSubTags = options.subTags.every((subTag) => {
        const target = subTag.toLowerCase().trim();
        return (
          compTags.includes(target) ||
          compNameLower.includes(target) ||
          compSpecLower.includes(target)
        );
      });
      if (!matchesAllSubTags) return false;
    } else if (options.subCategory && options.subCategory.trim()) {
      const compTags = (comp.tags || []).map((t) => (typeof t === 'string' ? t.toLowerCase().trim() : ''));
      const compNameLower = String(comp.name || '').toLowerCase();
      const compSpecLower = String(comp.specifications || '').toLowerCase();
      const target = options.subCategory.toLowerCase().trim();
      const matches =
        compTags.includes(target) ||
        compNameLower.includes(target) ||
        compSpecLower.includes(target) ||
        determineSubCategory(comp)?.toLowerCase() === target;
      if (!matches) return false;
    }

    return true;
  });

  // Fast date lookup helper sorting by most recent batch date with fallback to creation date
  // (Uses getComponentLatestPurchaseTimestamp)
  // 5. Sorting
  const costMap = new Map<string, number>();
  const getCompCost = (comp: InventoryComponent): number => {
    let cost = costMap.get(comp.id);
    if (cost === undefined) {
      cost = calculateEffectiveUnitCost(comp, options.builds, precomputedMap);
      costMap.set(comp.id, cost);
    }
    return cost;
  };

  const stockMap = new Map<string, number>();
  const getCompStock = (comp: InventoryComponent): number => {
    let stock = stockMap.get(comp.id);
    if (stock === undefined) {
      stock = calculateUnassignedQuantityStrict(comp, options.builds || [], precomputedMap);
      stockMap.set(comp.id, stock);
    }
    return stock;
  };

  const healthMap = new Map<string, { max: number; min: number; avg: number; hasHealth: boolean }>();
  const getCompHealth = (comp: InventoryComponent) => {
    let stats = healthMap.get(comp.id);
    if (!stats) {
      stats = getComponentStorageHealthStats(comp, options.builds, precomputedMap);
      healthMap.set(comp.id, stats);
    }
    return stats;
  };

  const timestampMap = new Map<string, number>();
  const getCompTimestamp = (comp: InventoryComponent): number => {
    let ts = timestampMap.get(comp.id);
    if (ts === undefined) {
      ts = getComponentLatestPurchaseTimestamp(comp, options.builds, precomputedMap);
      timestampMap.set(comp.id, ts);
    }
    return ts;
  };

  return filtered.sort((a, b) => {
    if (options.sortBy === 'highest-price') {
      return getCompCost(b) - getCompCost(a);
    }
    if (options.sortBy === 'lowest-price') {
      return getCompCost(a) - getCompCost(b);
    }
    if (options.sortBy === 'highest-stock') {
      return getCompStock(b) - getCompStock(a);
    }
    if (options.sortBy === 'lowest-stock') {
      return getCompStock(a) - getCompStock(b);
    }
    if (options.sortBy === 'highest-health') {
      const healthA = getCompHealth(a);
      const healthB = getCompHealth(b);
      if (healthA.hasHealth && !healthB.hasHealth) return -1;
      if (!healthA.hasHealth && healthB.hasHealth) return 1;
      if (healthA.hasHealth && healthB.hasHealth) {
        if (healthB.max !== healthA.max) return healthB.max - healthA.max;
        if (healthB.avg !== healthA.avg) return healthB.avg - healthA.avg;
        if (healthB.min !== healthA.min) return healthB.min - healthA.min;
      }
      return getCompTimestamp(b) - getCompTimestamp(a);
    }
    if (options.sortBy === 'lowest-health') {
      const healthA = getCompHealth(a);
      const healthB = getCompHealth(b);
      if (healthA.hasHealth && !healthB.hasHealth) return -1;
      if (!healthA.hasHealth && healthB.hasHealth) return 1;
      if (healthA.hasHealth && healthB.hasHealth) {
        if (healthA.min !== healthB.min) return healthA.min - healthB.min;
        if (healthA.avg !== healthB.avg) return healthA.avg - healthB.avg;
        if (healthA.max !== healthB.max) return healthA.max - healthB.max;
      }
      return getCompTimestamp(b) - getCompTimestamp(a);
    }
    
    // Default sorting (newest-purchase / Recently Bought)
    return getCompTimestamp(b) - getCompTimestamp(a);
  });
}

export function calculateInventoryMetrics(state: AppState) {
  const precomputedMap = precomputeAssignedBatches(state.builds);
  const looseValuation = state.components.reduce(
    (sum, c) => sum + calculateUnassignedValueStrict(c, state.builds, precomputedMap),
    0
  );

  const activeBuilds = state.builds.filter((b) => !['Sold', 'Completed', 'Archived'].includes(b.status));
  const activeBuildsCost = activeBuilds.reduce(
    (sum, b) => sum + calculateBuildPartsCost(b),
    0
  );

  const totalStockValuation = looseValuation + activeBuildsCost;

  return {
    looseValuation: roundToCents(looseValuation),
    activeBuilds,
    activeBuildsCost: roundToCents(activeBuildsCost),
    totalStockValuation: roundToCents(totalStockValuation),
    activeRigsCount: activeBuilds.length,
  };
}

export function calculateMonthlyMetrics(state: AppState, year: number, monthIndex: number) {
  let pcRevenue = 0;
  let pcCost = 0;
  let pcsSold = 0;

  let partRevenue = 0;
  let partCost = 0;

  // Maximum days for the specified month
  const maxDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // 1. Add sales from state.builds for this calendar month
  // A sold PC build belongs to this month iff its saleDate falls between day 1 and maxDaysInMonth of year/monthIndex
  state.builds.forEach((build) => {
    if (build.status === 'Sold') {
      const dStr = build.saleDate || build.completionDate || build.createdDate;
      if (dStr) {
        const parsed = parseDateLocal(dStr);
        if (
          parsed &&
          parsed.year === year &&
          parsed.monthIndex === monthIndex &&
          parsed.day >= 1 &&
          parsed.day <= maxDaysInMonth
        ) {
          const buildRev = Number(build.salePrice) || 0;
          const partsCost = calculateBuildPartsCost(build);
          const buildCost = partsCost;

          pcRevenue += buildRev;
          pcCost += buildCost;
          pcsSold += 1;
        }
      }
    }
  });

  // 2. Add Standalone Part sales from state.transactions for this calendar month
  // Classify standalone part sales so PC build sales are not double-counted
  state.transactions.forEach((tx) => {
    const classification = classifyTransaction(tx, state.builds);
    if (classification.isPartSale) {
      const dStr = (tx.dateSortable && parseDateLocal(tx.dateSortable) ? tx.dateSortable : tx.timestamp) || '';
      if (dStr) {
        const parsed = parseDateLocal(dStr);
        if (
          parsed &&
          parsed.year === year &&
          parsed.monthIndex === monthIndex &&
          parsed.day >= 1 &&
          parsed.day <= maxDaysInMonth
        ) {
          const partRev = Number(tx.totalAmount) || 0;
          const partProf = tx.profitMargin !== undefined ? Number(tx.profitMargin) : partRev;
          const txPartCost = Math.max(0, partRev - partProf);

          partRevenue += partRev;
          partCost += txPartCost;
        }
      }
    }
  });

  const pcProfit = roundToCents(pcRevenue - pcCost);
  const partProfit = roundToCents(partRevenue - partCost);

  const monthlyRevenue = roundToCents(pcRevenue + partRevenue);
  const monthlyCost = roundToCents(pcCost + partCost);
  const monthlyProfit = roundToCents(monthlyRevenue - monthlyCost);

  return {
    revenue: monthlyRevenue,
    cost: monthlyCost,
    profit: monthlyProfit,
    pcsSold,
    pcRevenue: roundToCents(pcRevenue),
    pcCost: roundToCents(pcCost),
    pcProfit,
    partRevenue: roundToCents(partRevenue),
    partCost: roundToCents(partCost),
    partProfit,
  };
}

/** A shared, restrained palette for component rows. */
export function getCategoryPresentation(category: string): {
  label: string;
  textClass: string;
  railClass: string;
} {
  switch (String(category || '').toUpperCase()) {
    case 'GPU': return { label: 'GPU', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'CPU': return { label: 'CPU', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'MOTHERBOARD': return { label: 'MOBO', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'RAM': return { label: 'RAM', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'COOLING': return { label: 'Cooling', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'STORAGE': return { label: 'Storage', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'PSU': return { label: 'PSU', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'CASE': return { label: 'Case', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'FANS': return { label: 'Fans', textClass: 'text-[#9FF8F4]', railClass: 'bg-[#62E6E6]' };
    case 'ACCESSORIES': return { label: 'Accessories', textClass: 'text-zinc-300', railClass: 'bg-zinc-500' };
    default: return { label: 'Other', textClass: 'text-zinc-300', railClass: 'bg-zinc-500' };
  }
}

export function getConditionDotColor(condition: string): string {
  const normalized = String(condition || '').toUpperCase();
  if (normalized.includes('SEALED')) return 'bg-emerald-400';
  if (normalized.includes('NEW')) return 'bg-cyan-400';
  if (normalized.includes('USED')) return 'bg-zinc-400';
  return 'bg-zinc-500';
}

export function normalizeTag(tag: string): string {
  if (!tag) return '';
  const trimmed = tag.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'gen5') return 'GEN5';
  if (lower === 'gen4') return 'GEN4';
  if (lower === 'gen3') return 'GEN3';
  if (lower === 'sata') return 'SATA';
  if (lower === 'white') return 'White';
  if (lower === 'black') return 'Black';
  if (lower === 'am5') return 'AM5';
  if (lower === 'am4') return 'AM4';
  if (lower === 'intel') return 'Intel';
  if (lower === 'amd') return 'AMD';
  if (lower === 'ddr5') return 'DDR5';
  if (lower === 'ddr4') return 'DDR4';
  if (lower === 'atx') return 'ATX';
  if (lower === 'matx') return 'mATX';
  if (lower === 'itx') return 'ITX';
  if (lower === 'sfx') return 'SFX';
  if (lower === 'rgb') return 'RGB';
  if (lower === 'non-rgb' || lower === 'non rgb') return 'Non-RGB';
  if (lower === 'air cooler' || lower === 'air coolers') return 'Air Cooler';
  if (lower === '360mm') return '360mm';
  if (lower === '240mm') return '240mm';
  if (lower === '50 series') return '50 Series';
  if (lower === '40 series') return '40 Series';
  if (lower === '30 series') return '30 Series';
  if (lower === 'atx 3.0 / 3.1' || lower === 'atx 3.0' || lower === 'atx 3.1') return 'ATX 3.0 / 3.1';
  if (lower === 'standard') return 'Standard';
  return trimmed;
}

export interface CategoryTagGroupDef {
  label: string;
  tags: string[];
}

export const CATEGORY_TAG_GROUPS: Record<string, CategoryTagGroupDef[]> = {
  CPU: [
    { label: 'Platform', tags: ['AM5', 'AM4', 'Intel'] },
  ],
  GPU: [
    { label: 'Generation', tags: ['50 Series', '40 Series', '30 Series', 'AMD'] },
    { label: 'Color', tags: ['Black', 'White'] },
  ],
  Motherboard: [
    { label: 'Socket', tags: ['AM5', 'AM4', 'Intel'] },
    { label: 'Form Factor', tags: ['ATX', 'mATX', 'ITX'] },
    { label: 'Color', tags: ['Black', 'White'] },
  ],
  RAM: [
    { label: 'Generation', tags: ['DDR5', 'DDR4'] },
    { label: 'Color', tags: ['Black', 'White'] },
    { label: 'Lighting', tags: ['RGB', 'Non-RGB'] },
  ],
  Storage: [
    { label: 'Interface', tags: ['GEN5', 'GEN4', 'GEN3', 'SATA'] },
  ],
  Cooling: [
    { label: 'Size / Type', tags: ['360mm', '240mm', 'Air Cooler'] },
    { label: 'Color', tags: ['Black', 'White'] },
  ],
  PSU: [
    { label: 'PSU Form Factor', tags: ['ATX', 'SFX'] },
    { label: 'PSU Spec', tags: ['ATX 3.0 / 3.1', 'Standard'] },
    { label: 'Color', tags: ['Black', 'White'] },
  ],
  Case: [
    { label: 'Form Factor', tags: ['ATX', 'mATX', 'ITX'] },
    { label: 'Color', tags: ['Black', 'White'] },
  ],
};

export const SUB_CATEGORIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_TAG_GROUPS).map(([cat, groups]) => [
    cat,
    Array.from(new Set(groups.flatMap((g) => g.tags))),
  ])
);

export function sortCategoryTags(
  tags?: (string | null | undefined)[],
  category?: string
): string[] {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map(normalizeTag);
  const unique = Array.from(new Set(normalized));

  let presetOrder: string[] = [];
  if (category && SUB_CATEGORIES[category]) {
    presetOrder = SUB_CATEGORIES[category];
  } else {
    presetOrder = Array.from(
      new Set(
        Object.values(CATEGORY_TAG_GROUPS).flatMap((groups) =>
          groups.flatMap((g) => g.tags)
        )
      )
    );
  }

  return unique.sort((a, b) => {
    const idxA = presetOrder.findIndex((p) => p.toLowerCase() === a.toLowerCase());
    const idxB = presetOrder.findIndex((p) => p.toLowerCase() === b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function normalizeTags(
  tags?: (string | null | undefined)[],
  category?: string
): string[] {
  return sortCategoryTags(tags, category);
}

export interface MutuallyExclusiveTagGroup {
  name: string;
  tags: string[];
}

export const MUTUALLY_EXCLUSIVE_TAG_GROUPS: MutuallyExclusiveTagGroup[] = [
  { name: 'CPU / Mobo Platform', tags: ['AM5', 'AM4', 'Intel'] },
  { name: 'GPU Generation', tags: ['50 Series', '40 Series', '30 Series', 'AMD'] },
  { name: 'Form Factor / Size', tags: ['ATX', 'mATX', 'ITX'] },
  { name: 'PSU Form Factor', tags: ['ATX', 'SFX'] },
  { name: 'RAM Generation', tags: ['DDR5', 'DDR4'] },
  { name: 'Storage Interface', tags: ['GEN5', 'GEN4', 'GEN3', 'SATA'] },
  { name: 'Cooler Type', tags: ['360mm', '240mm', 'Air Cooler'] },
  { name: 'PSU Spec', tags: ['ATX 3.0 / 3.1', 'Standard'] },
  { name: 'General Color', tags: ['Black', 'White'] },
  { name: 'RAM Lighting', tags: ['RGB', 'Non-RGB'] },
];

export const getConflictingTags = (tag: string, category?: string): string[] => {
  const tagLower = tag.toLowerCase().trim();
  // Check category-specific tag groups first if category is supplied
  if (category && CATEGORY_TAG_GROUPS[category]) {
    for (const group of CATEGORY_TAG_GROUPS[category]) {
      if (group.tags.some((t) => t.toLowerCase() === tagLower || (tagLower === 'air coolers' && t === 'Air Cooler'))) {
        return group.tags;
      }
    }
  }
  // Fallback to global mutually exclusive tag groups
  for (const group of MUTUALLY_EXCLUSIVE_TAG_GROUPS) {
    if (group.tags.some((t) => t.toLowerCase() === tagLower || (tagLower === 'air coolers' && t === 'Air Cooler'))) {
      return group.tags;
    }
  }
  return [tag];
};
export const determineSubCategory = (comp: import('../types').InventoryComponent) => {
  if (!comp) return null;
  const possible = SUB_CATEGORIES[comp.category] || [];
  const nameLower = String(comp.name || '').toLowerCase();
  const specLower = typeof comp.specifications === 'string' ? comp.specifications.toLowerCase() : (comp.specifications ? String(comp.specifications).toLowerCase() : '');
  const compTags = Array.isArray(comp.tags) ? comp.tags.map(t => String(t || '').trim().toLowerCase()) : [];
  for (const sub of possible) {
    const subLower = sub.toLowerCase();
    if (nameLower.includes(subLower) || 
        compTags.includes(subLower) ||
        (specLower && specLower.includes(subLower))) {
      return sub;
    }
  }
  return null;
};

export {
  enforceMutualExclusivity,
  mergeComponentTagsNonDestructively,
} from './autoTagUtils';
