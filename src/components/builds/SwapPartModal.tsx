import React, { useState, useDeferredValue } from 'react';
import { InventoryComponent, PCBuild, PCBuildPart } from '../../types';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { Box, ArrowRightLeft, X, Search, ChevronDown, ChevronUp, ArrowDownWideNarrow, Monitor, Cpu, HardDrive, Database, CircuitBoard, Zap, Fan, Package} from 'lucide-react';
import { formatCurrency, getUnassignedBatches, SUB_CATEGORIES, SortOption } from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';
import { CustomSelect } from '../ui/CustomSelect';

interface SwapPartModalProps {
  build: PCBuild;
  currentPart: PCBuildPart;
  isOpen?: boolean;
  onClose: () => void;
}

const getFilterChips = (category: string) => {
  switch (category) {
    case 'Storage':
    case 'CPU':
    case 'GPU':
    case 'RAM':
      return ['All', ...(SUB_CATEGORIES[category] || [])];
    case 'Motherboard':
      return ['All', ...(SUB_CATEGORIES.Motherboard || []), 'DDR5', 'DDR4'];
    default: return ['All'];
  }
};

const determineSubCategory = (comp: InventoryComponent, category: string): string | null => {
  const chips = getFilterChips(category).filter(c => c !== 'All');
  if (chips.length === 0) return null;
  const nameStr = typeof comp.name === 'string' ? comp.name : '';
  const specStr = typeof comp.specifications === 'string' ? comp.specifications : '';
  const tagsStr = Array.isArray(comp.tags) ? comp.tags.filter(t => typeof t === 'string').join(' ') : '';
  const text = `${nameStr} ${specStr} ${tagsStr}`.toLowerCase();
  for (const chip of chips) {
    const f = chip.toLowerCase();
    if (f === '50 series' && (text.includes('rtx 50') || text.includes('5090') || text.includes('5080') || text.includes('5070'))) return chip;
    if (f === '40 series' && (text.includes('rtx 40') || text.includes('4090') || text.includes('4080') || text.includes('4070') || text.includes('4060'))) return chip;
    if (f === '30 series' && (text.includes('rtx 30') || text.includes('3090') || text.includes('3080') || text.includes('3070') || text.includes('3060'))) return chip;
    if (f === 'amd' && (text.includes('radeon') || text.includes('rx '))) return chip;
    if (f === 'intel' && (text.includes('intel') || text.includes('core i') || text.includes('lga') || text.includes('z790') || text.includes('z890') || text.includes('b760') || text.includes('h610'))) return chip;
    if (text.includes(f)) return chip;
  }
  return null;
};

export const SwapPartModal: React.FC<SwapPartModalProps> = ({ build, currentPart, isOpen = true, onClose }) => {
  const { state, swapPartInBuild } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState('All');
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

  const chips = getFilterChips(currentPart.category);

  // 1. Process inventory for matching category
  const categoryParts = state.components.filter(c => c.category === currentPart.category);

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
      subCategory: determineSubCategory(comp, currentPart.category)
    };
  }).filter(item => item.totalAvailable > 0);

  // 3. Filter by search and chip
  const filteredParts = availablePartsWithEntries.filter(item => {
    if (searchQuery.trim() !== '') {
      const q = deferredSearchQuery.toLowerCase();
      const nameStr = typeof item.comp.name === 'string' ? item.comp.name : '';
      const specStr = typeof item.comp.specifications === 'string' ? item.comp.specifications : '';
      const matchText = `${nameStr} ${specStr}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    if (activeFilter !== 'All' && item.subCategory !== activeFilter) {
      return false;
    }
    return true;
  }).sort((a, b) => {
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
    <BottomSheetModal isOpen={isOpen} onClose={onClose} className="build-modal stock-modal modal-workspace max-w-xl">
      <div className="swap-modal-content w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#B9EF68]" /> Swap {currentPart.category}
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]">
            <X className="w-5 h-5" />
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
        <div className="space-y-3 shrink-0 w-full max-w-full min-w-0">
          <div className="swap-filter-row">
            <div className="relative w-full max-w-full min-w-0">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search parts by name or model..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="app-field w-full max-w-full box-border pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <CustomSelect
              value={sortBy}
              onChange={(value) => setSortBy(value as SortOption)}
              options={[
                { value: 'newest-purchase', label: 'Recently Bought' },
                { value: 'highest-price', label: 'Highest Price Per Unit' },
                { value: 'lowest-price', label: 'Lowest Price Per Unit' },
                { value: 'highest-stock', label: 'Highest Units in Stock' },
                { value: 'lowest-stock', label: 'Lowest Units in Stock' },
              ]}
              icon={<ArrowDownWideNarrow className="h-4 w-4 text-[#B9EF68]" />}
              className="swap-sort-select w-full"
            />
          </div>

          {chips.length > 1 && (
            <div className="swap-subcategory-filter flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
              {chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => setActiveFilter(activeFilter === chip ? 'All' : chip)}
                  className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap border-b-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                    activeFilter === chip
                      ? 'border-[#B9EF68] text-[#B9EF68]'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="swap-results modal-results-list overflow-y-auto pr-1">
          {filteredParts.map(({ comp, validEntries, totalAvailable, avgPrice, subCategory }) => {
            const isExpanded = expandedPartId === comp.id;

            return (
              <div key={comp.id} className={`swap-component-row ${isExpanded ? 'is-expanded' : ''}`}>
                {/* Main Accordion Header */}
                <div
                  onClick={() => setExpandedPartId(isExpanded ? null : comp.id)}
                  className="swap-component-header cursor-pointer group"
                >
                  <div className="swap-category-icon">
                    {renderCategoryIcon(comp.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 break-words transition-colors font-sans">{comp.name}</h4>
                    <div className="swap-component-meta">
                      {subCategory && <span>{subCategory}</span>}
                      {subCategory && <span>·</span>}
                      <span>{totalAvailable} in stock</span>
                      <span>·</span>
                      <span>Avg. {formatCurrency(avgPrice)}{totalAvailable > 1 ? '/ea' : ''}</span>
                    </div>
                  </div>
                  <div className="shrink-0 self-center">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </div>

                {/* Expanded Batches */}
                {isExpanded && (
                  <div className="swap-batches">
                    {validEntries.map(entry => (
                      <div key={entry.id} className="swap-batch-row">
                        <div className="swap-batch-details">
                          <strong>{entry.availableQty} available · {formatCurrency(entry.unitPrice)}{entry.availableQty > 1 ? '/ea' : ''}</strong>
                          <span>
                            {entry.condition} · {entry.date}
                            {!hideSupplierNames && entry.platform ? ` · ${entry.platform}` : ''}
                          </span>
                        </div>
                        <div className="shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setErrorMsg(null);
                              setPendingSwap({
                                componentId: comp.id,
                                componentName: comp.name,
                                purchaseEntryId: entry.id,
                                targetQty: currentPart.quantity || 1,
                                condition: entry.condition,
                                date: entry.date,
                                unitPrice: entry.unitPrice,
                              });
                            }}
                            className="app-button app-button-primary shrink-0 px-3"
                          >
                            Swap
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredParts.length === 0 && (
            <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/[0.08] rounded-xl bg-[#101719]/50 mt-4">
              <Box className="w-8 h-8 mb-3 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-400">No compatible parts found</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">Try adjusting your search or filters, or ensure there is active stock.</p>
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
