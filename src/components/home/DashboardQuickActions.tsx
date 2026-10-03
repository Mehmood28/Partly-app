import React from 'react';
import { Hammer, PlusCircle, Boxes, Package, ArrowUpRight } from 'lucide-react';

interface DashboardQuickActionsProps {
  onOpenAddBuild: () => void;
  onOpenAddComponent?: () => void;
  onOpenBulkEntry?: () => void;
  onNavigateToStock: () => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onOpenAddBuild,
  onOpenAddComponent,
  onOpenBulkEntry,
  onNavigateToStock,
}) => {
  return (
    <section className="home-section border-b-0 !border-b-0 pb-0" style={{ borderBottom: 'none' }}>
      <div className="section-heading">
        <h2>Quick actions</h2>
        <span>Build. Stock. Automate.</span>
      </div>
      <div className="quick-action-grid">
        <button
          type="button"
          onClick={onOpenAddBuild}
          title="New PC Build"
        >
          <Hammer />
          <strong>New PC Build</strong>
          <span>Allocate parts and configure a custom gaming rig</span>
          <ArrowUpRight className="action-arrow" />
        </button>

        <button
          type="button"
          onClick={() => onOpenAddComponent?.()}
          title="Add Component"
        >
          <PlusCircle />
          <strong>Add Component</strong>
          <span>Log single part purchase with cost and batch details</span>
          <ArrowUpRight className="action-arrow" />
        </button>

        <button
          type="button"
          onClick={() => onOpenBulkEntry?.()}
          title="AI Bulk Import"
        >
          <Boxes />
          <strong>AI Bulk Import</strong>
          <span>Quickly import multiple components using AI extraction</span>
          <ArrowUpRight className="action-arrow" />
        </button>

        <button
          type="button"
          onClick={onNavigateToStock}
          title="Manage Inventory"
        >
          <Package />
          <strong>Manage Inventory</strong>
          <span>Audit inventory levels, batches, and unassigned parts</span>
          <ArrowUpRight className="action-arrow" />
        </button>
      </div>
    </section>
  );
};
