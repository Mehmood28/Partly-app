import {
  InventoryComponent,
  TransactionLogItem,
  PurchaseLineItem,
  PurchaseEntry,
  PCBuild,
  Condition,
  PaymentMethod,
} from '../types';
import { formatCategoryPlural, formatCurrency, roundToCents } from './helpers';
import { inferCategory } from '../components/activity/activityHelpers';

export interface RawLineItemCandidate {
  id?: string;
  componentId?: string;
  purchaseEntryId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
  specifications?: string;
  condition?: Condition;
  seller?: string;
  platform?: string;
  paymentMethod?: PaymentMethod;
  healthPercent?: number;
}

/**
 * Normalizes string for fuzzy/token matching
 */
const normalizeText = (text?: string): string => {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
};

const usablePurchaseValue = (value?: string): string | undefined => {
  const normalized = String(value || '').trim();
  return normalized && !/^(mixed|n\/?a|unknown|none|—|-)$/i.test(normalized) ? normalized : undefined;
};

/**
 * Extracts raw line items from detailsList or single item metadata
 */
export const extractRawLineItemsFromTx = (
  tx: TransactionLogItem
): RawLineItemCandidate[] => {
  if (tx.detailsList && tx.detailsList.length > 0) {
    return tx.detailsList.map((detail) => {
      const match = detail.match(/^(?:(\d+)x\s+)?(.*?)(?:\s+\(\$([\d\.,]+)(?:\/ea)?\))?$/i);
      const quantity = match && match[1] ? parseInt(match[1], 10) : 1;
      const name = match && match[2] ? match[2].trim() : detail.trim();
      const unitPrice = match && match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
      return {
        name,
        quantity: Math.max(1, quantity),
        unitPrice,
        totalPrice: roundToCents(quantity * unitPrice),
        category: inferCategory(name),
      };
    });
  }

  const q = tx.quantity || tx.relatedComponentQty || 1;
  const tot = typeof tx.totalAmount === 'number' && tx.totalAmount >= 0 ? tx.totalAmount : 0;
  const u = q > 0 ? roundToCents(tot / q) : 0;
  const singleName = (tx.itemNameOrSummary || 'Purchased Part').replace(/^\d+x\s+/i, '').trim();

  return [
    {
      name: singleName,
      quantity: q,
      unitPrice: u,
      totalPrice: tot,
      category: inferCategory(singleName),
    },
  ];
};

/**
 * Resolves purchase line items by linking each line item to its corresponding
 * inventory component and purchase history entry (by ID, provenance, or fallback matching).
 */
