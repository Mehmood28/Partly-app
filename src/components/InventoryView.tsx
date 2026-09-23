import React, { useState, useMemo, useDeferredValue, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInventory } from '../context/InventoryContext';
import { ComponentCard } from './ComponentCard';
import { InventoryFilterBar } from './InventoryFilterBar';
import { InventoryComponent, CATEGORIES } from '../types';
import {
  calculateUnassignedQuantityStrict,
  calculateUnassignedValueStrict,
  calculateInventoryMetrics,
  formatCurrency,
  precomputeAssignedBatches,
  filterAndSortComponents,
  SortOption
} from '../utils/helpers';
import { Plus, Filter, Zap, Layers, ArrowDownWideNarrow } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { useVirtualListScroll } from '../hooks/useVirtualListScroll';

interface InventoryViewProps {
  isActive?: boolean;
  onOpenAddComponent: () => void;
  onOpenAddPurchaseEntry: (componentId: string) => void;
  onEditComponent: (component: InventoryComponent) => void;
  onOpenSellPart: (component?: InventoryComponent, purchaseEntryId?: string) => void;
  onOpenBulkEntry?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = React.memo(({
  isActive,
  onOpenAddComponent,
  onOpenAddPurchaseEntry,
  onEditComponent,
  onOpenSellPart,
  onOpenBulkEntry,
}) => {
  const {
    state,
    deletePurchaseEntry,
    deleteComponent,
  } = useInventory();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest-purchase');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const handleCategoryChange = React.useCallback((category: string) => {
    setSelectedCategory(category);
    setSearchQuery('');
  }, []);

  const filteredComponents = useMemo(() => filterAndSortComponents(state.components, {
    searchQuery: deferredSearchQuery,
    category: selectedCategory,
    subCategory: activeSubCategory,
    sortBy,
    builds: state.builds,
    onlyAvailable: true,
  }), [state.components, deferredSearchQuery, selectedCategory, activeSubCategory, sortBy, state.builds]);

  const groupedComponents = useMemo(() => {
    const precomputedMap = precomputeAssignedBatches(state.builds);
    return CATEGORIES.map((category) => {
      const items = filteredComponents.filter((c) => c.category === category);
      const totalUnits = items.reduce((sum, c) => {
        return sum + calculateUnassignedQuantityStrict(c, state.builds, precomputedMap);
      }, 0);
      const totalVal = items.reduce((sum, c) => sum + calculateUnassignedValueStrict(c, state.builds, precomputedMap), 0);
      return { category, items, totalUnits, totalVal };
    }).filter((group) => group.items.length > 0 && group.totalUnits > 0);
  }, [filteredComponents, state.builds]);

  const { looseValuation: unassignedValue, activeBuildsCost, totalStockValuation: totalInventoryValue } = useMemo(() => calculateInventoryMetrics(state), [state]);

  type VirtualInventoryRow = 
    | { type: 'header'; key: string; category: string; totalUnits: number; totalVal: number }
    | { type: 'item'; key: string; component: InventoryComponent };

  const virtualRows = useMemo<VirtualInventoryRow[]>(() => {
    const rows: VirtualInventoryRow[] = [];
    for (const group of groupedComponents) {
      rows.push({
        type: 'header',
        key: `header-${group.category}`,
        category: group.category,
        totalUnits: group.totalUnits,
        totalVal: group.totalVal,
      });
      for (const component of group.items) {
        rows.push({
          type: 'item',
          key: `items-${group.category}-${component.id}`,
          component,
        });
      }
    }
    return rows;
  }, [groupedComponents]);

