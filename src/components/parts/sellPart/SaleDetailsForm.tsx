import React from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { PaymentMethod } from '../../../types';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'E-Transfer',
  'PayPal',
  'Credit Card',
  'Debit',
  'Crypto',
];

interface SaleDetailsFormProps {
  hasTradeIn: boolean;
  isTradeUp?: boolean;
  quantity: number;
  maxQty: number;
  handleQuantityChange: (qty: number) => void;
  unitSalePrice: string;
  handleUnitSalePriceChange: (val: string) => void;
  totalSalePrice: string;
  handleTotalSalePriceChange: (val: string) => void;
  saleDate: string;
  setSaleDate: (val: string) => void;
  platform: string;
  setPlatform: (val: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (val: PaymentMethod) => void;
  buyerName: string;
  setBuyerName: (val: string) => void;
}

export const SaleDetailsForm: React.FC<SaleDetailsFormProps> = ({
  hasTradeIn,
  isTradeUp = false,
  quantity,
  maxQty,
  handleQuantityChange,
  unitSalePrice,
  handleUnitSalePriceChange,
  totalSalePrice,
  handleTotalSalePriceChange,
  saleDate,
  setSaleDate,
  platform,
  setPlatform,
  paymentMethod,
  setPaymentMethod,
  buyerName,
  setBuyerName,
}) => {
  if (isTradeUp) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between font-sans">
              <span>Quantity to Trade</span>
              <span className="text-[11px] text-zinc-500 font-mono font-normal">Max: {maxQty}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max={maxQty > 0 ? maxQty : 1}
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Exchange Date
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Platform / Source
            </label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors font-sans"
              placeholder="e.g. Local Trade, Facebook"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Payment Method (Cash Top-Up)
            </label>
            <CustomSelect
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="single-sale-money-grid grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between font-sans">
            <span>Quantity</span>
            <span className="text-[11px] text-zinc-500 font-mono font-normal">Max: {maxQty}</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max={maxQty > 0 ? maxQty : 1}
            value={quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
            className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
            <span>{hasTradeIn ? 'Cash Received (per unit)' : 'Unit Sale Price'}</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={unitSalePrice}
              onChange={(e) => handleUnitSalePriceChange(e.target.value)}
              className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
            {hasTradeIn ? 'Total Cash Received' : 'Total Sale Price'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={totalSalePrice}
              onChange={(e) => handleTotalSalePriceChange(e.target.value)}
              className="w-full h-9 bg-[#101719] border border-white/[0.08] rounded-xl pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Sale Info */}
      <div className="single-sale-info bg-[#101719] border border-white/[0.08] rounded-xl p-3.5 space-y-3 mt-3">
        <div className="single-sale-info-grid grid grid-cols-3 gap-3">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Sale Date
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Platform
            </label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
              placeholder="e.g. Amazon, Kijiji"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
              Payment Method
            </label>
            <CustomSelect
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              options={PAYMENT_METHODS.map(pm => ({ value: pm, label: pm }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1 font-sans">
            Buyer Name / Contact (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Alex"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="w-full h-9 bg-[#0B1113] border border-white/[0.08] rounded-xl px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
          />
        </div>
      </div>
    </>
  );
};
