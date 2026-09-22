import { BottomSheetModal } from './ui/BottomSheetModal';
import React, { useState } from 'react';
import { resizeImage } from '../utils/imageResizer';
import { X, Upload, FileText, Trash2, Zap, Save } from 'lucide-react';
import { ComponentCategory, Condition, PaymentMethod, Platform } from '../types';
import { usePrivacy } from '../context/PrivacyContext';
import { CustomSelect } from './ui/CustomSelect';
import { useToast } from '../context/ToastContext';

const CATEGORY_OPTIONS = ['GPU', 'CPU', 'Motherboard', 'RAM', 'Cooling', 'Storage', 'PSU', 'Case', 'Fans', 'Accessories', 'Other']
  .map((value) => ({ value, label: value }));
const CONDITION_OPTIONS = ['Sealed', 'New Open Box', 'New No Box', 'Used Open Box', 'Used No Box']
  .map((value) => ({ value, label: value }));
const PAYMENT_OPTIONS = ['Cash', 'E-Transfer', 'PayPal', 'Credit Card', 'Other']
  .map((value) => ({ value, label: value }));

export interface ParsedBulkStockItem {
  name: string;
  category: ComponentCategory;
  quantity: number;
  unitCost: number;
  condition?: Condition;
  vendor?: Platform;
  date?: string;
  paymentMethod?: PaymentMethod;
}

interface BulkStockEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAll: (items: ParsedBulkStockItem[]) => void;
}

