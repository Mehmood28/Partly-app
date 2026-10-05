import React, { useState, useEffect, useRef } from 'react';
import { InventoryComponent, PurchaseEntry } from '../../types';
import { getUnassignedBatches, formatReadableDate, formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { isPartedOutTradeInEntry, resolvePartedOutEntryOrigin } from '../../utils/tradeInOrigin';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { HardDrive, Check, Sparkles, X } from 'lucide-react';

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
        : (!hideSupplierNames && entry.platform ? normalizePlatform(String(entry.platform)) : '—');

      const paymentText = isPartedOutTradeInBatch
        ? 'Trade-in'
        : (entry.paymentMethod || '—') + (isTradeUpBatch ? ' · Trade-up' : '');

      const dateText = formatReadableDate(entry.date) || entry.date;

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

  const totalDrives = driveItems.length;

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
      // NEVER auto-advance when user is deleting or backspacing!
      return;
    }

    // Auto-advance if 100 is typed, or 2 digits typed (e.g. 75, 96, 99)
    if (cleaned === '100' || (cleaned.length === 2 && num >= 10 && num < 100)) {
      if (index < totalDrives - 1) {
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
      if (index < totalDrives - 1) {
        const nextEl = inputRefs.current[index + 1];
        nextEl?.focus();
        nextEl?.select();
      } else {
        handleSave();
      }
    } else if (e.key === 'ArrowDown' && index < totalDrives - 1) {
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
    setHealthValues(new Array(totalDrives).fill('100'));
  };

  const handleSave = () => {
    const parsedHealths: number[] = [];
    for (let i = 0; i < totalDrives; i++) {
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

    showToast(`Health percentages saved for ${totalDrives} drive${totalDrives > 1 ? 's' : ''}`, 'success');
    onClose();
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-lg w-full"
    >
      <div className="flex flex-col gap-4 p-4 text-zinc-200">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#83E5DF]" /> Set Storage Drive Health
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Component Header Info */}
        <div className="rounded-xl border border-white/[0.08] bg-[#101719] p-3 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#83E5DF]/10 border border-[#83E5DF]/20 text-[#83E5DF] shrink-0 mt-0.5">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-zinc-100 truncate">{component.name}</h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
              <span className="font-semibold text-[#B9EF68]">{totalDrives} available in stock</span>
              <span>·</span>
              <span>Individual SMART Health</span>
            </div>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-zinc-400">
            Type health % (auto-advances):
          </span>
          <button
            type="button"
            onClick={handleSetAll100}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#83E5DF] hover:underline"
          >
            <Sparkles className="w-3 h-3" /> Set all 100%
          </button>
        </div>

        {/* Drive Cards List with purchase details */}
        <div className="max-h-[52dvh] overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {driveItems.map((item, idx) => {
            const hNum = parseInt(healthValues[idx] || '', 10);
            return (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 bg-[#101719] px-3.5 py-2.5 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                {/* Same details shown in the component card */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    <strong className="text-zinc-200 font-bold">{item.dateText}</strong>
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <span className="text-zinc-500 italic">Seller</span>
                      <span className="text-zinc-300 font-medium">{item.sellerText}</span>
                    </span>
                    {item.totalInBatch > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-zinc-300 text-[10px] font-mono leading-none">
                        Unit {item.unitIndexInBatch} of {item.totalInBatch}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                    <span className="text-zinc-300">{item.condition}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-500 italic">Payment</span>
                      <span className="text-zinc-300 font-medium">{item.paymentText}</span>
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-mono text-zinc-300">{formatCurrency(item.unitPrice)}</span>
                  </div>
                </div>

                {/* Health input */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
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
                    className={`w-16 h-8 text-center text-xs font-mono font-bold bg-[#090D0F] border rounded-lg text-zinc-100 focus:outline-none focus:ring-1 transition-all ${
                      hNum === 100
                        ? 'border-emerald-500/40 focus:border-emerald-400 focus:ring-emerald-400/40 text-emerald-300'
                        : hNum >= 90
                        ? 'border-[#83E5DF]/40 focus:border-[#83E5DF] focus:ring-[#83E5DF]/40 text-[#83E5DF]'
                        : hNum >= 80
                        ? 'border-amber-500/40 focus:border-amber-400 focus:ring-amber-400/40 text-amber-300'
                        : 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-400/40 text-rose-300'
                    }`}
                  />
                  <span className="text-xs font-mono text-zinc-500 font-bold select-none">%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="app-button px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="app-button app-button-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#07100B] bg-[#B9EF68] hover:bg-[#a8dc56] rounded-xl transition-all shadow-sm"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Save Healths
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
