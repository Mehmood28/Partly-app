import React from 'react';
import { GoalBar } from './GoalBar';
import { HomeViewProps, LaunchpadViewProps } from './home/homeTypes';
import { DashboardQuickStats } from './home/DashboardQuickStats';
import { DashboardQuickActions } from './home/DashboardQuickActions';

export type { HomeViewProps, LaunchpadViewProps };

export const HomeView: React.FC<HomeViewProps> = React.memo(({ 
  setActiveTab, 
  onNavigateToBuilds,
  onOpenAddBuild, 
  onOpenAddComponent, 
  onOpenBulkEntry 
}) => {
  return (
    <div className="home-layout pb-2">
      {/* Monthly Profit Goal */}
      <GoalBar />
      
      {/* At a glance section */}
      <DashboardQuickStats
        onNavigateToBuilds={(filter) => {
          if (onNavigateToBuilds) {
            onNavigateToBuilds(filter);
          } else {
            setActiveTab('builds');
          }
        }}
        onNavigateToStock={() => setActiveTab('inventory')}
      />

      {/* Quick actions section */}
      <DashboardQuickActions
        onOpenAddBuild={() => onOpenAddBuild()}
        onOpenAddComponent={onOpenAddComponent}
        onOpenBulkEntry={onOpenBulkEntry}
        onNavigateToStock={() => setActiveTab('inventory')}
      />
    </div>
  );
});
