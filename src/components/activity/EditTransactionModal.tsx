import React, { useState, useEffect } from 'react';
import { TransactionLogItem } from '../../types';
import { X, Pencil } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useToast } from '../../context/ToastContext';
import { prepareTransactionEdit } from './transactionEditParsers';

interface EditTransactionModalProps {
  tx: TransactionLogItem | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ tx, isOpen = true, onClose }) => {
  const { updateTransaction } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const isPurchase = tx?.type === 'PURCHASE';
  const isMasked = !!(isPurchase && hideSupplierNames);

  const [editTitle, setEditTitle] = useState<string>('');
  const [editItemSummary, setEditItemSummary] = useState<string>('');
  const [titleEdited, setTitleEdited] = useState<boolean>(false);
  const [summaryEdited, setSummaryEdited] = useState<boolean>(false);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editProfit, setEditProfit] = useState<string>('');
  const [editPlatform, setEditPlatform] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');

  const getMaskedTitle = (rawTitle: string, platform?: string) => {
    let t = rawTitle;
    if (platform) {
      const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const getMaskedSummary = (rawSummary: string, platform?: string) => {
    let s = rawSummary;
    if (platform) {
      const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      setEditTitle(tx.title);
      setEditItemSummary(tx.itemNameOrSummary);
      setTitleEdited(false);
      setSummaryEdited(false);
      setEditAmount(String(tx.totalAmount ?? 0));
      setEditProfit(String(tx.profitMargin ?? 0));
      setEditPlatform(tx.platform || '');
      setEditPaymentMethod(tx.paymentMethod || '');
      setEditDate(tx.dateSortable || '');
    }
  }, [tx]);

  if (!tx) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = isMasked && !titleEdited ? tx.title : editTitle.trim();
    const finalSummary = isMasked && !summaryEdited ? tx.itemNameOrSummary : editItemSummary.trim();
    const prepared = prepareTransactionEdit({
      type: tx.type,
      title: finalTitle,
      itemNameOrSummary: finalSummary,
      totalAmount: editAmount,
      profitMargin: editProfit,
      platform: editPlatform,
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
              value={isMasked && !titleEdited ? getMaskedTitle(editTitle, tx.platform) : editTitle}
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
              value={isMasked && !summaryEdited ? getMaskedSummary(editItemSummary, tx.platform) : editItemSummary}
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
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono"
                />
              </div>
            </div>

            {tx.type === 'SALE' && (
              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Net Profit ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    required
                    value={editProfit}
                    onChange={(e) => setEditProfit(e.target.value)}
                    className="app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono"
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
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Platform</label>
              <input
                type={isMasked ? "password" : "text"}
                autoComplete="off"
                value={editPlatform}
                onChange={(e) => setEditPlatform(e.target.value)}
                className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
                placeholder={isMasked ? "••••••••" : "e.g. Kijiji / Amazon"}
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
