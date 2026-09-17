import React from 'react';
import { Wand2 } from 'lucide-react';
import { CustomSelect } from '../../ui/CustomSelect';

interface BuildBasicDetailsProps {
  name: string;
  onNameChange: (value: string) => void;
  salePrice: string;
  onSalePriceChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onAutoFillTitle: () => void;
  warrantyDays?: string;
  onWarrantyDaysChange?: (value: string) => void;
  customWarrantyDays?: string;
  onCustomWarrantyDaysChange?: (value: string) => void;
}

export const BuildBasicDetails: React.FC<BuildBasicDetailsProps> = ({
  name,
  onNameChange,
  salePrice,
  onSalePriceChange,
  notes,
  onNotesChange,
  onAutoFillTitle,
  warrantyDays = '30',
  onWarrantyDaysChange,
  customWarrantyDays = '',
  onCustomWarrantyDaysChange,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div className="sm:col-span-2">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-zinc-300 font-medium text-xs">Build Title *</label>
          <button
            type="button"
            onClick={onAutoFillTitle}
            className="text-[#67E8F9] hover:text-white text-xs font-semibold flex items-center gap-1 bg-[#A3FF12]/15 hover:bg-[#A3FF12]/25 px-2 py-0.5 rounded-lg border border-[#A3FF12]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            <Wand2 className="w-3 h-3 text-[#A3FF12]" /> Auto-Fill Title
          </button>
        </div>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors font-sans"
          placeholder="e.g. 7700 + 4070 CUSTOM"
        />
      </div>
      <div>
        <label className="block text-zinc-300 font-medium mb-1 text-xs">Target Sale Price</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={salePrice}
            onChange={(e) => onSalePriceChange(e.target.value)}
            className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors pl-7"
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-zinc-300 font-medium mb-1 text-xs">Warranty Provided</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <CustomSelect
                value={warrantyDays}
                onChange={(val) => onWarrantyDaysChange?.(val)}
                options={[
                  { value: '30', label: '30 Days' },
                  { value: '60', label: '60 Days' },
                  { value: '90', label: '90 Days' },
                  { value: '365', label: '1 Year' },
                  { value: 'Custom', label: 'Custom' }
                ]}
                placeholder="Select..."
              />
            </div>
            {warrantyDays === 'Custom' && (
              <input
                type="number"
                min="1"
                step="1"
                value={customWarrantyDays}
                onChange={(e) => onCustomWarrantyDaysChange?.(e.target.value)}
                className="w-20 h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-2 py-2 text-xs sm:text-sm text-zinc-100 text-center placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors"
                placeholder="Days"
                required
              />
            )}
          </div>
        </div>
      </div>
      <div className="sm:col-span-3">
        <label className="block text-zinc-300 font-medium mb-1 text-xs">Notes / Description (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors resize-y font-sans"
          placeholder="Case fans layout, thermal paste used, OS details..."
        />
      </div>
    </div>
  );
};
