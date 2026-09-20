import React, { useState } from 'react';
import {
  Layers, 
  ChevronUp, 
  ChevronDown, 
  Pencil, 
  Trash2, 
  RotateCcw 
} from 'lucide-react';
import { 
  BulkPartSaleGroupDisplayItem, 
  getTransactionRecordedCost,
  getSafeDisplayQuantity,
  formatSignedProfit,
  toFiniteNumber
} from '../../utils/bulkSaleGrouping';
import { getProfitTextColor } from '../../utils/financialDisplay';
import { TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { ConfirmModal } from '../ConfirmModal';

export interface BulkSaleActivityCardProps {
  group: BulkPartSaleGroupDisplayItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  onEditLine: (tx: TransactionLogItem) => void;
  onDeleteGroup: (bulkSaleGroupId: string) => void;
  onRelistGroup: (bulkSaleGroupId: string) => void;
}

export const BulkSaleActivityCard: React.FC<BulkSaleActivityCardProps> = React.memo(({
  group,
  isExpanded: propIsExpanded,
  onToggle,
  onEditLine,
  onDeleteGroup,
  onRelistGroup,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isRelistConfirmOpen, setIsRelistConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalExpanded(!internalExpanded);
  };

  return (
    <div className="app-panel group flex flex-col transition-colors">
      <button type="button" className="record-header" onClick={handleToggle} aria-expanded={isExpanded}>
        <div className="record-topline"><Layers className="h-4 w-4" /><span>Bulk sale</span><time>{group.saleDate}</time>{isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
        <h3>Bulk Part Sale</h3>
        <dl className="record-finances">
          <div><dt>Cost</dt><dd>{formatCurrency(group.totalCost)}</dd></div>
          <div><dt>Sold</dt><dd>{formatCurrency(group.totalRevenue)}</dd></div>
          <div><dt>Profit</dt><dd className={getProfitTextColor(group.totalProfit)}>{formatSignedProfit(group.totalProfit)}</dd></div>
          <div><dt>Margin</dt><dd className={getProfitTextColor(group.totalProfit)}>{group.profitMarginPercent.toFixed(1)}%</dd></div>
        </dl>
        <div className="record-metadata"><span>{group.lineCount} lines · {group.totalUnits} units</span>{group.buyerName && <span>{group.buyerName}</span>}{group.platform && <span>{normalizePlatform(group.platform)}</span>}{group.paymentMethod && <span>{group.paymentMethod}</span>}</div>
      </button>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="record-expanded record-detail space-y-4">
          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRelistConfirmOpen(true);
              }}
              className="app-button flex items-center gap-1.5 px-3 text-[#B9EF68]"
              title="Relist entire bulk sale back into stock"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Relist Entire Bulk Sale
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteConfirmOpen(true);
              }}
              className="app-button app-button-danger flex items-center gap-1.5 px-3"
              title="Delete Bulk Part Sale Record"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Bulk Sale Record
            </button>
          </div>

          {/* Buyer / Notes when present */}
          {group.buyerName && (
            <div className="border-y border-white/[0.08] px-1 py-2.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Buyer / Contact:</span>
              <span className="text-[#9FF8F4] font-medium">{group.buyerName}</span>
            </div>
          )}
          {group.notes && (
            <div className="border-y border-white/[0.08] px-1 py-2.5 text-xs text-zinc-400">
              <span className="text-zinc-500 font-medium mr-2">Notes:</span>
              {group.notes}
            </div>
          )}

          {/* Itemized Sale Lines Breakdown */}
          <div className="overflow-hidden rounded-lg border-x border-y border-white/[0.08]">
            <div className="border-b border-white/[0.08] px-2.5 py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
              Sale Lines ({group.lineCount})
            </div>
            <div className="divide-y divide-white/[0.06]">
              {group.transactions.map((tx) => {
                const qty = getSafeDisplayQuantity(tx);
                const lineCost = getTransactionRecordedCost(tx);
                const unitCost = (tx.soldUnitCost !== undefined && tx.soldUnitCost !== null && !isNaN(Number(tx.soldUnitCost)))
                  ? Number(tx.soldUnitCost)
                  : (qty > 0 ? lineCost / qty : 0);
                const lineRev = toFiniteNumber(tx.totalAmount, 0);
                const lineProfit = tx.profitMargin !== undefined ? toFiniteNumber(tx.profitMargin, 0) : 0;
                const partName = tx.itemNameOrSummary
                  ? String(tx.itemNameOrSummary)
                  : (tx.title ? String(tx.title).replace(/^(Sold \(Part\)|Part Sold):\s*/i, '') : 'Part');

                return (
                  <div
                    key={tx.id}
                    className="px-2.5 py-2.5 flex items-center justify-between gap-2 text-xs transition-colors hover:bg-white/[0.025]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-100 break-words">{partName}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-300 font-semibold">{qty}x</span>
                        <span>@ {formatCurrency(unitCost)}/ea</span>
                        <span className="text-zinc-500">|</span>
                        <span>Cost: <span className="text-zinc-300">{formatCurrency(lineCost)}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono">
                      <div className="text-right">
                        <div className="text-[#83E5DF] font-semibold">{formatCurrency(lineRev)}</div>
                        <div className={`text-[11px] ${
                          lineProfit > 0 ? 'text-emerald-400' : lineProfit < 0 ? 'text-rose-400' : 'text-zinc-400'
                        }`}>
                          {formatSignedProfit(lineProfit)}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditLine(tx);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-[#83E5DF] hover:bg-[#83E5DF]/10 rounded-lg border border-transparent hover:border-[#83E5DF]/30 transition-colors"
                        title="Edit this sale line"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Relist Entire Bulk Sale Confirmation Modal */}
      <ConfirmModal
        isOpen={isRelistConfirmOpen}
        title="Relist Entire Bulk Sale"
        message="Relist all parts from this bulk sale back into stock?"
        confirmText="Relist Entire Bulk Sale"
        cancelText="Cancel"
        variant="emerald"
        onConfirm={() => {
          onRelistGroup(group.bulkSaleGroupId);
          setIsRelistConfirmOpen(false);
        }}
        onCancel={() => setIsRelistConfirmOpen(false)}
      />

      {/* Delete Bulk Sale Group Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Delete Bulk Part Sale Record"
        message="This removes the entire bulk-sale activity record and does not return sold stock. Use Relist Entire Bulk Sale to return stock."
        confirmText="Delete Bulk Sale Record"
        variant="danger"
        onConfirm={() => {
          onDeleteGroup(group.bulkSaleGroupId);
          setIsDeleteConfirmOpen(false);
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
});
