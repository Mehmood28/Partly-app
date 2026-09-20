import React from 'react';
import { Home, Package, BarChart3, Hammer, FolderSync, LucideIcon } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface SidebarProps {
  activeTab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data';
  setActiveTab: (tab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data') => void;
  isSessionHistoryOpen: boolean;
  onToggleSessionHistory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  activeTab,
  setActiveTab,
}) => {
  const { actionsSinceBackup } = useInventory();

  const scrollToTop = () => { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    const activeContainer = document.querySelector('main > div:not(.hidden) .overflow-y-auto, main > div:not(.hidden) [data-scroll-container]');
    if (activeContainer) {
      activeContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTabClick = (tabId: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data') => {
    if (activeTab === tabId) {
      scrollToTop();
    } else {
      setActiveTab(tabId);
    }
  };

  const tabs: Array<{ id: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data'; label: string; icon: LucideIcon; hasBadge?: boolean }> = [
    { id: 'launchpad', label: 'Home', icon: Home },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'builds', label: 'Builds', icon: Hammer },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'data', label: 'Data', icon: FolderSync, hasBadge: actionsSinceBackup > 5 },
  ];

  return (
    <nav className="partly-navigation" aria-label="Main navigation">
      <div>{tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)} aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}>
          <span className="relative"><tab.icon />{tab.hasBadge && <i className="navigation-dot" />}</span>
          <span>{tab.label}</span>
        </button>
      ))}</div>
    </nav>
  );
});
