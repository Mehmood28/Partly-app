import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { 
  formatCurrency, 
  getCategoryBadgeColor, 
  getTagBadgeColor 
} from '../../utils/helpers';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface PartSaleExpandedViewProps {
  tx?: TransactionLogItem;
  matchedComp?: InventoryComponent;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  roi: number;
}

export const PartSaleExpandedView: React.FC<PartSaleExpandedViewProps> = ({
  tx,
  matchedComp,
  partsCost,
  salePrice,
  netProfit,
  roi,
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Sale Price</div>
          <div className="text-sm sm:text-base font-bold font-mono text-amber-400">{formatCurrency(salePrice)}</div>
        </div>
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Unit Cost</div>
          <div className="text-sm sm:text-base font-bold font-mono text-zinc-300">{formatCurrency(partsCost)}</div>
        </div>
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Net Profit</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(netProfit)}`}>{formatSignedCurrency(netProfit)}</div>
        </div>
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Profit Margin</div>
          <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(roi)}`}>{roi.toFixed(1)}%</div>
        </div>
      </div>

      {/* Trade-In Breakdown Banner if present */}
      {tx?.tradeInCredit !== undefined && tx.tradeInCredit > 0 && (
        <div className="bg-purple-950/25 border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider">
              Trade-In Included
            </span>
            <span className="text-zinc-300">
              Cash: <span className="font-mono font-semibold text-zinc-100">{formatCurrency(tx.cashPortion ?? 0)}</span> + Valuation: <span className="font-mono font-semibold text-purple-300">{formatCurrency(tx.tradeInCredit)}</span>
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Total Effective: <span className="text-amber-400 font-semibold">{formatCurrency(salePrice)}</span>
          </div>
        </div>
      )}

      {tx?.buyerName && (
        <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800/60 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Buyer / Contact:</span>
          <span className="text-amber-400 font-medium">{tx.buyerName}</span>
        </div>
      )}

      {matchedComp && (
        <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/60 space-y-2">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Component Specs & Tags</div>
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
