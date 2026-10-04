import { CustomSelect } from './ui/CustomSelect';
import React, { useState, useEffect } from 'react';
import {
  ComponentCategory,
  Condition,
  InventoryComponent,
  PaymentMethod,
  PurchaseEntry,
  CATEGORIES,
} from '../types';
import { X, Package, ShoppingCart, User, Calendar, Tag, DollarSign, Edit, Trash2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { useToast } from '../context/ToastContext';
import { BottomSheetModal } from './ui/BottomSheetModal';
import { ConfirmModal } from './ConfirmModal';
import { getUnassignedBatches, SUB_CATEGORIES, getConflictingTags, CATEGORY_TAG_GROUPS } from '../utils/helpers';
import { isPartedOutTradeInEntry, resolvePartedOutEntryOrigin, resolvePurchaseEntrySeller } from '../utils/tradeInOrigin';

interface ComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    compData: Omit<InventoryComponent, 'id' | 'assignedCount'>,
    purchaseEntry?: Omit<PurchaseEntry, 'id'>,
    existingComponentId?: string,
    updatedPurchaseEntry?: { entryId: string; entry: Omit<PurchaseEntry, 'id'> }
  ) => { success: boolean; error?: string } | void;
  initialComponent?: InventoryComponent | null;
}

export const ComponentModal: React.FC<ComponentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialComponent,
}) => {
  const { state, deletePurchaseEntry } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();

  // Mode: 'new' or 'existing'
  const [selectedCompId, setSelectedCompId] = useState<string>('NEW');
  
  // Component Details
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<ComponentCategory>('GPU');
  const [specifications, setSpecifications] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Purchase Entry Details
  const [includePurchase, setIncludePurchase] = useState<boolean>(true);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);

  const [unitPrice, setUnitPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [platform, setPlatform] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('E-Transfer');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  );
  const [condition, setCondition] = useState<Condition>('New Open Box');
  const [taxPercent, setTaxPercent] = useState<string>('0');
  const [healthPercent, setHealthPercent] = useState<string>('');

  const prevInitialCompRef = React.useRef(initialComponent);

  useEffect(() => {
    if (initialComponent !== prevInitialCompRef.current) {
      prevInitialCompRef.current = initialComponent;
      if (initialComponent) {
        setSelectedCompId(initialComponent.id);
        setName(initialComponent.name || '');
        const compCat = initialComponent.category || 'GPU';
        setCategory(compCat);
        setSpecifications(typeof initialComponent.specifications === 'string' ? initialComponent.specifications : '');
        
        const validPresets = SUB_CATEGORIES[compCat] || [];
        const matchedTags: string[] = [];
        (initialComponent.tags || []).forEach((t) => {
          const match = validPresets.find((p) => p.toLowerCase() === t.trim().toLowerCase());
          if (match && !matchedTags.includes(match)) {
            const conflicting = getConflictingTags(match, compCat).map((c) => c.toLowerCase());
            const hasConflict = matchedTags.some((existing) => conflicting.includes(existing.toLowerCase()));
            if (!hasConflict) {
              matchedTags.push(match);
            }
          }
        });
        setSelectedTags(matchedTags);

        const initialHealth = initialComponent.healthPercent !== undefined
          ? initialComponent.healthPercent.toString()
          : (initialComponent.purchaseHistory?.[0]?.healthPercent !== undefined
              ? initialComponent.purchaseHistory[0].healthPercent.toString()
              : '');
        setHealthPercent(initialHealth);
        setIncludePurchase(false);
        setEditingPurchaseId(null);
      } else {
        setSelectedCompId('NEW');
        setName('');
        setCategory('GPU');
        setSpecifications('');
        setSelectedTags([]);
        setHealthPercent('');
        setIncludePurchase(true);
        setEditingPurchaseId(null);
        resetPurchaseForm();
      }
    }
  }, [initialComponent]);

  const handleCategoryChange = (newCat: ComponentCategory) => {
    setCategory(newCat);
    const newPresets = SUB_CATEGORIES[newCat] || [];
    setSelectedTags((prevTags) => {
      const valid = prevTags.filter((tag) => newPresets.includes(tag));
      const resolved: string[] = [];
      for (const t of valid) {
        const conflicting = getConflictingTags(t, newCat).map((c) => c.toLowerCase());
        if (!resolved.some((r) => conflicting.includes(r.toLowerCase()))) {
          resolved.push(t);
        }
      }
      return resolved;
    });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      const conflicting = getConflictingTags(tag, category);
      const conflictingNormalized = conflicting.map((c) => c.toLowerCase());
      const filtered = prev.filter((t) => !conflictingNormalized.includes(t.toLowerCase()));
      return [...filtered, tag];
    });
  };

  const handleCloseAndReset = () => {
    setSelectedCompId('NEW');
    setName('');
    setCategory('GPU');
    setSpecifications('');
    setSelectedTags([]);
    setHealthPercent('');
    setIncludePurchase(true);
    setEditingPurchaseId(null);
    resetPurchaseForm();
    onClose();
  };

  const resetPurchaseForm = () => {
    setUnitPrice('');
    setQuantity('1');
    setPlatform('');
    setPaymentMethod('E-Transfer');
    setPurchaseDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }));
    setCondition('New Open Box');
    setTaxPercent('0');
    setHealthPercent('');
  };

  const handleEditPurchase = (ph: PurchaseEntry) => {
    setEditingPurchaseId(ph.id);
    setIncludePurchase(true);
    setUnitPrice(ph.unitPrice.toString());
    setQuantity(ph.quantity.toString());
    setPlatform(resolvePurchaseEntrySeller(ph, state.transactions, state.builds) || '');
    setPaymentMethod(ph.paymentMethod);
    setPurchaseDate(ph.date);
    setCondition(ph.condition);
    setTaxPercent((ph.taxPercent || 0).toString());
    setHealthPercent(ph.healthPercent !== undefined ? ph.healthPercent.toString() : '');
  };

  const handleCancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setIncludePurchase(false);
    resetPurchaseForm();
  };

  const handleDeletePurchase = (phId: string) => {
    setDeletePurchaseId(phId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPurchaseId && initialComponent) {
      const priceNum = parseFloat(unitPrice) || 0;
      const qtyNum = parseInt(quantity, 10) || 1;
      const parsedHealth = healthPercent.trim() !== '' ? Math.min(100, Math.max(0, parseFloat(healthPercent))) : undefined;
      const updatedEntry = {
        date: purchaseDate,
        condition,
        quantity: qtyNum,
        unitPrice: priceNum,
        totalPrice: priceNum * qtyNum,
        paymentMethod,
        platform,
        taxPercent: parseFloat(taxPercent) || 0,
        healthPercent: category === 'Storage' ? parsedHealth : undefined,
      };
      
      const result = onSave(
        {
          name: name.trim(),
          category,
          specifications,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          purchaseHistory: initialComponent?.purchaseHistory || [],
          healthPercent: category === 'Storage' ? parsedHealth : undefined,
        },
        undefined,
        initialComponent.id,
        {
          entryId: editingPurchaseId,
          entry: updatedEntry,
        }
      );
      
      if (result && !result.success) {
        showToast(result.error || 'Cannot save changes', 'error');
        return;
      }
      
      setEditingPurchaseId(null);
      setIncludePurchase(false);
      resetPurchaseForm();
      onClose();
      return;
    }

    const priceNum = parseFloat(unitPrice) || 0;
    const qtyNum = parseInt(quantity, 10) || 1;
    const parsedHealth = healthPercent.trim() !== '' ? Math.min(100, Math.max(0, parseFloat(healthPercent))) : undefined;

    let purchaseEntry: Omit<PurchaseEntry, 'id'> | undefined = undefined;
    if (includePurchase) {
      purchaseEntry = {
        date: purchaseDate,
        condition,
        quantity: qtyNum,
        unitPrice: priceNum,
        totalPrice: priceNum * qtyNum,
        paymentMethod,
        platform,
        taxPercent: parseFloat(taxPercent) || 0,
        healthPercent: category === 'Storage' ? parsedHealth : undefined,
      };
    }

    const compData: Omit<InventoryComponent, 'id' | 'assignedCount'> = {
      name: name.trim(),
      category,
      specifications,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      purchaseHistory: initialComponent?.purchaseHistory || [],
      healthPercent: category === 'Storage' ? parsedHealth : undefined,
    };

    const result = onSave(
      compData,
      purchaseEntry,
      selectedCompId !== 'NEW' ? selectedCompId : undefined
    );
    
    if (result && !result.success) {
      showToast(result.error || 'Cannot save changes', 'error');
      return;
    }
    
    handleCloseAndReset();
  };

  const liveComponent = initialComponent ? state.components.find(c => c.id === initialComponent.id) : null;
  const availablePurchaseBatches = liveComponent
    ? getUnassignedBatches(liveComponent, state.builds)
    : [];

  return (
    <BottomSheetModal isOpen={isOpen} onClose={handleCloseAndReset} layout="content" className="stock-modal max-w-lg !p-0">
      <form 
        className="modal-standard-form w-full"
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="modal-standard-header flex items-center justify-between border-b border-white/[0.08]">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
              <Package className="w-4 h-4 text-[#B9EF68]" />
              {initialComponent ? 'Edit Component & Purchases' : 'Add Inventory Part'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 font-sans">
              Enter component model info and purchase transaction details.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseAndReset}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: COMPONENT MODEL INFO */}
        <div className="space-y-3 pt-1">
          <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
            <Tag className="w-3.5 h-3.5 text-[#B9EF68]" /> 1. Part / Model Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className={category === 'Storage' ? 'sm:col-span-1' : 'sm:col-span-2'}>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Model Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={selectedCompId !== 'NEW' && !initialComponent}
                className="app-field h-11 px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-sans"
                placeholder="e.g. ASUS Prime RTX 5080"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Category *</label>
              <CustomSelect
                value={category}
                onChange={(val) => handleCategoryChange(val as ComponentCategory)}
                options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                className={selectedCompId !== 'NEW' && !initialComponent ? "opacity-70 pointer-events-none" : ""}
              />
            </div>

            {category === 'Storage' && (
              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-xs">Health (%)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  value={healthPercent}
                  onChange={(e) => setHealthPercent(e.target.value)}
                  disabled={selectedCompId !== 'NEW' && !initialComponent}
                  className="app-field h-11 px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                  placeholder="100"
                />
              </div>
            )}
            
            <div className="col-span-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-zinc-300 font-medium text-xs font-sans">
                  Category Tags
                </label>
                {selectedTags.length > 0 && (
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {selectedTags.length} selected
                  </span>
                )}
              </div>
              {CATEGORY_TAG_GROUPS[category] && CATEGORY_TAG_GROUPS[category].length > 0 ? (
                <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#0c1214]/60 p-2.5 sm:p-3">
                  {CATEGORY_TAG_GROUPS[category].map((group) => (
                    <div key={group.label} className="space-y-1.5">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 font-sans">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.tags.map((tag) => {
                          const isSelected = selectedTags.some(
                            (t) => t.toLowerCase() === tag.toLowerCase()
                          );
                          const isDisabled = selectedCompId !== 'NEW' && !initialComponent;
                          return (
                            <button
                              key={tag}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleTagToggle(tag)}
                              data-active={isSelected}
                              className={`app-chip app-subcategory-chip px-2.5 h-[26px] min-h-[26px] rounded-md transition-all text-xs font-sans font-semibold ${
                                isSelected
                                  ? 'app-chip-active text-white border-[#B9EF68]'
                                  : 'text-[#b1bac4] hover:text-zinc-200'
                              } ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                            >
                              <span className={isSelected ? 'text-white' : 'text-[#b1bac4]'}>{tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic py-1 font-sans">
                  No predefined tag presets available for this category.
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* EXISTING PURCHASES LIST */}
        {liveComponent && availablePurchaseBatches.length > 0 && !editingPurchaseId && (
          <div className="space-y-2 pt-3 border-t border-white/[0.08]">
            <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
              <ShoppingCart className="w-3.5 h-3.5 text-[#B9EF68]" /> Existing Purchases
            </div>
            <div className="space-y-1.5">
              {availablePurchaseBatches.map(({ entry: ph, availableQuantity }) => {
                const isTradeUp = state.transactions.some(
                  tx => tx.type === 'EXCHANGE' &&
                        tx.incomingComponentId === liveComponent.id &&
                        tx.incomingPurchaseEntryId === ph.id
                );
                const isPartedOutTradeInBatch = isPartedOutTradeInEntry(ph);
                const tradeInOrigin = isPartedOutTradeInBatch
                  ? resolvePartedOutEntryOrigin(ph, state.transactions, state.builds)
                  : null;
                const displaySeller = isPartedOutTradeInBatch
                  ? (tradeInOrigin?.buyerName ? `Traded in by ${tradeInOrigin.buyerName}` : 'Trade-in')
                  : (ph.platform ? `Seller: ${ph.platform}` : 'Unknown');
                return (
                  <div key={ph.id} className="flex items-center justify-between bg-[#101719] border border-white/[0.08] p-2.5 rounded-xl">
                    <div className="text-xs">
                      <div className="text-zinc-200 font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{ph.date}{!hideSupplierNames ? ` · ${displaySeller}` : ''}</span>
                        {isTradeUp && (
                          <span className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase leading-none inline-flex items-center">
                            TRADE UP
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 font-mono text-[11px] mt-0.5">Qty: {availableQuantity} available &middot; ${(ph.unitPrice || 0).toFixed(2)}{availableQuantity > 1 ? '/ea' : ''}</div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleEditPurchase(ph)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors" title="Edit purchase">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeletePurchase(ph.id)} className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-white/[0.06] rounded-lg transition-colors" title="Delete purchase">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 2: PURCHASE ENTRY DETAILS FORM */}
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
              <ShoppingCart className="w-3.5 h-3.5 text-[#B9EF68]" /> {editingPurchaseId ? 'Edit Purchase Record' : '2. Purchase Entry Details'}
            </div>
            {initialComponent && !editingPurchaseId && (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                <input
                  type="checkbox"
                  checked={includePurchase}
                  onChange={(e) => setIncludePurchase(e.target.checked)}
                  className="rounded bg-[#101719] border-white/[0.1] text-[#B9EF68] focus:ring-0 focus:ring-offset-0"
                />
                Add new purchase record
              </label>
            )}
          </div>

          {includePurchase && (
            <div className="space-y-3 text-xs bg-[#101719] p-3 rounded-xl border border-white/[0.08] relative">
              {editingPurchaseId && (
                <button type="button" onClick={handleCancelEditPurchase} className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-[#B9EF68]" /> Price Paid / Unit ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                    <input
                      type="number" inputMode="decimal"
                      step="any"
                      required={includePurchase}
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="app-field h-11 bg-[#0B1113] py-2 pl-7 pr-3 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                      placeholder="750.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs">Quantity</label>
                  <input
                    type="number" inputMode="decimal"
                    min="1"
                    required={includePurchase}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="app-field h-11 bg-[#0B1113] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs flex items-center gap-1">
                    <User className="w-3 h-3 text-[#B9EF68]" /> Seller / Platform
                  </label>
                  <input
                    type={hideSupplierNames ? "password" : "text"}
                    autoComplete="off"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="app-field h-11 bg-[#0B1113] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-sans"
                    placeholder={hideSupplierNames ? "••••••••" : "e.g. Amazon, Best Buy, Daniel"}
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#B9EF68]" /> Date Bought
                  </label>
                  <input
                    type="date"
                    required={includePurchase}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="app-field h-11 bg-[#0B1113] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs">Payment Method</label>
                  <CustomSelect
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val as PaymentMethod)}
                    options={[
                      { value: 'E-Transfer', label: 'E-Transfer' },
                      { value: 'Cash', label: 'Cash' },
                      { value: 'PayPal', label: 'PayPal' },
                      { value: 'Credit Card', label: 'Credit Card' },
                      { value: 'Debit', label: 'Debit' },
                      { value: 'Trade-In', label: 'Trade-In' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs">Condition</label>
                  <CustomSelect
                    value={condition}
                    onChange={(val) => setCondition(val as Condition)}
                    options={[
                      { value: 'Sealed', label: 'Sealed' },
                      { value: 'New Open Box', label: 'New Open Box' },
                      { value: 'New No Box', label: 'New No Box' },
                      { value: 'Used Open Box', label: 'Used Open Box' },
                      { value: 'Used No Box', label: 'Used No Box' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs">Tax (%)</label>
                  <input
                    type="number" inputMode="decimal"
                    step="any"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className="app-field h-11 bg-[#0B1113] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                    placeholder="0"
                  />
                </div>
                {category === 'Storage' && (
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1 text-xs">Health (%)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      value={healthPercent}
                      onChange={(e) => setHealthPercent(e.target.value)}
                      className="app-field h-11 bg-[#0B1113] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                      placeholder="100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-standard-footer flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold shadow-md shadow-[#B9EF68]/20 text-xs px-4 py-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            {editingPurchaseId 
              ? 'Update Purchase Record' 
              : initialComponent 
                ? 'Save Component Changes' 
                : selectedCompId !== 'NEW' 
                  ? 'Log Purchase to Component' 
                  : 'Add Part & Purchase Entry'}
          </button>
        </div>
      </form>

      {/* Delete Purchase Entry Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletePurchaseId && isOpen}
        title="Delete Purchase Record?"
        message="Are you sure you want to permanently delete this purchase entry batch? This action cannot be undone."
        confirmText="Delete Entry"
        variant="danger"
        onConfirm={() => {
          if (deletePurchaseId && initialComponent) {
            const result = deletePurchaseEntry(initialComponent.id, deletePurchaseId);
            if (result && !result.success) {
              showToast(result.error || 'Cannot delete purchase entry', 'error');
            } else {
              setDeletePurchaseId(null);
            }
          }
        }}
        onCancel={() => setDeletePurchaseId(null)}
      />
    </BottomSheetModal>
  );
};
