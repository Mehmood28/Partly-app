import { TransactionLogItem, PCBuild } from '../types';
import { classifyTransaction } from './transactionClassification';
import { parseDateLocal, formatCurrency } from './helpers';

export interface SinglePartSaleDisplayItem {
  type: 'single';
  id: string;
  tx: TransactionLogItem;
  saleDate: string;
  totalRevenue: number;
  totalProfit: number;
}

export interface BulkPartSaleGroupDisplayItem {
  type: 'bulk-group';
  id: string;
  bulkSaleGroupId: string;
  transactions: TransactionLogItem[];
  lineCount: number;
  totalUnits: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  profitPercentage: number;
  saleDate: string;
  platform?: string;
  paymentMethod?: string;
  buyerName?: string;
  notes?: string;
}

export type SoldPartDisplayItem = SinglePartSaleDisplayItem | BulkPartSaleGroupDisplayItem;

export type SoldPartSortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'profit-desc';

export function toFiniteNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  }
  return fallback;
}

export function getSafeDisplayQuantity(tx: TransactionLogItem): number {
  const rawQty = (tx.relatedComponentQty !== undefined ? tx.relatedComponentQty : tx.quantity) as unknown;
  if (typeof rawQty === 'number' && Number.isFinite(rawQty) && Number.isInteger(rawQty) && rawQty > 0) {
    return rawQty;
  }
  if (typeof rawQty === 'string' && rawQty.trim() !== '') {
    const num = Number(rawQty);
    if (Number.isFinite(num) && Number.isInteger(num) && num > 0) {
      return num;
    }
  }
  return 1;
}

export function formatSignedProfit(profit: number): string {
  if (!Number.isFinite(profit) || profit === 0) {
    return formatCurrency(0);
  }
  if (profit > 0) {
    return `+${formatCurrency(profit)}`;
  }
  return `-${formatCurrency(Math.abs(profit))}`;
}

export interface ResolvedTransactionDate {
  dateStr: string;
  year: number;
  monthIndex: number;
  day: number;
  sortValue: number;
}

/**
 * Resolves transaction date using:
 * 1. Valid dateSortable;
 * 2. Otherwise valid timestamp;
 * 3. Otherwise invalid/missing (returns null).
 */
export function resolveTransactionDate(tx: TransactionLogItem): ResolvedTransactionDate | null {
  if (tx.dateSortable) {
    const parsed = parseDateLocal(tx.dateSortable);
    if (parsed) {
      return {
        dateStr: tx.dateSortable,
        year: parsed.year,
        monthIndex: parsed.monthIndex,
        day: parsed.day,
        sortValue: parsed.year * 10000 + (parsed.monthIndex + 1) * 100 + parsed.day,
      };
    }
  }

  if (tx.timestamp) {
    const parsed = parseDateLocal(tx.timestamp);
    if (parsed) {
      return {
        dateStr: tx.timestamp,
        year: parsed.year,
        monthIndex: parsed.monthIndex,
        day: parsed.day,
        sortValue: parsed.year * 10000 + (parsed.monthIndex + 1) * 100 + parsed.day,
      };
    }
  }

  return null;
}

/**
 * Calculates the exact recorded cost for an individual transaction.
 * Follows rule: Prefer exact soldUnitCost * quantity; otherwise use totalAmount - profitMargin.
 */
export function getTransactionRecordedCost(tx: TransactionLogItem): number {
  const qty = getSafeDisplayQuantity(tx);

  if (tx.soldUnitCost !== undefined && tx.soldUnitCost !== null) {
    const unitCost = toFiniteNumber(tx.soldUnitCost, -1);
    if (unitCost >= 0) {
      return unitCost * qty;
    }
  }

  const rev = toFiniteNumber(tx.totalAmount, 0);
  const profit = tx.profitMargin !== undefined ? toFiniteNumber(tx.profitMargin, 0) : 0;
  return Math.max(0, rev - profit);
}

