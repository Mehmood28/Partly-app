import React, { useState, useEffect, useRef } from 'react';
import { TransactionLogItem } from '../../types';
import { X, Pencil } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useToast } from '../../context/ToastContext';
import { prepareTransactionEdit } from './transactionEditParsers';
import { getCleanTransactionTitle, parseBatchItem, inferCategory, ParsedBatchItem } from './activityHelpers';
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
    if (editItems.length > 0 && !isNaN(parsedAmount) && parsedAmount >= 0) {
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

  const handleItemQuantityChange = (index: number, newQtyStr: string) => {
    const parsedQty = parseInt(newQtyStr, 10);
    const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;

    setEditItems((prev) => {
      const updated = prev.map((item, i) => {
        if (i !== index) return item;
        const sub = roundToCents(validQty * item.unitPrice);
        return {
          ...item,
          quantity: validQty,
          subtotal: sub,
        };
      });

      if (initialItemsRef.current[index]) {
        initialItemsRef.current[index].quantity = validQty;
      }

      const newTotal = updated.reduce((sum, it) => sum + it.subtotal, 0);
      setEditAmount(String(roundToCents(newTotal)));
      return updated;
    });
  };

  const handleItemPriceChange = (index: number, val: string) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;

    setEditItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.unitPriceStr = cleanVal;
      const num = parseFloat(cleanVal);
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

      if (tx.type === 'PURCHASE') {
        let rawParsed: ParsedBatchItem[] = [];
        if (tx.detailsList && tx.detailsList.length > 0) {
          rawParsed = tx.detailsList.map((detail) => parseBatchItem(detail, state.components, tx));
        } else {
          const q = tx.quantity || tx.relatedComponentQty || tx.originalPurchaseEntrySnapshot?.quantity || 1;
          const u = roundToCents((tx.totalAmount || 0) / q);
          const name = tx.itemNameOrSummary || 'Purchased Part';
          rawParsed = [{
            itemName: name,
            quantity: q,
            unitPrice: u,
            totalPrice: roundToCents(tx.totalAmount || 0),
            category: inferCategory(name),
            tags: [],
            condition: tx.originalPurchaseEntrySnapshot?.condition || '',
            platform: tx.platform || '',
            paymentMethod: tx.paymentMethod || '',
            comp: tx.relatedComponentId ? state.components.find((c) => c.id === tx.relatedComponentId) : undefined,
            entry: tx.originalPurchaseEntrySnapshot,
          }];
        }

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

    const updatedDetailsList = editItems.length > 0
      ? editItems.map((it) => `${it.quantity}x ${it.name} (${formatCurrency(it.unitPrice)}/ea)`)
      : undefined;

    const totalCalculatedQty = editItems.length > 0
      ? editItems.reduce((sum, it) => sum + (it.quantity || 1), 0)
      : undefined;

    let dynamicPurchaseTitle: string | undefined;
    if (tx.type === 'PURCHASE' && editItems.length > 0) {
      if (editItems.length === 1) {
        const singleName = editItems[0].name.replace(/^\d+x\s+/i, '');
        dynamicPurchaseTitle = (totalCalculatedQty || 1) > 1
          ? `Purchased ${totalCalculatedQty}x ${singleName}`
          : `Purchased ${singleName}`;
      } else {
        const itemNames = Array.from(new Set(editItems.map((it) => it.name.replace(/^\d+x\s+/i, ''))));
        if (itemNames.length === 1) {
          dynamicPurchaseTitle = (totalCalculatedQty || 1) > 1
            ? `Purchased ${totalCalculatedQty}x ${itemNames[0]}`
            : `Purchased ${itemNames[0]}`;
        }
      }
    }

    const finalTitle = isMasked && !titleEdited
      ? (dynamicPurchaseTitle || cleanInitialTitle || tx.title)
      : !titleEdited && dynamicPurchaseTitle
      ? dynamicPurchaseTitle
      : editTitle.trim();

    const finalSummary = isMasked && !summaryEdited ? tx.itemNameOrSummary : editItemSummary.trim();
    const overrideTitle = titleEdited
      ? finalTitle
      : summaryEdited
      ? finalSummary
      : undefined;
    let finalProfit = editProfit;
    if (hasStoredUnitCost) {
      const parsedAmount = parseFloat(editAmount);
      if (!isNaN(parsedAmount)) {
        finalProfit = (parsedAmount - totalUnitCost).toFixed(2);
      }
    }

    const prepared = prepareTransactionEdit({
      type: tx.type,
      title: finalTitle,
      customTitleOverride: overrideTitle,
      itemNameOrSummary: finalSummary,
      totalAmount: editAmount,
      quantity: totalCalculatedQty,
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

  const hasMultipleParts = editItems.length > 1;

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      layout="content"
      className={`stock-modal max-w-lg ${
        hasMultipleParts
          ? '!h-[calc(100dvh-5.5rem)] sm:!h-[85vh] !max-h-[calc(100dvh-5.5rem)] sm:!max-h-[85vh] flex flex-col'
          : ''
      }`}
    >
      <div className={`transaction-edit-modal w-full ${hasMultipleParts ? 'flex flex-col h-full min-h-0' : 'space-y-4'}`}>
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 shrink-0">
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

        <form onSubmit={handleSaveEdit} className={`text-xs ${hasMultipleParts ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'space-y-3'}`}>
          <div className={`shrink-0 ${hasMultipleParts ? 'space-y-2' : 'space-y-3'}`}>
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
          </div>

          {editItems.length > 0 && (
            <div className={`pt-2 border-t border-white/[0.08] ${hasMultipleParts ? 'flex flex-col flex-1 min-h-0 space-y-1.5' : 'space-y-2'}`}>
              <div className="flex items-center justify-between shrink-0">
                <label className="text-zinc-300 font-medium text-xs font-sans">
                  {editItems.length === 1 ? 'Purchased Part' : `Purchased Parts (${editItems.length})`}
                </label>
                <span className="text-[10.5px] text-zinc-400 font-mono">
                  Edit quantity, unit price, or Total Amount
                </span>
              </div>
              <div
                className={`overflow-y-auto pr-1 no-scrollbar flex flex-col ${hasMultipleParts ? 'flex-1 min-h-0' : 'max-h-56'}`}
                style={{ gap: '5px' }}
              >
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#101719] px-2.5 py-1.5 rounded-lg border border-white/[0.06] space-y-1 hover:border-white/[0.1] transition-colors"
                  >
                    <div className="text-xs font-semibold text-zinc-100 break-words leading-tight">
                      {item.name}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-medium text-zinc-400 font-sans">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                          style={{ height: '20px', minHeight: '20px', maxHeight: '20px', lineHeight: '18px', paddingTop: 0, paddingBottom: 0 }}
                          className="transaction-edit-item-input w-11 px-1 text-[11px] font-mono font-bold bg-[#090D0F] border border-white/[0.12] rounded-md text-[#B9EF68] text-center focus:outline-none focus:border-[#83E5DF] transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-zinc-400 font-sans">Cost:</span>
                          <div
                            onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
                            className="transaction-edit-cost-box flex items-center bg-[#090D0F] border border-white/[0.12] rounded-md px-1.5 h-5 focus-within:border-[#83E5DF] cursor-text transition-colors"
                          >
                            <span className="text-zinc-500 text-[10px] font-mono select-none leading-none shrink-0 mr-0.5">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.unitPriceStr}
                              onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                              className="transaction-edit-cost-input w-11 bg-transparent border-0 outline-none p-0 text-[11px] font-mono font-bold text-zinc-100 text-left focus:ring-0 focus:outline-none"
                              style={{ height: '18px', minHeight: '18px', maxHeight: '18px', lineHeight: '18px', paddingTop: 0, paddingBottom: 0 }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <span className="text-[11px] font-medium text-zinc-400 font-sans">Total Price:</span>
                          <span className="font-bold text-zinc-100 font-mono text-xs">${item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`flex items-center justify-end gap-2.5 border-t border-white/[0.08] shrink-0 ${hasMultipleParts ? 'pt-2 mt-auto' : 'pt-3'}`}>
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
