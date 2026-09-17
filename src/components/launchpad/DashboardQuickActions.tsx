import React from 'react';
import { Plus, Hammer, Sparkles, Package, ArrowRight } from 'lucide-react';

interface DashboardQuickActionsProps {
  onOpenAddComponent?: () => void;
  onOpenAddBuild: () => void;
  onOpenBulkEntry?: () => void;
  onNavigateToStock: () => void;
  onNavigateToBuilds: () => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onOpenAddComponent,
  onOpenAddBuild,
  onOpenBulkEntry,
  onNavigateToStock,
}) => {
  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#A3FF12]" />
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.08] border border-white/[0.08] rounded-lg overflow-hidden">
        {/* Add Build Action */}
        <button
          type="button"
          onClick={() => onOpenAddBuild()}
          className="min-h-11 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#A3FF12] hover:bg-[#C2FF5C] text-[#11150C] text-xs font-bold transition-colors group"
        >
          <Hammer className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span>New PC Build</span>
        </button>

        {/* Add Component Action */}
        <button
          type="button"
          onClick={() => onOpenAddComponent && onOpenAddComponent()}
          className="min-h-11 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#10141E] hover:bg-[#171D29] text-zinc-100 text-xs font-medium transition-colors group"
        >
          <Plus className="w-3.5 h-3.5 text-[#A3FF12] group-hover:scale-110 transition-transform" />
          <span>Add Component</span>
        </button>

        {/* AI Bulk Stock Entry */}
        {onOpenBulkEntry && (
          <button
            type="button"
            onClick={onOpenBulkEntry}
            className="min-h-11 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#10141E] hover:bg-[#171D29] text-zinc-100 text-xs font-medium transition-colors group"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#67E8F9] group-hover:scale-110 transition-transform" />
            <span>AI Bulk Import</span>
          </button>
        )}

        {/* View All Inventory */}
        <button
          type="button"
          onClick={onNavigateToStock}
          className="min-h-11 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#10141E] hover:bg-[#171D29] text-zinc-300 hover:text-white text-xs font-medium transition-colors group"
        >
          <Package className="w-3.5 h-3.5 text-[#67E8F9] group-hover:scale-110 transition-transform" />
          <span>Inventory Stock</span>
          <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
};
