import { BottomSheetModal } from './ui/BottomSheetModal';
import React, { useState } from 'react';
import { resizeImage } from '../utils/imageResizer';
import { X, Upload, FileText, Trash2, Zap, Save } from 'lucide-react';
import { ComponentCategory, Condition, PaymentMethod, Platform } from '../types';
import { usePrivacy } from '../context/PrivacyContext';

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
      alert('Parsing failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
    <BottomSheetModal isOpen={isOpen} onClose={handleClose} className="max-w-4xl">
      <div className="w-full flex flex-col relative h-full">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#A3FF12]/15 border border-[#A3FF12]/30 text-[#A3FF12] flex items-center justify-center">
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
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {parsedItems.length === 0 ? (
            <>
              {/* Mode Selection */}
              <div className="flex p-1 bg-[#121722] rounded-xl w-full max-w-sm border border-white/[0.08] mx-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
                    activeTab === 'text' ? 'bg-[#A3FF12] text-white shadow-md shadow-[#A3FF12]/20 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> AI RAW TEXT
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
                    activeTab === 'image' ? 'bg-[#A3FF12] text-white shadow-md shadow-[#A3FF12]/20 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> BATCH SCANNER
                </button>
              </div>

              {/* Input Area */}
              <div className="bg-[#121722] border border-white/[0.08] rounded-xl p-4">
                {activeTab === 'text' ? (
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste unformatted raw text lists or unorganized stock notes... (e.g., '5x Ryzen 7 7700 @ $240 each, 3x MSI RTX 4070 Super @ $780')"
                    className="w-full h-44 bg-transparent text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none font-sans"
                  />
                ) : (
                  <div className="space-y-4">
                    <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-white/[0.1] border-dashed rounded-xl cursor-pointer hover:bg-white/[0.02] hover:border-[#A3FF12]/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-4 pb-5">
                        <Upload className="w-7 h-7 text-zinc-400 mb-2" />
                        <p className="mb-1 text-xs text-zinc-300"><span className="font-semibold text-[#67E8F9]">Click to upload</span> or drag and drop</p>
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
                  className="bg-[#A3FF12] hover:bg-[#C2FF5C] disabled:opacity-50 text-white font-semibold shadow-md shadow-[#A3FF12]/20 px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
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
              
              <div className="bg-[#121722] border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[1100px]">
                  <thead className="bg-[#0D1118] text-zinc-400 border-b border-white/[0.08]">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium min-w-[180px]">Name</th>
                      <th className="px-3.5 py-2.5 font-medium w-36">Category</th>
                      <th className="px-3.5 py-2.5 font-medium w-20">Qty</th>
                      <th className="px-3.5 py-2.5 font-medium w-28">Unit Cost</th>
                      <th className="px-3.5 py-2.5 font-medium w-36">Condition</th>
                      <th className="px-3.5 py-2.5 font-medium w-28">Vendor</th>
                      <th className="px-3.5 py-2.5 font-medium w-28">Date</th>
                      <th className="px-3.5 py-2.5 font-medium w-28">Payment</th>
                      <th className="px-3.5 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2">
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                            className="w-full min-w-[180px] bg-transparent border border-transparent hover:border-white/[0.1] focus:border-[#A3FF12] rounded-lg px-2 py-1 text-zinc-100 outline-none"
                          />
                        </td>
                        <td className="px-3.5 py-2">
                          <select
                            value={item.category || 'Other'}
                            onChange={(e) => updateParsedItem(idx, 'category', e.target.value as ComponentCategory)}
                            className="w-full min-w-[110px] bg-[#0D1118] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200 outline-none focus:border-[#A3FF12]"
                          >
                            {['GPU', 'CPU', 'RAM', 'Storage', 'Motherboard', 'PSU', 'Case', 'Cooling', 'Fans', 'Accessories', 'Other'].map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3.5 py-2">
                          <input
                            type="number" inputMode="decimal"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => updateParsedItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full min-w-[50px] bg-transparent border border-transparent hover:border-white/[0.1] focus:border-[#A3FF12] rounded-lg px-2 py-1 text-zinc-100 font-mono outline-none"
                          />
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none font-mono">$</span>
                            <input
                              type="number" inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={item.unitCost || 0}
                              onChange={(e) => updateParsedItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="w-full min-w-[70px] bg-transparent border border-transparent hover:border-white/[0.1] focus:border-[#A3FF12] rounded-lg pr-2 py-1 text-zinc-100 font-mono outline-none pl-6"
                            />
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <select
                            value={item.condition || 'New Open Box'}
                            onChange={(e) => updateParsedItem(idx, 'condition', e.target.value as Condition)}
                            className="w-full min-w-[120px] bg-[#0D1118] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200 outline-none focus:border-[#A3FF12]"
                          >
                            <option value="Sealed">Sealed</option>
                            <option value="New Open Box">New Open Box</option>
                            <option value="New No Box">New No Box</option>
                            <option value="Used Open Box">Used Open Box</option>
                            <option value="Used No Box">Used No Box</option>
                          </select>
                        </td>
                        <td className="px-3.5 py-2">
                          <input
                            type={hideSupplierNames ? "password" : "text"}
                            autoComplete="off"
                            value={item.vendor || ''}
                            onChange={(e) => updateParsedItem(idx, 'vendor', e.target.value as Platform)}
                            className="w-full min-w-[90px] bg-transparent border border-transparent hover:border-white/[0.1] focus:border-[#A3FF12] rounded-lg px-2 py-1 text-zinc-100 outline-none"
                            placeholder={hideSupplierNames ? "••••••••" : "Vendor"}
                          />
                        </td>
                        <td className="px-3.5 py-2">
                          <input
                            type="date"
                            value={item.date || ''}
                            onChange={(e) => updateParsedItem(idx, 'date', e.target.value)}
                            className="w-full min-w-[110px] bg-transparent border border-transparent hover:border-white/[0.1] focus:border-[#A3FF12] rounded-lg px-2 py-1 text-zinc-100 outline-none [color-scheme:dark]"
                          />
                        </td>
                        <td className="px-3.5 py-2">
                          <select
                            value={item.paymentMethod || 'Cash'}
                            onChange={(e) => updateParsedItem(idx, 'paymentMethod', e.target.value as PaymentMethod)}
                            className="w-full min-w-[100px] bg-[#0D1118] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200 outline-none focus:border-[#A3FF12]"
                          >
                            <option value="Cash">Cash</option>
                            <option value="E-Transfer">E-Transfer</option>
                            <option value="PayPal">PayPal</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button 
                            type="button"
                            onClick={() => removeParsedItem(idx)} 
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedItems.length > 0 && (
          <div className="pt-4 border-t border-white/[0.08] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
