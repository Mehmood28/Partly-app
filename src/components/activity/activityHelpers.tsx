import { InventoryComponent, TransactionLogItem } from '../../types';
import { autoTagComponent } from '../../utils/helpers';

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

export function inferCategory(name: string): string {
  const text = (name || '').toLowerCase();
  if (/ddr[345]|6000mhz|5600mhz|5200mhz|3200mhz|3600mhz|cl30|cl36|cl16|\bram\b|t-force|trident|vengeance|fury\s+beast|ripjaws|dominator/i.test(text)) return 'RAM';
  if (/nvme|ssd|m\.2|sn850|sn770|sn580|sn560|980\s*pro|990\s*pro|p3\s*plus|legend\s*\d+|gen[345]/i.test(text)) return 'Storage';
  if (/aio|liquid\s*cooler|360mm|240mm|280mm|deepcool\s*lq|hydroshift|kraken|galahad|liquid\s*freezer/i.test(text)) return 'Cooling';
  if (/rtx\s*\d+|rx\s*\d+|geforce|radeon|gpu|graphics\s*card/i.test(text)) return 'GPU';
  if (/ryzen|intel|core\s*i[3579]|ultra\s*[579]|cpu|processor/i.test(text)) return 'CPU';
  if (/b650|z790|b760|x670|x870|b850|b550|b450|z690|motherboard|mobo/i.test(text)) return 'Motherboard';
  if (/psu|power\s*supply|\b\d{3,4}w\b|atx\s*3\.\d|gold\s*psu|sfx/i.test(text)) return 'PSU';
  if (/case|chassis|ch160|o11|h9|h6|4000d|pop\s*air|lancool/i.test(text)) return 'Case';
  return 'Other';
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

  // Explicit transaction links are authoritative for single-item records.
  const isMultiItemTx = !!(tx.detailsList && tx.detailsList.length > 1);
  const itemLower = String(itemName || '').toLowerCase().trim();
  const relatedComponentId = !isMultiItemTx ? tx.relatedComponentId?.trim() : undefined;
  const relatedPurchaseEntryId = !isMultiItemTx ? tx.relatedPurchaseEntryId?.trim() : undefined;
  
  let comp: InventoryComponent | undefined = relatedComponentId
    ? components.find((candidate) => candidate.id === relatedComponentId)
    : undefined;

  if (!comp) {
    // 1. Exact or substring match
    comp = components.find((candidate) => {
      const candidateName = String(candidate.name || '').toLowerCase().trim();
      return candidateName === itemLower ||
        (candidateName && itemLower && (candidateName.includes(itemLower) || itemLower.includes(candidateName)));
    });
  }

  if (!comp) {
    // 2. Token-overlap match
    const itemTokens = itemLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
    let bestMatch: InventoryComponent | undefined;
    let maxScore = 0;

    for (const candidate of components) {
      const candidateTokens = new Set(
        String(candidate.name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((t) => t.length > 1)
      );
      let score = 0;
      for (const token of itemTokens) {
        if (candidateTokens.has(token)) score++;
      }
      if (score >= 2 && score > maxScore && (score / itemTokens.length >= 0.4 || score >= 3)) {
        maxScore = score;
        bestMatch = candidate;
      }
    }
    comp = bestMatch;
  }

  const exactPurchaseEntry = relatedComponentId && relatedPurchaseEntryId
    ? comp?.purchaseHistory?.find((entry) => entry.id === relatedPurchaseEntryId)
    : undefined;
  const storedSnapshot = tx.originalPurchaseEntrySnapshot;
  const matchingSnapshot = storedSnapshot && (!relatedPurchaseEntryId || storedSnapshot.id === relatedPurchaseEntryId)
    ? storedSnapshot
    : undefined;
  
  // Intelligent batch matching if explicit link is missing
  let fallbackBatch = exactPurchaseEntry || matchingSnapshot;
  if (!fallbackBatch && comp?.purchaseHistory && comp.purchaseHistory.length > 0) {
    // Try matching by date or platform or unit price
    const txDate = tx.dateSortable || tx.timestamp;
    const dateMatch = comp.purchaseHistory.find((entry) => entry.date === txDate || entry.platform === tx.platform);
    if (dateMatch) {
      fallbackBatch = dateMatch;
    } else {
      // If all batches share the same condition, use it
      const uniqueConditions = [...new Set(comp.purchaseHistory.map((e) => e.condition).filter(Boolean))];
      if (uniqueConditions.length === 1) {
        fallbackBatch = comp.purchaseHistory[0];
      } else if (comp.purchaseHistory.length === 1) {
        fallbackBatch = comp.purchaseHistory[0];
      }
    }
  }

  const purchaseEntry = fallbackBatch;

  // Recorded detail text wins. Otherwise use only an exact batch or its stored
  // historical snapshot; never infer a batch from date, price, or position.
  if (unitPrice === 0 && purchaseEntry) {
    unitPrice = purchaseEntry.unitPrice || (purchaseEntry.totalPrice / (purchaseEntry.quantity || 1));
  }

  let category = comp?.category || inferCategory(itemName);
  if (category === 'Other') {
    category = inferCategory(itemName);
  }

  let tags = comp?.tags || [];
  if (!tags || tags.length === 0) {
    tags = autoTagComponent(itemName, '', category);
  }
  
  let condition = purchaseEntry?.condition || '';
  if (!condition && comp?.purchaseHistory && comp.purchaseHistory.length > 0) {
    const uniqueConditions = [...new Set(comp.purchaseHistory.map((e) => e.condition).filter(Boolean))];
    if (uniqueConditions.length === 1) {
      condition = uniqueConditions[0];
    }
  }

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
