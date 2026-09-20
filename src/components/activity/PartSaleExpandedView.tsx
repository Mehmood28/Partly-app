import React from 'react';
import { TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

interface PartSaleExpandedViewProps {
  tx?: TransactionLogItem;
}

// Core sale information stays on the compact card header. Expansion only adds
// data that is not already visible there, keeping a sold-part record scannable.
export const PartSaleExpandedView: React.FC<PartSaleExpandedViewProps> = ({ tx }) => {
  const hasExtraDetails = Boolean(
    tx?.secondaryPaymentMethod ||
    (tx?.quantity && tx.quantity > 1) ||
    tx?.tradeInCredit ||
    tx?.notes,
  );

  if (!hasExtraDetails) return null;

  return (
    <div className="record-detail sale-compact-extra">
      {(tx?.secondaryPaymentMethod || (tx?.quantity && tx.quantity > 1)) && (
        <dl className="sale-extra-grid">
          {tx?.secondaryPaymentMethod && <div><dt>Secondary payment</dt><dd>{tx.secondaryPaymentMethod}</dd></div>}
          {tx?.quantity && tx.quantity > 1 && <div><dt>Quantity sold</dt><dd>{tx.quantity}</dd></div>}
        </dl>
      )}
      {!!tx?.tradeInCredit && tx.tradeInCredit > 0 && (
        <div className="trade-in-details">
          {tx.tradeInDescription && <p>{tx.tradeInDescription}</p>}
          <p>Cash <strong>{formatCurrency(tx.cashPortion ?? 0)}</strong> · Trade value <strong>{formatCurrency(tx.tradeInCredit)}</strong> · Effective sale <strong>{formatCurrency(tx.totalAmount ?? 0)}</strong></p>
          {tx.tradeInNotes && <p>{tx.tradeInNotes}</p>}
        </div>
      )}
      {tx?.notes && <p className="record-notes"><strong>Notes</strong> {tx.notes}</p>}
    </div>
  );
};
