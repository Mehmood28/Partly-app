
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

export type SortOption = 'highest-price' | 'lowest-price' | 'highest-stock' | 'lowest-stock' | 'newest-purchase';

export interface FilterSortOptions {
  builds?: PCBuild[];
  searchQuery?: string;
  category?: string;
  onlyAvailable?: boolean;
  subCategory?: string;
  sortBy?: SortOption;
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

    // 4. Sub-Category Filter (Pills)
    if (options.subCategory) {
      const compSub = determineSubCategory(comp);
      if (compSub !== options.subCategory) return false;
    }

    return true;
  });

  // Fast date lookup helper avoiding array allocation inside comparator
  const getLatestTimestamp = (comp: InventoryComponent): number => {
    if (!comp.purchaseHistory || comp.purchaseHistory.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < comp.purchaseHistory.length; i++) {
      const time = new Date(comp.purchaseHistory[i].date).getTime() || 0;
      if (time > max) max = time;
    }
    return max;
  };

  // 5. Sorting
  return filtered.sort((a, b) => {
    if (options.sortBy === 'highest-price') {
      return calculateAverageUnitCost(b) - calculateAverageUnitCost(a);
    }
    if (options.sortBy === 'lowest-price') {
      return calculateAverageUnitCost(a) - calculateAverageUnitCost(b);
    }
    if (options.sortBy === 'highest-stock') {
      return calculateUnassignedQuantityStrict(b, options.builds || [], precomputedMap) - calculateUnassignedQuantityStrict(a, options.builds || [], precomputedMap);
    }
    if (options.sortBy === 'lowest-stock') {
      return calculateUnassignedQuantityStrict(a, options.builds || [], precomputedMap) - calculateUnassignedQuantityStrict(b, options.builds || [], precomputedMap);
    }
    
    // Default sorting (newest-purchase)
    return getLatestTimestamp(b) - getLatestTimestamp(a);
  });
}

export function autoTagComponent(name: string, specs: string, category: string): string[] {
  const text = `${name || ''} ${specs || ''}`.toLowerCase();
  const tags: string[] = [];

  if (category === 'CPU') {
    if (/ryzen.*(1\d\d\d|2\d\d\d|3\d\d\d|4\d\d\d|5\d\d\d)|b450|x570|b550|am4/i.test(text)) tags.push('AM4');
    else if (/ryzen.*(7\d\d\d|8\d\d\d|9\d\d\d)|b650|x670|x870|am5/i.test(text)) tags.push('AM5');
    else if (/core|intel|i3|i5|i7|i9|lga/i.test(text)) tags.push('Intel');
  } 
  else if (category === 'Motherboard') {
    if (/b450|x570|b550|a320|x470|am4/i.test(text)) tags.push('AM4');
    else if (/b650|x670|b850|x870|a620|am5/i.test(text)) tags.push('AM5');
    else if (/b660|b760|z690|z790|z890|h610|intel|lga/i.test(text)) tags.push('Intel');
  }
  else if (category === 'GPU') {
    if (/rtx.*50\d\d/i.test(text)) tags.push('50 Series');
    else if (/rtx.*40\d\d/i.test(text)) tags.push('40 Series');
    else if (/rtx.*30\d\d/i.test(text)) tags.push('30 Series');
    else if (/rx|radeon|amd/i.test(text)) tags.push('AMD');
  }
  else if (category === 'RAM') {
    if (/ddr5/i.test(text)) tags.push('DDR5');
    else if (/ddr4/i.test(text)) tags.push('DDR4');
  }
  else if (category === 'Storage') {
    if (/gen5|pcie 5/i.test(text)) tags.push('Gen5');
    else if (/gen4|pcie 4/i.test(text)) tags.push('Gen4');
    else if (/gen3|pcie 3/i.test(text)) tags.push('Gen3');
  }
  else if (category === 'Cooling') {
    if (/360mm|360/i.test(text)) tags.push('360mm');
    else if (/240mm|240/i.test(text)) tags.push('240mm');
    else if (/air|tower|cooler|nh-|assassin/i.test(text)) tags.push('Air Coolers');
  }

  else if (category === 'PSU' || category === 'Case') {
    if (/\bwhite\b/i.test(text)) tags.push('WHITE');
    if (/\bblack\b/i.test(text)) tags.push('BLACK');
  }

  return tags;
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

  return { looseValuation, activeBuilds, activeBuildsCost, totalStockValuation, activeRigsCount: activeBuilds.length };
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

  const pcProfit = pcRevenue - pcCost;
  const partProfit = partRevenue - partCost;

  const monthlyRevenue = pcRevenue + partRevenue;
  const monthlyCost = pcCost + partCost;
  const monthlyProfit = monthlyRevenue - monthlyCost;

  return {
    revenue: monthlyRevenue,
    cost: monthlyCost,
    profit: monthlyProfit,
    pcsSold,
    pcRevenue,
    pcCost,
    pcProfit,
    partRevenue,
    partCost,
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

export const SUB_CATEGORIES: Record<string, string[]> = {
  CPU: ['AM5', 'AM4', 'Intel'],
  RAM: ['DDR5', 'DDR4'],
  GPU: ['50 Series', '40 Series', '30 Series', 'AMD'],
  Storage: ['Gen5', 'Gen4', 'Gen3'],
  Motherboard: ['AM5', 'AM4', 'Intel'],
  PSU: ['Black', 'White'],
  Case: ['Black', 'White'],
  Cooling: ['360mm', '240mm', 'Air Coolers'],
};
export const determineSubCategory = (comp: import('../types').InventoryComponent) => {
  if (!comp) return null;
  const possible = SUB_CATEGORIES[comp.category] || [];
  const nameLower = String(comp.name || '').toLowerCase();
  const specLower = typeof comp.specifications === 'string' ? comp.specifications.toLowerCase() : (comp.specifications ? String(comp.specifications).toLowerCase() : '');
  const compTags = Array.isArray(comp.tags) ? comp.tags : [];
  const inferredTags = autoTagComponent(comp.name || '', comp.specifications || '', comp.category);
  for (const sub of possible) {
    const subLower = sub.toLowerCase();
    if (nameLower.includes(subLower) || 
        compTags.some(t => typeof t === 'string' && t.toLowerCase() === subLower) ||
        inferredTags.some(tag => tag.toLowerCase() === subLower) ||
        (specLower && specLower.includes(subLower))) {
      return sub;
    }
  }
  return null;
};
