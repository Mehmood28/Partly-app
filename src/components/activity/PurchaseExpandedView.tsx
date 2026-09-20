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
  matchedComp?: InventoryComponent;
  purchasedBuild?: PCBuild;
  components: InventoryComponent[];
}

export const PurchaseExpandedView: React.FC<PurchaseExpandedViewProps> = ({ tx, isBulkPurchase, matchedComp, purchasedBuild, components }) => {
  const { hideSupplierNames } = usePrivacy();
  // A purchased PC can later be parted out to Stock. Those entries preserve the
  // original purchase transaction, so prefer them for the purchase ledger. If
  // it has not been parted out yet, fall back to the immutable PC breakdown.
  const partedOutItems = purchasedBuild
    ? components.flatMap((component) => component.purchaseHistory
      .filter((entry) =>
        entry.sourcePurchaseTransactionId === tx.id ||
        entry.sourcePurchasedBuildId === purchasedBuild.id ||
        entry.notes?.includes(`purchased PC: ${purchasedBuild.name}`)
      )
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
  const purchasedItems = sortByCategory(partedOutItems.length > 0 ? partedOutItems : acquisitionItems.length > 0 ? acquisitionItems : detailItems);
  return (
    <div className="record-detail purchase-expanded-detail space-y-4">
      {purchasedItems.length > 0 ? <section>
        <h4>Purchase items <span>· {purchasedItems.length} {purchasedItems.length === 1 ? 'item' : 'items'}</span></h4>
        <div className="purchase-items">
          <div className="purchase-item-head"><span>Item / details</span><span>Qty</span><span>Unit price</span><span>Payment</span></div>
          {purchasedItems.map((item, index) => <div key={index} className="purchase-item">
            <div className="purchase-item-name"><strong>{item.itemName}</strong><span>{[
              ...(item.tags || []),
              (isBulkPurchase || purchasedBuild) ? item.condition : undefined,
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
