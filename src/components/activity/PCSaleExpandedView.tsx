import React from 'react';
import { Store, CreditCard, User, Calendar, Shield } from 'lucide-react';
import { InventoryComponent, PCBuild, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import { 
  formatCurrency, 
  getCategoryBadgeColor, 
  getTagBadgeColor, 
  getConditionColor, 
  getPlatformBadgeColor 
} from '../../utils/helpers';
import { getBuildPresentation } from '../../utils/buildPresentation';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatWarrantyLabel, getBuildWarrantyInfo } from '../../utils/warranty';
import { renderCategoryIcon, parseBatchItem } from './activityHelpers';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface PCSaleExpandedViewProps {
  tx: TransactionLogItem;
  matchedBuild?: PCBuild;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  profitMarginPercent: number;
  platform?: string;
  paymentMethod?: string;
  buyerName?: string;
  saleDate?: string;
  components: InventoryComponent[];
}

export const PCSaleExpandedView: React.FC<PCSaleExpandedViewProps> = ({
  tx,
  matchedBuild,
  partsCost,
  salePrice,
  netProfit,
  profitMarginPercent,
  platform,
  paymentMethod,
  buyerName,
  saleDate,
  components,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const presentation = matchedBuild ? getBuildPresentation(matchedBuild, components) : null;

  return (
    <div className="space-y-3">
      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Sale Price</div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#67E8F9]">{formatCurrency(salePrice)}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Build Cost</div>
          <div className="text-sm sm:text-base font-bold font-mono text-zinc-300">{formatCurrency(partsCost)}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Net Profit</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(netProfit)}`}>{formatSignedCurrency(netProfit)}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5" title="Net profit divided by sale price">Profit Margin</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(profitMarginPercent)}`}>{profitMarginPercent.toFixed(1)}%</div>
        </div>
      </div>

      {/* Trade-In Breakdown Banner if present */}
      {tx.tradeInCredit !== undefined && tx.tradeInCredit > 0 && (
        <div className="bg-[#A3FF12]/15 border border-[#A3FF12]/30 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-[#A3FF12]/20 text-[#67E8F9] border border-[#A3FF12]/40 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider">
              Trade-In Included
            </span>
            <span className="text-zinc-300">
              Cash: <span className="font-mono font-semibold text-zinc-100">{formatCurrency(tx.cashPortion ?? 0)}</span> + Valuation: <span className="font-mono font-semibold text-[#67E8F9]">{formatCurrency(tx.tradeInCredit)}</span>
            </span>
            {tx.tradeInDescription && (
              <span className="text-xs text-zinc-300 font-medium">({tx.tradeInDescription})</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Total Effective: <span className="text-[#67E8F9] font-semibold">{formatCurrency(salePrice)}</span>
          </div>
        </div>
      )}

      {/* Metadata Badges & Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {platform && (
          <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
            <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-400" /> Platform
            </div>
            <div className="text-zinc-200 font-medium truncate font-mono text-xs">{normalizePlatform(platform)}</div>
          </div>
        )}
        {paymentMethod && (
          <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
            <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#A3FF12]" /> Payment
            </div>
            <div className="text-zinc-200 font-medium truncate font-mono text-xs">{paymentMethod}</div>
          </div>
        )}
        {buyerName && (
          <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
            <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#A3FF12]" /> Buyer
            </div>
            <div className="text-zinc-200 font-medium truncate text-xs">{buyerName}</div>
          </div>
        )}
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Sale Date
          </div>
          <div className="text-zinc-200 font-medium truncate font-mono text-xs">{saleDate || 'N/A'}</div>
        </div>
      </div>

      {/* Warranty Banner */}
      {(() => {
        const warrantyInfo = getBuildWarrantyInfo(saleDate, new Date(), tx.warrantyDaysAtSale ?? matchedBuild?.warrantyDays ?? 30);
        if (!warrantyInfo) return null;
        return (
          <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono font-medium ${
            warrantyInfo.isActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>{formatWarrantyLabel(tx.warrantyDaysAtSale ?? matchedBuild?.warrantyDays ?? 30)}</span>
            </div>
            <span>{warrantyInfo.isActive ? `ACTIVE (${warrantyInfo.daysLeft} DAYS REMAINING)` : `EXPIRED (${warrantyInfo.expiryFormatted})`}</span>
          </div>
        );
      })()}

      {/* Build Components Included */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          <span>Build Components Included</span>
          <span className="font-mono text-zinc-500">
            {presentation ? presentation.totalQuantity : (tx.detailsList?.length || 0)} parts
          </span>
        </div>

        <div className="space-y-1.5">
          {presentation ? (
            presentation.allComponents.map((part, partIdx) => {
              const comp = part.originalComponentId ? components.find(c => c.id === part.originalComponentId) : null;
              let purchaseEntry = comp?.purchaseHistory?.find(pe => pe.id === part.originalPurchaseEntryId);
              if (!purchaseEntry && comp?.purchaseHistory?.length) {
                purchaseEntry = comp.purchaseHistory.find(pe => pe.unitPrice === part.unitCost) || comp.purchaseHistory[0];
              }

              return (
                <div
                  key={part.id || `${part.category}-${part.name}-${partIdx}`}
                  className="bg-[#121722] border border-white/[0.08] rounded-xl p-2.5 flex items-start gap-2.5 text-xs shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#A3FF12]/15 border border-[#A3FF12]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {renderCategoryIcon(part.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-100 break-words block leading-snug">
                        {part.name}
                      </span>
                      <span className="font-mono font-medium text-[#67E8F9] shrink-0 ml-2">
                        {formatCurrency(part.quantity * (purchaseEntry ? purchaseEntry.unitPrice : part.unitCost))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 font-mono text-zinc-400">
                      <span className={`${getCategoryBadgeColor(part.category)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                        {part.category}
                      </span>
                      {part.source !== 'ALLOCATED_UPGRADE' ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                          {part.source === 'PURCHASED_BASE' ? 'PURCHASED PC BASE' : 'TRADE-IN BASE'}
                        </span>
                      ) : (
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                          UPGRADE
                        </span>
                      )}
                      {(part.tags || (comp?.tags && Array.isArray(comp.tags) ? comp.tags : []))?.map((tag, idx) => typeof tag === 'string' ? (
                        <span key={idx} className={`${getTagBadgeColor(tag)} px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                          {tag}
                        </span>
                      ) : null)}
                      {purchaseEntry && (
                        <>
                          <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            {purchaseEntry.date}
                          </span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap ${getConditionColor(purchaseEntry.condition)}`}>
                            {purchaseEntry.condition.toUpperCase()}
                          </span>
                          {!hideSupplierNames && purchaseEntry.platform && (
                            <span className={`${getPlatformBadgeColor(purchaseEntry.platform)} shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                              {String(purchaseEntry.platform)}
                            </span>
                          )}
                        </>
                      )}
                      <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                        {part.quantity > 1 
                          ? `${part.quantity}x ${formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCost)}/ea` 
                          : formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCost)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : tx.detailsList && tx.detailsList.length > 0 ? (
            tx.detailsList.map((detail, idx) => {
              const item = parseBatchItem(detail, components, tx);
              return (
                <div key={idx} className="bg-[#121722] border border-white/[0.08] rounded-xl p-2.5 flex items-start gap-2.5 text-xs shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-[#A3FF12]/15 border border-[#A3FF12]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {renderCategoryIcon(item.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-100 break-words block leading-snug">
                        {item.itemName}
                      </span>
                      {item.totalPrice > 0 && (
                        <span className="font-mono font-medium text-[#67E8F9] shrink-0 ml-2">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 font-mono text-zinc-400">
                      <span className="bg-[#A3FF12]/15 border border-[#A3FF12]/30 text-[#67E8F9] px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                        Qty: {item.quantity}
                      </span>
                      {item.unitPrice > 0 && (
                        <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                          {item.quantity > 1 ? `${formatCurrency(item.unitPrice)}/ea` : formatCurrency(item.unitPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-zinc-500 italic p-3 text-center bg-[#121722] rounded-xl border border-white/[0.08]">
              No part components details logged.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
