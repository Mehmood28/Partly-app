import { AppState, ComponentCategory, TransactionLogItem, InventoryComponent, PurchaseEntry, PCBuild } from '../../types';
import { autoTagComponent } from '../../utils/helpers';
import { classifyTransaction } from '../../utils/transactionClassification';

const inferCategory = (name: string): ComponentCategory => {
  const n = (name || '').toLowerCase();
  if (/rtx|gtx|radeon|rx\s*\d|geforce|graphics|gpu|arc\s*a/i.test(n)) return 'GPU';
  if (/ryzen|intel|core\s*i[3579]|cpu|processor|threadripper/i.test(n)) return 'CPU';
  if (/ddr[45]|ram|memory|vengeance|trident|fury/i.test(n)) return 'RAM';
  if (/ssd|nvme|m\.2|hard\s*drive|hdd|sata|evo|sn\d{3}|barracuda/i.test(n)) return 'Storage';
  if (/motherboard|b650|b550|z790|z690|x670|am4|am5|lga/i.test(n)) return 'Motherboard';
  if (/psu|power\s*supply|gold|bronze|platinum|watt|w\b|corsair\s*rm/i.test(n)) return 'PSU';
  if (/cooler|aio|liquid|fan|heatsink|noctua|kraken|assassin|360mm|240mm/i.test(n)) return 'Cooling';
  if (/case|chassis|h9|h5|h7|o11|4000d|pop\s*air/i.test(n)) return 'Case';
  return 'Other';
};

export const handleAddTransaction = (
  prev: AppState,
  txData: Omit<TransactionLogItem, 'id'>
): AppState => {
  const newTx: TransactionLogItem = {
    ...txData,
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };
  return {
    ...prev,
    transactions: [newTx, ...prev.transactions],
  };
};

const isLinkedPCSale = (tx: TransactionLogItem, builds: PCBuild[]): boolean => {
  if (tx.type !== 'SALE') return false;
  return builds.some(
    (b) =>
      (tx.relatedComponentId && b.id === tx.relatedComponentId) ||
      (b.saleTransactionId && b.saleTransactionId === tx.id)
  );
};

export const handleUpdateTransaction = (
  prev: AppState,
  id: string,
  updates: Partial<TransactionLogItem>
): AppState => {
  const targetTx = prev.transactions.find((t) => t.id === id);
  if (!targetTx) return prev;

  // Guard: PC sale tied to an existing live build cannot be edited through generic transaction controls
  if (isLinkedPCSale(targetTx, prev.builds)) {
    return prev;
  }

  const updatedTxs = prev.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t));
  let updatedBuilds = prev.builds;

  if (targetTx.type === 'SALE' && targetTx.relatedComponentId) {
    updatedBuilds = prev.builds.map((b) => {
      if (b.id === targetTx.relatedComponentId) {
        return {
          ...b,
          salePrice: updates.totalAmount !== undefined ? updates.totalAmount : b.salePrice,
          saleDate: updates.dateSortable !== undefined ? updates.dateSortable : b.saleDate,
          platformSoldOn: updates.platform !== undefined ? updates.platform : b.platformSoldOn,
          paymentMethod: updates.paymentMethod !== undefined ? updates.paymentMethod : b.paymentMethod,
        };
      }
      return b;
    });
  }

  return {
    ...prev,
    transactions: updatedTxs,
    builds: updatedBuilds,
  };
};

