import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import {
  formatCurrency,
  getConditionDotColor,
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
  const statusTone = isPurchase
    ? 'text-[#62E6E6] border-[#62E6E6]/35'
    : isPCSale || isPartSale
      ? 'text-[#A8FF3E] border-[#A8FF3E]/35'
      : 'text-zinc-300 border-white/[0.12]';
  const railTone = isPurchase ? 'bg-[#62E6E6]' : isPCSale || isPartSale ? 'bg-[#A8FF3E]' : 'bg-zinc-500';

  return (
    <button
      type="button"
      className="relative w-full cursor-pointer px-3.5 py-3.5 pl-4 text-left transition-colors hover:bg-white/[0.022] sm:px-4 sm:pl-5"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span className={`absolute bottom-3 left-0 top-3 w-0.5 rounded-r-full ${railTone}`} />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <h3 className="min-w-0 flex-1 break-words text-[13px] font-bold leading-snug tracking-[-0.02em] text-zinc-100 sm:text-[15px]">
              {displayTitle}
            </h3>
            <span className={`mt-0.5 shrink-0 border-l pl-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${statusTone}`}>
              {subCategoryLabel}
            </span>
            <span className="mt-0.5 shrink-0 text-zinc-500">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>

          <div className="mt-2.5 grid divide-x divide-white/[0.09] rounded-lg border border-white/[0.07] bg-black/[0.12] font-mono" style={{ gridTemplateColumns: isExchange ? 'repeat(3,minmax(0,1fr))' : (isPCSale || isPartSale) ? 'repeat(4,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))' }}>
            {isExchange && (
              <>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">OUTGOING</small><strong className="mt-0.5 block truncate text-[12px] text-zinc-300 sm:text-sm">{formatCurrency(outgoingCostBasis)}</strong></span>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">CASH</small><strong className="mt-0.5 block truncate text-[12px] text-[#62E6E6] sm:text-sm">{formatCurrency(cashPaidOnTop)}</strong></span>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">INCOMING</small><strong className="mt-0.5 block truncate text-[12px] text-zinc-100 sm:text-sm">{formatCurrency(incomingCostBasis)}</strong></span>
              </>
            )}

            {(isPCSale || isPartSale) && (
              <>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">COST</small><strong className="mt-0.5 block truncate text-[12px] text-zinc-300 sm:text-sm">{formatCurrency(partsCost)}</strong></span>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">SOLD</small><strong className="mt-0.5 block truncate text-[12px] text-[#62E6E6] sm:text-sm">{formatCurrency(salePrice)}</strong></span>
                <span className={`min-w-0 p-2 ${getProfitTextColor(netProfit)}`}><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">PROFIT</small><strong className="mt-0.5 block truncate text-[12px] sm:text-sm">{formatSignedCurrency(netProfit)}</strong></span>
                <span className={`min-w-0 p-2 ${getProfitTextColor(profitMarginPercent)}`}><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">MARGIN</small><strong className="mt-0.5 block truncate text-[12px] sm:text-sm">{profitMarginPercent.toFixed(1)}%</strong></span>
              </>
            )}

            {isPurchase && (
              <>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">PAID</small><strong className="mt-0.5 block truncate text-[12px] text-zinc-100 sm:text-sm">{formatCurrency(tx.totalAmount)}</strong></span>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">QUANTITY</small><strong className="mt-0.5 block truncate text-[12px] text-[#62E6E6] sm:text-sm">{(isBulkPurchase || quantity > 1) ? quantity : 1} {quantity === 1 ? 'unit' : 'units'}</strong></span>
              </>
            )}

            {isBuildAllocation && (
              <>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">BUILD COST</small><strong className="mt-0.5 block truncate text-[12px] text-[#62E6E6] sm:text-sm">{formatCurrency(tx.totalAmount)}</strong></span>
                <span className="min-w-0 p-2"><small className="block text-[10px] font-semibold tracking-[.1em] text-zinc-600">ALLOCATED</small><strong className="mt-0.5 block truncate text-[12px] text-zinc-200 sm:text-sm">{tx.itemCount || quantity} items</strong></span>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] leading-snug text-zinc-500 sm:text-[12px]">
            {matchedComp?.category && <span className="font-semibold text-[#9FF8F4]">{matchedComp.category}</span>}
            {conditionStr && (
              <span className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(conditionStr)}`} />
                {conditionStr}
              </span>
            )}
            {!hideSupplierNames && platform && <span>· {normalizePlatform(platform)}</span>}
            {buyerName && <span>· {buyerName}</span>}
            {paymentMethod && <span>· {paymentMethod}</span>}
            {recordedDate && <span>· {recordedDate}</span>}
            {daysOnMarket !== undefined && <span>· {daysOnMarket === 0 ? 'same day' : `${daysOnMarket} days`}</span>}
          </div>
        </div>

      </div>
    </button>
  );
};
