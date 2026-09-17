import React from 'react';
import { Plus, Hammer, Sparkles, Database, ArrowRight } from 'lucide-react';

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
    <section className="app-section">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="app-section-kicker"><Sparkles /> Quick Actions</h3>
        <span className="hidden text-[10px] text-zinc-600 sm:block">Build. Stock. Automate.</span>
      </div>

      <div className="app-panel grid grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onOpenAddBuild()}
          className="group relative min-h-[132px] border-b border-r border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025] lg:border-b-0"
        >
          <Hammer className="h-5 w-5 text-[#A8FF3E]" />
          <ArrowRight className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#A8FF3E]" />
          <span className="mt-5 block text-[12px] font-bold text-zinc-100">New PC Build</span>
          <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">Create a custom PC build</span>
        </button>

        {/* Add Component Action */}
        <button
          type="button"
          onClick={() => onOpenAddComponent && onOpenAddComponent()}
          className="group relative min-h-[132px] border-b border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025] lg:border-b-0 lg:border-r"
        >
          <Plus className="h-5 w-5 text-[#62E6E6]" />
          <ArrowRight className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#62E6E6]" />
          <span className="mt-5 block text-[12px] font-bold text-zinc-100">Add Component</span>
          <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">Add one part to inventory</span>
        </button>

        {/* AI Bulk Stock Entry */}
        {onOpenBulkEntry && (
          <button
            type="button"
            onClick={onOpenBulkEntry}
            className="group relative min-h-[132px] border-r border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025]"
          >
            <Sparkles className="h-5 w-5 text-[#62E6E6]" />
            <ArrowRight className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#62E6E6]" />
            <span className="mt-5 block text-[12px] font-bold text-zinc-100">AI Bulk Import</span>
            <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">Import parts from a list or image</span>
          </button>
        )}

        {/* View All Inventory */}
        <button
          type="button"
          onClick={onNavigateToStock}
          className="group relative min-h-[132px] p-3.5 text-left transition-colors hover:bg-white/[0.025]"
        >
          <Database className="h-5 w-5 text-[#62E6E6]" />
          <ArrowRight className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#62E6E6]" />
          <span className="mt-5 block text-[12px] font-bold text-zinc-100">Inventory Stock</span>
          <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">View and manage current stock</span>
        </button>
      </div>
    </section>
  );
};
