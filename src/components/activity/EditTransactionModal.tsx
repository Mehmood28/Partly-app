import React, { useState, useEffect, useRef } from 'react';
import { TransactionLogItem, Condition, PaymentMethod, PurchaseLineItem, ComponentCategory } from '../../types';
import { X, Pencil, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useToast } from '../../context/ToastContext';
import { prepareTransactionEdit } from './transactionEditParsers';
import { getCleanTransactionTitle } from './activityHelpers';
import { CustomSelect } from '../ui/CustomSelect';
import { roundToCents, formatCurrency } from '../../utils/helpers';
import { resolvePurchaseLineItems } from '../../utils/purchaseSync';

interface EditTransactionModalProps {
  tx: TransactionLogItem | null;
  isOpen?: boolean;
  onClose: () => void;
}

interface EditablePurchaseItem {
  id?: string;
  componentId?: string;
  purchaseEntryId?: string;
  name: string;
  specifications: string;
  category?: ComponentCategory;
  condition: Condition;
  seller: string;
  paymentMethod: PaymentMethod;
  quantity: number;
  unitPrice: number;
  unitPriceStr: string;
  subtotal: number;
  healthPercent?: number;
}

const CONDITION_OPTIONS = [
  'Sealed',
  'New Open Box',
  'New No Box',
  'Used Open Box',
  'Used No Box',
  'Used',
].map((v) => ({ value: v, label: v }));

