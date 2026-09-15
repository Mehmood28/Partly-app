import React from 'react';
import { Store } from 'lucide-react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import { 
  formatCurrency, 
  getCategoryBadgeColor, 
  getTagBadgeColor, 
  getConditionColor, 
  getPlatformBadgeColor 
} from '../../utils/helpers';
import { renderCategoryIcon, parseBatchItem } from './activityHelpers';

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
  return (
    <div className="space-y-3">
      {/* Financial Metrics Row */}
      <div className={`grid gap-2 ${isBulkPurchase ? 'grid-cols-2' : tx.quantity && tx.quantity > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Total Spent</div>
          <div className="text-sm sm:text-base font-bold font-mono text-rose-400">{formatCurrency(tx.totalAmount)}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Quantity Purchased</div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#9D91FA]">
            {tx.purchaseKind === 'PC'
              ? `${purchasedQuantity} ${purchasedQuantity === 1 ? 'PC' : 'PCs'}`
              : `${purchasedQuantity} ${purchasedQuantity === 1 ? 'unit' : 'units'}`}
          </div>
        </div>
        {/* Show Unit Price only for single items with quantity > 1 of the same part */}
        {!isBulkPurchase && tx.quantity && tx.quantity > 1 && (
          <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08] col-span-2 sm:col-span-1">
            <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Unit Price</div>
            <div className="text-sm sm:text-base font-bold font-mono text-[#9D91FA]">
              {formatCurrency(tx.totalAmount / tx.quantity)}
            </div>
          </div>
        )}
      </div>

      {/* Batch Purchase Items List */}
      {tx.detailsList && tx.detailsList.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>{isBulkPurchase ? 'Batch Purchase Items' : 'Purchase Item'}</span>
            <span className="font-mono text-zinc-500">
              {tx.detailsList.length} {tx.detailsList.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="space-y-1.5">
            {tx.detailsList.map((detail, idx) => {
              const item = parseBatchItem(detail, components, tx);
              return (
                <div
                  key={idx}
                  className="bg-[#121722] border border-white/[0.08] rounded-xl p-2.5 flex items-start gap-2.5 text-xs shadow-sm"
                >
                  {/* Square Category Icon */}
                  <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {renderCategoryIcon(item.category)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Part Name & Total Price */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-100 break-words block leading-snug">
                        {item.itemName}
                      </span>
                      {item.totalPrice > 0 && (
                        <span className="font-mono font-medium text-[#9D91FA] shrink-0 ml-2">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      )}
                    </div>

                    {/* Badges & Details Row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 font-mono text-zinc-400">
                      {item.category && item.category !== 'Other' && (
                        <span className={`${getCategoryBadgeColor(item.category)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                          {item.category}
                        </span>
                      )}
                      {item.tags && item.tags.map((tag, tIdx) => (
                        <span key={tIdx} className={`${getTagBadgeColor(tag)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                          {tag}
                        </span>
                      ))}

                      {/* Quantity & Unit/Total Price Pills */}
                      {item.quantity === 1 ? (
                        <>
                          <span className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            Qty: 1
                          </span>
                          {item.unitPrice > 0 && (
                            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                              {formatCurrency(item.unitPrice)}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            Qty: {item.quantity}
                          </span>
                          {item.unitPrice > 0 && (
                            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                              {formatCurrency(item.unitPrice)}/ea
                            </span>
                          )}
                          {item.totalPrice > 0 && (
                            <span className="bg-[#7C6CF2]/20 text-[#9D91FA] border border-[#7C6CF2]/40 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                              {formatCurrency(item.totalPrice)} total
                            </span>
                          )}
                        </>
                      )}

                      {/* Condition Badge */}
                      {item.condition && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap ${getConditionColor(item.condition)}`}>
                          {item.condition.toUpperCase()}
                        </span>
                      )}

                      {/* Source / Platform */}
                      {!hideSupplierNames && item.platform && (
                        <span className={`${getPlatformBadgeColor(item.platform)} px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                          <Store className="w-2.5 h-2.5" /> {item.platform}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : matchedComp && (
        <div className="bg-[#121722] p-3 rounded-xl border border-white/[0.08] space-y-2">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Component Specs & Tags</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${getCategoryBadgeColor(matchedComp.category)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center`}>
              {matchedComp.category}
            </span>
            {matchedComp.tags?.map((t, idx) => (
              <span key={idx} className={`${getTagBadgeColor(t)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center`}>
                {t}
              </span>
            ))}
          </div>
          {matchedComp.specifications && typeof matchedComp.specifications === 'string' && (
            <div className="text-xs text-zinc-400 break-words">{matchedComp.specifications}</div>
          )}
        </div>
      )}
    </div>
  );
};
