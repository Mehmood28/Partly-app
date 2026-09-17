import React, { useMemo } from 'react';
import { Activity, ArrowUpRight, Boxes, BadgeDollarSign, MonitorCheck, ShoppingCart } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { calculateUnassignedQuantityStrict } from '../../utils/helpers';

interface DashboardQuickStatsProps {
  onNavigateToBuilds: (filter?: 'Available' | 'Pending' | 'Sold') => void;
  onNavigateToStock: () => void;
}

export const DashboardQuickStats: React.FC<DashboardQuickStatsProps> = ({
  onNavigateToBuilds,
  onNavigateToStock,
}) => {
  const { state } = useInventory();

  const stats = useMemo(() => {
    // 1. Listed Builds
    const listedCount = state.builds.filter(b => b.status === 'Listed for Sale').length;

    // 2. Pending Sale
    const pendingSaleCount = state.builds.filter(b => b.status === 'In Progress').length;

    // 3. Available Stock (Sum strict unassigned quantities across all components)
    const availableStockCount = state.components.reduce(
      (sum, c) => sum + calculateUnassignedQuantityStrict(c, state.builds),
      0
    );

    // 4. Last PC Sale (only state.builds with status === 'Sold' and valid saleDate)
    const soldBuilds = state.builds
      .filter(b => b.status === 'Sold' && b.saleDate)
      .map(b => {
        const d = new Date(b.saleDate!);
        return {
          build: b,
          timestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
        };
      })
      .filter(item => item.timestamp > 0);

    // Sort descending by timestamp, tie breaker: immutable build ID descending
    soldBuilds.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.build.id.localeCompare(a.build.id);
    });

    let relativeTimeText = 'No PC sales yet';
    let latestBuildName = '';

    if (soldBuilds.length > 0) {
      const latest = soldBuilds[0];
      latestBuildName = latest.build.name || 'Unnamed PC Build';

      const now = new Date();
      const diffMs = now.getTime() - latest.timestamp;
      const daysCount = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (daysCount === 0) {
        relativeTimeText = 'Today';
      } else if (daysCount === 1) {
        relativeTimeText = '1 day ago';
      } else {
        relativeTimeText = `${daysCount} days ago`;
      }
    }

    return {
      listedCount,
      pendingSaleCount,
      availableStockCount,
      relativeTimeText,
      latestBuildName,
      hasSoldBuild: soldBuilds.length > 0,
    };
  }, [state]);

  return (
    <section className="app-section">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="app-section-kicker"><Activity /> Operations snapshot</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Live</span>
      </div>

      <div className="app-panel grid grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => onNavigateToBuilds('Available')} className="group min-h-[122px] border-b border-r border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025] lg:border-b-0">
          <div className="flex items-center justify-between"><MonitorCheck className="h-4 w-4 text-[#62E6E6]" /><ArrowUpRight className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-[#A8FF3E]" /></div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">Listed Builds</p>
          <p className="mt-1 font-mono text-2xl font-bold leading-none text-[#62E6E6]">{stats.listedCount}</p>
          <p className="mt-1.5 text-[11px] text-zinc-500">Ready for sale</p>
        </button>

        <button type="button" onClick={() => onNavigateToBuilds('Pending')} className="group min-h-[122px] border-b border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between"><ShoppingCart className="h-4 w-4 text-zinc-300" /><ArrowUpRight className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-[#A8FF3E]" /></div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">Pending Sale</p>
          <p className="mt-1 font-mono text-2xl font-bold leading-none text-zinc-100">{stats.pendingSaleCount}</p>
          <p className="mt-1.5 text-[11px] text-zinc-500">Awaiting completion</p>
        </button>

        <button type="button" onClick={onNavigateToStock} className="group min-h-[122px] border-r border-white/[0.09] p-3.5 text-left transition-colors hover:bg-white/[0.025]">
          <div className="flex items-center justify-between"><Boxes className="h-4 w-4 text-[#62E6E6]" /><ArrowUpRight className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-[#A8FF3E]" /></div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">Available Stock</p>
          <p className="mt-1 font-mono text-2xl font-bold leading-none text-zinc-100">{stats.availableStockCount}<span className="ml-1 font-sans text-[10px] font-medium text-zinc-500">units</span></p>
          <p className="mt-1.5 text-[11px] text-zinc-500">Unassigned parts</p>
        </button>

        <div className="min-h-[122px] p-3.5 text-left">
          <BadgeDollarSign className="h-4 w-4 text-[#4DE0A4]" />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">Last PC Sale</p>
          <p className="mt-1 font-mono text-lg font-bold leading-none text-[#4DE0A4] sm:text-xl">{stats.relativeTimeText}</p>
          {stats.hasSoldBuild && stats.latestBuildName ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-400" title={stats.latestBuildName}>{stats.latestBuildName}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-zinc-500">No completed builds sold</p>
          )}
        </div>
      </div>
    </section>
  );
};
