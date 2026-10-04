import React, { useState } from 'react';
import { InventoryComponent, PurchaseEntry } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { useToast } from '../context/ToastContext';
import {
  calculateEffectiveUnitCost,
  calculateUnassignedQuantityStrict,
  calculateUnassignedValueStrict,
  formatCurrency,
  formatReadableDate,
  getCategoryPresentation,
  getUnassignedBatches,
  normalizeTags,
} from '../utils/helpers';
import { isPartedOutTradeInEntry, resolvePartedOutEntryOrigin } from '../utils/tradeInOrigin';
import { normalizePlatform } from '../utils/platformDisplay';
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Tag,
} from 'lucide-react';

interface ComponentCardProps {
  isActive?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  component: InventoryComponent;
  draftSelectedParts?: import('../types').PCBuildPart[];
  showAdminActions?: boolean;
  renderBatchActions?: (
    batch: { entry: PurchaseEntry; availableQuantity: number; unitCost: number },
    component: InventoryComponent
  ) => React.ReactNode;
  renderBatchFooter?: (
    batch: { entry: PurchaseEntry; availableQuantity: number; unitCost: number },
    component: InventoryComponent
  ) => React.ReactNode;
  onAddPurchaseEntry?: (componentId: string) => void;
  onDeletePurchaseEntry?: (componentId: string, entryId: string) => { success: boolean; error?: string } | void;
  onEditComponent?: (component: InventoryComponent) => void;
  onDeleteComponent?: (componentId: string) => { success: boolean; error?: string } | void;
  onSellPart?: (component: InventoryComponent, purchaseEntryId: string) => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = React.memo(({
  isActive = true,
  isExpanded: propIsExpanded,
  onToggle,
  component,
  draftSelectedParts,
  showAdminActions = true,
  renderBatchActions,
  renderBatchFooter,
  onAddPurchaseEntry,
  onDeletePurchaseEntry,
  onEditComponent,
  onDeleteComponent,
  onSellPart,
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

  const visibleBatches = React.useMemo(() => {
    return getUnassignedBatches(component, state.builds).map((batch) => {
      const draftQty = draftSelectedParts
        ? draftSelectedParts.reduce(
            (sum, p) =>
              p.componentId === component.id && p.purchaseEntryId === batch.entry.id
                ? sum + p.quantity
                : sum,
            0
          )
        : 0;
      return {
        ...batch,
        availableQuantity: Math.max(0, batch.availableQuantity - draftQty),
      };
    });
  }, [component, state.builds, draftSelectedParts]);

  const unassignedQty = draftSelectedParts
    ? visibleBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
    : calculateUnassignedQuantityStrict(component, state.builds);

  const unassignedVal = draftSelectedParts
    ? visibleBatches.reduce((sum, b) => sum + b.availableQuantity * b.unitCost, 0)
    : calculateUnassignedValueStrict(component, state.builds);

  const avgCost = draftSelectedParts
    ? (unassignedQty > 0 ? unassignedVal / unassignedQty : 0)
    : calculateEffectiveUnitCost(component, state.builds);

  const categoryPresentation = getCategoryPresentation(component.category);

  const storageHealth = React.useMemo(() => {
    if (component.category !== 'Storage') return undefined;
    if (typeof component.healthPercent === 'number') return component.healthPercent;
    const batches = getUnassignedBatches(component, state.builds);
    const batchWithHealth = batches.find(b => typeof b.entry.healthPercent === 'number');
    if (batchWithHealth && typeof batchWithHealth.entry.healthPercent === 'number') {
      return batchWithHealth.entry.healthPercent;
    }
    const entryWithHealth = (component.purchaseHistory || []).find(e => typeof e.healthPercent === 'number');
    return entryWithHealth?.healthPercent;
  }, [component, state.builds]);

  return (
    <div className={`app-panel stock-card border-white/[0.08] transition-colors hover:border-[#B9EF68]/40 ${isExpanded ? 'stock-card-expanded' : ''}`}>
      {/* Collapsed Header Bar - Clickable for mobile */}
      <div
        className="stock-card-header" role="button" tabIndex={0} aria-expanded={isExpanded}
        onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleToggle(); } }}
        onClick={handleToggle}
      >

        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`stock-type ${categoryPresentation.textClass}`}>
            {categoryPresentation.label}
          </span>
          <ChevronDown className={`stock-toggle ${isExpanded ? 'stock-toggle-expanded' : ''}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="stock-name">
                {String(component.name || '')}
              </h3>
              <span className="stock-total">{formatCurrency(unassignedVal)}</span>
            </div>
            <div className="stock-summary">
              {(() => {
                const items: React.ReactNode[] = [];
                const sortedTags = normalizeTags(component.tags, component.category);
                sortedTags.forEach((tag) => {
                  items.push(tag);
                });
                items.push(`${unassignedQty} in stock`);
                items.push(`${formatCurrency(avgCost)} each`);
                if (component.category === 'Storage' && storageHealth !== undefined) {
                  items.push(`${storageHealth}%`);
                }
                return items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-zinc-500 select-none">·</span>}
                    <span>{item}</span>
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content Section */}
      {isExpanded && (
        <div className="stock-expanded">

          {/* Expanded Action Toolbar */}
          {showAdminActions && (onAddPurchaseEntry || onEditComponent || onDeleteComponent) && (
            <div className="stock-admin-toolbar">
              {onAddPurchaseEntry && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPurchaseEntry(component.id);
                  }}
                  className="app-button app-button-outline flex h-[28px] min-h-[28px] items-center justify-center gap-1 whitespace-nowrap px-2 text-[11px] font-semibold"
                >
                  <Plus className="w-3 h-3" /> Add Stock
                </button>
              )}
              {onEditComponent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditComponent(component);
                  }}
                  className="app-button flex h-[28px] min-h-[28px] items-center justify-center gap-1 whitespace-nowrap px-2 text-[11px] font-semibold"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
              {onDeleteComponent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="app-button app-button-danger flex h-[28px] min-h-[28px] items-center justify-center gap-1 whitespace-nowrap px-2 text-[11px] font-semibold"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          )}

          {/* Available inventory batches. */}
          <div>
            {(() => {
              if (component.purchaseHistory.length === 0) {
                return (
                  <div className="text-xs text-zinc-500 italic p-3 bg-[#0B1113] border-y border-white/[0.06]">
                    No purchase entries logged yet. Click "Add Stock" above.
                  </div>
                );
              }

              if (visibleBatches.length === 0) {
                return (
                  <div className="text-xs text-zinc-500 italic p-3 bg-[#0B1113] border-y border-white/[0.06]">
                    All batches for this part are currently assigned or sold.
                  </div>
                );
              }

              return (
                <div className="stock-batch-compact-list">
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

                    const sellerText = isPartedOutTradeInBatch
                      ? (tradeInOrigin?.buyerName ? `Traded in by ${tradeInOrigin.buyerName}` : 'Trade-in')
                      : (!hideSupplierNames && entry.platform ? normalizePlatform(String(entry.platform)) : '—');

                    return (
                      <React.Fragment key={entry.id}>
                        <div className={`stock-batch-compact ${renderBatchFooter ? '!pr-0' : ''}`}>
                          <div className="stock-batch-line stock-batch-line-primary">
                            <strong>{formatReadableDate(entry.date) || entry.date}</strong>
                            <span><em>Seller</em><span className="stock-batch-value">{sellerText}</span></span>
                            <span>{batch.availableQuantity > 1 ? `${batch.availableQuantity} × ${formatCurrency(entryUnitPrice)}` : ''}</span>
                          </div>
                          <div className="stock-batch-line stock-batch-line-secondary">
                            <span>{entry.condition}{component.category === 'Storage' && typeof entry.healthPercent === 'number' ? ` · ${entry.healthPercent}%` : ''}</span>
                            <span><em>Payment</em><span className="stock-batch-value">{isPartedOutTradeInBatch ? 'Trade-in' : (entry.paymentMethod || '—')}{isTradeUpBatch ? ' · Trade-up' : ''}</span></span>
                            <strong>{formatCurrency(entryTotal)}</strong>
                          </div>
                          {!renderBatchFooter && (
                            <div className="batch-actions">
                              {renderBatchActions ? (
                                renderBatchActions(batch, component)
                              ) : (
                                <>
                                  {onSellPart && batch.availableQuantity > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSellPart(component, entry.id);
                                      }}
                                      className="flex h-[26px] items-center gap-1 rounded-lg border border-[#83E5DF]/25 px-2 text-xs font-semibold text-[#9FF8F4] transition-colors hover:bg-[#83E5DF]/10 hover:text-white"
                                    >
                                      <Tag className="w-3 h-3" /> Sell
                                    </button>
                                  )}
                                  {onDeletePurchaseEntry && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingEntryId(entry.id);
                                      }}
                                      className="flex h-[26px] items-center justify-center rounded-lg border border-rose-500/25 px-2 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                                      title="Delete entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {renderBatchFooter && (
                            <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-end">
                              {renderBatchFooter(batch, component)}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
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
        isOpen={showDeleteConfirm && isActive}
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
        isOpen={!!deletingEntryId && isActive}
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
