import { TransactionLogItem, PCBuild } from '../types';
import { parseDateLocal } from './helpers';
import { classifyTransaction } from './transactionClassification';

export const FINANCIAL_CSV_COLUMNS = [
  'Date',
  'Transaction Type',
  'Item/Build Name',
  'Quantity',
  'Purchase Amount ($)',
  'Sale Revenue ($)',
  'Recorded Cost Basis ($)',
  'Cash Received ($)',
  'Trade-In Credit ($)',
  'Cash Paid on Trade-Up ($)',
  'Incoming Trade-Up Cost Basis ($)',
  'Net Profit ($)',
  'Platform',
  'Payment Method',
  'Buyer Name',
  'Notes',
] as const;

export interface FinancialRow {
  date: string;
  transactionType: string;
  itemName: string;
  quantity: string | number;
  purchaseAmount?: number;
  saleRevenue?: number;
  recordedCostBasis?: number;
  cashReceived?: number;
  tradeInCredit?: number;
  cashPaidOnTradeUp?: number;
  incomingTradeUpCostBasis?: number;
  netProfit?: number;
  platform: string;
  paymentMethod: string;
  buyerName: string;
  notes: string;
}

export interface FinancialTotals {
  purchaseAmount: number;
  saleRevenue: number;
  recordedCostBasis: number;
  cashReceived: number;
  tradeInCredit: number;
  cashPaidOnTradeUp: number;
  incomingTradeUpCostBasis: number;
  netProfit: number;
}

/**
 * Resolves a transaction's valid reporting date and parsed date components.
 * Resolution order:
 * 1. Try dateSortable when it parses as a valid date.
 * 2. If dateSortable is missing or invalid, try timestamp when it parses as a valid date.
 * 3. If neither is valid, returns null.
 */
export function resolveTransactionDate(tx: TransactionLogItem): {
  dateStr: string;
  parsed: { year: number; monthIndex: number; day: number };
} | null {
  if (tx.dateSortable) {
    const parsedSortable = parseDateLocal(tx.dateSortable);
    if (parsedSortable) {
      return { dateStr: tx.dateSortable, parsed: parsedSortable };
    }
  }
  if (tx.timestamp) {
    const parsedTimestamp = parseDateLocal(tx.timestamp);
    if (parsedTimestamp) {
      return { dateStr: tx.timestamp, parsed: parsedTimestamp };
    }
  }
  return null;
}

/**
 * Derives available calendar years from transactions with valid dates.
 * Uses resolveTransactionDate (trying dateSortable then timestamp).
 * Always includes the current calendar year.
 * Sorted descending (newest first).
 */
export function extractAvailableYears(transactions: TransactionLogItem[]): number[] {
  const currentYear = new Date().getFullYear();
  const yearSet = new Set<number>([currentYear]);

  for (const tx of transactions) {
    const resolved = resolveTransactionDate(tx);
    if (resolved && resolved.parsed.year) {
      yearSet.add(resolved.parsed.year);
    }
  }

  return Array.from(yearSet).sort((a, b) => b - a);
}

/**
 * Filters transactions for a specific calendar year.
 * Excludes transactions with missing or invalid dates without mutating them.
 * Returns the filtered transactions and the count of excluded invalid-date records across all transactions.
 */
export function filterTransactionsByYear(
  transactions: TransactionLogItem[],
  selectedYear: number
): {
  yearTransactions: TransactionLogItem[];
  invalidDateCount: number;
} {
  const yearTransactions: TransactionLogItem[] = [];
  let invalidDateCount = 0;

  for (const tx of transactions) {
    const resolved = resolveTransactionDate(tx);
    if (!resolved) {
      invalidDateCount++;
    } else if (resolved.parsed.year === selectedYear) {
      yearTransactions.push(tx);
    }
  }

  return { yearTransactions, invalidDateCount };
}

/**
 * Formats a numeric currency cell.
 * A legitimately recorded numeric zero returns "0.00".
 * Missing, null, undefined, NaN, or infinite values return "".
 */
