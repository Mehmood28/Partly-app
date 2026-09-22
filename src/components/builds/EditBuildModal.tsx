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
  isOpen?: boolean;
  onClose: () => void;
}

export const EditBuildModal: React.FC<EditBuildModalProps> = ({ build, isOpen = true, onClose }) => {
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
    <BottomSheetModal isOpen={isOpen} onClose={onClose} layout="content" className="build-modal stock-modal max-w-md !p-0">
      <form 
        className="modal-standard-form w-full"
        onSubmit={handleSaveEdit}
      >
        <div className="modal-standard-header flex items-center justify-between border-b border-white/[0.08]">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#B9EF68]" /> Edit PC Build
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
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
              className="app-field h-11 px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm font-sans"
            />
          </div>

          <div>
              <label className="block text-zinc-300 font-medium mb-1 text-xs">Built Date</label>
              <input
                type="date"
                disabled={build.status === 'Sold'}
                value={editBuiltDate}
                onChange={(e) => setEditBuiltDate(e.target.value)}
                className="app-field h-11 px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm [color-scheme:dark]"
              />
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
                className="app-field h-11 py-2 pl-7 pr-3 text-xs placeholder:text-zinc-500 sm:text-sm font-mono"
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
                  className="app-field h-11 w-20 px-2 py-2 text-center text-xs placeholder:text-zinc-500 sm:text-sm"
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
              className="app-field min-h-[60px] px-3 py-2 text-xs placeholder:text-zinc-500 sm:text-sm resize-y font-sans"
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
              <div className="min-w-0 flex-1">
                <label className="build-image-file-control">
                  <ImagePlus />
                  <span>{editImageUrl ? 'Replace Image' : 'Choose Image'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <p className="text-[11px] text-zinc-500 mt-1">Upload a photo of the completed build.</p>
              </div>
            </div>
          </div>

        </div>

        <div className="modal-standard-footer flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold shadow-md shadow-[#B9EF68]/20 px-4 py-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
};
