import React from 'react';
import { PCBuild, TransactionLogItem } from '../../types';
import { Store, CreditCard, User, Calendar, Shield, Phone, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { formatWarrantyLabel, getBuildWarrantyInfo } from '../../utils/warranty';
import { formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';

interface SoldBuildTransactionPanelProps {
  build: PCBuild;
  partsCost: number;
  profit: number;
  roi: number;
  transaction?: TransactionLogItem | null;
}

export const SoldBuildTransactionPanel: React.FC<SoldBuildTransactionPanelProps> = ({
  build,
  partsCost,
  profit,
  roi,
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

  // Trade-in details
  const hasTradeIn = (transaction?.tradeInCredit !== undefined && transaction.tradeInCredit > 0);
  const tradeInCredit = transaction?.tradeInCredit ?? 0;
  const cashPortion = transaction?.cashPortion ?? (hasTradeIn ? Math.max(0, salePrice - tradeInCredit) : salePrice);
  const tradeInBuildName = hasTradeIn ? 'Traded Rig' : undefined;

  // Warranty calculation (30-day parts and labour guarantee from saleDate)
  const warrantyInfo = React.useMemo(() => getBuildWarrantyInfo(saleDate, new Date(), transaction.warrantyDaysAtSale ?? build.warrantyDays ?? 30), [saleDate, transaction.warrantyDaysAtSale, build.warrantyDays]);

  return (
    <div className="space-y-2.5 bg-[#0D1118] border border-white/[0.08] p-3 rounded-xl transition-all shadow-sm">
      {/* 1. Symmetrical Financial Metrics Grid (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Sale Price</div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#9D91FA] mt-0.5 leading-tight">{formatCurrency(salePrice)}</div>
        </div>
        <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Parts Cost</div>
          <div className="text-sm sm:text-base font-bold font-mono text-zinc-200 mt-0.5 leading-tight">{formatCurrency(partsCost)}</div>
        </div>
        <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Net Profit</div>
          <div className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(profit)}`}>{formatSignedCurrency(profit)}</div>
        </div>
        <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">ROI Margin</div>
          <div className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(roi)}`}>{roi.toFixed(1)}%</div>
        </div>
      </div>

      {/* 2. Trade-in Breakdown Banner (if present) */}
      {hasTradeIn && (
        <div className="bg-purple-950/25 border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider">
              Trade-In Included
            </span>
            <span className="text-zinc-300 text-xs">
              Cash: <span className="font-mono font-semibold text-zinc-100">{formatCurrency(cashPortion)}</span> + Trade Value: <span className="font-mono font-semibold text-purple-300">{formatCurrency(tradeInCredit)}</span>
              {tradeInBuildName && <span className="text-zinc-400 ml-1">({tradeInBuildName})</span>}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Total Effective: <span className="text-[#9D91FA] font-semibold">{formatCurrency(salePrice)}</span>
          </div>
        </div>
      )}

      {/* 3. Symmetrical Metadata Grid (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Platform
          </div>
          <div className="text-zinc-200 font-medium truncate font-mono text-xs">{platform || 'N/A'}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#7C6CF2] shrink-0" /> Payment
          </div>
          <div className="text-zinc-200 font-medium truncate font-mono text-xs">{paymentMethod || 'N/A'}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#7C6CF2] shrink-0" /> Buyer
          </div>
          <div className="text-zinc-200 font-medium truncate text-xs">{buyerName || 'N/A'}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Sale Date
          </div>
          <div className="text-zinc-200 font-medium truncate font-mono text-xs">{saleDate || 'N/A'}</div>
        </div>
      </div>

      {/* 4. Additional Metadata Details Row (if present) */}
      {(buyerPhone || builtDate || daysOnMarket !== undefined) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {buyerPhone && (
            <span className="bg-[#121722] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase inline-flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#7C6CF2]" /> {buyerPhone}
            </span>
          )}
          {builtDate && (
            <span className="bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-400" /> Built: {builtDate}
            </span>
          )}
          {daysOnMarket !== undefined && (
            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-emerald-400" /> {daysOnMarket === 0 ? 'Sold Same Day' : `Sold in ${daysOnMarket} ${daysOnMarket === 1 ? 'day' : 'days'}`}
            </span>
          )}
        </div>
      )}

      {/* 5. Prominent Full-Width 30-Day Warranty Tracker Banner */}
      {warrantyInfo && (
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono font-medium ${
            warrantyInfo.isActive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>{formatWarrantyLabel(transaction.warrantyDaysAtSale ?? build.warrantyDays ?? 30)}</span>
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
