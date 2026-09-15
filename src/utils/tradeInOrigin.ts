import { PCBuild, PurchaseEntry, TransactionLogItem } from '../types';

export interface TradeInOrigin {
  buyerName?: string;
  date?: string;
  sourceSaleTransactionId: string;
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const normalizeName = (value: unknown): string | undefined =>
  nonEmptyString(value)?.toLocaleLowerCase();

const transactionDate = (transaction: TransactionLogItem): string | undefined =>
  nonEmptyString(transaction.dateSortable) || nonEmptyString(transaction.timestamp);

const partedOutBuildName = (entry: PurchaseEntry): string | undefined => {
  const notes = nonEmptyString(entry.notes);
  if (!notes) return undefined;
  const match = notes.match(/^Parted out from traded-in PC:\s*(.+)$/i);
  return nonEmptyString(match?.[1]);
};

const resolveFromExactSource = (
  sourceSaleTransactionId: string | undefined,
  expectedTradeInBuildId: string | undefined,
  transactions: TransactionLogItem[],
  builds: PCBuild[],
  legacyHints?: { tradeInBuildName?: string; date?: string }
): TradeInOrigin | null => {
  const normalizedSourceSaleTransactionId = nonEmptyString(sourceSaleTransactionId);
  const normalizedTradeInBuildId = nonEmptyString(expectedTradeInBuildId);
  let sourceSales = normalizedSourceSaleTransactionId
    ? transactions.filter(
        (transaction) =>
          transaction.id === normalizedSourceSaleTransactionId && transaction.type === 'SALE'
      )
    : normalizedTradeInBuildId
    ? transactions.filter(
        (transaction) =>
          transaction.type === 'SALE' &&
          transaction.incomingTradeInBuildId === normalizedTradeInBuildId
        )
    : [];

  // Some older part-outs kept the incoming PC name/date but predate the immutable
  // sale link. Recover only a unique exact name + date match; never use this to
  // override a present (but invalid) source transaction ID.
  if (
    !normalizedSourceSaleTransactionId &&
    sourceSales.length === 0 &&
    normalizeName(legacyHints?.tradeInBuildName) &&
    nonEmptyString(legacyHints?.date)
  ) {
    const expectedName = normalizeName(legacyHints?.tradeInBuildName);
    const expectedDate = nonEmptyString(legacyHints?.date);
    sourceSales = transactions.filter(
      (transaction) =>
        transaction.type === 'SALE' &&
        normalizeName(transaction.tradeInBuildName) === expectedName &&
        transactionDate(transaction) === expectedDate
    );
  }

  if (sourceSales.length !== 1) return null;

  const sourceSale = sourceSales[0];
  if (
    normalizedTradeInBuildId &&
    sourceSale.incomingTradeInBuildId &&
    sourceSale.incomingTradeInBuildId !== normalizedTradeInBuildId
  ) {
    return null;
  }

  const linkedSoldBuilds = sourceSale.relatedComponentId
    ? builds.filter((build) => build.id === sourceSale.relatedComponentId)
    : [];
  const linkedSoldBuild = linkedSoldBuilds.length === 1 &&
    (!linkedSoldBuilds[0].saleTransactionId || linkedSoldBuilds[0].saleTransactionId === sourceSale.id)
      ? linkedSoldBuilds[0]
      : undefined;

  return {
    sourceSaleTransactionId: sourceSale.id,
    buyerName: nonEmptyString(sourceSale.buyerName) || nonEmptyString(linkedSoldBuild?.buyerName),
    date:
      nonEmptyString(sourceSale.dateSortable) ||
      nonEmptyString(sourceSale.timestamp) ||
      nonEmptyString(linkedSoldBuild?.saleDate),
  };
};

export const resolveTradeInBuildOrigin = (
  build: PCBuild,
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): TradeInOrigin | null => {
  if (build.acquisitionSource !== 'Trade-In') return null;
  return resolveFromExactSource(
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
  return resolveFromExactSource(
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