  const isVirtualized = virtualRows.length > 12;
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef<number>(0);

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? virtualRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      return row?.type === 'header' ? 34 : 110;
    },
    overscan: 4,
    getItemKey: (index) => virtualRows[index]?.key ?? index,
    useCachedMeasurements: !isActive,
    useFlushSync: false,
  });

  const handleScroll = useVirtualListScroll({
    isActive,
    isVirtualized,
    parentRef,
    scrollOffsetRef,
    virtualizer: rowVirtualizer,
    resetDependencies: [selectedCategory, activeSubCategory, sortBy, deferredSearchQuery],
  });

  const renderInventoryRow = (row: VirtualInventoryRow) => {
    if (row.type === 'header') {
      const headingContent = (
        <>
          <span className="flex items-center gap-2 text-xs font-bold text-zinc-100 sm:text-sm">
            <Layers className="h-4 w-4 text-[#B9EF68]" />
            {row.category}
          </span>
          <span>—</span>
          <span>{row.totalUnits} in stock</span>
          <span>—</span>
          <span className="font-semibold text-zinc-200">{formatCurrency(row.totalVal)}</span>
        </>
      );

      return <div className="inventory-group inventory-group-heading">{headingContent}</div>;
    }

    const component = row.component;
    const componentCard = (
      <div className="grid grid-cols-1 gap-2">
        <ComponentCard
          isActive={isActive !== false}
          isExpanded={expandedCardId === component.id}
          onToggle={() => setExpandedCardId(expandedCardId === component.id ? null : component.id)}
          component={component}
          onAddPurchaseEntry={onOpenAddPurchaseEntry}
          onDeletePurchaseEntry={deletePurchaseEntry}
          onEditComponent={onEditComponent}
          onDeleteComponent={deleteComponent}
          onSellPart={onOpenSellPart}
        />
      </div>
    );
    return componentCard;
  };

  return (
    <div className="stock-inventory-layout flex flex-col gap-4">
      <div className="inventory-capital">
        <div className="flex min-w-0 flex-col justify-center p-3 sm:p-4">
          <div className="app-metric-label">Unassigned</div>
          <div className="app-metric-value">{formatCurrency(unassignedValue)}</div>
        </div>
        <div className="flex min-w-0 flex-col justify-center p-3 sm:p-4">
          <div className="app-metric-label">Assigned</div>
          <div className="app-metric-value truncate text-[#83E5DF]">{formatCurrency(activeBuildsCost)}</div>
        </div>
        <div className="flex min-w-0 flex-col justify-center p-3 sm:p-4">
          <div className="app-metric-label">Total Value</div>
          <div className="app-metric-value truncate">{formatCurrency(totalInventoryValue)}</div>
        </div>
      </div>

      <div className="inventory-actions stock-actions-row">
        <button
          type="button"
          onClick={() => onOpenAddComponent()}
          className="app-button app-button-outline flex shrink-0 items-center justify-center gap-1.5 px-4"
          title="Add a new component"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Add Part</span>
        </button>
        {onOpenBulkEntry && (
          <button
            type="button"
            onClick={onOpenBulkEntry}
            className="app-button app-button-primary flex items-center justify-center gap-1.5 px-4"
            title="Fast Bulk Stock Entry via AI Text or Image Scan"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>AI Import</span>
          </button>
        )}
        <div className="stock-sort-control">
          <CustomSelect
            value={sortBy}
            onChange={(val) => setSortBy(val as SortOption)}
            options={[
              { value: 'newest-purchase', label: 'Recently Bought' },
              { value: 'highest-price', label: 'Highest Price Per Unit' },
              { value: 'lowest-price', label: 'Lowest Price Per Unit' },
              { value: 'highest-stock', label: 'Highest Units in Stock' },
              { value: 'lowest-stock', label: 'Lowest Units in Stock' },
            ]}
            icon={<ArrowDownWideNarrow className="h-3.5 w-3.5 text-[#B9EF68]" />}
            className="w-full"
            dropdownClassName="py-1.5"
            fitLongestOption={false}
          />
        </div>
      </div>

      <div className="inventory-filters">
        <InventoryFilterBar
          builds={state.builds}
          components={state.components.filter(c => calculateUnassignedQuantityStrict(c, state.builds) > 0)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={selectedCategory}
          onCategoryChange={(c) => { handleCategoryChange(c); setActiveSubCategory(''); }}
          activeSubCategory={activeSubCategory}
          onSubCategoryChange={setActiveSubCategory}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          showSort={false}
          onlyAvailable={true}
        />
      </div>

      {/* Grouped Component Cards List (Virtualized) */}
      {groupedComponents.length === 0 ? (
        <div className="app-panel space-y-3 p-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] text-zinc-400 flex items-center justify-center mx-auto border border-white/[0.06]">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            No unassigned parts in stock
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            All current inventory parts are assigned to active builds or sold. Add new stock to track inventory.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAddComponent()}
              className="app-button app-button-primary inline-flex items-center gap-1.5 px-4"
            >
              <Plus className="w-4 h-4" /> Add New Component
            </button>
          </div>
        </div>
      ) : !isVirtualized ? (
        <div>
          {virtualRows.map((row) => (
            <div
              key={row.key}
              className="inventory-stock-row"
              data-type={row.type}
            >
              {renderInventoryRow(row)}
            </div>
          ))}
        </div>
      ) : (
        <div 
          ref={parentRef}
          onScroll={handleScroll}
          className="max-h-[75dvh] min-h-[360px] overflow-y-auto pr-1"
          style={{
            overflowAnchor: 'none',
            scrollbarWidth: 'thin',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize() + 76}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={row.key}
                  className="inventory-stock-row"
                  data-type={row.type}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderInventoryRow(row)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
