import React from 'react';
import { PCBuild, TransactionLogItem } from '../../types';
import { Calendar, Clock, RefreshCw } from 'lucide-react';
import { formatCurrency, formatReadableDate } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatWarrantyLabel, getBuildWarrantyInfo } from '../../utils/warranty';
import { formatPhoneForDisplay } from '../../utils/phoneDisplay';

interface SoldBuildTransactionPanelProps {
  build: PCBuild;
  transaction?: TransactionLogItem | null;
}

export const SoldBuildTransactionPanel: React.FC<SoldBuildTransactionPanelProps> = ({
  build,
  transaction,
}) => {
  const salePrice = transaction?.totalAmount ?? build.salePrice ?? 0;
  const platform = normalizePlatform(transaction?.platform || build.platformSoldOn);
  const paymentMethod = transaction?.paymentMethod || build.paymentMethod;
  const buyerName = transaction?.buyerName || build.buyerName;
  const saleDate = transaction?.dateSortable || transaction?.timestamp || build.saleDate;
  const buyerPhone = build.buyerPhone;
  const builtDate = build.builtDate || build.createdDate;
  const daysOnMarket = build.daysOnMarket;
  const displaySaleDate = formatReadableDate(saleDate) || saleDate || 'Not recorded';
  const displayBuiltDate = formatReadableDate(builtDate) || builtDate;

  // Trade-in details
  const hasTradeIn = (transaction?.tradeInCredit !== undefined && transaction.tradeInCredit > 0);
  const tradeInCredit = transaction?.tradeInCredit ?? 0;
  const cashPortion = transaction?.cashPortion ?? (hasTradeIn ? Math.max(0, salePrice - tradeInCredit) : salePrice);
  const tradeInBuildName = hasTradeIn ? (transaction?.tradeInBuildName || 'Traded Rig') : undefined;

  // Warranty calculation (30-day parts and labour guarantee from saleDate)
  const warrantyDays = transaction?.warrantyDaysAtSale ?? build.warrantyDays ?? 30;
  const warrantyInfo = React.useMemo(() => getBuildWarrantyInfo(saleDate, new Date(), warrantyDays), [saleDate, warrantyDays]);

  return (
    <div className="sold-build-details">
      {/* 2. Trade-in Breakdown Banner (if present) */}
      {hasTradeIn && (
        <div className="sold-build-trade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#9FF8F4] border border-[#83E5DF]/30 px-1.5 py-0.5 text-[11px] font-bold font-mono uppercase tracking-wider">
              Trade-In Included
            </span>
            <span className="text-zinc-300 text-xs">
              Cash: <span className="font-mono font-semibold text-zinc-100">{formatCurrency(cashPortion)}</span> + Trade Value: <span className="font-mono font-semibold text-[#9FF8F4]">{formatCurrency(tradeInCredit)}</span>
              {tradeInBuildName && <span className="text-zinc-400 ml-1">({tradeInBuildName})</span>}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Total Effective: <span className="text-[#83E5DF] font-semibold">{formatCurrency(salePrice)}</span>
          </div>
        </div>
      )}

      {/* Sale details use the same compact label/value language as sold-part records. */}
      <div className="sold-build-info">
        <div className="sold-build-contact-lines">
          <div><span>Name:</span> <strong>{buyerName || 'Not recorded'}</strong></div>
          <div><span>Payment:</span> <strong>{paymentMethod || 'Not recorded'}</strong></div>
          <div><span>Phone:</span> <strong>{buyerPhone ? formatPhoneForDisplay(buyerPhone) : 'Not recorded'}</strong></div>
          <div><span>Platform:</span> <strong>{platform || 'Not recorded'}</strong></div>
        </div>
        <div className="sold-build-timeline">
          <span className="inline-flex items-center gap-1 text-zinc-300"><Calendar className="w-3.5 h-3.5 text-zinc-400" /> Sold {displaySaleDate}</span>
          {displayBuiltDate && <span className="inline-flex items-center gap-1 text-[#9FF8F4]"><Clock className="w-3.5 h-3.5 text-[#83E5DF]" /> Built {displayBuiltDate}</span>}
          {daysOnMarket !== undefined && <span className="inline-flex items-center gap-1 text-emerald-300"><RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> {daysOnMarket === 0 ? 'Sold same day' : `Sold in ${daysOnMarket} ${daysOnMarket === 1 ? 'day' : 'days'}`}</span>}
          {warrantyInfo && (
            <span className={warrantyInfo.isActive ? 'text-emerald-300' : 'text-rose-300'}>
              Warranty: {formatWarrantyLabel(warrantyDays)} · {warrantyInfo.isActive ? `${warrantyInfo.daysLeft} days remaining` : `Expired ${warrantyInfo.expiryFormatted}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
