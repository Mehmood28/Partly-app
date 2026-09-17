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
    <div className="flex flex-col gap-4">
      {/* Sub-tab Switcher Header */}
      <div className="w-full">
        <div className="app-segmented grid-cols-3">
          {subTabs.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                data-active={isSelected}
                className="flex items-center justify-center gap-1.5 overflow-hidden px-1.5 whitespace-nowrap"
              >
                <Icon className={`relative z-10 h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-[#A8FF3E]' : 'text-zinc-600'}`} />
                <span className="relative z-10 truncate">{tab.label}</span>
                <span className="relative z-10 shrink-0 font-mono text-[9px] opacity-75 sm:text-[10px]">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Content */}
      <div className="mt-0.5">
        <div className={activeSubTab === 'in-stock' ? 'block' : 'hidden'}>
          <InventoryView
            isActive={Boolean(isActive && activeSubTab === 'in-stock')}
            onOpenBulkEntry={onOpenBulkEntry}
            onOpenAddComponent={onOpenAddComponent}
            onOpenAddPurchaseEntry={onOpenAddPurchaseEntry}
            onEditComponent={onEditComponent}
            onOpenSellPart={onOpenSellPart}
          />
        </div>
        <div className={activeSubTab === 'purchases' ? 'block' : 'hidden'}>
          <PurchaseHistoryView isActive={Boolean(isActive && activeSubTab === 'purchases')} />
        </div>
        <div className={activeSubTab === 'sold-parts' ? 'block' : 'hidden'}>
          <TransactionHistoryView isActive={Boolean(isActive && activeSubTab === 'sold-parts')} />
        </div>
      </div>
    </div>
  );
});
