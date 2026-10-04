import React from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { ComponentCategory, CATEGORIES } from '../../../types';
import { SUB_CATEGORIES, formatCurrency, getConflictingTags, CATEGORY_TAG_GROUPS } from '../../../utils/helpers';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { ExtractedPartInput } from './dismantleHelpers';

interface ModeBManualEntryProps {
  manualParts: ExtractedPartInput[];
  lockedParts: ExtractedPartInput[];
  handleAddPart: () => void;
  handleRemovePart: (id: string) => void;
  handleUpdatePart: (id: string, updates: Partial<ExtractedPartInput>) => void;
  handleToggleLock: (id: string) => void;
  optionalRows?: boolean;
  heading?: string;
  hideHeading?: boolean;
  highlightDelete?: boolean;
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
  optionalRows = false,
  heading = 'Itemize Components',
  hideHeading = false,
  highlightDelete = false,
}) => {
  const includedCount = optionalRows
    ? manualParts.filter((part) => part.name.trim().length > 0).length
    : manualParts.length;

  return (
    <div className="manual-parts-editor space-y-1.5">
      {!hideHeading && (
        <div className="manual-parts-heading flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-200 font-sans">
              {heading} ({includedCount} {includedCount === 1 ? 'Part' : 'Parts'})
            </label>
            {lockedParts.length > 0 && (
              <span className="text-[11px] font-mono bg-[#B9EF68]/15 border border-[#B9EF68]/30 text-[#83E5DF] px-1.5 py-0.5 rounded-md">
                {lockedParts.length} locked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddPart}
            className="app-button app-button-outline flex items-center gap-1 text-[11px] font-semibold h-7 min-h-7 px-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Component
          </button>
        </div>
      )}

      <div className={`divide-y divide-white/[0.08] ${hideHeading ? '' : 'border-y border-white/[0.08]'}`}>
        {manualParts.map((part, index) => (
          <div
            key={part.id}
            style={{ zIndex: manualParts.length - index + 20 }}
            className={`manual-part-row relative px-1 py-2 text-xs transition-colors ${
              part.isLocked
                ? 'bg-[#B9EF68]/[0.035]'
                : 'hover:bg-white/[0.015]'
            }`}
          >
            <div className="manual-part-identity flex items-center gap-2 h-[36px]">
              <div className="manual-part-category w-28 shrink-0 sm:w-32 h-[36px] flex items-center">
                <CustomSelect
                  options={categoryOptions}
                  value={part.category}
                  dropdownClassName="min-w-[130px]"
                  onChange={(val) => {
                    const newCat = val as ComponentCategory;
                    const validTags = SUB_CATEGORIES[newCat] || [];
                    const keptTags = (part.tags || []).filter(t => validTags.includes(t));
                    handleUpdatePart(part.id, { category: newCat, tags: keptTags });
                  }}
                  className="h-9 text-xs bg-[#0B1113] border-white/[0.08] hover:border-[#B9EF68]/50"
                />
              </div>
              <input
                type="text"
                required={!optionalRows}
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
                className="app-field h-[36px] min-h-[36px] max-h-[36px] min-w-0 flex-1 bg-[#0B1113] px-2.5 text-xs placeholder:text-zinc-500 font-sans self-center m-0 box-border rounded-lg"
              />
              {manualParts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePart(part.id)}
                  aria-label="Remove row"
                  className={
                    highlightDelete
                      ? 'manual-part-delete-btn flex h-[36px] w-[36px] min-h-[36px] min-w-[36px] max-h-[36px] max-w-[36px] shrink-0 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60 hover:text-rose-300 transition-colors shadow-sm self-center p-0 m-0 box-border'
                      : 'manual-part-delete-btn flex h-[36px] w-[36px] min-h-[36px] min-w-[36px] max-h-[36px] max-w-[36px] shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-rose-400 transition-colors hover:bg-white/[0.04] self-center p-0 m-0 box-border'
                  }
                  title="Remove row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="manual-part-costs flex items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5 h-[25px]">
              <div className="flex items-center gap-1.5 h-[25px]">
                <label className="text-[11px] font-medium text-zinc-400 shrink-0 font-sans leading-none flex items-center h-[25px] m-0 p-0">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  value={part.quantity}
                  onChange={(e) =>
                    handleUpdatePart(part.id, {
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-12 sm:w-14 !h-[25px] !min-h-[25px] !max-h-[25px] bg-[#0B1113] border border-white/[0.12] rounded-md px-1 text-center text-[11px] font-mono text-zinc-100 focus:outline-none focus:border-[#B9EF68] box-border leading-[23px] flex items-center justify-center self-center m-0"
                />
              </div>

              <div className="flex items-center gap-1.5 h-[25px]">
                <label className="text-[11px] font-medium text-zinc-400 shrink-0 font-sans leading-none flex items-center h-[25px] m-0 p-0">Cost:</label>
                <div className="relative flex items-center h-[25px] m-0 p-0 self-center">
                  <span className="cost-currency-symbol absolute left-2 inset-y-0 my-auto text-zinc-500 text-[11px] font-mono leading-[25px] pointer-events-none z-10 flex items-center select-none">
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
                    className={`w-24 sm:w-28 !h-[25px] !min-h-[25px] !max-h-[25px] bg-[#0B1113] border rounded-md pl-5 pr-6 text-[11px] font-mono focus:outline-none box-border leading-[23px] flex items-center self-center m-0 transition-colors ${
                      part.isLocked
                        ? 'border-[#B9EF68]/50 text-[#83E5DF] focus:border-[#B9EF68]'
                        : 'border-white/[0.12] text-zinc-100 focus:border-[#B9EF68]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleLock(part.id)}
                    aria-label={part.isLocked ? 'Unlock price' : 'Lock price'}
                    className={`absolute right-1 inset-y-0 my-auto flex items-center justify-center h-4 w-4 p-0 rounded transition-colors ${
                      part.isLocked
                        ? 'text-[#B9EF68] hover:text-[#83E5DF] hover:bg-[#B9EF68]/15'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                    title={
                      part.isLocked
                        ? 'Custom locked price. Click to unlock for auto-distribution.'
                        : 'Unlocked (auto-distributable). Click to lock this price.'
                    }
                  >
                    {part.isLocked ? (
                      <Lock className="w-2.5 h-2.5 text-[#B9EF68]" />
                    ) : (
                      <Unlock className="w-2.5 h-2.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center text-right text-[11px] font-mono text-zinc-400 shrink-0 pl-1 h-[25px] leading-none">
                <span>Total:&nbsp;</span>
                <span
                  className={`font-semibold ${
                    part.isLocked ? 'text-[#83E5DF]' : 'text-zinc-200'
                  }`}
                >
                  {formatCurrency(
                    (Number(part.quantity) || 1) * (Number(part.unitCost) || 0)
                  )}
                </span>
              </div>
            </div>
            {CATEGORY_TAG_GROUPS[part.category] && CATEGORY_TAG_GROUPS[part.category].length > 0 ? (
              <div className="manual-part-tags border-t border-white/[0.06] pt-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CATEGORY_TAG_GROUPS[part.category].map((group, groupIdx) => (
                    <React.Fragment key={group.label}>
                      {groupIdx > 0 && (
                        <div
                          className="h-3.5 w-px bg-white/[0.14] shrink-0 mx-0.5 self-center"
                          aria-hidden="true"
                        />
                      )}
                      {group.tags.map((tag) => {
                        const isSelected = (part.tags || []).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const prev = part.tags || [];
                              let newTags: string[];
                              if (prev.includes(tag)) {
                                newTags = prev.filter((t) => t !== tag);
                              } else {
                                const conflicting = getConflictingTags(tag, part.category).map((c) => c.toLowerCase());
                                const filtered = prev.filter((t) => !conflicting.includes(t.toLowerCase()));
                                newTags = [...filtered, tag];
                              }
                              handleUpdatePart(part.id, { tags: newTags });
                            }}
                            className={`app-chip app-subcategory-chip px-2 ${
                              isSelected
                                ? 'border-[#83E5DF]/50 bg-[#83E5DF]/[0.08] text-[#9FF8F4]'
                                : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-zinc-200'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : SUB_CATEGORIES[part.category] && SUB_CATEGORIES[part.category].length > 0 ? (
              <div className="manual-part-tags border-t border-white/[0.06] pt-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {SUB_CATEGORIES[part.category].map((tag) => {
                    const isSelected = (part.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = part.tags || [];
                          let newTags: string[];
                          if (prev.includes(tag)) {
                            newTags = prev.filter((t) => t !== tag);
                          } else {
                            const conflicting = getConflictingTags(tag, part.category).map((c) => c.toLowerCase());
                            const filtered = prev.filter((t) => !conflicting.includes(t.toLowerCase()));
                            newTags = [...filtered, tag];
                          }
                          handleUpdatePart(part.id, { tags: newTags });
                        }}
                        className={`app-chip app-subcategory-chip px-2 ${
                          isSelected
                            ? 'border-[#83E5DF]/50 bg-[#83E5DF]/[0.08] text-[#9FF8F4]'
                            : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-zinc-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
