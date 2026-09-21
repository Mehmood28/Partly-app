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
    <div className="build-basic-details grid grid-cols-2 gap-2.5 border-b border-white/[0.09] pb-3 text-xs">
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-zinc-300 font-medium text-xs">Build Title *</label>
          <button
            type="button"
            onClick={onAutoFillTitle}
            className="flex min-h-8 items-center gap-1 rounded-lg border border-[#83E5DF]/25 bg-[#83E5DF]/[0.07] px-2 text-[11px] font-semibold text-[#9FF8F4] transition-colors hover:bg-[#83E5DF]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <Wand2 className="h-3 w-3 text-[#B9EF68]" /> Auto-Fill Title
          </button>
        </div>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="app-field px-3 text-xs placeholder:text-zinc-600"
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
            className="app-field px-3 pl-7 font-mono text-xs placeholder:text-zinc-600"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <div>
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
                className="app-field w-16 px-2 text-center text-xs placeholder:text-zinc-600"
                placeholder="Days"
                required
              />
            )}
          </div>
        </div>
      </div>
      <div className="col-span-2">
        <label className="block text-zinc-300 font-medium mb-1 text-xs">Notes / Description (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="app-field min-h-12 resize-y px-3 py-2 text-xs placeholder:text-zinc-600"
          placeholder="Case fans layout, thermal paste used, OS details..."
        />
      </div>
    </div>
  );
};
