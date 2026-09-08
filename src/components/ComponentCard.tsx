import React, { useState } from 'react';
import { InventoryComponent, PurchaseEntry } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { useToast } from '../context/ToastContext';
import {
  calculateAverageUnitCost,
  calculateTotalQuantity,
  calculateTotalValue,
  calculateUnassignedQuantityStrict,
  calculateUnassignedValueStrict,
  formatCompactCurrency,
  formatCurrency, getConditionColor,
  getCategoryBadgeColor,
  getTagBadgeColor,
  getPlatformBadgeColor,
  getPaymentMethodBadgeColor,
  getUnassignedBatches,
} from '../utils/helpers';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Box,
  LayoutGrid,
  Pencil,
  Trash2,
  X,
  ArrowUp,
  Monitor,
  Cpu,
  HardDrive,
  Database,
  CircuitBoard,
  Zap,
  Fan,
  Package,
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
  onQuickAssign?: (component: InventoryComponent) => void;
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
  onQuickAssign,
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

  const totalQty = calculateTotalQuantity(component);
  const unassignedQty = unassignedQuantityOverride !== undefined ? unassignedQuantityOverride : calculateUnassignedQuantityStrict(component, state.builds);
  const unassignedVal = calculateUnassignedValueStrict(component, state.builds);
  const avgCost = unassignedQty > 0 ? unassignedVal / unassignedQty : calculateAverageUnitCost(component);
  const assigned = component.assignedCount || 0;

  const renderCategoryIcon = () => {
    const className = 'w-4 h-4 text-[#7C6CF2]';
    switch (component.category) {
      case 'GPU': return <Monitor className={className} />;
      case 'CPU': return <Cpu className={className} />;
      case 'RAM': return <HardDrive className={className} />;
      case 'Storage': return <Database className={className} />;
      case 'Motherboard': return <CircuitBoard className={className} />;
      case 'PSU': return <Zap className={className} />;
      case 'Case': return <Box className={className} />;
      case 'Cooling':
      case 'Fans': return <Fan className={className} />;
      default: return <Package className={className} />;
    }
  };

  const getCardBorder = () => {
    return 'border-white/[0.08] hover:border-[#7C6CF2]/40 shadow-sm';
  };

  return (
    <div className={`bg-[#0D1118] border rounded-xl overflow-hidden transition-all duration-200 ${getCardBorder()}`} style={{ contain: 'content', willChange: 'transform' }}>
      {/* Collapsed Header Bar - Clickable for mobile */}
      <div 
        className="p-3 flex flex-col gap-2 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Left Square Icon Box */}
            <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center shrink-0 mt-0.5">
              {renderCategoryIcon()}
            </div>
            {/* Title & Subtitle Info */}
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 tracking-tight">
                {String(component.name || "")}
              </h3>
              <div className="font-mono text-zinc-400 mt-1.5 flex flex-row items-center gap-1.5 flex-wrap tracking-tight">
                {component.tags && component.tags.length > 0 && (
                  <>
                    {component.tags.map((tag, idx) => (
                      <span key={idx} className={`${getTagBadgeColor(tag)} px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                        {tag}
                      </span>
                    ))}
                  </>
                )}
                {unassignedQty === 1 ? (
                  <>
                    <span className="bg-white/[0.06] border border-white/[0.1] text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                      Qty: 1
                    </span>
                    <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                      {formatCurrency(unassignedVal)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="bg-white/[0.06] border border-white/[0.1] text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                      Qty: {unassignedQty}
                    </span>
                    <span className="bg-white/[0.06] text-zinc-300 border border-white/[0.1] whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                      {formatCurrency(avgCost)}/ea
                    </span>
                    {unassignedVal > 0 && (
                      <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                        {formatCurrency(unassignedVal)} total
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons Container */}
          <div className="flex items-center gap-1.5 shrink-0">
            {actionOverride ? actionOverride : null}
            <div className="text-zinc-500 ml-0.5">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                PURCHASE HISTORY
              </span>
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
                <div className="space-y-1.5">
                  {visibleBatches.map((batch) => {
                    const entry = batch.entry;
                    const entryUnitPrice = batch.unitCost;
                    const entryTotal = entryUnitPrice * batch.availableQuantity;
                    
                    const conditionColor = getConditionColor(entry.condition || "");
                    const isTradeUpBatch = state.transactions.some(
                      (tx) =>
                        tx.type === 'EXCHANGE' &&
                        (tx.incomingComponentId === component.id || tx.incomingComponentId === (entry as any)._originalComponentId) &&
                        tx.incomingPurchaseEntryId === entry.id
                    );

                    return (
                      <div
                        key={entry.id}
                        className="bg-[#0D1118] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl p-2.5 flex items-start sm:items-center justify-between gap-2.5 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap flex-1">
                          <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            {entry.date}
                          </span>
                          <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap ${conditionColor}`}>
                            {entry.condition.toUpperCase()}
                          </span>
                          {isTradeUpBatch && (
                            <span className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                              TRADE UP
                            </span>
                          )}
                          <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            {batch.availableQuantity}x @ {formatCurrency(entryUnitPrice)}
                          </span>
                          <span className="bg-white/[0.06] text-zinc-200 border border-white/[0.1] shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                            Total: {formatCurrency(entryTotal)}
                          </span>
                          {!hideSupplierNames && entry.platform && (
                            <span className={`${getPlatformBadgeColor(entry.platform)} shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                              {String(entry.platform)}
                            </span>
                          )}
                          {entry.paymentMethod && (
                            <span className={`${getPaymentMethodBadgeColor(entry.paymentMethod)} shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                              {String(entry.paymentMethod)}
                            </span>
                          )}
                          {(entry.taxPercent ?? 0) > 0 && (
                            <span className="text-rose-400 text-[10px] pl-1.5 border-l border-white/[0.08] shrink-0 font-mono font-medium">
                              +Tax
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                          {!readonlyMode && onSellPart && batch.availableQuantity > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSellPart(component, entry.id);
                              }}
                              className="border border-[#7C6CF2]/40 bg-[#7C6CF2]/15 text-[#9D91FA] hover:bg-[#7C6CF2]/25 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
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
                              className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 p-1.5 rounded-lg transition-colors"
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
