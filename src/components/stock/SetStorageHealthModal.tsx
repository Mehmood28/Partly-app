import React, { useState, useEffect, useRef } from 'react';
import { InventoryComponent, PurchaseEntry } from '../../types';
import { getUnassignedBatches, formatReadableDate, formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { isPartedOutTradeInEntry, resolvePartedOutEntryOrigin } from '../../utils/tradeInOrigin';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { Activity, Check, Sparkles, X } from 'lucide-react';

interface SetStorageHealthModalProps {
  component: InventoryComponent | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DriveItem {
  globalIndex: number;
  batchIndex: number;
  unitIndexInBatch: number;
  totalInBatch: number;
  entry: PurchaseEntry;
  dateText: string;
  condition: string;
  sellerText: string;
  paymentText: string;
  unitPrice: number;
}

export const SetStorageHealthModal: React.FC<SetStorageHealthModalProps> = ({
  component,
  isOpen,
  onClose,
}) => {
  const { state, distributeDriveHealths } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();

  const [healthValues, setHealthValues] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculate unassigned available drives for this component
  const unassignedBatches = React.useMemo(() => {
    if (!component) return [];
    return getUnassignedBatches(component, state.builds);
  }, [component, state.builds]);

  // Expand each unassigned batch into individual drive units with their exact purchase details
  const driveItems = React.useMemo<DriveItem[]>(() => {
    if (!component) return [];
    const items: DriveItem[] = [];
    let gIdx = 0;

    unassignedBatches.forEach((batch, bIdx) => {
      const entry = batch.entry;

      const parentTx = entry.sourcePurchaseTransactionId
        ? state.transactions.find((tx) => tx.id === entry.sourcePurchaseTransactionId && tx.type === 'PURCHASE')
        : undefined;
      const resolvedSeller = entry.platform || entry.seller || parentTx?.seller || parentTx?.platform;
      const resolvedDate = parentTx?.dateSortable || entry.date;
      const resolvedPaymentMethod = parentTx?.paymentMethod || entry.paymentMethod;

      const isTradeUpBatch = state.transactions.some(
        (tx) =>
          tx.type === 'EXCHANGE' &&
          (tx.incomingComponentId === component.id || tx.incomingComponentId === (entry as any)._originalComponentId) &&
          tx.incomingPurchaseEntryId === entry.id
      );
      const isPartedOutTradeInBatch = isPartedOutTradeInEntry(entry);
      const tradeInOrigin = isPartedOutTradeInBatch
        ? resolvePartedOutEntryOrigin(entry, state.transactions, state.builds)
        : null;

      const sellerText = isPartedOutTradeInBatch
        ? (tradeInOrigin?.buyerName ? `Traded in by ${tradeInOrigin.buyerName}` : 'Trade-in')
        : (!hideSupplierNames && resolvedSeller ? normalizePlatform(String(resolvedSeller)) : '—');

      const paymentText = isPartedOutTradeInBatch
        ? 'Trade-in'
        : (resolvedPaymentMethod || '—') + (isTradeUpBatch ? ' · Trade-up' : '');

      const dateText = formatReadableDate(resolvedDate) || resolvedDate;

      for (let u = 0; u < batch.availableQuantity; u++) {
        items.push({
          globalIndex: gIdx++,
          batchIndex: bIdx,
          unitIndexInBatch: u + 1,
          totalInBatch: batch.availableQuantity,
          entry,
          dateText,
          condition: entry.condition,
          sellerText,
          paymentText,
          unitPrice: batch.unitCost,
        });
      }
    });

    return items;
  }, [component, unassignedBatches, state.transactions, state.builds, hideSupplierNames]);

  const totalUnassigned = driveItems.length;

  // Pre-fill existing health values when modal opens
  useEffect(() => {
    if (!component || !isOpen) return;

    const initialHealths: string[] = [];
    for (const batch of unassignedBatches) {
      const h = batch.entry.healthPercent ?? component.healthPercent ?? 100;
      for (let i = 0; i < batch.availableQuantity; i++) {
        initialHealths.push(String(h));
      }
    }

    setHealthValues(initialHealths);
    inputRefs.current = [];
  }, [component, isOpen, unassignedBatches]);

  if (!component) return null;

  const handleHealthChange = (
    index: number,
    val: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // Only allow digits up to 3 chars
    const cleaned = val.replace(/\D/g, '').slice(0, 3);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 100) return; // Cap at 100

    setHealthValues((prev) => {
      const copy = [...prev];
      copy[index] = cleaned;
      return copy;
    });

    // Check if this was a deletion/backspace
    const native = e.nativeEvent as InputEvent;
    const isDelete = native?.inputType?.startsWith('delete');
    if (isDelete) {
      return;
    }

    // Auto-advance if 100 is typed, or 2 digits typed (e.g. 75, 96, 99)
    if (cleaned === '100' || (cleaned.length === 2 && num >= 10 && num < 100)) {
      if (index < totalUnassigned - 1) {
        setTimeout(() => {
          const nextEl = inputRefs.current[index + 1];
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
          }
        }, 30);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < totalUnassigned - 1) {
        const nextEl = inputRefs.current[index + 1];
        nextEl?.focus();
        nextEl?.select();
      } else {
        handleSave();
      }
    } else if (e.key === 'ArrowDown' && index < totalUnassigned - 1) {
      e.preventDefault();
      const nextEl = inputRefs.current[index + 1];
      nextEl?.focus();
      nextEl?.select();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const prevEl = inputRefs.current[index - 1];
      prevEl?.focus();
      prevEl?.select();
    }
  };

  const handleSetAll100 = () => {
    setHealthValues(new Array(totalUnassigned).fill('100'));
  };

  const handleSave = () => {
    const parsedHealths: number[] = [];
    for (let i = 0; i < totalUnassigned; i++) {
      const val = healthValues[i];
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        showToast(`Please enter a valid health percentage (0-100) for drive #${i + 1}`, 'error');
        inputRefs.current[i]?.focus();
        inputRefs.current[i]?.select();
        return;
      }
      parsedHealths.push(parsed);
    }

    const result = distributeDriveHealths(component.id, parsedHealths);
    if (!result.success) {
      showToast(result.error || 'Failed to save drive healths', 'error');
      return;
    }

    showToast(`Health percentages saved for ${totalUnassigned} drive${totalUnassigned > 1 ? 's' : ''}`, 'success');
    onClose();
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      layout="content"
      className="stock-modal max-w-md w-full !p-0"
    >
      <div className="modal-standard-form w-full text-zinc-200">
        {/* Header */}
        <div className="modal-standard-header flex items-center justify-between border-b border-white/[0.08]">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#B9EF68]" /> Set Storage Drive Health
            </h3>
            <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
              {component.name} · {totalUnassigned} in stock
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400">Drive SMART Health (0–100%)</span>
          <button
            type="button"
            onClick={handleSetAll100}
            className="app-button app-button-outline flex items-center gap-1.5 !h-[28px] !min-h-[28px] px-2.5 text-[11px] font-semibold text-[#B9EF68] border-[#B9EF68]/35 hover:bg-[#B9EF68]/10"
          >
            <Sparkles className="w-3 h-3 text-[#B9EF68] shrink-0" /> Set all 100%
          </button>
        </div>

        {/* Drive Rows */}
        <div className="stock-batch-compact-list max-h-[50dvh] overflow-y-auto overscroll-contain">
          {driveItems.map((item, idx) => (
            <div
              key={idx}
              className="stock-batch-compact !pr-[90px]"
            >
              <div className="stock-batch-line stock-batch-line-primary">
                <strong>{item.dateText}</strong>
                <span><em>Seller</em><span className="stock-batch-value">{item.sellerText}</span></span>
                <span>{item.totalInBatch > 1 ? `Unit ${item.unitIndexInBatch} of ${item.totalInBatch}` : 'Unit 1 of 1'}</span>
              </div>
              <div className="stock-batch-line stock-batch-line-secondary">
                <span>{item.condition}</span>
                <span><em>Payment</em><span className="stock-batch-value">{item.paymentText}</span></span>
                <strong>{formatCurrency(item.unitPrice)}</strong>
              </div>

              {/* Health Input */}
              <div className="batch-actions">
                <div className="relative flex items-center">
                  <input
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={healthValues[idx] ?? ''}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => handleHealthChange(idx, e.target.value, e)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    placeholder="100"
                    className="w-[62px] h-[28px] min-h-[28px] !h-[28px] !min-h-[28px] rounded-lg bg-[#101719] border border-[#83E5DF]/35 focus:border-[#B9EF68] pl-2 pr-5 text-center font-mono text-xs font-bold text-zinc-100 outline-none transition-colors"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-zinc-400 pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="modal-standard-footer flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="app-button px-4 h-[36px] min-h-[36px] rounded-lg text-xs font-semibold text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="app-button app-button-primary flex items-center justify-center gap-1.5 px-4 h-[36px] min-h-[36px] rounded-lg text-xs font-bold"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            Save Healths
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
