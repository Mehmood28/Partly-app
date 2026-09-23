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
          <img className="partly-mark" src="/partly-icon-192.png" width="42" height="42" alt="" />
          <div><h1>Partly</h1></div>
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
      <div className="partly-history"><SessionHistoryControls isSessionHistoryOpen={isSessionHistoryOpen} onToggleSessionHistory={onToggleSessionHistory} /></div>
    </header>
  );
});
