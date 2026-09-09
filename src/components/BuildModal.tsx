import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Hammer } from 'lucide-react';
import { BuildStatus, ComponentCategory, InventoryComponent, PCBuild, PCBuildPart } from '../types';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { BottomSheetModal } from './ui/BottomSheetModal';
import { BuildBasicDetails } from './builds/createBuild/BuildBasicDetails';
import { BuildSelectedPartsList } from './builds/createBuild/BuildSelectedPartsList';
import { BuildInventoryPicker } from './builds/createBuild/BuildInventoryPicker';
import { generateBuildTitleFromParts } from './builds/createBuild/buildModalHelpers';
import { calculateComponentBatchesWithStock } from './builds/createBuild/buildModalHelpers';
import { getAllBatchesWithRemaining } from '../utils/helpers';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (build: Omit<PCBuild, 'id' | 'createdDate'>) => void;
  initialData?: Partial<PCBuild>;
}

export const BuildModal: React.FC<BuildModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const { state } = useInventory();
  const { showToast } = useToast();

  const [name, setName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<BuildStatus>('Listed for Sale');
  const [warrantyDays, setWarrantyDays] = useState<string>('30');
  const [customWarrantyDays, setCustomWarrantyDays] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [selectedParts, setSelectedParts] = useState<PCBuildPart[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory | 'All' | 'ALL'>('ALL');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const prevInitialDataRef = useRef(initialData);
  const hasAutoFilledRef = useRef<boolean>(!!initialData?.name);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategoryTab(category as ComponentCategory | 'All' | 'ALL');
    setSearchQuery('');
  }, []);

  const handleSubCategoryChange = useCallback((subCat: string) => {
    setActiveSubCategory(subCat);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (initialData !== prevInitialDataRef.current) {
      prevInitialDataRef.current = initialData;
      if (initialData) {
        setName(initialData.name || '');
        setNotes(initialData.notes || '');
        setStatus((initialData.status as BuildStatus) || 'Listed for Sale');
        setSalePrice(initialData.estimatedCost?.toString() || initialData.salePrice?.toString() || '');
        setSelectedParts(initialData.parts || []);
        setImageUrl(initialData.imageUrl || '');
        const wDays = initialData.warrantyDays ?? 30;
        if ([30, 60, 90, 365].includes(wDays)) {
          setWarrantyDays(String(wDays));
          setCustomWarrantyDays('');
        } else {
          setWarrantyDays('Custom');
          setCustomWarrantyDays(String(wDays));
        }
        hasAutoFilledRef.current = true;
      } else {
        setName('');
        setNotes('');
        setStatus('Listed for Sale');
        setWarrantyDays('30');
        setCustomWarrantyDays('');
        setSalePrice('');
        setSelectedParts([]);
        setImageUrl('');
        hasAutoFilledRef.current = false;
      }
      setSearchQuery('');
      setActiveCategoryTab('ALL');
      setActiveSubCategory('');
    }
  }, [initialData]);

  const handleCloseAndReset = () => {
    setName('');
    setNotes('');
    setStatus('Listed for Sale');
        setWarrantyDays('30');
        setCustomWarrantyDays('');
    setSalePrice('');
    setSelectedParts([]);
    setImageUrl('');
    setSearchQuery('');
    setActiveCategoryTab('ALL');
    setActiveSubCategory('');
    hasAutoFilledRef.current = false;
    onClose();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    hasAutoFilledRef.current = true;
  };

  const handleAutoFillTitle = () => {
    const generatedTitle = generateBuildTitleFromParts(selectedParts);
    setName(generatedTitle);
    hasAutoFilledRef.current = true;
  };

  useEffect(() => {
    if (!hasAutoFilledRef.current && !name && selectedParts.some((p) => p.category === 'CPU') && selectedParts.some((p) => p.category === 'GPU')) {
      const generatedTitle = generateBuildTitleFromParts(selectedParts);
      if (generatedTitle) {
        setName(generatedTitle);
        hasAutoFilledRef.current = true;
      }
    }
  }, [selectedParts, name]);

  // Parts management
  const handleAddPart = (comp: InventoryComponent, entryId: string) => {
    const entry = comp.purchaseHistory.find((e) => e.id === entryId);
    if (!entry) return;
    const avgCost = entry.unitPrice;
    const batchAvailability = calculateComponentBatchesWithStock(
      comp,
      state.builds,
      selectedParts,
      initialData?.id
    ).batches.find((batch) => batch.entry.id === entryId);
    const existingIndex = selectedParts.findIndex(
      (p) => p.componentId === comp.id && p.purchaseEntryId === entryId
    );
    const remainingUnassigned = batchAvailability?.remainingUnassigned || 0;
    if (remainingUnassigned <= 0) return;

    if (existingIndex >= 0) {
      const existing = selectedParts[existingIndex];
      const updated = [...selectedParts];
      updated[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1,
      };
      setSelectedParts(updated);
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          componentId: comp.id,
          purchaseEntryId: entryId,
          componentName: comp.name,
          category: comp.category,
          quantity: 1,
          unitCostAtAssignment: avgCost,
        },
      ]);
    }
  };

  const handleUpdatePartQty = (componentId: string, entryId: string | undefined, delta: number) => {
    const comp = state.components.find((c) => c.id === componentId);
    const entry = comp && entryId ? comp.purchaseHistory.find((e) => e.id === entryId) : null;
    let maxAllowed = 999;
    if (entry) {
      const effectiveBuilds = initialData?.id
        ? state.builds.filter((build) => build.id !== initialData.id)
        : state.builds;
      maxAllowed = getAllBatchesWithRemaining(comp!, effectiveBuilds)
        .find((batch) => batch.entry.id === entry.id)?.availableQuantity || 0;
    }

    setSelectedParts((prev) =>
      prev
        .map((part) => {
          if (part.componentId === componentId && part.purchaseEntryId === entryId) {
            const newQty = part.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0 && newQty > maxAllowed) return part;
            return { ...part, quantity: newQty };
          }
          return part;
        })
        .filter((p): p is PCBuildPart => p !== null)
    );
  };

  const handleRemovePart = (componentId: string, entryId?: string) => {
    setSelectedParts((prev) =>
      prev.filter((p) => !(p.componentId === componentId && p.purchaseEntryId === entryId))
    );
  };

  const totalBuildCost = selectedParts.reduce(
    (sum, p) => sum + p.quantity * p.unitCostAtAssignment,
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    let resolvedWarrantyDays = 30;
    if (warrantyDays === 'Custom') {
      const parsed = Number(customWarrantyDays);
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        showToast('Custom warranty days must be a positive whole number.', 'error');
        return;
      }
      resolvedWarrantyDays = parsed;
    } else {
      resolvedWarrantyDays = Number(warrantyDays);
    }

    const priceNum = parseFloat(salePrice);
    onSave({
      name: name.trim(),
      warrantyDays: resolvedWarrantyDays,
      notes: notes.trim() || undefined,
      parts: selectedParts,
      status,
      salePrice: !isNaN(priceNum) && priceNum >= 0 ? priceNum : undefined,
      imageUrl: imageUrl || undefined,
    });
    handleCloseAndReset();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={handleCloseAndReset} className="max-w-2xl">
      <form className="space-y-4 w-full" onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
              <Hammer className="w-4 h-4 text-[#7C6CF2]" /> Create New PC Build
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 font-sans">
              Set title, status, target price, and select inventory parts separated by category.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Basic Details Grid */}
        <BuildBasicDetails
          name={name}
          onNameChange={handleNameChange}
          salePrice={salePrice}
          onSalePriceChange={setSalePrice}
          notes={notes}
          onNotesChange={setNotes}
          onAutoFillTitle={handleAutoFillTitle}
          warrantyDays={warrantyDays}
          onWarrantyDaysChange={setWarrantyDays}
          customWarrantyDays={customWarrantyDays}
          onCustomWarrantyDaysChange={setCustomWarrantyDays}
        />

        {/* Selected Parts Section */}
        <BuildSelectedPartsList
          selectedParts={selectedParts}
          components={state.components}
          totalBuildCost={totalBuildCost}
          salePrice={salePrice}
          onUpdatePartQty={handleUpdatePartQty}
          onRemovePart={handleRemovePart}
        />

        {/* Inventory Selection Grid */}
        <BuildInventoryPicker
          components={state.components}
          builds={state.builds}
          selectedParts={selectedParts}
          initialBuildId={initialData?.id}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          activeCategoryTab={activeCategoryTab}
          onCategoryChange={handleCategoryChange}
          activeSubCategory={activeSubCategory}
          onSubCategoryChange={handleSubCategoryChange}
          onAddPart={handleAddPart}
        />

        {/* Footer Actions */}
        <div className="pt-3 flex items-center justify-between border-t border-white/[0.08]">
          <div className="text-xs text-zinc-400 font-sans">
            Status: <span className="text-[#9D91FA] font-medium">{status === 'Listed for Sale' ? 'Available' : status}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white font-semibold shadow-md shadow-[#7C6CF2]/20 text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
            >
              <Hammer className="w-4 h-4" /> {initialData && initialData.id ? `Save PC Build (${selectedParts.length} Parts)` : `Create PC Build (${selectedParts.length} Parts)`}
            </button>
          </div>
        </div>
      </form>
    </BottomSheetModal>
  );
};