export function createBulkGroupDisplayItem(
  bulkSaleGroupId: string,
  transactions: TransactionLogItem[]
): BulkPartSaleGroupDisplayItem {
  let totalCost = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalUnits = 0;

  for (const tx of transactions) {
    const qty = getSafeDisplayQuantity(tx);
    totalUnits += qty;

    const lineRev = toFiniteNumber(tx.totalAmount, 0);
    const lineProfit = tx.profitMargin !== undefined ? toFiniteNumber(tx.profitMargin, 0) : 0;
    const lineCost = getTransactionRecordedCost(tx);

    totalRevenue += lineRev;
    totalProfit += lineProfit;
    totalCost += lineCost;
  }

  // Determine bulk group's displayed/sort date deterministically from its eligible members:
  // Prefer the latest valid member date if inconsistent legacy group dates exist.
  // Never invent today for an invalid or missing date.
  let latestDate: ResolvedTransactionDate | null = null;
  for (const tx of transactions) {
    const resolved = resolveTransactionDate(tx);
    if (resolved) {
      if (!latestDate || resolved.sortValue > latestDate.sortValue) {
        latestDate = resolved;
      }
    }
  }
  const saleDate = latestDate ? latestDate.dateStr : '';

  const firstTx = transactions[0];
  const platform = firstTx?.platform;
  const paymentMethod = firstTx?.paymentMethod;
  const buyerName = firstTx?.buyerName;
  const notes = firstTx?.notes;

  const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return {
    type: 'bulk-group',
    id: `bulk:${bulkSaleGroupId}`,
    bulkSaleGroupId,
    transactions,
    lineCount: transactions.length,
    totalUnits,
    totalCost,
    totalRevenue,
    totalProfit,
    profitPercentage,
    saleDate,
    platform,
    paymentMethod,
    buyerName,
    notes,
  };
}

export function createSingleDisplayItem(tx: TransactionLogItem): SinglePartSaleDisplayItem {
  const resolved = resolveTransactionDate(tx);
  const totalRevenue = toFiniteNumber(tx.totalAmount, 0);
  const totalProfit = tx.profitMargin !== undefined ? toFiniteNumber(tx.profitMargin, 0) : 0;

  return {
    type: 'single',
    id: tx.id,
    tx,
    saleDate: resolved ? resolved.dateStr : '',
    totalRevenue,
    totalProfit,
  };
}

/**
 * Groups sold parts and exchanges at the view-model layer.
 * Transactions sharing the same non-empty bulkSaleGroupId render as one bulk-sale group.
 * Normal part sales and exchanges remain individual items.
 * Preserves the exact order of appearance.
 */
export function getSoldPartsDisplayItems(
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): SoldPartDisplayItem[] {
  const soldAndTrade = transactions.filter((tx) => {
    const c = classifyTransaction(tx, builds);
    return c.isPartSale || c.isExchange;
  });

  const bulkGroupsMap = new Map<string, TransactionLogItem[]>();

  for (const tx of soldAndTrade) {
    const c = classifyTransaction(tx, builds);
    const isGroupableBulkSale =
      c.isPartSale &&
      !c.isExchange &&
      typeof tx.bulkSaleGroupId === 'string' &&
      tx.bulkSaleGroupId.trim() !== '';

    if (isGroupableBulkSale) {
      const gid = tx.bulkSaleGroupId!.trim();
      const existing = bulkGroupsMap.get(gid);
      if (existing) {
        existing.push(tx);
      } else {
        bulkGroupsMap.set(gid, [tx]);
      }
    }
  }

  const displayItems: SoldPartDisplayItem[] = [];
  const processedGroupIds = new Set<string>();

  for (const tx of soldAndTrade) {
    const c = classifyTransaction(tx, builds);
    const isGroupableBulkSale =
      c.isPartSale &&
      !c.isExchange &&
      typeof tx.bulkSaleGroupId === 'string' &&
      tx.bulkSaleGroupId.trim() !== '';

    if (isGroupableBulkSale) {
      const gid = tx.bulkSaleGroupId!.trim();
      if (processedGroupIds.has(gid)) {
        continue;
      }
      processedGroupIds.add(gid);
      const groupTxs = bulkGroupsMap.get(gid) || [tx];
      displayItems.push(createBulkGroupDisplayItem(gid, groupTxs));
    } else {
      displayItems.push(createSingleDisplayItem(tx));
    }
  }

  return displayItems;
}

