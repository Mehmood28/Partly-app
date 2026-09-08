import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { 
  formatCurrency, 
  getCategoryBadgeColor, 
  getTagBadgeColor 
} from '../../utils/helpers';
import { TrendingUp, ArrowRight, CornerDownRight } from 'lucide-react';

interface TradeUpExpandedViewProps {
  tx: TransactionLogItem;
  outgoingCostBasis: number;
  cashPaidOnTop: number;
  incomingCostBasis: number;
  matchedOutgoingComp?: InventoryComponent;
  matchedIncomingComp?: InventoryComponent;
}

export const TradeUpExpandedView: React.FC<TradeUpExpandedViewProps> = ({
  tx,
  outgoingCostBasis,
  cashPaidOnTop,
  incomingCostBasis,
  matchedOutgoingComp,
  matchedIncomingComp,
}) => {
  return (
    <div className="space-y-3">
      {/* 3-Column Metric Blocks for Trade Basis Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5 font-sans">
            Outgoing Cost Basis
          </div>
          <div className="text-sm sm:text-base font-bold text-zinc-200">
            {formatCurrency(outgoingCostBasis)}
          </div>
        </div>

        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5 font-sans">
            Cash Paid on Top
          </div>
          <div className="text-sm sm:text-base font-bold text-amber-400">
            +{formatCurrency(cashPaidOnTop)}
          </div>
        </div>

        <div className="bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/30">
          <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider mb-0.5 font-sans">
            Incoming Cost Basis
          </div>
          <div className="text-sm sm:text-base font-bold text-cyan-300">
            {formatCurrency(incomingCostBasis)}
          </div>
        </div>
      </div>

      {/* Trade-Up Flow Visualizer Banner */}
      <div className="bg-zinc-950/50 border border-white/[0.08] rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exchange Audit Trail</span>
        </div>

        {tx.detailsList && tx.detailsList.length > 0 ? (
          <div className="space-y-1 pl-1">
            {tx.detailsList.map((detail, idx) => (
              <div key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                <CornerDownRight className="w-3 h-3 text-cyan-400/70 shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] sm:text-xs">{detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono flex-wrap">
            <span>{tx.itemNameOrSummary || tx.title}</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">{formatCurrency(incomingCostBasis)} Basis</span>
          </div>
        )}

        {tx.notes && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] text-xs text-zinc-400">
            <span className="text-zinc-500 font-medium">Notes: </span>
            <span>{tx.notes}</span>
          </div>
        )}
      </div>

      {/* Linked Components Details if Available */}
      {(matchedOutgoingComp || matchedIncomingComp) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {matchedOutgoingComp && (
            <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/50 space-y-1.5">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider font-sans">
                Outgoing Component Specs
              </div>
              <div className="text-xs font-medium text-zinc-200">{matchedOutgoingComp.name}</div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`${getCategoryBadgeColor(matchedOutgoingComp.category)} px-1.5 py-0.5 rounded text-[9px] font-mono uppercase`}>
                  {matchedOutgoingComp.category}
                </span>
                {matchedOutgoingComp.tags?.map((t, idx) => (
                  <span key={idx} className={`${getTagBadgeColor(t)} px-1.5 py-0.5 rounded text-[9px] font-mono uppercase`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {matchedIncomingComp && (
            <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/50 space-y-1.5">
              <div className="text-[10px] text-cyan-500 font-medium uppercase tracking-wider font-sans">
                Incoming Component Specs
              </div>
              <div className="text-xs font-medium text-cyan-200">{matchedIncomingComp.name}</div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`${getCategoryBadgeColor(matchedIncomingComp.category)} px-1.5 py-0.5 rounded text-[9px] font-mono uppercase`}>
                  {matchedIncomingComp.category}
                </span>
                {matchedIncomingComp.tags?.map((t, idx) => (
                  <span key={idx} className={`${getTagBadgeColor(t)} px-1.5 py-0.5 rounded text-[9px] font-mono uppercase`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
