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
    ? 'text-[#67E8F9] border-[#67E8F9]/30'
    : isPCSale || isPartSale
      ? 'text-[#A3FF12] border-[#A3FF12]/30'
      : 'text-zinc-300 border-white/[0.12]';
  const railTone = isPurchase ? 'bg-[#67E8F9]' : isPCSale || isPartSale ? 'bg-[#A3FF12]' : 'bg-zinc-500';

  return (
    <button
      type="button"
      className="relative w-full cursor-pointer px-3 py-2.5 pl-4 text-left transition-colors hover:bg-white/[0.025]"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span className={`absolute bottom-2.5 left-0 top-2.5 w-0.5 ${railTone}`} />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 break-words text-xs font-semibold leading-snug text-zinc-100 sm:text-sm">
              {displayTitle}
            </h3>
            <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${statusTone}`}>
              {subCategoryLabel}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10px] leading-snug text-zinc-500 sm:text-[11px]">
            {isExchange && (
              <>
                <span>OUTGOING <strong className="font-semibold text-zinc-300">{formatCurrency(outgoingCostBasis)}</strong></span>
                <span>CASH <strong className="font-semibold text-[#A5F3FC]">{formatCurrency(cashPaidOnTop)}</strong></span>
                <span>INCOMING <strong className="font-semibold text-zinc-100">{formatCurrency(incomingCostBasis)}</strong></span>
              </>
            )}

            {(isPCSale || isPartSale) && (
              <>
                <span>COST <strong className="font-semibold text-zinc-300">{formatCurrency(partsCost)}</strong></span>
                <span>SOLD <strong className="font-semibold text-[#A5F3FC]">{formatCurrency(salePrice)}</strong></span>
                <span className={getProfitTextColor(netProfit)}>
                  PROFIT <strong className="font-semibold">{formatSignedCurrency(netProfit)} ({profitMarginPercent.toFixed(1)}%)</strong>
                </span>
              </>
            )}

            {isPurchase && (
              <>
                <span>PAID <strong className="font-semibold text-zinc-100">{formatCurrency(tx.totalAmount)}</strong></span>
                {(isBulkPurchase || quantity > 1) && <span>QTY <strong className="font-semibold text-zinc-300">{quantity}</strong></span>}
              </>
            )}

            {isBuildAllocation && (
              <>
                <span>BUILD COST <strong className="font-semibold text-[#A5F3FC]">{formatCurrency(tx.totalAmount)}</strong></span>
                {tx.itemCount ? <span>{tx.itemCount} ITEMS</span> : null}
              </>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] leading-snug text-zinc-500">
            {matchedComp?.category && <span className="font-semibold text-[#A5F3FC]">{matchedComp.category}</span>}
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

        <span className="mt-0.5 shrink-0 text-zinc-500">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </div>
    </button>
  );
};