export const handleDeleteTransaction = (
  prev: AppState,
  id: string
): AppState => {
  const targetTx = prev.transactions.find((t) => t.id === id);
  if (!targetTx) {
    return prev;
  }

  // Guard: PC sale tied to an existing live build cannot be deleted through generic transaction controls
  if (isLinkedPCSale(targetTx, prev.builds)) {
    return prev;
  }

  // Guard: If this transaction created an incoming trade-in PC
  const buildsToRemove: string[] = [];
  if (targetTx.incomingTradeInBuildId) {
    const tradeInBuild = prev.builds.find((b) => b.id === targetTx.incomingTradeInBuildId);
    const hasExtractedEntries = prev.components.some((c) =>
      (c.purchaseHistory || []).some(
        (pe) =>
          pe.sourceSaleTransactionId === id ||
          (tradeInBuild && pe.sourceTradeInBuildId === tradeInBuild.id)
      )
    );
    const isModifiedOrSold =
      tradeInBuild &&
      (tradeInBuild.status === 'Sold' ||
        (tradeInBuild.parts && tradeInBuild.parts.length > 0));

    if (hasExtractedEntries || isModifiedOrSold) {
      // Downstream records exist: block deletion to protect accounting integrity
      return prev;
    }

    if (tradeInBuild && tradeInBuild.status === 'Trade-In Processing') {
      buildsToRemove.push(tradeInBuild.id);
    }
  }

  return {
    ...prev,
    transactions: prev.transactions.filter((t) => t.id !== id),
    builds:
      buildsToRemove.length > 0
        ? prev.builds.filter((b) => !buildsToRemove.includes(b.id))
        : prev.builds,
  };
};

export const isEligibleBulkPartSaleTransaction = (
  tx: TransactionLogItem,
  bulkSaleGroupId: string,
  builds: PCBuild[] = []
): boolean => {
  if (!bulkSaleGroupId || tx.bulkSaleGroupId !== bulkSaleGroupId) return false;
  if (tx.type !== 'SALE') return false;
  const classification = classifyTransaction(tx, builds);
  return classification.isPartSale && !classification.isExchange && !classification.isPCSale;
};

export const handleDeleteBulkPartSale = (
  prev: AppState,
  bulkSaleGroupId: string
): AppState => {
  if (!bulkSaleGroupId) return prev;
  const eligibleIds = new Set(
    prev.transactions
      .filter((t) => isEligibleBulkPartSaleTransaction(t, bulkSaleGroupId, prev.builds))
      .map((t) => t.id)
  );
  if (eligibleIds.size === 0) {
    return prev;
  }
  return {
    ...prev,
    transactions: prev.transactions.filter((t) => !eligibleIds.has(t.id)),
  };
};

export const getValidatedRelistQuantity = (tx: TransactionLogItem): number | null => {
  const relistQty = tx.relatedComponentQty !== undefined ? tx.relatedComponentQty : tx.quantity;
  if (
    typeof relistQty !== 'number' ||
    !Number.isFinite(relistQty) ||
    !Number.isInteger(relistQty) ||
    relistQty <= 0
  ) {
    return null;
  }
  return relistQty;
};

