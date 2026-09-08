import React from 'react';
import { ExtractedPartInput } from './dismantleHelpers';
import { formatCurrency } from '../../../utils/helpers';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface ModeBStatusHeaderProps {
  targetCost: number;
  totalAllocated: number;
  remainingBalance: number;
  isExactMatch: boolean;
  lockedParts: ExtractedPartInput[];
  unlockedParts: ExtractedPartInput[];
  lockedNamesSummary: string;
  handleAutoDistribute: () => void;
}

export const ModeBStatusHeader: React.FC<ModeBStatusHeaderProps> = ({
  targetCost,
  totalAllocated,
  remainingBalance,
  isExactMatch,
  lockedParts,
  unlockedParts,
  lockedNamesSummary,
  handleAutoDistribute,
}) => {
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#121722] border border-white/[0.08] rounded-xl text-xs">
        <div>
          <div className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider font-sans">Target Value</div>
          <div className="text-xs sm:text-sm font-bold font-mono text-zinc-100 mt-0.5">
            {formatCurrency(targetCost)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider font-sans">Total Allocated</div>
          <div
            className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
              isExactMatch ? 'text-emerald-400' : 'text-[#9D91FA]'
            }`}
          >
            {formatCurrency(totalAllocated)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider font-sans flex items-center justify-between">
            <span>Remaining</span>
            {lockedParts.length > 0 && (
              <span className="text-[9px] text-[#9D91FA] font-mono lowercase">
                {lockedParts.length} locked
              </span>
            )}
          </div>
          <div
            className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
              isExactMatch
                ? 'text-emerald-400'
                : remainingBalance < 0
                ? 'text-rose-400'
                : 'text-[#9D91FA]'
            }`}
          >
            {remainingBalance < 0
              ? `-${formatCurrency(Math.abs(remainingBalance))}`
              : formatCurrency(remainingBalance)}
          </div>
        </div>
      </div>

      {!isExactMatch ? (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#7C6CF2]/10 border border-[#7C6CF2]/25 text-xs text-zinc-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#7C6CF2]" />
            <div className="min-w-0">
              {unlockedParts.length === 0 ? (
                <span className="text-[11px] sm:text-xs text-zinc-300">
                  All parts locked. Unlock at least one part to auto-distribute balance.
                </span>
              ) : lockedParts.length > 0 ? (
                <div className="text-[11px] sm:text-xs truncate">
                  <span>
                    Re-distribute {remainingBalance > 0 ? 'remaining ' : 'balance '}
                    <span className="font-mono font-bold text-[#9D91FA]">
                      {remainingBalance < 0
                        ? `-${formatCurrency(Math.abs(remainingBalance))}`
                        : formatCurrency(remainingBalance)}
                    </span>{' '}
                    across {unlockedParts.length} unlocked {unlockedParts.length === 1 ? 'part' : 'parts'}
                  </span>
                  <span className="text-zinc-400 block text-[10px] truncate">
                    (keeping {lockedNamesSummary} fixed)
                  </span>
                </div>
              ) : (
                <span className="truncate text-[11px] sm:text-xs text-zinc-300">
                  {remainingBalance > 0
                    ? `Allocate remaining ${formatCurrency(remainingBalance)} across parts`
                    : `Over-allocated by ${formatCurrency(Math.abs(remainingBalance))}`}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoDistribute}
            disabled={unlockedParts.length === 0}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
              unlockedParts.length > 0
                ? 'bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white shadow-sm shadow-[#7C6CF2]/20 cursor-pointer'
                : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06] cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {lockedParts.length > 0 ? 'Re-Distribute' : 'Auto-Distribute'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] sm:text-xs truncate">
              Exact target valuation matched!
              {lockedParts.length > 0 && (
                <span className="text-emerald-400/80 text-[10px] ml-1">
                  ({lockedParts.length} custom locked)
                </span>
              )}
            </span>
          </div>
          {unlockedParts.length > 0 && (
            <button
              type="button"
              onClick={handleAutoDistribute}
              className="text-[11px] text-zinc-400 hover:text-white underline font-mono shrink-0 ml-1"
              title="Recalculate weighted distribution for unlocked items"
            >
              Re-Distribute
            </button>
          )}
        </div>
      )}
    </div>
  );
};
