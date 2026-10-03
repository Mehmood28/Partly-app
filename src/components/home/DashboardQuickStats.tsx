import React, { useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  calculateBuildPartsCost,
  calculateMonthlyMetrics,
  formatCurrency,
  parseDateLocal,
} from '../../utils/helpers';
import { Monitor, Hammer, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';

interface DashboardQuickStatsProps {
  onNavigateToBuilds: (filter?: 'Available' | 'Pending' | 'Sold') => void;
  onNavigateToStock?: () => void;
}

export const DashboardQuickStats: React.FC<DashboardQuickStatsProps> = ({
  onNavigateToBuilds,
}) => {
  const { state } = useInventory();

  const availableBuilds = useMemo(
    () => state.builds.filter((b) => b.status === 'Available'),
    [state.builds]
  );
  const availableCount = availableBuilds.length;
  const availableTotalValue = useMemo(
    () =>
      availableBuilds.reduce(
        (sum, b) => sum + (Number(b.salePrice) || calculateBuildPartsCost(b)),
        0
      ),
    [availableBuilds]
  );

  const pendingBuilds = useMemo(
    () => state.builds.filter((b) => b.status === 'Pending'),
    [state.builds]
  );
  const pendingCount = pendingBuilds.length;
  const pendingTotalCost = useMemo(
    () =>
      pendingBuilds.reduce((sum, b) => sum + calculateBuildPartsCost(b), 0),
    [pendingBuilds]
  );

  const now = new Date();
  const monthlyMetrics = useMemo(
    () => calculateMonthlyMetrics(state, now.getFullYear(), now.getMonth()),
    [state]
  );
  const monthlyPcsSold = monthlyMetrics.pcsSold;

  const lastSoldBuild = useMemo(() => {
    const sold = state.builds.filter((b) => b.status === 'Sold');
    if (sold.length === 0) return null;

    return [...sold].sort((a, b) => {
      const dateA = a.saleDate || a.completionDate || a.createdDate || '';
      const dateB = b.saleDate || b.completionDate || b.createdDate || '';
      const timeA = dateA ? (parseDateLocal(dateA) ? new Date(dateA).getTime() : 0) : 0;
      const timeB = dateB ? (parseDateLocal(dateB) ? new Date(dateB).getTime() : 0) : 0;
      return timeB - timeA;
    })[0];
  }, [state.builds]);

  const lastSaleElapsed = useMemo(() => {
    if (!lastSoldBuild) return 'No sales yet';
    const dateStr =
      lastSoldBuild.saleDate ||
      lastSoldBuild.completionDate ||
      lastSoldBuild.createdDate;
    if (!dateStr) return 'Recently';

    const parsed = parseDateLocal(dateStr);
    let saleMidnight: number;
    if (parsed) {
      saleMidnight = new Date(parsed.year, parsed.monthIndex, parsed.day).getTime();
    } else {
      const d = new Date(dateStr);
      saleMidnight = isNaN(d.getTime())
        ? 0
        : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    if (!saleMidnight) return 'Recently';

    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const diffDays = Math.round(
      (todayMidnight - saleMidnight) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }, [lastSoldBuild, now]);

  const lastSoldTitle = lastSoldBuild?.name || 'No completed sales';

  return (
    <section className="home-section">
      <div className="section-heading">
        <h2>At a glance</h2>
        <span>Live overview</span>
      </div>
      <div className="overview-grid">
        <button
          type="button"
          className="overview-stat overview-stat-action"
          onClick={() => onNavigateToBuilds('Available')}
          title="View Available Builds"
        >
          <Monitor />
          <span>Available Builds</span>
          <strong>{availableCount}</strong>
          <small>{formatCurrency(availableTotalValue)} value</small>
          <ArrowUpRight className="overview-arrow" />
        </button>

        <button
          type="button"
          className="overview-stat overview-stat-action"
          onClick={() => onNavigateToBuilds('Pending')}
          title="View Pending Builds"
        >
          <Hammer />
          <span>Pending Builds</span>
          <strong>{pendingCount}</strong>
          <small>{formatCurrency(pendingTotalCost)} allocated</small>
          <ArrowUpRight className="overview-arrow" />
        </button>

        <button
          type="button"
          className="overview-stat overview-stat-action"
          onClick={() => onNavigateToBuilds('Sold')}
          title="View Sold Builds"
        >
          <TrendingUp />
          <span>Sold This Month</span>
          <strong>{monthlyPcsSold}</strong>
          <small>{formatCurrency(monthlyMetrics.profit)} profit</small>
          <ArrowUpRight className="overview-arrow" />
        </button>

        <button
          type="button"
          className="overview-stat overview-stat-action"
          onClick={() => onNavigateToBuilds('Sold')}
          title={lastSoldTitle}
        >
          <Clock />
          <span>Last PC Sale</span>
          <strong className="text-[20px] sm:text-[22px] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
            {lastSaleElapsed}
          </strong>
          <small className="overview-sale-age truncate max-w-full" title={lastSoldTitle}>
            {lastSoldTitle}
          </small>
          <ArrowUpRight className="overview-arrow" />
        </button>
      </div>
    </section>
  );
};
