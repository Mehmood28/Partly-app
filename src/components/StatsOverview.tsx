import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  formatCurrency,
  calculateInventoryMetrics,
  calculateMonthlyMetrics
} from '../utils/helpers';
import { formatSignedCurrency, getProfitSummaryClasses } from '../utils/financialDisplay';

export const StatsOverview: React.FC = React.memo(() => {
  const { state } = useInventory();
  const [showInventoryPopover, setShowInventoryPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowInventoryPopover(false);
      }
    };
    if (showInventoryPopover) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showInventoryPopover]);

  const { looseValuation, activeBuildsCost, totalStockValuation, activeRigsCount, monthProfit } = useMemo(() => {
    const inventoryMetrics = calculateInventoryMetrics(state);
    
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const monthlyMetrics = calculateMonthlyMetrics(state, currentYearNum, currentMonthIdx);

    return {
      ...inventoryMetrics,
      monthProfit: monthlyMetrics.profit,
    };
  }, [state]);

  return (
    <div className="flex items-center gap-2 ml-auto shrink-0 whitespace-nowrap">
      {/* Inventory Value */}
      <div 
        className="gap-1.5 bg-[#A8FF3E]/15 text-[#62E6E6] border border-[#A8FF3E]/30 cursor-pointer relative group px-2 py-1 rounded-lg text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap transition-colors hover:bg-[#A8FF3E]/25"
        onClick={() => setShowInventoryPopover(!showInventoryPopover)}
        ref={popoverRef}
      >
        <span>INV: {formatCurrency(totalStockValuation)}</span>
        
        {/* Popover */}
        {showInventoryPopover && (
          <div 
            className="absolute top-full right-0 mt-2 w-52 bg-[#101719] border border-white/[0.12] rounded-xl shadow-2xl p-3 z-[100] text-xs cursor-default normal-case whitespace-normal tracking-normal"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Unassigned Stock</span>
                <span className="text-zinc-200 font-mono font-medium">{formatCurrency(looseValuation)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Assigned Stock</span>
                <span className="text-zinc-200 font-mono font-medium">{formatCurrency(activeBuildsCost)}</span>
              </div>
              <div className="pt-2 border-t border-white/[0.08] flex justify-between items-center">
                <span className="text-[#A8FF3E] font-semibold uppercase text-[10px] tracking-wider">Total Inventory</span>
                <span className="text-[#A8FF3E] font-mono font-bold">{formatCurrency(totalStockValuation)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active PC Builds */}
      <div className="gap-1.5 bg-white/[0.06] text-zinc-300 border border-white/[0.1] px-2 py-1 rounded-lg text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
        <span>RIGS: {activeRigsCount}</span>
      </div>

      {/* Current Month Net Profit */}
      <div className={`gap-1.5 ${getProfitSummaryClasses(monthProfit)} border px-2 py-1 rounded-lg text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
        <span>PROFIT: {formatSignedCurrency(monthProfit)}</span>
      </div>
    </div>
  );
});
