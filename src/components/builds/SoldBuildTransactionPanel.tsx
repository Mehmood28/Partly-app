import React from 'react';
import { PCBuild, TransactionLogItem } from '../../types';
import { Store, User, Calendar, Shield, Phone, Clock, RefreshCw } from 'lucide-react';
import { formatCurrency, formatReadableDate } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatWarrantyLabel, getBuildWarrantyInfo } from '../../utils/warranty';
import { formatPhoneForDisplay, phoneHref } from '../../utils/phoneDisplay';

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
  const tradeInBuildName = hasTradeIn ? 'Traded Rig' : undefined;

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

      {/* Sale details: one grouped section, rather than a mix of cards and status pills. */}
      <div className="sold-build-info">
        <div className="sold-build-info-grid">
          <section>
            <div className="sold-build-info-label">
              <User className="w-3.5 h-3.5 text-[#B9EF68] shrink-0" /> Buyer
            </div>
            <div className="sold-build-info-value">{buyerName || 'Not recorded'}</div>
            {buyerPhone && (
              <a href={phoneHref(buyerPhone)} className="sold-build-info-link">
                <Phone className="w-3 h-3 shrink-0" /> {formatPhoneForDisplay(buyerPhone)}
              </a>
            )}
          </section>
          <section>
            <div className="sold-build-info-label">Sale details</div>
            <div className="sold-build-info-value">{paymentMethod || 'Payment N/A'}</div>
            <div className="sold-build-info-link">
              <Store className="w-3 h-3 shrink-0" /> {platform || 'Platform N/A'}
            </div>
          </section>
        </div>
        <div className="sold-build-timeline">
          <span className="inline-flex items-center gap-1 text-zinc-300"><Calendar className="w-3.5 h-3.5 text-zinc-400" /> Sold {displaySaleDate}</span>
          {displayBuiltDate && <span className="inline-flex items-center gap-1 text-[#9FF8F4]"><Clock className="w-3.5 h-3.5 text-[#83E5DF]" /> Built {displayBuiltDate}</span>}
          {daysOnMarket !== undefined && <span className="inline-flex items-center gap-1 text-emerald-300"><RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> {daysOnMarket === 0 ? 'Sold same day' : `Sold in ${daysOnMarket} ${daysOnMarket === 1 ? 'day' : 'days'}`}</span>}
        </div>
      </div>

      {/* 5. Prominent Full-Width 30-Day Warranty Tracker Banner */}
      {warrantyInfo && (
        <div
          className={`sold-build-warranty ${
            warrantyInfo.isActive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>{formatWarrantyLabel(warrantyDays)}</span>
          </div>
          <span className="text-[11px]">
            {warrantyInfo.isActive
              ? `ACTIVE (${warrantyInfo.daysLeft} DAYS REMAINING)`
              : `EXPIRED (${warrantyInfo.expiryFormatted})`}
          </span>
        </div>
      )}
    </div>
  );
};
