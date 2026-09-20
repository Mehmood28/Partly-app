import React, { useMemo } from 'react';
import { ArrowRight, Boxes, BadgeDollarSign, MonitorCheck, ShoppingCart } from 'lucide-react';
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
    <section className="home-section">
      <div className="section-heading"><h2>At a glance</h2><span>Live overview</span></div>
      <div className="overview-grid">
        <button className="overview-stat overview-stat-action" onClick={() => onNavigateToBuilds('Available')}><MonitorCheck /><span>Listed Builds</span><strong>{stats.listedCount}</strong><small>Active listings<br />on marketplace</small><ArrowRight className="overview-arrow" /></button>
        <button className="overview-stat overview-stat-action" onClick={() => onNavigateToBuilds('Pending')}><ShoppingCart /><span>Pending Sale</span><strong>{stats.pendingSaleCount}</strong><small>Awaiting payment<br />or fulfillment</small><ArrowRight className="overview-arrow" /></button>
        <button className="overview-stat overview-stat-action" onClick={onNavigateToStock}><Boxes /><span>Available Stock</span><strong>{stats.availableStockCount} <em>units</em></strong><small>Components<br />in inventory</small><ArrowRight className="overview-arrow" /></button>
        <div className="overview-stat"><BadgeDollarSign /><span>Last PC Sale</span><strong className="overview-sale-age">{stats.relativeTimeText}</strong><small>{stats.latestBuildName || 'No completed builds sold'}</small></div>
      </div>
    </section>
  );
};
