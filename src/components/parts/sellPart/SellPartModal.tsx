import React, { useState, useEffect } from 'react';
import { useInventory } from '../../../context/InventoryContext';
import { usePrivacy } from '../../../context/PrivacyContext';
import { useToast } from '../../../context/ToastContext';
import { ComponentCategory, InventoryComponent, PaymentMethod, Platform } from '../../../types';
import { calculateAverageUnitCost, calculateUnassignedQuantityStrict, formatCurrency, getAllBatchesWithRemaining } from '../../../utils/helpers';
import { normalizePlatform } from '../../../utils/platformDisplay';
import { BottomSheetModal } from '../../ui/BottomSheetModal';
import { CustomSelect } from '../../ui/CustomSelect';
import { X, Tag, Package, Plus, Layers, TrendingUp } from 'lucide-react';
import { getEstimatedNumericValue, parseCashPaidOnTop } from './sellPartHelpers';
import { SaleDetailsForm } from './SaleDetailsForm';
import { TradeInSection, TradeDirection } from './TradeInSection';
import { BulkSaleForm } from './BulkSaleForm';

interface SellPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedComponent?: InventoryComponent | null;
  preselectedEntryId?: string | null;
  onOpenAddComponent?: () => void;
}

export const SellPartModal: React.FC<SellPartModalProps> = ({
  isOpen,
  onClose,
  preselectedComponent,
  preselectedEntryId,
  onOpenAddComponent,
}) => {
  const { state, sellComponentPart, exchangeComponentPart } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();

  const [saleMode, setSaleMode] = useState<'single' | 'bulk'>('single');
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');

  const [quantity, setQuantity] = useState<number>(1);
  const [unitSalePrice, setUnitSalePrice] = useState<string>('');
  const [totalSalePrice, setTotalSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  );
  const [platform, setPlatform] = useState<string>('Facebook');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [buyerName, setBuyerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [hasTradeIn, setHasTradeIn] = useState<boolean>(false);
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>('CUSTOMER_TRADE_IN');
  const [tradeInCredit, setTradeInCredit] = useState<string>('');
  const [cashPaidOnTop, setCashPaidOnTop] = useState<string>('');
  const [tradeInPartName, setTradeInPartName] = useState<string>('');
  const [tradeInPartCategory, setTradeInPartCategory] = useState<ComponentCategory>('GPU');
  const [selectedTradeTags, setSelectedTradeTags] = useState<string[]>([]);

  const availableComponents = state.components.filter(
    (c) => calculateUnassignedQuantityStrict(c, state.builds) > 0
  );

  const currentComponent =
    (selectedComponentId ? state.components.find((c) => c.id === selectedComponentId) : null) ||
    preselectedComponent ||
    availableComponents[0] ||
    state.components[0] ||
    null;

  const availableBatches = currentComponent
    ? getAllBatchesWithRemaining(currentComponent, state.builds).filter((b) => b.availableQuantity > 0)
    : [];

  const selectedBatch =
    availableBatches.find((b) => b.entry.id === selectedEntryId) ||
    availableBatches[0] ||
    null;

  const effectiveUnitCost = selectedBatch
    ? selectedBatch.unitCost
    : currentComponent
    ? calculateAverageUnitCost(currentComponent)
    : 0;

  const maxQty = selectedBatch
    ? selectedBatch.availableQuantity
    : currentComponent
    ? calculateUnassignedQuantityStrict(currentComponent, state.builds)
    : 0;

  const prevPreselectedRef = React.useRef<string | null>(null);

  useEffect(() => {
    const key = `${preselectedComponent?.id || ''}_${preselectedEntryId || ''}`;
    if (key !== prevPreselectedRef.current) {
      prevPreselectedRef.current = key;
      const comp = preselectedComponent || availableComponents[0] || state.components[0] || null;
      if (comp) {
        setSelectedComponentId(comp.id);
        const batches = getAllBatchesWithRemaining(comp, state.builds).filter((b) => b.availableQuantity > 0);
        const targetEntryId = preselectedEntryId || (batches.length > 0 ? batches[0].entry.id : comp.purchaseHistory?.[0]?.id || '');
        setSelectedEntryId(targetEntryId);

        const batch = batches.find((b) => b.entry.id === targetEntryId) || batches[0];
        const unitCost = batch ? batch.unitCost : calculateAverageUnitCost(comp);
        const estValue = getEstimatedNumericValue(comp, unitCost);
        setUnitSalePrice(estValue.toFixed(2));
        setTotalSalePrice(estValue.toFixed(2));
      } else {
        setSelectedComponentId('');
        setSelectedEntryId('');
        setUnitSalePrice('');
        setTotalSalePrice('');
      }
      setQuantity(1);
      setSaleDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }));
      setPlatform('Facebook');
      setPaymentMethod('Cash');
      setBuyerName('');
      setNotes('');
      setHasTradeIn(false);
      setTradeDirection('CUSTOMER_TRADE_IN');
      setTradeInCredit('');
      setCashPaidOnTop('');
      setTradeInPartName('');
      setTradeInPartCategory('GPU');
      setSelectedTradeTags([]);
    }
  }, [preselectedComponent, preselectedEntryId, state.components, state.builds]);

  const handleCloseAndReset = () => {
    prevPreselectedRef.current = null;
    setSaleMode('single');
    setSelectedComponentId('');
    setSelectedEntryId('');
    setQuantity(1);
    setUnitSalePrice('');
    setTotalSalePrice('');
    setPlatform('Facebook');
    setPaymentMethod('Cash');
    setBuyerName('');
    setNotes('');
    setHasTradeIn(false);
    setTradeDirection('CUSTOMER_TRADE_IN');
    setTradeInCredit('');
    setCashPaidOnTop('');
    setTradeInPartName('');
    setTradeInPartCategory('GPU');
    setSelectedTradeTags([]);
    onClose();
  };

  const handleComponentChange = (id: string) => {
    setSelectedComponentId(id);
    const comp = state.components.find((c) => c.id === id);
    if (comp) {
      const batches = getAllBatchesWithRemaining(comp, state.builds).filter((b) => b.availableQuantity > 0);
      const firstEntryId = batches[0]?.entry.id || comp.purchaseHistory?.[0]?.id || '';
      setSelectedEntryId(firstEntryId);
      const unitCost = batches[0] ? batches[0].unitCost : calculateAverageUnitCost(comp);
      const estValue = getEstimatedNumericValue(comp, unitCost);
      setUnitSalePrice(estValue.toFixed(2));
      setTotalSalePrice((estValue * quantity).toFixed(2));
      const batchStock = batches[0] ? batches[0].availableQuantity : calculateUnassignedQuantityStrict(comp, state.builds);
      if (batchStock > 0 && quantity > batchStock) {
        setQuantity(batchStock);
      }
    }
  };

  const handleBatchChange = (entryId: string) => {
    setSelectedEntryId(entryId);
    const batch = availableBatches.find((b) => b.entry.id === entryId);
    if (batch && currentComponent) {
      const estValue = getEstimatedNumericValue(currentComponent, batch.unitCost);
      setUnitSalePrice(estValue.toFixed(2));
      setTotalSalePrice((estValue * quantity).toFixed(2));
      if (quantity > batch.availableQuantity) {
        setQuantity(batch.availableQuantity);
      }
    }
  };

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, Math.min(newQty, maxQty || 1));
    setQuantity(validQty);
    const unitP = parseFloat(unitSalePrice) || 0;
    setTotalSalePrice((unitP * validQty).toFixed(2));
  };

  const handleUnitSalePriceChange = (val: string) => {
    setUnitSalePrice(val);
    const p = parseFloat(val);
    if (!isNaN(p)) {
      setTotalSalePrice((p * quantity).toFixed(2));
    } else {
      setTotalSalePrice('');
    }
  };

  const handleTotalSalePriceChange = (val: string) => {
    setTotalSalePrice(val);
    const p = parseFloat(val);
    if (!isNaN(p) && quantity > 0) {
      setUnitSalePrice((p / quantity).toFixed(2));
    } else {
      setUnitSalePrice('');
    }
  };

  const parsedUnitCash = parseFloat(unitSalePrice) || 0;
  const parsedCashTotal = parseFloat(totalSalePrice) || (parsedUnitCash * quantity);
  const creditAmount = hasTradeIn && tradeDirection === 'CUSTOMER_TRADE_IN' ? parseFloat(tradeInCredit) || 0 : 0;
  const totalEffectiveSalePrice = parsedCashTotal + creditAmount;
  const totalCost = effectiveUnitCost * quantity;
  const netProfit = totalEffectiveSalePrice - totalCost;

  const isTradeUp = hasTradeIn && tradeDirection === 'TRADE_UP';
  const outgoingCostBasis = effectiveUnitCost * quantity;
  const cashParsed = parseCashPaidOnTop(cashPaidOnTop);
  const incomingCostBasis = outgoingCostBasis + (cashParsed.success ? cashParsed.value : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentComponent) {
      showToast('Please select a component to sell or trade', 'error');
      return;
    }

    if (quantity <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }

    if (quantity > maxQty) {
      showToast(`Cannot trade/sell more than available quantity (${maxQty})`, 'error');
      return;
    }

    const targetEntryId = selectedEntryId || selectedBatch?.entry.id || currentComponent.purchaseHistory?.[0]?.id || '';
    if (!targetEntryId) {
      showToast('No purchase batch found for component', 'error');
      return;
    }

    if (isTradeUp) {
      if (!tradeInPartName.trim()) {
        showToast('Please provide a name/model for the incoming trade-up component', 'error');
        return;
      }
      if (!cashParsed.success) {
        showToast(cashParsed.error || 'Cash paid on top must be a finite non-negative number.', 'error');
        return;
      }

      const result = exchangeComponentPart(
        currentComponent.id,
        targetEntryId,
        {
          quantity,
          cashPaidOnTop: cashParsed.value,
          exchangeDate: saleDate,
          platform: (normalizePlatform(platform) || 'Trade Up') as Platform,
          paymentMethod,
          notes: notes.trim() || undefined,
          incomingPart: {
            name: tradeInPartName.trim(),
            category: tradeInPartCategory,
            tags: selectedTradeTags,
          },
        }
      );

      if (!result.success) {
        showToast(result.error || 'Failed to process trade up.', 'error');
        return;
      }

      showToast(
        `Successfully logged trade up: ${quantity}x ${currentComponent.name} → ${tradeInPartName.trim()}`,
        'success'
      );

      handleCloseAndReset();
      return;
    }

    // Standard Loose-Part Sale (with or without Customer Trade-In)
    if (parsedCashTotal < 0 || (parsedUnitCash <= 0 && (!hasTradeIn || creditAmount <= 0))) {
      showToast('Please enter a valid sale price or trade-in value', 'error');
      return;
    }

    if (hasTradeIn && tradeDirection === 'CUSTOMER_TRADE_IN') {
      if (!tradeInPartName.trim()) {
        showToast('Please provide a name/model for the trade-in component', 'error');
        return;
      }
      if (creditAmount <= 0) {
        showToast('Trade-in credit value must be greater than $0', 'error');
        return;
      }
    }

    const tradeInDetails = hasTradeIn && tradeDirection === 'CUSTOMER_TRADE_IN'
      ? {
          name: tradeInPartName.trim(),
          category: tradeInPartCategory,
          tradeInCredit: creditAmount,
          tags: selectedTradeTags,
        }
      : undefined;

    const effectiveUnitSalePrice = quantity > 0 ? totalEffectiveSalePrice / quantity : 0;

    const result = sellComponentPart(
      currentComponent.id,
      targetEntryId,
      {
        quantity,
        unitSalePrice: effectiveUnitSalePrice,
        saleDate,
        platform: (normalizePlatform(platform) || 'Facebook') as Platform,
        paymentMethod,
        buyerName: buyerName.trim() || undefined,
        notes: notes.trim() || undefined,
        incomingTradePart: tradeInDetails,
      }
    );

    if (!result.success) {
      showToast(result.error || 'Failed to process sale.', 'error');
      return;
    }

    showToast(
      `Successfully logged sale for ${quantity}x ${currentComponent.name}`,
      'success'
    );

    handleCloseAndReset();
  };

  const hasNoInStockParts = availableComponents.length === 0 && maxQty === 0;

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={handleCloseAndReset}
      className={saleMode === 'bulk' ? 'max-w-2xl' : 'max-w-lg'}
    >
      <div className="w-full">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B9EF68]/15 border border-[#B9EF68]/30 flex items-center justify-center text-[#B9EF68]">
              {saleMode === 'bulk' ? <Layers className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 font-display">
                {saleMode === 'bulk' ? 'Log Bulk Part Sale' : 'Log Loose Part Sale'}
              </h2>
              <p className="text-xs text-zinc-400">
                {saleMode === 'bulk'
                  ? 'Sell multiple component batches in a single transaction package'
                  : 'Record sale of an individual component / loose part'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloseAndReset();
            }}
            aria-label="Close modal"
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-white/[0.06] bg-[#0B1113]">
          <div className="flex items-center gap-1 p-1 bg-[#101719] border border-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setSaleMode('single')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-all ${
                saleMode === 'single'
                  ? 'bg-[#B9EF68] text-[#07100B] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Single Part</span>
            </button>
            <button
              type="button"
              onClick={() => setSaleMode('bulk')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-all ${
                saleMode === 'bulk'
                  ? 'bg-[#B9EF68] text-[#07100B] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bulk Sale</span>
            </button>
          </div>
        </div>

        {saleMode === 'bulk' ? (
          <div className="p-5">
            <BulkSaleForm
              onClose={handleCloseAndReset}
              initialComponentId={preselectedComponent?.id}
              initialPurchaseEntryId={preselectedEntryId || undefined}
            />
          </div>
        ) : hasNoInStockParts ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#B9EF68]/15 border border-[#B9EF68]/30 text-[#B9EF68] flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-200">No Parts Available in Stock</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                You currently have no unassigned components available in stock to sell. Add a component or purchase entry first before logging a loose part sale.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
              >
                Close
              </button>
              {onOpenAddComponent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                    setTimeout(() => {
                      onOpenAddComponent();
                    }, 50);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold text-xs shadow-sm shadow-[#B9EF68]/20 transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Component</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
                Select Component / Part
              </label>
              {preselectedComponent ? (
                <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-100 font-sans">
                      {preselectedComponent.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {preselectedComponent.category}
                      {typeof preselectedComponent.specifications === 'string' && preselectedComponent.specifications ? ` · ${preselectedComponent.specifications}` : ''}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div className={`font-medium ${maxQty > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {maxQty} in stock
                    </div>
                    <div className="text-zinc-500 text-[11px]">
                      Cost: {formatCurrency(effectiveUnitCost)}
                    </div>
                  </div>
                </div>
              ) : (
                <CustomSelect
                  value={selectedComponentId || ''}
                  onChange={handleComponentChange}
                  options={availableComponents.map(c => ({
                    value: c.id,
                    label: `${c.category} · ${c.name} (${calculateUnassignedQuantityStrict(c, state.builds)} in stock)`,
                  }))}
                  placeholder="Select a part to sell..."
                />
              )}
            </div>

            {currentComponent && (
              <>
                {availableBatches.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
                      Purchased Stock Batch
                    </label>
                    <CustomSelect
                      value={selectedEntryId || (selectedBatch?.entry.id || '')}
                      onChange={handleBatchChange}
                      options={availableBatches.map(b => ({
                        value: b.entry.id,
                        label: `${b.entry.date} · ${b.entry.condition} · ${formatCurrency(b.unitCost)} each (${b.availableQuantity} available)${!hideSupplierNames && b.entry.platform ? ` · ${b.entry.platform}` : ''}`,
                      }))}
                      placeholder="Select batch..."
                    />
                  </div>
                )}

                <div className="space-y-4 pt-1">
                  <SaleDetailsForm 
                    hasTradeIn={hasTradeIn}
                    isTradeUp={isTradeUp}
                    quantity={quantity}
                    maxQty={maxQty}
                    handleQuantityChange={handleQuantityChange}
                    unitSalePrice={unitSalePrice}
                    handleUnitSalePriceChange={handleUnitSalePriceChange}
                    totalSalePrice={totalSalePrice}
                    handleTotalSalePriceChange={handleTotalSalePriceChange}
                    saleDate={saleDate}
                    setSaleDate={setSaleDate}
                    platform={platform}
                    setPlatform={setPlatform}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    buyerName={buyerName}
                    setBuyerName={setBuyerName}
                  />

                  <TradeInSection 
                    hasTradeIn={hasTradeIn}
                    setHasTradeIn={setHasTradeIn}
                    tradeDirection={tradeDirection}
                    setTradeDirection={setTradeDirection}
                    tradeInPartCategory={tradeInPartCategory}
                    setTradeInPartCategory={setTradeInPartCategory}
                    tradeInCredit={tradeInCredit}
                    setTradeInCredit={setTradeInCredit}
                    cashPaidOnTop={cashPaidOnTop}
                    setCashPaidOnTop={setCashPaidOnTop}
                    outgoingCostBasis={outgoingCostBasis}
                    outgoingPartName={currentComponent?.name}
                    outgoingQuantity={quantity}
                    selectedTradeTags={selectedTradeTags}
                    setSelectedTradeTags={setSelectedTradeTags}
                    tradeInPartName={tradeInPartName}
                    setTradeInPartName={setTradeInPartName}
                    parsedCashTotal={parsedCashTotal}
                    totalEffectiveSalePrice={totalEffectiveSalePrice}
                    creditAmount={creditAmount}
                  />

                  {!isTradeUp && (
                    <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                      <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                        Sale Summary &amp; Profit Preview
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-zinc-500 text-[11px] block">Unit Cost:</span>
                          <span className="text-zinc-300 font-medium">
                            {formatCurrency(effectiveUnitCost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[11px] block">Total Cost ({quantity}x):</span>
                          <span className="text-zinc-300 font-medium">
                            {formatCurrency(totalCost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[11px] block">Net Profit:</span>
                          <span
                            className={`font-medium ${
                              netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {netProfit >= 0 ? '+' : ''}
                            {formatCurrency(netProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCloseAndReset();
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
                    >
                      Cancel
                    </button>
                    {isTradeUp ? (
                      <button
                        type="submit"
                        disabled={
                          quantity <= 0 ||
                          quantity > maxQty ||
                          maxQty <= 0 ||
                          !tradeInPartName.trim()
                        }
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs shadow-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        <TrendingUp className="w-4 h-4" />
                        <span>Confirm Trade Up ({formatCurrency(incomingCostBasis)} Basis)</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={
                          quantity <= 0 ||
                          quantity > maxQty ||
                          (parsedUnitCash <= 0 && (!hasTradeIn || creditAmount <= 0)) ||
                          maxQty <= 0 ||
                          (hasTradeIn && (!tradeInPartName.trim() || creditAmount <= 0))
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs shadow-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Tag className="w-4 h-4" />
                        <span>Confirm Sale ({formatCurrency(totalEffectiveSalePrice)})</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </BottomSheetModal>
  );
};