const PAYMENT_OPTIONS = [
  'Cash',
  'E-Transfer',
  'Credit Card',
  'PayPal',
  'Debit',
  'Crypto',
  'Trade-In',
].map((v) => ({ value: v, label: v }));

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ tx, isOpen = true, onClose }) => {
  const { state, updateTransaction } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const isPurchase = tx?.type === 'PURCHASE';
  const isMasked = !!(isPurchase && hideSupplierNames);
  const hasStoredUnitCost = tx?.type === 'SALE' && tx?.soldUnitCost !== undefined;
  const totalUnitCost = hasStoredUnitCost && tx ? (tx.soldUnitCost ?? 0) * (tx.quantity || 1) : 0;

  const [editTitle, setEditTitle] = useState<string>('');
  const [editItemSummary, setEditItemSummary] = useState<string>('');
  const [titleEdited, setTitleEdited] = useState<boolean>(false);
  const [summaryEdited, setSummaryEdited] = useState<boolean>(false);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editProfit, setEditProfit] = useState<string>('');
  const [editSeller, setEditSeller] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editItems, setEditItems] = useState<EditablePurchaseItem[]>([]);
  const initialItemsRef = useRef<Array<{ name: string; quantity: number; unitPrice: number }>>([]);

  const handleAmountChange = (val: string) => {
    setEditAmount(val);
    if (hasStoredUnitCost) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        setEditProfit(String(roundToCents(parsed - totalUnitCost)));
      } else {
        setEditProfit('');
      }
    }
    const parsedAmount = parseFloat(val);
    if (editItems.length > 0 && !isNaN(parsedAmount) && parsedAmount >= 0) {
      const baseline = initialItemsRef.current.length === editItems.length
        ? initialItemsRef.current
        : editItems;
      const baseSum = baseline.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);

      if (baseSum > 0) {
        const ratio = parsedAmount / baseSum;
        setEditItems((prev) =>
          prev.map((it, idx) => {
            const baseItem = baseline[idx] || it;
            const newUnitPrice = roundToCents(baseItem.unitPrice * ratio);
            const newSubtotal = roundToCents(it.quantity * newUnitPrice);
            return {
              ...it,
              unitPrice: newUnitPrice,
              unitPriceStr: String(newUnitPrice),
              subtotal: newSubtotal,
            };
          })
        );
      }
    }
  };

  const handleTopLevelSellerChange = (val: string) => {
    setEditSeller(val);
    setEditItems((prev) =>
      prev.map((it) => ({
        ...it,
        seller: val,
      }))
    );
  };

  const handleTopLevelPaymentChange = (val: string) => {
    setEditPaymentMethod(val);
    setEditItems((prev) =>
      prev.map((it) => ({
        ...it,
        paymentMethod: val as PaymentMethod,
      }))
    );
  };

  const handleItemNameChange = (index: number, newName: string) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: newName };
      return updated;
    });
  };

  const handleItemSpecsChange = (index: number, newSpecs: string) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], specifications: newSpecs };
      return updated;
    });
  };

  const handleItemConditionChange = (index: number, newCondition: Condition) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], condition: newCondition };
      return updated;
    });
  };

  const handleItemSellerChange = (index: number, newSeller: string) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], seller: newSeller };
      const nonEmpties = updated.map((it) => it.seller.trim()).filter(Boolean);
      const unique = [...new Set(nonEmpties.map((s) => s.toLowerCase()))];
      if (unique.length === 1) {
        setEditSeller(nonEmpties[0]);
      } else if (unique.length > 1) {
        setEditSeller('MIXED');
      }
      return updated;
    });
  };

  const handleItemPaymentChange = (index: number, newPayment: PaymentMethod) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], paymentMethod: newPayment };
      const nonEmpties = updated.map((it) => it.paymentMethod.trim()).filter(Boolean);
      const unique = [...new Set(nonEmpties)];
      if (unique.length === 1) {
        setEditPaymentMethod(nonEmpties[0]);
      } else if (unique.length > 1) {
        setEditPaymentMethod('MIXED');
      }
      return updated;
    });
  };

  const handleItemQuantityChange = (index: number, newQtyStr: string) => {
    const parsedQty = parseInt(newQtyStr, 10);
    const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;

    setEditItems((prev) => {
      const updated = prev.map((item, i) => {
        if (i !== index) return item;
        const sub = roundToCents(validQty * item.unitPrice);
        return {
          ...item,
          quantity: validQty,
          subtotal: sub,
        };
      });

      if (initialItemsRef.current[index]) {
        initialItemsRef.current[index].quantity = validQty;
      }

      const newTotal = updated.reduce((sum, it) => sum + it.subtotal, 0);
      setEditAmount(String(roundToCents(newTotal)));
      return updated;
    });
  };

  const handleItemPriceChange = (index: number, val: string) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;

    setEditItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.unitPriceStr = cleanVal;
      const num = parseFloat(cleanVal);
      item.unitPrice = !isNaN(num) && num >= 0 ? num : 0;
      item.subtotal = roundToCents(item.quantity * item.unitPrice);
      updated[index] = item;

      initialItemsRef.current = updated.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));

      const newTotal = updated.reduce((sum, it) => sum + it.subtotal, 0);
      setEditAmount(String(roundToCents(newTotal)));
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      initialItemsRef.current = updated.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));
      const newTotal = updated.reduce((sum, it) => sum + it.subtotal, 0);
      setEditAmount(String(roundToCents(newTotal)));
      return updated;
    });
  };

  const getMaskedTitle = (rawTitle: string, seller?: string) => {
    let t = rawTitle;
    if (seller) {
      const escaped = seller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t
        .replace(new RegExp(`^Bulk Purchase:\\s*${escaped}$`, 'i'), 'Bulk Purchase')
        .replace(new RegExp(`^Purchased:\\s*${escaped}$`, 'i'), 'Purchased')
        .replace(new RegExp(`\\s+from\\s+${escaped}$`, 'i'), '');
    }
    return t
      .replace(/^Bulk Purchase:\s*.+$/i, 'Bulk Purchase')
      .replace(/^Purchased:\s*.+$/i, 'Purchased')
      .trim();
  };

  const getMaskedSummary = (rawSummary: string, seller?: string) => {
    let s = rawSummary;
    if (seller) {
      const escaped = seller.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s
        .replace(new RegExp(`^Bulk Purchase:\\s*${escaped}$`, 'i'), 'Bulk Purchase')
        .replace(new RegExp(`^Purchased:\\s*${escaped}$`, 'i'), 'Purchased')
        .replace(new RegExp(`\\s+from\\s+${escaped}$`, 'i'), '');
    }
    return s
      .replace(/^Bulk Purchase:\s*.+$/i, 'Bulk Purchase')
      .replace(/^Purchased:\s*.+$/i, 'Purchased')
      .replace(/^(Bulk added\s+\d+\s+items?)\s+from\s+.+$/i, '$1')
      .trim();
  };

  useEffect(() => {
    if (tx) {
      const cleanTitle = getCleanTransactionTitle(tx, state.components, state.builds);
      setEditTitle(cleanTitle || tx.title || '');
      setEditItemSummary(tx.itemNameOrSummary || '');
      setTitleEdited(false);
      setSummaryEdited(false);
      const cleanAmount = roundToCents(tx.totalAmount ?? 0);
      setEditAmount(cleanAmount ? String(cleanAmount) : '0');
      if (tx.type === 'SALE' && tx.soldUnitCost !== undefined) {
        const costBasis = (tx.soldUnitCost ?? 0) * (tx.quantity || 1);
        const derivedProfit = (tx.totalAmount ?? 0) - costBasis;
        setEditProfit(String(roundToCents(derivedProfit)));
      } else {
        setEditProfit(tx.profitMargin !== undefined ? String(roundToCents(tx.profitMargin)) : '');
      }
      setEditSeller(tx.seller || tx.platform || '');
      setEditPaymentMethod(tx.paymentMethod || 'Cash');
      setEditDate(tx.dateSortable || '');

      if (tx.type === 'PURCHASE') {
        const resolvedLineItems = resolvePurchaseLineItems(tx, state.components);
        const rawSum = resolvedLineItems.reduce((s, it) => s + ((it.quantity || 1) * it.unitPrice), 0);
        const currentTotal = typeof tx.totalAmount === 'number' && tx.totalAmount > 0 ? tx.totalAmount : rawSum;
        const ratio = rawSum > 0 ? currentTotal / rawSum : 1;

        const items: EditablePurchaseItem[] = resolvedLineItems.map((it) => {
          const q = it.quantity || 1;
          const u = (rawSum > 0 && Math.abs(rawSum - currentTotal) >= 0.02) ? roundToCents(it.unitPrice * ratio) : it.unitPrice;
          const sub = roundToCents(q * u);
          return {
            id: it.id,
            componentId: it.componentId,
            purchaseEntryId: it.purchaseEntryId,
            name: it.name,
            specifications: it.specifications || '',
            category: it.category,
            condition: it.condition || 'New Open Box',
            seller: it.seller || tx.seller || tx.platform || '',
            paymentMethod: it.paymentMethod || (tx.paymentMethod as PaymentMethod) || 'Cash',
            quantity: q,
            unitPrice: u,
            unitPriceStr: String(u),
            subtotal: sub,
            healthPercent: it.healthPercent,
          };
        });
        setEditItems(items);
        initialItemsRef.current = items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }));
      } else {
        setEditItems([]);
        initialItemsRef.current = [];
      }
    }
  }, [tx, state.components, state.builds]);

  if (!tx) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInitialTitle = getCleanTransactionTitle(tx, state.components, state.builds);

    const updatedLineItems: PurchaseLineItem[] = editItems.map((it) => ({
      id: it.id,
      componentId: it.componentId,
      purchaseEntryId: it.purchaseEntryId,
      name: it.name.trim(),
      specifications: it.specifications.trim(),
      category: it.category,
      condition: it.condition,
      seller: it.seller.trim(),
      platform: it.seller.trim(),
      paymentMethod: it.paymentMethod,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.subtotal,
      healthPercent: it.healthPercent,
    }));

    const updatedDetailsList = updatedLineItems.length > 0
      ? updatedLineItems.map((it) => `${it.quantity}x ${it.name} (${formatCurrency(it.unitPrice)}/ea)`)
      : undefined;

    const totalCalculatedQty = updatedLineItems.length > 0
      ? updatedLineItems.reduce((sum, it) => sum + (it.quantity || 1), 0)
      : undefined;

    const totalCalculatedAmount = updatedLineItems.length > 0
      ? roundToCents(updatedLineItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0))
      : undefined;

    // Recalculate rollup seller and payment
    const sellers = updatedLineItems.map((it) => it.seller.trim()).filter(Boolean);
    const uniqueSellers = [...new Set(sellers.map((s) => s.toLowerCase()))];
    let finalSeller = editSeller.trim();
    if (uniqueSellers.length === 1) {
      finalSeller = sellers[0];
    } else if (uniqueSellers.length > 1) {
      finalSeller = 'MIXED';
    }

    const payments = updatedLineItems.map((it) => it.paymentMethod.trim()).filter(Boolean);
    const uniquePayments = [...new Set(payments)];
    let finalPayment = editPaymentMethod;
    if (uniquePayments.length === 1) {
      finalPayment = uniquePayments[0];
    } else if (uniquePayments.length > 1) {
      finalPayment = 'MIXED';
    }

    let dynamicPurchaseTitle: string | undefined;
    if (tx.type === 'PURCHASE' && updatedLineItems.length > 0) {
      if (updatedLineItems.length === 1) {
        const singleName = updatedLineItems[0].name.replace(/^\d+x\s+/i, '');
        dynamicPurchaseTitle = (totalCalculatedQty || 1) > 1
          ? `Purchased ${totalCalculatedQty}x ${singleName}`
          : `Purchased ${singleName}`;
      } else {
        if (finalSeller && finalSeller !== 'MIXED') {
          dynamicPurchaseTitle = `Bulk Purchase: ${finalSeller}`;
        } else if (finalSeller === 'MIXED') {
          dynamicPurchaseTitle = `Bulk Purchase: MIXED`;
        } else {
          dynamicPurchaseTitle = `Bulk Purchase`;
        }
      }
    }

    const finalTitle = isMasked && !titleEdited
      ? (dynamicPurchaseTitle || cleanInitialTitle || tx.title)
      : !titleEdited && dynamicPurchaseTitle
      ? dynamicPurchaseTitle
      : editTitle.trim();

    let finalSummary = editItemSummary.trim();
    if (!summaryEdited) {
      if (updatedLineItems.length === 1) {
        finalSummary = updatedLineItems[0].name;
      } else if (updatedLineItems.length > 1) {
        finalSummary = `Purchased Mixed Parts (${totalCalculatedQty} ${totalCalculatedQty === 1 ? 'Part' : 'Parts'})`;
      }
    }

    const overrideTitle = titleEdited
      ? finalTitle
      : summaryEdited
      ? finalSummary
      : undefined;

    let finalProfit = editProfit;
    if (hasStoredUnitCost) {
      const parsedAmount = parseFloat(editAmount);
      if (!isNaN(parsedAmount)) {
        finalProfit = (parsedAmount - totalUnitCost).toFixed(2);
      }
    }

    const prepared = prepareTransactionEdit({
      type: tx.type,
      title: finalTitle,
      customTitleOverride: overrideTitle,
      itemNameOrSummary: finalSummary,
      totalAmount: totalCalculatedAmount !== undefined ? String(totalCalculatedAmount) : editAmount,
      quantity: totalCalculatedQty,
      profitMargin: finalProfit,
      seller: finalSeller,
      platform: finalSeller,
      paymentMethod: finalPayment,
      dateSortable: editDate,
      detailsList: updatedDetailsList,
      purchaseLineItems: updatedLineItems,
    });

    if (!prepared.success) {
      showToast('error' in prepared ? prepared.error : 'Invalid transaction values.', 'error');
      return;
    }

    const result = updateTransaction(tx.id, prepared.value);
    if (!result.success) {
      showToast(result.error || 'Failed to update transaction.', 'error');
      return;
    }

    onClose();
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      layout="content"
      className="stock-modal max-w-xl"
    >
      <div className="transaction-edit-modal w-full space-y-3.5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#B9EF68]" /> Edit Transaction Record
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-zinc-400 hover:text-white rounded-lg p-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
          <div className="space-y-2.5">
            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Record Title / Type</label>
              <input
                type="text"
                required
                readOnly={isMasked}
                value={isMasked && !titleEdited ? getMaskedTitle(editTitle, editSeller) : editTitle}
                onChange={(e) => {
                  if (isMasked) return;
                  setTitleEdited(true);
                  setEditTitle(e.target.value);
                }}
                className={`app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans ${isMasked ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder={isMasked ? "e.g. Purchased" : "e.g. Purchased: Facebook Marketplace"}
              />
            </div>

            <div>
              <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Item / Summary</label>
              <input
                type="text"
                required
                readOnly={isMasked}
                value={isMasked && !summaryEdited ? getMaskedSummary(editItemSummary, editSeller) : editItemSummary}
                onChange={(e) => {
                  if (isMasked) return;
                  setSummaryEdited(true);
                  setEditItemSummary(e.target.value);
                }}
                className={`app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans ${isMasked ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="e.g. RTX 4070 Super 12GB"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Total Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    value={editAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono"
                  />
                </div>
              </div>

              {tx.type === 'SALE' && (
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">
                    Net Profit ($)
                    {hasStoredUnitCost && (
                      <span className="ml-1 text-[10px] text-zinc-400 font-normal">
                        (Cost: ${totalUnitCost.toFixed(2)})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      required
                      readOnly={hasStoredUnitCost}
                      value={editProfit}
                      onChange={(e) => setEditProfit(e.target.value)}
                      className={`app-field h-9 min-h-9 pl-7 pr-3 text-xs placeholder:text-zinc-500 font-mono ${
                        hasStoredUnitCost ? 'opacity-80 bg-white/[0.03] cursor-not-allowed' : ''
                      }`}
                      placeholder="e.g. 150.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Seller</label>
                <input
                  type={isMasked ? "password" : "text"}
                  autoComplete="off"
                  value={editSeller}
                  onChange={(e) => handleTopLevelSellerChange(e.target.value)}
                  className="app-field h-9 min-h-9 px-3 text-xs placeholder:text-zinc-500 font-sans"
                  placeholder={isMasked ? "••••••••" : "e.g. Memory Express / Amazon / Harsh"}
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium text-xs font-sans">Payment Method</label>
                <CustomSelect
                  value={editPaymentMethod}
                  onChange={(val) => handleTopLevelPaymentChange(val)}
                  options={(() => {
                    const baseOpts = ['Cash', 'E-Transfer', 'Credit Card', 'PayPal', 'Trade-In'];
                    const opts = editPaymentMethod && !baseOpts.includes(editPaymentMethod)
                      ? [...baseOpts, editPaymentMethod]
                      : baseOpts;
                    return opts.map(pm => ({ value: pm, label: pm }));
                  })()}
                />
              </div>
            </div>
          </div>

          {editItems.length > 0 && (
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between shrink-0">
                <label className="text-zinc-200 font-medium text-xs font-sans">
                  {editItems.length === 1 ? 'Purchased Part Line Item' : `Purchased Part Line Items (${editItems.length})`}
                </label>
                <span className="text-[10.5px] text-zinc-400 font-mono">
                  Edit model, specs, condition, seller, payment, qty & price
                </span>
              </div>
              <div
                className="overflow-y-auto pr-1 flex flex-col max-h-72 sm:max-h-80 gap-2.5"
              >
                {editItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="bg-[#101719] p-2.5 rounded-lg border border-white/[0.08] space-y-2 hover:border-white/[0.12] transition-colors"
                  >
                    {/* Row 1: Part Name & Remove button */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Part Model / Name</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleItemNameChange(idx, e.target.value)}
                          placeholder="e.g. Gigabyte GP-UD750GM 80P Black"
                          className="app-field h-7 px-2 text-xs font-semibold text-zinc-100 font-sans w-full"
                        />
                      </div>
                      {editItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label={`Remove ${item.name}`}
                          className="text-zinc-500 hover:text-rose-400 p-1.5 rounded transition-colors shrink-0 mt-3"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Row 2: Specifications & Condition */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Specifications</label>
                        <input
                          type="text"
                          value={item.specifications}
                          onChange={(e) => handleItemSpecsChange(idx, e.target.value)}
                          placeholder="e.g. 750W 80+ Gold / Black"
                          className="app-field h-7 px-2 text-[11px] placeholder:text-zinc-600 font-sans w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Condition</label>
                        <CustomSelect
                          value={item.condition}
                          onChange={(val) => handleItemConditionChange(idx, val as Condition)}
                          options={CONDITION_OPTIONS}
                        />
                      </div>
                    </div>

                    {/* Row 3: Seller & Payment Method */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Seller</label>
                        <input
                          type={isMasked ? "password" : "text"}
                          autoComplete="off"
                          value={item.seller}
                          onChange={(e) => handleItemSellerChange(idx, e.target.value)}
                          placeholder={isMasked ? "••••••••" : "Seller (e.g. Harsh)"}
                          className="app-field h-7 px-2 text-[11px] placeholder:text-zinc-600 font-sans w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Payment Method</label>
                        <CustomSelect
                          value={item.paymentMethod}
                          onChange={(val) => handleItemPaymentChange(idx, val as PaymentMethod)}
                          options={PAYMENT_OPTIONS}
                        />
                      </div>
                    </div>

                    {/* Row 4: Qty, Unit Price, Subtotal */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-medium text-zinc-400 font-sans">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                          className="w-12 h-6 px-1 text-[11px] font-mono font-bold bg-[#0c1214] border border-white/[0.12] rounded text-zinc-100 text-center focus:outline-none focus:border-[#83E5DF]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-medium text-zinc-400 font-sans">Unit Price:</span>
                        <div className="relative flex items-center">
                          <span className="absolute left-1.5 text-zinc-500 text-[10px] font-mono pointer-events-none select-none">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unitPriceStr}
                            onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                            className="w-20 h-6 pl-4 pr-1.5 text-[11px] font-mono font-bold bg-[#0c1214] border border-white/[0.12] rounded text-zinc-100 text-left focus:outline-none focus:border-[#83E5DF]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
                        <span className="text-[11px] font-medium text-zinc-400 font-sans">Total:</span>
                        <span className="font-bold text-zinc-100 font-mono text-xs">${item.subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-white/[0.08] pt-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold text-xs shadow-sm shadow-[#B9EF68]/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </BottomSheetModal>
  );
};
