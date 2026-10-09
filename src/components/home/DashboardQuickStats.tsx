import React, { useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  calculateBuildPartsCost,
  calculateMonthlyMetrics,
  formatCurrency,
  formatRelativeCalendarDate,
  getLocalCalendarTimestamp,
} from '../../utils/helpers';
import { findLinkedSaleTransaction } from '../../utils/buildEligibility';
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
      const txA = findLinkedSaleTransaction(a, state.transactions).transaction;
      const txB = findLinkedSaleTransaction(b, state.transactions).transaction;
      const dateA = txA?.dateSortable || a.saleDate || txA?.timestamp || a.completionDate || a.createdDate || '';
      const dateB = txB?.dateSortable || b.saleDate || txB?.timestamp || b.completionDate || b.createdDate || '';
      const timeA = getLocalCalendarTimestamp(dateA);
      const timeB = getLocalCalendarTimestamp(dateB);
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    })[0];
  }, [state.builds, state.transactions]);

  const lastSaleElapsed = useMemo(() => {
    if (!lastSoldBuild) return 'No sales yet';
    const tx = findLinkedSaleTransaction(lastSoldBuild, state.transactions).transaction;
    const dateStr =
      tx?.dateSortable ||
      lastSoldBuild.saleDate ||
      tx?.timestamp ||
      lastSoldBuild.completionDate ||
      lastSoldBuild.createdDate;
    if (!dateStr) return 'Recently';

    return formatRelativeCalendarDate(dateStr, {
      referenceDate: now,
      fallbackText: 'Recently',
      maxRelativeDays: 6,
    });
  }, [lastSoldBuild, state.transactions, now]);

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