export function formatCurrencyCell(val: number | undefined | null): string {
  if (val === undefined || val === null) return '';
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return '';
  return val.toFixed(2);
}

/**
 * Escapes a string value for CSV output.
 * If empty/undefined/null, returns empty string "".
 * Otherwise quotes the string and escapes any internal double quotes by doubling them.
 */
export function escapeCsvString(val: string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  return `"${String(val).replace(/"/g, '""')}"`;
}

/**
 * Helper to round a floating point number to two decimal places (cents)
 */
function roundToCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Maps a single TransactionLogItem to a structured FinancialRow according to domain rules.
 */
export function buildFinancialRow(tx: TransactionLogItem, builds: PCBuild[] = []): FinancialRow {
  const classification = classifyTransaction(tx, builds);

  const resolved = resolveTransactionDate(tx);
  const date = resolved ? resolved.dateStr : (tx.dateSortable || tx.timestamp || '');
  const platform = tx.platform || '';
  const paymentMethod = tx.paymentMethod || '';
  const buyerName = tx.buyerName || '';
  const notes = tx.notes || '';

  // Determine Item / Build Name
  let itemName = tx.itemNameOrSummary?.trim() || '';
  if (!itemName) {
    if (classification.isPCSale && tx.relatedComponentId) {
      const matched = builds.find((b) => b.id === tx.relatedComponentId);
      if (matched) itemName = matched.name;
    }
    if (!itemName) {
      itemName = tx.title?.trim() || '';
    }
  }

  // 1. EXCHANGE / TRADE_UP rows
  if (classification.isExchange) {
    const qty = typeof tx.outgoingQuantity === 'number'
      ? tx.outgoingQuantity
      : (typeof tx.quantity === 'number' ? tx.quantity : (typeof tx.relatedComponentQty === 'number' ? tx.relatedComponentQty : ''));

    const cashPaidOnTradeUp = typeof tx.cashPaidOnTop === 'number' && !isNaN(tx.cashPaidOnTop) && isFinite(tx.cashPaidOnTop)
      ? tx.cashPaidOnTop
      : undefined;

    const recordedCostBasis = typeof tx.outgoingCostBasis === 'number' && !isNaN(tx.outgoingCostBasis) && isFinite(tx.outgoingCostBasis)
      ? tx.outgoingCostBasis
      : undefined;

    const incomingTradeUpCostBasis = typeof tx.incomingCostBasis === 'number' && !isNaN(tx.incomingCostBasis) && isFinite(tx.incomingCostBasis)
      ? tx.incomingCostBasis
      : undefined;

    return {
      date,
      transactionType: 'EXCHANGE',
      itemName,
      quantity: qty,
      purchaseAmount: undefined,
      saleRevenue: undefined,
      recordedCostBasis,
      cashReceived: undefined,
      tradeInCredit: undefined,
      cashPaidOnTradeUp,
      incomingTradeUpCostBasis,
      netProfit: undefined,
      platform,
      paymentMethod,
      buyerName,
      notes,
    };
  }

  // 2. BUILD_ALLOCATION rows (Internal inventory movements)
  if (classification.isBuildAllocation) {
    const qty = typeof tx.itemCount === 'number'
      ? tx.itemCount
      : (typeof tx.quantity === 'number' ? tx.quantity : (typeof tx.relatedComponentQty === 'number' ? tx.relatedComponentQty : ''));

    return {
      date,
      transactionType: 'BUILD_ALLOCATION',
      itemName,
      quantity: qty,
      purchaseAmount: undefined,
      saleRevenue: undefined,
      recordedCostBasis: undefined,
      cashReceived: undefined,
      tradeInCredit: undefined,
      cashPaidOnTradeUp: undefined,
      incomingTradeUpCostBasis: undefined,
      netProfit: undefined,
      platform,
      paymentMethod,
      buyerName,
      notes,
    };
  }

  // 3. PURCHASE rows
  if (classification.isPurchase) {
    const qty = typeof tx.quantity === 'number'
      ? tx.quantity
      : (typeof tx.relatedComponentQty === 'number' ? tx.relatedComponentQty : (typeof tx.itemCount === 'number' ? tx.itemCount : ''));

    const purchaseAmount = typeof tx.totalAmount === 'number' && !isNaN(tx.totalAmount) && isFinite(tx.totalAmount)
      ? tx.totalAmount
      : undefined;

    return {
      date,
      transactionType: 'PURCHASE',
      itemName,
      quantity: qty,
      purchaseAmount,
      saleRevenue: undefined,
      recordedCostBasis: undefined,
      cashReceived: undefined,
      tradeInCredit: undefined,
      cashPaidOnTradeUp: undefined,
      incomingTradeUpCostBasis: undefined,
      netProfit: undefined,
      platform,
      paymentMethod,
      buyerName,
      notes,
    };
  }

  // 4. SALE rows
  const qty = typeof tx.quantity === 'number'
    ? tx.quantity
    : (typeof tx.relatedComponentQty === 'number' ? tx.relatedComponentQty : (typeof tx.itemCount === 'number' ? tx.itemCount : ''));

  const saleRevenue = typeof tx.totalAmount === 'number' && !isNaN(tx.totalAmount) && isFinite(tx.totalAmount)
    ? tx.totalAmount
    : undefined;

  // Recorded Cost Basis
  let recordedCostBasis: number | undefined = undefined;
  if (typeof tx.soldUnitCost === 'number' && !isNaN(tx.soldUnitCost) && isFinite(tx.soldUnitCost)) {
    const numericQty = typeof tx.quantity === 'number' && tx.quantity > 0
      ? tx.quantity
      : (typeof tx.relatedComponentQty === 'number' && tx.relatedComponentQty > 0 ? tx.relatedComponentQty : 1);
    recordedCostBasis = tx.soldUnitCost * numericQty;
  } else if (
    saleRevenue !== undefined &&
    typeof tx.profitMargin === 'number' &&
    !isNaN(tx.profitMargin) &&
    isFinite(tx.profitMargin)
  ) {
    recordedCostBasis = saleRevenue - tx.profitMargin;
  }

  // Cash Received
  let cashReceived: number | undefined = undefined;
  if (typeof tx.cashPortion === 'number' && !isNaN(tx.cashPortion) && isFinite(tx.cashPortion)) {
    cashReceived = tx.cashPortion;
  } else if (saleRevenue !== undefined) {
    const credit = typeof tx.tradeInCredit === 'number' && !isNaN(tx.tradeInCredit) && isFinite(tx.tradeInCredit)
      ? tx.tradeInCredit
      : 0;
    cashReceived = saleRevenue - credit;
  }

  // Trade-In Credit
  const tradeInCredit = typeof tx.tradeInCredit === 'number' && !isNaN(tx.tradeInCredit) && isFinite(tx.tradeInCredit)
    ? tx.tradeInCredit
    : undefined;

  // Net Profit
  const netProfit = typeof tx.profitMargin === 'number' && !isNaN(tx.profitMargin) && isFinite(tx.profitMargin)
    ? tx.profitMargin
    : undefined;

  return {
    date,
    transactionType: 'SALE',
    itemName,
    quantity: qty,
    purchaseAmount: undefined,
    saleRevenue,
    recordedCostBasis,
    cashReceived,
    tradeInCredit,
    cashPaidOnTradeUp: undefined,
    incomingTradeUpCostBasis: undefined,
    netProfit,
    platform,
    paymentMethod,
    buyerName,
    notes,
  };
}

