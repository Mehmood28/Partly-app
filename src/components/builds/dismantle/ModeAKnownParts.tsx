import React from 'react';
import { PCBuild } from '../../../types';
import { formatCurrency, calculateBuildPartsCost } from '../../../utils/helpers';

interface ModeAKnownPartsProps {
  build: PCBuild;
}

export const ModeAKnownParts: React.FC<ModeAKnownPartsProps> = ({ build }) => {
  return (
    <div className="space-y-3">
      <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-medium font-sans">Build Inventory Parts:</span>
          <span className="font-mono text-zinc-200 font-semibold">{build.parts.length} Components</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/[0.06]">
          <span className="text-zinc-400 font-medium font-sans">Total Assembled Value:</span>
          <span className="font-mono text-[#62E6E6] font-bold text-sm">
            {formatCurrency(calculateBuildPartsCost(build))}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-zinc-300 px-1 font-sans">Parts to extract & return to stock:</div>
        <div className="space-y-1.5 rounded-xl border border-white/[0.08] p-2 bg-[#0B1113]">
          {build.parts.map((p, idx) => (
            <div
              key={`${p.componentId}-${idx}`}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#101719] border border-white/[0.06] text-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
                    {p.category}
                  </span>
                  <span className="font-medium text-zinc-200 truncate">{p.componentName}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                  Qty: {p.quantity} × {formatCurrency(p.unitCostAtAssignment)}
                </div>
              </div>
              <div className="font-mono font-semibold text-zinc-200 shrink-0">
                {formatCurrency(p.quantity * p.unitCostAtAssignment)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-300 bg-[#A8FF3E]/10 border border-[#A8FF3E]/20 rounded-xl p-3 leading-relaxed">
        Dismantling this rig will return all {build.parts.length} allocated parts back to their original
        inventory batches without altering their condition or cost basis.
      </p>
    </div>
  );
};