export const restoreTransactionStock = (
  currentComponents: InventoryComponent[],
  tx: TransactionLogItem,
  relistQty: number
): InventoryComponent[] => {
  const rawName =
    tx.itemNameOrSummary?.trim() ||
    tx.title?.replace(/^Part Sold:\s*/i, '').trim();
  const relistPartName = rawName || 'Relisted Component';

  const unitRevenue = tx.totalAmount ? tx.totalAmount / (tx.quantity || 1) : 0;
  const profitPerUnit = tx.profitMargin !== undefined ? tx.profitMargin / (tx.quantity || 1) : 0;
  const fallbackUnitCost = tx.soldUnitCost ?? Math.max(0, unitRevenue - profitPerUnit);

  const hasLinkedComponentId =
    typeof tx.relatedComponentId === 'string' && tx.relatedComponentId.trim() !== '';

  if (hasLinkedComponentId) {
    const targetCompId = tx.relatedComponentId!.trim();
    const existingCompIndex = currentComponents.findIndex((c) => c.id === targetCompId);

    if (existingCompIndex >= 0) {
      // Rule 1: Linked sale to existing component ID
      return currentComponents.map((c, idx) => {
        if (idx !== existingCompIndex) return c;

        const targetEntryId = tx.relatedPurchaseEntryId?.trim();
        const existingEntryIndex = targetEntryId
          ? (c.purchaseHistory || []).findIndex((e) => e.id === targetEntryId)
          : -1;

        let newHistory: PurchaseEntry[];
        if (existingEntryIndex >= 0) {
          newHistory = (c.purchaseHistory || []).map((pe, pIdx) => {
            if (pIdx === existingEntryIndex) {
              const updatedQty = pe.quantity + relistQty;
              return {
                ...pe,
                quantity: updatedQty,
                totalPrice: updatedQty * pe.unitPrice,
              };
            }
            return pe;
          });
        } else if (tx.originalPurchaseEntrySnapshot) {
          const restoredBatch: PurchaseEntry = {
            ...tx.originalPurchaseEntrySnapshot,
            id:
              tx.originalPurchaseEntrySnapshot.id ||
              targetEntryId ||
              `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            quantity: relistQty,
            totalPrice: relistQty * tx.originalPurchaseEntrySnapshot.unitPrice,
          };
          newHistory = [restoredBatch, ...(c.purchaseHistory || [])];
        } else {
          const restoredBatch: PurchaseEntry = {
            id: targetEntryId || `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date:
              tx.dateSortable ||
              tx.timestamp ||
              new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
            condition: 'Used Open Box',
            quantity: relistQty,
            unitPrice: fallbackUnitCost,
            totalPrice: fallbackUnitCost * relistQty,
            platform: tx.platform || 'Other',
            paymentMethod: (tx.paymentMethod as import('../../types').PaymentMethod) || 'Cash',
            taxPercent: 0,
            notes: tx.bulkSaleGroupId
              ? `Restored from relisted bulk sale (${tx.bulkSaleGroupId})`
              : `Restored from relisted sale (${tx.id})`,
          };
          newHistory = [restoredBatch, ...(c.purchaseHistory || [])];
        }

        return {
          ...c,
          purchaseHistory: newHistory,
          soldCount: Math.max(0, (c.soldCount || 0) - relistQty),
        };
      });
    } else {
      // Rule 2: Missing linked component (component was deleted from inventory)
      // Recreate exactly one component preserving relatedComponentId
      const category = inferCategory(relistPartName);
      const tags = autoTagComponent(relistPartName, '', category);
      const targetEntryId = tx.relatedPurchaseEntryId?.trim();

      const restoredBatch: PurchaseEntry = tx.originalPurchaseEntrySnapshot
        ? {
            ...tx.originalPurchaseEntrySnapshot,
            id:
              tx.originalPurchaseEntrySnapshot.id ||
              targetEntryId ||
              `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            quantity: relistQty,
            totalPrice: relistQty * tx.originalPurchaseEntrySnapshot.unitPrice,
          }
        : {
            id: targetEntryId || `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date:
              tx.dateSortable ||
              tx.timestamp ||
              new Date().toISOString().split('T')[0],
            condition: 'Used Open Box',
            quantity: relistQty,
            unitPrice: fallbackUnitCost,
            totalPrice: fallbackUnitCost * relistQty,
            platform: tx.platform || 'Other',
            paymentMethod: (tx.paymentMethod as import('../../types').PaymentMethod) || 'Cash',
            taxPercent: 0,
            notes: tx.bulkSaleGroupId
              ? `Restored from relisted bulk sale (${tx.bulkSaleGroupId})`
              : `Restored from relisted sale (${tx.id})`,
          };

      const restoredComp: InventoryComponent = {
        id: targetCompId,
        name: relistPartName,
        category,
        specifications: '',
        assignedCount: 0,
        soldCount: 0,
        tags,
        purchaseHistory: [restoredBatch],
      };

      return [restoredComp, ...currentComponents];
    }
  }

  // Rule 3: Truly unlinked historical sales (relatedComponentId is absent)
  // Recreate exactly one new component with a new unique ID; NEVER mutate existing components by name
  const category = inferCategory(relistPartName);
  const tags = autoTagComponent(relistPartName, '', category);
  const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const targetEntryId = tx.relatedPurchaseEntryId?.trim();

  const restoredBatch: PurchaseEntry = tx.originalPurchaseEntrySnapshot
    ? {
        ...tx.originalPurchaseEntrySnapshot,
        id:
          tx.originalPurchaseEntrySnapshot.id ||
          targetEntryId ||
          `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        quantity: relistQty,
        totalPrice: relistQty * tx.originalPurchaseEntrySnapshot.unitPrice,
      }
    : {
        id: targetEntryId || `pe-relist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date:
          tx.dateSortable ||
          tx.timestamp ||
          new Date().toISOString().split('T')[0],
        condition: 'Used Open Box',
        quantity: relistQty,
        unitPrice: fallbackUnitCost,
        totalPrice: fallbackUnitCost * relistQty,
        platform: tx.platform || 'Other',
        paymentMethod: (tx.paymentMethod as import('../../types').PaymentMethod) || 'Cash',
        taxPercent: 0,
        notes: tx.bulkSaleGroupId
          ? `Restored from relisted bulk sale (${tx.bulkSaleGroupId})`
          : `Restored from relisted sale (${tx.id})`,
      };

  const restoredComp: InventoryComponent = {
    id: newCompId,
    name: relistPartName,
    category,
    specifications: '',
    assignedCount: 0,
    soldCount: 0,
    tags,
    purchaseHistory: [restoredBatch],
  };

  return [restoredComp, ...currentComponents];
};

