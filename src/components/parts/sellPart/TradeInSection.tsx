import React from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { ComponentCategory, CATEGORIES } from '../../../types';
import { SUB_CATEGORIES, formatCurrency } from '../../../utils/helpers';
import { ArrowRightLeft, TrendingUp, UserCheck } from 'lucide-react';

export type TradeDirection = 'CUSTOMER_TRADE_IN' | 'TRADE_UP';

interface TradeInSectionProps {
  hasTradeIn: boolean;
  setHasTradeIn: (val: boolean) => void;
  tradeDirection: TradeDirection;
  setTradeDirection: (val: TradeDirection) => void;
  tradeInPartCategory: ComponentCategory;
  setTradeInPartCategory: (val: ComponentCategory) => void;
  tradeInCredit: string;
  setTradeInCredit: (val: string) => void;
  cashPaidOnTop: string;
  setCashPaidOnTop: (val: string) => void;
  selectedTradeTags: string[];
  setSelectedTradeTags: (val: string[] | ((prev: string[]) => string[])) => void;
  tradeInPartName: string;
  setTradeInPartName: (val: string) => void;
  parsedCashTotal: number;
  totalEffectiveSalePrice: number;
  creditAmount: number;
  outgoingCostBasis: number;
  outgoingPartName?: string;
  outgoingQuantity?: number;
}

