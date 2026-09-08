import {
  AppState,
  COMPONENT_CATEGORIES,
  InventoryComponent,
  PCBuild,
  PurchaseEntry,
  TransactionLogItem,
} from '../../types';
import { autoTagComponent, computeUnresolvedLegacyReservation, formatCurrency, getAllBatchesWithRemaining } from '../../utils/helpers';
import {
  SellComponentPartData,
  BulkSaleLine,
  BulkSaleSharedData,
  ExchangeComponentPartData,
  SaveComponentOptions,
} from '../types';

/**
 * Normalizes a string for deterministic component matching:
 * - Unicode NFKC normalization
 * - Convert Unicode whitespace variants to regular spaces
 * - Collapse repeated internal whitespace to a single space
 * - Trim outer whitespace
 * - Case-insensitive comparison (lowercase)
 */
export const normalizeForMatching = (str?: string): string => {
  return String(str || '')
    .normalize('NFKC')
    .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g, ' ')
    .trim()
    .toLowerCase();
};

/**
 * Checks if two component descriptors match on normalized name AND normalized category.
 */
export const isSameComponentCatalog = (
  a: { name?: string; category?: string },
  b: { name?: string; category?: string }
): boolean => {
  const nameA = normalizeForMatching(a.name);
  const nameB = normalizeForMatching(b.name);
  if (!nameA || !nameB) return false;
  const catA = normalizeForMatching(a.category);
  const catB = normalizeForMatching(b.category);
  return nameA === nameB && catA === catB;
};

/**
 * Finds the index of a unique matching component in the catalog (excluding an optional component ID).
 * Returns -1 if 0 matches or >1 matches (ambiguous).
 */
export const findUniqueCatalogMatchIndex = (
  components: InventoryComponent[],
  compData: { name?: string; category?: string },
  excludeComponentId?: string
): number => {
  const matchingIndices: number[] = [];
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    if (excludeComponentId && c.id === excludeComponentId) {
      continue;
    }
    if (isSameComponentCatalog(c, compData)) {
      matchingIndices.push(i);
    }
  }
  return matchingIndices.length === 1 ? matchingIndices[0] : -1;
};

/**
 * Checks if a component has any unresolved legacy allocations across builds
 * (i.e. assigned quantity not covered by valid explicit purchaseEntryId links).
 */
export const hasUnresolvedLegacyAllocation = (
  comp: InventoryComponent,
  builds: PCBuild[]
): boolean => {
  const validEntryIds = new Set((comp.purchaseHistory || []).map((e) => e.id));
  let explicitAssignedSum = 0;
  let unlinkedFromBuilds = 0;

  for (const b of builds || []) {
    for (const p of b.parts || []) {
      if (p.componentId === comp.id) {
        if (p.purchaseEntryId && validEntryIds.has(p.purchaseEntryId)) {
          explicitAssignedSum += Number(p.quantity) || 0;
        } else {
          unlinkedFromBuilds += Number(p.quantity) || 0;
        }
      }
    }
  }

  const assignedCount = Number(comp.assignedCount) || 0;
  const unlinkedAssigned = Math.max(0, assignedCount - explicitAssignedSum, unlinkedFromBuilds);
  return unlinkedAssigned > 0;
};

/**
 * Retained for backward compatibility / diagnostics:
 * Finds a unique existing component index for deduplication.
 */
export const findDeduplicationTargetIndex = (
  components: InventoryComponent[],
  compData: { name?: string; category?: string },
  _builds?: PCBuild[]
): number => {
  return findUniqueCatalogMatchIndex(components, compData);
};