/**
 * Calculates mathematical totals for all financial numeric columns across rows.
 * Blank/undefined/non-applicable values contribute nothing (0).
 */
export function calculateFinancialTotals(rows: FinancialRow[]): FinancialTotals {
  let purchaseAmount = 0;
  let saleRevenue = 0;
  let recordedCostBasis = 0;
  let cashReceived = 0;
  let tradeInCredit = 0;
  let cashPaidOnTradeUp = 0;
  let incomingTradeUpCostBasis = 0;
  let netProfit = 0;

  for (const r of rows) {
    if (r.purchaseAmount !== undefined) {
      purchaseAmount = roundToCents(purchaseAmount + r.purchaseAmount);
    }
    if (r.saleRevenue !== undefined) {
      saleRevenue = roundToCents(saleRevenue + r.saleRevenue);
    }
    if (r.recordedCostBasis !== undefined) {
      recordedCostBasis = roundToCents(recordedCostBasis + r.recordedCostBasis);
    }
    if (r.cashReceived !== undefined) {
      cashReceived = roundToCents(cashReceived + r.cashReceived);
    }
    if (r.tradeInCredit !== undefined) {
      tradeInCredit = roundToCents(tradeInCredit + r.tradeInCredit);
    }
    if (r.cashPaidOnTradeUp !== undefined) {
      cashPaidOnTradeUp = roundToCents(cashPaidOnTradeUp + r.cashPaidOnTradeUp);
    }
    if (r.incomingTradeUpCostBasis !== undefined) {
      incomingTradeUpCostBasis = roundToCents(incomingTradeUpCostBasis + r.incomingTradeUpCostBasis);
    }
    if (r.netProfit !== undefined) {
      netProfit = roundToCents(netProfit + r.netProfit);
    }
  }

  return {
    purchaseAmount,
    saleRevenue,
    recordedCostBasis,
    cashReceived,
    tradeInCredit,
    cashPaidOnTradeUp,
    incomingTradeUpCostBasis,
    netProfit,
  };
}

