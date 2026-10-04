import React, { useState, useDeferredValue, useMemo } from 'react';
import { PCBuild, ComponentCategory, CATEGORIES } from '../../types';
import {
  calculateUnassignedQuantityStrict,
  calculateUnassignedValueStrict,
  precomputeAssignedBatches,
  filterAndSortComponents,
  formatCurrency,
  getConflictingTags,
  SortOption,
} from '../../utils/helpers';
import { X, Box, Layers } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { InventoryFilterBar } from '../InventoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { ComponentCard } from '../ComponentCard';

interface AllocatePartModalProps {
  build: PCBuild | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const AllocatePartModal: React.FC<AllocatePartModalProps> = ({ build, isOpen = true, onClose }) => {
  const { state, allocatePartToBuild } = useInventory();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest-purchase');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
  const [allocationQuantities, setAllocationQuantities] = useState<Record<string, string>>({});
  const [pendingAllocation, setPendingAllocation] = useState<{
    componentId: string;
    componentName: string;
    entryId: string;
    condition: string;
    date: string;
    unitCost: number;
    quantity: number;
  } | null>(null);

  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory | 'ALL'>('ALL');
  const [activeSubTags, setActiveSubTags] = useState<string[]>([]);

  const handleCategoryChange = (c: string) => {
    setActiveCategoryTab(c as ComponentCategory | 'ALL');
    setActiveSubTags([]);
  };

  const handleSubTagToggle = (tag: string) => {
    setActiveSubTags((prev) => {
      const isAlreadyActive = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (isAlreadyActive) {
        return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      }
      const conflicting = getConflictingTags(tag, activeCategoryTab === 'ALL' ? undefined : activeCategoryTab);
      const conflictingNormalized = conflicting.map((c) => c.toLowerCase());
      const filtered = prev.filter((t) => !conflictingNormalized.includes(t.toLowerCase()));
      return [...filtered, tag];
    });
  };

  const filteredComponents = useMemo(() => filterAndSortComponents(state.components, {
    searchQuery: deferredSearchQuery,
    category: activeCategoryTab === 'ALL' ? undefined : activeCategoryTab,
    subTags: activeSubTags,
    onlyAvailable: true,
    builds: state.builds,
    sortBy,
  }), [state.components, deferredSearchQuery, activeCategoryTab, activeSubTags, sortBy, state.builds]);

  const groupedComponents = useMemo(() => {
    const precomputedMap = precomputeAssignedBatches(state.builds);
    if (activeCategoryTab !== 'ALL') {
      const items = filteredComponents.filter(c => calculateUnassignedQuantityStrict(c, state.builds, precomputedMap) > 0);
      const totalUnits = items.reduce((sum, c) => sum + calculateUnassignedQuantityStrict(c, state.builds, precomputedMap), 0);
      const totalVal = items.reduce((sum, c) => sum + calculateUnassignedValueStrict(c, state.builds, precomputedMap), 0);
      return [{ category: activeCategoryTab, items, totalUnits, totalVal }].filter(g => g.items.length > 0 && g.totalUnits > 0);
    }
    return CATEGORIES.map((category) => {
      const items = filteredComponents.filter((c) => c.category === category && calculateUnassignedQuantityStrict(c, state.builds, precomputedMap) > 0);
      const totalUnits = items.reduce((sum, c) => {
        return sum + calculateUnassignedQuantityStrict(c, state.builds, precomputedMap);
      }, 0);
      const totalVal = items.reduce((sum, c) => sum + calculateUnassignedValueStrict(c, state.builds, precomputedMap), 0);
      return { category, items, totalUnits, totalVal };
    }).filter((group) => group.items.length > 0 && group.totalUnits > 0);
  }, [filteredComponents, activeCategoryTab, state.builds]);

  if (!build) return null;

  const hasAnyItems = groupedComponents.some(g => g.items.length > 0);

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} layout="workspace" className="build-modal stock-modal max-w-2xl sm:max-w-3xl w-full">
      <div className="allocate-modal-content w-full">
        <div className="allocate-modal-header flex items-center justify-between border-b border-white/[0.08] pb-2">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Box className="w-4 h-4 text-[#B9EF68]" /> Allocate Inventory Component
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-[#141c1f] text-zinc-400 hover:text-white hover:border-white/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-400 font-sans">
          Select an available component from inventory to assign to{' '}
          <strong className="text-zinc-200">{build.name}</strong>.
          {build.status === 'Sold' && (
            <span className="block mt-1 text-rose-300">
              Adding to a sold build will update its recorded cost and profit.
            </span>
          )}
        </p>

        <div className="allocate-filter-bar">
          <InventoryFilterBar
            components={state.components}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeCategory={activeCategoryTab}
            onCategoryChange={handleCategoryChange}
            onlyAvailable={true}
            activeSubTags={activeSubTags}
            onSubTagToggle={handleSubTagToggle}
            builds={state.builds}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            compactControls
          />
        </div>

        <div className="allocate-results modal-results-list overflow-y-auto pr-1">
          {!hasAnyItems ? (
            <div className="text-center py-8 px-4 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/[0.08] rounded-xl bg-[#101719]/50 mt-2">
              <Box className="w-7 h-7 mb-2 text-zinc-500" />
              <p className="text-xs font-medium text-zinc-400">No compatible parts found</p>
            </div>
          ) : (
            groupedComponents.map((group) => (
              <div key={group.category} className="mb-2">
                <div className="inventory-group inventory-group-heading">
                  <span className="flex items-center gap-2 text-xs font-bold text-zinc-100 sm:text-sm">
                    <Layers className="h-4 w-4 text-[#B9EF68]" />
                    {group.category}
                  </span>
                  <span>—</span>
                  <span>{group.totalUnits} in stock</span>
                  <span>—</span>
                  <span className="font-semibold text-zinc-200">{formatCurrency(group.totalVal)}</span>
                </div>
                <div className="grid grid-cols-1 gap-[5px]">
                  {group.items.map((comp) => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      isExpanded={expandedPartId === comp.id}
                      onToggle={() => setExpandedPartId(expandedPartId === comp.id ? null : comp.id)}
                      showAdminActions={false}
                      renderBatchActions={(batch) => {
                        const quantityKey = `${comp.id}:${batch.entry.id}`;
                        const rawVal = Number(allocationQuantities[quantityKey]);
                        const quantityValue = Math.min(
                          batch.availableQuantity,
                          Math.max(1, Number.isFinite(rawVal) && rawVal > 0 ? rawVal : 1)
                        );
                        return (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* - + Stepper */}
                            <div className="flex h-[26px] min-h-[26px] items-center rounded-md border border-[#B9EF68]/30 bg-[#0e1518] overflow-hidden shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setAllocationQuantities((current) => ({
                                    ...current,
                                    [quantityKey]: Math.max(1, quantityValue - 1).toString(),
                                  }));
                                }}
                                disabled={quantityValue <= 1}
                                className="flex !h-[26px] !min-h-[26px] w-[16px] min-w-[16px] max-w-[16px] !p-0 items-center justify-center text-[#B9EF68] hover:bg-[#B9EF68]/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
                                aria-label="Decrease quantity"
                              >
                                <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 fill-current">
                                  <rect x="2" y="7" width="12" height="2" rx="1" />
                                </svg>
                              </button>
                              <span className="flex !h-[26px] !min-h-[26px] w-[16px] min-w-[16px] max-w-[16px] !p-0 items-center justify-center font-mono text-[11px] font-bold leading-none text-[#B9EF68] border-x border-[#B9EF68]/20 select-none shrink-0">
                                {quantityValue}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAllocationQuantities((current) => ({
                                    ...current,
                                    [quantityKey]: Math.min(batch.availableQuantity, quantityValue + 1).toString(),
                                  }));
                                }}
                                disabled={quantityValue >= batch.availableQuantity}
                                className="flex !h-[26px] !min-h-[26px] w-[16px] min-w-[16px] max-w-[16px] !p-0 items-center justify-center text-[#B9EF68] hover:bg-[#B9EF68]/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
                                aria-label="Increase quantity"
                              >
                                <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 fill-current">
                                  <rect x="2" y="7" width="12" height="2" rx="1" />
                                  <rect x="7" y="2" width="2" height="12" rx="1" />
                                </svg>
                              </button>
                            </div>

                            {/* Assign Button (exact Sell button color) */}
                            <button
                              type="button"
                              onClick={() => {
                                setPendingAllocation({
                                  componentId: comp.id,
                                  componentName: comp.name,
                                  entryId: batch.entry.id,
                                  condition: batch.entry.condition,
                                  date: batch.entry.date,
                                  unitCost: batch.unitCost,
                                  quantity: quantityValue,
                                });
                              }}
                              className="flex h-[26px] min-h-[26px] items-center justify-center leading-none rounded-md border border-[#B9EF68]/35 px-2 text-[11px] font-semibold text-[#B9EF68] transition-colors hover:bg-[#B9EF68]/10 hover:text-white shrink-0 cursor-pointer"
                            >
                              <span className="leading-none pt-[0.5px]">Assign</span>
                            </button>
                          </div>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingAllocation && (
        <ConfirmModal
          isOpen={!!pendingAllocation && isOpen}
          title="Assign Component to Build?"
          message={`Assign ${pendingAllocation.quantity}x "${pendingAllocation.componentName}" (${pendingAllocation.condition}, purchased on ${pendingAllocation.date} @ ${formatCurrency(pendingAllocation.unitCost)}) to "${build.name}"?${build.status === 'Sold' ? ' This will update the sold build cost and recorded profit.' : ''}`}
          confirmText="Assign Part"
          variant="violet"
          onConfirm={() => {
            const result = allocatePartToBuild(
              build.id,
              pendingAllocation.componentId,
              pendingAllocation.entryId,
              pendingAllocation.quantity
            );
            if (!result.success) {
              showToast(result.error || 'Failed to allocate part to build.', 'error');
              setPendingAllocation(null);
              return;
            }
            showToast(
              `Successfully assigned ${pendingAllocation.quantity}x "${pendingAllocation.componentName}" to "${build.name}".`,
              'success'
            );
            setPendingAllocation(null);
            onClose();
          }}
          onCancel={() => setPendingAllocation(null)}
        />
      )}
    </BottomSheetModal>
  );
};
