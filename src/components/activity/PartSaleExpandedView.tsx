import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import {
  formatCurrency,
  getCategoryPresentation,
} from '../../utils/helpers';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface PartSaleExpandedViewProps {
  tx?: TransactionLogItem;
  matchedComp?: InventoryComponent;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  profitMarginPercent: number;
}

export const PartSaleExpandedView: React.FC<PartSaleExpandedViewProps> = ({
  tx,
  matchedComp,
  partsCost,
  salePrice,
  netProfit,
  profitMarginPercent,
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.08] border border-white/[0.08] rounded-lg overflow-hidden">
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Sale Price</div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#67E8F9]">{formatCurrency(salePrice)}</div>
        </div>
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Unit Cost</div>
          <div className="text-sm sm:text-base font-bold font-mono text-zinc-300">{formatCurrency(partsCost)}</div>
        </div>
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Net Profit</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(netProfit)}`}>{formatSignedCurrency(netProfit)}</div>
        </div>
        <div className="p-2.5 bg-[#0D1118]">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Profit Margin</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(profitMarginPercent)}`}>{profitMarginPercent.toFixed(1)}%</div>
        </div>
      </div>

      {/* Trade-In Breakdown Banner if present */}
      {tx?.tradeInCredit !== undefined && tx.tradeInCredit > 0 && (
        <div className="bg-[#67E8F9]/[0.06] border border-[#67E8F9]/25 rounded-lg p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#A5F3FC] border border-[#67E8F9]/30 px-1.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider">
              Trade-In Included
            </span>
            <span className="text-zinc-300">
              Cash: <span className="font-mono font-semibold text-zinc-100">{formatCurrency(tx.cashPortion ?? 0)}</span> + Valuation: <span className="font-mono font-semibold text-[#A5F3FC]">{formatCurrency(tx.tradeInCredit)}</span>
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Total Effective: <span className="text-[#67E8F9] font-semibold">{formatCurrency(salePrice)}</span>
          </div>
        </div>
      )}

      {tx?.buyerName && (
        <div className="bg-[#0D1118] p-2.5 rounded-lg border border-white/[0.08] flex items-center justify-between text-xs">
          <span className="text-zinc-400">Buyer / Contact:</span>
          <span className="text-[#A5F3FC] font-medium">{tx.buyerName}</span>
        </div>
      )}

      {matchedComp && (
        <div className="relative grid grid-cols-[4.4rem_minmax(0,1fr)] gap-2 border-y border-white/[0.08] px-1 py-2.5">
          <span className={`pt-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${getCategoryPresentation(matchedComp.category).textClass}`}>
            {getCategoryPresentation(matchedComp.category).label}
          </span>
          <div className="min-w-0">
            <div className="break-words text-xs font-medium text-zinc-100">{matchedComp.name}</div>
            {matchedComp.tags?.length ? <div className="mt-1 font-mono text-[10px] text-zinc-500">{matchedComp.tags.join(' · ')}</div> : null}
          </div>
          <span className={`absolute inset-y-2 right-0 w-0.5 rounded-full ${getCategoryPresentation(matchedComp.category).railClass}`} />
        </div>
      )}
    </div>
  );
};
