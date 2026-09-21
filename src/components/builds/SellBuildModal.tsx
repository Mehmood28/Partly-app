import { resizeImage } from '../../utils/imageResizer';
import { CustomSelect } from './../ui/CustomSelect';
import React, { useState, useEffect } from 'react';
import { PCBuild, PaymentMethod } from '../../types';
import { SellBuildData } from '../../context/types';
import { calculateBuildPartsCost, formatCurrency, parseDateLocal } from '../../utils/helpers';
import { normalizePlatform } from '../../utils/platformDisplay';
import { X, DollarSign, ImagePlus, Trash2, ArrowRightLeft, Lock } from 'lucide-react';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { findLinkedSaleTransaction, getSaleTradeInEditState } from '../../utils/buildEligibility';
import {
  parseOrdinarySalePrice,
  parseCashReceived,
  parseTradeInCredit,
  parseTradeInSaleInputs,
} from './sellBuildParsers';

export type BuildSaleData = SellBuildData;

interface SellBuildModalProps {
  build: PCBuild | null;
  onClose: () => void;
  onConfirm: (buildId: string, saleData: SellBuildData) => void;
}

export const SellBuildModal: React.FC<SellBuildModalProps> = ({ build, onClose, onConfirm }) => {
  const { state } = useInventory();
  const { showToast } = useToast();
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>('');
  const [builtDate, setBuiltDate] = useState<string>('');
  const [platformSold, setPlatformSold] = useState<string>('Facebook');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('E-Transfer');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

  // Trade-In state
  const [hasTradeIn, setHasTradeIn] = useState<boolean>(false);
  const [tradeInCredit, setTradeInCredit] = useState<string>('');
  const [tradeInBuildName, setTradeInBuildName] = useState<string>('');
  const [tradeInNotes, setTradeInNotes] = useState<string>('');
  const [warrantyDaysAtSale, setWarrantyDaysAtSale] = useState<string>('30');
  const [customWarrantyDays, setCustomWarrantyDays] = useState<string>('');

  const linkResult = build && build.status === 'Sold' ? findLinkedSaleTransaction(build, state.transactions) : undefined;
  const linkedTx = linkResult?.transaction;
  const tradeInEditState = React.useMemo(() => {
    return getSaleTradeInEditState(linkedTx, state.builds, state.components);
  }, [linkedTx, state.builds, state.components]);
  const isTradeInLocked = tradeInEditState.isLocked;

  const resetFormState = React.useCallback((targetBuild: PCBuild | null) => {
    if (!targetBuild) {
      setSalePrice('');
      setSaleDate('');
      setBuiltDate('');
      setPlatformSold('Facebook');
      setPaymentMethod('E-Transfer');
      setBuyerName('');
      setBuyerPhone('');
      setImageUrl('');
      setHasTradeIn(false);
      setTradeInCredit('');
      setTradeInBuildName('');
      setTradeInNotes('');
      setWarrantyDaysAtSale('30');
      setCustomWarrantyDays('');
      return;
    }

    const estCost = calculateBuildPartsCost(targetBuild);
    const isSold = targetBuild.status === 'Sold';
    const txMatch = isSold ? findLinkedSaleTransaction(targetBuild, state.transactions).transaction : undefined;
    const txTradeInState = getSaleTradeInEditState(txMatch, state.builds, state.components);

    if (isSold && txMatch && txTradeInState.hasExistingTradeIn) {
      setHasTradeIn(true);
      setTradeInCredit(txMatch.tradeInCredit !== undefined ? String(txMatch.tradeInCredit) : '');
      setTradeInBuildName(txMatch.tradeInBuildName || '');
      setTradeInNotes(txMatch.tradeInNotes || '');
      const cashVal = txMatch.cashPortion !== undefined
        ? txMatch.cashPortion
        : (targetBuild.salePrice !== undefined && txMatch.tradeInCredit !== undefined
            ? targetBuild.salePrice - txMatch.tradeInCredit
            : '');
      setSalePrice(String(cashVal));
    } else {
      setHasTradeIn(false);
      setTradeInCredit('');
      setTradeInBuildName('');
      setTradeInNotes('');
      setSalePrice(targetBuild.salePrice ? String(targetBuild.salePrice) : String(Math.round(estCost * 1.25)));
    }

    setSaleDate(targetBuild.saleDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }));
    setBuiltDate(targetBuild.builtDate || '');
    setPlatformSold(normalizePlatform(targetBuild.platformSoldOn) || 'Facebook');
    setPaymentMethod(targetBuild.paymentMethod || 'E-Transfer');
    setBuyerName(targetBuild.buyerName || '');
    setBuyerPhone(targetBuild.buyerPhone || '');
    setImageUrl(targetBuild.imageUrl || '');
    const wDays = (isSold && txMatch && txMatch.warrantyDaysAtSale !== undefined) ? txMatch.warrantyDaysAtSale : (targetBuild.warrantyDays ?? 30);
    if ([30, 60, 90, 365].includes(wDays)) {
      setWarrantyDaysAtSale(String(wDays));
      setCustomWarrantyDays('');
    } else {
      setWarrantyDaysAtSale('Custom');
      setCustomWarrantyDays(String(wDays));
    }
  }, [state.transactions, state.builds, state.components]);

  useEffect(() => {
    resetFormState(build);
  }, [build, resetFormState]);

  const handleClose = () => {
    resetFormState(null);
    onClose();
  };

  if (!build) return null;

  const cashParsed = parseCashReceived(salePrice);
  const cashAmount = cashParsed.success ? cashParsed.value : 0;
  const creditParsed = hasTradeIn
    ? (isTradeInLocked && typeof linkedTx?.tradeInCredit === 'number' && Number.isFinite(linkedTx.tradeInCredit) && linkedTx.tradeInCredit > 0
        ? { success: true as const, value: linkedTx.tradeInCredit }
        : parseTradeInCredit(tradeInCredit))
    : null;
  const creditAmount = creditParsed && creditParsed.success ? creditParsed.value : 0;
  const ordinaryPriceParsed = !hasTradeIn ? parseOrdinarySalePrice(salePrice) : null;
  const totalEffectivePrice = hasTradeIn
    ? cashAmount + creditAmount
    : (ordinaryPriceParsed && ordinaryPriceParsed.success ? ordinaryPriceParsed.value : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let resolvedWarrantyDays = 30;
    if (warrantyDaysAtSale === 'Custom') {
      const parsed = Number(customWarrantyDays);
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        showToast('Custom warranty days must be a positive whole number.', 'error');
        return;
      }
      resolvedWarrantyDays = parsed;
    } else {
      resolvedWarrantyDays = Number(warrantyDaysAtSale);
    }
    
    if (!saleDate || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || !parseDateLocal(saleDate)) {
      showToast('Please enter a valid sale date in YYYY-MM-DD format.', 'error');
      return;
    }

    const trimmedBuiltDate = builtDate.trim();
    if (trimmedBuiltDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedBuiltDate) || !parseDateLocal(trimmedBuiltDate)) {
        showToast('Please enter a valid built date in YYYY-MM-DD format.', 'error');
        return;
      }
      if (trimmedBuiltDate > saleDate) {
        showToast('Built date cannot be later than sale date.', 'error');
        return;
      }
    }

    const finalPlatform = normalizePlatform(platformSold) || 'Facebook';

    if (isTradeInLocked) {
      const savedCredit = linkedTx?.tradeInCredit;
      if (
        typeof savedCredit !== 'number' ||
        !Number.isFinite(savedCredit) ||
        savedCredit <= 0
      ) {
        showToast('Cannot edit sale: The locked trade-in credit is invalid or missing.', 'error');
        return;
      }

      const cashValidation = parseCashReceived(salePrice);
      if (!cashValidation.success) {
        showToast(cashValidation.error, 'error');
        return;
      }

      onConfirm(build.id, {
        salePrice: savedCredit + cashValidation.value,
        warrantyDaysAtSale: resolvedWarrantyDays,
        saleDate,
        builtDate: trimmedBuiltDate || undefined,
        platformSoldOn: finalPlatform,
        paymentMethod,
        buyerName: buyerName.trim() || undefined,
        buyerPhone: buyerPhone.trim() || undefined,
        imageUrl: imageUrl || undefined,
        tradeIn: undefined,
      });
      return;
    }

    if (hasTradeIn) {
      if (!tradeInBuildName.trim()) {
        showToast('Trade-in rig name is required.', 'error');
        return;
      }

      const tradeInValidation = parseTradeInSaleInputs(salePrice, tradeInCredit);
      if (!tradeInValidation.success) {
        showToast(tradeInValidation.error, 'error');
        return;
      }

      onConfirm(build.id, {
        salePrice: tradeInValidation.totalEffectivePrice,
        warrantyDaysAtSale: resolvedWarrantyDays,
        saleDate,
        builtDate: trimmedBuiltDate || undefined,
        platformSoldOn: finalPlatform,
        paymentMethod,
        buyerName: buyerName.trim() || undefined,
        buyerPhone: buyerPhone.trim() || undefined,
        imageUrl: imageUrl || undefined,
        tradeIn: {
          tradeInCredit: tradeInValidation.tradeInCredit,
          tradeInBuildName: tradeInBuildName.trim(),
          tradeInNotes: tradeInNotes.trim() || undefined,
        },
      });
    } else {
      const priceValidation = parseOrdinarySalePrice(salePrice);
      if (!priceValidation.success) {
        showToast(priceValidation.error, 'error');
        return;
      }

      onConfirm(build.id, {
        salePrice: priceValidation.value,
        warrantyDaysAtSale: resolvedWarrantyDays,
        saleDate,
        builtDate: trimmedBuiltDate || undefined,
        platformSoldOn: finalPlatform,
        paymentMethod,
        buyerName: buyerName.trim() || undefined,
        buyerPhone: buyerPhone.trim() || undefined,
        imageUrl: imageUrl || undefined,
        tradeIn: tradeInEditState.hasExistingTradeIn ? null : undefined,
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImage(file, 1200, 1200);
        setImageUrl(resized);
      } catch (err) {
        console.error("Image resize failed", err);
      }
    }
  };

  return (
    <BottomSheetModal isOpen={true} onClose={handleClose} className="build-modal stock-modal sell-build-modal max-w-xl">
      <form 
        className="sell-build-form w-full"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Log PC Build Sale
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sell-build-form-body space-y-3 text-xs flex flex-col">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Built Date</label>
              <input
                type="date"
                value={builtDate}
                onChange={(e) => setBuiltDate(e.target.value)}
                className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Sale Date</label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">
                {hasTradeIn ? 'Cash / Transfer Received ($)' : 'Selling Price ($)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors pr-3 pl-7"
                  placeholder={hasTradeIn ? "2000" : "2500"}
                />
              </div>
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
                  { value: 'Credit Card', label: 'Credit Card' }
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">Warranty Provided</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <CustomSelect
                  value={warrantyDaysAtSale}
                  onChange={(val) => setWarrantyDaysAtSale(val)}
                  options={[
                    { value: '30', label: '30 Days' },
                    { value: '60', label: '60 Days' },
                    { value: '90', label: '90 Days' },
                    { value: '365', label: '1 Year' },
                    { value: 'Custom', label: 'Custom' },
                  ]}
                  placeholder="Select..."
                />
              </div>
              {warrantyDaysAtSale === 'Custom' && (
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customWarrantyDays}
                  onChange={(e) => setCustomWarrantyDays(e.target.value)}
                  className="w-20 h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-2 py-2 text-xs sm:text-sm text-zinc-100 text-center placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors"
                  placeholder="Days"
                  required
                />
              )}
            </div>
          </div>

          {/* Trade-In Toggle Section */}
          <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#83E5DF]" />
                <span className="text-xs font-semibold text-zinc-200">Accept PC Trade-In</span>
                {isTradeInLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/25">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
              <label className={`relative inline-flex items-center ${isTradeInLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={hasTradeIn}
                  disabled={isTradeInLocked}
                  onChange={(e) => {
                    if (!isTradeInLocked) {
                      setHasTradeIn(e.target.checked);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#0B1113] border border-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#B9EF68]"></div>
              </label>
            </div>

            {isTradeInLocked && (
              <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg p-2 leading-relaxed">
                {tradeInEditState.lockReason || 'This trade-in PC has downstream activity (allocated upgrade parts, parts extracted, or listed/sold) and cannot be removed or have its trade-in valuation changed.'}
              </div>
            )}

            {hasTradeIn && (
              <div className="pt-3 border-t border-white/[0.08] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1 text-xs">
                      Trade-In Valuation Credit ($) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        required={hasTradeIn}
                        disabled={isTradeInLocked}
                        value={tradeInCredit}
                        onChange={(e) => setTradeInCredit(e.target.value)}
                        className={`w-full h-11 bg-[#0B1113] border border-[#B9EF68]/30 rounded-xl py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors pr-3 pl-7 ${isTradeInLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1 text-xs">
                      Traded-In Rig Name / Model <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required={hasTradeIn}
                      disabled={isTradeInLocked}
                      value={tradeInBuildName}
                      onChange={(e) => setTradeInBuildName(e.target.value)}
                      className={`w-full h-11 bg-[#0B1113] border border-[#B9EF68]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans ${isTradeInLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      placeholder="e.g. i7-10700K + RTX 3070 Rig"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-xs">Trade-In Notes (Optional)</label>
                  <input
                    type="text"
                    disabled={isTradeInLocked}
                    value={tradeInNotes}
                    onChange={(e) => setTradeInNotes(e.target.value)}
                    className={`w-full h-11 bg-[#0B1113] border border-[#B9EF68]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans ${isTradeInLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder="e.g. Boots fine, needs dusting, 16GB RAM, 650W PSU"
                  />
                </div>

                {/* Computed Total Effective Sale Price */}
                <div className="bg-[#B9EF68]/10 border border-[#B9EF68]/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#83E5DF] font-semibold">Total Effective Sale Price</div>
                    <div className="text-xs text-zinc-400 font-sans mt-0.5">
                      {formatCurrency(cashAmount)} Cash + {formatCurrency(creditAmount)} Trade-In Credit
                    </div>
                  </div>
                  <div className="text-base font-bold font-mono text-[#83E5DF]">
                    {formatCurrency(totalEffectivePrice)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">Platform Sold On</label>
            <input
              type="text"
              value={platformSold}
              onChange={(e) => setPlatformSold(e.target.value)}
              className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
              placeholder="e.g. Amazon, Kijiji"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Buyer Name (Optional)</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
                placeholder="e.g. Alex"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Buyer Phone Number</label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-sans"
                placeholder="e.g. 555-0123"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">PC Image (Optional)</label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/[0.1] shrink-0">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-0.5 right-0.5 bg-black/80 rounded-md p-1 text-zinc-300 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl border border-dashed border-white/[0.1] bg-[#101719] flex items-center justify-center text-zinc-500 shrink-0">
                  <ImagePlus className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-xs text-zinc-400
                    file:mr-2 file:py-1.5 file:px-3
                    file:rounded-lg file:border file:border-white/[0.08]
                    file:text-xs file:font-semibold
                    file:bg-[#101719] file:text-zinc-200
                    hover:file:bg-white/[0.06]
                    cursor-pointer"
                />
                <p className="text-[11px] text-zinc-500 mt-1">Upload a photo of the sold PC.</p>
              </div>
            </div>
          </div>

        </div>

        <div className="sell-build-form-footer pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <DollarSign className="w-3.5 h-3.5" /> Confirm Sale
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
};
