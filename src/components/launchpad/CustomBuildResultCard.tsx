import React from 'react';
import { Sparkles, X, Hammer } from 'lucide-react';
import { RecommendedBuild } from './launchpadTypes';
import { sortByCategory } from '../../utils/sorting';
import { formatCurrency } from '../../utils/helpers';
import { getCategoryIcon } from './launchpadHelpers';

interface CustomBuildResultCardProps {
  customBuild: RecommendedBuild;
  onDismiss: () => void;
  onStartBuild: (build: RecommendedBuild) => void;
}

export const CustomBuildResultCard: React.FC<CustomBuildResultCardProps> = ({
  customBuild,
  onDismiss,
  onStartBuild,
}) => {
  return (
    <div className="bg-[#0D1118] border border-[#7C6CF2]/40 rounded-xl p-3.5 space-y-3 shadow-lg shadow-[#7C6CF2]/5">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30">
            <Sparkles className="w-4 h-4 text-[#7C6CF2]" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
            Custom AI Recommendation
          </h4>
        </div>
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-white p-1 hover:bg-white/[0.06] rounded-lg transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {customBuild.notes && (
        <div className="bg-[#7C6CF2]/10 border border-[#7C6CF2]/20 text-[#9D91FA] flex items-start gap-2 p-2.5 rounded-lg text-xs">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#7C6CF2]" />
          <p><span className="font-semibold text-[#7C6CF2]">Synergy Note:</span> {customBuild.notes}</p>
        </div>
      )}

      <div className="bg-[#121722] border border-white/[0.08] rounded-xl p-3.5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-zinc-100 leading-tight">
            {customBuild.name}
          </h3>
          <div className="bg-[#7C6CF2]/20 text-[#9D91FA] border border-[#7C6CF2]/40 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
            CUSTOM REQUEST
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-3.5">
          {sortByCategory(customBuild.parts).map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs text-zinc-300 leading-tight">
              {getCategoryIcon(p.category)}
              <span className="break-words font-medium">{p.name}</span>
            </div>
          ))}
        </div>
        
        <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-hide">
            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] gap-1 shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              Cost: {formatCurrency(customBuild.totalCost)}
            </span>
            <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 gap-1 shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              Value: {formatCurrency(customBuild.estimatedPrice)}
            </span>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 gap-1 shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              Profit: +{formatCurrency(customBuild.projectedProfit)} ({Math.round(customBuild.margin)}%)
            </span>
          </div>
          <button
            onClick={() => onStartBuild(customBuild)}
            className="flex items-center justify-center gap-2 bg-[#7C6CF2] hover:bg-[#6C5CE7] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-sm shadow-[#7C6CF2]/20"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Create PC Build</span>
          </button>
        </div>
      </div>
    </div>
  );
};
