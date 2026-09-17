import React from 'react';
import { Box, Plus, Minus as Dash, Trash2 } from 'lucide-react';
import { InventoryComponent, PCBuildPart } from '../../../types';
import { formatCurrency } from '../../../utils/helpers';
import { formatSignedCurrency, getProfitBadgeClasses } from '../../../utils/financialDisplay';

interface BuildSelectedPartsListProps {
  selectedParts: PCBuildPart[];
  components: InventoryComponent[];
  totalBuildCost: number;
  salePrice: string;
  onUpdatePartQty: (componentId: string, entryId: string | undefined, delta: number) => void;
  onRemovePart: (componentId: string, entryId?: string) => void;
}

const CATEGORY_TAGS = ['GPU', 'CPU', 'Motherboard', 'RAM', 'Cooling', 'Storage', 'PSU', 'Case', 'Fans'];

export const BuildSelectedPartsList: React.FC<BuildSelectedPartsListProps> = ({
  selectedParts,
  components,
  totalBuildCost,
  salePrice,
  onUpdatePartQty,
  onRemovePart,
}) => {
  const targetPrice = parseFloat(salePrice) || 0;
  const profit = targetPrice - totalBuildCost;
  const margin = targetPrice > 0 ? (profit / targetPrice) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 whitespace-nowrap shrink-0 font-display">
            <Box className="w-4 h-4 text-[#A3FF12] shrink-0" /> Selected Parts ({selectedParts.length})
          </h4>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="bg-white/[0.06] border border-white/[0.08] text-zinc-300 whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-mono font-medium leading-none inline-flex items-center justify-center">
              Cost: {formatCurrency(totalBuildCost)}
            </span>
            <span className={`${getProfitBadgeClasses(targetPrice > 0 ? profit : 0)} border whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-mono font-semibold leading-none inline-flex items-center justify-center`}>
              Est Profit: {formatSignedCurrency(targetPrice > 0 ? profit : 0)} {targetPrice > 0 ? `(${Math.round(margin)}%)` : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_TAGS.map((cat) => {
            const isSelected = selectedParts.some((p) => p.category === cat);
            return (
              <span
                key={cat}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  isSelected
                    ? 'bg-[#A3FF12]/20 text-[#67E8F9] border border-[#A3FF12]/40'
                    : 'bg-[#121722] text-zinc-500 border border-white/[0.06]'
                }`}
              >
                {cat}
              </span>
            );
          })}
        </div>
      </div>

      {selectedParts.length === 0 ? (
        <div className="text-xs text-zinc-500 italic p-3.5 bg-[#121722] rounded-xl border border-white/[0.08] text-center font-sans">
          No parts selected yet. Pick parts from the categories below to include in this build.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {selectedParts.map((part, idx) => {
            const comp = components.find((c) => c.id === part.componentId);
            let purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);
            if (!purchaseEntry && comp?.purchaseHistory?.length) {
              purchaseEntry =
                comp.purchaseHistory.find((pe) => pe.unitPrice === part.unitCostAtAssignment) ||
                comp.purchaseHistory[0];
            }

            return (
              <div
                key={idx}
                className="bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center min-w-0 flex-1 pr-2">
                  <span className="text-xs font-medium leading-snug text-zinc-200 break-words font-sans">{part.componentName}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.06] shrink-0 px-2 py-0.5 rounded-lg text-xs font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                    {formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCostAtAssignment)}/ea
                  </span>
                  <div className="flex items-center gap-1 border border-white/[0.08] bg-[#0D1118] text-zinc-200 rounded-lg px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => onUpdatePartQty(part.componentId, part.purchaseEntryId, -1)}
                      className="p-0.5 text-zinc-400 hover:text-white transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Dash className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-4 text-center font-mono font-bold text-xs">{part.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdatePartQty(part.componentId, part.purchaseEntryId, 1)}
                      className="p-0.5 text-zinc-400 hover:text-white transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePart(part.componentId, part.purchaseEntryId);
                    }}
                    aria-label="Remove part"
                    className="text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
