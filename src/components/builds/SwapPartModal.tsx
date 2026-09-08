import React, { useState, useDeferredValue } from 'react';
import { InventoryComponent, PCBuild, PCBuildPart } from '../../types';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { Box, ArrowRightLeft, X, Search, ChevronDown, ChevronUp , Monitor, Cpu, HardDrive, Database, CircuitBoard, Zap, Fan, Package} from 'lucide-react';
import { formatCurrency, getConditionColor, getUnassignedBatches } from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';

interface SwapPartModalProps {
  build: PCBuild;
  currentPart: PCBuildPart;
  onClose: () => void;
}

const getFilterChips = (category: string) => {
  switch (category) {
    case 'Storage': return ['All', 'Gen5', 'Gen4', 'Gen3'];
    case 'CPU': return ['All', 'AM5', 'AM4', 'Intel'];
    case 'Motherboard': return ['All', 'AM5', 'AM4', 'Intel', 'DDR5', 'DDR4'];
    case 'GPU': return ['All', '50 Series', '40 Series', '30 Series', 'AMD'];
    case 'RAM': return ['All', 'DDR5', 'DDR4'];
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

export const SwapPartModal: React.FC<SwapPartModalProps> = ({ build, currentPart, onClose }) => {
  const { state, swapPartInBuild } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState('All');
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
    const className = 'w-4 h-4 text-[#7C6CF2]';
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
    <BottomSheetModal isOpen={true} onClose={onClose} className="max-w-xl">
      <div className="space-y-4 w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#7C6CF2]" /> Swap {currentPart.category}
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]">
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
          <div className="relative w-full max-w-full min-w-0">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Search parts by name or model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full max-w-full box-border bg-[#121722] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors font-sans"
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
          
          {chips.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => setActiveFilter(activeFilter === chip ? 'All' : chip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
                    activeFilter === chip 
                      ? 'bg-[#7C6CF2] text-white shadow-sm shadow-[#7C6CF2]/20' 
                      : 'bg-[#121722] text-zinc-400 border border-white/[0.08] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto pr-1 space-y-2 pb-6 min-h-[45vh]">
          {filteredParts.map(({ comp, validEntries, totalAvailable, avgPrice, subCategory }) => {
            const isExpanded = expandedPartId === comp.id;
            
            return (
              <div key={comp.id} className="bg-[#121722] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl mb-2 transition-all overflow-hidden">
                {/* Main Accordion Header */}
                <div 
                  onClick={() => setExpandedPartId(isExpanded ? null : comp.id)}
                  className="p-3 cursor-pointer flex items-start gap-2.5 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {renderCategoryIcon(comp.category)}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 break-words transition-colors font-sans">{comp.name}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {subCategory && (
                        <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                          {subCategory}
                        </span>
                      )}
                      <span className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] shrink-0 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                        {totalAvailable} in stock
                      </span>
                      <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">Avg: ${avgPrice.toFixed(2)}/ea</span>
                    </div>
                  </div>
                  <div className="shrink-0 ml-2 self-center">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </div>

                {/* Expanded Batches */}
                {isExpanded && (
                  <div className="border-t border-white/[0.08] bg-[#0D1118] p-3 space-y-2">
                    {validEntries.map(entry => (
                      <div key={entry.id} className="bg-[#121722] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl p-2.5 flex items-start sm:items-center justify-between gap-2.5 transition-all">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px] font-mono">
                            {entry.date}
                          </span>
                          <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center ${getConditionColor(entry.condition)}`}>
                            {entry.condition}
                          </span>
                          <span className="bg-white/[0.06] text-zinc-200 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold leading-none inline-flex items-center justify-center">
                            {entry.availableQty} of {entry.quantity} available @ {formatCurrency(entry.unitPrice)}
                          </span>
                          {!hideSupplierNames && entry.platform && (
                            <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px]">
                              {entry.platform}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
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
                            className="bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white shadow-sm shadow-[#7C6CF2]/20 transition-all shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
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
            <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/[0.08] rounded-xl bg-[#121722]/50 mt-4">
              <Box className="w-8 h-8 mb-3 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-400">No compatible parts found</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">Try adjusting your search or filters, or ensure there is active stock.</p>
            </div>
          )}
        </div>
      </div>

      {pendingSwap && (
        <ConfirmModal
          isOpen={!!pendingSwap}
          title="Swap Component in Build?"
          message={`Swap out "${currentPart.componentName}" and assign "${pendingSwap.componentName}" (${pendingSwap.condition}, purchased on ${pendingSwap.date} @ ${formatCurrency(pendingSwap.unitPrice)}) in "${build.name}"? The current part will return to loose stock.`}
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
