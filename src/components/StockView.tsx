import React, { useState, useMemo } from 'react';
import { InventoryView } from './InventoryView';
import { PurchaseHistoryView } from './stock/PurchaseHistoryView';
import { TransactionHistoryView } from './history/TransactionHistoryView';
import { Package, ShoppingBag, Tag } from 'lucide-react';
import { motion } from 'motion/react';
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
  onQuickAssign: (component: InventoryComponent) => void;
  onOpenSellPart: (component?: InventoryComponent, purchaseEntryId?: string) => void;
  onOpenBulkEntry?: () => void;
}

type StockSubTab = 'in-stock' | 'purchases' | 'sold-parts';

export const StockView: React.FC<StockViewProps> = React.memo(({
  isActive = true,
  onOpenAddComponent,
  onOpenAddPurchaseEntry,
  onEditComponent,
  onQuickAssign,
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
    <div className="flex flex-col gap-2">
      {/* Sub-tab Switcher Header */}
      <div className="flex justify-center mb-1 w-full">
        <div className="border border-white/[0.08] bg-[#0D1118] p-1 rounded-xl grid grid-cols-3 gap-1 shadow-sm w-full max-w-lg backdrop-blur-md h-10 items-center">
          {subTabs.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`relative flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors z-10 h-full whitespace-nowrap overflow-hidden ${
                  isSelected ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="stock-subtab-bg"
                    className="absolute inset-0 bg-[#7C6CF2]/20 border border-[#7C6CF2]/50 shadow-sm shadow-[#7C6CF2]/20 rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-3.5 h-3.5 shrink-0 relative z-10 ${isSelected ? 'text-[#7C6CF2]' : 'text-zinc-400'}`} />
                <span className="relative z-10 truncate">{tab.label}</span>
                <span className="text-[10px] font-mono opacity-80 shrink-0 relative z-10">({tab.count})</span>
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
            onQuickAssign={onQuickAssign}
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
