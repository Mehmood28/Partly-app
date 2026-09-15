import { TransactionLogItem, PCBuild } from '../types';

export interface TransactionClassification {
  isPCSale: boolean;
  isPartSale: boolean;
  isPurchase: boolean;
  isBuildAllocation: boolean;
  isBulkPurchase: boolean;
  isExchange: boolean;
}

export function classifyTransaction(
  tx: TransactionLogItem,
  builds: PCBuild[] = []
): TransactionClassification {
  const isExchange =
    tx.type === 'EXCHANGE' ||
    tx.exchangeType === 'TRADE_UP' ||
    (tx.title ? /^Trade Up:/i.test(tx.title) || /^Exchange:/i.test(tx.title) : false) ||
    tx.outgoingCostBasis !== undefined;

  const isPurchase = !isExchange && tx.type === 'PURCHASE';
  const isBuildAllocation = !isExchange && tx.type === 'BUILD_ALLOCATION';
  const isSale = !isExchange && tx.type === 'SALE';

  const isPCSale =
    isSale &&
    (!!(tx.relatedComponentId && builds.some((b) => b.id === tx.relatedComponentId)) ||
      (tx.title ? tx.title.startsWith('Sold (PC)') || tx.title.startsWith('PC Sold') : false) ||
      (tx.relatedComponentId ? tx.relatedComponentId.startsWith('build-') : false) ||
      (tx.detailsList ? tx.detailsList.length > 0 && tx.detailsList.some((d) => d && d.includes('x ')) : false));

  const isPartSale = isSale && !isPCSale;

  const detailCount = tx.detailsList?.filter((detail) => Boolean(detail?.trim())).length || 0;
  const declaredItemCount =
    Number.isFinite(tx.itemCount) && tx.itemCount > 0 ? tx.itemCount : 0;
  const explicitItemCount = Math.max(detailCount, declaredItemCount);
  const titleSuggestsBulk = Boolean(tx.title?.toLowerCase().startsWith('bulk'));

  const isBulkPurchase =
    isPurchase &&
    (explicitItemCount > 1 || (explicitItemCount === 0 && titleSuggestsBulk));

  return {
    isPCSale,
    isPartSale,
    isPurchase,
    isBuildAllocation,
    isBulkPurchase,
    isExchange,
  };
}
