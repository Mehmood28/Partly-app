import React from 'react';
import { Home, Package, Cpu, BarChart3, Hammer, FolderSync, LucideIcon, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { SessionHistoryControls } from './SessionHistoryControls';

interface SidebarProps {
  activeTab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data';
  setActiveTab: (tab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data') => void;
  isSessionHistoryOpen: boolean;
  onToggleSessionHistory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  activeTab,
  setActiveTab,
  isSessionHistoryOpen,
  onToggleSessionHistory,
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
    <>
      {/* Desktop Sidebar (hidden on phone) */}
      <aside className="hidden md:flex flex-col w-64 h-dvh fixed top-0 left-0 bg-[#0D1118] border-r border-white/[0.08] p-4 z-[250]">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#A3FF12] to-[#52E0D4] text-white flex items-center justify-center font-medium shadow-md shadow-[#A3FF12]/20">
            <Cpu className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none font-display">Partly</h1>
            <span className="text-[10px] text-zinc-400 font-mono tracking-wider">INVENTORY & SALES</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all relative min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabDesktop"
                  className="absolute inset-0 bg-[#A3FF12]/10 border-l-2 border-[#A3FF12] rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className={`w-4 h-4 relative z-10 ${activeTab === tab.id ? 'text-[#A3FF12]' : 'text-zinc-400'}`} />
              <span className="relative z-10 flex-1 text-left">{tab.label}</span>
              {tab.hasBadge && (
                <div className="w-2 h-2 rounded-full bg-[#A3FF12] relative z-10 shadow-sm shadow-[#A3FF12]/30" />
              )}
            </button>
          ))}
        </nav>

        {/* Desktop History & Scroll-to-Top */}
        <div className="mt-auto space-y-1.5">
          <SessionHistoryControls
            isSessionHistoryOpen={isSessionHistoryOpen}
            onToggleSessionHistory={onToggleSessionHistory}
            placement="desktop"
          />
          <button
            type="button"
            onClick={scrollToTop}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            <ArrowUp className="w-3.5 h-3.5" /> Scroll to Top
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar (5 equal items, re-tap to scroll to top) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0D1118]/95 backdrop-blur-xl z-[250] isolation px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between border-t border-white/[0.08] shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        <div className="flex w-full items-center justify-between gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-label={tab.label}
                className={`relative flex flex-col items-center justify-center flex-1 h-11 transition-colors touch-manipulation rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                {isActive && (
                <motion.div
                  layoutId="activeTabMobile"
                  className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#A3FF12] rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
                )}
                <div className="relative z-10 mb-0.5">
                  <tab.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#A3FF12]' : 'text-zinc-400'}`} />
                  {tab.hasBadge && (
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#A3FF12] shadow-sm shadow-[#A3FF12]/30" />
                  )}
                </div>
                <span className={`text-[10px] font-medium relative z-10 transition-colors ${isActive ? 'text-white font-semibold' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
});
