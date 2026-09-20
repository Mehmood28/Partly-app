import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface PartSaleExpandedViewProps {
  tx: TransactionLogItem;
  matchedComp?: InventoryComponent;
  matchedTradeInComp?: InventoryComponent;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  profitMarginPercent: number;
  platform?: string;
  paymentMethod?: string;
  buyerName?: string;
  saleDate?: string;
}

export const PartSaleExpandedView: React.FC<PartSaleExpandedViewProps> = ({
  tx, matchedComp, matchedTradeInComp, partsCost, salePrice, netProfit, profitMarginPercent,
  platform, paymentMethod, buyerName, saleDate,
}) => {
  const sourceBatch = tx.originalPurchaseEntrySnapshot ||
    matchedComp?.purchaseHistory.find((entry) => entry.id === tx.relatedPurchaseEntryId);
  const tradeInBatch = matchedTradeInComp?.purchaseHistory.find(
    (entry) => entry.id === tx.incomingPurchaseEntryId,
  );

  return (
  <div className="record-detail sold-part-detail">
    <div className="sold-part-detail-grid">
      <section>
        <h4>Financial details</h4>
        <dl>
          <div><dt>Sale price</dt><dd>{formatCurrency(salePrice)}</dd></div>
          <div><dt>Unit cost</dt><dd>{formatCurrency(partsCost)}</dd></div>
          <div><dt>Net profit</dt><dd className={getProfitTextColor(netProfit)}>{formatSignedCurrency(netProfit)}</dd></div>
          <div><dt>Margin</dt><dd className={getProfitTextColor(netProfit)}>{profitMarginPercent.toFixed(1)}%</dd></div>
        </dl>
      </section>
      <section>
        <h4>Buyer / contact</h4>
        <dl>
          <div><dt>Name</dt><dd>{buyerName || '—'}</dd></div>
          <div><dt>Platform</dt><dd>{platform ? normalizePlatform(platform) : '—'}</dd></div>
          <div><dt>Payment</dt><dd>{paymentMethod || '—'}</dd></div>
          {tx.secondaryPaymentMethod && <div><dt>Secondary</dt><dd>{tx.secondaryPaymentMethod}</dd></div>}
        </dl>
      </section>
      <section>
        <h4>Sale &amp; component</h4>
        <dl>
          <div><dt>Sale date</dt><dd>{String(saleDate || tx.dateSortable || tx.timestamp).split('T')[0]}</dd></div>
          <div><dt>Type</dt><dd>{matchedComp?.category || '—'}</dd></div>
          <div><dt>Details</dt><dd>{matchedComp?.tags?.join(' · ') || '—'}</dd></div>
          <div><dt>Condition</dt><dd>{sourceBatch?.condition || '—'}</dd></div>
          <div><dt>Quantity</dt><dd>{tx.quantity || 1}</dd></div>
        </dl>
      </section>
    </div>
    {!!tx.tradeInCredit && tx.tradeInCredit > 0 && (
      <div className="trade-in-details sold-trade-in">
        <h4>Trade-in included</h4>
        {matchedTradeInComp ? (
          <div className="sold-trade-in-part">
            <strong>{matchedTradeInComp.name}</strong>
            <span>{[
              matchedTradeInComp.category,
              ...(matchedTradeInComp.tags || []),
              tradeInBatch?.condition,
            ].filter(Boolean).join(' · ')}</span>
          </div>
        ) : tx.tradeInDescription ? <p>{tx.tradeInDescription}</p> : null}
        <p>Cash <strong>{formatCurrency(tx.cashPortion ?? 0)}</strong> · Trade value <strong>{formatCurrency(tx.tradeInCredit)}</strong> · Effective sale <strong>{formatCurrency(tx.totalAmount ?? 0)}</strong></p>
        {tx.tradeInNotes && <p>{tx.tradeInNotes}</p>}
      </div>
    )}
    {tx.notes && <p className="record-notes"><strong>Notes</strong> {tx.notes}</p>}
  </div>
  );
};
