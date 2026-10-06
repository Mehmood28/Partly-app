import React from 'react';
import { InventoryComponent, PCBuild, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatCurrency, roundToCents } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { sortByCategory } from '../../utils/sorting';
import { parseBatchItem } from './activityHelpers';

interface PurchaseExpandedViewProps {
  tx: TransactionLogItem;
  isBulkPurchase: boolean;
  isPCPurchase: boolean;
  matchedComp?: InventoryComponent;
  purchasedBuild?: PCBuild;
  hasConflictingLiveBuildLinks?: boolean;
  components: InventoryComponent[];
}

interface PurchaseDisplayItem {
  category: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tags: string[];
  condition?: string;
  platform?: string;
  paymentMethod?: string;
}

export const PurchaseExpandedView: React.FC<PurchaseExpandedViewProps> = ({ tx, isPCPurchase, matchedComp, purchasedBuild, hasConflictingLiveBuildLinks = false, components }) => {
  const { hideSupplierNames } = usePrivacy();
  // A purchased PC can later be parted out to Stock. Those entries preserve the
  // original purchase transaction, so prefer them for the purchase ledger. If
  // it has not been parted out yet, fall back to the immutable PC breakdown.
  const purchaseNames = [
    purchasedBuild?.name,
    tx.itemNameOrSummary,
    tx.title?.replace(/^Purchased:\s*/i, ''),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  const sourceBuildId = tx.relatedComponentId?.trim() || purchasedBuild?.id;
  const orphanedBuild = !!sourceBuildId && !purchasedBuild;
  const partedOutItems: PurchaseDisplayItem[] = isPCPurchase && !hasConflictingLiveBuildLinks
    ? components.flatMap((component) => component.purchaseHistory
      .filter((entry) => {
        const entrySourceTransactionId = entry.sourcePurchaseTransactionId?.trim();
        const entrySourceBuildId = entry.sourcePurchasedBuildId?.trim();
        if (entrySourceTransactionId || entrySourceBuildId) {
          // Without the build, a transaction ID is required to distinguish its
          // entries from stock linked only to a rejected or stale build ID.
          if (orphanedBuild && !entrySourceTransactionId) return false;
          const transactionMatches = !entrySourceTransactionId || entrySourceTransactionId === tx.id;
          const buildMatches = !entrySourceBuildId || (!!sourceBuildId && entrySourceBuildId === sourceBuildId);
          return transactionMatches && buildMatches;
        }
        return !orphanedBuild && !!entry.notes && purchaseNames.some((name) =>
          entry.notes!.toLowerCase().includes(`purchased pc: ${name}`)
        );
      })
      .map((entry) => ({
        category: component.category,
        itemName: component.name,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        tags: component.tags || [],
        condition: entry.condition,
        platform: entry.platform,
        paymentMethod: entry.paymentMethod,
      })))
    : [];
  const acquisitionItems: PurchaseDisplayItem[] = purchasedBuild?.acquisitionComponentBreakdown?.map((item) => ({
    category: item.category,
    itemName: item.name,
    quantity: item.quantity,
    unitPrice: item.unitCost,
    totalPrice: item.quantity * item.unitCost,
    tags: item.tags || [],
    condition: undefined,
    platform: tx.platform,
    paymentMethod: tx.paymentMethod,
  })) || [];
  const rawDetailItems = (tx.detailsList || []).map((detail) => parseBatchItem(detail, components, tx));
  let detailItems = rawDetailItems;
  if (
    tx.type === 'PURCHASE' &&
    rawDetailItems.length > 1 &&
    typeof tx.totalAmount === 'number' &&
    tx.totalAmount >= 0
  ) {
    const rawSum = rawDetailItems.reduce((sum, d) => sum + ((d.quantity || 1) * d.unitPrice), 0);
    if (rawSum > 0 && Math.abs(rawSum - tx.totalAmount) >= 0.02) {
      const ratio = tx.totalAmount / rawSum;
      detailItems = rawDetailItems.map((d) => {
        const qty = d.quantity || 1;
        const unit = roundToCents(d.unitPrice * ratio);
        const sub = roundToCents(qty * unit);
        return {
          ...d,
          unitPrice: unit,
          totalPrice: sub,
        };
      });
    }
  }
  const fallbackSingleItems: PurchaseDisplayItem[] = (partedOutItems.length === 0 && acquisitionItems.length === 0 && detailItems.length === 0 && matchedComp)
    ? [{
        category: matchedComp.category,
        itemName: matchedComp.name,
        quantity: tx.quantity || tx.relatedComponentQty || 1,
        unitPrice: (tx.quantity && tx.quantity > 0 && tx.totalAmount !== undefined) ? (tx.totalAmount / tx.quantity) : (tx.totalAmount || 0),
        totalPrice: tx.totalAmount || 0,
        tags: matchedComp.tags || [],
        condition: tx.originalPurchaseEntrySnapshot?.condition || matchedComp.purchaseHistory?.[0]?.condition,
        platform: tx.platform,
        paymentMethod: tx.paymentMethod,
      }]
    : [];
  const pcCombinedItems = isPCPurchase
    ? [...acquisitionItems, ...partedOutItems]
    : [];

  const purchaseDisplayItems: PurchaseDisplayItem[] = isPCPurchase && pcCombinedItems.length > 0
    ? pcCombinedItems
    : partedOutItems.length > 0
      ? partedOutItems
      : acquisitionItems.length > 0
        ? acquisitionItems
        : detailItems.length > 0
          ? detailItems
          : fallbackSingleItems;

  const isSplitPC = isPCPurchase && acquisitionItems.length > 0 && partedOutItems.length > 0;
  const sortedInBuild = sortByCategory(acquisitionItems);
  const sortedPartedOut = sortByCategory(partedOutItems);
  const sortedAllPurchased = sortByCategory(purchaseDisplayItems);

  const renderPartsTable = (title: string, items: PurchaseDisplayItem[]) => (
    <section>
      <h4>{title} <span>· {items.length} {items.length === 1 ? 'part' : 'parts'}</span></h4>
      <div className="purchase-items">
        <div className="purchase-item-head"><span>Part / details</span><span className="text-right">Qty</span><span className="text-right">Unit price</span></div>
        {items.map((item, index) => (
          <div key={index} className="purchase-item">
            <div className="purchase-item-name">
              <strong>{item.itemName}</strong>
              <span>{[
                ...(item.tags || []),
                item.condition,
                !hideSupplierNames && item.platform ? normalizePlatform(item.platform) : undefined,
              ].filter(Boolean).join(' · ')}</span>
            </div>
            <div data-label="Qty" className="text-right font-mono">{item.quantity}</div>
            <div data-label="Unit price" className="text-right font-mono">{formatCurrency(item.unitPrice)}</div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="record-detail purchase-expanded-detail flex flex-col gap-2.5">
      {isSplitPC ? (
        <>
          {renderPartsTable('Parts in Build', sortedInBuild)}
          {renderPartsTable('Parted Out Parts', sortedPartedOut)}
        </>
      ) : sortedAllPurchased.length > 0 ? (
        renderPartsTable('Purchased parts', sortedAllPurchased)
      ) : matchedComp ? (
        <section>
          <h4>Purchased part</h4>
          <p className="text-zinc-100">{matchedComp.name}</p>
          <p>{[matchedComp.category, ...(matchedComp.tags || [])].join(' · ')}</p>
        </section>
      ) : null}
      {tx.notes && (
        <dl className="purchase-record-details detail-list">
          <div><dt>Notes</dt><dd>{tx.notes}</dd></div>
        </dl>
      )}
    </div>
  );
};
