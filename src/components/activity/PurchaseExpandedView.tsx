import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { sortByCategory } from '../../utils/sorting';
import { parseBatchItem } from './activityHelpers';

interface PurchaseExpandedViewProps {
  tx: TransactionLogItem;
  isBulkPurchase: boolean;
  matchedComp?: InventoryComponent;
  components: InventoryComponent[];
}

export const PurchaseExpandedView: React.FC<PurchaseExpandedViewProps> = ({ tx, isBulkPurchase, matchedComp, components }) => {
  const { hideSupplierNames } = usePrivacy();
  const purchasedItems = sortByCategory((tx.detailsList || []).map(detail => parseBatchItem(detail, components, tx)));
  return (
    <div className="record-detail purchase-expanded-detail space-y-4">
      {purchasedItems.length > 0 ? <section>
        <h4>Purchase items <span>· {purchasedItems.length} {purchasedItems.length === 1 ? 'item' : 'items'}</span></h4>
        <div className="purchase-items">
          <div className="purchase-item-head"><span>Item / details</span><span>Qty</span><span>Unit price</span></div>
          {purchasedItems.map((item, index) => <div key={index} className="purchase-item">
            <div className="purchase-item-name"><strong>{item.itemName}</strong><span>{[
              ...(item.tags || []),
              isBulkPurchase ? item.condition : undefined,
              !hideSupplierNames && item.platform ? normalizePlatform(item.platform) : undefined,
              isBulkPurchase ? item.paymentMethod : undefined,
            ].filter(Boolean).join(' · ')}</span></div>
            <div data-label="Qty">{item.quantity}</div>
            <div data-label="Unit price">{formatCurrency(item.unitPrice)}</div>
          </div>)}
        </div>
      </section> : matchedComp ? <section><h4>Purchased component</h4><p className="text-zinc-100">{matchedComp.name}</p><p>{[matchedComp.category, ...(matchedComp.tags || [])].join(' · ')}</p></section> : null}
      {tx.notes && <dl className="purchase-record-details detail-list"><div><dt>Notes</dt><dd>{tx.notes}</dd></div></dl>}
    </div>
  );
};
