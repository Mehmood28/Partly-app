import React, { useState, useDeferredValue } from 'react';
import { PCBuild, ComponentCategory } from '../../types';
import {
  calculateUnassignedQuantityStrict,
  getAllBatchesWithRemaining,
  filterAndSortComponents,
  formatReadableDate,
  formatCurrency,
  SortOption,
} from '../../utils/helpers';
import { X, Box, ChevronDown, ChevronUp, Monitor, Cpu, HardDrive, Database, CircuitBoard, Zap, Fan, Package } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { InventoryFilterBar } from '../InventoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { normalizePlatform } from '../../utils/platformDisplay';

interface AllocatePartModalProps {
  build: PCBuild | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const AllocatePartModal: React.FC<AllocatePartModalProps> = ({ build, isOpen = true, onClose }) => {
  const { state, allocatePartToBuild } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
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

  const renderCategoryIcon = (category: string) => {
    const className = 'w-4 h-4 text-[#B9EF68]';
    switch (category) {
      case 'GPU': return <Monitor className={className} />;
      case 'CPU': return <Cpu className={className} />;
      case 'RAM': return <HardDrive className={className} />;
      case 'Storage': return <Database className={className} />;
      case 'Motherboard': return <CircuitBoard className={className} />;
      case 'PSU': return <Zap className={className} />;
      case 'Cooling': return <Fan className={className} />;
      case 'Case': return <Package className={className} />;
      default: return <Cpu className={className} />;
    }
  };

  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory | 'ALL'>('ALL');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('');

  const filteredComponents = filterAndSortComponents(state.components, {
    searchQuery: deferredSearchQuery,
    category: activeCategoryTab === 'ALL' ? undefined : activeCategoryTab,
    subCategory: activeSubCategory,
    onlyAvailable: true,
    builds: state.builds,
    sortBy,
  });

  if (!build) return null;

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} layout="workspace" className="build-modal stock-modal max-w-xl">
      <div className="allocate-modal-content w-full">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Box className="w-4 h-4 text-[#B9EF68]" /> Allocate Inventory Component
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
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
            onCategoryChange={(c) => { setActiveCategoryTab(c as ComponentCategory | 'ALL'); setActiveSubCategory(''); }}
            onlyAvailable={true}
            activeSubCategory={activeSubCategory}
            onSubCategoryChange={setActiveSubCategory}
            builds={state.builds}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            compactControls
          />
        </div>

        <div className="allocate-results modal-results-list overflow-y-auto pr-1">
          {filteredComponents.length === 0 ? (
            <div className="text-center py-8 px-4 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/[0.08] rounded-xl bg-[#101719]/50 mt-2">
              <Box className="w-7 h-7 mb-2 text-zinc-500" />
              <p className="text-xs font-medium text-zinc-400">No compatible parts found</p>
            </div>
          ) : filteredComponents.map((comp) => {
            const batches = getAllBatchesWithRemaining(comp, state.builds);
            const availableBatches = batches.filter((b) => b.availableQuantity > 0);
            if (availableBatches.length === 0) return null;
            const unassignedQty = calculateUnassignedQuantityStrict(comp, state.builds);
            const totalAvailable = availableBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
            const avgPrice =
              totalAvailable > 0
                ? availableBatches.reduce((sum, b) => sum + b.unitCost * b.availableQuantity, 0) / totalAvailable
                : 0;
            const isExpanded = expandedPartId === comp.id;

            return (
              <div key={comp.id} className={`swap-component-row ${isExpanded ? 'is-expanded' : ''}`}>
                <div 
                  onClick={() => setExpandedPartId(isExpanded ? null : comp.id)}
                  className="swap-component-header cursor-pointer group"
                >
                  <div className="swap-category-icon">
                    {renderCategoryIcon(comp.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words font-sans text-xs font-semibold leading-snug text-zinc-100 sm:text-sm">{comp.name}</h4>
                    <div className="swap-component-meta">
                      {comp.tags?.filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}
                      {comp.specifications && <span>{comp.specifications}</span>}
                      <span>{unassignedQty} in stock</span>
                      <span>·</span>
                      <span>Avg. {formatCurrency(avgPrice)}{totalAvailable > 1 ? '/ea' : ''}</span>
                    </div>
                  </div>
                  <div className="shrink-0 self-center">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="swap-batches">
                    {availableBatches.map(({ entry, availableQuantity, unitCost }) => {
                      const quantityKey = `${comp.id}:${entry.id}`;
                      const quantityValue = allocationQuantities[quantityKey] ?? '1';
                      return (
                        <div key={entry.id} className="allocate-batch-row">
                          <div className="swap-batch-details">
                            <strong>{availableQuantity} available · {formatCurrency(unitCost)}{availableQuantity > 1 ? '/ea' : ''}</strong>
                            <span>
                              {entry.condition}
                              {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}
                              {!hideSupplierNames && entry.platform ? ` · ${normalizePlatform(String(entry.platform))}` : ''}
                              {entry.date ? ` · ${formatReadableDate(entry.date) || entry.date}` : ''}
                            </span>
                          </div>
                          <div className="allocate-batch-actions">
                            <input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max={availableQuantity}
                              step="1"
                              value={quantityValue}
                              onChange={(event) => {
                                const value = event.target.value;
                                setAllocationQuantities((current) => ({
                                  ...current,
                                  [quantityKey]: value,
                                }));
                              }}
                              aria-label={`Quantity of ${comp.name} to assign`}
                              className="app-field h-8 w-14 px-1 text-center font-mono text-xs"
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const requestedQuantity = Number(quantityValue);
                                  if (
                                    !Number.isFinite(requestedQuantity) ||
                                    !Number.isInteger(requestedQuantity) ||
                                    requestedQuantity <= 0
                                  ) {
                                    showToast('Quantity must be a positive whole number.', 'error');
                                    return;
                                  }
                                  if (requestedQuantity > availableQuantity) {
                                    showToast(`Only ${availableQuantity} available from this batch.`, 'error');
                                    return;
                                  }
                                  setPendingAllocation({
                                    componentId: comp.id,
                                    componentName: comp.name,
                                    entryId: entry.id,
                                    condition: entry.condition,
                                    date: entry.date,
                                    unitCost,
                                    quantity: requestedQuantity,
                                  });
                                }}
                                className="app-button app-button-primary shrink-0 px-3"
                              >
                                Assign
                              </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
