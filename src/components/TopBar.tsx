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
import { formatSignedCurrency, getProfitSummaryClasses } from '../utils/financialDisplay';

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
    <header className="sticky top-0 z-50 bg-[#0D1213]/95 backdrop-blur-md border-b border-white/[0.09] px-3 sm:px-4 py-2 mb-2 flex flex-col gap-1.5 shadow-sm min-h-[48px]">
      <div className="w-full flex flex-row items-center justify-between gap-2">
        {/* Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#A3FF12] to-[#52E0D4] text-[#08100C] flex items-center justify-center font-medium shadow-sm shadow-[#A3FF12]/20 shrink-0">
            <Cpu className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-none font-display">Partly</h1>
          </div>
        </div>

        {/* Right side: Financial Summary Pills + Privacy */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Financial Pills */}
          <div className="flex items-center gap-2 shrink-0 font-mono">
            {/* Inventory Value */}
            <div className="text-[#A5F3FC] border-r border-white/[0.12] pr-2 text-[9px] sm:text-[10px] font-medium tracking-wide uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              <span>INV {formatCurrency(totalStockValuation)}</span>
            </div>

            {/* Current Month Net Profit */}
            <div className={`${getProfitSummaryClasses(monthProfit)} border px-1.5 sm:px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
              <span>PROFIT: {formatSignedCurrency(monthProfit)}</span>
            </div>
          </div>

          {/* Global Supplier Privacy Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePrivacy}
            aria-pressed={hideSupplierNames}
            aria-label={hideSupplierNames ? "Show supplier names" : "Hide supplier names"}
            title={hideSupplierNames ? "Show supplier names" : "Hide supplier names"}
            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] cursor-pointer ${
              hideSupplierNames
                ? 'bg-[#A3FF12]/12 text-[#A3FF12] border-[#A3FF12]/40 hover:bg-[#A3FF12]/20'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/[0.06]'
            }`}
          >
            {hideSupplierNames ? (
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#A3FF12]" />
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