/**
 * Generates the full CSV content string with UTF-8 BOM, headers, escaped data rows,
 * and a final TOTAL row summing only the selected year's exported records.
 */
export function generateFinancialCsv(
  yearTransactions: TransactionLogItem[],
  builds: PCBuild[] = []
): string {
  const rows = yearTransactions.map((tx) => buildFinancialRow(tx, builds));
  const totals = calculateFinancialTotals(rows);

  const headerRow = FINANCIAL_CSV_COLUMNS.map((col) => escapeCsvString(col)).join(',');

  const dataRows = rows.map((r) => {
    const qtyStr = r.quantity !== undefined && r.quantity !== '' ? String(r.quantity) : '';
    return [
      escapeCsvString(r.date),
      escapeCsvString(r.transactionType),
      escapeCsvString(r.itemName),
      qtyStr ? escapeCsvString(qtyStr) : '',
      formatCurrencyCell(r.purchaseAmount),
      formatCurrencyCell(r.saleRevenue),
      formatCurrencyCell(r.recordedCostBasis),
      formatCurrencyCell(r.cashReceived),
      formatCurrencyCell(r.tradeInCredit),
      formatCurrencyCell(r.cashPaidOnTradeUp),
      formatCurrencyCell(r.incomingTradeUpCostBasis),
      formatCurrencyCell(r.netProfit),
      escapeCsvString(r.platform),
      escapeCsvString(r.paymentMethod),
      escapeCsvString(r.buyerName),
      escapeCsvString(r.notes),
    ].join(',');
  });

  const totalRow = [
    escapeCsvString('TOTAL'),
    '',
    '',
    '',
    formatCurrencyCell(totals.purchaseAmount),
    formatCurrencyCell(totals.saleRevenue),
    formatCurrencyCell(totals.recordedCostBasis),
    formatCurrencyCell(totals.cashReceived),
    formatCurrencyCell(totals.tradeInCredit),
    formatCurrencyCell(totals.cashPaidOnTradeUp),
    formatCurrencyCell(totals.incomingTradeUpCostBasis),
    formatCurrencyCell(totals.netProfit),
    '',
    '',
    '',
    '',
  ].join(',');

  const csvBody = [headerRow, ...dataRows, totalRow].join('\n');
  const UTF8_BOM = '\uFEFF';
  return UTF8_BOM + csvBody;
}
