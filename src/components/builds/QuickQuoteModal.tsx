import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Calculator, Copy, CheckCircle2 } from 'lucide-react';
import { ComponentCategory, InventoryComponent, PCBuildPart } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { BuildSelectedPartsList } from './createBuild/BuildSelectedPartsList';
import { BuildInventoryPicker } from './createBuild/BuildInventoryPicker';
import { formatCurrency, getConflictingTags } from '../../utils/helpers';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';
import { copyCleanSpecs } from '../../utils/cleanSpecsHelper';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickQuoteModal: React.FC<QuickQuoteModalProps> = ({ isOpen, onClose }) => {
  const { state } = useInventory();
  const { showToast } = useToast();

  const [salePrice, setSalePrice] = useState<string>('');
  const [selectedParts, setSelectedParts] = useState<PCBuildPart[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory | 'All' | 'ALL'>('ALL');
  const [activeSubTags, setActiveSubTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSpecs, setCopiedSpecs] = useState<boolean>(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategoryTab(category as ComponentCategory | 'All' | 'ALL');
    setActiveSubTags([]);
    setSearchQuery('');
  }, []);

  const handleSubTagToggle = useCallback((tag: string) => {
    setActiveSubTags((prev) => {
      const isAlreadyActive = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (isAlreadyActive) {
        return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      }
      const conflicting = getConflictingTags(
        tag,
        activeCategoryTab === 'ALL' || activeCategoryTab === 'All' ? undefined : activeCategoryTab
      );
      const conflictingNormalized = conflicting.map((c) => c.toLowerCase());
      const filtered = prev.filter((t) => !conflictingNormalized.includes(t.toLowerCase()));
      return [...filtered, tag];
    });
  }, [activeCategoryTab]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const handleResetAndClose = useCallback(() => {
    setSalePrice('');
    setSelectedParts([]);
    setSearchQuery('');
    setActiveCategoryTab('ALL');
    setActiveSubTags([]);
    setCopiedSpecs(false);
    onClose();
  }, [onClose]);

  const handleResetQuote = useCallback(() => {
    setSalePrice('');
    setSelectedParts([]);
    setSearchQuery('');
    setActiveCategoryTab('ALL');
    setActiveSubTags([]);
    setCopiedSpecs(false);
  }, []);

  // Parts management (held purely in memory)
  const handleAddPart = useCallback((comp: InventoryComponent, entryId: string) => {
    const entry = comp.purchaseHistory.find((e) => e.id === entryId);
    if (!entry) return;
    const avgCost = entry.unitPrice;

    setSelectedParts((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.componentId === comp.id && p.purchaseEntryId === entryId
      );

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: existing.quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          componentId: comp.id,
          purchaseEntryId: entryId,
          componentName: comp.name,
          category: comp.category,
          quantity: 1,
          unitCostAtAssignment: avgCost,
        },
      ];
    });
  }, []);

  const handleUpdatePartQty = useCallback((componentId: string, entryId: string | undefined, delta: number) => {
    setSelectedParts((prev) =>
      prev
        .map((part) => {
          if (part.componentId === componentId && part.purchaseEntryId === entryId) {
            const newQty = part.quantity + delta;
            if (newQty <= 0) return null;
            return { ...part, quantity: newQty };
          }
          return part;
        })
        .filter((p): p is PCBuildPart => p !== null)
    );
  }, []);

  const handleRemovePart = useCallback((componentId: string, entryId?: string) => {
    setSelectedParts((prev) =>
      prev.filter((p) => !(p.componentId === componentId && p.purchaseEntryId === entryId))
    );
  }, []);

  const totalBuildCost = useMemo(
    () => selectedParts.reduce((sum, p) => sum + p.quantity * p.unitCostAtAssignment, 0),
    [selectedParts]
  );

  const { targetPrice, profit, margin } = useMemo(() => {
    const price = parseFloat(salePrice) || 0;
    const p = price > 0 ? price - totalBuildCost : 0;
    const m = price > 0 ? (p / price) * 100 : 0;
    return { targetPrice: price, profit: p, margin: m };
  }, [salePrice, totalBuildCost]);

  const handleCopySpecs = useCallback(async () => {
    if (selectedParts.length === 0) {
      showToast('Select at least one part to copy specifications.', 'error');
      return;
    }
    const result = await copyCleanSpecs(selectedParts);
    if (result.success) {
      showToast('Copied clean PC specs to clipboard!', 'success');
      setCopiedSpecs(true);
      setTimeout(() => setCopiedSpecs(false), 2000);
    } else {
      showToast('Failed to copy clean PC specs to clipboard.', 'error');
    }
  }, [selectedParts, showToast]);

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      layout="workspace"
      className="build-modal stock-modal build-editor-modal max-w-4xl"
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {/* Header */}
        <div className="build-editor-header flex shrink-0 items-start justify-between border-b border-white/[0.09] pb-3 pt-1">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-zinc-100 sm:text-lg">
              <Calculator className="h-4 w-4 text-[#83E5DF]" /> Quick Quote Sandbox
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
              Simulate build costs and pricing in memory. Never saves to database or mutates inventory stock.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="build-editor-body min-h-0 flex-1 overflow-y-auto space-y-4 pt-3">
          {/* Top Bar: Target Sale Price Input & Financial Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 border-b border-white/[0.09] pb-3.5 text-xs">
            <div className="sm:col-span-1">
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Target Sale Price ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="app-field px-3 pl-7 font-mono text-xs placeholder:text-zinc-600"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="sm:col-span-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-[#101719] p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Total Cost</span>
                <span className="text-sm font-bold font-mono text-zinc-200 mt-1">{formatCurrency(totalBuildCost)}</span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#101719] p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Projected Profit</span>
                <span className={`text-sm font-bold font-mono mt-1 ${getProfitTextColor(targetPrice > 0 ? profit : 0)}`}>
                  {formatSignedCurrency(targetPrice > 0 ? profit : 0)}
                </span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#101719] p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Profit Margin</span>
                <span className={`text-sm font-bold font-mono mt-1 ${targetPrice > 0 && profit > 0 ? 'text-emerald-400' : targetPrice > 0 && profit < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {targetPrice > 0 ? `${Math.round(margin)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Selected Parts List */}
          <BuildSelectedPartsList
            selectedParts={selectedParts}
            components={state.components}
            totalBuildCost={totalBuildCost}
            salePrice={salePrice}
            onUpdatePartQty={handleUpdatePartQty}
            onRemovePart={handleRemovePart}
            hideTotalsHeader
          />

          {/* Inventory Picker */}
          <BuildInventoryPicker
            components={state.components}
            builds={state.builds}
            selectedParts={selectedParts}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            activeCategoryTab={activeCategoryTab}
            onCategoryChange={handleCategoryChange}
            activeSubTags={activeSubTags}
            onSubTagToggle={handleSubTagToggle}
            onAddPart={handleAddPart}
          />
        </div>

        {/* Footer */}
        <div className="build-editor-footer shrink-0 border-t border-white/[0.09] pt-2 mt-2">
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleResetQuote}
              className="app-button px-3.5 text-xs text-zinc-300 hover:text-white shrink-0"
            >
              Reset Quote
            </button>
            <button
              type="button"
              onClick={handleResetAndClose}
              className="app-button px-4 shrink-0"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopySpecs}
              className="app-button app-button-primary flex-1 min-w-0 flex items-center justify-center gap-1.5 px-4"
            >
              <span className="flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden">
                {copiedSpecs ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-950 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span className="truncate">Copy Specs ({selectedParts.length} Parts)</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
