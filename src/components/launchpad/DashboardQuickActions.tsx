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
  const items = [
    { label: 'New PC Build', copy: 'Create a custom PC build', icon: Hammer, action: onOpenAddBuild },
    { label: 'Add Component', copy: 'Add a single part to inventory', icon: Plus, action: onOpenAddComponent },
    ...(onOpenBulkEntry ? [{ label: 'AI Bulk Import', copy: 'Import parts from a list or image', icon: Sparkles, action: onOpenBulkEntry }] : []),
    { label: 'Inventory Stock', copy: 'View and manage your stock', icon: Database, action: onNavigateToStock },
  ];
  return (
    <section className="home-section">
      <div className="section-heading"><h2>Quick actions</h2><span>Build. Stock. Automate.</span></div>
      <div className="quick-action-grid">{items.map(item => (
        <button key={item.label} onClick={item.action}><item.icon /><strong>{item.label}</strong><span>{item.copy}</span><ArrowRight className="action-arrow" /></button>
      ))}</div>
    </section>
  );
};