export const handleSaveComponent = (
  prev: AppState,
  options: SaveComponentOptions
): { nextState: AppState; success: boolean; error?: string } => {
  const { componentData, existingComponentId, newPurchaseEntry, updatedPurchaseEntry } = options;
  
  let validatedUpdatedEntry: { quantity: number; unitPrice: number; totalPrice: number; taxPercent: number } | null = null;
  if (updatedPurchaseEntry) {
    const entry = updatedPurchaseEntry.entry;
    const newQty = Number(entry.quantity);
    if (!Number.isFinite(newQty) || newQty <= 0 || !Number.isInteger(newQty)) {
      return { nextState: prev, success: false, error: 'Quantity must be a positive whole number.' };
    }
    const unitPrice = Number(entry.unitPrice);
    const rawTotalPrice = entry.totalPrice ?? null;
    const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * newQty);
    const rawTaxPercent = entry.taxPercent ?? null;
    const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { nextState: prev, success: false, error: 'Unit price must be a non-negative number.' };
    if (!Number.isFinite(totalPrice) || totalPrice < 0) return { nextState: prev, success: false, error: 'Total price must be a non-negative number.' };
    if (!Number.isFinite(taxPercent) || taxPercent < 0) return { nextState: prev, success: false, error: 'Tax percent must be a non-negative number.' };
    
    validatedUpdatedEntry = { quantity: newQty, unitPrice, totalPrice, taxPercent };
  }

  let validatedNewEntry: { quantity: number; unitPrice: number; totalPrice: number; taxPercent: number } | null = null;
  if (newPurchaseEntry) {
    const newQty = Number(newPurchaseEntry.quantity);
    if (!Number.isFinite(newQty) || newQty <= 0 || !Number.isInteger(newQty)) {
      return { nextState: prev, success: false, error: 'Quantity must be a positive whole number.' };
    }
    const unitPrice = Number(newPurchaseEntry.unitPrice);
    const rawTotalPrice = newPurchaseEntry.totalPrice ?? null;
    const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * newQty);
    const rawTaxPercent = newPurchaseEntry.taxPercent ?? null;
    const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { nextState: prev, success: false, error: 'Unit price must be a non-negative number.' };
    if (!Number.isFinite(totalPrice) || totalPrice < 0) return { nextState: prev, success: false, error: 'Total price must be a non-negative number.' };
    if (!Number.isFinite(taxPercent) || taxPercent < 0) return { nextState: prev, success: false, error: 'Tax percent must be a non-negative number.' };
    
    validatedNewEntry = { quantity: newQty, unitPrice, totalPrice, taxPercent };
  }

  if (existingComponentId) {
    const sourceComp = prev.components.find((c) => c.id === existingComponentId);
    if (!sourceComp) return { nextState: prev, success: false, error: 'Component not found' };

    if (updatedPurchaseEntry) {
      const entryId = updatedPurchaseEntry.entryId;
      const newQty = Number(updatedPurchaseEntry.entry.quantity);
      const batches = getAllBatchesWithRemaining(sourceComp, prev.builds);
      const batch = batches.find(b => b.entry.id === entryId);

      const explicitSum = batches.reduce((sum, b) => sum + b.allocatedQuantity, 0);
      let unlinkedFromBuilds = 0;
      (prev.builds || []).forEach(b => {
        (b.parts || []).forEach(p => {
          if (p.componentId === existingComponentId) {
            const qty = Number(p.quantity) || 0;
            if (!p.purchaseEntryId || !sourceComp.purchaseHistory?.some(e => e.id === p.purchaseEntryId)) {
              unlinkedFromBuilds += qty;
            }
          }
        });
      });
      const unlinkedAssigned = Math.max(0, (Number(sourceComp.assignedCount) || 0) - explicitSum, unlinkedFromBuilds);
      if (batch && unlinkedAssigned > 0 && newQty < Number(batch.entry.quantity)) {
        return { nextState: prev, success: false, error: `Cannot reduce quantity. Component has ${unlinkedAssigned} unresolved legacy allocations.` };
      }

      if (batch) {
        const totalUsed = Number(batch.entry.quantity) - batch.availableQuantity;
        if (newQty < totalUsed) {
          return { nextState: prev, success: false, error: `Cannot reduce quantity below ${totalUsed}. These units are currently allocated to live builds.` };
        }
      }
    }

    const finalName = componentData.name !== undefined ? componentData.name : sourceComp.name;
    const finalCategory = componentData.category !== undefined ? componentData.category : sourceComp.category;

    // Check if there is a unique matching other component in catalog
    const targetCompIndex = findUniqueCatalogMatchIndex(
      prev.components,
      { name: finalName, category: finalCategory },
      existingComponentId
    );

    const targetComp = targetCompIndex !== -1 ? prev.components[targetCompIndex] : null;

    let canAutoMerge = false;
    if (targetComp) {
      const targetEntryIds = new Set((targetComp.purchaseHistory || []).map((e) => e.id));
      const sourceEntryIds = (sourceComp.purchaseHistory || []).map((e) => e.id);
      const hasConflict = sourceEntryIds.some((id) => targetEntryIds.has(id));
      if (!hasConflict) {
        canAutoMerge = true;
      }
    }

    if (canAutoMerge && targetComp) {
      // 1. Process pending new-purchase or purchase-edit on source
      let sourceHistory = (sourceComp.purchaseHistory || []).map((pe) => ({ ...pe }));
      let newTx: TransactionLogItem | null = null;

      if (updatedPurchaseEntry) {
        sourceHistory = sourceHistory
          .map((e) =>
            e.id === updatedPurchaseEntry.entryId
              ? {
                  ...e, // Preserve provenance
                  date: updatedPurchaseEntry.entry.date,
                  condition: updatedPurchaseEntry.entry.condition,
                  quantity: validatedUpdatedEntry!.quantity,
                  unitPrice: validatedUpdatedEntry!.unitPrice,
                  totalPrice: validatedUpdatedEntry!.totalPrice,
                  paymentMethod: updatedPurchaseEntry.entry.paymentMethod,
                  platform: updatedPurchaseEntry.entry.platform,
                  taxPercent: validatedUpdatedEntry!.taxPercent,
                  notes: updatedPurchaseEntry.entry.notes || '',
                }
              : { ...e }
          )
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else if (newPurchaseEntry) {
        const newEntryId = `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const createdEntry: PurchaseEntry = {
          id: newEntryId,
          date: newPurchaseEntry.date,
          condition: newPurchaseEntry.condition,
          quantity: validatedNewEntry!.quantity,
          unitPrice: validatedNewEntry!.unitPrice,
          totalPrice: validatedNewEntry!.totalPrice,
          paymentMethod: newPurchaseEntry.paymentMethod,
          platform: newPurchaseEntry.platform,
          taxPercent: validatedNewEntry!.taxPercent,
          notes: newPurchaseEntry.notes || '',
        };

        newTx = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'PURCHASE',
          title: `Purchased: ${newPurchaseEntry.platform || 'Stock'}`,
          timestamp: newPurchaseEntry.date,
          dateSortable: newPurchaseEntry.date,
          itemCount: 1,
          quantity: validatedNewEntry!.quantity,
          totalAmount: validatedNewEntry!.totalPrice,
          platform: newPurchaseEntry.platform,
          paymentMethod: newPurchaseEntry.paymentMethod,
          itemNameOrSummary: targetComp.name,
          relatedComponentId: targetComp.id, // Surviving target component ID
          relatedComponentQty: validatedNewEntry!.quantity,
        };

        sourceHistory = [{ ...createdEntry }, ...sourceHistory].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }

      // 2. Transfer all source purchase batches into target unchanged
      const combinedHistory: PurchaseEntry[] = [
        ...(targetComp.purchaseHistory || []).map((pe) => ({ ...pe })),
        ...sourceHistory.map((pe) => ({ ...pe })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 3. Combine assignedCount and soldCount
      const combinedAssignedCount = (Number(targetComp.assignedCount) || 0) + (Number(sourceComp.assignedCount) || 0);
      const combinedSoldCount = (Number(targetComp.soldCount) || 0) + (Number(sourceComp.soldCount) || 0);

      // 4. Union tags without duplicates
      const rawCombinedTags = [
        ...(targetComp.tags || []),
        ...(sourceComp.tags || []),
        ...(componentData.tags || []),
      ];
      const combinedTags = Array.from(new Set(rawCombinedTags.filter(Boolean)));

      // 5. Keep target specifications and target market value when already populated; use source values only when absent
      const hasTargetSpecs = targetComp.specifications && Object.keys(targetComp.specifications).length > 0;
      const finalSpecs = hasTargetSpecs
        ? targetComp.specifications
        : (componentData.specifications && Object.keys(componentData.specifications).length > 0
            ? componentData.specifications
            : sourceComp.specifications);

      const hasTargetMv = targetComp.targetMarketValuePerUnit !== undefined && targetComp.targetMarketValuePerUnit !== null && targetComp.targetMarketValuePerUnit > 0;
      const finalTargetMv = hasTargetMv
        ? targetComp.targetMarketValuePerUnit
        : (componentData.targetMarketValuePerUnit !== undefined && componentData.targetMarketValuePerUnit !== null && componentData.targetMarketValuePerUnit > 0
            ? componentData.targetMarketValuePerUnit
            : sourceComp.targetMarketValuePerUnit);

      // Calculate/preserve unresolved legacy reservations before combining histories
      const targetRes = computeUnresolvedLegacyReservation(targetComp, prev.builds);
      const sourceRes = computeUnresolvedLegacyReservation(sourceComp, prev.builds);
      const combinedReservation: Record<string, number> = {};
      for (const [k, v] of Object.entries(targetRes)) {
        if (v > 0) combinedReservation[k] = (combinedReservation[k] || 0) + v;
      }
      for (const [k, v] of Object.entries(sourceRes)) {
        if (v > 0) combinedReservation[k] = (combinedReservation[k] || 0) + v;
      }

      const mergedTarget: InventoryComponent = {
        ...targetComp,
        specifications: finalSpecs,
        targetMarketValuePerUnit: finalTargetMv,
        tags: combinedTags,
        assignedCount: combinedAssignedCount,
        soldCount: combinedSoldCount,
        purchaseHistory: combinedHistory,
        unresolvedLegacyReservationByPurchaseEntryId:
          Object.keys(combinedReservation).length > 0 ? combinedReservation : undefined,
      };

      // 6. Remove source component and update target
      const updatedComponents = prev.components
        .filter((c) => c.id !== sourceComp.id)
        .map((c) => (c.id === targetComp.id ? mergedTarget : c));

      // 7. Rewire live PCBuildPart.componentId and PCBuildPart.componentName references
      const updatedBuilds = (prev.builds || []).map((b) => {
        let buildChanged = false;
        const updatedParts = (b.parts || []).map((p) => {
          if (p.componentId === sourceComp.id) {
            buildChanged = true;
            return {
              ...p,
              componentId: targetComp.id,
              componentName: targetComp.name,
            };
          }
          return p;
        });
        return buildChanged ? { ...b, parts: updatedParts } : b;
      });

      // 8. Rewire live Transaction component references
      const rewiredTransactions = (prev.transactions || []).map((tx) => {
        let txChanged = false;
        let updatedTx = { ...tx };
        if (updatedTx.relatedComponentId === sourceComp.id) {
          updatedTx.relatedComponentId = targetComp.id;
          txChanged = true;
        }
        if (updatedTx.outgoingComponentId === sourceComp.id) {
          updatedTx.outgoingComponentId = targetComp.id;
          txChanged = true;
        }
        if (updatedTx.incomingComponentId === sourceComp.id) {
          updatedTx.incomingComponentId = targetComp.id;
          txChanged = true;
        }
        return txChanged ? updatedTx : tx;
      });

      const finalTransactions = newTx ? [newTx, ...rewiredTransactions] : rewiredTransactions;

      const nextStateObj = {
        ...prev,
        components: updatedComponents,
        builds: updatedBuilds,
        transactions: finalTransactions,
      };
      
      if (JSON.stringify(prev.components) === JSON.stringify(updatedComponents) && 
          JSON.stringify(prev.builds) === JSON.stringify(updatedBuilds) && 
          JSON.stringify(prev.transactions) === JSON.stringify(finalTransactions)) {
        return { nextState: prev, success: true };
      }

      return {
        nextState: nextStateObj,
        success: true
      };
    }

    let newTx: TransactionLogItem | null = null;

    const updatedComponents = prev.components.map((c) => {
      if (c.id === existingComponentId) {
        const { purchaseHistory: updatesPh, tags: updatesTags, ...otherUpdates } = componentData;
        const tags = updatesTags
          ? [...updatesTags]
          : componentData.name
          ? autoTagComponent(componentData.name, componentData.specifications, componentData.category)
          : c.tags;

        let updatedHistory = (c.purchaseHistory || []).map((pe) => ({ ...pe }));

        if (updatedPurchaseEntry) {
          updatedHistory = updatedHistory
            .map((e) =>
              e.id === updatedPurchaseEntry.entryId
                ? {
                    ...e, // Preserve provenance
                    date: updatedPurchaseEntry.entry.date,
                    condition: updatedPurchaseEntry.entry.condition,
                    quantity: validatedUpdatedEntry!.quantity,
                    unitPrice: validatedUpdatedEntry!.unitPrice,
                    totalPrice: validatedUpdatedEntry!.totalPrice,
                    paymentMethod: updatedPurchaseEntry.entry.paymentMethod,
                    platform: updatedPurchaseEntry.entry.platform,
                    taxPercent: validatedUpdatedEntry!.taxPercent,
                    notes: updatedPurchaseEntry.entry.notes || '',
                  }
                : { ...e }
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else if (newPurchaseEntry) {
          const newEntryId = `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const createdEntry: PurchaseEntry = {
            id: newEntryId,
            date: newPurchaseEntry.date,
            condition: newPurchaseEntry.condition,
            quantity: validatedNewEntry!.quantity,
            unitPrice: validatedNewEntry!.unitPrice,
            totalPrice: validatedNewEntry!.totalPrice,
            paymentMethod: newPurchaseEntry.paymentMethod,
            platform: newPurchaseEntry.platform,
            taxPercent: validatedNewEntry!.taxPercent,
            notes: newPurchaseEntry.notes || '',
          };

          newTx = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'PURCHASE',
            title: `Purchased: ${newPurchaseEntry.platform || 'Stock'}`,
            timestamp: newPurchaseEntry.date,
            dateSortable: newPurchaseEntry.date,
            itemCount: 1,
            quantity: validatedNewEntry!.quantity,
            totalAmount: validatedNewEntry!.totalPrice,
            platform: newPurchaseEntry.platform,
            paymentMethod: newPurchaseEntry.paymentMethod,
            itemNameOrSummary: componentData.name || c.name,
            relatedComponentId: existingComponentId,
            relatedComponentQty: validatedNewEntry!.quantity,
          };

          updatedHistory = [{ ...createdEntry }, ...updatedHistory].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }

        let currentReservation = c.unresolvedLegacyReservationByPurchaseEntryId;
        if (newPurchaseEntry) {
          const res = computeUnresolvedLegacyReservation(c, prev.builds);
          if (Object.keys(res).length > 0) {
            currentReservation = res;
          }
        }

        return {
          ...c,
          ...otherUpdates,
          tags,
          purchaseHistory: updatedHistory,
          unresolvedLegacyReservationByPurchaseEntryId: currentReservation,
        };
      }
      return c;
    });

    const nextStateObj = {
      ...prev,
      transactions: newTx ? [newTx, ...prev.transactions] : prev.transactions,
      components: updatedComponents,
    };
    
    if (!newTx && JSON.stringify(prev.components) === JSON.stringify(updatedComponents)) {
      return { nextState: prev, success: true };
    }

    return {
      nextState: nextStateObj,
      success: true
    };
  } else {
    // Brand new component creation
    const fullCompData: Omit<InventoryComponent, 'id' | 'assignedCount'> = {
      ...componentData,
      purchaseHistory: newPurchaseEntry
        ? [
            {
              ...newPurchaseEntry,
              id: `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            } as PurchaseEntry,
          ]
        : componentData.purchaseHistory || [],
    };
    return {
      nextState: handleAddComponent(prev, fullCompData),
      success: true
    };
  }
};

export const handleAddComponent = (
  prev: AppState,
  compData: Omit<InventoryComponent, 'id' | 'assignedCount'>
): AppState => {
  const existingCompIndex = findUniqueCatalogMatchIndex(
    prev.components,
    compData
  );

  const newPurchaseEntries: PurchaseEntry[] = [];
  const newTxs: TransactionLogItem[] = [];
  const existingComp = existingCompIndex !== -1 ? prev.components[existingCompIndex] : null;

  for (let idx = 0; idx < (compData.purchaseHistory || []).length; idx++) {
    const ph = compData.purchaseHistory![idx];
    const quantity = Number(ph.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) return prev;

    const unitPrice = Number(ph.unitPrice);
    const rawTotalPrice = ph.totalPrice ?? null;
    const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * quantity);
    const rawTaxPercent = ph.taxPercent ?? null;
    const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

    if (
      !Number.isFinite(unitPrice) || unitPrice < 0 ||
      !Number.isFinite(totalPrice) || totalPrice < 0 ||
      !Number.isFinite(taxPercent) || taxPercent < 0
    ) return prev;

    const entry: PurchaseEntry = {
      id: ph.id || `pe-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      date: ph.date,
      condition: ph.condition,
      quantity,
      unitPrice,
      totalPrice,
      paymentMethod: ph.paymentMethod,
      platform: ph.platform,
      taxPercent,
      notes: ph.notes || '',
    };
    newPurchaseEntries.push(entry);

    newTxs.push({
      id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'PURCHASE',
      title: `Purchased: ${ph.platform || 'Stock'}`,
      timestamp: ph.date,
      dateSortable: ph.date,
      itemCount: 1,
      quantity,
      totalAmount: totalPrice,
      platform: ph.platform,
      paymentMethod: ph.paymentMethod,
      itemNameOrSummary: compData.name,
      relatedComponentId: existingComp ? existingComp.id : undefined,
      relatedComponentQty: quantity,
    });
  }

  const tags = compData.tags ? [...compData.tags] : autoTagComponent(compData.name, compData.specifications, compData.category);
  const catUpper = String(compData.category || '').toUpperCase();
  if (catUpper === 'CASE' || catUpper === 'PSU') {
    const title = String(compData.name || '');
    if (/\bwhite\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
      tags.push('WHITE');
    }
    if (/\bblack\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
      tags.push('BLACK');
    }
  }

  if (existingComp) {
    const existingIds = new Set((existingComp.purchaseHistory || []).map((e) => e.id));
    const trulyNewEntries = newPurchaseEntries.filter((e) => !existingIds.has(e.id));

    let currentReservation = existingComp.unresolvedLegacyReservationByPurchaseEntryId;
    if (trulyNewEntries.length > 0) {
      const res = computeUnresolvedLegacyReservation(existingComp, prev.builds);
      if (Object.keys(res).length > 0) {
        currentReservation = res;
      }
    }

    const updatedComp: InventoryComponent = {
      ...existingComp,
      purchaseHistory: [
        ...trulyNewEntries.map((pe) => ({ ...pe })),
        ...(existingComp.purchaseHistory || []).map((pe) => ({ ...pe })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      unresolvedLegacyReservationByPurchaseEntryId: currentReservation,
    };
    const newComponents = [...prev.components];
    newComponents[existingCompIndex] = updatedComp;
    return {
      ...prev,
      transactions: [...newTxs, ...prev.transactions],
      components: newComponents,
    };
  } else {
    const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const txsWithCompId = newTxs.map((t) => ({ ...t, relatedComponentId: newCompId }));
    const newComp: InventoryComponent = {
      ...compData,
      id: newCompId,
      assignedCount: 0,
      tags,
      purchaseHistory: newPurchaseEntries.map((pe) => ({ ...pe })),
    };
    return {
      ...prev,
      transactions: [...txsWithCompId, ...prev.transactions],
      components: [newComp, ...prev.components],
    };
  }
};

export const handleAddComponents = (
  prev: AppState,
  compsData: Omit<InventoryComponent, 'id' | 'assignedCount'>[]
): AppState => {
  if (compsData.length === 0) return prev;
  
  // 1. Validate all and map entries
  const parsedComps: {
    compData: Omit<InventoryComponent, 'id' | 'assignedCount'>,
    entries: PurchaseEntry[],
    compTotalQuantity: number,
    compTotalPrice: number
  }[] = [];
  
  let overallTotalAmount = 0;
  let overallTotalQuantity = 0;

  for (const compData of compsData) {
    const entries: PurchaseEntry[] = [];
    let compTotalQuantity = 0;
    let compTotalPrice = 0;
    
    for (let idx = 0; idx < (compData.purchaseHistory || []).length; idx++) {
      const ph = compData.purchaseHistory![idx];
      const quantity = Number(ph.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) return prev;

      const unitPrice = Number(ph.unitPrice);
      const rawTotalPrice = ph.totalPrice ?? null;
      const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * quantity);
      const rawTaxPercent = ph.taxPercent ?? null;
      const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

      if (
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(totalPrice) || totalPrice < 0 ||
        !Number.isFinite(taxPercent) || taxPercent < 0
      ) return prev;

      entries.push({
        id: ph.id || `pe-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
        date: ph.date,
        condition: ph.condition,
        quantity,
        unitPrice,
        totalPrice,
        paymentMethod: ph.paymentMethod,
        platform: ph.platform,
        taxPercent,
        notes: ph.notes || '',
      });
      compTotalQuantity += quantity;
      compTotalPrice += totalPrice;
    }
    
    parsedComps.push({ compData, entries, compTotalQuantity, compTotalPrice });
    overallTotalQuantity += compTotalQuantity || 1; 
    overallTotalAmount += compTotalPrice;
  }

  const componentsToKeep = [...prev.components];
  const newTxs: TransactionLogItem[] = [];
  
  const firstPh = parsedComps[0]?.entries[0];
  const vendor = firstPh?.platform || 'Other';
  const fallbackDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const paymentMethod = firstPh?.paymentMethod || 'Cash';
  
  const allDates = parsedComps.map((c) => c.entries[0]?.date || fallbackDate).sort();
  const oldestDate = allDates[0];
  const newestDate = allDates[allDates.length - 1];
  const displayTimestamp = oldestDate === newestDate ? newestDate : `${oldestDate} - ${newestDate}`;

  const newTx: TransactionLogItem = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'PURCHASE',
    title: `Bulk Purchase: ${vendor}`,
    timestamp: displayTimestamp,
    dateSortable: newestDate,
    itemCount: compsData.length,
    quantity: overallTotalQuantity,
    totalAmount: overallTotalAmount,
    platform: vendor,
    paymentMethod,
    itemNameOrSummary: `Bulk added ${compsData.length} items from ${vendor}`,
    detailsList: parsedComps.map((c) => {
      const qty = c.compTotalQuantity || 1;
      const cost = c.entries.length > 0 ? (c.compTotalPrice / qty) : 0;
      return `${qty}x ${c.compData.name} (${formatCurrency(cost)}/ea)`;
    }),
  };
  newTxs.push(newTx);

  parsedComps.forEach(({ compData, entries }) => {
    const existingCompIndex = findUniqueCatalogMatchIndex(componentsToKeep, compData);
    
    const tags = compData.tags ? [...compData.tags] : autoTagComponent(compData.name, compData.specifications, compData.category);
    const catUpper = String(compData.category || '').toUpperCase();
    if (catUpper === 'CASE' || catUpper === 'PSU') {
      const title = String(compData.name || '');
      if (/\bwhite\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
        tags.push('WHITE');
      }
      if (/\bblack\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
        tags.push('BLACK');
      }
    }

    if (existingCompIndex !== -1) {
      const existingComp = componentsToKeep[existingCompIndex];
      const existingIds = new Set((existingComp.purchaseHistory || []).map((e) => e.id));
      const trulyNewEntries = entries.filter((e) => !existingIds.has(e.id));

      let currentReservation = existingComp.unresolvedLegacyReservationByPurchaseEntryId;
      if (trulyNewEntries.length > 0) {
        const res = computeUnresolvedLegacyReservation(existingComp, prev.builds);
        if (Object.keys(res).length > 0) {
          currentReservation = res;
        }
      }

      const updatedComp: InventoryComponent = {
        ...existingComp,
        purchaseHistory: [
          ...trulyNewEntries,
          ...(existingComp.purchaseHistory || []),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        unresolvedLegacyReservationByPurchaseEntryId: currentReservation,
      };
      componentsToKeep[existingCompIndex] = updatedComp;
    } else {
      const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newComp: InventoryComponent = {
        ...compData,
        id: newCompId,
        assignedCount: 0,
        tags,
        purchaseHistory: entries,
      };
      componentsToKeep.push(newComp);
    }
  });

  return {
    ...prev,
    transactions: [...newTxs, ...prev.transactions],
    components: componentsToKeep,
  };
};
export const handleUpdateComponent = (
  prev: AppState,
  id: string,
  updates: Partial<InventoryComponent>
): AppState => {
  const targetIndex = prev.components.findIndex((c) => c.id === id);
  if (targetIndex < 0) return prev;

  const target = prev.components[targetIndex];
  const { purchaseHistory: updatesPh, tags: updatesTags, ...otherUpdates } = updates;
  const updatedComponent: InventoryComponent = {
    ...target,
    ...otherUpdates,
    tags: updatesTags ? [...updatesTags] : target.tags ? [...target.tags] : undefined,
    purchaseHistory: updatesPh
      ? updatesPh.map((pe) => ({ ...pe }))
      : (target.purchaseHistory || []).map((pe) => ({ ...pe })),
  };

  if (JSON.stringify(updatedComponent) === JSON.stringify(target)) {
    return prev;
  }

  const components = [...prev.components];
  components[targetIndex] = updatedComponent;
  return { ...prev, components };
};

export const handleDeleteComponent = (
  prev: AppState, 
  id: string
): { nextState: AppState; success: boolean; error?: string } => {
  const existing = prev.components.find((c) => c.id === id);
  if (!existing) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }

  const batches = getAllBatchesWithRemaining(existing, prev.builds);

  // 4. Handle unresolved legacy allocations conservatively
  const explicitSum = batches.reduce((sum, b) => sum + b.allocatedQuantity, 0);
  let unlinkedFromBuilds = 0;
  (prev.builds || []).forEach(b => {
    (b.parts || []).forEach(p => {
      if (p.componentId === id) {
        const qty = Number(p.quantity) || 0;
        if (!p.purchaseEntryId || !existing.purchaseHistory?.some(e => e.id === p.purchaseEntryId)) {
          unlinkedFromBuilds += qty;
        }
      }
    });
  });
  const unlinkedAssigned = Math.max(0, (Number(existing.assignedCount) || 0) - explicitSum, unlinkedFromBuilds);
  if (unlinkedAssigned > 0) {
    return { nextState: prev, success: false, error: `Cannot delete component. It has ${unlinkedAssigned} unresolved legacy allocations.` };
  }

  const totalUsed = batches.reduce((sum, b) => sum + (Number(b.entry.quantity) - b.availableQuantity), 0);
  if (totalUsed > 0) {
    return { nextState: prev, success: false, error: `Cannot delete component. ${totalUsed} units are currently allocated to live builds.` };
  }

  return {
    nextState: {
      ...prev,
      components: prev.components.filter((c) => c.id !== id),
    },
    success: true
  };
};

export const handleAddPurchaseEntry = (
  prev: AppState,
  componentId: string,
  entry: Omit<PurchaseEntry, 'id'>
): AppState => {
  const targetComp = prev.components.find((c) => c.id === componentId);
  if (!targetComp) return prev;
  const compName = targetComp.name;

  const quantity = Number(entry.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) return prev;

  const unitPrice = Number(entry.unitPrice);
  const rawTotalPrice = entry.totalPrice ?? null;
  const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * quantity);
  const rawTaxPercent = entry.taxPercent ?? null;
  const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

  if (
    !Number.isFinite(unitPrice) || unitPrice < 0 ||
    !Number.isFinite(totalPrice) || totalPrice < 0 ||
    !Number.isFinite(taxPercent) || taxPercent < 0
  ) return prev;

  const newEntryId = `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newPurchaseEntry: PurchaseEntry = {
    id: newEntryId,
    date: entry.date,
    condition: entry.condition,
    quantity,
    unitPrice,
    totalPrice,
    paymentMethod: entry.paymentMethod,
    platform: entry.platform,
    taxPercent,
    notes: entry.notes || '',
  };

  const newTx: TransactionLogItem = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'PURCHASE',
    title: `Purchased: ${entry.platform || 'Stock'}`,
    timestamp: entry.date,
    dateSortable: entry.date,
    itemCount: 1,
    quantity,
    totalAmount: totalPrice,
    platform: entry.platform,
    paymentMethod: entry.paymentMethod,
    itemNameOrSummary: compName,
    relatedComponentId: componentId,
    relatedComponentQty: quantity,
  };

  return {
    ...prev,
    transactions: [newTx, ...prev.transactions],
    components: prev.components.map((c) => {
      if (c.id === componentId) {
        const res = computeUnresolvedLegacyReservation(c, prev.builds);
        return {
          ...c,
          purchaseHistory: [
            { ...newPurchaseEntry },
            ...(c.purchaseHistory || []).map((pe) => ({ ...pe })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          unresolvedLegacyReservationByPurchaseEntryId:
            Object.keys(res).length > 0 ? res : c.unresolvedLegacyReservationByPurchaseEntryId,
        };
      }
      return c;
    }),
  };
};

export const handleUpdatePurchaseEntry = (
  prev: AppState,
  componentId: string,
  entryId: string,
  entry: Omit<PurchaseEntry, 'id'>
): { nextState: AppState; success: boolean; error?: string } => {
  const existing = prev.components.find((c) => c.id === componentId);
  if (!existing) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }

  const newQty = Number(entry.quantity);
  if (!Number.isFinite(newQty) || newQty <= 0 || !Number.isInteger(newQty)) {
    return { nextState: prev, success: false, error: 'Quantity must be a positive whole number.' };
  }

  const unitPrice = Number(entry.unitPrice);
  const rawTotalPrice = entry.totalPrice ?? null;
  const totalPrice = rawTotalPrice !== null ? Number(rawTotalPrice) : (unitPrice * newQty);
  const rawTaxPercent = entry.taxPercent ?? null;
  const taxPercent = rawTaxPercent !== null ? Number(rawTaxPercent) : 0;

  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { nextState: prev, success: false, error: 'Unit price must be a non-negative number.' };
  if (!Number.isFinite(totalPrice) || totalPrice < 0) return { nextState: prev, success: false, error: 'Total price must be a non-negative number.' };
  if (!Number.isFinite(taxPercent) || taxPercent < 0) return { nextState: prev, success: false, error: 'Tax percent must be a non-negative number.' };

  const batches = getAllBatchesWithRemaining(existing, prev.builds);
  const batch = batches.find(b => b.entry.id === entryId);
  if (!batch) {
    return { nextState: prev, success: false, error: 'Purchase entry not found.' };
  }

  const explicitSum = batches.reduce((sum, b) => sum + b.allocatedQuantity, 0);
  let unlinkedFromBuilds = 0;
  (prev.builds || []).forEach(b => {
    (b.parts || []).forEach(p => {
      if (p.componentId === componentId) {
        const qty = Number(p.quantity) || 0;
        if (!p.purchaseEntryId || !existing.purchaseHistory?.some(e => e.id === p.purchaseEntryId)) {
          unlinkedFromBuilds += qty;
        }
      }
    });
  });
  const unlinkedAssigned = Math.max(0, (Number(existing.assignedCount) || 0) - explicitSum, unlinkedFromBuilds);
  if (unlinkedAssigned > 0 && newQty < Number(batch.entry.quantity)) {
    return { nextState: prev, success: false, error: `Cannot reduce quantity. Component has ${unlinkedAssigned} unresolved legacy allocations.` };
  }

  const totalUsed = Number(batch.entry.quantity) - batch.availableQuantity;
  if (newQty < totalUsed) {
    return { nextState: prev, success: false, error: `Cannot reduce quantity below ${totalUsed}. These units are currently allocated to live builds.` };
  }
  
  // Check no-op
  const existingEntry = batch.entry;
  if (
    existingEntry.date === entry.date &&
    existingEntry.condition === entry.condition &&
    Number(existingEntry.quantity) === newQty &&
    Number(existingEntry.unitPrice) === unitPrice &&
    Number(existingEntry.totalPrice) === totalPrice &&
    existingEntry.paymentMethod === entry.paymentMethod &&
    existingEntry.platform === entry.platform &&
    Number(existingEntry.taxPercent ?? 0) === taxPercent &&
    (existingEntry.notes || '') === (entry.notes || '')
  ) {
    return { nextState: prev, success: true };
  }

  return {
    nextState: {
      ...prev,
      components: prev.components.map((c) => {
        if (c.id === componentId) {
          return {
            ...c,
            purchaseHistory: (c.purchaseHistory || [])
              .map((e) =>
                e.id === entryId
                  ? {
                      ...e, // Preserve provenance
                      date: entry.date,
                      condition: entry.condition,
                      quantity: newQty,
                      unitPrice: unitPrice,
                      totalPrice: totalPrice,
                      paymentMethod: entry.paymentMethod,
                      platform: entry.platform,
                      taxPercent: taxPercent,
                      notes: entry.notes || '',
                    }
                  : { ...e }
              )
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          };
        }
        return c;
      }),
    },
    success: true
  };
};

export const handleDeletePurchaseEntry = (
  prev: AppState,
  componentId: string,
  entryId: string
): { nextState: AppState; success: boolean; error?: string } => {
  const existing = prev.components.find((c) => c.id === componentId);
  if (!existing) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }

  const batches = getAllBatchesWithRemaining(existing, prev.builds);
  const batch = batches.find(b => b.entry.id === entryId);
  
  if (!batch) {
    return { nextState: prev, success: false, error: 'Purchase entry not found.' };
  }

  const explicitSum = batches.reduce((sum, b) => sum + b.allocatedQuantity, 0);
  let unlinkedFromBuilds = 0;
  (prev.builds || []).forEach(b => {
    (b.parts || []).forEach(p => {
      if (p.componentId === componentId) {
        const qty = Number(p.quantity) || 0;
        if (!p.purchaseEntryId || !existing.purchaseHistory?.some(e => e.id === p.purchaseEntryId)) {
          unlinkedFromBuilds += qty;
        }
      }
    });
  });
  const unlinkedAssigned = Math.max(0, (Number(existing.assignedCount) || 0) - explicitSum, unlinkedFromBuilds);
  if (unlinkedAssigned > 0) {
    return { nextState: prev, success: false, error: `Cannot delete purchase entry. Component has ${unlinkedAssigned} unresolved legacy allocations.` };
  }

  const totalUsed = Number(batch.entry.quantity) - batch.availableQuantity;
  if (totalUsed > 0) {
    return { nextState: prev, success: false, error: `Cannot delete purchase entry. ${totalUsed} units are currently allocated to live builds.` };
  }

  return {
    nextState: {
      ...prev,
      components: prev.components.map((c) => {
        if (c.id === componentId) {
          return {
            ...c,
            purchaseHistory: (c.purchaseHistory || [])
              .filter((e) => e.id !== entryId)
              .map((pe) => ({ ...pe })),
          };
        }
        return c;
      }),
    },
    success: true
  };
};

export const handleUpdateMarketValue = (
  prev: AppState,
  componentId: string,
  value: number
): AppState => {
  if (!Number.isFinite(value) || value < 0) return prev;
  const targetIndex = prev.components.findIndex((c) => c.id === componentId);
  if (targetIndex < 0 || prev.components[targetIndex].targetMarketValuePerUnit === value) {
    return prev;
  }

  const components = [...prev.components];
  components[targetIndex] = {
    ...components[targetIndex],
    targetMarketValuePerUnit: value,
  };
  return { ...prev, components };
};

export const handleSellComponentPart = (
  prev: AppState,
  componentId: string,
  purchaseEntryId: string,
  saleData: SellComponentPartData
): { nextState: AppState; success: boolean; error?: string } => {
  const targetComp = prev.components.find((c) => c.id === componentId);
  if (!targetComp) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }
  const purchaseEntry = (targetComp.purchaseHistory || []).find((e) => e.id === purchaseEntryId);
  if (!purchaseEntry) {
    return { nextState: prev, success: false, error: 'Purchase entry not found.' };
  }

  if (!Number.isFinite(saleData.quantity) || !Number.isInteger(saleData.quantity) || saleData.quantity <= 0) {
    return { nextState: prev, success: false, error: 'Quantity must be a positive whole number.' };
  }

  const batches = getAllBatchesWithRemaining(targetComp, prev.builds);
  const batchInfo = batches.find((b) => b.entry.id === purchaseEntryId);
  if (!batchInfo || batchInfo.availableQuantity < saleData.quantity) {
    return { nextState: prev, success: false, error: 'Requested quantity exceeds available unassigned stock in this batch.' };
  }

  if (!Number.isFinite(saleData.unitSalePrice) || saleData.unitSalePrice <= 0) {
    return { nextState: prev, success: false, error: 'Unit sale price must be a finite positive number.' };
  }

  const unitCost = purchaseEntry.unitPrice;
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return { nextState: prev, success: false, error: 'Purchase entry unit cost must be a finite non-negative number.' };
  }

  const totalAmount = saleData.unitSalePrice * saleData.quantity;
  const totalCost = unitCost * saleData.quantity;
  const profit = totalAmount - totalCost;

  if (!Number.isFinite(totalAmount) || !Number.isFinite(totalCost) || !Number.isFinite(profit)) {
    return { nextState: prev, success: false, error: 'Calculated sale amounts must be finite.' };
  }

  let txTitle = `Part Sold: ${targetComp.name}`;
  let cashPortion: number | undefined = undefined;
  let tradeInCredit: number | undefined = undefined;

  if (saleData.incomingTradePart) {
    const tradePart = saleData.incomingTradePart;
    if (!tradePart.name || !tradePart.name.trim()) {
      return { nextState: prev, success: false, error: 'Incoming trade-in part name cannot be empty.' };
    }
    if (!COMPONENT_CATEGORIES.includes(tradePart.category)) {
      return { nextState: prev, success: false, error: 'Invalid incoming trade-in part category.' };
    }
    if (!Number.isFinite(tradePart.tradeInCredit) || tradePart.tradeInCredit <= 0) {
      return { nextState: prev, success: false, error: 'Trade-in credit must be a finite number greater than zero.' };
    }
    if (tradePart.tradeInCredit > totalAmount) {
      return { nextState: prev, success: false, error: 'Trade-in credit cannot exceed total sale amount.' };
    }

    tradeInCredit = tradePart.tradeInCredit;
    cashPortion = totalAmount - tradeInCredit;
    if (!Number.isFinite(cashPortion) || cashPortion < 0) {
      return { nextState: prev, success: false, error: 'Resulting cash portion must be a finite non-negative number.' };
    }

    txTitle = `Part Sold: ${targetComp.name} (${formatCurrency(cashPortion)} Cash + ${formatCurrency(tradeInCredit)} Trade-In)`;
  }

  const saleTx: TransactionLogItem = {
    profitMargin: profit,
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'SALE',
    title: txTitle,
    timestamp: saleData.saleDate,
    dateSortable: saleData.saleDate,
    itemCount: 1,
    quantity: saleData.quantity,
    totalAmount,
    platform: saleData.platform,
    paymentMethod: saleData.paymentMethod,
    buyerName: saleData.buyerName?.trim() || undefined,
    itemNameOrSummary: targetComp.name,
    relatedComponentId: targetComp.id,
    relatedPurchaseEntryId: purchaseEntry.id,
    relatedComponentQty: saleData.quantity,
    soldUnitCost: unitCost,
    originalPurchaseEntrySnapshot: { ...purchaseEntry },
    notes: saleData.notes?.trim() || undefined,
    cashPortion,
    tradeInCredit,
  };

  let updatedComponents = prev.components.map((c) => {
    if (c.id === componentId) {
      const updatedHistory = (c.purchaseHistory || [])
        .map((pe) => {
          if (pe.id === purchaseEntryId) {
            const newQty = pe.quantity - saleData.quantity;
            if (newQty <= 0) return null;
            return {
              ...pe,
              quantity: newQty,
              totalPrice: newQty * pe.unitPrice,
            };
          }
          return pe;
        })
        .filter((pe): pe is PurchaseEntry => pe !== null);

      return {
        ...c,
        purchaseHistory: updatedHistory,
        soldCount: (c.soldCount || 0) + saleData.quantity,
      };
    }
    return c;
  });

  if (saleData.incomingTradePart) {
    const tradePart = saleData.incomingTradePart;
    const tradeDate = saleData.saleDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const newPurchaseEntryId = `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newPurchaseEntry: PurchaseEntry = {
      id: newPurchaseEntryId,
      date: tradeDate,
      condition: 'Used',
      quantity: 1,
      unitPrice: Number(tradePart.tradeInCredit),
      totalPrice: Number(tradePart.tradeInCredit),
      paymentMethod: saleData.paymentMethod || 'Cash',
      platform: 'Part Trade-In',
      taxPercent: 0,
      notes: `Trade-in from sale of ${targetComp.name}`,
    };

    const existingCompIndex = updatedComponents.findIndex(
      (c) =>
        String(c.name || '').trim().toLowerCase() === String(tradePart.name || '').trim().toLowerCase() &&
        c.category === tradePart.category
    );

    if (existingCompIndex !== -1) {
      const existingComp = updatedComponents[existingCompIndex];
      const res = computeUnresolvedLegacyReservation(existingComp, prev.builds);
      const updatedComp: InventoryComponent = {
        ...existingComp,
        purchaseHistory: [
          newPurchaseEntry,
          ...(existingComp.purchaseHistory || []).map((pe) => ({ ...pe })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        unresolvedLegacyReservationByPurchaseEntryId:
          Object.keys(res).length > 0 ? res : existingComp.unresolvedLegacyReservationByPurchaseEntryId,
      };
      
      if (tradePart.tags && tradePart.tags.length > 0) {
        const existingTags = existingComp.tags || [];
        updatedComp.tags = Array.from(new Set([...existingTags, ...tradePart.tags]));
      }

      const newCompsList = [...updatedComponents];
      newCompsList[existingCompIndex] = updatedComp;
      updatedComponents = newCompsList;
    } else {
      let tags: string[];
      if (tradePart.tags && tradePart.tags.length > 0) {
        tags = [...tradePart.tags];
      } else {
        tags = autoTagComponent(tradePart.name, '', tradePart.category);
        const catUpper = String(tradePart.category || '').toUpperCase();
        if (catUpper === 'CASE' || catUpper === 'PSU') {
          const title = String(tradePart.name || '');
          if (/\bwhite\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
            tags.push('WHITE');
          }
          if (/\bblack\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
            tags.push('BLACK');
          }
        }
      }

      const newComp: InventoryComponent = {
        id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: tradePart.name.trim(),
        category: tradePart.category,
        specifications: '',
        tags,
        assignedCount: 0,
        soldCount: 0,
        purchaseHistory: [newPurchaseEntry],
        targetMarketValuePerUnit: Number(tradePart.tradeInCredit) * 1.3,
      };
      updatedComponents = [newComp, ...updatedComponents];
    }
  }

  return {
    nextState: {
      ...prev,
      transactions: [saleTx, ...prev.transactions],
      components: updatedComponents,
    },
    success: true,
  };
};

export const handleSellComponentPartsBulk = (
  prev: AppState,
  lines: BulkSaleLine[],
  sharedData: BulkSaleSharedData
): { nextState: AppState; success: boolean; error?: string } => {
  if (!lines || lines.length === 0) {
    return { nextState: prev, success: false, error: 'No sale lines provided.' };
  }

  // 1. Check for duplicate (componentId + purchaseEntryId) pairs
  const seenKeys = new Set<string>();
  for (const line of lines) {
    const key = `${line.componentId}::${line.purchaseEntryId}`;
    if (seenKeys.has(key)) {
      return { nextState: prev, success: false, error: 'Duplicate component and purchase batch in sale lines.' };
    }
    seenKeys.add(key);
  }

  // 2. Validate all lines against current state
  const validatedLines: {
    line: BulkSaleLine;
    component: InventoryComponent;
    purchaseEntry: PurchaseEntry;
    lineRevenue: number;
    lineCost: number;
  }[] = [];

  let totalRevenue = 0;
  let totalCost = 0;

  for (const line of lines) {
    const qty = line.quantity;
    const unitPrice = line.unitSalePrice;

    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      return { nextState: prev, success: false, error: 'Quantity must be a positive whole number for all items.' };
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { nextState: prev, success: false, error: 'Unit sale price must be a finite non-negative number for all items.' };
    }

    const component = prev.components.find((c) => c.id === line.componentId);
    if (!component) {
      return { nextState: prev, success: false, error: 'Component not found.' };
    }

    const purchaseEntry = (component.purchaseHistory || []).find((pe) => pe.id === line.purchaseEntryId);
    if (!purchaseEntry) {
      return { nextState: prev, success: false, error: `Purchase batch not found for component ${component.name}.` };
    }

    if (!Number.isFinite(purchaseEntry.unitPrice) || purchaseEntry.unitPrice < 0) {
      return { nextState: prev, success: false, error: `Invalid batch unit cost for component ${component.name}.` };
    }

    // Check available unassigned quantity in this exact batch
    const batches = getAllBatchesWithRemaining(component, prev.builds);
    const batchInfo = batches.find((b) => b.entry.id === line.purchaseEntryId);
    if (!batchInfo || batchInfo.availableQuantity < qty) {
      return { nextState: prev, success: false, error: `Quantity for ${component.name} exceeds available stock in this batch.` };
    }

    const lineRev = unitPrice * qty;
    const lineC = purchaseEntry.unitPrice * qty;
    if (!Number.isFinite(lineRev) || !Number.isFinite(lineC) || !Number.isFinite(lineRev - lineC)) {
      return { nextState: prev, success: false, error: `Calculated values for ${component.name} must be finite.` };
    }

    totalRevenue += lineRev;
    totalCost += lineC;

    validatedLines.push({
      line: { ...line, quantity: qty, unitSalePrice: unitPrice },
      component,
      purchaseEntry,
      lineRevenue: lineRev,
      lineCost: lineC,
    });
  }

  if (!Number.isFinite(totalRevenue) || !Number.isFinite(totalCost) || !Number.isFinite(totalRevenue - totalCost)) {
    return { nextState: prev, success: false, error: 'Accumulated totals must be finite numbers.' };
  }

  // 3. Generate shared bulkSaleGroupId
  const bulkSaleGroupId = `bsg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const saleDate = sharedData.saleDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const buyerName = sharedData.buyerName?.trim() || undefined;
  const notes = sharedData.notes?.trim() || undefined;

  // 4. Create one SALE transaction per line
  const newTransactions: TransactionLogItem[] = validatedLines.map((vl, idx) => {
    const profit = vl.lineRevenue - vl.lineCost;
    const txId = `tx-bs-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      id: txId,
      type: 'SALE',
      title: `Part Sold: ${vl.component.name}`,
      timestamp: saleDate,
      dateSortable: saleDate,
      itemCount: 1,
      quantity: vl.line.quantity,
      totalAmount: vl.lineRevenue,
      profitMargin: profit,
      platform: sharedData.platform,
      paymentMethod: sharedData.paymentMethod,
      buyerName,
      itemNameOrSummary: vl.component.name,
      relatedComponentId: vl.component.id,
      relatedPurchaseEntryId: vl.purchaseEntry.id,
      relatedComponentQty: vl.line.quantity,
      soldUnitCost: vl.purchaseEntry.unitPrice,
      bulkSaleGroupId,
      originalPurchaseEntrySnapshot: { ...vl.purchaseEntry },
      notes,
    };
  });

  // 5. Update components atomically
  const qtyReductionsByBatch = new Map<string, number>();
  const soldCountAdditionsByComp = new Map<string, number>();

  for (const vl of validatedLines) {
    const key = `${vl.component.id}::${vl.purchaseEntry.id}`;
    qtyReductionsByBatch.set(key, (qtyReductionsByBatch.get(key) || 0) + vl.line.quantity);
    soldCountAdditionsByComp.set(
      vl.component.id,
      (soldCountAdditionsByComp.get(vl.component.id) || 0) + vl.line.quantity
    );
  }

  const updatedComponents = prev.components.map((c) => {
    if (!soldCountAdditionsByComp.has(c.id)) {
      return c;
    }

    const soldCountDelta = soldCountAdditionsByComp.get(c.id) || 0;
    const updatedHistory = (c.purchaseHistory || [])
      .map((pe) => {
        const batchKey = `${c.id}::${pe.id}`;
        const reduceQty = qtyReductionsByBatch.get(batchKey);
        if (reduceQty !== undefined && reduceQty > 0) {
          const newQty = pe.quantity - reduceQty;
          if (newQty <= 0) return null;
          return {
            ...pe,
            quantity: newQty,
            totalPrice: newQty * pe.unitPrice,
          };
        }
        return pe;
      })
      .filter((pe): pe is PurchaseEntry => pe !== null);

    return {
      ...c,
      purchaseHistory: updatedHistory,
      soldCount: (c.soldCount || 0) + soldCountDelta,
    };
  });

  return {
    nextState: {
      ...prev,
      transactions: [...newTransactions, ...prev.transactions],
      components: updatedComponents,
    },
    success: true,
  };
};

export const handleExchangeComponentPart = (
  prev: AppState,
  outgoingComponentId: string,
  outgoingPurchaseEntryId: string,
  exchangeData: ExchangeComponentPartData
): { nextState: AppState; success: boolean; error?: string } => {
  const targetComp = prev.components.find((c) => c.id === outgoingComponentId);
  if (!targetComp) {
    return { nextState: prev, success: false, error: 'Outgoing component not found.' };
  }
  const purchaseEntry = (targetComp.purchaseHistory || []).find((e) => e.id === outgoingPurchaseEntryId);
  if (!purchaseEntry) {
    return { nextState: prev, success: false, error: 'Outgoing purchase batch not found.' };
  }

  if (!Number.isFinite(exchangeData.quantity) || !Number.isInteger(exchangeData.quantity) || exchangeData.quantity <= 0) {
    return { nextState: prev, success: false, error: 'Quantity must be a positive whole number.' };
  }

  const batches = getAllBatchesWithRemaining(targetComp, prev.builds);
  const batchInfo = batches.find((b) => b.entry.id === outgoingPurchaseEntryId);
  if (!batchInfo || batchInfo.availableQuantity < exchangeData.quantity) {
    return { nextState: prev, success: false, error: 'Requested quantity exceeds available unassigned stock in this batch.' };
  }

  const outgoingUnitCost = purchaseEntry.unitPrice;
  if (!Number.isFinite(outgoingUnitCost) || outgoingUnitCost < 0) {
    return { nextState: prev, success: false, error: 'Outgoing batch unit cost must be a finite non-negative number.' };
  }

  if (!Number.isFinite(exchangeData.cashPaidOnTop) || exchangeData.cashPaidOnTop < 0) {
    return { nextState: prev, success: false, error: 'Cash paid on top must be a finite non-negative number.' };
  }
  const cashPaidOnTop = exchangeData.cashPaidOnTop;

  if (!exchangeData.incomingPart || !exchangeData.incomingPart.name || !exchangeData.incomingPart.name.trim()) {
    return { nextState: prev, success: false, error: 'Incoming component name cannot be empty.' };
  }

  if (!COMPONENT_CATEGORIES.includes(exchangeData.incomingPart.category)) {
    return { nextState: prev, success: false, error: 'Invalid incoming component category.' };
  }

  const outgoingCostBasis = outgoingUnitCost * exchangeData.quantity;
  const incomingCostBasis = outgoingCostBasis + cashPaidOnTop;

  if (!Number.isFinite(outgoingCostBasis) || !Number.isFinite(incomingCostBasis)) {
    return { nextState: prev, success: false, error: 'Calculated cost basis must be finite.' };
  }

  const exchangeDate = exchangeData.exchangeDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const incomingPart = exchangeData.incomingPart;

  const newPurchaseEntryId = `pe-tradeup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newPurchaseEntry: PurchaseEntry = {
    id: newPurchaseEntryId,
    date: exchangeDate,
    condition: 'Used',
    quantity: 1,
    unitPrice: incomingCostBasis,
    totalPrice: incomingCostBasis,
    paymentMethod: exchangeData.paymentMethod || 'Cash',
    platform: exchangeData.platform || 'Trade Up',
    taxPercent: 0,
    notes: exchangeData.notes ? `Trade Up from ${targetComp.name}: ${exchangeData.notes}` : `Trade Up from ${targetComp.name} (Outgoing basis: $${outgoingCostBasis.toFixed(2)} + $${cashPaidOnTop.toFixed(2)} cash paid)`,
  };

  // 1. Remove outgoing part quantity from exact purchase batch (preserving exact batch identity)
  let updatedComponents = prev.components.map((c) => {
    if (c.id === outgoingComponentId) {
      const updatedHistory = (c.purchaseHistory || [])
        .map((pe) => {
          if (pe.id === outgoingPurchaseEntryId) {
            const newQty = pe.quantity - exchangeData.quantity;
            if (newQty <= 0) return null;
            return {
              ...pe,
              quantity: newQty,
              totalPrice: newQty * pe.unitPrice,
            };
          }
          return pe;
        })
        .filter((pe): pe is PurchaseEntry => pe !== null);

      return {
        ...c,
        purchaseHistory: updatedHistory,
        // Do NOT increment soldCount on exchange - this is an inventory transfer, not a loose part sale
      };
    }
    return c;
  });

  // 2. Add incoming component / batch with new cost basis
  let targetIncomingCompId = '';
  const existingCompIndex = updatedComponents.findIndex(
    (c) =>
      String(c.name || '').trim().toLowerCase() === String(incomingPart.name || '').trim().toLowerCase() &&
      c.category === incomingPart.category
  );

  if (existingCompIndex !== -1) {
    const existingComp = updatedComponents[existingCompIndex];
    targetIncomingCompId = existingComp.id;
    const res = computeUnresolvedLegacyReservation(existingComp, prev.builds);
    const updatedComp: InventoryComponent = {
      ...existingComp,
      purchaseHistory: [
        newPurchaseEntry,
        ...(existingComp.purchaseHistory || []).map((pe) => ({ ...pe })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      unresolvedLegacyReservationByPurchaseEntryId:
        Object.keys(res).length > 0 ? res : existingComp.unresolvedLegacyReservationByPurchaseEntryId,
    };

    if (incomingPart.tags && incomingPart.tags.length > 0) {
      const existingTags = existingComp.tags || [];
      updatedComp.tags = Array.from(new Set([...existingTags, ...incomingPart.tags]));
    }

    const newCompsList = [...updatedComponents];
    newCompsList[existingCompIndex] = updatedComp;
    updatedComponents = newCompsList;
  } else {
    let tags: string[];
    if (incomingPart.tags && incomingPart.tags.length > 0) {
      tags = [...incomingPart.tags];
    } else {
      tags = autoTagComponent(incomingPart.name, '', incomingPart.category);
      const catUpper = String(incomingPart.category || '').toUpperCase();
      if (catUpper === 'CASE' || catUpper === 'PSU') {
        const title = String(incomingPart.name || '');
        if (/\bwhite\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
          tags.push('WHITE');
        }
        if (/\bblack\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
          tags.push('BLACK');
        }
      }
    }

    targetIncomingCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newComp: InventoryComponent = {
      id: targetIncomingCompId,
      name: incomingPart.name.trim(),
      category: incomingPart.category,
      specifications: '',
      tags,
      assignedCount: 0,
      soldCount: 0,
      purchaseHistory: [newPurchaseEntry],
      targetMarketValuePerUnit: incomingCostBasis * 1.25,
    };
    updatedComponents = [newComp, ...updatedComponents];
  }

  // 3. Create EXCHANGE transaction (not a SALE)
  const exchangeTx: TransactionLogItem = {
    id: `tx-ex-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'EXCHANGE',
    title: `Trade Up: ${targetComp.name} → ${incomingPart.name}`,
    timestamp: exchangeDate,
    dateSortable: exchangeDate,
    itemCount: 1,
    quantity: 1,
    totalAmount: cashPaidOnTop, // Cash outflow is cash paid on top
    profitMargin: 0, // Realized profit/loss is $0.00
    platform: exchangeData.platform || 'Trade Up',
    paymentMethod: exchangeData.paymentMethod || 'Cash',
    itemNameOrSummary: `${targetComp.name} → ${incomingPart.name}`,
    detailsList: [
      `Outgoing: ${exchangeData.quantity}x ${targetComp.name} ($${outgoingUnitCost.toFixed(2)}/ea batch cost = $${outgoingCostBasis.toFixed(2)})`,
      `Cash Paid on Top: $${cashPaidOnTop.toFixed(2)}`,
      `Incoming: 1x ${incomingPart.name} (New Cost Basis: $${incomingCostBasis.toFixed(2)})`,
    ],
    relatedComponentId: targetComp.id,
    relatedComponentQty: exchangeData.quantity,
    outgoingComponentId,
    outgoingPurchaseEntryId,
    outgoingQuantity: exchangeData.quantity,
    outgoingCostBasis,
    cashPaidOnTop,
    incomingComponentId: targetIncomingCompId,
    incomingPurchaseEntryId: newPurchaseEntryId,
    incomingCostBasis,
    exchangeType: 'TRADE_UP',
    notes: exchangeData.notes || undefined,
  };

  return {
    nextState: {
      ...prev,
      transactions: [exchangeTx, ...prev.transactions],
      components: updatedComponents,
    },
    success: true,
  };
};