export const handleRelistPartSale = (
  prev: AppState,
  transactionId: string
): AppState => {
  if (!transactionId) return prev;

  const targetTx = prev.transactions.find((t) => t.id === transactionId);
  if (!targetTx || targetTx.type !== 'SALE') return prev;

  const relistQty = getValidatedRelistQuantity(targetTx);
  if (relistQty === null) return prev;

  const updatedComponents = restoreTransactionStock(prev.components, targetTx, relistQty);
  const remainingTxs = prev.transactions.filter((t) => t.id !== transactionId);

  return {
    ...prev,
    components: updatedComponents,
    transactions: remainingTxs,
  };
};

export const handleRelistBulkPartSale = (
  prev: AppState,
  bulkSaleGroupId: string
): AppState => {
  if (!bulkSaleGroupId) return prev;

  const groupTxs = prev.transactions.filter(
    (t) => t.type === 'SALE' && t.bulkSaleGroupId === bulkSaleGroupId
  );
  if (groupTxs.length === 0) return prev;

  // Validate every group member before applying any restoration
  for (const tx of groupTxs) {
    const qty = getValidatedRelistQuantity(tx);
    if (qty === null) {
      return prev; // Entire bulk relist aborted atomically
    }
  }

  let updatedComponents = [...prev.components];
  for (const tx of groupTxs) {
    const relistQty = getValidatedRelistQuantity(tx)!;
    updatedComponents = restoreTransactionStock(updatedComponents, tx, relistQty);
  }

  const remainingTxs = prev.transactions.filter(
    (t) => !(t.type === 'SALE' && t.bulkSaleGroupId === bulkSaleGroupId)
  );

  return {
    ...prev,
    components: updatedComponents,
    transactions: remainingTxs,
  };
};

export const handleUpdateSheetStats = (
  prev: AppState,
  stats: AppState['sheetStats']
): AppState => ({
  ...prev,
  sheetStats: stats,
});

export const handleUpdateMonthlyGoal = (
  prev: AppState,
  goal: number
): AppState => {
  if (
    typeof goal !== 'number' ||
    !Number.isFinite(goal) ||
    Number.isNaN(goal) ||
    goal <= 0 ||
    prev.monthlyGoal === goal
  ) {
    return prev;
  }

  return {
    ...prev,
    monthlyGoal: goal,
  };
};

export const getResetState = (): AppState => ({
  components: [],
  builds: [],
  transactions: [],
  monthlyGoal: 10000,
  sheetStats: {
    monthly: [],
    yearly: { revenue: 0, profit: 0, pcsSold: 0 },
  },
});
