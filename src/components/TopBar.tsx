import React, { useMemo } from 'react';
import { Eye, EyeOff, PackageOpen, TrendingUp } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { SessionHistoryControls } from './SessionHistoryControls';
import {
  formatCurrency,
  calculateInventoryMetrics,
  calculateMonthlyMetrics
} from '../utils/helpers';
import { formatSignedCurrency, getProfitTextColor } from '../utils/financialDisplay';

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
    <header className="sticky top-0 z-50 mb-3 border-b border-white/[0.09] bg-[#080d0f]/95 px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-5 sm:py-2.5">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="mr-auto flex min-w-0 items-center gap-2 md:hidden">
            <img
              src="/partly-icon-192.png"
              alt=""
              className="h-9 w-9 shrink-0 rounded-[10px] border border-white/[0.12] object-cover shadow-[0_0_24px_rgba(98,230,230,0.12)]"
            />
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-none tracking-[-0.04em] text-white">Partly</h1>
              <p className="mt-1 hidden truncate text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500 min-[440px]:block">PC builder &amp; reseller</p>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 divide-x divide-white/[0.1] rounded-[10px] border border-white/[0.09] bg-white/[0.025] md:ml-auto md:w-[360px] md:flex-none">
            <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2">
              <PackageOpen className="hidden h-4 w-4 shrink-0 text-[#62E6E6] min-[430px]:block" />
              <div className="min-w-0">
                <span className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-500 sm:text-[9px]">Inventory</span>
                <span className="block truncate font-mono text-[10px] font-bold leading-tight text-zinc-100 min-[390px]:text-[11px] sm:text-sm">{formatCurrency(totalStockValuation)}</span>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2">
              <TrendingUp className="hidden h-4 w-4 shrink-0 text-[#A8FF3E] min-[430px]:block" />
              <div className="min-w-0">
                <span className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-500 sm:text-[9px]">Profit</span>
                <span className={`block truncate font-mono text-[10px] font-bold leading-tight min-[390px]:text-[11px] sm:text-sm ${getProfitTextColor(monthProfit)}`}>
                  {formatSignedCurrency(monthProfit)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTogglePrivacy}
            aria-pressed={hideSupplierNames}
            aria-label={hideSupplierNames ? 'Show supplier names' : 'Hide supplier names'}
            title={hideSupplierNames ? 'Show supplier names' : 'Hide supplier names'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E] sm:h-10 sm:w-10 ${
              hideSupplierNames
                ? 'border-[#A8FF3E]/45 bg-[#A8FF3E]/10 text-[#A8FF3E]'
                : 'border-white/[0.1] bg-white/[0.035] text-zinc-400 hover:border-white/[0.2] hover:text-white'
            }`}
          >
            {hideSupplierNames ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 w-full border-t border-white/[0.07] pt-2 sm:mt-2.5 sm:pt-2.5">
          <SessionHistoryControls
            isSessionHistoryOpen={isSessionHistoryOpen}
            onToggleSessionHistory={onToggleSessionHistory}
            placement="mobile"
          />
        </div>
      </div>
    </header>
  );
});
