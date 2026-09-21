import React from 'react';
import { Sparkles, X, Hammer } from 'lucide-react';
import { RecommendedBuild } from './launchpadTypes';
import { sortByCategory } from '../../utils/sorting';
import { formatCurrency } from '../../utils/helpers';
import { formatSignedCurrency, getProfitBadgeClasses } from '../../utils/financialDisplay';
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
    <div className="app-panel space-y-3 p-3.5">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#B9EF68]/15 border border-[#B9EF68]/30">
            <Sparkles className="w-4 h-4 text-[#B9EF68]" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-100">
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
        <div className="flex items-start gap-2 border-y border-[#B9EF68]/20 bg-[#B9EF68]/[0.04] px-1 py-2.5 text-xs text-zinc-300">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#B9EF68]" />
          <p><span className="font-semibold text-[#B9EF68]">Synergy Note:</span> {customBuild.notes}</p>
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-zinc-100 leading-tight">
            {customBuild.name}
          </h3>
          <div className="shrink-0 text-[11px] font-medium text-[#83E5DF]">
            Custom request
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-mono font-medium text-zinc-300">
              Cost: {formatCurrency(customBuild.totalCost)}
            </span>
            <span className="text-[11px] font-mono font-medium text-[#83E5DF]">
              Value: {formatCurrency(customBuild.estimatedPrice)}
            </span>
            <span className={`${getProfitBadgeClasses(customBuild.projectedProfit)} bg-transparent border-0 p-0 text-[11px] font-mono font-medium`}>
              Profit: {formatSignedCurrency(customBuild.projectedProfit)} · Margin {Math.round(customBuild.margin)}%
            </span>
          </div>
          <button
            onClick={() => onStartBuild(customBuild)}
            className="app-button app-button-primary flex shrink-0 items-center justify-center gap-2 px-4"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Create PC Build</span>
          </button>
        </div>
      </div>
    </div>
  );
};
