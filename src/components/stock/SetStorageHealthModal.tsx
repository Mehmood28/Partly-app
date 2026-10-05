import React, { useState, useEffect, useRef } from 'react';
import { InventoryComponent } from '../../types';
import { getUnassignedBatches } from '../../utils/helpers';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { HardDrive, Check, Sparkles, X } from 'lucide-react';

interface SetStorageHealthModalProps {
  component: InventoryComponent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SetStorageHealthModal: React.FC<SetStorageHealthModalProps> = ({
  component,
  isOpen,
  onClose,
}) => {
  const { state, distributeDriveHealths } = useInventory();
  const { showToast } = useToast();

  const [healthValues, setHealthValues] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculate unassigned available drives for this component
  const unassignedBatches = React.useMemo(() => {
    if (!component) return [];
    return getUnassignedBatches(component, state.builds);
  }, [component, state.builds]);

  const totalDrives = React.useMemo(() => {
    return unassignedBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  }, [unassignedBatches]);

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

  const handleHealthChange = (index: number, val: string) => {
    // Only allow digits up to 3 chars
    const cleaned = val.replace(/\D/g, '').slice(0, 3);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 100) return; // Cap at 100

    setHealthValues((prev) => {
      const copy = [...prev];
      copy[index] = cleaned;
      return copy;
    });

    // Auto-advance if 100 is typed, or 2 digits typed (e.g. 75, 96, 99)
    if (cleaned === '100' || (cleaned.length === 2 && num >= 10 && num < 100)) {
      if (index < totalDrives - 1) {
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
          inputRefs.current[index + 1]?.select();
        }, 50);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < totalDrives - 1) {
        inputRefs.current[index + 1]?.focus();
        inputRefs.current[index + 1]?.select();
      } else {
        handleSave();
      }
    } else if (e.key === 'ArrowDown' && index < totalDrives - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      inputRefs.current[index - 1]?.select();
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
        showToast(`Please enter a valid health percentage (0-100) for Drive #${i + 1}`, 'error');
        inputRefs.current[i]?.focus();
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
      className="max-w-md w-full"
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
              <span className="font-semibold text-[#B9EF68]">{totalDrives} in stock</span>
              <span>·</span>
              <span>Individual SMART Health</span>
            </div>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-zinc-400">
            Type % from test stickers (auto-advances):
          </span>
          <button
            type="button"
            onClick={handleSetAll100}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#83E5DF] hover:underline"
          >
            <Sparkles className="w-3 h-3" /> Set all 100%
          </button>
        </div>

        {/* Numbered Drive Inputs List */}
        <div className="max-h-[50dvh] overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {Array.from({ length: totalDrives }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 bg-[#101719] px-3.5 py-2 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[10px] font-mono text-zinc-400 shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium text-zinc-300 truncate">
                  Drive #{idx + 1}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={healthValues[idx] ?? ''}
                  onChange={(e) => handleHealthChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  placeholder="100"
                  className="w-16 h-8 text-center text-xs font-mono font-bold bg-[#090D0F] border border-white/[0.12] rounded-lg text-zinc-100 focus:outline-none focus:border-[#83E5DF] focus:ring-1 focus:ring-[#83E5DF]"
                />
                <span className="text-xs font-mono text-zinc-500 font-bold select-none">%</span>
              </div>
            </div>
          ))}
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
