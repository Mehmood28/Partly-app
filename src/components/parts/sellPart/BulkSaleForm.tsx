import React, { useState, useMemo } from 'react';
import { useInventory } from '../../../context/InventoryContext';
import { useToast } from '../../../context/ToastContext';
import { CATEGORIES, PaymentMethod, InventoryComponent, PurchaseEntry } from '../../../types';
import { getAllBatchesWithRemaining, formatCurrency, filterAndSortComponents, SortOption } from '../../../utils/helpers';
import { InventoryFilterBar } from '../../InventoryFilterBar';
import { CustomSelect } from '../../ui/CustomSelect';
import { PAYMENT_METHODS } from './SaleDetailsForm';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';

interface BulkSaleLineState {
  componentId: string;
  purchaseEntryId: string;
  quantity: number;
  unitSalePrice: string;
}

interface AvailableBatchItem {
  component: InventoryComponent;
  entry: PurchaseEntry;
  availableQuantity: number;
  unitCost: number;
}

interface BulkSaleFormProps {
  onClose: () => void;
  initialComponentId?: string;
  initialPurchaseEntryId?: string;
}

export const BulkSaleForm: React.FC<BulkSaleFormProps> = ({
  onClose,
  initialComponentId,
  initialPurchaseEntryId,
}) => {
  const { state, sellComponentPartsBulk } = useInventory();
  const { showToast } = useToast();

  // Toronto local date today
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }, []);

  // Shared deal state
  const [saleDate, setSaleDate] = useState<string>(todayStr);
  const [buyerName, setBuyerName] = useState<string>('');
  const [platform, setPlatform] = useState<string>('Facebook');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState<string>('');

  // Search & filter for available batches pool
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<string>('ALL');
  const [batchSubCategory, setBatchSubCategory] = useState('');
  const [batchSort, setBatchSort] = useState<SortOption>('newest-purchase');

  // Compute all available batches with unassigned quantity > 0
  const allAvailableBatches = useMemo<AvailableBatchItem[]>(() => {
    const list: AvailableBatchItem[] = [];
    state.components.forEach((comp) => {
      const batches = getAllBatchesWithRemaining(comp, state.builds).filter(
        (b) => b.availableQuantity > 0
      );
      batches.forEach((b) => {
        list.push({
          component: comp,
          entry: b.entry,
          availableQuantity: b.availableQuantity,
          unitCost: b.unitCost,
        });
      });
    });

    // Sort by component name, then by date newest-first
    return list.sort((a, b) => {
      const nameComp = a.component.name.localeCompare(b.component.name);
      if (nameComp !== 0) return nameComp;
      return (b.entry.date || '').localeCompare(a.entry.date || '');
    });
  }, [state.components, state.builds]);

  // Selected lines state
  const [selectedLines, setSelectedLines] = useState<BulkSaleLineState[]>(() => {
    if (initialComponentId && initialPurchaseEntryId) {
      const comp = state.components.find((c) => c.id === initialComponentId);
      if (comp) {
        const batches = getAllBatchesWithRemaining(comp, state.builds);
        const match = batches.find((b) => b.entry.id === initialPurchaseEntryId);
        if (match && match.availableQuantity > 0) {
          const defaultPrice = comp.targetMarketValuePerUnit && comp.targetMarketValuePerUnit > 0
            ? comp.targetMarketValuePerUnit.toString()
            : match.unitCost > 0
            ? (match.unitCost * 1.25).toFixed(2)
            : '0';
          return [
            {
              componentId: initialComponentId,
              purchaseEntryId: initialPurchaseEntryId,
              quantity: match.availableQuantity,
              unitSalePrice: defaultPrice,
            },
          ];
        }
      }
    }
    return [];
  });

  // Filtered batches in the selector
  const filteredAvailableBatches = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    const sortedComponents = filterAndSortComponents(state.components, {
      category: batchCategory,
      subCategory: batchSubCategory,
      sortBy: batchSort,
      builds: state.builds,
      onlyAvailable: true,
    });
    const matchingComponentIds = new Set(filterAndSortComponents(sortedComponents, {
      searchQuery: batchSearch,
      builds: state.builds,
      onlyAvailable: true,
    }).map((component) => component.id));
    const categoryIndex = new Map(CATEGORIES.map((category, index) => [category, index]));
    const sortIndex = new Map(sortedComponents.map((component, index) => [component.id, index]));
    return allAvailableBatches.filter((item) => sortIndex.has(item.component.id) && (
      !q || matchingComponentIds.has(item.component.id) ||
      [item.entry.condition, item.entry.platform, item.entry.date].some((value) => value?.toLowerCase().includes(q))
    )).sort((a, b) =>
      (categoryIndex.get(a.component.category) ?? CATEGORIES.length) - (categoryIndex.get(b.component.category) ?? CATEGORIES.length) ||
      (sortIndex.get(a.component.id) ?? 0) - (sortIndex.get(b.component.id) ?? 0) ||
      (b.entry.date || '').localeCompare(a.entry.date || '')
    );
  }, [allAvailableBatches, batchSearch, batchCategory, batchSubCategory, batchSort, state.components, state.builds]);

  // Map of batch keys to easily check if added
  const selectedBatchKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedLines.forEach((l) => keys.add(`${l.componentId}::${l.purchaseEntryId}`));
    return keys;
  }, [selectedLines]);

  // Add a batch to lines
  const handleAddBatch = (item: AvailableBatchItem) => {
    const key = `${item.component.id}::${item.entry.id}`;
    if (selectedBatchKeys.has(key)) return;

    const defaultPrice = item.component.targetMarketValuePerUnit && item.component.targetMarketValuePerUnit > 0
      ? item.component.targetMarketValuePerUnit.toString()
      : item.unitCost > 0
      ? (item.unitCost * 1.25).toFixed(2)
      : '0';

    setSelectedLines((prev) => [
      ...prev,
      {
        componentId: item.component.id,
        purchaseEntryId: item.entry.id,
        quantity: item.availableQuantity > 0 ? item.availableQuantity : 1,
        unitSalePrice: defaultPrice,
      },
    ]);
  };

  // Remove a line
  const handleRemoveLine = (index: number) => {
    setSelectedLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line quantity
  const handleLineQtyChange = (index: number, qty: number, maxQty: number) => {
    const validQty = Math.max(1, Math.min(maxQty, Math.floor(qty) || 1));
    setSelectedLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantity: validQty } : l))
    );
  };

  // Update line unit sale price
  const handleLinePriceChange = (index: number, price: string) => {
    setSelectedLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, unitSalePrice: price } : l))
    );
  };

  // Set all lines to max available quantity
  const handleSetAllToMax = () => {
    setSelectedLines((prev) =>
      prev.map((line) => {
        const comp = state.components.find((c) => c.id === line.componentId);
        if (!comp) return line;
        const batches = getAllBatchesWithRemaining(comp, state.builds);
        const batch = batches.find((b) => b.entry.id === line.purchaseEntryId);
        if (!batch) return line;
        return { ...line, quantity: batch.availableQuantity };
      })
    );
  };

  // Detailed line calculations and grand totals
  const { lineSummaries, totalRevenue, totalCost, totalUnits, netProfit, profitMarginPercent } =
    useMemo(() => {
      let grandRevenue = 0;
      let grandCost = 0;
      let grandUnits = 0;

      const summaries = selectedLines.map((line) => {
        const comp = state.components.find((c) => c.id === line.componentId);
        const batches = comp ? getAllBatchesWithRemaining(comp, state.builds) : [];
        const batch = batches.find((b) => b.entry.id === line.purchaseEntryId);

        const availableQty = batch?.availableQuantity || line.quantity;
        const unitCost = batch?.unitCost || 0;
        const unitPrice = Math.max(0, parseFloat(line.unitSalePrice) || 0);
        const qty = Math.max(1, Math.min(availableQty, line.quantity));

        const rev = unitPrice * qty;
        const cost = unitCost * qty;
        const profit = rev - cost;

        grandRevenue += rev;
        grandCost += cost;
        grandUnits += qty;

        return {
          line,
          component: comp,
          batch,
          availableQty,
          unitCost,
          unitPrice,
          quantity: qty,
          lineRevenue: rev,
          lineCost: cost,
          lineProfit: profit,
        };
      });

      const netProf = grandRevenue - grandCost;
      const marginPct = grandRevenue > 0 ? (netProf / grandRevenue) * 100 : 0;

      return {
        lineSummaries: summaries,
        totalRevenue: grandRevenue,
        totalCost: grandCost,
        totalUnits: grandUnits,
        netProfit: netProf,
        profitMarginPercent: marginPct,
      };
    }, [selectedLines, state.components, state.builds]);

  // Validation & Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedLines.length === 0) {
      showToast('Please add at least one component batch to the sale.', 'error');
      return;
    }

    for (const item of lineSummaries) {
      if (!item.component || !item.batch) {
        showToast(`Invalid component batch in sale lines.`, 'error');
        return;
      }
      if (item.quantity > item.availableQty) {
        showToast(
          `Quantity for ${item.component.name} exceeds available stock (${item.availableQty}).`,
          'error'
        );
        return;
      }
      if (item.unitPrice < 0 || isNaN(item.unitPrice)) {
        showToast(`Please provide a valid sale price for ${item.component.name}.`, 'error');
        return;
      }
    }

    const payloadLines = lineSummaries.map((s) => ({
      componentId: s.line.componentId,
      purchaseEntryId: s.line.purchaseEntryId,
      quantity: s.quantity,
      unitSalePrice: s.unitPrice,
    }));

    const result = sellComponentPartsBulk(payloadLines, {
      saleDate,
      buyerName: buyerName.trim() || undefined,
      platform: platform.trim() || undefined,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      showToast(result.error || 'Failed to process bulk sale.', 'error');
      return;
    }

    showToast(
      `Successfully logged bulk sale (${totalUnits} parts across ${payloadLines.length} lines)`,
      'success'
    );
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bulk-sale-form flex flex-col">
      {/* 1. Available Stock Selector Section */}
      <div className="bulk-stock-selector flex flex-col border-y border-white/[0.08] py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#B9EF68]" />
            <span className="text-xs font-semibold text-zinc-100 font-sans">
              Select In-Stock Batches
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono font-normal">
            {allAvailableBatches.length} batch{allAvailableBatches.length !== 1 ? 'es' : ''} available
          </span>
        </div>

        <InventoryFilterBar
          components={state.components}
          builds={state.builds}
          searchQuery={batchSearch}
          onSearchChange={setBatchSearch}
          activeCategory={batchCategory}
          onCategoryChange={setBatchCategory}
          activeSubCategory={batchSubCategory}
          onSubCategoryChange={setBatchSubCategory}
          sortBy={batchSort}
          onSortByChange={setBatchSort}
          compactControls
        />

        {/* Available Batches List */}
        <div className="bulk-stock-pool pr-1">
          {filteredAvailableBatches.length === 0 ? (
            <div className="text-center py-5 text-xs text-zinc-500 font-sans">
              No matching available inventory batches found.
            </div>
          ) : (
            filteredAvailableBatches.map((item) => {
              const key = `${item.component.id}::${item.entry.id}`;
              const isAdded = selectedBatchKeys.has(key);

              return (
                <div
                  key={key}
                  className={`bulk-stock-row flex items-center justify-between transition-all ${
                    isAdded
                      ? 'is-added text-zinc-300'
                      : 'text-zinc-200'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="bulk-stock-name text-xs font-semibold text-zinc-100">
                      {item.component.name}
                    </div>
                    <div className="bulk-stock-meta text-[11px] text-zinc-400">
                      <span>{item.component.category}</span>
                      {item.entry.condition && <><span>·</span><span>{item.entry.condition}</span></>}
                      <span>·</span>
                      <span>{item.availableQuantity} in stock</span>
                      <span>·</span>
                      <span>{formatCurrency(item.unitCost)}{item.availableQuantity > 1 ? '/ea' : ''}</span>
                      {item.entry.date && (
                        <>
                          <span>·</span>
                          <span>{item.entry.date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddBatch(item)}
                    disabled={isAdded}
                    className={`h-7 px-2.5 rounded-lg text-xs font-medium font-sans flex items-center gap-1 transition-all ${
                      isAdded
                        ? 'bg-[#B9EF68]/20 text-[#83E5DF] cursor-default'
                        : 'bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] shadow-sm'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Selected Sale Lines Section */}
      <div className="bulk-selected-lines flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200 font-sans">
              Sale Lines ({selectedLines.length})
            </span>
          </div>
          {selectedLines.length > 1 && (
            <button
              type="button"
              onClick={handleSetAllToMax}
              className="text-[11px] text-[#83E5DF] hover:text-[#9FF8F4] font-medium font-sans transition-colors"
            >
              Set All to Max Stock
            </button>
          )}
        </div>

        {selectedLines.length === 0 ? (
          <div className="bg-[#101719] border border-dashed border-white/[0.1] rounded-xl p-6 text-center text-xs text-zinc-500 font-sans">
            No items selected yet. Choose component batches from the list above to add them to this bulk sale.
          </div>
        ) : (
          <div className="bulk-line-list pr-1">
            {lineSummaries.map((item, idx) => (
              <div
                key={`${item.line.componentId}::${item.line.purchaseEntryId}`}
                className="bulk-selected-line"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-100 font-sans">{item.component?.name || 'Unknown Component'}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {item.component?.category} · {formatCurrency(item.unitCost)}{item.availableQty > 1 ? '/ea' : ''} · {item.availableQty} available
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-white/[0.04] transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line inputs & metrics */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-white/[0.04]">
                  {/* Quantity control */}
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center justify-between font-sans">
                      <span>Quantity</span>
                      <button
                        type="button"
                        onClick={() => handleLineQtyChange(idx, item.availableQty, item.availableQty)}
                        className="text-[11px] text-[#83E5DF] hover:text-[#9FF8F4] font-mono"
                      >
                        Use All ({item.availableQty})
                      </button>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={item.availableQty}
                      value={item.quantity}
                      onChange={(e) =>
                        handleLineQtyChange(idx, parseInt(e.target.value) || 1, item.availableQty)
                      }
                      className="app-field h-8 min-h-8 bg-[#0B1113] px-2.5 text-xs font-mono"
                    />
                  </div>

                  {/* Unit Sale Price */}
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1 font-sans">
                      Unit Sale Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">
                        $
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={item.line.unitSalePrice}
                        onChange={(e) => handleLinePriceChange(idx, e.target.value)}
                        className="app-field h-8 min-h-8 bg-[#0B1113] pl-6 pr-2.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Line financial row */}
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono border-t border-white/[0.04]">
                  <div className="text-zinc-400 flex items-center gap-2">
                    <span>Rev: <strong className="text-zinc-200">{formatCurrency(item.lineRevenue)}</strong></span>
                    <span>•</span>
                    <span>Cost: {formatCurrency(item.lineCost)}</span>
                  </div>
                  <div className={`font-semibold ${item.lineProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.lineProfit >= 0 ? '+' : ''}
                    {formatCurrency(item.lineProfit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Shared Deal Details */}
      <div className="bulk-deal-details flex flex-col border-y border-white/[0.08] py-3">
        <span className="text-xs font-semibold text-zinc-200 font-sans block">
          Deal & Payment Details
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Sale Date
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="app-field h-9 min-h-9 bg-[#0B1113] px-3 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Buyer Name
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="app-field h-9 min-h-9 bg-[#0B1113] px-3 text-xs font-sans"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Platform
            </label>
            <input
              type="text"
              placeholder="Facebook, Local, etc."
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="app-field h-9 min-h-9 bg-[#0B1113] px-3 text-xs font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Payment Method
            </label>
            <CustomSelect
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
            Notes / Details
          </label>
          <input
            type="text"
            placeholder="Optional sale notes, customer handle, or serial numbers..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="app-field h-9 min-h-9 bg-[#0B1113] px-3 text-xs font-sans"
          />
        </div>
      </div>

      {/* 4. Live Combined Summary Box */}
      <div className="bulk-sale-overview flex flex-col border-y border-white/[0.08] py-3">
        <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
          <span>Bulk Sale Overview</span>
          <span className="font-mono">
            {selectedLines.length} line{selectedLines.length !== 1 ? 's' : ''} • {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[#0B1113]/80 border border-white/[0.04] rounded-lg p-2">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Revenue</span>
            <span className="text-xs font-bold text-zinc-100 font-mono">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <div className="bg-[#0B1113]/80 border border-white/[0.04] rounded-lg p-2">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Exact Cost</span>
            <span className="text-xs font-semibold text-zinc-300 font-mono">
              {formatCurrency(totalCost)}
            </span>
          </div>
          <div className="bg-[#0B1113]/80 border border-white/[0.04] rounded-lg p-2">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Net Profit</span>
            <div className="flex items-center gap-1 font-mono">
              <span className={`text-xs font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfit >= 0 ? '+' : ''}
                {formatCurrency(netProfit)}
              </span>
              <span className="text-[11px] text-zinc-500">
                · Margin {profitMarginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Modal Footer Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 rounded-xl text-xs font-medium transition-colors font-sans"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={selectedLines.length === 0}
          className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 font-sans ${
            selectedLines.length === 0
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] shadow-lg shadow-[#B9EF68]/20'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Complete Bulk Sale ({totalUnits} Parts)</span>
        </button>
      </div>
    </form>
  );
};