export const BulkStockEntryModal: React.FC<BulkStockEntryModalProps> = ({ isOpen, onClose, onSaveAll }) => {
  const { hideSupplierNames } = usePrivacy();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [textInput, setTextInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedBulkStockItem[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        try {
          const resized = await resizeImage(file, 1200, 1200);
          setImages((prev) => [...prev, resized]);
        } catch (err) {
          console.error('Error resizing image', err);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParse = async () => {
    setIsParsing(true);
    try {
      const payload: { text?: string; images?: string[] } = {};
      if (activeTab === 'text') {
        if (!textInput.trim()) return;
        payload.text = textInput;
      } else {
        if (images.length === 0) return;
        payload.images = images;
      }

      const res = await fetch('/api/parse-bulk-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errData;
        try { errData = await res.json(); } catch(e){}
        throw new Error((errData && errData.error) || 'Failed to parse');
      }
      const data: ParsedBulkStockItem[] = await res.json();
      setParsedItems(data);
    } catch (err: unknown) {
      console.error(err);
      showToast(`Parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const updateParsedItem = <K extends keyof ParsedBulkStockItem>(index: number, field: K, value: ParsedBulkStockItem[K]) => {
    setParsedItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const removeParsedItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onSaveAll(parsedItems);
    handleClose();
  };

  const handleClose = () => {
    setTextInput('');
    setImages([]);
    setParsedItems([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BottomSheetModal isOpen={isOpen} onClose={handleClose} layout={parsedItems.length > 0 ? 'workspace' : 'content'} className="stock-modal bulk-entry-modal max-w-4xl !p-0">
      <div className={`flex w-full flex-col bg-[#0B1113] ${parsedItems.length > 0 ? 'h-full min-h-0' : ''}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#B9EF68]/25 bg-[#B9EF68]/10 text-[#B9EF68]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100 font-display">Fast Bulk Stock Entry</h2>
              <p className="text-xs text-zinc-400 font-sans">Smart import via AI text parsing or receipt scanning</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`${parsedItems.length > 0 ? 'min-h-0 flex-1 overflow-y-auto' : ''} space-y-3 px-3 py-3 sm:px-4`}>
          {parsedItems.length === 0 ? (
            <>
              {/* Mode Selection */}
              <div className="app-segmented mx-auto grid w-full max-w-sm grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  data-active={activeTab === 'text'}
                  className="flex items-center justify-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" /> Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('image')}
                  data-active={activeTab === 'image'}
                  className="flex items-center justify-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" /> Scan Images
                </button>
              </div>

              {/* Input Area */}
              <div className="app-panel p-3">
                {activeTab === 'text' ? (
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste unformatted raw text lists or unorganized stock notes... (e.g., '5x Ryzen 7 7700 @ $240 each, 3x MSI RTX 4070 Super @ $780')"
                    className="app-field min-h-40 w-full resize-none p-3 text-xs sm:text-sm"
                  />
                ) : (
                  <div className="space-y-4">
                    <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.12] bg-[#101719] transition-colors hover:border-[#B9EF68]/50 hover:bg-white/[0.02]">
                      <div className="flex flex-col items-center justify-center pt-4 pb-5">
                        <Upload className="w-7 h-7 text-zinc-400 mb-2" />
                        <p className="mb-1 text-xs text-zinc-300"><span className="font-semibold text-[#83E5DF]">Click to upload</span> or drag and drop</p>
                        <p className="text-[11px] text-zinc-500">Photos of component box labels, paper receipts, invoices</p>
                      </div>
                      <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                    </label>

                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3">
                        {images.map((img, idx) => (
                          <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/[0.1]">
                            <img src={img} alt="upload" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 p-1 bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing || (activeTab === 'text' ? !textInput.trim() : images.length === 0)}
                  className="app-button app-button-primary flex items-center gap-2 px-5 disabled:opacity-50"
                >
                  {isParsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Extract Parts
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white font-display">Quick Review ({parsedItems.length} found)</h3>
                <button type="button" onClick={() => setParsedItems([])} className="text-xs text-zinc-400 hover:text-white transition-colors">Start Over</button>
              </div>
              
              <div className="divide-y divide-white/[0.07] border-y border-white/[0.08]">
                    {parsedItems.map((item, idx) => (
                      <div key={idx} className="bulk-review-row grid grid-cols-2 gap-2 py-2.5 md:grid-cols-12">
                        <label className="col-span-2 md:col-span-4"><span>Name</span>
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                            className="app-field w-full"
                          />
                        </label>
                        <label className="md:col-span-2"><span>Category</span>
                          <CustomSelect
                            value={item.category || 'Other'}
                            onChange={(value) => updateParsedItem(idx, 'category', value as ComponentCategory)}
                            options={CATEGORY_OPTIONS}
                            fitLongestOption={false}
                          />
                        </label>
                        <label className="md:col-span-1"><span>Qty</span>
                          <input
                            type="number" inputMode="decimal"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => updateParsedItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="app-field w-full font-mono"
                          />
                        </label>
                        <label className="md:col-span-2"><span>Unit Cost</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                            <input
                              type="number" inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={item.unitCost || 0}
                              onChange={(e) => updateParsedItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="app-field w-full pl-6 font-mono"
                            />
                          </div>
                        </label>
                        <label className="md:col-span-3"><span>Condition</span>
                          <CustomSelect
                            value={item.condition || 'New Open Box'}
                            onChange={(value) => updateParsedItem(idx, 'condition', value as Condition)}
                            options={CONDITION_OPTIONS}
                            fitLongestOption={false}
                          />
                        </label>
                        <label className="md:col-span-3"><span>Vendor</span>
                          <input
                            type={hideSupplierNames ? "password" : "text"}
                            autoComplete="off"
                            value={item.vendor || ''}
                            onChange={(e) => updateParsedItem(idx, 'vendor', e.target.value as Platform)}
                            className="app-field w-full"
                            placeholder={hideSupplierNames ? "••••••••" : "Vendor"}
                          />
                        </label>
                        <label className="md:col-span-3"><span>Date</span>
                          <input
                            type="date"
                            value={item.date || ''}
                            onChange={(e) => updateParsedItem(idx, 'date', e.target.value)}
                            className="app-field w-full [color-scheme:dark]"
                          />
                        </label>
                        <label className="md:col-span-3"><span>Payment</span>
                          <CustomSelect
                            value={item.paymentMethod || 'Cash'}
                            onChange={(value) => updateParsedItem(idx, 'paymentMethod', value as PaymentMethod)}
                            options={PAYMENT_OPTIONS}
                            fitLongestOption={false}
                          />
                        </label>
                        <div className="col-span-2 flex items-end justify-end md:col-span-3">
                          <button 
                            type="button"
                            onClick={() => removeParsedItem(idx)} 
                            className="app-button flex items-center gap-1.5 px-3 text-rose-300 hover:border-rose-500/35"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedItems.length > 0 && (
          <div className="flex shrink-0 justify-end gap-2.5 border-t border-white/[0.08] px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="app-button app-button-primary flex items-center gap-2 px-5"
            >
              <Save className="w-4 h-4" />
              Confirm & Save All to Stock
            </button>
          </div>
        )}
      </div>
    </BottomSheetModal>
  );
};
