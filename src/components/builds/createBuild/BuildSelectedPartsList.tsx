import React from 'react';
import { Box, Plus, Minus as Dash, Trash2 } from 'lucide-react';
import { InventoryComponent, PCBuildPart } from '../../../types';
import { formatCurrency, formatReadableDate, getCategoryPresentation, getConditionDotColor } from '../../../utils/helpers';
import { formatSignedCurrency, getProfitTextColor } from '../../../utils/financialDisplay';
import { sortByCategory } from '../../../utils/sorting';
import { normalizePlatform } from '../../../utils/platformDisplay';
import { usePrivacy } from '../../../context/PrivacyContext';

interface BuildSelectedPartsListProps {
  selectedParts: PCBuildPart[];
  components: InventoryComponent[];
  totalBuildCost: number;
  salePrice: string;
  onUpdatePartQty: (componentId: string, entryId: string | undefined, delta: number) => void;
  onRemovePart: (componentId: string, entryId?: string) => void;
}

export const BuildSelectedPartsList: React.FC<BuildSelectedPartsListProps> = ({
  selectedParts,
  components,
  totalBuildCost,
  salePrice,
  onUpdatePartQty,
  onRemovePart,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const targetPrice = parseFloat(salePrice) || 0;
  const profit = targetPrice - totalBuildCost;
  const margin = targetPrice > 0 ? (profit / targetPrice) * 100 : 0;

  return (
    <div className="form-section space-y-3">
      <div className="flex flex-col gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 whitespace-nowrap shrink-0 font-display">
            <Box className="w-4 h-4 text-[#B9EF68] shrink-0" /> Selected Parts ({selectedParts.length})
          </h4>
          <div className="flex shrink-0 items-center divide-x divide-white/[0.1] font-mono text-[11px]">
            <span className="pr-2 text-zinc-500">COST <strong className="ml-1 text-zinc-200">{formatCurrency(totalBuildCost)}</strong></span>
            <span className={`pl-2 ${getProfitTextColor(targetPrice > 0 ? profit : 0)}`}>PROFIT <strong className="ml-1">{formatSignedCurrency(targetPrice > 0 ? profit : 0)}</strong>{targetPrice > 0 ? ` · ${Math.round(margin)}%` : ''}</span>
          </div>
        </div>
      </div>

      {selectedParts.length === 0 ? (
        <div className="app-panel-quiet p-4 text-center text-xs italic text-zinc-500">
          No parts selected yet. Pick parts from the categories below to include in this build.
        </div>
      ) : (
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {sortByCategory(selectedParts).map((part, idx) => {
            const comp = components.find((c) => c.id === part.componentId);
            let purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);
            if (!purchaseEntry && comp?.purchaseHistory?.length) {
              purchaseEntry =
                comp.purchaseHistory.find((pe) => pe.unitPrice === part.unitCostAtAssignment) ||
                comp.purchaseHistory[0];
            }

            const category = getCategoryPresentation(part.category);
            const metadata = [
              purchaseEntry?.condition,
              !hideSupplierNames && purchaseEntry?.platform ? normalizePlatform(String(purchaseEntry.platform)) : undefined,
              purchaseEntry?.paymentMethod ? String(purchaseEntry.paymentMethod) : undefined,
              purchaseEntry?.date ? formatReadableDate(purchaseEntry.date) || purchaseEntry.date : undefined,
            ].filter(Boolean) as string[];

            return (
              <div
                key={idx}
                className="app-panel-quiet relative flex items-start justify-between gap-2 px-3 py-2.5 pr-4"
              >
                <span className={`absolute bottom-2.5 right-1 top-2.5 w-0.5 rounded-full ${category.railClass}`} />
                <div className="min-w-0 flex-1 pr-1">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className={`w-[3.8rem] shrink-0 pt-0.5 font-mono text-[11px] font-bold ${category.textClass}`}>{category.label}</span>
                    <span className="min-w-0 flex-1 break-words font-sans text-xs font-semibold leading-snug text-zinc-200">{part.componentName}</span>
                  </div>
                  {metadata.length > 0 && (
                    <div className="ml-[4.3rem] mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] leading-snug text-zinc-500">
                      {purchaseEntry?.condition && <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(purchaseEntry.condition)}`} />{purchaseEntry.condition}</span>}
                      {metadata.slice(purchaseEntry?.condition ? 1 : 0).map((item, metaIndex) => <span key={`${item}-${metaIndex}`}>· {item}</span>)}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap font-mono text-xs font-bold text-zinc-100">
                    {formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCostAtAssignment)}{part.quantity > 1 ? '/ea' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0B1113] px-1.5 py-1 text-zinc-200">
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
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
