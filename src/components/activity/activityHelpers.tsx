import { InventoryComponent, TransactionLogItem } from '../../types';

export interface ParsedBatchItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
  tags: string[];
  condition: string;
  platform: string;
  paymentMethod: string;
  comp?: InventoryComponent;
}

export const parseBatchItem = (
  detailStr: string, 
  components: InventoryComponent[], 
  tx: TransactionLogItem
): ParsedBatchItem => {
  const match = detailStr.match(/^(?:(\d+)x\s+)?(.*?)(?:\s+\(\$([\d\.,]+)(?:\/ea)?\))?$/i);
  
  let quantity = 1;
  let itemName = detailStr;
  let unitPrice = 0;

  if (match) {
    quantity = match[1] ? parseInt(match[1], 10) : 1;
    itemName = match[2] ? match[2].trim() : detailStr;
    unitPrice = match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
  }

  // Find matched component in inventory
  const itemLower = String(itemName || '').toLowerCase().trim();
  const comp = components.find(c => {
    const cNameLower = String(c.name || '').toLowerCase().trim();
    return cNameLower === itemLower ||
      (cNameLower && itemLower && (cNameLower.includes(itemLower) || itemLower.includes(cNameLower)));
  });

  // If unitPrice not in detail string, get from component purchase history
  if (unitPrice === 0 && comp && comp.purchaseHistory && comp.purchaseHistory.length > 0) {
    const ph = comp.purchaseHistory.find(p => p.date === tx.dateSortable || p.date === tx.timestamp) || comp.purchaseHistory[0];
    if (ph) {
      unitPrice = ph.unitPrice || (ph.totalPrice / (ph.quantity || 1));
    }
  }

  const category = comp?.category || 'Other';
  const tags = comp?.tags || [];
  
  // Find purchase entry for condition, platform, etc.
  const purchaseEntry = comp?.purchaseHistory?.find(p =>
    (p.date === tx.dateSortable || p.date === tx.timestamp) && (unitPrice === 0 || Math.abs((p.unitPrice || 0) - unitPrice) < 1)
  ) || comp?.purchaseHistory?.find(p =>
    unitPrice > 0 && Math.abs((p.unitPrice || 0) - unitPrice) < 1
  ) || comp?.purchaseHistory?.[0];

  const condition = purchaseEntry?.condition || (comp?.purchaseHistory?.[0]?.condition) || '';
  const itemPlatform = purchaseEntry?.platform || tx.platform || '';
  const itemPaymentMethod = purchaseEntry?.paymentMethod || tx.paymentMethod || '';
  const totalPrice = unitPrice > 0 ? unitPrice * quantity : 0;

  return {
    itemName,
    quantity,
    unitPrice,
    totalPrice,
    category,
    tags,
    condition,
    platform: itemPlatform,
    paymentMethod: itemPaymentMethod,
    comp
  };
};
