import { PCBuild, PurchaseEntry, TransactionLogItem } from '../types';

export interface TradeInOrigin {
  buyerName?: string;
  date?: string;
  sourceSaleTransactionId: string;
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const resolveFromExactSource = (
  sourceSaleTransactionId: string | undefined,
  expectedTradeInBuildId: string | undefined,
  transactions: TransactionLogItem[],
  builds: PCBuild[]
): TradeInOrigin | null => {
  const normalizedSourceSaleTransactionId = nonEmptyString(sourceSaleTransactionId);
  const normalizedTradeInBuildId = nonEmptyString(expectedTradeInBuildId);
  const sourceSales = normalizedSourceSaleTransactionId
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
    builds
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
    builds
  );
};
