import React, { useState, useDeferredValue } from 'react';
import { PCBuild, ComponentCategory } from '../../types';
import {
  calculateUnassignedQuantityStrict,
  getAllBatchesWithRemaining,
  filterAndSortComponents,
  getConditionColor,
  formatCurrency,
} from '../../utils/helpers';
import { X, Box, ChevronDown, ChevronUp, Monitor, Cpu, HardDrive, Database, CircuitBoard, Zap, Fan, Package } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { InventoryFilterBar } from '../InventoryFilterBar';
import { ConfirmModal } from '../ConfirmModal';
import { useToast } from '../../context/ToastContext';

interface AllocatePartModalProps {
  build: PCBuild | null;
  onClose: () => void;
}

export const AllocatePartModal: React.FC<AllocatePartModalProps> = ({ build, onClose }) => {
  const { state, allocatePartToBuild } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const [searchQuery, setSearchQuery] = useState('');
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
    const className = 'w-4 h-4 text-[#A8FF3E]';
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

  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory | 'All'>('All');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('');

  const filteredComponents = filterAndSortComponents(state.components, {
    searchQuery: deferredSearchQuery,
    category: activeCategoryTab === 'All' ? undefined : activeCategoryTab,
    subCategory: activeSubCategory,
    onlyAvailable: true,
    builds: state.builds,
  });

  if (!build) return null;

  return (
    <BottomSheetModal isOpen={true} onClose={onClose} className="max-w-lg">
      <div className="space-y-3.5 w-full">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Box className="w-4 h-4 text-[#A8FF3E]" /> Allocate Inventory Component
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E]"
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

        <InventoryFilterBar
          components={state.components}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategoryTab}
          onCategoryChange={(c) => { setActiveCategoryTab(c as ComponentCategory | 'All'); setActiveSubCategory(''); }}
          onlyAvailable={true}
          activeSubCategory={activeSubCategory}
          onSubCategoryChange={setActiveSubCategory}
        />

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
              <div 
                key={comp.id} 
                className="bg-[#101719] border border-white/[0.08] hover:border-[#A8FF3E]/40 rounded-xl mb-2 transition-all overflow-hidden"
              >
                <div 
                  onClick={() => setExpandedPartId(isExpanded ? null : comp.id)}
                  className="p-3 cursor-pointer flex items-start gap-2.5 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#A8FF3E]/15 border border-[#A8FF3E]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {renderCategoryIcon(comp.category)}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100 break-words leading-snug transition-colors font-sans">{comp.name}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {comp.tags && comp.tags[0] && (
                        <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                          {comp.tags[0]}
                        </span>
                      )}
                      <span className="bg-[#A8FF3E]/15 border border-[#A8FF3E]/30 text-[#62E6E6] shrink-0 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                        {unassignedQty} in stock
                      </span>
                      <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                        Avg: {formatCurrency(avgPrice)}/ea
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 ml-1.5 self-center">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-white/[0.08] bg-[#0B1113] p-3 space-y-2">
                    {availableBatches.map(({ entry, availableQuantity, unitCost }) => {
                      const quantityKey = `${comp.id}:${entry.id}`;
                      const quantityValue = allocationQuantities[quantityKey] ?? '1';
                      return (
                        <div
                          key={entry.id}
                          className="bg-[#101719] border border-white/[0.08] hover:border-[#A8FF3E]/40 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition-all"
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px] font-mono">
                              {entry.date}
                            </span>
                            <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center ${getConditionColor(entry.condition)}`}>
                              {entry.condition}
                            </span>
                            <span className="bg-white/[0.06] text-zinc-200 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center">
                              {availableQuantity} available @ {formatCurrency(unitCost)}
                            </span>
                            {!hideSupplierNames && entry.platform && (
                              <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px]">
                                {entry.platform}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-auto w-full sm:w-auto">
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
                              className="w-16 h-8 bg-[#0B1113] border border-white/[0.1] rounded-lg px-2 text-center text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#A8FF3E] focus:ring-1 focus:ring-[#A8FF3E]/40"
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
                                className="bg-[#A8FF3E] hover:bg-[#C4FF79] text-[#07100B] shadow-sm shadow-[#A8FF3E]/20 transition-all shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E]"
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
          isOpen={!!pendingAllocation}
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
