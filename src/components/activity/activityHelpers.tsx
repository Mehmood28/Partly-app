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

  // Explicit transaction links are authoritative. Name matching remains only
  // for legacy records that never stored a component ID.
  const itemLower = String(itemName || '').toLowerCase().trim();
  const relatedComponentId = tx.relatedComponentId?.trim();
  const comp = relatedComponentId
    ? components.find((candidate) => candidate.id === relatedComponentId)
    : components.find((candidate) => {
        const candidateName = String(candidate.name || '').toLowerCase().trim();
        return candidateName === itemLower ||
          (candidateName && itemLower && (candidateName.includes(itemLower) || itemLower.includes(candidateName)));
      });

  const relatedPurchaseEntryId = tx.relatedPurchaseEntryId?.trim();
  const exactPurchaseEntry = relatedPurchaseEntryId
    ? comp?.purchaseHistory?.find((entry) => entry.id === relatedPurchaseEntryId)
    : undefined;
  const storedSnapshot = tx.originalPurchaseEntrySnapshot;
  const matchingSnapshot = storedSnapshot && (!relatedPurchaseEntryId || storedSnapshot.id === relatedPurchaseEntryId)
    ? storedSnapshot
    : undefined;
  const purchaseEntry = exactPurchaseEntry || matchingSnapshot;

  // Recorded detail text wins. Otherwise use only an exact batch or its stored
  // historical snapshot; never infer a batch from date, price, or position.
  if (unitPrice === 0 && purchaseEntry) {
    unitPrice = purchaseEntry.unitPrice || (purchaseEntry.totalPrice / (purchaseEntry.quantity || 1));
  }

  const category = comp?.category || 'Other';
  const tags = comp?.tags || [];
  
  const condition = purchaseEntry?.condition || '';
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
