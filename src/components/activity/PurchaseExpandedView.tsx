import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import {
  formatCurrency,
  getCategoryPresentation,
  getConditionDotColor,
} from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { sortByCategory } from '../../utils/sorting';
import { parseBatchItem } from './activityHelpers';

interface PurchaseExpandedViewProps {
  tx: TransactionLogItem;
  isBulkPurchase: boolean;
  matchedComp?: InventoryComponent;
  components: InventoryComponent[];
}

export const PurchaseExpandedView: React.FC<PurchaseExpandedViewProps> = ({
  tx,
  isBulkPurchase,
  matchedComp,
  components,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const purchasedQuantity = tx.quantity || tx.itemCount || tx.detailsList?.length || 1;
  const purchasedItems = sortByCategory(
    (tx.detailsList || []).map((detail) => parseBatchItem(detail, components, tx))
  );

  return (
    <div className="space-y-3">
      <div className={`grid gap-px bg-white/[0.08] border border-white/[0.08] rounded-lg overflow-hidden ${
        !isBulkPurchase && tx.quantity && tx.quantity > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
      }`}>
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Total Spent</div>
          <div className="mt-0.5 text-sm sm:text-base font-bold font-mono text-zinc-100">{formatCurrency(tx.totalAmount)}</div>
        </div>
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Quantity Purchased</div>
          <div className="mt-0.5 text-sm sm:text-base font-bold font-mono text-[#67E8F9]">
            {tx.purchaseKind === 'PC'
              ? `${purchasedQuantity} ${purchasedQuantity === 1 ? 'PC' : 'PCs'}`
              : `${purchasedQuantity} ${purchasedQuantity === 1 ? 'unit' : 'units'}`}
          </div>
        </div>
        {!isBulkPurchase && tx.quantity && tx.quantity > 1 && (
          <div className="p-2.5 bg-[#0D1118] col-span-2 sm:col-span-1">
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Unit Price</div>
            <div className="mt-0.5 text-sm sm:text-base font-bold font-mono text-[#67E8F9]">
              {formatCurrency(tx.totalAmount / tx.quantity)}
            </div>
          </div>
        )}
      </div>

      {purchasedItems.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">
            <span>{isBulkPurchase ? 'Batch purchase items' : 'Purchase item'}</span>
            <span className="font-mono">{purchasedItems.length} {purchasedItems.length === 1 ? 'item' : 'items'}</span>
          </div>

          <div className="overflow-hidden rounded-lg border-x border-white/[0.08]">
            {purchasedItems.map((item, idx) => {
              const category = getCategoryPresentation(item.category || 'Other');
              const metadata = [
                ...(item.tags || []),
                !hideSupplierNames && item.platform ? normalizePlatform(item.platform) : undefined,
              ].filter(Boolean) as string[];

              return (
                <div key={idx} className="relative border-b first:border-t border-white/[0.08] bg-[#0D1118] px-3 py-2.5 pr-4 text-xs">
                  <span className={`absolute right-1.5 top-2.5 bottom-2.5 w-0.5 ${category.railClass}`} />
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`w-[4.4rem] shrink-0 pt-0.5 font-mono text-[10px] font-bold tracking-wide ${category.textClass}`}>
                      {category.label}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-medium leading-snug text-zinc-100">{item.itemName}</span>
                    {item.totalPrice > 0 && (
                      <span className="shrink-0 whitespace-nowrap font-mono text-xs font-bold text-zinc-100">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    )}
                  </div>
                  <div className="ml-[4.9rem] mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] leading-snug text-zinc-500">
                    {item.condition && (
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(item.condition)}`} />
                        {item.condition}
                      </span>
                    )}
                    {metadata.map((value, metaIndex) => <span key={`${value}-${metaIndex}`}>· {value}</span>)}
                    {item.quantity > 1 ? (
                      <span>· {item.quantity} × {formatCurrency(item.unitPrice)} each</span>
                    ) : item.unitPrice > 0 && item.totalPrice <= 0 ? (
                      <span>· {formatCurrency(item.unitPrice)}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : matchedComp ? (
        <div className="border-y border-white/[0.08] py-2.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="w-[4.4rem] shrink-0 font-mono text-[10px] font-bold text-[#A5F3FC]">{matchedComp.category}</span>
            <span className="min-w-0 flex-1 break-words text-zinc-200">{matchedComp.name}</span>
          </div>
          {matchedComp.tags?.length ? (
            <div className="ml-[4.9rem] mt-1 font-mono text-[10px] text-zinc-500">{matchedComp.tags.join(' · ')}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
