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
  getUnassignedBatches,
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
  isActive = true,
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

  const categoryPresentation = getCategoryPresentation(component.category);

  const getCardBorder = () => {
    return 'border-white/[0.08] hover:border-[#B9EF68]/40';
  };

  return (
    <div className={`app-panel stock-card transition-colors ${getCardBorder()} ${isExpanded ? 'stock-card-expanded' : ''}`}>
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
              {actionOverride ? <div className="-mr-1 -mt-0.5 flex items-center text-zinc-500">{actionOverride}</div> : null}
            </div>
            <div className="stock-summary">
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
        <div className="stock-expanded">

          {/* Expanded Action Toolbar */}
          {!readonlyMode && (
            <div className="grid grid-cols-3 gap-2">
              {onAddPurchaseEntry && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPurchaseEntry(component.id);
                  }}
                  className="app-button app-button-outline flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
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
                  className="app-button flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
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
                  className="app-button app-button-danger flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          )}

          {/* Available inventory batches. */}
          <div>
            {(() => {
              const visibleBatches = getUnassignedBatches(component, state.builds);

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

                    const source = isPartedOutTradeInBatch
                      ? (tradeInOrigin?.buyerName ? `Trade-in: ${tradeInOrigin.buyerName}` : 'Trade-in')
                      : (!hideSupplierNames && entry.platform ? normalizePlatform(String(entry.platform)) : '—');

                    return (
                      <React.Fragment key={entry.id}>
                        <div className="stock-batch-compact">
                          <div className="stock-batch-line stock-batch-line-primary">
                            <strong>{formatReadableDate(entry.date) || entry.date}</strong>
                            <span><em>Supplier</em>{source}</span>
                            <span>{batch.availableQuantity} × {formatCurrency(entryUnitPrice)}</span>
                          </div>
                          <div className="stock-batch-line stock-batch-line-secondary">
                            <span>{entry.condition}</span>
                            <span><em>Payment</em>{isPartedOutTradeInBatch ? 'Trade-in' : (entry.paymentMethod || '—')}{isTradeUpBatch ? ' · Trade-up' : ''}</span>
                            <strong>{formatCurrency(entryTotal)}</strong>
                          </div>
                          <div className="batch-actions">
                            {!readonlyMode && onSellPart && batch.availableQuantity > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSellPart(component, entry.id);
                                }}
                                className="flex min-h-8 items-center gap-1 rounded-lg border border-[#83E5DF]/25 px-2.5 text-xs font-semibold text-[#9FF8F4] transition-colors hover:bg-[#83E5DF]/10 hover:text-white"
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
