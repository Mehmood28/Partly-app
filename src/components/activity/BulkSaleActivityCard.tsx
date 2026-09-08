import React, { useState } from 'react';
import {
  Layers, 
  ChevronUp, 
  ChevronDown, 
  Store, 
  User, 
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
import { 
  formatCurrency, 
  getPlatformBadgeColor, 
  getPaymentMethodBadgeColor 
} from '../../utils/helpers';
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
    <div className="bg-[#0D1118] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl transition-all duration-200 overflow-hidden shadow-sm group flex flex-col">
      {/* Collapsed Header */}
      <div 
        className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors flex items-start gap-3"
        onClick={handleToggle}
      >
        {/* Left Icon */}
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border mt-0.5 bg-indigo-500/15 border-indigo-500/30 text-indigo-400">
          <Layers className="w-4 h-4" />
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Top Title & Status Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="font-semibold text-zinc-100 text-xs sm:text-sm leading-snug break-words">
                Bulk Part Sale
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border shrink-0 leading-none bg-indigo-500/15 text-indigo-300 border-indigo-500/40">
                BULK SALE
              </span>

              <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors ml-1">
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </div>
          </div>

          {/* Summary Pills */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2 font-mono">
            {/* Sale Lines Count */}
            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              LINES: {group.lineCount}
            </span>

            {/* Total Units */}
            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              UNITS: {group.totalUnits}
            </span>

            {/* Total Recorded Cost */}
            <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              COST: {formatCurrency(group.totalCost)}
            </span>

            {/* Total Revenue */}
            <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              SOLD: {formatCurrency(group.totalRevenue)}
            </span>

            {/* Total Profit */}
            <span className={`${
              group.totalProfit > 0
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : group.totalProfit < 0
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                : 'bg-white/[0.04] text-zinc-300 border-white/[0.08]'
            } border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
              PROFIT: {formatSignedProfit(group.totalProfit)} ({group.profitPercentage.toFixed(0)}%)
            </span>

            {/* Bulk Sale Badge */}
            <span className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
              BULK SALE
            </span>

            {/* Platform */}
            {group.platform && (
              <span className={`${getPlatformBadgeColor(group.platform)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                <Store className="w-2.5 h-2.5" /> {normalizePlatform(group.platform)}
              </span>
            )}

            {/* Buyer Name */}
            {group.buyerName && (
              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap">
                <User className="w-2.5 h-2.5" /> {group.buyerName}
              </span>
            )}

            {/* Payment Method */}
            {group.paymentMethod && (
              <span className={`${getPaymentMethodBadgeColor(group.paymentMethod)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                {group.paymentMethod}
              </span>
            )}

            {/* Sale Date */}
            {group.saleDate ? (
              <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                {group.saleDate}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="p-3.5 border-t border-white/[0.08] space-y-3.5 bg-[#121722]">
          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRelistConfirmOpen(true);
              }}
              className="bg-indigo-950/40 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-400/60 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Revenue</div>
              <div className="text-sm sm:text-base font-bold font-mono text-amber-400">{formatCurrency(group.totalRevenue)}</div>
            </div>
            <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Cost</div>
              <div className="text-sm sm:text-base font-bold font-mono text-zinc-300">{formatCurrency(group.totalCost)}</div>
            </div>
            <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Total Profit</div>
              <div className={`text-sm sm:text-base font-bold font-mono ${
                group.totalProfit > 0 ? 'text-emerald-400' : group.totalProfit < 0 ? 'text-rose-400' : 'text-zinc-300'
              }`}>
                {formatSignedProfit(group.totalProfit)}
              </div>
            </div>
            <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Markup</div>
              <div className={`text-sm sm:text-base font-bold font-mono ${getProfitTextColor(group.profitPercentage)}`}>{group.profitPercentage.toFixed(1)}%</div>
            </div>
          </div>

          {/* Buyer / Notes when present */}
          {group.buyerName && (
            <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800/60 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Buyer / Contact:</span>
              <span className="text-amber-400 font-medium">{group.buyerName}</span>
            </div>
          )}
          {group.notes && (
            <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800/60 text-xs text-zinc-400">
              <span className="text-zinc-500 font-medium mr-2">Notes:</span>
              {group.notes}
            </div>
          )}

          {/* Itemized Sale Lines Breakdown */}
          <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/60 space-y-2">
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              Sale Lines ({group.lineCount})
            </div>
            <div className="space-y-1.5">
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
                    className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors"
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
                        <div className="text-amber-400 font-semibold">{formatCurrency(lineRev)}</div>
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
                        className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg border border-transparent hover:border-amber-500/30 transition-colors"
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
