import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface PartSaleExpandedViewProps {
  tx?: TransactionLogItem;
  matchedComp?: InventoryComponent;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  profitMarginPercent: number;
}

export const PartSaleExpandedView: React.FC<PartSaleExpandedViewProps> = ({
  tx, matchedComp, partsCost, salePrice, netProfit, profitMarginPercent,
}) => (
  <div className="record-detail">
    <div className="sale-detail-columns">
      <section>
        <h4>Financial details</h4>
        <dl className="detail-list">
          <div><dt>Sale price</dt><dd>{formatCurrency(salePrice)}</dd></div>
          <div><dt>Cost</dt><dd>{formatCurrency(partsCost)}</dd></div>
          <div><dt>Net profit</dt><dd className={getProfitTextColor(netProfit)}>{formatSignedCurrency(netProfit)}</dd></div>
          <div><dt>Margin</dt><dd className={getProfitTextColor(netProfit)}>{profitMarginPercent.toFixed(1)}%</dd></div>
        </dl>
      </section>
      <section>
        <h4>Buyer &amp; payment</h4>
        <dl className="detail-list">
          {tx?.buyerName && <div><dt>Buyer</dt><dd>{tx.buyerName}</dd></div>}
          {tx?.platform && <div><dt>Platform</dt><dd>{normalizePlatform(tx.platform)}</dd></div>}
          {tx?.paymentMethod && <div><dt>Payment</dt><dd>{tx.paymentMethod}</dd></div>}
          {tx?.secondaryPaymentMethod && <div><dt>Secondary</dt><dd>{tx.secondaryPaymentMethod}</dd></div>}
          <div><dt>Sold</dt><dd>{tx?.dateSortable || tx?.timestamp || 'Not recorded'}</dd></div>
        </dl>
      </section>
      {matchedComp && <section>
        <h4>Component details</h4>
        <p className="mb-3 text-zinc-100">{matchedComp.name}</p>
        <dl className="detail-list">
          <div><dt>Category</dt><dd>{matchedComp.category}</dd></div>
          {!!matchedComp.tags?.length && <div><dt>Tags</dt><dd>{matchedComp.tags.join(' · ')}</dd></div>}
          {tx?.originalPurchaseEntrySnapshot?.condition && <div><dt>Condition</dt><dd>{tx.originalPurchaseEntrySnapshot.condition}</dd></div>}
          {tx?.quantity && <div><dt>Quantity</dt><dd>{tx.quantity}</dd></div>}
        </dl>
      </section>}
    </div>
    {!!tx?.tradeInCredit && tx.tradeInCredit > 0 && <section className="trade-in-details">
      <h4>Trade-in included</h4>
      {tx.tradeInDescription && <p>{tx.tradeInDescription}</p>}
      <p>Cash <strong>{formatCurrency(tx.cashPortion ?? 0)}</strong> · Trade value <strong>{formatCurrency(tx.tradeInCredit)}</strong> · Effective sale <strong>{formatCurrency(salePrice)}</strong></p>
      {tx.tradeInNotes && <p>{tx.tradeInNotes}</p>}
    </section>}
    {tx?.notes && <p className="record-notes"><strong>Notes</strong> {tx.notes}</p>}
  </div>
);
