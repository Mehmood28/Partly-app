import React from 'react';
import { ChevronDown, ChevronUp, Receipt, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import {
  formatCurrency,
} from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface TransactionCardHeaderProps {
  tx: TransactionLogItem;
  displayTitle: string;
  subCategoryLabel: string;
  imageUrl?: string;
  isPCSale: boolean;
  isPartSale: boolean;
  isPurchase: boolean;
  isBuildAllocation: boolean;
  isBulkPurchase: boolean;
  isPCPurchase?: boolean;
  isExchange?: boolean;
  outgoingCostBasis?: number;
  cashPaidOnTop?: number;
  incomingCostBasis?: number;
  isExpanded: boolean;
  onToggle: () => void;
  partsCost: number;
  salePrice: number;
  netProfit: number;
  profitMarginPercent: number;
  platform?: string;
  paymentMethod?: string;
  buyerName?: string;
  saleDate?: string;
  daysOnMarket?: number;
  matchedComp?: InventoryComponent;
  conditionStr?: string;
}

/**
 * Dense transaction ledger row. Financials and useful metadata stay visible
 * without turning every value into a separate coloured badge.
 */
export const TransactionCardHeader: React.FC<TransactionCardHeaderProps> = ({
  tx,
  displayTitle,
  subCategoryLabel,
  isPCSale,
  isPartSale,
  isPurchase,
  isBuildAllocation,
  isBulkPurchase,
  isPCPurchase = false,
  isExchange = false,
  outgoingCostBasis = 0,
  cashPaidOnTop = 0,
  incomingCostBasis = 0,
  isExpanded,
  onToggle,
  partsCost,
  salePrice,
  netProfit,
  profitMarginPercent,
  platform,
  paymentMethod,
  buyerName,
  saleDate,
  daysOnMarket,
  matchedComp,
  conditionStr,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const recordedDate = saleDate || tx.dateSortable || tx.timestamp;
  const quantity = tx.quantity || tx.itemCount || tx.detailsList?.length || 1;
  const isSale = isPCSale || isPartSale;
  const StatusIcon = isSale ? CheckCircle2 : isExchange ? ArrowRightLeft : Receipt;
  const fields = [
    { label: 'Category', value: isBulkPurchase ? 'Bulk' : isPCPurchase ? 'PC' : (matchedComp?.category || '—') },
    { label: 'Condition', value: conditionStr || '—' },
    { label: 'Supplier', value: !hideSupplierNames && platform ? normalizePlatform(platform) : '—' },
    { label: 'Payment', value: paymentMethod || '—' },
  ];

  if (isPartSale) {
    const condition = conditionStr || tx.originalPurchaseEntrySnapshot?.condition ||
      matchedComp?.purchaseHistory.find((entry) => entry.id === tx.relatedPurchaseEntryId)?.condition;
    return (
      <button type="button" className="record-header sold-part-header" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="sold-part-title-row">
          <h3>{displayTitle}</h3>
          <time>{String(recordedDate || '').split('T')[0]}</time>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </div>
        <div className="sold-part-status-row">
          <CheckCircle2 />
          <strong>{subCategoryLabel}</strong>
          {matchedComp?.category && <span>{matchedComp.category}</span>}
          {condition && <span>{condition}</span>}
          {!!tx.tradeInCredit && tx.tradeInCredit > 0 && <em>Trade-in included</em>}
        </div>
        <dl className="record-finances">
          <div><dt>Cost</dt><dd>{formatCurrency(partsCost)}</dd></div>
          <div><dt>Sold</dt><dd>{formatCurrency(salePrice)}</dd></div>
          <div><dt>Profit</dt><dd className={getProfitTextColor(netProfit)}>{formatSignedCurrency(netProfit)}</dd></div>
          <div><dt>Margin</dt><dd className={getProfitTextColor(netProfit)}>{profitMarginPercent.toFixed(1)}%</dd></div>
        </dl>
        <div className="sold-part-contact-row">
          {buyerName && <span><em>Buyer</em>{buyerName}</span>}
          {platform && <span><em>Platform</em>{normalizePlatform(platform)}</span>}
          {paymentMethod && <span><em>Payment</em>{paymentMethod}</span>}
        </div>
      </button>
    );
  }

  return (
    <button type="button" className="record-header" onClick={onToggle} aria-expanded={isExpanded}>
      <div className="record-topline"><StatusIcon className="h-4 w-4" /><span>{subCategoryLabel}</span><time>{String(recordedDate || '').split('T')[0]}</time>{isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
      <h3>{displayTitle}</h3>
      {isPurchase ? (
        <dl className="record-purchase-fields">{fields.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}<div className="record-paid"><dt>Paid</dt><dd>{formatCurrency(tx.totalAmount)}</dd></div></dl>
      ) : (
        <>
          <dl className="record-finances" style={!isSale ? {gridTemplateColumns:`repeat(${isExchange ? 3 : 2},minmax(0,1fr))`} : undefined}>
            {isSale && <><div><dt>Cost</dt><dd>{formatCurrency(partsCost)}</dd></div><div><dt>Sold</dt><dd>{formatCurrency(salePrice)}</dd></div><div><dt>Profit</dt><dd className={getProfitTextColor(netProfit)}>{formatSignedCurrency(netProfit)}</dd></div><div><dt>Margin</dt><dd className={getProfitTextColor(netProfit)}>{profitMarginPercent.toFixed(1)}%</dd></div></>}
            {isExchange && <><div><dt>Outgoing</dt><dd>{formatCurrency(outgoingCostBasis)}</dd></div><div><dt>Cash</dt><dd>{formatCurrency(cashPaidOnTop)}</dd></div><div><dt>Incoming</dt><dd>{formatCurrency(incomingCostBasis)}</dd></div></>}
            {isBuildAllocation && <><div><dt>Build Cost</dt><dd>{formatCurrency(tx.totalAmount)}</dd></div><div><dt>Allocated</dt><dd>{tx.itemCount || quantity} items</dd></div></>}
          </dl>
          <div className="record-metadata">{matchedComp?.category && <span>{matchedComp.category}</span>}{matchedComp?.tags?.map((tag) => <span key={tag}>{tag}</span>)}{conditionStr && <span>{conditionStr}</span>}{buyerName && <span>{buyerName}</span>}{platform && <span>{normalizePlatform(platform)}</span>}{paymentMethod && <span>{paymentMethod}</span>}{daysOnMarket !== undefined && <span>{daysOnMarket === 0 ? 'Sold same day' : `Sold in ${daysOnMarket} days`}</span>}</div>
        </>
      )}
    </button>
  );
};