export const resolvePurchaseLineItems = (
  tx: TransactionLogItem,
  components: InventoryComponent[]
): PurchaseLineItem[] => {
  if (tx.type !== 'PURCHASE') {
    return tx.purchaseLineItems || [];
  }

  // Pool of all candidate purchase entries across components
  const allEntries: Array<{ comp: InventoryComponent; entry: PurchaseEntry }> = [];
  components.forEach((comp) => {
    (comp.purchaseHistory || []).forEach((entry) => {
      allEntries.push({ comp, entry });
    });
  });

  const matchedEntryIds = new Set<string>();
  const matchedCompIds = new Set<string>();

  // Determine starting items: prioritize existing purchaseLineItems if available
  const hasExistingLineItems = Array.isArray(tx.purchaseLineItems) && tx.purchaseLineItems.length > 0;
  const rawItems: RawLineItemCandidate[] = hasExistingLineItems
    ? tx.purchaseLineItems!.map((it) => ({
        id: it.id,
        componentId: it.componentId,
        purchaseEntryId: it.purchaseEntryId,
        name: it.name,
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        totalPrice: it.totalPrice || roundToCents((it.quantity || 1) * (it.unitPrice || 0)),
        category: it.category || inferCategory(it.name),
        specifications: it.specifications,
        condition: it.condition,
        seller: it.seller || it.platform,
        platform: it.platform || it.seller,
        paymentMethod: it.paymentMethod,
        healthPercent: it.healthPercent,
      }))
    : extractRawLineItemsFromTx(tx);

  // If this is a single-item transaction, link directly if relatedComponentId is set
  const isSingleItem = rawItems.length === 1;

  const resolved: PurchaseLineItem[] = [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    const rawName = raw.name.replace(/^\d+x\s+/i, '').trim();
    const rawNameLower = rawName.toLowerCase();
    const rawTokens = normalizeText(rawName).split(/\s+/).filter((t) => t.length > 1);

    let matchedComp: InventoryComponent | undefined;
    let matchedEntry: PurchaseEntry | undefined;

    // 1. Exact ID link from existing line item
    if (raw.componentId) {
      matchedComp = components.find((c) => c.id === raw.componentId);
      if (matchedComp && raw.purchaseEntryId) {
        matchedEntry = matchedComp.purchaseHistory?.find((e) => e.id === raw.purchaseEntryId);
      }
    }

    // 2. Direct ID link from single-item transaction
    if (!matchedComp && isSingleItem && tx.relatedComponentId) {
      matchedComp = components.find((c) => c.id === tx.relatedComponentId);
      if (matchedComp) {
        if (tx.relatedPurchaseEntryId) {
          matchedEntry = matchedComp.purchaseHistory?.find((e) => e.id === tx.relatedPurchaseEntryId);
        } else if (tx.originalPurchaseEntrySnapshot?.id) {
          matchedEntry = matchedComp.purchaseHistory?.find((e) => e.id === tx.originalPurchaseEntrySnapshot?.id);
        }
      }
    }

    // 3. Provenance match: entry with sourcePurchaseTransactionId === tx.id
    if (!matchedEntry) {
      const provenanceMatch = allEntries.find(
        (cand) =>
          !matchedEntryIds.has(cand.entry.id) &&
          cand.entry.sourcePurchaseTransactionId === tx.id &&
          (matchedComp ? cand.comp.id === matchedComp.id : true) &&
          (cand.comp.name.toLowerCase() === rawNameLower || cand.comp.category === raw.category)
      );
      if (provenanceMatch) {
        matchedComp = provenanceMatch.comp;
        matchedEntry = provenanceMatch.entry;
      }
    }

    // 4. Exact name matching
    if (!matchedComp) {
      const nameMatch = components.find((c) => {
        if (matchedCompIds.has(c.id) && !isSingleItem) return false;
        const cNameLower = c.name.toLowerCase().trim();
        return cNameLower === rawNameLower;
      });
      if (nameMatch) {
        matchedComp = nameMatch;
      }
    }

    // 5. Token overlap matching
    if (!matchedComp) {
      let bestScore = 0;
      let bestCandidate: InventoryComponent | undefined;

      for (const cand of components) {
        if (matchedCompIds.has(cand.id) && !isSingleItem) continue;
        const candTokens = new Set(normalizeText(cand.name).split(/\s+/).filter((t) => t.length > 1));
        let score = 0;
        for (const token of rawTokens) {
          if (candTokens.has(token)) score++;
        }
        if (score >= 2 && score > bestScore && (score / rawTokens.length >= 0.4 || score >= 3)) {
          bestScore = score;
          bestCandidate = cand;
        }
      }
      if (bestCandidate) {
        matchedComp = bestCandidate;
      }
    }

    // 6. Fallback matching for renamed items:
    // When an inventory part was renamed in stock (e.g. "Gigabyte GP-P750GM 750W 80+ Gold" -> "Gigabyte GP-UD750GM 80P Black"):
    // Search entries linked to this transaction or sharing date + category + price!
    if (!matchedComp || !matchedEntry) {
      // 6a. Try entries with sourcePurchaseTransactionId === tx.id that haven't been claimed yet
      const unclaimedTxEntry = allEntries.find(
        (cand) => !matchedEntryIds.has(cand.entry.id) && cand.entry.sourcePurchaseTransactionId === tx.id
      );
      if (unclaimedTxEntry) {
        matchedComp = unclaimedTxEntry.comp;
        matchedEntry = unclaimedTxEntry.entry;
      } else {
        // 6b. Try matching by transaction date + category + price
        const txDate = tx.dateSortable || tx.timestamp?.split(' ')[0] || '';
        const fallbackMatch = allEntries.find((cand) => {
          if (matchedEntryIds.has(cand.entry.id)) return false;
          const sameCategory = cand.comp.category === raw.category;
          const sameDate = !txDate || cand.entry.date === txDate || cand.entry.date?.startsWith(txDate);
          const priceClose = Math.abs(cand.entry.unitPrice - raw.unitPrice) < 0.05;
          return sameCategory && (sameDate || priceClose);
        });

        if (fallbackMatch) {
          matchedComp = fallbackMatch.comp;
          matchedEntry = fallbackMatch.entry;
        }
      }
    }

    // If comp matched but entry not found, pick the most appropriate entry
    if (matchedComp && !matchedEntry) {
      matchedEntry =
        matchedComp.purchaseHistory?.find(
          (e) => !matchedEntryIds.has(e.id) && (e.sourcePurchaseTransactionId === tx.id || e.date === tx.dateSortable)
        ) ||
        matchedComp.purchaseHistory?.find((e) => !matchedEntryIds.has(e.id)) ||
        matchedComp.purchaseHistory?.[0];
    }

    if (matchedEntry) {
      matchedEntryIds.add(matchedEntry.id);
    }
    if (matchedComp) {
      matchedCompIds.add(matchedComp.id);
    }

    // Pull authoritative live data from matched component & entry
    const finalName = matchedComp ? matchedComp.name : rawName;
    const finalCategory = (matchedComp?.category || raw.category || inferCategory(finalName)) as any;
    const finalSpecs = matchedComp?.specifications || raw.specifications || '';
    const finalCondition =
      matchedEntry?.condition ||
      raw.condition ||
      (matchedComp?.purchaseHistory?.[0]?.condition as Condition) ||
      'New Open Box';
    const finalSeller =
      matchedEntry?.platform ||
      matchedEntry?.seller ||
      matchedComp?.seller ||
      raw.seller ||
      tx.seller ||
      tx.platform ||
      '';
    const finalPayment =
      matchedEntry?.paymentMethod ||
      raw.paymentMethod ||
      (tx.paymentMethod as PaymentMethod) ||
      'Cash';
    const finalQty = matchedEntry?.quantity || raw.quantity || 1;
    const finalUnit = matchedEntry?.unitPrice !== undefined ? matchedEntry.unitPrice : raw.unitPrice;
    const finalSubtotal = roundToCents(finalQty * finalUnit);
    const finalHealth =
      matchedEntry?.healthPercent !== undefined
        ? matchedEntry.healthPercent
        : matchedComp?.category === 'Storage'
        ? matchedComp.healthPercent
        : raw.healthPercent;

    resolved.push({
      id: raw.id || `pli-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      componentId: matchedComp?.id,
      purchaseEntryId: matchedEntry?.id,
      name: finalName,
      category: finalCategory,
      specifications: finalSpecs,
      condition: finalCondition,
      seller: finalSeller,
      platform: finalSeller,
      paymentMethod: finalPayment,
      quantity: finalQty,
      unitPrice: finalUnit,
      totalPrice: finalSubtotal,
      healthPercent: finalHealth,
    });
  }

  return resolved;
};

/**
 * Recalculates aggregated rollups on the parent purchase record
 * (Condition, Seller, Payment Method, Total Paid, Quantity, Item Count, detailsList, title, summary)
 */
export const recalculatePurchaseRollups = (
  tx: TransactionLogItem,
  lineItems: PurchaseLineItem[]
): TransactionLogItem => {
  if (lineItems.length === 0) {
    return { ...tx, purchaseLineItems: [] };
  }

  const totalQuantity = lineItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalAmount = roundToCents(
    lineItems.reduce((acc, it) => acc + (it.totalPrice || roundToCents((it.quantity || 1) * it.unitPrice)), 0)
  );
  const itemCount = lineItems.length;

  // Re-generate detailsList lines
  const updatedDetailsList = lineItems.map((it) => {
    const qty = it.quantity || 1;
    return `${qty}x ${it.name} (${formatCurrency(it.unitPrice)}/ea)`;
  });

  // Calculate Aggregated Seller / Platform
  const rawSellers = lineItems
    .map((it) => usablePurchaseValue(it.seller || it.platform))
    .filter(Boolean) as string[];

  // Group case-insensitively while preserving original display casing
  const sellerDisplayMap = new Map<string, string>();
  rawSellers.forEach((s) => {
    const lower = s.toLowerCase();
    if (!sellerDisplayMap.has(lower)) {
      sellerDisplayMap.set(lower, s);
    }
  });

  let resolvedSeller = tx.seller || tx.platform || '';
  if (sellerDisplayMap.size === 1) {
    resolvedSeller = Array.from(sellerDisplayMap.values())[0];
  } else if (sellerDisplayMap.size > 1) {
    resolvedSeller = 'MIXED';
  } else if (rawSellers.length === 0 && tx.seller) {
    resolvedSeller = tx.seller;
  }

  // Calculate Aggregated Payment Method
  const rawPayments = lineItems
    .map((it) => usablePurchaseValue(it.paymentMethod))
    .filter(Boolean) as string[];

  const paymentDisplayMap = new Map<string, string>();
  rawPayments.forEach((p) => {
    const lower = p.toLowerCase();
    if (!paymentDisplayMap.has(lower)) {
      paymentDisplayMap.set(lower, p);
    }
  });

  let resolvedPayment: PaymentMethod | undefined = tx.paymentMethod;
  if (paymentDisplayMap.size === 1) {
    resolvedPayment = Array.from(paymentDisplayMap.values())[0] as PaymentMethod;
  } else if (paymentDisplayMap.size > 1) {
    resolvedPayment = 'MIXED' as any;
  }

  // Calculate Aggregated Condition
  const rawConditions = lineItems
    .map((it) => usablePurchaseValue(it.condition))
    .filter(Boolean) as string[];
  const uniqueConditions = [...new Set(rawConditions.map((c) => c.toLowerCase()))];
  let resolvedCondition: string | undefined;
  if (uniqueConditions.length === 1) {
    resolvedCondition = rawConditions[0];
  } else if (uniqueConditions.length > 1) {
    resolvedCondition = 'MIXED';
  }

  // Update Dynamic Title
  let updatedTitle = tx.title || '';
  const isBulkPurchase = lineItems.length > 1 || /^Bulk Purchase/i.test(updatedTitle);

  if (isBulkPurchase) {
    if (resolvedSeller && resolvedSeller !== 'MIXED') {
      updatedTitle = `Bulk Purchase: ${resolvedSeller}`;
    } else if (resolvedSeller === 'MIXED') {
      updatedTitle = `Bulk Purchase: MIXED`;
    } else {
      updatedTitle = `Bulk Purchase`;
    }
  } else if (lineItems.length === 1) {
    const singleName = lineItems[0].name.replace(/^\d+x\s+/i, '');
    updatedTitle = totalQuantity > 1 ? `Purchased ${totalQuantity}x ${singleName}` : `Purchased ${singleName}`;
  }

  // Update Item or Summary
  let updatedSummary = tx.itemNameOrSummary || '';
  if (lineItems.length === 1) {
    const singleName = lineItems[0].name.replace(/^\d+x\s+/i, '');
    updatedSummary = totalQuantity > 1 ? `Purchased ${totalQuantity}x ${singleName}` : singleName;
  } else {
    const uniqueCategories = Array.from(new Set(lineItems.map((it) => it.category).filter(Boolean)));
    if (uniqueCategories.length === 1) {
      const catPlural = formatCategoryPlural(uniqueCategories[0] || 'Other');
      updatedSummary = `Purchased ${totalQuantity}x ${catPlural}`;
    } else {
      updatedSummary = `Purchased Mixed Parts (${totalQuantity} ${totalQuantity === 1 ? 'Part' : 'Parts'})`;
    }
  }

  // Update single-item snapshot if applicable
  let updatedSnapshot = tx.originalPurchaseEntrySnapshot;
  if (lineItems.length === 1 && lineItems[0].purchaseEntryId) {
    const firstItem = lineItems[0];
    updatedSnapshot = {
      ...(tx.originalPurchaseEntrySnapshot || {}),
      id: firstItem.purchaseEntryId,
      date: tx.dateSortable || tx.timestamp,
      quantity: firstItem.quantity,
      unitPrice: firstItem.unitPrice,
      totalPrice: firstItem.totalPrice || roundToCents(firstItem.quantity * firstItem.unitPrice),
      condition: (resolvedCondition && resolvedCondition !== 'MIXED' ? (resolvedCondition as Condition) : firstItem.condition) || 'New Open Box',
      paymentMethod: firstItem.paymentMethod || 'Cash',
      platform: firstItem.seller || firstItem.platform || '',
      seller: firstItem.seller || firstItem.platform || '',
      healthPercent: firstItem.healthPercent,
    };
  } else if (lineItems.length > 1 && tx.originalPurchaseEntrySnapshot) {
    updatedSnapshot = {
      ...tx.originalPurchaseEntrySnapshot,
      condition: (resolvedCondition && resolvedCondition !== 'MIXED' ? (resolvedCondition as Condition) : tx.originalPurchaseEntrySnapshot.condition) || 'New Open Box',
    };
  }

  return {
    ...tx,
    title: tx.customTitleOverride ? tx.title : updatedTitle,
    itemNameOrSummary: updatedSummary,
    quantity: totalQuantity,
    relatedComponentQty: totalQuantity,
    totalAmount,
    itemCount,
    seller: resolvedSeller,
    platform: resolvedSeller,
    paymentMethod: resolvedPayment,
    detailsList: updatedDetailsList,
    purchaseLineItems: lineItems,
    originalPurchaseEntrySnapshot: updatedSnapshot,
  };
};

/**
 * When an inventory component or purchase entry is edited in the In Stock tab,
 * automatically sync changes to all linked purchase transactions and recalculate their rollups.
 */
export const syncComponentUpdateToPurchaseTransactions = (
  prevTransactions: TransactionLogItem[],
  updatedComp: InventoryComponent,
  targetEntryId?: string,
  updatedEntryData?: Partial<PurchaseEntry>
): TransactionLogItem[] => {
  return prevTransactions.map((tx) => {
    if (tx.type !== 'PURCHASE') return tx;

    // Resolve line items with the latest component list
    const currentLineItems = resolvePurchaseLineItems(tx, [updatedComp]);

    // Check if this transaction contains a line item corresponding to updatedComp
    let hasMatchingLineItem = false;
    const patchedLineItems = currentLineItems.map((li) => {
      const isCompMatch = li.componentId === updatedComp.id;
      const isEntryMatch = targetEntryId && li.purchaseEntryId === targetEntryId;
      const isLegacyProvenanceMatch =
        !li.componentId &&
        updatedComp.purchaseHistory?.some((e) => e.sourcePurchaseTransactionId === tx.id);

      if (isCompMatch || isEntryMatch || isLegacyProvenanceMatch) {
        hasMatchingLineItem = true;
        const newQty = updatedEntryData?.quantity !== undefined ? updatedEntryData.quantity : li.quantity;
        const newUnitPrice = updatedEntryData?.unitPrice !== undefined ? updatedEntryData.unitPrice : li.unitPrice;
        const newSeller =
          updatedEntryData?.platform ||
          updatedEntryData?.seller ||
          updatedComp.seller ||
          li.seller;
        const newPayment = updatedEntryData?.paymentMethod || li.paymentMethod;
        const newCondition = updatedEntryData?.condition || li.condition;

        return {
          ...li,
          componentId: updatedComp.id,
          purchaseEntryId: targetEntryId || li.purchaseEntryId,
          name: updatedComp.name,
          category: updatedComp.category,
          specifications: updatedComp.specifications || '',
          condition: newCondition,
          seller: newSeller,
          platform: newSeller,
          paymentMethod: newPayment,
          quantity: newQty,
          unitPrice: newUnitPrice,
          totalPrice: roundToCents(newQty * newUnitPrice),
          healthPercent: updatedEntryData?.healthPercent ?? updatedComp.healthPercent,
        };
      }
      return li;
    });

    if (!hasMatchingLineItem) {
      // Also check if tx directly references the component as a single item
      if (tx.relatedComponentId === updatedComp.id || (targetEntryId && tx.relatedPurchaseEntryId === targetEntryId)) {
        hasMatchingLineItem = true;
      }
    }

    if (!hasMatchingLineItem) {
      return tx;
    }

    return recalculatePurchaseRollups(tx, patchedLineItems);
  });
};

/**
 * When purchase line items are edited inside the Purchase Edit Modal,
 * sync the changes back to the In Stock tab (components and their purchase batches).
 */
export const syncPurchaseTransactionUpdateToComponents = (
  prevComponents: InventoryComponent[],
  prevBuilds: PCBuild[],
  txId: string,
  updatedLineItems: PurchaseLineItem[],
  commonDate?: string
): { nextComponents: InventoryComponent[]; nextBuilds: PCBuild[] } => {
  const lineItemByCompId = new Map<string, PurchaseLineItem>();
  const lineItemByEntryId = new Map<string, PurchaseLineItem>();

  updatedLineItems.forEach((it) => {
    if (it.componentId) lineItemByCompId.set(it.componentId, it);
    if (it.purchaseEntryId) lineItemByEntryId.set(it.purchaseEntryId, it);
  });

  const renamedCompMap = new Map<string, string>(); // oldId -> newName

  const nextComponents = prevComponents.map((comp) => {
    let matchedItem = lineItemByCompId.get(comp.id);
    if (!matchedItem) {
      matchedItem = comp.purchaseHistory?.map((e) => lineItemByEntryId.get(e.id)).find(Boolean);
    }
    if (!matchedItem) {
      matchedItem = comp.purchaseHistory
        ?.filter((e) => e.sourcePurchaseTransactionId === txId)
        .map((e) => lineItemByEntryId.get(e.id) || updatedLineItems.find((li) => li.name === comp.name))
        .find(Boolean);
    }

    if (!matchedItem) {
      return comp;
    }

    // Record rename if name was updated
    if (matchedItem.name && matchedItem.name !== comp.name) {
      renamedCompMap.set(comp.id, matchedItem.name);
    }

    const updatedHistory = (comp.purchaseHistory || []).map((entry) => {
      const isEntryMatch =
        (matchedItem!.purchaseEntryId && entry.id === matchedItem!.purchaseEntryId) ||
        entry.sourcePurchaseTransactionId === txId ||
        (!matchedItem!.purchaseEntryId && comp.purchaseHistory.length === 1);

      if (!isEntryMatch) return entry;

      const newQty = matchedItem!.quantity || entry.quantity;
      const newUnitPrice = matchedItem!.unitPrice !== undefined ? matchedItem!.unitPrice : entry.unitPrice;
      const newSeller = matchedItem!.seller || matchedItem!.platform || entry.platform || entry.seller;
      const newPayment = matchedItem!.paymentMethod || entry.paymentMethod;
      const newCondition = matchedItem!.condition || entry.condition;

      return {
        ...entry,
        sourcePurchaseTransactionId: txId,
        condition: newCondition,
        quantity: newQty,
        unitPrice: newUnitPrice,
        totalPrice: roundToCents(newQty * newUnitPrice),
        platform: newSeller,
        seller: newSeller,
        paymentMethod: newPayment,
        date: commonDate || entry.date,
        healthPercent: matchedItem!.healthPercent !== undefined ? matchedItem!.healthPercent : entry.healthPercent,
      };
    });

    const newSpecs = matchedItem.specifications !== undefined ? matchedItem.specifications : comp.specifications;
    const newSeller = matchedItem.seller || matchedItem.platform || comp.seller;

    return {
      ...comp,
      name: matchedItem.name || comp.name,
      specifications: newSpecs,
      seller: newSeller,
      platform: newSeller,
      healthPercent:
        comp.category === 'Storage' && matchedItem.healthPercent !== undefined
          ? matchedItem.healthPercent
          : comp.healthPercent,
      purchaseHistory: updatedHistory,
    };
  });

  // Keep PC build parts in sync if any component names changed
  let nextBuilds = prevBuilds;
  if (renamedCompMap.size > 0) {
    nextBuilds = prevBuilds.map((b) => {
      let buildChanged = false;
      const updatedParts = (b.parts || []).map((p) => {
        if (renamedCompMap.has(p.componentId)) {
          buildChanged = true;
          return {
            ...p,
            componentName: renamedCompMap.get(p.componentId)!,
          };
        }
        return p;
      });
      return buildChanged ? { ...b, parts: updatedParts } : b;
    });
  }

  return { nextComponents, nextBuilds };
};

/**
 * Reconciles all purchase transactions against current inventory components.
 * Runs on state hydration / sanitization to automatically link and fix any stale records.
 */
export const reconcileAllPurchaseTransactions = (
  transactions: TransactionLogItem[],
  components: InventoryComponent[]
): TransactionLogItem[] => {
  return transactions.map((tx) => {
    if (tx.type !== 'PURCHASE') return tx;
    const lineItems = resolvePurchaseLineItems(tx, components);
    return recalculatePurchaseRollups(tx, lineItems);
  });
};
