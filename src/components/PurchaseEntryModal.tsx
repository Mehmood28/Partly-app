import React, { useState } from 'react';
import { CustomSelect } from './ui/CustomSelect';
import { Condition, PaymentMethod, PurchaseEntry } from '../types';
import { X, ShoppingCart } from 'lucide-react';
import { BottomSheetModal } from './ui/BottomSheetModal';
import { usePrivacy } from '../context/PrivacyContext';

interface PurchaseEntryModalProps {
  isOpen: boolean;
  componentName: string;
  onClose: () => void;
  onSave: (entry: Omit<PurchaseEntry, 'id'>) => void;
}

export const PurchaseEntryModal: React.FC<PurchaseEntryModalProps> = ({
  isOpen,
  componentName,
  onClose,
  onSave,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const [date, setDate] = useState<string>(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }));
  const [condition, setCondition] = useState<Condition>('New Open Box');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('E-Transfer');
  const [platform, setPlatform] = useState<string>('');
  const [taxPercent, setTaxPercent] = useState<string>('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(quantity, 10);
    const priceNum = parseFloat(unitPrice);
    if (isNaN(qtyNum) || qtyNum <= 0 || isNaN(priceNum) || priceNum < 0) return;

    const total = qtyNum * priceNum;
    onSave({
      date,
      condition,
      quantity: qtyNum,
      unitPrice: priceNum,
      totalPrice: total,
      paymentMethod,
      platform,
      taxPercent: parseFloat(taxPercent) || 0,
    });
    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <form 
        className="space-y-4 w-full"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#7C6CF2]" /> Log Component Purchase
            </h3>
            <p className="text-xs text-zinc-400 font-medium truncate mt-0.5 max-w-[300px]">
              {componentName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3"> 
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Price Paid / Unit ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors pr-3 pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Quantity</label>
              <input
                type="number"
                inputMode="decimal"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Purchase Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Condition</label> 
              <CustomSelect
                value={condition}
                onChange={(val) => setCondition(val as Condition)}
                options={[
                  { value: 'Sealed', label: 'Sealed' },
                  { value: 'New Open Box', label: 'New Open Box' },
                  { value: 'New No Box', label: 'New No Box' },
                  { value: 'Used Open Box', label: 'Used Open Box' },
                  { value: 'Used No Box', label: 'Used No Box' }
                ]}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3"> 
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Seller / Platform</label>
              <input
                type={hideSupplierNames ? "password" : "text"}
                autoComplete="off"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors"
                placeholder={hideSupplierNames ? "••••••••" : "e.g. Amazon, Best Buy, Daniel"}
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Payment Method</label>
              <CustomSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as PaymentMethod)}
                options={[
                  { value: 'E-Transfer', label: 'E-Transfer' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'PayPal', label: 'PayPal' },
                  { value: 'Credit Card', label: 'Credit Card' },
                  { value: 'Debit', label: 'Debit' }
                ]}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Tax Percent (%)</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white font-semibold shadow-md shadow-[#7C6CF2]/20 text-xs px-4 py-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
          >
            Save Purchase Entry
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
};
