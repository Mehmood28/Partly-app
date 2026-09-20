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
    <header className="partly-header">
      <div className="partly-masthead">
        <div className="partly-brand">
          <svg className="partly-mark" viewBox="0 0 40 44" aria-hidden="true"><path d="M20 2 38 12 20 22 2 12Z" fill="#a3e98c"/><path d="m2 16 16 9v17L2 33Z" fill="#b9ef68"/><path d="m22 25 16-9v17L22 42Z" fill="#83e5df"/></svg>
          <div><h1>Partly</h1><span>PC builder &amp; reseller</span></div>
        </div>
        <div className="masthead-metrics">
          <div><PackageOpen /><span>Inventory<strong>{formatCurrency(totalStockValuation)}</strong></span></div>
          <div><TrendingUp /><span>Profit<strong className={getProfitTextColor(monthProfit)}>{formatSignedCurrency(monthProfit)}</strong></span></div>
        </div>
        <button type="button" onClick={handleTogglePrivacy} aria-pressed={hideSupplierNames}
          aria-label={hideSupplierNames ? 'Show supplier names' : 'Hide supplier names'} className="privacy-toggle">
          {hideSupplierNames ? <EyeOff /> : <Eye />}
        </button>
      </div>
      <div className="partly-history"><SessionHistoryControls isSessionHistoryOpen={isSessionHistoryOpen} onToggleSessionHistory={onToggleSessionHistory} placement="mobile" /></div>
    </header>
  );
});
