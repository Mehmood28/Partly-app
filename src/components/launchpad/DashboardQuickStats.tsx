import React, { useMemo } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';
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
    <div className="bg-[#0D1118] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl p-3.5 relative overflow-hidden transition-all duration-300 shadow-sm">
      <div className="flex items-center justify-between mb-3 relative z-10 flex-wrap gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#7C6CF2]" /> At a Glance
        </h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 relative z-10">
        {/* 1. Listed Builds */}
        <div 
          onClick={() => onNavigateToBuilds('Available')}
          className="border border-white/[0.06] bg-[#121722] rounded-xl p-3 flex flex-col justify-between hover:border-[#7C6CF2]/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-zinc-400 leading-tight">
              Listed Builds
            </p>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#7C6CF2] transition-colors" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold font-mono text-[#9D91FA] leading-tight">
              {stats.listedCount}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Ready for sale</p>
          </div>
        </div>

        {/* 2. Pending Sale */}
        <div 
          onClick={() => onNavigateToBuilds('Pending')}
          className="border border-white/[0.06] bg-[#121722] rounded-xl p-3 flex flex-col justify-between hover:border-[#7C6CF2]/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-zinc-400 leading-tight">
              Pending Sale
            </p>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#7C6CF2] transition-colors" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold font-mono text-zinc-100 leading-tight group-hover:text-white transition-colors">
              {stats.pendingSaleCount}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Awaiting sale completion</p>
          </div>
        </div>

        {/* 3. Available Stock */}
        <div 
          onClick={onNavigateToStock}
          className="border border-white/[0.06] bg-[#121722] rounded-xl p-3 flex flex-col justify-between hover:border-[#7C6CF2]/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-zinc-400 leading-tight">
              Available Stock
            </p>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#7C6CF2] transition-colors" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold font-mono text-zinc-100 leading-tight group-hover:text-white transition-colors">
              {stats.availableStockCount} <span className="text-xs font-normal text-zinc-400 font-sans">units</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Unassigned parts</p>
          </div>
        </div>

        {/* 4. Last PC Sale */}
        <div className="border border-white/[0.06] bg-[#121722] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-zinc-400 leading-tight">
              Last PC Sale
            </p>
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold font-mono text-emerald-400 leading-tight">
              {stats.relativeTimeText}
            </p>
            {stats.hasSoldBuild && stats.latestBuildName ? (
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-full font-sans" title={stats.latestBuildName}>
                {stats.latestBuildName}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-0.5 font-sans">No completed builds sold</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
