import React from 'react';
import { Shield } from 'lucide-react';
import { InventoryComponent, PCBuild, TransactionLogItem } from '../../types';
import { usePrivacy } from '../../context/PrivacyContext';
import {
  formatCurrency,
  getCategoryPresentation,
  getConditionDotColor,
} from '../../utils/helpers';
import { getBuildPresentation } from '../../utils/buildPresentation';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatWarrantyLabel, getBuildWarrantyInfo } from '../../utils/warranty';
import { parseBatchItem } from './activityHelpers';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';
import { sortByCategory } from '../../utils/sorting';

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
  const fallbackItems = sortByCategory(
    (tx.detailsList || []).map((detail) => parseBatchItem(detail, components, tx)),
  );

  return (
    <div className="space-y-3">
      <div className="app-ledger grid grid-cols-2 sm:grid-cols-4">
        <div className="bg-[#0b1113] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Sale Price</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-[#62E6E6]">{formatCurrency(salePrice)}</div>
        </div>
        <div className="bg-[#0b1113] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Build Cost</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">{formatCurrency(partsCost)}</div>
        </div>
        <div className="bg-[#0b1113] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Net Profit</div>
          <div className={`mt-0.5 font-mono text-sm font-bold ${getProfitTextColor(netProfit)}`}>{formatSignedCurrency(netProfit)}</div>
        </div>
        <div className="bg-[#0b1113] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Profit Margin</div>
          <div className={`mt-0.5 font-mono text-sm font-bold ${getProfitTextColor(profitMarginPercent)}`}>{profitMarginPercent.toFixed(1)}%</div>
        </div>
      </div>

      {tx.tradeInCredit !== undefined && tx.tradeInCredit > 0 && (
        <div className="border-l-2 border-[#62E6E6] bg-[#62E6E6]/[0.05] px-3 py-2 text-[11px] text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="font-semibold uppercase tracking-[0.12em] text-[#9FF8F4]">Trade-in included</span>
            <span className="font-mono text-zinc-100">Effective sale {formatCurrency(salePrice)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-zinc-400">
            <span>Cash {formatCurrency(tx.cashPortion ?? 0)}</span>
            <span>·</span>
            <span>Valuation {formatCurrency(tx.tradeInCredit)}</span>
            {tx.tradeInDescription && <><span>·</span><span>{tx.tradeInDescription}</span></>}
          </div>
        </div>
      )}

      <div className="app-ledger grid grid-cols-2 text-xs sm:grid-cols-4">
        {platform && (
          <div className="bg-[#0b1113] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Platform</div>
            <div className="mt-0.5 truncate text-zinc-200">{normalizePlatform(platform)}</div>
          </div>
        )}
        {paymentMethod && (
          <div className="bg-[#0b1113] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Payment</div>
            <div className="mt-0.5 truncate text-zinc-200">{paymentMethod}</div>
          </div>
        )}
        {buyerName && (
          <div className="bg-[#0b1113] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Buyer</div>
            <div className="mt-0.5 truncate text-zinc-200">{buyerName}</div>
          </div>
        )}
        <div className="bg-[#0b1113] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Sale Date</div>
          <div className="mt-0.5 truncate font-mono text-zinc-200">{saleDate || 'N/A'}</div>
        </div>
      </div>

      {(() => {
        const warrantyDays = tx.warrantyDaysAtSale ?? matchedBuild?.warrantyDays ?? 30;
        const warrantyInfo = getBuildWarrantyInfo(saleDate, new Date(), warrantyDays);
        if (!warrantyInfo) return null;
        return (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[10px] font-mono font-medium ${
            warrantyInfo.isActive
              ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'
              : 'border-rose-500/25 bg-rose-500/[0.06] text-rose-300'
          }`}>
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />{formatWarrantyLabel(warrantyDays)}</span>
            <span>{warrantyInfo.isActive ? `${warrantyInfo.daysLeft} days remaining` : `Expired ${warrantyInfo.expiryFormatted}`}</span>
          </div>
        );
      })()}

      <section className="pt-1">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <span>Build components</span>
          <span className="font-mono text-zinc-500">{presentation ? presentation.totalQuantity : fallbackItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
        </div>

        <div className="app-ledger rounded-t-none border-t-0">
          {presentation ? presentation.allComponents.map((part, partIdx) => {
            const comp = part.originalComponentId ? components.find((candidate) => candidate.id === part.originalComponentId) : null;
            let purchaseEntry = comp?.purchaseHistory?.find((entry) => entry.id === part.originalPurchaseEntryId);
            if (!purchaseEntry && comp?.purchaseHistory?.length) {
              purchaseEntry = comp.purchaseHistory.find((entry) => entry.unitPrice === part.unitCost) || comp.purchaseHistory[0];
            }
            const category = getCategoryPresentation(part.category);
            const unitCost = purchaseEntry?.unitPrice ?? part.unitCost;
            const source = part.source === 'PURCHASED_BASE'
              ? 'Purchased PC base'
              : part.source === 'TRADE_IN_BASE'
                ? 'Trade-in base'
                : '';

            return (
              <div key={part.id || `${part.category}-${part.name}-${partIdx}`} className="relative grid grid-cols-[3.8rem_minmax(0,1fr)_auto] gap-2 border-b border-white/[0.06] px-2.5 py-2.5 last:border-b-0">
                <span className={`pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${category.textClass}`}>{category.label}</span>
                <div className="min-w-0">
                  <div className="break-words text-xs font-medium leading-snug text-zinc-100">{part.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] text-zinc-500">
                    {purchaseEntry ? (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(purchaseEntry.condition)}`} />
                        <span>{purchaseEntry.condition}</span>
                        {!hideSupplierNames && purchaseEntry.platform && <><span>·</span><span>{normalizePlatform(String(purchaseEntry.platform))}</span></>}
                        <span>·</span><span>{purchaseEntry.paymentMethod}</span>
                        <span>·</span><span>{purchaseEntry.date}</span>
                      </>
                    ) : source ? <span>{source}</span> : null}
                    {part.tags?.length ? <><span>·</span><span>{part.tags.join(' · ')}</span></> : null}
                    {part.quantity > 1 && <><span>·</span><span>{part.quantity} × {formatCurrency(unitCost)} each</span></>}
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-zinc-100">{formatCurrency(part.quantity * unitCost)}</span>
                <span className={`absolute inset-y-2 right-0 w-0.5 rounded-full ${category.railClass}`} />
              </div>
            );
          }) : fallbackItems.length > 0 ? fallbackItems.map((item, idx) => {
            const category = getCategoryPresentation(item.category);
            return (
              <div key={`${item.itemName}-${idx}`} className="relative grid grid-cols-[3.8rem_minmax(0,1fr)_auto] gap-2 border-b border-white/[0.06] px-2.5 py-2.5 last:border-b-0">
                <span className={`pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${category.textClass}`}>{category.label}</span>
                <div className="min-w-0">
                  <div className="break-words text-xs font-medium leading-snug text-zinc-100">{item.itemName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] text-zinc-500">
                    {item.condition && <><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(item.condition)}`} /><span>{item.condition}</span></>}
                    {!hideSupplierNames && item.platform && <><span>·</span><span>{normalizePlatform(item.platform)}</span></>}
                    {item.tags.length > 0 && <><span>·</span><span>{item.tags.join(' · ')}</span></>}
                    {item.quantity > 1 && item.unitPrice > 0 && <><span>·</span><span>{item.quantity} × {formatCurrency(item.unitPrice)} each</span></>}
                  </div>
                </div>
                {item.totalPrice > 0 && <span className="font-mono text-xs font-bold text-zinc-100">{formatCurrency(item.totalPrice)}</span>}
                <span className={`absolute inset-y-2 right-0 w-0.5 rounded-full ${category.railClass}`} />
              </div>
            );
          }) : (
            <div className="p-3 text-center text-xs italic text-zinc-500">No component details logged.</div>
          )}
        </div>
      </section>
    </div>
  );
};
