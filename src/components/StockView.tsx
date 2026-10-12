import React, { useState, useMemo } from 'react';
import { InventoryView } from './InventoryView';
import { PurchaseHistoryView } from './stock/PurchaseHistoryView';
import { TransactionHistoryView } from './history/TransactionHistoryView';
import { Package, ShoppingBag, Tag } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryComponent } from '../types';
import { classifyTransaction } from '../utils/transactionClassification';
import { calculateUnassignedQuantityStrict } from '../utils/helpers';
import { getSoldPartsDisplayItems } from '../utils/bulkSaleGrouping';

interface StockViewProps {
  isActive?: boolean;
  onOpenAddComponent: () => void;
  onOpenAddPurchaseEntry: (componentId: string) => void;
  onEditComponent: (component: InventoryComponent) => void;
  onOpenSellPart: (component?: InventoryComponent, purchaseEntryId?: string) => void;
  onOpenBulkEntry?: () => void;
}

type StockSubTab = 'in-stock' | 'purchases' | 'sold-parts';

export const StockView: React.FC<StockViewProps> = React.memo(({
  isActive = true,
  onOpenAddComponent,
  onOpenAddPurchaseEntry,
  onEditComponent,
  onOpenSellPart,
  onOpenBulkEntry,
}) => {
  const { state } = useInventory();
  const [activeSubTab, setActiveSubTab] = useState<StockSubTab>('in-stock');

  // Calculate counts for sub-tab badges
  const inStockCount = useMemo(() => {
    return state.components.filter(
      (c) => calculateUnassignedQuantityStrict(c, state.builds) > 0
    ).length;
  }, [state.components, state.builds]);

  const purchaseCount = useMemo(() => {
    return state.transactions.filter((tx) => classifyTransaction(tx, state.builds).isPurchase).length;
  }, [state.transactions, state.builds]);

  const soldPartsCount = useMemo(() => {
    return getSoldPartsDisplayItems(state.transactions, state.builds).length;
  }, [state.transactions, state.builds]);

  const subTabs: { id: StockSubTab; label: string; icon: React.FC<{ className?: string }>; count: number }[] = [
    { id: 'in-stock', label: 'In Stock', icon: Package, count: inStockCount },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag, count: purchaseCount },
    { id: 'sold-parts', label: 'Sold Parts', icon: Tag, count: soldPartsCount },
  ];

  return (
    <div className="stock-layout flex flex-col items-stretch w-full flex-1 min-h-0 h-full gap-2 sm:gap-3">
      {/* Sub-tab Switcher Header */}
      <div className="stock-subtabs shrink-0 w-full">
        <div className="app-segmented grid-cols-3 w-full">
          {subTabs.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                data-active={isSelected}
                className="flex items-center justify-center gap-1.5 overflow-hidden px-1.5 whitespace-nowrap outline-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-none"
              >
                <Icon className={`relative z-10 h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-[#B9EF68]' : 'text-zinc-600'}`} />
                <span className="relative z-10 truncate">{tab.label}</span>
                <span className="relative z-10 shrink-0 font-mono text-[10px] sm:text-[11px] opacity-75 leading-none">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Content */}
      <div className="w-full flex-1 min-h-0 flex flex-col items-stretch">
        <div className={activeSubTab === 'in-stock' ? 'flex flex-col flex-1 min-h-0 h-full w-full' : 'hidden'}>
          <InventoryView
            isActive={Boolean(isActive && activeSubTab === 'in-stock')}
            onOpenBulkEntry={onOpenBulkEntry}
            onOpenAddComponent={onOpenAddComponent}
            onOpenAddPurchaseEntry={onOpenAddPurchaseEntry}
            onEditComponent={onEditComponent}
            onOpenSellPart={onOpenSellPart}
          />
        </div>
        <div className={activeSubTab === 'purchases' ? 'flex flex-col flex-1 min-h-0 h-full w-full' : 'hidden'}>
          <PurchaseHistoryView isActive={Boolean(isActive && activeSubTab === 'purchases')} />
        </div>
        <div className={activeSubTab === 'sold-parts' ? 'flex flex-col flex-1 min-h-0 h-full w-full' : 'hidden'}>
          <TransactionHistoryView isActive={Boolean(isActive && activeSubTab === 'sold-parts')} />
        </div>
      </div>
    </div>
  );
});
