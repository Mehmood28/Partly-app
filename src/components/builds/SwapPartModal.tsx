import React, { useState, useDeferredValue } from 'react';
import { PCBuild, PCBuildPart } from '../../types';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { Box, ArrowRightLeft, X } from 'lucide-react';
import { formatCurrency, getUnassignedBatches, filterAndSortComponents, determineSubCategory, SortOption } from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';
import { InventoryFilterBar } from '../InventoryFilterBar';
import { ComponentCard } from '../ComponentCard';

interface SwapPartModalProps {
  build: PCBuild;
  currentPart: PCBuildPart;
  isOpen?: boolean;
  onClose: () => void;
}

export const SwapPartModal: React.FC<SwapPartModalProps> = ({ build, currentPart, isOpen = true, onClose }) => {
  const { state, swapPartInBuild } = useInventory();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest-purchase');
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{
    componentId: string;
    componentName: string;
    purchaseEntryId: string;
    targetQty: number;
    condition: string;
    date: string;
    unitPrice: number;
  } | null>(null);

  const categoryParts = filterAndSortComponents(state.components, {
    searchQuery: deferredSearchQuery,
    category: currentPart.category,
    subCategory: activeFilter,
    sortBy,
    builds: state.builds,
    onlyAvailable: true,
  });

  // 2. Map parts to their actual available entries
  const availablePartsWithEntries = categoryParts.map(comp => {
    // getUnassignedBatches accounts for FIFO sold deductions AND assigned counts across all builds
    const validEntries = getUnassignedBatches(comp, state.builds).map(b => ({
      ...b.entry,
      availableQty: b.availableQuantity
    }));

    const totalAvailable = validEntries.reduce((sum, e) => sum + e.availableQty, 0);
    const avgPrice = totalAvailable > 0
      ? validEntries.reduce((sum, e) => sum + (e.unitPrice * e.availableQty), 0) / totalAvailable
      : 0;

    return {
      comp,
      validEntries,
      totalAvailable,
      avgPrice,
      subCategory: determineSubCategory(comp)
    };
  }).filter(item => item.totalAvailable > 0);

  const filteredParts = availablePartsWithEntries.sort((a, b) => {
    if (sortBy === 'highest-price') return b.avgPrice - a.avgPrice;
    if (sortBy === 'lowest-price') return a.avgPrice - b.avgPrice;
    if (sortBy === 'highest-stock') return b.totalAvailable - a.totalAvailable;
    if (sortBy === 'lowest-stock') return a.totalAvailable - b.totalAvailable;
    const latest = (entries: typeof a.validEntries) => entries.reduce((max, entry) => Math.max(max, new Date(entry.date).getTime() || 0), 0);
    return latest(b.validEntries) - latest(a.validEntries);
  });

  const handleSwap = (newComponentId: string, purchaseEntryId: string, targetQty: number) => {
    const result = swapPartInBuild(
      build.id,
      currentPart.componentId,
      currentPart.purchaseEntryId,
      newComponentId,
      purchaseEntryId,
      targetQty
    );

    if (!result.success) {
      const msg = result.error || 'Failed to swap part. Please check inventory stock.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }

    showToast('Part swapped successfully', 'success');
    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} layout="workspace" className="build-modal stock-modal max-w-2xl sm:max-w-3xl w-full">
      <div className="swap-modal-content w-full flex flex-col">
        {/* Header */}
        <div className="swap-modal-header flex items-center justify-between border-b border-white/[0.08] pb-2 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#B9EF68]" /> Swap {currentPart.category}
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

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3 py-2 rounded-xl flex items-center justify-between gap-2 shrink-0">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-200 p-0.5 rounded transition-colors shrink-0"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="swap-filter-bar shrink-0 w-full max-w-full min-w-0">
          <InventoryFilterBar
            components={state.components}
            builds={state.builds}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeCategory={currentPart.category}
            onCategoryChange={() => undefined}
            activeSubCategory={activeFilter}
            onSubCategoryChange={setActiveFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            showCategories={false}
            compactControls
          />
        </div>

        {/* List */}
        <div className="swap-results modal-results-list overflow-y-auto pr-1">
          {filteredParts.length === 0 ? (
            <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/[0.08] rounded-xl bg-[#101719]/50 mt-4">
              <Box className="w-8 h-8 mb-3 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-400">No compatible parts found</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">Try adjusting your search or filters, or ensure there is active stock.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[5px]">
              {filteredParts.map(({ comp }) => (
                <ComponentCard
                  key={comp.id}
                  component={comp}
                  isExpanded={expandedPartId === comp.id}
                  onToggle={() => setExpandedPartId(expandedPartId === comp.id ? null : comp.id)}
                  showAdminActions={false}
                  renderBatchActions={(batch) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setErrorMsg(null);
                        setPendingSwap({
                          componentId: comp.id,
                          componentName: comp.name,
                          purchaseEntryId: batch.entry.id,
                          targetQty: currentPart.quantity || 1,
                          condition: batch.entry.condition,
                          date: batch.entry.date,
                          unitPrice: batch.unitCost,
                        });
                      }}
                      className="flex h-[26px] items-center justify-center leading-none gap-1 rounded-lg border border-[#B9EF68]/35 px-2 text-xs font-semibold text-[#B9EF68] transition-colors hover:bg-[#B9EF68]/10 hover:text-white shrink-0 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-[#B9EF68]" /> <span className="leading-none pt-[0.5px]">Swap</span>
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingSwap && (
        <ConfirmModal
          isOpen={!!pendingSwap && isOpen}
          title="Swap Component in Build?"
          message={`Swap out "${currentPart.componentName}" and assign "${pendingSwap.componentName}" (${pendingSwap.condition}, purchased on ${pendingSwap.date} @ ${formatCurrency(pendingSwap.unitPrice)}) in "${build.name}"? The current part will return to loose stock.${build.status === 'Sold' ? ' The recorded sold-build cost and profit will be updated.' : ''}`}
          confirmText="Swap Part"
          variant="violet"
          onConfirm={() => {
            const swapTarget = pendingSwap;
            setPendingSwap(null);
            handleSwap(swapTarget.componentId, swapTarget.purchaseEntryId, swapTarget.targetQty);
          }}
          onCancel={() => setPendingSwap(null)}
        />
      )}
    </BottomSheetModal>
  );
};
