import React, { useMemo } from 'react';
import { Cpu, Eye, EyeOff } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { SessionHistoryControls } from './SessionHistoryControls';
import {
  formatCurrency,
  calculateInventoryMetrics,
  calculateMonthlyMetrics
} from '../utils/helpers';

interface TopBarProps {
  isSessionHistoryOpen: boolean;
  onToggleSessionHistory: () => void;
}

export const TopBar: React.FC<TopBarProps> = React.memo(({ isSessionHistoryOpen, onToggleSessionHistory }) => {
  const { state } = useInventory();
  const { hideSupplierNames, toggleSupplierNames } = usePrivacy();

  const handleTogglePrivacy = () => {
    toggleSupplierNames();
  };

  const { totalStockValuation, monthProfit } = useMemo(() => {
    const inventoryMetrics = calculateInventoryMetrics(state);
    
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const monthlyMetrics = calculateMonthlyMetrics(state, currentYearNum, currentMonthIdx);

    return {
      totalStockValuation: inventoryMetrics.totalStockValuation,
      monthProfit: monthlyMetrics.profit,
    };
  }, [state]);

  return (
    <header className="sticky top-0 z-50 bg-[#0D1118]/95 backdrop-blur-md border-b border-white/[0.08] px-2.5 sm:px-4 py-2 mb-2 flex flex-col gap-1.5 shadow-sm min-h-[48px]">
      <div className="w-full flex flex-row items-center justify-between gap-2">
        {/* Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C6CF2] to-[#5B4AE4] text-white flex items-center justify-center font-medium shadow-md shadow-[#7C6CF2]/20 shrink-0">
            <Cpu className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-none font-display">Partly</h1>
          </div>
        </div>

        {/* Right side: Financial Summary Pills + Privacy */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Financial Pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Inventory Value */}
            <div className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-1.5 sm:px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              <span>INV: {formatCurrency(totalStockValuation)}</span>
            </div>

            {/* Current Month Net Profit */}
            <div className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 sm:px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              <span>PROFIT: {monthProfit >= 0 ? '+' : ''}{formatCurrency(monthProfit)}</span>
            </div>
          </div>

          {/* Global Supplier Privacy Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePrivacy}
            aria-pressed={hideSupplierNames}
            aria-label={hideSupplierNames ? "Show supplier names" : "Hide supplier names"}
            title={hideSupplierNames ? "Show supplier names" : "Hide supplier names"}
            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] cursor-pointer ${
              hideSupplierNames
                ? 'bg-[#7C6CF2]/15 text-[#9D91FA] border-[#7C6CF2]/40 hover:bg-[#7C6CF2]/25'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/[0.06]'
            }`}
          >
            {hideSupplierNames ? (
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9D91FA]" />
            ) : (
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="md:hidden w-full">
        <SessionHistoryControls
          isSessionHistoryOpen={isSessionHistoryOpen}
          onToggleSessionHistory={onToggleSessionHistory}
          placement="mobile"
        />
      </div>
    </header>
  );
});
