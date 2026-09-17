import React from 'react';
import { 
  Cpu, 
  Tag, 
  ShoppingCart, 
  Hammer, 
  ChevronUp, 
  ChevronDown, 
  User, 
  Store,
  TrendingUp
} from 'lucide-react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { 
  formatCurrency, 
  getCategoryBadgeColor, 
  getPlatformBadgeColor, 
  getPaymentMethodBadgeColor, 
  getConditionColor 
} from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatSignedCurrency, getProfitBadgeClasses } from '../../utils/financialDisplay';

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

export const TransactionCardHeader: React.FC<TransactionCardHeaderProps> = ({
  tx,
  displayTitle,
  subCategoryLabel,
  imageUrl,
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
  return (
    <div 
      className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors flex items-start gap-3"
      onClick={onToggle}
    >
      {/* Left Thumbnail / Icon */}
      {imageUrl ? (
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/[0.08] mt-0.5">
          <img src={imageUrl} alt={displayTitle} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border mt-0.5 ${
          isExchange
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
            : isPCSale 
            ? 'bg-[#A3FF12]/15 border-[#A3FF12]/30 text-[#67E8F9]'
            : isPartSale 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : isPurchase
            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
        }`}>
          {isExchange ? <TrendingUp className="w-4 h-4" /> : isPCSale ? <Cpu className="w-4 h-4" /> : isPartSale ? <Tag className="w-4 h-4" /> : isPurchase ? <ShoppingCart className="w-4 h-4" /> : <Hammer className="w-4 h-4" />}
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 min-w-0">
        {/* Top Title & Status Row (No Truncate, Full Name Display) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="font-semibold text-zinc-100 text-xs sm:text-sm leading-snug break-words">
              {displayTitle}
            </h3>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border shrink-0 leading-none ${
                isExchange
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                  : isPCSale
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : isPartSale
                  ? 'bg-teal-500/15 text-teal-400 border-teal-500/40'
                  : isPurchase
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                  : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40'
              }`}
            >
              {subCategoryLabel}
            </span>

            <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors ml-1">
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* Minimal Summary Pills - Ordered by Type */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2 font-mono">
          {/* Trade Up Pills */}
          {isExchange && (
            <>
              {/* Cost Basis Flow */}
              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                OUTGOING BASIS: {formatCurrency(outgoingCostBasis)}
              </span>
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                CASH PAID ON TOP: {formatCurrency(cashPaidOnTop)}
              </span>
              <span className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                INCOMING BASIS: {formatCurrency(incomingCostBasis)}
              </span>

              {/* Meta */}
              {platform && (
                <span className={`${getPlatformBadgeColor(platform)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                  <Store className="w-2.5 h-2.5" /> {normalizePlatform(platform)}
                </span>
              )}
              {paymentMethod && (
                <span className={`${getPaymentMethodBadgeColor(paymentMethod)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {paymentMethod}
                </span>
              )}
              {/* Date */}
              <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                {tx.dateSortable || tx.timestamp}
              </span>
            </>
          )}

          {/* Sold PC Pills */}
          {isPCSale && (
            <>
              {/* Financials */}
              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                BUILD COST: {formatCurrency(partsCost)}
              </span>
              <span className="bg-[#A3FF12]/15 text-[#67E8F9] border border-[#A3FF12]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                SOLD: {formatCurrency(salePrice)}
              </span>
              <span className={`${getProfitBadgeClasses(netProfit)} border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                PROFIT: {formatSignedCurrency(netProfit)} {profitMarginPercent !== 0 ? `(${profitMarginPercent.toFixed(0)}%)` : ''}
              </span>
              {/* Meta */}
              {platform && (
                <span className={`${getPlatformBadgeColor(platform)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                  <ShoppingCart className="w-2.5 h-2.5" /> {normalizePlatform(platform)}
                </span>
              )}
              {buyerName && (
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap">
                  <User className="w-2.5 h-2.5" /> {buyerName}
                </span>
              )}
              {paymentMethod && (
                <span className={`${getPaymentMethodBadgeColor(paymentMethod)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {paymentMethod}
                </span>
              )}
              {/* Date & Performance */}
              {saleDate && (
                <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  {saleDate}
                </span>
              )}
              {daysOnMarket !== undefined && (
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  {daysOnMarket === 0 ? 'SAME DAY' : `${daysOnMarket}D`}
                </span>
              )}
            </>
          )}

          {/* Part Sale Pills */}
          {isPartSale && (
            <>
              {/* Financials */}
              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                COST: {formatCurrency(partsCost)}
              </span>
              <span className="bg-[#A3FF12]/15 text-[#67E8F9] border border-[#A3FF12]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                SOLD: {formatCurrency(salePrice)}
              </span>
              <span className={`${getProfitBadgeClasses(netProfit)} border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                PROFIT: {formatSignedCurrency(netProfit)} {profitMarginPercent !== 0 ? `(${profitMarginPercent.toFixed(0)}%)` : ''}
              </span>
              {/* Category */}
              {matchedComp?.category && (
                <span className={`${getCategoryBadgeColor(matchedComp.category)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {matchedComp.category}
                </span>
              )}
              {tx.bulkSaleGroupId && (
                <span className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  BULK SALE
                </span>
              )}
              {/* Meta */}
              {platform && (
                <span className={`${getPlatformBadgeColor(platform)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                  <Store className="w-2.5 h-2.5" /> {normalizePlatform(platform)}
                </span>
              )}
              {buyerName && (
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap">
                  <User className="w-2.5 h-2.5" /> {buyerName}
                </span>
              )}
              {paymentMethod && (
                <span className={`${getPaymentMethodBadgeColor(paymentMethod)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {paymentMethod}
                </span>
              )}
              {/* Date */}
              <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                {tx.dateSortable || tx.timestamp}
              </span>
            </>
          )}

          {/* Purchase Pills */}
          {isPurchase && (
            <>
              {/* Financials */}
              <span className="bg-rose-500/15 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                PAID: {formatCurrency(tx.totalAmount)}
              </span>
              {/* Item Details */}
              {matchedComp?.category && (
                <span className={`${getCategoryBadgeColor(matchedComp.category)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {matchedComp.category}
                </span>
              )}
              {isBulkPurchase ? (
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  QTY: {tx.quantity || tx.itemCount || tx.detailsList?.length || 1} UNITS
                </span>
              ) : tx.quantity && tx.quantity > 1 ? (
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  QTY: {tx.quantity}X ({formatCurrency(tx.totalAmount / tx.quantity)}/ea)
                </span>
              ) : null}
              {conditionStr && (
                <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap ${getConditionColor(conditionStr)}`}>
                  {conditionStr.toUpperCase()}
                </span>
              )}
              {/* Meta */}
              {!hideSupplierNames && platform && (
                <span className={`${getPlatformBadgeColor(platform)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center gap-1 justify-center whitespace-nowrap`}>
                  <Store className="w-2.5 h-2.5" /> {normalizePlatform(platform)}
                </span>
              )}
              {paymentMethod && (
                <span className={`${getPaymentMethodBadgeColor(paymentMethod)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                  {paymentMethod}
                </span>
              )}
              {/* Date */}
              <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                {tx.dateSortable || tx.timestamp}
              </span>
            </>
          )}

          {/* Build Allocation Pills */}
          {isBuildAllocation && (
            <>
              {/* Financials */}
              <span className="bg-[#A3FF12]/15 text-[#67E8F9] border border-[#A3FF12]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                BUILD COST: {formatCurrency(tx.totalAmount)}
              </span>
              {/* Item details */}
              {tx.itemCount && (
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  PARTS: {tx.itemCount} ITEMS
                </span>
              )}
              {/* Date */}
              <span className="bg-white/[0.04] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                {tx.dateSortable || tx.timestamp}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
