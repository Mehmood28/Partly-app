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
import { Plus, Filter, Zap, Layers } from 'lucide-react';

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
    | { type: 'items_row'; key: string; items: InventoryComponent[] };

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
      for (let i = 0; i < group.items.length; i += 2) {
        const slice = group.items.slice(i, i + 2);
        rows.push({
          type: 'items_row',
          key: `items-${group.category}-${slice.map(c => c.id).join('-')}`,
          items: slice,
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

  // Restore scroll position when tab becomes active (virtualized path only)
  React.useLayoutEffect(() => {
    if (isActive && isVirtualized && parentRef.current && scrollOffsetRef.current > 0) {
      const maxScroll = Math.max(0, parentRef.current.scrollHeight - parentRef.current.clientHeight);
      const targetOffset = Math.min(scrollOffsetRef.current, maxScroll);
      scrollOffsetRef.current = targetOffset;
      queueMicrotask(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = targetOffset;
          rowVirtualizer.scrollToOffset(targetOffset);
        }
      });
    } else if (!isVirtualized) {
      scrollOffsetRef.current = 0;
    }
  }, [isActive, isVirtualized, rowVirtualizer]);

  // Reset list scroll to top only when user changes local filter/search/sort criteria
  const isFirstFilterRun = useRef(true);
  React.useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    scrollOffsetRef.current = 0;
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
    if (isVirtualized) {
      rowVirtualizer.scrollToOffset(0);
    }
  }, [selectedCategory, activeSubCategory, sortBy, deferredSearchQuery, isVirtualized, rowVirtualizer]);

  return (
    <div className="space-y-2">
      {/* Compact 3-Metric Capital Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-white/[0.08] bg-[#0D1118] rounded-xl p-2.5 flex flex-col justify-center shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Unassigned</div>
          <div className="text-emerald-400 font-bold text-sm sm:text-base font-mono mt-0.5 leading-tight">{formatCurrency(unassignedValue)}</div>
        </div>
        <div className="border border-white/[0.08] bg-[#0D1118] rounded-xl p-2.5 flex flex-col justify-center shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Assigned</div>
          <div className="text-[#9D91FA] font-bold text-sm sm:text-base font-mono mt-0.5 leading-tight">{formatCurrency(activeBuildsCost)}</div>
        </div>
        <div className="border border-white/[0.08] bg-[#0D1118] rounded-xl p-2.5 flex flex-col justify-center shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Value</div>
          <div className="text-zinc-100 font-bold text-sm sm:text-base font-mono mt-0.5 leading-tight">{formatCurrency(totalInventoryValue)}</div>
        </div>
      </div>

      {/* Unified In Stock Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#0D1118] border border-white/[0.08] p-2.5 sm:p-3 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2] shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 leading-tight">
              IN STOCK
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Review all components currently available for builds or sale.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
          {onOpenBulkEntry && (
            <button
              type="button"
              onClick={onOpenBulkEntry}
              className="min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg transition-all bg-[#121722] hover:bg-[#182030] border border-white/[0.08] hover:border-[#7C6CF2]/40 text-zinc-100 flex items-center justify-center gap-1.5 cursor-pointer"
              title="Fast Bulk Stock Entry via AI Text or Image Scan"
            >
              <Zap className="w-3.5 h-3.5 text-[#7C6CF2] shrink-0" />
              <span>AI Import</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenAddComponent()}
            className="min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg transition-all bg-[#7C6CF2] hover:bg-[#6C5CE7] text-white shadow-sm shadow-[#7C6CF2]/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            title="Add a new component"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Part</span>
          </button>
        </div>
      </div>

      {/* Category Quick Filter Chips & Stock Search */}
      <div className="bg-[#0D1118] border border-white/[0.08] p-2.5 rounded-xl shadow-sm">
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
          onlyAvailable={true}
        />
      </div>

      {/* Grouped Component Cards List (Virtualized) */}
      {groupedComponents.length === 0 ? (
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
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
              className="bg-[#7C6CF2] hover:bg-[#6C5CE7] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm shadow-[#7C6CF2]/20"
            >
              <Plus className="w-4 h-4" /> Add New Component
            </button>
          </div>
        </div>
      ) : !isVirtualized ? (
        <div className="space-y-1.5 pr-1">
          {virtualRows.map((row) => {
            if (row.type === 'header') {
              return (
                <div key={row.key} className="pt-1.5 pb-0.5">
                  <div className="flex items-center justify-between text-xs font-mono px-1">
                    <span className="font-semibold text-zinc-200 tracking-wider uppercase text-xs sm:text-sm flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#7C6CF2]" />
                      {row.category}
                    </span>
                    <div className="flex items-center gap-2.5 text-zinc-400 text-xs">
                      <span>{row.totalUnits} in stock</span>
                      <span className="font-semibold text-zinc-200">{formatCurrency(row.totalVal)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={row.key}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {row.items.map((component) => (
                    <ComponentCard
                      isExpanded={expandedCardId === component.id}
                      onToggle={() => setExpandedCardId(expandedCardId === component.id ? null : component.id)}
                      key={component.id}
                      component={component}
                      onAddPurchaseEntry={onOpenAddPurchaseEntry}
                      onDeletePurchaseEntry={deletePurchaseEntry}
                      onEditComponent={onEditComponent}
                      onDeleteComponent={deleteComponent}
                      onSellPart={onOpenSellPart}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div 
          ref={parentRef}
          onScroll={(e) => {
            if (isActive) {
              scrollOffsetRef.current = e.currentTarget.scrollTop;
            }
          }}
          className="h-[calc(100dvh-285px)] md:h-[calc(100dvh-170px)] overflow-y-auto pr-1"
          style={{
            overflowAnchor: 'none',
            scrollbarWidth: 'thin',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;

              if (row.type === 'header') {
                return (
                  <div
                    key={row.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingTop: '6px',
                      paddingBottom: '3px',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-mono px-1">
                      <span className="font-semibold text-zinc-200 tracking-wider uppercase text-xs sm:text-sm flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#7C6CF2]" />
                        {row.category}
                      </span>
                      <div className="flex items-center gap-2.5 text-zinc-400 text-xs">
                        <span>{row.totalUnits} in stock</span>
                        <span className="font-semibold text-zinc-200">{formatCurrency(row.totalVal)}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={row.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '6px',
                  }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {row.items.map((component) => (
                      <ComponentCard
                        isExpanded={expandedCardId === component.id}
                        onToggle={() => setExpandedCardId(expandedCardId === component.id ? null : component.id)}
                        key={component.id}
                        component={component}
                        onAddPurchaseEntry={onOpenAddPurchaseEntry}
                        onDeletePurchaseEntry={deletePurchaseEntry}
                        onEditComponent={onEditComponent}
                        onDeleteComponent={deleteComponent}
                          onSellPart={onOpenSellPart}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
