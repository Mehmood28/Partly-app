import { compressBuildImage } from '../../utils/imageResizer';
import React, { useState, useEffect } from 'react';
import { PCBuild } from '../../types';
import { X, Pencil, ImagePlus, Trash2 } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';

interface EditBuildModalProps {
  build: PCBuild | null;
  onClose: () => void;
}

export const EditBuildModal: React.FC<EditBuildModalProps> = ({ build, onClose }) => {
  const { updateBuild } = useInventory();
  const { showToast } = useToast();
  
  const [editName, setEditName] = useState<string>('');
  const [editBuiltDate, setEditBuiltDate] = useState<string>('');
  const [editSalePrice, setEditSalePrice] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [warrantyDays, setWarrantyDays] = useState<string>('30');
  const [customWarrantyDays, setCustomWarrantyDays] = useState<string>('');

  useEffect(() => {
    if (build) {
      setEditName(build.name);
      setEditBuiltDate(build.builtDate || '');
      setEditSalePrice(build.salePrice ? String(build.salePrice) : '');
      setEditNotes(build.notes || '');
      setEditImageUrl(build.imageUrl || '');
      const wDays = build.warrantyDays ?? 30;
      if ([30, 60, 90, 365].includes(wDays)) {
        setWarrantyDays(String(wDays));
        setCustomWarrantyDays('');
      } else {
        setWarrantyDays('Custom');
        setCustomWarrantyDays(String(wDays));
      }
    }
  }, [build]);

  if (!build) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(editSalePrice);
    let resolvedWarrantyDays = 30;
    if (warrantyDays === 'Custom') {
      const parsed = Number(customWarrantyDays);
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        showToast('Custom warranty days must be a positive whole number.', 'error');
        return;
      }
      resolvedWarrantyDays = parsed;
    } else {
      resolvedWarrantyDays = Number(warrantyDays);
    }


    updateBuild(build.id, {
      name: editName.trim() || build.name,
      ...(build.status !== 'Sold'
        ? {
            builtDate: editBuiltDate || undefined,
            salePrice: !isNaN(priceVal) && priceVal >= 0 ? priceVal : undefined,
          }
        : {}),
      notes: editNotes.trim(),
      imageUrl: editImageUrl || undefined,
      warrantyDays: resolvedWarrantyDays,
    });
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await compressBuildImage(file);
        setEditImageUrl(resized);
      } catch (err) {
        console.error("Image resize failed", err);
      }
    }
  };

  return (
    <BottomSheetModal isOpen={true} onClose={onClose} className="max-w-md">
      <form 
        className="space-y-4 w-full"
        onSubmit={handleSaveEdit}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#A3FF12]" /> Edit PC Build
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">Build Name / Title</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Status</label>
              <div className="w-full h-11 bg-[#121722]/60 border border-white/[0.08] rounded-xl px-3 flex items-center">
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border leading-none ${
                    build.status === 'Sold'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : build.status === 'Listed for Sale'
                      ? 'bg-[#A3FF12]/15 text-[#67E8F9] border-[#A3FF12]/30'
                      : build.status === 'Trade-In Processing'
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
                      : 'bg-blue-500/15 text-blue-400 border-blue-500/40'
                  }`}
                >
                  {build.status === 'Listed for Sale'
                    ? 'Available'
                    : build.status === 'In Progress'
                    ? 'Pending Sale'
                    : build.status === 'Trade-In Processing'
                    ? 'Trade-In Processing'
                    : build.status}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Built Date</label>
              <input
                type="date"
                disabled={build.status === 'Sold'}
                value={editBuiltDate}
                onChange={(e) => setEditBuiltDate(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">
              {build.status === 'Sold' ? 'Sale Price ($)' : 'Target Sale Price ($)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
              <input
                type="number" inputMode="decimal"
                disabled={build.status === 'Sold'}
                step="any"
                value={editSalePrice}
                onChange={(e) => setEditSalePrice(e.target.value)}
                className="w-full h-11 bg-[#121722] border border-white/[0.08] rounded-xl py-2 text-xs sm:text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors pr-3 pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">Warranty Provided</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <CustomSelect
                  value={warrantyDays}
                  onChange={(val) => setWarrantyDays(val)}
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
              {warrantyDays === 'Custom' && (
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customWarrantyDays}
                  onChange={(e) => setCustomWarrantyDays(e.target.value)}
                  className="w-20 h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-2 py-2 text-xs sm:text-sm text-zinc-100 text-center placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors"
                  placeholder="Days"
                  required
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">Notes / Description</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full min-h-[60px] bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors resize-y font-sans"
              placeholder="Build specs, condition, notes..."
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-xs">PC Image (Optional)</label>
            <div className="flex items-center gap-3">
              {editImageUrl ? (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/[0.1] shrink-0">
                  <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl('')}
                    className="absolute top-0.5 right-0.5 bg-black/80 rounded-md p-1 text-zinc-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl border border-dashed border-white/[0.1] bg-[#121722] flex items-center justify-center text-zinc-500 shrink-0">
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
                    file:bg-[#121722] file:text-zinc-200
                    hover:file:bg-white/[0.06]
                    cursor-pointer"
                />
                <p className="text-[11px] text-zinc-500 mt-1">Upload a photo of the completed build.</p>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[#A3FF12] hover:bg-[#C2FF5C] text-white font-semibold shadow-md shadow-[#A3FF12]/20 px-4 py-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
};