/**
 * Checks if an item matches search query.
 * For bulk groups, matches if any member matches part name, buyer, platform, payment method, notes, or title.
 */
export function matchesSearchQuery(
  item: SoldPartDisplayItem,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (item.type === 'single') {
    const tx = item.tx;
    return (
      String(tx.title || '').toLowerCase().includes(q) ||
      String(tx.itemNameOrSummary || '').toLowerCase().includes(q) ||
      String(tx.platform || '').toLowerCase().includes(q) ||
      String(tx.paymentMethod || '').toLowerCase().includes(q) ||
      (tx.buyerName ? String(tx.buyerName).toLowerCase().includes(q) : false) ||
      (tx.notes ? String(tx.notes).toLowerCase().includes(q) : false) ||
      (tx.detailsList ? tx.detailsList.some((d) => d.toLowerCase().includes(q)) : false)
    );
  }

  // Bulk-group item
  if ('bulk part sale'.includes(q) || 'bulk sale'.includes(q)) {
    return true;
  }

  return item.transactions.some((tx) => {
    return (
      String(tx.title || '').toLowerCase().includes(q) ||
      String(tx.itemNameOrSummary || '').toLowerCase().includes(q) ||
      String(tx.platform || '').toLowerCase().includes(q) ||
      String(tx.paymentMethod || '').toLowerCase().includes(q) ||
      (tx.buyerName ? String(tx.buyerName).toLowerCase().includes(q) : false) ||
      (tx.notes ? String(tx.notes).toLowerCase().includes(q) : false) ||
      (tx.detailsList ? tx.detailsList.some((d) => d.toLowerCase().includes(q)) : false)
    );
  });
}

/**
 * Sorts sold part display items with deterministic ordering.
 * Uses aggregate group revenue, profit, or resolved date.
 */
export function sortSoldPartDisplayItems(
  items: SoldPartDisplayItem[],
  sortBy: SoldPartSortOption
): SoldPartDisplayItem[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
      const parsedA = parseDateLocal(a.saleDate);
      const parsedB = parseDateLocal(b.saleDate);

      const hasA = parsedA !== null;
      const hasB = parsedB !== null;

      // Invalid/missing dates sort deterministically AFTER valid dates for both Newest First and Oldest First
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (!hasA && !hasB) return a.id.localeCompare(b.id);

      const sortA = parsedA!.year * 10000 + (parsedA!.monthIndex + 1) * 100 + parsedA!.day;
      const sortB = parsedB!.year * 10000 + (parsedB!.monthIndex + 1) * 100 + parsedB!.day;

      if (sortA !== sortB) {
        return sortBy === 'date-desc' ? sortB - sortA : sortA - sortB;
      }
      return a.id.localeCompare(b.id);
    }
    if (sortBy === 'amount-desc' || sortBy === 'amount-asc') {
      if (a.totalRevenue !== b.totalRevenue) {
        return sortBy === 'amount-desc'
          ? b.totalRevenue - a.totalRevenue
          : a.totalRevenue - b.totalRevenue;
      }
      return a.id.localeCompare(b.id);
    }
    if (sortBy === 'profit-desc') {
      if (a.totalProfit !== b.totalProfit) {
        return b.totalProfit - a.totalProfit;
      }
      return a.id.localeCompare(b.id);
    }
    return a.id.localeCompare(b.id);
  });
}
