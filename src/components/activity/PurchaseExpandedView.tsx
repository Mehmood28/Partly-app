import React from 'react';
import { InventoryComponent, PCBuild, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { sortByCategory } from '../../utils/sorting';
import { parseBatchItem } from './activityHelpers';

interface PurchaseExpandedViewProps {
  tx: TransactionLogItem;
  isBulkPurchase: boolean;
  isPCPurchase: boolean;
  matchedComp?: InventoryComponent;
  purchasedBuild?: PCBuild;
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

export const PurchaseExpandedView: React.FC<PurchaseExpandedViewProps> = ({ tx, isBulkPurchase, isPCPurchase, matchedComp, purchasedBuild, components }) => {
  const { hideSupplierNames } = usePrivacy();
  // A purchased PC can later be parted out to Stock. Those entries preserve the
  // original purchase transaction, so prefer them for the purchase ledger. If
  // it has not been parted out yet, fall back to the immutable PC breakdown.
  const purchaseNames = [
    purchasedBuild?.name,
    tx.itemNameOrSummary,
    tx.title?.replace(/^Purchased:\s*/i, ''),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  const hasExplicitBuildLink = !!tx.relatedComponentId?.trim();
  const sourceBuildId = purchasedBuild?.id;
  const canResolvePartedOutItems = !hasExplicitBuildLink || !!purchasedBuild;
  const partedOutItems = isPCPurchase && canResolvePartedOutItems
    ? components.flatMap((component) => component.purchaseHistory
      .filter((entry) => {
        const entrySourceTransactionId = entry.sourcePurchaseTransactionId?.trim();
        const entrySourceBuildId = entry.sourcePurchasedBuildId?.trim();
        if (entrySourceTransactionId || entrySourceBuildId) {
          const transactionMatches = !entrySourceTransactionId || entrySourceTransactionId === tx.id;
          const buildMatches = !entrySourceBuildId || (!!sourceBuildId && entrySourceBuildId === sourceBuildId);
          return transactionMatches && buildMatches;
        }
        return !!entry.notes && purchaseNames.some((name) =>
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
  const acquisitionItems = purchasedBuild?.acquisitionComponentBreakdown?.map((item) => ({
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
  const detailItems = (tx.detailsList || []).map((detail) => parseBatchItem(detail, components, tx));
  const purchaseDisplayItems: PurchaseDisplayItem[] = partedOutItems.length > 0
    ? partedOutItems
    : acquisitionItems.length > 0
      ? acquisitionItems
      : detailItems;
  const purchasedItems = sortByCategory(purchaseDisplayItems);
  return (
    <div className="record-detail purchase-expanded-detail space-y-4">
      {purchasedItems.length > 0 ? <section>
        <h4>Purchase items <span>· {purchasedItems.length} {purchasedItems.length === 1 ? 'item' : 'items'}</span></h4>
        <div className="purchase-items">
          <div className="purchase-item-head"><span>Item / details</span><span>Qty</span><span>Unit price</span><span>Payment</span></div>
          {purchasedItems.map((item, index) => <div key={index} className="purchase-item">
            <div className="purchase-item-name"><strong>{item.itemName}</strong><span>{[
              ...(item.tags || []),
              (isBulkPurchase || isPCPurchase) ? item.condition : undefined,
              !hideSupplierNames && item.platform ? normalizePlatform(item.platform) : undefined,
            ].filter(Boolean).join(' · ')}</span></div>
            <div data-label="Qty">{item.quantity}</div>
            <div data-label="Unit price">{formatCurrency(item.unitPrice)}</div>
            <div data-label="Payment">{item.paymentMethod || tx.paymentMethod || '—'}</div>
          </div>)}
        </div>
      </section> : matchedComp ? <section><h4>Purchased component</h4><p className="text-zinc-100">{matchedComp.name}</p><p>{[matchedComp.category, ...(matchedComp.tags || [])].join(' · ')}</p></section> : null}
      {tx.notes && <dl className="purchase-record-details detail-list"><div><dt>Notes</dt><dd>{tx.notes}</dd></div></dl>}
    </div>
  );
};
