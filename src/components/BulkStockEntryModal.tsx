import { BottomSheetModal } from './ui/BottomSheetModal';
import React, { useState } from 'react';
import { resizeImage } from '../utils/imageResizer';
import { X, Upload, FileText, Trash2, Zap, Save, RotateCcw } from 'lucide-react';
import { CATEGORIES, ComponentCategory, Condition, PaymentMethod, Platform } from '../types';
import { usePrivacy } from '../context/PrivacyContext';
import { CustomSelect } from './ui/CustomSelect';
import { useToast } from '../context/ToastContext';
import { normalizeTag, normalizeTags, SUB_CATEGORIES, getConflictingTags } from '../utils/helpers';

const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: value }));
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
  seller?: Platform;
  date?: string;
  paymentMethod?: PaymentMethod;
  healthPercent?: number;
  tags?: string[];
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
          const resized = await resizeImage(file, 900, 900, 0.75);
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

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        let errMessage = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errMessage = errData.error;
        } catch {
          const rawText = await res.text().catch(() => '');
          if (rawText.toLowerCase().includes('<!doctype') || rawText.toLowerCase().includes('<html')) {
            errMessage = 'Server is currently starting up or unavailable. Please try again in a moment.';
          }
        }
        throw new Error(errMessage);
      }
      const data: ParsedBulkStockItem[] = await res.json();
      const hasHealthMention = /(?:\bhealth\b|\b\d{1,3}%\b)/i.test(textInput);
      const enrichedData: ParsedBulkStockItem[] = (Array.isArray(data) ? data : []).map((item) => {
        const rawSeller = item.seller || (item as any).vendor;
        let cleanSeller = rawSeller ? String(rawSeller).trim() : '';
        if (cleanSeller.includes('\n')) cleanSeller = cleanSeller.split('\n')[0].trim();
        cleanSeller = cleanSeller.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
        cleanSeller = cleanSeller.replace(/^(?:Seller|Vendor)\s*:\s*/i, '').trim();
        if (cleanSeller.length > 30) {
          const firstWord = cleanSeller.split(/[\s,;|]/)[0];
          cleanSeller = firstWord.length > 1 ? firstWord : cleanSeller.slice(0, 30);
        }

        let cleanName = String(item.name || '').trim();
        if (cleanSeller && cleanName) {
          const escapedSeller = cleanSeller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleanName = cleanName.replace(new RegExp(`^${escapedSeller}\\s+`, 'i'), '').trim();
        }

        return {
          ...item,
          name: cleanName || item.name,
          seller: (cleanSeller || undefined) as Platform | undefined,
          healthPercent: (item.category === 'Storage' && hasHealthMention) ? item.healthPercent : undefined,
          tags: normalizeTags(item.tags || [], item.category),
        };
      });
      setParsedItems(enrichedData);
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

  const handleNameChange = (index: number, newName: string) => {
    setParsedItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];
      newItems[index] = {
        ...item,
        name: newName,
      };
      return newItems;
    });
  };

  const handleCategoryChange = (index: number, newCat: ComponentCategory) => {
    setParsedItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];
      const allowed = SUB_CATEGORIES[newCat] || [];
      const oldTags = item.tags || [];
      const validOldTags = oldTags.filter((t) =>
        allowed.some((a) => a.toLowerCase() === t.toLowerCase())
      );
      newItems[index] = {
        ...item,
        category: newCat,
        tags: normalizeTags(validOldTags, newCat),
        healthPercent: newCat === 'Storage' ? item.healthPercent : undefined,
      };
      return newItems;
    });
  };

  const toggleTag = (index: number, tag: string) => {
    setParsedItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];
      const currentTags = item.tags || [];
      const normalized = normalizeTag(tag);
      const exists = currentTags.some((t) => t.toLowerCase() === normalized.toLowerCase());
      let updatedTags: string[];
      if (exists) {
        updatedTags = currentTags.filter((t) => t.toLowerCase() !== normalized.toLowerCase());
      } else {
        const conflicting = getConflictingTags(tag, item.category).map((c) => c.toLowerCase());
        const filtered = currentTags.filter((t) => !conflicting.includes(t.toLowerCase()));
        updatedTags = [...filtered, normalized];
      }
      newItems[index] = {
        ...item,
        tags: normalizeTags(updatedTags, item.category),
      };
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
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-3 py-1.5 sm:px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#B9EF68]/25 bg-[#B9EF68]/10 text-[#B9EF68]">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 font-display leading-tight">Fast Bulk Stock Entry</h2>
              <p className="text-[11px] text-zinc-400 font-sans leading-none mt-0.5">Smart import via AI text parsing or receipt scanning</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`${parsedItems.length > 0 ? 'min-h-0 flex-1 overflow-y-auto space-y-1 px-3 pt-1 pb-2 sm:px-4' : 'space-y-3 px-3 py-3 sm:px-4'}`}>
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
                    className="app-field bulk-entry-text w-full resize-y p-3 text-xs sm:text-sm"
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#B9EF68]" />
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-100 font-display">
                    Quick Review <span className="text-xs font-normal text-zinc-400">({parsedItems.length} {parsedItems.length === 1 ? 'part' : 'parts'} found)</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setParsedItems([])}
                  className="app-button flex items-center justify-center gap-1.5 px-2.5 h-[28px] min-h-[28px] text-xs font-semibold text-zinc-300 hover:text-white rounded-md transition-all"
                  title="Reset and start over"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" /> Start Over
                </button>
              </div>
              
              <div className="divide-y divide-white/[0.07] border-y border-white/[0.08]">
                    {parsedItems.map((item, idx) => (
                      <div key={idx} className="bulk-review-row grid grid-cols-2 gap-x-2 gap-y-1.5 py-2 md:grid-cols-12">
                        <label className="col-span-2 md:col-span-4"><span>Name</span>
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => handleNameChange(idx, e.target.value)}
                            className="app-field w-full"
                          />
                        </label>
                        <label className="md:col-span-2"><span>Category</span>
                          <CustomSelect
                            value={item.category || 'Other'}
                            onChange={(value) => handleCategoryChange(idx, value as ComponentCategory)}
                            options={CATEGORY_OPTIONS}
                            fitLongestOption={false}
                          />
                        </label>
                        <label className="md:col-span-1"><span>Quantity</span>
                          <input
                            type="number" inputMode="decimal"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => updateParsedItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="app-field w-full font-mono"
                          />
                        </label>
                        <label className="md:col-span-2"><span>Unit Cost</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[11px] leading-none pointer-events-none font-mono">$</span>
                            <input
                              type="number" inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={item.unitCost !== undefined && item.unitCost !== null && !isNaN(item.unitCost) && item.unitCost > 0 ? item.unitCost : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateParsedItem(idx, 'unitCost', val === '' ? undefined : parseFloat(val) || 0);
                              }}
                              placeholder=""
                              className="app-field bulk-review-unit-cost w-full font-mono"
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
                        <label className="md:col-span-3"><span>Seller</span>
                          <input
                            type={hideSupplierNames ? "password" : "text"}
                            autoComplete="off"
                            value={item.seller || ''}
                            onChange={(e) => updateParsedItem(idx, 'seller', e.target.value as Platform)}
                            className="app-field w-full"
                            placeholder={hideSupplierNames ? "••••••••" : "Seller"}
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
                        {item.category === 'Storage' ? (
                          <label className="md:col-span-3"><span>Health (%)</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="100"
                              value={item.healthPercent !== undefined && item.healthPercent !== null ? item.healthPercent : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateParsedItem(idx, 'healthPercent', val === '' ? undefined : Math.min(100, Math.max(0, parseInt(val, 10) || 0)));
                              }}
                              placeholder=""
                              className="app-field w-full font-mono"
                            />
                          </label>
                        ) : (
                          <div className="hidden md:block md:col-span-3" aria-hidden="true" />
                        )}
                        <div className="col-span-2 md:col-span-12 flex items-center justify-between gap-2 pt-1">
                          {SUB_CATEGORIES[item.category] && SUB_CATEGORIES[item.category].length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              {SUB_CATEGORIES[item.category].map((tag) => {
                                const isSelected = (item.tags || []).some(
                                  (t) => t.toLowerCase() === tag.toLowerCase()
                                );
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(idx, tag)}
                                    data-active={isSelected}
                                    className={`app-chip app-subcategory-chip px-2.5 h-[26px] min-h-[26px] rounded-md transition-all text-xs font-sans font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9EF68] ${
                                      isSelected
                                        ? 'app-chip-active text-white border-[#B9EF68]'
                                        : 'text-[#b1bac4] hover:text-zinc-200'
                                    }`}
                                  >
                                    <span className={isSelected ? 'text-white' : 'text-[#b1bac4]'}>{tag}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div />
                          )}
                          <button 
                            type="button"
                            onClick={() => removeParsedItem(idx)} 
                            className="app-button app-button-danger shrink-0 flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 h-[28px] min-h-[28px] rounded-md transition-all"
                            title="Remove this item"
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
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-white/[0.08] px-3 py-2.5 sm:px-4 bg-[#0B1113]">
            <button
              type="button"
              onClick={handleClose}
              className="app-button flex items-center justify-center px-4 h-[36px] min-h-[36px] rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="app-button app-button-primary flex items-center justify-center gap-2 px-5 h-[36px] min-h-[36px] rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
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
