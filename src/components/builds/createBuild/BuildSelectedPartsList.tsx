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
    <div className="form-section selected-parts-section space-y-2">
      <div className="flex flex-col gap-1 border-b border-white/[0.08] pb-2">
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
        <div className="build-selected-list">
          {sortByCategory(selectedParts).map((part, idx) => {
            const comp = components.find((c) => c.id === part.componentId);
            const purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);

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
                className="selected-part-row relative"
              >
                <span className={`selected-part-rail absolute bottom-1.5 right-0 top-1.5 w-0.5 rounded-full ${category.railClass}`} />
                <div className="selected-part-content">
                  <div className="selected-part-identity">
                    <span className={`selected-part-category font-mono font-bold ${category.textClass}`}>{category.label}</span>
                    <span className="selected-part-name">{part.componentName}</span>
                  </div>
                  {metadata.length > 0 && (
                    <div className="selected-part-meta">
                      {purchaseEntry?.condition && <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(purchaseEntry.condition)}`} />{purchaseEntry.condition}</span>}
                      {metadata.slice(purchaseEntry?.condition ? 1 : 0).map((item, metaIndex) => <span key={`${item}-${metaIndex}`}>· {item}</span>)}
                    </div>
                  )}
                </div>

                <div className="selected-part-actions">
                  <span className="selected-part-price">
                    {formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCostAtAssignment)}{part.quantity > 1 ? '/ea' : ''}
                  </span>
                  <div className="selected-part-tools">
                    <div className="selected-part-quantity">
                    <button
                      type="button"
                      onClick={() => onUpdatePartQty(part.componentId, part.purchaseEntryId, -1)}
                      className="text-zinc-400 transition-colors hover:text-white"
                      aria-label="Decrease quantity"
                    >
                      <Dash className="h-3 w-3" />
                    </button>
                    <span>{part.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdatePartQty(part.componentId, part.purchaseEntryId, 1)}
                      className="text-zinc-400 transition-colors hover:text-white"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePart(part.componentId, part.purchaseEntryId);
                      }}
                      aria-label="Remove part"
                      className="selected-part-remove text-zinc-400 transition-colors hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
