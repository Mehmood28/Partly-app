import React, { useState } from 'react';
import { InventoryComponent } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { useToast } from '../context/ToastContext';
import {
  calculateAverageUnitCost,
  calculateUnassignedQuantityStrict,
  calculateUnassignedValueStrict,
  formatCurrency,
  formatReadableDate,
  getCategoryPresentation,
  getConditionDotColor,
  getUnassignedBatches,
} from '../utils/helpers';
import { isPartedOutTradeInEntry, resolvePartedOutEntryOrigin } from '../utils/tradeInOrigin';
import { normalizePlatform } from '../utils/platformDisplay';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Tag,
} from 'lucide-react';

interface ComponentCardProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  actionOverride?: React.ReactNode;
  unassignedQuantityOverride?: number;
  readonlyMode?: boolean;
  component: InventoryComponent;
  onAddPurchaseEntry?: (componentId: string) => void;
  onDeletePurchaseEntry?: (componentId: string, entryId: string) => { success: boolean; error?: string } | void;
  onUpdateMarketValue?: (componentId: string, value: number) => void;
  onEditComponent?: (component: InventoryComponent) => void;
  onDeleteComponent?: (componentId: string) => { success: boolean; error?: string } | void;
  onSellPart?: (component: InventoryComponent, purchaseEntryId: string) => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = React.memo(({
  isExpanded: propIsExpanded,
  onToggle,
  component,
  onAddPurchaseEntry,
  onDeletePurchaseEntry,
  onEditComponent,
  onDeleteComponent,
  onSellPart,
  actionOverride,
  readonlyMode,
  unassignedQuantityOverride,
}) => {
  const { state } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();
  const [internalIsExpanded, setInternalIsExpanded] = useState<boolean>(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalIsExpanded;
  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalIsExpanded(!internalIsExpanded);
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const unassignedQty = unassignedQuantityOverride !== undefined ? unassignedQuantityOverride : calculateUnassignedQuantityStrict(component, state.builds);
  const unassignedVal = calculateUnassignedValueStrict(component, state.builds);
  const avgCost = unassignedQty > 0 ? unassignedVal / unassignedQty : calculateAverageUnitCost(component);
  const visibleBatchCount = getUnassignedBatches(component, state.builds).length;

  const categoryPresentation = getCategoryPresentation(component.category);

  const getCardBorder = () => {
    return 'border-white/[0.08] hover:border-[#7C6CF2]/40 shadow-sm';
  };

  return (
    <div className={`bg-[#0D1118] border rounded-xl overflow-hidden transition-all duration-200 ${getCardBorder()}`} style={{ contain: 'content', willChange: 'transform' }}>
      {/* Collapsed Header Bar - Clickable for mobile */}
      <div 
        className="relative cursor-pointer px-3 py-2.5 pr-4"
        onClick={handleToggle}
      >
        <span className={`absolute right-1.5 top-2.5 bottom-2.5 w-0.5 rounded-full ${categoryPresentation.railClass}`} />
        <div className="flex items-start gap-2 min-w-0">
          <span className={`w-[3.8rem] shrink-0 pt-0.5 font-mono text-[10px] font-bold tracking-wide ${categoryPresentation.textClass}`}>
            {categoryPresentation.label}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 break-words text-xs font-semibold leading-snug tracking-tight text-zinc-100 sm:text-sm">
                {String(component.name || '')}
              </h3>
              <span className="shrink-0 font-mono text-xs font-bold text-zinc-100 whitespace-nowrap">{formatCurrency(unassignedVal)}</span>
              <div className="-mr-1 -mt-0.5 flex items-center gap-1 text-zinc-500">
                {actionOverride ? actionOverride : null}
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] leading-snug text-zinc-500">
              {(component.tags || []).filter((tag): tag is string => typeof tag === 'string' && Boolean(tag)).map((tag, idx) => <span key={`${tag}-${idx}`}>{idx > 0 && '· '}{tag}</span>)}
              {(component.tags || []).some((tag) => typeof tag === 'string' && Boolean(tag)) && <span>·</span>}
              <span>{unassignedQty} in stock</span>
              <span>· {formatCurrency(avgCost)} each</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content Section */}
      {isExpanded && (
        <div className="border-t border-white/[0.08] bg-[#121722] p-3 space-y-3">
          
          {/* Expanded Action Toolbar */}
          {!readonlyMode && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
              {onAddPurchaseEntry && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPurchaseEntry(component.id);
                  }}
                  className="bg-[#7C6CF2]/15 hover:bg-[#7C6CF2]/25 text-[#9D91FA] border border-[#7C6CF2]/30 transition-colors whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Stock
                </button>
              )}
              {onEditComponent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditComponent(component);
                  }}
                  className="bg-[#0D1118] hover:bg-[#182030] text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              {onDeleteComponent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors whitespace-nowrap flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          )}

          {/* PURCHASE HISTORY Section */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                PURCHASE HISTORY · {visibleBatchCount} BATCH{visibleBatchCount === 1 ? '' : 'ES'}
              </span>
              <span className="font-mono text-[10px] font-semibold text-[#B7AEFF]">{formatCurrency(unassignedVal)}</span>
            </div>

            {(() => {
              const visibleBatches = getUnassignedBatches(component, state.builds);

              if (component.purchaseHistory.length === 0) {
                return (
                  <div className="text-xs text-zinc-500 italic p-3 bg-[#0D1118] rounded-xl border border-white/[0.06]">
                    No purchase entries logged yet. Click "Add Stock" above.
                  </div>
                );
              }

              if (visibleBatches.length === 0) {
                return (
                  <div className="text-xs text-zinc-500 italic p-3 bg-[#0D1118] rounded-xl border border-white/[0.06]">
                    All batches for this part are currently assigned or sold.
                  </div>
                );
              }

              return (
                <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                  {visibleBatches.map((batch) => {
                    const entry = batch.entry;
                    const entryUnitPrice = batch.unitCost;
                    const entryTotal = entryUnitPrice * batch.availableQuantity;
                    
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

                    return (
                      <div key={entry.id} className="relative border-b border-white/[0.06] bg-[#0D1118] px-3 py-2.5 pr-4 last:border-b-0">
                        <span className={`absolute right-1.5 top-2.5 bottom-2.5 w-0.5 rounded-full ${categoryPresentation.railClass}`} />
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-300">{formatReadableDate(entry.date) || entry.date}</span>
                              <span className="shrink-0 font-mono text-xs font-bold text-zinc-100 whitespace-nowrap">{formatCurrency(entryTotal)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] leading-snug text-zinc-500">
                              <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(entry.condition)}`} />{entry.condition}</span>
                              {isTradeUpBatch && <span>· Trade-up</span>}
                              {isPartedOutTradeInBatch ? (
                                <span>· {tradeInOrigin?.buyerName ? `Trade-in: ${tradeInOrigin.buyerName}` : 'Trade-in'}</span>
                              ) : (
                                <>
                                  {!hideSupplierNames && entry.platform && <span>· {normalizePlatform(String(entry.platform))}</span>}
                                  {entry.paymentMethod && <span>· {String(entry.paymentMethod)}</span>}
                                </>
                              )}
                              <span>· {batch.availableQuantity} × {formatCurrency(entryUnitPrice)} each</span>
                              {(entry.taxPercent ?? 0) > 0 && <span className="text-rose-400">· +Tax</span>}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          {!readonlyMode && onSellPart && batch.availableQuantity > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSellPart(component, entry.id);
                              }}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#B7AEFF] transition-colors hover:bg-[#7C6CF2]/10 hover:text-white"
                            >
                              <Tag className="w-3 h-3" /> Sell
                            </button>
                          )}
                          {!readonlyMode && onDeletePurchaseEntry && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingEntryId(entry.id);
                              }}
                              className="rounded-lg p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Component Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Component"
        message={`Are you sure you want to delete "${String(component.name || "")}"? This will remove the component and its purchase history from inventory.`}
        confirmText="Delete Component"
        onConfirm={() => {
          const result = onDeleteComponent?.(component.id);
          if (result && !result.success) {
            showToast(result.error || 'Cannot delete component', 'error');
          } else {
            setShowDeleteConfirm(false);
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Delete Purchase Entry Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingEntryId}
        title="Delete Purchase Entry"
        message="Are you sure you want to delete this purchase entry? Component quantity and total cost calculations will be updated."
        confirmText="Delete Entry"
        onConfirm={() => {
          if (deletingEntryId) {
            const compId = deletingEntryId ? component.purchaseHistory.find(e => e.id === deletingEntryId)?._originalComponentId || component.id : component.id;
            const result = onDeletePurchaseEntry?.(compId, deletingEntryId);
            if (result && !result.success) {
              showToast(result.error || 'Cannot delete purchase entry', 'error');
            } else {
              setDeletingEntryId(null);
            }
          }
        }}
        onCancel={() => setDeletingEntryId(null)}
      />
    </div>
  );
});
