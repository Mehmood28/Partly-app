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
    <div className="bg-[#0F141C] border-b border-white/[0.08] transition-colors overflow-hidden group flex flex-col first:border-t">
      <div 
        className="relative p-3 pl-4 cursor-pointer hover:bg-white/[0.025] transition-colors flex items-start gap-2"
        onClick={handleToggle}
      >
        <span className="absolute bottom-2.5 left-0 top-2.5 w-0.5 bg-[#A3FF12]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Layers className="w-3.5 h-3.5 text-[#A3FF12] shrink-0" />
              <h3 className="font-semibold text-zinc-100 text-xs sm:text-sm leading-snug break-words">
                Bulk Part Sale
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border shrink-0 leading-none text-[#A3FF12] border-[#A3FF12]/30">
                BULK SALE
              </span>

              <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors ml-1">
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap mt-1.5 font-mono text-[10px] sm:text-[11px] text-zinc-500">
            <span>LINES <strong className="font-semibold text-zinc-300">{group.lineCount}</strong></span>
            <span>UNITS <strong className="font-semibold text-zinc-300">{group.totalUnits}</strong></span>
            <span>COST <strong className="font-semibold text-zinc-300">{formatCurrency(group.totalCost)}</strong></span>
            <span>SOLD <strong className="font-semibold text-[#A5F3FC]">{formatCurrency(group.totalRevenue)}</strong></span>
            <span className={getProfitTextColor(group.totalProfit)}>PROFIT <strong className="font-semibold">{formatSignedProfit(group.totalProfit)} ({group.profitMarginPercent.toFixed(1)}%)</strong></span>
          </div>
          <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap mt-1 font-mono text-[10px] text-zinc-500">
            {group.platform && <span>{normalizePlatform(group.platform)}</span>}
            {group.buyerName && <span>· {group.buyerName}</span>}
            {group.paymentMethod && <span>· {group.paymentMethod}</span>}
            {group.saleDate && <span>· {group.saleDate}</span>}
          </div>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="p-3 border-t border-white/[0.08] space-y-3 bg-[#10151E]">
          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRelistConfirmOpen(true);
              }}
              className="bg-[#A3FF12]/10 border border-[#A3FF12]/30 text-[#A3FF12] hover:bg-[#A3FF12]/15 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              title="Relist entire bulk sale back into stock"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Relist Entire Bulk Sale
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteConfirmOpen(true);
              }}
              className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              title="Delete Bulk Part Sale Record"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Bulk Sale Record
            </button>
          </div>

          {/* Aggregate Financial Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.08] border border-white/[0.08] rounded-lg overflow-hidden">
            <div className="p-2.5 bg-[#0D1118]">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Revenue</div>
              <div className="text-sm sm:text-base font-bold font-mono text-[#67E8F9]">{formatCurrency(group.totalRevenue)}</div>
            </div>
            <div className="p-2.5 bg-[#0D1118]">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Cost</div>
              <div className="text-sm sm:text-base font-bold font-mono text-zinc-300">{formatCurrency(group.totalCost)}</div>
            </div>
            <div className="p-2.5 bg-[#0D1118]">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Profit</div>
              <div className={`text-sm sm:text-base font-bold font-mono ${
                group.totalProfit > 0 ? 'text-emerald-400' : group.totalProfit < 0 ? 'text-rose-400' : 'text-zinc-300'
              }`}>
                {formatSignedProfit(group.totalProfit)}
              </div>
            </div>
            <div className="p-2.5 bg-[#0D1118]">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Profit Margin</div>
              <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(group.profitMarginPercent)}`}>{group.profitMarginPercent.toFixed(1)}%</div>
            </div>
          </div>

          {/* Buyer / Notes when present */}
          {group.buyerName && (
            <div className="border-y border-white/[0.08] px-1 py-2.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Buyer / Contact:</span>
              <span className="text-[#A5F3FC] font-medium">{group.buyerName}</span>
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
            <div className="border-b border-white/[0.08] px-2.5 py-2 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
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
                        <div className="text-[#67E8F9] font-semibold">{formatCurrency(lineRev)}</div>
                        <div className={`text-[10px] ${
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
                        className="p-1.5 text-zinc-400 hover:text-[#67E8F9] hover:bg-[#67E8F9]/10 rounded-lg border border-transparent hover:border-[#67E8F9]/30 transition-colors"
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
