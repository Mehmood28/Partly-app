import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, ShoppingCart, Trash2, Wand2, X } from 'lucide-react';
import { PaymentMethod } from '../../types';
import { PurchasePCData } from '../../context/types';
import { useToast } from '../../context/ToastContext';
import { compressBuildImage } from '../../utils/imageResizer';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { CustomSelect } from '../ui/CustomSelect';
import { PAYMENT_METHODS } from '../parts/sellPart/SaleDetailsForm';
import { ModeBManualEntry } from './dismantle/ModeBManualEntry';
import {
  allocateOptionalPartCosts,
  createInitialParts,
  ExtractedPartInput,
} from './dismantle/dismantleHelpers';

interface BuyPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (purchase: PurchasePCData) => { success: boolean; error?: string };
}

const torontoToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

export const BuyPCModal: React.FC<BuyPCModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(torontoToday);
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [manualParts, setManualParts] = useState<ExtractedPartInput[]>(createInitialParts);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setPurchasePrice('');
    setPurchaseDate(torontoToday());
    setSeller('');
    setPaymentMethod('Cash');
    setNotes('');
    setImageUrl('');
    setManualParts(createInitialParts());
    setFormError(null);
  }, [isOpen]);

  const activeParts = useMemo(
    () => manualParts.filter((part) => part.name.trim().length > 0),
    [manualParts]
  );
  const lockedParts = useMemo(
    () => activeParts.filter((part) => part.isLocked),
    [activeParts]
  );
  const assignedTotal = useMemo(
    () => activeParts.reduce(
      (sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.unitCost) || 0),
      0
    ),
    [activeParts]
  );

  const handleAddPart = () => {
    setManualParts((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        category: 'Fans',
        name: '',
        quantity: 1,
        unitCost: 0,
        isLocked: false,
        tags: [],
      },
    ]);
  };

  const handleRemovePart = (id: string) => {
    setManualParts((prev) => prev.filter((part) => part.id !== id));
  };

  const handleUpdatePart = (id: string, updates: Partial<ExtractedPartInput>) => {
    setFormError(null);
    setManualParts((prev) =>
      prev.map((part) => (part.id === id ? { ...part, ...updates } : part))
    );
  };

  const handleToggleLock = (id: string) => {
    setManualParts((prev) =>
      prev.map((part) => (part.id === id ? { ...part, isLocked: !part.isLocked } : part))
    );
  };

  const applyCostSplit = (): ExtractedPartInput[] | null => {
    const parsedPrice = Number(purchasePrice);
    const result = allocateOptionalPartCosts(manualParts, parsedPrice);
    if (!result.success) {
      setFormError(result.error || 'Unable to allocate the PC purchase cost.');
      return null;
    }

    const allocatedById = new Map(result.parts.map((part) => [part.id, part.unitCost]));
    setManualParts((prev) => prev.map((part) =>
      allocatedById.has(part.id)
        ? { ...part, unitCost: allocatedById.get(part.id) || 0 }
        : part
    ));
    setFormError(null);
    return result.parts;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImageUrl(await compressBuildImage(file));
    } catch (error) {
      console.error('Image resize failed', error);
      showToast('Unable to process that image.', 'error');
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(purchasePrice);
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Enter the total amount paid for the PC.');
      return;
    }
    if (!purchaseDate) {
      setFormError('Choose the date the PC was purchased.');
      return;
    }

    const allocatedParts = applyCostSplit();
    if (!allocatedParts) return;
    const result = onConfirm({
      name: name.trim() || undefined,
      purchasePrice: price,
      purchaseDate,
      seller: seller.trim() || undefined,
      paymentMethod,
      notes: notes.trim() || undefined,
      imageUrl: imageUrl || undefined,
      breakdown: allocatedParts.map(({ id, category, name: partName, quantity, unitCost, tags }) => ({
        id,
        category,
        name: partName,
        quantity,
        unitCost,
        tags,
      })),
    });
    if (!result.success) {
      setFormError(result.error || 'Unable to save this PC purchase.');
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-2xl h-[90vh] !max-h-[90vh] !p-0 !overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full w-full bg-[#090B10] text-zinc-100">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/[0.08] shrink-0 bg-[#0D1118]/95">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2 font-display">
                <ShoppingCart className="w-4 h-4 text-[#A3FF12]" /> Buy PC
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Record one whole-PC purchase and only include the components you plan to keep.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close modal" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-medium mb-1">PC Name / Listing Title (Optional)</label>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Auto-generated from CPU + GPU if left blank" className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12]" />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Total Paid *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">$</span>
                <input type="number" inputMode="decimal" min="0.01" step="0.01" required value={purchasePrice} onChange={(event) => { setPurchasePrice(event.target.value); setFormError(null); }} placeholder="520.00" className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl pl-7 pr-3 font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12]" />
              </div>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Date Bought *</label>
              <input type="date" required value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 font-mono text-zinc-100 focus:outline-none focus:border-[#A3FF12] [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Seller / Platform (Optional)</label>
              <input value={seller} onChange={(event) => setSeller(event.target.value)} placeholder="e.g. Facebook · John Smith" className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12]" />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Payment Method *</label>
              <CustomSelect value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-medium mb-1">Notes (Optional)</label>
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condition, damage, parts you will not keep, listing details…" className="w-full bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] resize-y" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-medium mb-1">PC Image (Optional)</label>
              {imageUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#121722] p-2.5">
                  <img src={imageUrl} alt="Purchased PC preview" className="w-16 h-16 rounded-lg object-cover" />
                  <button type="button" onClick={() => setImageUrl('')} className="ml-auto flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-2 py-1.5 rounded-lg hover:bg-rose-500/10">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <label className="h-11 rounded-xl border border-dashed border-white/[0.14] bg-[#121722] flex items-center justify-center gap-2 text-zinc-400 hover:text-zinc-200 hover:border-[#A3FF12]/50 cursor-pointer transition-colors">
                  <ImagePlus className="w-4 h-4" /> Add Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#A3FF12]/25 bg-[#A3FF12]/10 p-3 text-xs text-zinc-300">
            Leave any component blank if it is missing, damaged, or not being kept. Unlocked component costs are automatically split so the saved parts equal the total PC cost without recording the purchase twice.
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0D1118] p-3 text-xs">
            <div>
              <span className="text-zinc-400">Included:</span>{' '}
              <span className="font-mono text-zinc-100">{activeParts.length}</span>
              <span className="text-zinc-500"> · entered costs </span>
              <span className="font-mono text-[#67E8F9]">${assignedTotal.toFixed(2)}</span>
            </div>
            <button type="button" onClick={() => applyCostSplit()} disabled={activeParts.length === 0 || !purchasePrice} className="flex items-center gap-1.5 rounded-lg border border-[#A3FF12]/30 bg-[#A3FF12]/15 px-2.5 py-1.5 font-semibold text-[#67E8F9] hover:bg-[#A3FF12]/25 disabled:opacity-40 disabled:cursor-not-allowed">
              <Wand2 className="w-3.5 h-3.5" /> Split Cost
            </button>
          </div>

          <ModeBManualEntry
            manualParts={manualParts}
            lockedParts={lockedParts}
            handleAddPart={handleAddPart}
            handleRemovePart={handleRemovePart}
            handleUpdatePart={handleUpdatePart}
            handleToggleLock={handleToggleLock}
            optionalRows
            heading="Components to Keep"
          />
        </div>

        <div className="px-4 py-3 sm:px-5 border-t border-white/[0.08] shrink-0 bg-[#0D1118]/95 space-y-2">
          {formError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex items-center justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04]">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#A3FF12] hover:bg-[#C2FF5C] flex items-center gap-1.5 shadow-md shadow-[#A3FF12]/20">
              <ShoppingCart className="w-3.5 h-3.5" /> Save PC Purchase
            </button>
          </div>
        </div>
      </form>
    </BottomSheetModal>
  );
};
