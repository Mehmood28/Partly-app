import React from 'react';
import { Copy, Shield, X } from 'lucide-react';
import { WARRANTY_PRESETS } from '../../utils/warranty';
import { BottomSheetModal } from '../ui/BottomSheetModal';

interface CopyAdWarrantyModalProps {
  isOpen: boolean;
  onClose: () => void;
  warrantyDays: string;
  onWarrantyDaysChange: (value: string) => void;
  customWarrantyDays: string;
  onCustomWarrantyDaysChange: (value: string) => void;
  onConfirm: () => void;
}

export const CopyAdWarrantyModal: React.FC<CopyAdWarrantyModalProps> = ({
  isOpen,
  onClose,
  warrantyDays,
  onWarrantyDaysChange,
  customWarrantyDays,
  onCustomWarrantyDaysChange,
  onConfirm,
}) => (
  <BottomSheetModal
    isOpen={isOpen}
    onClose={onClose}
    layout="content"
    className="build-modal stock-modal max-w-md"
  >
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#B9EF68]" /> Copy Marketplace Ad
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <p className="text-zinc-400">
          Select or customize the warranty duration to include in the generated marketplace listing.
        </p>

        <div className="space-y-2">
          <label className="block text-zinc-300 font-medium text-xs">Warranty Duration</label>
          <div className="grid grid-cols-2 gap-2">
            {WARRANTY_PRESETS.map((preset) => {
              const isSelected = warrantyDays === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onWarrantyDaysChange(preset.value)}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                    isSelected
                      ? 'bg-[#B9EF68] text-[#07100B] border border-[#B9EF68] shadow-sm shadow-[#B9EF68]/25 font-semibold'
                      : 'bg-[#101719] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onWarrantyDaysChange('Custom')}
            aria-pressed={warrantyDays === 'Custom'}
            className={`w-full min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
              warrantyDays === 'Custom'
                ? 'bg-[#B9EF68] text-[#07100B] border border-[#B9EF68] shadow-sm shadow-[#B9EF68]/25 font-semibold'
                : 'bg-[#101719] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
            }`}
          >
            Custom
          </button>

          {warrantyDays === 'Custom' && (
            <div className="pt-1">
              <input
                type="number"
                min="1"
                step="1"
                value={customWarrantyDays}
                onChange={(event) => onCustomWarrantyDaysChange(event.target.value)}
                className="app-field h-11 min-h-[44px] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
                placeholder="Enter warranty days (e.g. 14, 45, 180)"
                aria-label="Custom warranty days"
                required
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold shadow-md shadow-[#B9EF68]/20 px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
        >
          <Copy className="w-3.5 h-3.5" /> Copy Ad
        </button>
      </div>
    </div>
  </BottomSheetModal>
);
