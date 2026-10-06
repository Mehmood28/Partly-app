import React, { useState, useEffect, useRef } from 'react';
import { TransactionLogItem } from '../../types';
import { X, Pencil } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useToast } from '../../context/ToastContext';
import { prepareTransactionEdit } from './transactionEditParsers';
import { getCleanTransactionTitle, parseBatchItem } from './activityHelpers';
import { roundToCents, formatCurrency } from '../../utils/helpers';

interface EditTransactionModalProps {
  tx: TransactionLogItem | null;
  isOpen?: boolean;
  onClose: () => void;
}

interface EditablePurchaseItem {
  name: string;
  quantity: number;
  unitPrice: number;
  unitPriceStr: string;
  subtotal: number;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ tx, isOpen = true, onClose }) => {
  const { state, updateTransaction } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const isPurchase = tx?.type === 'PURCHASE';
  const isMasked = !!(isPurchase && hideSupplierNames);
  const hasStoredUnitCost = tx?.type === 'SALE' && tx?.soldUnitCost !== undefined;
  const totalUnitCost = hasStoredUnitCost && tx ? (tx.soldUnitCost ?? 0) * (tx.quantity || 1) : 0;

  const [editTitle, setEditTitle] = useState<string>('');
  const [editItemSummary, setEditItemSummary] = useState<string>('');
  const [titleEdited, setTitleEdited] = useState<boolean>(false);
  const [summaryEdited, setSummaryEdited] = useState<boolean>(false);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editProfit, setEditProfit] = useState<string>('');
  const [editSeller, setEditSeller] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editItems, setEditItems] = useState<EditablePurchaseItem[]>([]);
  const initialItemsRef = useRef<Array<{ name: string; quantity: number; unitPrice: number }>>([]);

  const handleAmountChange = (val: string) => {
    setEditAmount(val);
    if (hasStoredUnitCost) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        setEditProfit(String(roundToCents(parsed - totalUnitCost)));
      } else {
        setEditProfit('');
      }
    }
    const parsedAmount = parseFloat(val);
    if (editItems.length > 1 && !isNaN(parsedAmount) && parsedAmount >= 0) {
      // Use the initial uncorrupted baseline items so typing/backspacing doesn't degrade or zero-out prices
      const baseline = initialItemsRef.current.length === editItems.length
        ? initialItemsRef.current
        : editItems;
      const baseSum = baseline.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);

      if (baseSum > 0) {
        const ratio = parsedAmount / baseSum;
        setEditItems((prev) =>
          prev.map((it, idx) => {
            const baseItem = baseline[idx] || it;
            const newUnitPrice = roundToCents(baseItem.unitPrice * ratio);
            const newSubtotal = roundToCents(it.quantity * newUnitPrice);
            return {
              ...it,
              unitPrice: newUnitPrice,
              unitPriceStr: String(newUnitPrice),
              subtotal: newSubtotal,
            };
          })
        );
      }
    }
  };

  const handleItemPriceChange = (index: number, val: string) => {
    setEditItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.unitPriceStr = val;
      const num = parseFloat(val);
      item.unitPrice = !isNaN(num) && num >= 0 ? num : 0;
      item.subtotal = roundToCents(item.quantity * item.unitPrice);
      updated[index] = item;

      // When the user explicitly edits an individual item price, update baseline weights
      initialItemsRef.current = updated.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));

      const newTotal = updated.reduce((sum, it) => sum + it.subtotal, 0);
      setEditAmount(String(roundToCents(newTotal)));
      return updated;
    });
  };

  const getMaskedTitle = (rawTitle: string, seller?: string) => {
    let t = rawTitle;
    if (seller) {
      const escaped = seller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t
        .replace(new RegExp(`^Bulk Purchase:\\s*${escaped}$`, 'i'), 'Bulk Purchase')
        .replace(new RegExp(`^Purchased:\\s*${escaped}$`, 'i'), 'Purchased')
        .replace(new RegExp(`\\s+from\\s+${escaped}$`, 'i'), '');
    }
    return t
      .replace(/^Bulk Purchase:\s*.+$/i, 'Bulk Purchase')
      .replace(/^Purchased:\s*.+$/i, 'Purchased')
      .trim();
  };

  const getMaskedSummary = (rawSummary: string, seller?: string) => {
    let s = rawSummary;
    if (seller) {
      const escaped = seller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s
        .replace(new RegExp(`^Bulk Purchase:\\s*${escaped}$`, 'i'), 'Bulk Purchase')
        .replace(new RegExp(`^Purchased:\\s*${escaped}$`, 'i'), 'Purchased')
        .replace(new RegExp(`\\s+from\\s+${escaped}$`, 'i'), '');
    }
    return s
      .replace(/^Bulk Purchase:\s*.+$/i, 'Bulk Purchase')
      .replace(/^Purchased:\s*.+$/i, 'Purchased')
      .replace(/^(Bulk added\s+\d+\s+items?)\s+from\s+.+$/i, '$1')
      .trim();
  };

  useEffect(() => {
    if (tx) {
      const cleanTitle = getCleanTransactionTitle(tx, state.components, state.builds);
      setEditTitle(cleanTitle || tx.title || '');
      setEditItemSummary(tx.itemNameOrSummary || '');
      setTitleEdited(false);
      setSummaryEdited(false);
      const cleanAmount = roundToCents(tx.totalAmount ?? 0);
      setEditAmount(cleanAmount ? String(cleanAmount) : '0');
      if (tx.type === 'SALE' && tx.soldUnitCost !== undefined) {
        const costBasis = (tx.soldUnitCost ?? 0) * (tx.quantity || 1);
        const derivedProfit = (tx.totalAmount ?? 0) - costBasis;
        setEditProfit(String(roundToCents(derivedProfit)));
      } else {
        setEditProfit(tx.profitMargin !== undefined ? String(roundToCents(tx.profitMargin)) : '');
      }
      setEditSeller(tx.seller || tx.platform || '');
      setEditPaymentMethod(tx.paymentMethod || '');
      setEditDate(tx.dateSortable || '');

      if (tx.type === 'PURCHASE' && tx.detailsList && tx.detailsList.length > 1) {
        const rawParsed = tx.detailsList.map((detail) => parseBatchItem(detail, state.components, tx));
        const rawSum = rawParsed.reduce((s, it) => s + ((it.quantity || 1) * it.unitPrice), 0);
        const currentTotal = typeof tx.totalAmount === 'number' && tx.totalAmount > 0 ? tx.totalAmount : rawSum;
        const ratio = rawSum > 0 ? currentTotal / rawSum : 1;
        const items: EditablePurchaseItem[] = rawParsed.map((it) => {
          const q = it.quantity || 1;
          const u = (rawSum > 0 && Math.abs(rawSum - currentTotal) >= 0.02) ? roundToCents(it.unitPrice * ratio) : it.unitPrice;
          const sub = roundToCents(q * u);
          return {
            name: it.itemName,
            quantity: q,
            unitPrice: u,
            unitPriceStr: String(u),
            subtotal: sub,
          };
        });
        setEditItems(items);
        initialItemsRef.current = items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }));
      } else {
        setEditItems([]);
        initialItemsRef.current = [];
      }
    }
  }, [tx, state.components, state.builds]);

  if (!tx) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInitialTitle = getCleanTransactionTitle(tx, state.components, state.builds);
    const finalTitle = isMasked && !titleEdited ? (cleanInitialTitle || tx.title) : editTitle.trim();
    const finalSummary = isMasked && !summaryEdited ? tx.itemNameOrSummary : editItemSummary.trim();
    const overrideTitle = titleEdited
      ? finalTitle
      : summaryEdited
      ? finalSummary
      : tx.customTitleOverride;
    let finalProfit = editProfit;
    if (hasStoredUnitCost) {
      const parsedAmount = parseFloat(editAmount);
      if (!isNaN(parsedAmount)) {
        finalProfit = (parsedAmount - totalUnitCost).toFixed(2);
      }
    }

    const updatedDetailsList = editItems.length > 1
      ? editItems.map((it) => `${it.quantity}x ${it.name} (${formatCurrency(it.unitPrice)}/ea)`)
      : undefined;

    const prepared = prepareTransactionEdit({
      type: tx.type,
      title: finalTitle,
      customTitleOverride: overrideTitle,
      itemNameOrSummary: finalSummary,
      totalAmount: editAmount,
      profitMargin: finalProfit,
      seller: editSeller,
      platform: editSeller,
      paymentMethod: editPaymentMethod,
      dateSortable: editDate,
      detailsList: updatedDetailsList,
    });

    if (!prepared.success) {
      showToast('error' in prepared ? prepared.error : 'Invalid transaction values.', 'error');
      return;
    }

    const result = updateTransaction(tx.id, prepared.value);
    if (!result.success) {
      showToast(result.error || 'Failed to update transaction.', 'error');
      return;
    }

    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} layout="content" className="stock-modal max-w-lg">
      <div className="transaction-edit-modal space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#B9EF68]" /> Edit Transaction Record
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Record Title / Type</label>
            <input
              type="text"
              required
              value={isMasked && !titleEdited ? getMaskedTitle(editTitle, editSeller) : editTitle}
              onChange={(e) => {
                setTitleEdited(true);
                setEditTitle(e.target.value);
              }}
              className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
              placeholder={isMasked ? "e.g. Purchased" : "e.g. Purchased: Facebook Marketplace"}
            />
          </div>

          <div>
            <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Item / Summary</label>
            <input
              type="text"
              required
              value={isMasked && !summaryEdited ? getMaskedSummary(editItemSummary, editSeller) : editItemSummary}
              onChange={(e) => {
                setSummaryEdited(true);
                setEditItemSummary(e.target.value);
              }}
              className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
              placeholder="e.g. RTX 4070 Super 12GB"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Total Amount ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  required
                  value={editAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono"
                />
              </div>
            </div>

            {tx.type === 'SALE' && (
              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">
                  Net Profit ($)
                  {hasStoredUnitCost && (
                    <span className="ml-1 text-[10px] text-zinc-400 font-normal">
                      (Cost: ${totalUnitCost.toFixed(2)})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    required
                    readOnly={hasStoredUnitCost}
                    value={editProfit}
                    onChange={(e) => setEditProfit(e.target.value)}
                    className={`app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono ${
                      hasStoredUnitCost ? 'opacity-80 bg-white/[0.03] cursor-not-allowed' : ''
                    }`}
                    placeholder="e.g. 150.00"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Seller</label>
              <input
                type={isMasked ? "password" : "text"}
                autoComplete="off"
                value={editSeller}
                onChange={(e) => setEditSeller(e.target.value)}
                className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
                placeholder={isMasked ? "••••••••" : "e.g. Memory Express / Amazon / Roop"}
              />
            </div>

            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Payment Method</label>
              <input
                type="text"
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value)}
                className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
                placeholder="e.g. Cash / E-Transfer"
              />
            </div>
          </div>

          {editItems.length > 1 && (
            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              <div className="flex items-center justify-between">
                <label className="text-zinc-300 font-medium text-xs font-sans">
                  Purchased Parts ({editItems.length})
                </label>
                <span className="text-[10.5px] text-zinc-400 font-mono">
                  Edit unit price or Total Amount
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 bg-[#101719] px-3 py-2 rounded-xl border border-white/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        Qty: <span className="text-[#B9EF68] font-bold">{item.quantity}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-500 text-xs font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPriceStr}
                          onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                          className="w-20 h-8 px-2 text-xs font-mono font-bold bg-[#090D0F] border border-white/[0.12] rounded-lg text-zinc-100 text-right focus:outline-none focus:border-[#83E5DF]"
                        />
                        <span className="text-zinc-500 text-[10px] font-mono">/ea</span>
                      </div>
                      <div className="w-16 text-right text-xs font-mono font-bold text-zinc-300">
                        ${item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold text-xs shadow-sm shadow-[#B9EF68]/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </BottomSheetModal>
  );
};