export const TradeInSection: React.FC<TradeInSectionProps> = ({
  hasTradeIn,
  setHasTradeIn,
  tradeDirection,
  setTradeDirection,
  tradeInPartCategory,
  setTradeInPartCategory,
  tradeInCredit,
  setTradeInCredit,
  cashPaidOnTop,
  setCashPaidOnTop,
  selectedTradeTags,
  setSelectedTradeTags,
  tradeInPartName,
  setTradeInPartName,
  parsedCashTotal,
  totalEffectiveSalePrice,
  creditAmount,
  outgoingCostBasis,
  outgoingPartName,
  outgoingQuantity = 1,
}) => {
  const parsedCashPaid = Math.max(0, parseFloat(cashPaidOnTop) || 0);
  const incomingCostBasis = outgoingCostBasis + parsedCashPaid;

  return (
    <div className="trade-in-section space-y-3 border-y border-white/[0.08] py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-[#B9EF68]" />
          <span className="text-xs font-semibold text-zinc-100 font-sans">Trade-In / Trade Up</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hasTradeIn}
            onChange={(e) => setHasTradeIn(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#B9EF68]"></div>
        </label>
      </div>

      {hasTradeIn && (
        <div className="pt-3 border-t border-white/[0.08] space-y-3">
          {/* Trade Direction Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTradeDirection('CUSTOMER_TRADE_IN')}
              className={`min-h-[58px] border text-left transition-all flex flex-col justify-between px-2.5 py-2 ${
                tradeDirection === 'CUSTOMER_TRADE_IN'
                  ? 'bg-[#B9EF68]/[0.06] border-[#B9EF68]/40 text-zinc-100'
                  : 'bg-transparent border-white/[0.08] text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <UserCheck className={`w-3.5 h-3.5 ${tradeDirection === 'CUSTOMER_TRADE_IN' ? 'text-[#83E5DF]' : 'text-zinc-500'}`} />
                <span className="text-xs font-semibold">Customer Trade-In</span>
              </div>
              <span className="text-[11px] text-zinc-500 leading-tight">
                Customer traded in a part towards this purchase (Partial credit)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTradeDirection('TRADE_UP')}
              className={`min-h-[58px] border text-left transition-all flex flex-col justify-between px-2.5 py-2 ${
                tradeDirection === 'TRADE_UP'
                  ? 'bg-cyan-500/[0.06] border-cyan-500/40 text-zinc-100'
                  : 'bg-transparent border-white/[0.08] text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className={`w-3.5 h-3.5 ${tradeDirection === 'TRADE_UP' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <span className="text-xs font-semibold">Trade Up + Cash</span>
              </div>
              <span className="text-[11px] text-zinc-500 leading-tight">
                I traded this part and paid cash on top (Cost basis transfer)
              </span>
            </button>
          </div>

          {tradeDirection === 'CUSTOMER_TRADE_IN' ? (
            /* CUSTOMER TRADE-IN PATH (Existing Preserved Flow) */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                    Incoming Part Category <span className="text-rose-400">*</span>
                  </label>
                  <CustomSelect
                    value={tradeInPartCategory}
                    onChange={(val) => {
                      setTradeInPartCategory(val as ComponentCategory);
                      setSelectedTradeTags([]);
                    }}
                    options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                    Trade-In Credit ($) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required={hasTradeIn}
                      value={tradeInCredit}
                      onChange={(e) => setTradeInCredit(e.target.value)}
                      className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
                      placeholder="40.00"
                    />
                  </div>
                </div>
              </div>

              {SUB_CATEGORIES[tradeInPartCategory] && SUB_CATEGORIES[tradeInPartCategory].length > 0 && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5 text-xs font-sans">
                    Component Tags / Specifics (Optional)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUB_CATEGORIES[tradeInPartCategory].map((tag) => {
                      const isSelected = selectedTradeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTradeTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                            isSelected
                              ? 'bg-[#B9EF68]/20 text-[#83E5DF] border-[#B9EF68]/40'
                              : 'bg-[#0B1113] text-zinc-400 border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-200'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                  Incoming Part Name / Model <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required={hasTradeIn}
                  value={tradeInPartName}
                  onChange={(e) => setTradeInPartName(e.target.value)}
                  className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
                  placeholder="e.g. GTX 1660 Super 6GB"
                />
              </div>

              <div className="flex items-center justify-between border-y border-[#B9EF68]/25 bg-[#B9EF68]/[0.04] px-1 py-2.5">
                <div>
                  <div className="text-[11px] text-[#83E5DF] uppercase tracking-wider font-semibold">Total Effective Sale Price</div>
                  <div className="text-xs text-zinc-400">
                    {formatCurrency(parsedCashTotal)} Cash + {formatCurrency(creditAmount)} Trade-In Credit
                  </div>
                </div>
                <div className="text-base font-bold font-mono text-[#83E5DF]">
                  {formatCurrency(totalEffectiveSalePrice)}
                </div>
              </div>
            </>
          ) : (
            /* TRADE UP / CASH PAID ON TOP PATH */
            <>
              {/* Outgoing Basis Info */}
              <div className="space-y-1.5 border-y border-white/[0.08] px-1 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-sans">Outgoing Part Cost Basis:</span>
                  <span className="font-mono font-bold text-zinc-200">{formatCurrency(outgoingCostBasis)}</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {outgoingQuantity}x {outgoingPartName || 'Selected Part'} ({formatCurrency(outgoingCostBasis / (outgoingQuantity || 1))} each from selected batch)
                </div>
              </div>

              {/* Cash Paid on Top */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                  Cash Paid on Top ($) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required={hasTradeIn && tradeDirection === 'TRADE_UP'}
                    value={cashPaidOnTop}
                    onChange={(e) => setCashPaidOnTop(e.target.value)}
                    className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors font-mono"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  The additional cash you paid to complete the trade up.
                </p>
              </div>

              {/* Incoming Category & Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                    Incoming Category <span className="text-rose-400">*</span>
                  </label>
                  <CustomSelect
                    value={tradeInPartCategory}
                    onChange={(val) => {
                      setTradeInPartCategory(val as ComponentCategory);
                      setSelectedTradeTags([]);
                    }}
                    options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs font-sans">
                    Incoming Part Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required={hasTradeIn && tradeDirection === 'TRADE_UP'}
                    value={tradeInPartName}
                    onChange={(e) => setTradeInPartName(e.target.value)}
                    className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors font-sans"
                    placeholder="e.g. RTX 5070 Ti 16GB"
                  />
                </div>
              </div>

              {SUB_CATEGORIES[tradeInPartCategory] && SUB_CATEGORIES[tradeInPartCategory].length > 0 && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5 text-xs font-sans">
                    Component Tags / Specifics (Optional)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUB_CATEGORIES[tradeInPartCategory].map((tag) => {
                      const isSelected = selectedTradeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTradeTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-[#0B1113] text-zinc-400 border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-200'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trade Up Transfer Calculation Summary */}
              <div className="space-y-2 border-y border-cyan-500/25 bg-cyan-500/[0.04] px-1 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cyan-400 uppercase tracking-wider font-semibold">
                    Trade Up Cost Basis Transfer
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">Realized P/L: $0.00</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-cyan-500/20 text-center">
                  <div className="p-1.5">
                    <div className="text-[11px] text-zinc-400 uppercase font-sans">Outgoing Basis</div>
                    <div className="text-xs font-bold font-mono text-zinc-200">{formatCurrency(outgoingCostBasis)}</div>
                  </div>
                  <div className="border-x border-cyan-500/15 p-1.5">
                    <div className="text-[11px] text-zinc-400 uppercase font-sans">Cash Paid</div>
                    <div className="text-xs font-bold font-mono text-cyan-400">+{formatCurrency(parsedCashPaid)}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[11px] text-cyan-300 uppercase font-sans">New Part Basis</div>
                    <div className="text-xs font-bold font-mono text-cyan-300">{formatCurrency(incomingCostBasis)}</div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  The incoming part will be added to inventory with an exact cost basis of {formatCurrency(incomingCostBasis)}. No loose-part sales revenue or profit is realized.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
