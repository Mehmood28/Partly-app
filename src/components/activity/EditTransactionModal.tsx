import React, { useState, useEffect } from 'react';
import { TransactionLogItem } from '../../types';
import { X, Pencil } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useToast } from '../../context/ToastContext';
import { prepareTransactionEdit } from './transactionEditParsers';
import { getCleanTransactionTitle } from './activityHelpers';

interface EditTransactionModalProps {
  tx: TransactionLogItem | null;
  isOpen?: boolean;
  onClose: () => void;
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

  const handleAmountChange = (val: string) => {
    setEditAmount(val);
    if (hasStoredUnitCost) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        setEditProfit((parsed - totalUnitCost).toFixed(2));
      } else {
        setEditProfit('');
      }
    }
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
      setEditAmount(String(tx.totalAmount ?? 0));
      if (tx.type === 'SALE' && tx.soldUnitCost !== undefined) {
        const costBasis = (tx.soldUnitCost ?? 0) * (tx.quantity || 1);
        const derivedProfit = (tx.totalAmount ?? 0) - costBasis;
        setEditProfit(derivedProfit.toFixed(2));
      } else {
        setEditProfit(String(tx.profitMargin ?? 0));
      }
      setEditSeller(tx.seller || tx.platform || '');
      setEditPaymentMethod(tx.paymentMethod || '');
      setEditDate(tx.dateSortable || '');
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
