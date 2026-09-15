import { PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import { parseDateLocal } from './helpers';

export interface TradeInOrigin {
  buyerName?: string;
  date?: string;
  sourceSaleTransactionId: string;
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const normalizeName = (value: unknown): string | undefined =>
  nonEmptyString(value)?.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();

const calendarDateKey = (value: unknown): string | undefined => {
  const parsed = parseDateLocal(nonEmptyString(value));
  if (!parsed) return undefined;
  return `${parsed.year}-${String(parsed.monthIndex + 1).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

const transactionDateKey = (transaction: TransactionLogItem): string | undefined =>
  calendarDateKey(transaction.dateSortable) || calendarDateKey(transaction.timestamp);

const hasTradeInEvidence = (transaction: TransactionLogItem): boolean =>
  Boolean(
    nonEmptyString(transaction.incomingTradeInBuildId) ||
    nonEmptyString(transaction.tradeInBuildName) ||
    nonEmptyString(transaction.tradeInDescription) ||
    nonEmptyString(transaction.tradeInNotes) ||
    (typeof transaction.tradeInCredit === 'number' &&
      Number.isFinite(transaction.tradeInCredit) &&
      transaction.tradeInCredit > 0) ||
    /\btrade[\s-]?in\b/i.test(transaction.title || '')
  );

const partedOutBuildName = (entry: PurchaseEntry): string | undefined => {
  const notes = nonEmptyString(entry.notes);
  if (!notes) return undefined;
  const match = notes.match(/^Parted out from traded-in PC:\s*(.+)$/i);
  return nonEmptyString(match?.[1]);
};

const amountsMatch = (left: number | undefined, right: number | undefined): boolean =>
  typeof left === 'number' &&
  Number.isFinite(left) &&
  typeof right === 'number' &&
  Number.isFinite(right) &&
  Math.abs(left - right) < 0.005;

/**
 * Resolves the outgoing sold build behind a sale. Either side of the immutable
 * relationship is accepted because older records did not always persist both.
 * A date/amount/name fallback is limited to unlinked legacy builds.
 */
const resolveLinkedSoldBuild = (
  sourceSale: TransactionLogItem,
  builds: PCBuild[]
): PCBuild | undefined => {
  const relatedBuildId = nonEmptyString(sourceSale.relatedComponentId);
  const exactMatches = builds.filter(
    (build) =>
      build.status === 'Sold' &&
      ((relatedBuildId && build.id === relatedBuildId) ||
        nonEmptyString(build.saleTransactionId) === sourceSale.id)
  );

  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1 || relatedBuildId) return undefined;

  const saleDate = transactionDateKey(sourceSale);
  if (!saleDate) return undefined;

  const legacyMatches = builds.filter(
    (build) =>
      build.status === 'Sold' &&
      !nonEmptyString(build.saleTransactionId) &&
      calendarDateKey(build.saleDate) === saleDate &&
      amountsMatch(build.salePrice, sourceSale.totalAmount)
  );

  if (legacyMatches.length === 1) return legacyMatches[0];
  if (legacyMatches.length === 0) return undefined;

  const saleName = normalizeName(sourceSale.itemNameOrSummary || sourceSale.title);
  const nameMatches = legacyMatches.filter((build) => normalizeName(build.name) === saleName);
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

const originFromSale = (
  sourceSale: TransactionLogItem,
  builds: PCBuild[]
): TradeInOrigin => {
  const linkedSoldBuild = resolveLinkedSoldBuild(sourceSale, builds);

  return {
    sourceSaleTransactionId: sourceSale.id,
    // The sold build is the authoritative owner of the buyer shown in Builds.
    buyerName: nonEmptyString(linkedSoldBuild?.buyerName) || nonEmptyString(sourceSale.buyerName),
    date:
      nonEmptyString(sourceSale.dateSortable) ||
      nonEmptyString(sourceSale.timestamp) ||
      nonEmptyString(linkedSoldBuild?.saleDate),
  };
};

const resolveFromSource = (
  sourceSaleTransactionId: string | undefined,
  expectedTradeInBuildId: string | undefined,
  transactions: TransactionLogItem[],
  builds: PCBuild[],
  legacyHints?: { tradeInBuildName?: string; date?: string }
): TradeInOrigin | null => {
  const normalizedSourceSaleTransactionId = nonEmptyString(sourceSaleTransactionId);
  const normalizedTradeInBuildId = nonEmptyString(expectedTradeInBuildId);
  const sales = transactions.filter((transaction) => transaction.type === 'SALE');

  // Newer data has this immutable source ID. It remains authoritative even if
  // a secondary incoming-build link was later repaired or replaced.
  if (normalizedSourceSaleTransactionId) {
    const exactIdMatches = sales.filter(
      (transaction) => transaction.id === normalizedSourceSaleTransactionId
    );
    if (exactIdMatches.length > 1) return null;
    if (exactIdMatches.length === 1) return originFromSale(exactIdMatches[0], builds);
  }

  // Older part-outs usually retained the deleted incoming PC's ID.
  if (normalizedTradeInBuildId) {
    const incomingBuildMatches = sales.filter(
      (transaction) =>
        nonEmptyString(transaction.incomingTradeInBuildId) === normalizedTradeInBuildId
    );
    if (incomingBuildMatches.length > 1) return null;
    if (incomingBuildMatches.length === 1) {
      return originFromSale(incomingBuildMatches[0], builds);
    }
  }

  const expectedName = normalizeName(legacyHints?.tradeInBuildName);
  const expectedDate = calendarDateKey(legacyHints?.date);

  // Some legacy records retained only the incoming PC name and acquisition date.
  if (expectedName && expectedDate) {
    const nameAndDateMatches = sales.filter(
      (transaction) =>
        normalizeName(transaction.tradeInBuildName) === expectedName &&
        transactionDateKey(transaction) === expectedDate
    );
    if (nameAndDateMatches.length > 1) return null;
    if (nameAndDateMatches.length === 1) {
      return originFromSale(nameAndDateMatches[0], builds);
    }
  }

  // Last-resort repair for already-parted-out legacy PCs: the incoming build may
  // be gone and its saved name may differ from the sale label. Match only one
  // trade-in sale on the same calendar date; ambiguity deliberately returns null.
  if (expectedDate) {
    const datedTradeInSales = sales.filter(
      (transaction) =>
        hasTradeInEvidence(transaction) && transactionDateKey(transaction) === expectedDate
    );
    if (datedTradeInSales.length === 1) {
      return originFromSale(datedTradeInSales[0], builds);
    }
  }

  return null;
};

export const resolveTradeInBuildOrigin = (
  build: PCBuild,
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): TradeInOrigin | null => {
  if (build.acquisitionSource !== 'Trade-In') return null;
  return resolveFromSource(
    build.sourceSaleTransactionId,
    build.id,
    transactions,
    builds,
    { tradeInBuildName: build.name, date: build.createdDate }
  );
};

export const isPartedOutTradeInEntry = (entry: PurchaseEntry): boolean =>
  Boolean(nonEmptyString(entry.sourceTradeInBuildId));

export const resolvePartedOutEntryOrigin = (
  entry: PurchaseEntry,
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): TradeInOrigin | null => {
  if (!isPartedOutTradeInEntry(entry)) return null;
  return resolveFromSource(
    entry.sourceSaleTransactionId,
    entry.sourceTradeInBuildId,
    transactions,
    builds,
    { tradeInBuildName: partedOutBuildName(entry), date: entry.date }
  );
};

export const resolvePurchaseEntrySeller = (
  entry: PurchaseEntry,
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): string | undefined =>
  resolvePartedOutEntryOrigin(entry, transactions, builds)?.buyerName ||
  nonEmptyString(entry.platform);
