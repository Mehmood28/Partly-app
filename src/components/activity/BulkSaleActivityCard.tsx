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
  toFiniteNumber
} from '../../utils/bulkSaleGrouping';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';
import { TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { ConfirmModal } from '../ConfirmModal';

export interface BulkSaleActivityCardProps {
  isActive?: boolean;
  group: BulkPartSaleGroupDisplayItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  onEditLine: (tx: TransactionLogItem) => void;
  onDeleteGroup: (bulkSaleGroupId: string) => void;
  onRelistGroup: (bulkSaleGroupId: string) => void;
}

export const BulkSaleActivityCard: React.FC<BulkSaleActivityCardProps> = React.memo(({
  isActive = true,
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
    <div className="app-panel transaction-card bulk-sale-card group flex flex-col transition-colors">
      <button type="button" className="record-header bulk-sale-header" onClick={handleToggle} aria-expanded={isExpanded}>
        <div className="sold-part-title-row"><h3>Bulk Part Sale</h3><time>{group.saleDate}</time>{isExpanded ? <ChevronUp /> : <ChevronDown />}</div>
        <div className="sold-part-status-row"><Layers /><strong>Bulk sale</strong><span>{group.lineCount} lines · {group.totalUnits} units</span></div>
        <dl className="record-finances">
          <div><dt>Cost</dt><dd>{formatCurrency(group.totalCost)}</dd></div>
          <div><dt>Sold</dt><dd>{formatCurrency(group.totalRevenue)}</dd></div>
          <div><dt>Profit</dt><dd className={getProfitTextColor(group.totalProfit)}>{formatSignedCurrency(group.totalProfit)}</dd></div>
          <div><dt>Margin</dt><dd className={getProfitTextColor(group.totalProfit)}>{group.profitMarginPercent.toFixed(1)}%</dd></div>
        </dl>
        <div className="sold-part-contact-row">
          {group.buyerName && <span><em>Buyer</em>{group.buyerName}</span>}
          {group.platform && <span><em>Platform</em>{normalizePlatform(group.platform)}</span>}
          {group.paymentMethod && <span><em>Payment</em>{group.paymentMethod}</span>}
        </div>
      </button>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="record-expanded record-detail space-y-4">
          {/* Action Buttons Row */}
          <div className="record-actions bulk-sale-actions">
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
          <div className="bulk-sale-lines">
            <div className="bulk-sale-lines-title">Sale lines <span>· {group.lineCount}</span></div>
            <div className="bulk-sale-line-head">
              <span>Part / details</span><span>Qty</span><span>Sold</span><span>Profit</span><span aria-hidden="true" />
            </div>
            <div>
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
                  <div key={tx.id} className="bulk-sale-line">
                    <div className="bulk-sale-line-part">
                      <strong>{partName}</strong>
                      <span>@ {formatCurrency(unitCost)}{qty > 1 ? '/ea' : ''} · Cost {formatCurrency(lineCost)}</span>
                    </div>
                    <span>{qty}</span>
                    <strong className="bulk-sale-line-revenue">{formatCurrency(lineRev)}</strong>
                    <strong className={getProfitTextColor(lineProfit)}>{formatSignedCurrency(lineProfit)}</strong>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditLine(tx);
                        }}
                        className="bulk-sale-line-edit"
                        title="Edit this sale line"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Relist Entire Bulk Sale Confirmation Modal */}
      <ConfirmModal
        isOpen={isRelistConfirmOpen && isActive}
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
        isOpen={isDeleteConfirmOpen && isActive}
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
