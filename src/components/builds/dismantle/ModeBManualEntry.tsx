import React from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { ComponentCategory, CATEGORIES } from '../../../types';
import { SUB_CATEGORIES, formatCurrency } from '../../../utils/helpers';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { ExtractedPartInput } from './dismantleHelpers';

interface ModeBManualEntryProps {
  manualParts: ExtractedPartInput[];
  lockedParts: ExtractedPartInput[];
  handleAddPart: () => void;
  handleRemovePart: (id: string) => void;
  handleUpdatePart: (id: string, updates: Partial<ExtractedPartInput>) => void;
  handleToggleLock: (id: string) => void;
}

const categoryOptions = CATEGORIES.map((cat) => ({
  label: cat,
  value: cat,
}));

export const ModeBManualEntry: React.FC<ModeBManualEntryProps> = ({
  manualParts,
  lockedParts,
  handleAddPart,
  handleRemovePart,
  handleUpdatePart,
  handleToggleLock,
}) => {
  return (
    <div className="space-y-2.5 pb-8">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-zinc-200 font-sans">
            Itemize Components ({manualParts.length} Parts)
          </label>
          {lockedParts.length > 0 && (
            <span className="text-[10px] font-mono bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] px-1.5 py-0.5 rounded-md">
              {lockedParts.length} locked
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddPart}
          className="flex items-center gap-1 text-xs text-[#7C6CF2] hover:text-[#9D91FA] transition-colors font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] rounded-lg px-2 py-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Component
        </button>
      </div>

      <div className="space-y-2">
        {manualParts.map((part, index) => (
          <div
            key={part.id}
            style={{ zIndex: manualParts.length - index + 20 }}
            className={`relative p-2.5 sm:p-3 rounded-xl bg-[#121722] border text-xs space-y-2.5 transition-colors ${
              part.isLocked
                ? 'border-[#7C6CF2]/40 shadow-sm shadow-[#7C6CF2]/10'
                : 'border-white/[0.08] hover:border-white/[0.15]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-28 sm:w-32 shrink-0">
                <CustomSelect
                  options={categoryOptions}
                  value={part.category}
                  onChange={(val) => {
                    const newCat = val as ComponentCategory;
                    const validTags = SUB_CATEGORIES[newCat] || [];
                    const keptTags = (part.tags || []).filter(t => validTags.includes(t));
                    handleUpdatePart(part.id, { category: newCat, tags: keptTags });
                  }}
                  className="h-8 text-xs bg-[#0D1118] border-white/[0.08] hover:border-[#7C6CF2]/50"
                />
              </div>
              <input
                type="text"
                required
                placeholder={`e.g. ${
                  part.category === 'GPU'
                    ? 'RTX 3070 8GB'
                    : part.category === 'CPU'
                    ? 'Ryzen 5 5600X'
                    : part.category === 'Motherboard'
                    ? 'B550M Pro4'
                    : part.category === 'RAM'
                    ? '16GB DDR4-3200'
                    : part.category === 'Storage'
                    ? '1TB NVMe SSD'
                    : part.category === 'PSU'
                    ? '650W 80+ Bronze'
                    : part.category === 'Case'
                    ? 'Micro-ATX Tower'
                    : 'Air Cooler'
                }`}
                value={part.name}
                onChange={(e) => handleUpdatePart(part.id, { name: e.target.value })}
                className="flex-1 min-w-0 h-8 bg-[#0D1118] border border-white/[0.08] rounded-xl px-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors font-sans"
              />
              {manualParts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePart(part.id)}
                  aria-label="Remove row"
                  className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors shrink-0 rounded-lg hover:bg-white/[0.04]"
                  title="Remove row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400 shrink-0 font-sans">Qty:</span>
                <input
                  type="number"
                  min="1"
                  value={part.quantity}
                  onChange={(e) =>
                    handleUpdatePart(part.id, {
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-12 sm:w-14 h-7 bg-[#0D1118] border border-white/[0.08] rounded-lg px-1.5 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-[#7C6CF2]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400 shrink-0 font-sans">Unit $:</span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-zinc-500 text-[11px] font-mono pointer-events-none z-10">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={part.unitCost || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleUpdatePart(part.id, {
                        unitCost: isNaN(val) ? 0 : val,
                        isLocked: true,
                      });
                    }}
                    className={`w-24 sm:w-28 h-7 bg-[#0D1118] border rounded-lg pl-5 pr-7 text-xs font-mono focus:outline-none transition-colors ${
                      part.isLocked
                        ? 'border-[#7C6CF2]/50 text-[#9D91FA] focus:border-[#7C6CF2]'
                        : 'border-white/[0.08] text-zinc-100 focus:border-[#7C6CF2]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleLock(part.id)}
                    aria-label={part.isLocked ? 'Unlock price' : 'Lock price'}
                    className={`absolute right-1 p-1 rounded-md transition-colors ${
                      part.isLocked
                        ? 'text-[#7C6CF2] hover:text-[#9D91FA] hover:bg-[#7C6CF2]/15'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                    title={
                      part.isLocked
                        ? 'Custom locked price. Click to unlock for auto-distribution.'
                        : 'Unlocked (auto-distributable). Click to lock this price.'
                    }
                  >
                    {part.isLocked ? (
                      <Lock className="w-3 h-3 text-[#7C6CF2]" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right text-[11px] font-mono text-zinc-400 shrink-0 pl-1">
                Total:{' '}
                <span
                  className={`font-semibold ${
                    part.isLocked ? 'text-[#9D91FA]' : 'text-zinc-200'
                  }`}
                >
                  {formatCurrency(
                    (Number(part.quantity) || 1) * (Number(part.unitCost) || 0)
                  )}
                </span>
              </div>
            </div>
            {SUB_CATEGORIES[part.category] && SUB_CATEGORIES[part.category].length > 0 && (
              <div className="pt-1.5 border-t border-white/[0.06]">
                <div className="flex flex-wrap gap-1.5">
                  {SUB_CATEGORIES[part.category].map(tag => {
                    const isSelected = (part.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = part.tags || [];
                          const newTags = prev.includes(tag) 
                            ? prev.filter(t => t !== tag) 
                            : [...prev, tag];
                          handleUpdatePart(part.id, { tags: newTags });
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border ${
                          isSelected
                            ? 'bg-[#7C6CF2]/20 text-[#9D91FA] border-[#7C6CF2]/40'
                            : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-zinc-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
