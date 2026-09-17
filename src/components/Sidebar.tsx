import React from 'react';
import { Home, Package, BarChart3, Hammer, FolderSync, LucideIcon, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
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
    <>
      {/* Desktop Sidebar (hidden on phone) */}
      <aside className="fixed left-0 top-0 z-[250] hidden h-dvh w-64 flex-col border-r border-white/[0.09] bg-[#080d0f]/96 p-4 shadow-[18px_0_55px_rgba(0,0,0,0.24)] backdrop-blur-xl md:flex">
        <div className="mb-7 flex items-center gap-3 border-b border-white/[0.08] px-2 pb-5">
          <img src="/partly-icon-192.png" alt="" className="h-10 w-10 rounded-xl border border-white/[0.12] object-cover" />
          <div>
            <h1 className="text-lg font-extrabold leading-none tracking-[-0.04em] text-white">Partly</h1>
            <span className="mt-1 block text-[9px] font-bold tracking-[0.16em] text-zinc-500">PC BUILDER &amp; RESELLER</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E] ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabDesktop"
                  className="absolute inset-0 rounded-xl border border-[#A8FF3E]/20 bg-[#A8FF3E]/[0.07]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className={`relative z-10 h-[18px] w-[18px] ${activeTab === tab.id ? 'text-[#A8FF3E]' : 'text-zinc-500'}`} />
              <span className="relative z-10 flex-1 text-left">{tab.label}</span>
              {tab.hasBadge && (
                <div className="relative z-10 h-2 w-2 rounded-full bg-[#A8FF3E] shadow-[0_0_12px_rgba(168,255,62,0.6)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1.5 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={scrollToTop}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E]"
          >
            <ArrowUp className="w-3.5 h-3.5" /> Scroll to Top
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar (5 equal items, re-tap to scroll to top) */}
      <nav className="fixed bottom-0 left-0 right-0 z-[250] isolate flex items-center justify-between border-t border-white/[0.1] bg-[#080d0f]/96 px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.62)] backdrop-blur-xl md:hidden">
        <div className="flex w-full items-center justify-between gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-label={tab.label}
                className={`relative flex h-[50px] flex-1 touch-manipulation flex-col items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E] ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                {isActive && (
                <motion.div
                  layoutId="activeTabMobile"
                  className="absolute bottom-0 left-[24%] right-[24%] h-0.5 rounded-full bg-gradient-to-r from-[#A8FF3E] to-[#62E6E6] shadow-[0_0_14px_rgba(168,255,62,0.55)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
                )}
                <div className="relative z-10 mb-0.5">
                  <tab.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-[#A8FF3E]' : 'text-zinc-500'}`} />
                  {tab.hasBadge && (
                    <div className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#A8FF3E] shadow-[0_0_10px_rgba(168,255,62,0.7)]" />
                  )}
                </div>
                <span className={`relative z-10 text-[10px] font-medium transition-colors ${isActive ? 'font-semibold text-white' : ''}`}>
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
