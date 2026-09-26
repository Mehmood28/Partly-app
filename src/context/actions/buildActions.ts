import {
  AppState,
  ComponentCategory,
  InventoryComponent,
  PaymentMethod,
  PCBuild,
  PCBuildPart,
  PurchaseEntry,
  TransactionLogItem,
} from '../../types';
import { autoTagComponent, calculateBuildPartsCost, calculateUnassignedQuantityStrict, computeUnresolvedLegacyReservation, formatCurrency, getPurchaseEntryRemainingQuantity, getUnassignedBatches, parseDateLocal } from '../../utils/helpers';
import { getBuildPresentation } from '../../utils/buildPresentation';
import { AcquiredPCComponentInput, PurchasePCData, SellBuildData } from '../types';
import {
  canDeleteBuildDraft,
  canDismantleBuild,
  findLinkedSaleTransaction,
  getSaleTradeInEditState,
  isTradeInBuildPristine,
  validateCostBreakdownAccounting,
  validatePartOutAccounting,
  validateItemizationAccounting
} from '../../utils/buildEligibility';
import { BUILD_WARRANTY_DAYS, isValidWarrantyDays, normalizeWarrantyDays } from '../../utils/warranty';
import { resolveTradeInBuildOrigin } from '../../utils/tradeInOrigin';
import { getAcquiredPCBreakdown, isAcquiredPC, isPurchasedPC } from '../../utils/acquiredPC';
import { generateBuildTitleFromParts } from '../../utils/buildTitle';

export const handleAddBuild = (
  prev: AppState,
  build: Omit<PCBuild, 'id' | 'createdDate'>
): AppState => {
  if ('warrantyDays' in build && build.warrantyDays !== undefined && build.warrantyDays !== null) {
    if (!isValidWarrantyDays(build.warrantyDays)) {
      return prev;
    }
  }

  const resolvedWarranty = normalizeWarrantyDays(build.warrantyDays, BUILD_WARRANTY_DAYS);

  // New builds are modern records: every allocated part must resolve to one exact
  // component and purchase batch, and the aggregate request must fit the batch's
  // strict availability (including unresolved legacy reservations).
  const requestedByBatch = new Map<string, number>();
  const validatedParts: PCBuildPart[] = [];
  for (const part of build.parts || []) {
    if (
      typeof part.quantity !== 'number' ||
      !Number.isFinite(part.quantity) ||
      !Number.isInteger(part.quantity) ||
      part.quantity <= 0 ||
      typeof part.componentId !== 'string' ||
      !part.componentId.trim() ||
      typeof part.purchaseEntryId !== 'string' ||
      !part.purchaseEntryId.trim()
    ) {
      return prev;
    }

    const componentMatches = prev.components.filter((c) => c.id === part.componentId);
    if (componentMatches.length !== 1) return prev;
    const component = componentMatches[0];
    if (component.assignedCount !== undefined && component.assignedCount !== null) {
      if (
        typeof component.assignedCount !== 'number' ||
        !Number.isFinite(component.assignedCount) ||
        !Number.isInteger(component.assignedCount) ||
        component.assignedCount < 0
      ) {
        return prev;
      }
    }
    const batchMatches = (component.purchaseHistory || []).filter(
      (entry) => entry.id === part.purchaseEntryId
    );
    if (batchMatches.length !== 1) return prev;
    const batch = batchMatches[0];
    if (
      typeof batch.quantity !== 'number' ||
      !Number.isFinite(batch.quantity) ||
      !Number.isInteger(batch.quantity) ||
      batch.quantity <= 0 ||
      typeof batch.unitPrice !== 'number' ||
      !Number.isFinite(batch.unitPrice) ||
      batch.unitPrice < 0
    ) {
      return prev;
    }

    const key = `${component.id}::${batch.id}`;
    const requested = (requestedByBatch.get(key) || 0) + part.quantity;
    if (requested > getPurchaseEntryRemainingQuantity(component, batch.id, prev.builds)) {
      return prev;
    }
    requestedByBatch.set(key, requested);
    const existingPart = validatedParts.find(
      (candidate) =>
        candidate.componentId === component.id &&
        candidate.purchaseEntryId === batch.id
    );
    if (existingPart) {
      existingPart.quantity += part.quantity;
    } else {
      validatedParts.push({
        ...part,
        componentId: component.id,
        componentName: component.name,
        purchaseEntryId: batch.id,
        category: component.category,
        unitCostAtAssignment: batch.unitPrice,
      });
    }
  }

  const newBuild: PCBuild = {
    ...build,
    parts: validatedParts,
    warrantyDays: resolvedWarranty,
    id: `build-${Date.now()}`,
    createdDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
  };

  let updatedComponents = prev.components;
  if (build.parts && build.parts.length > 0) {
    const qtyByCompId: Record<string, number> = {};
    validatedParts.forEach((p) => {
      qtyByCompId[p.componentId] = (qtyByCompId[p.componentId] || 0) + p.quantity;
    });

    updatedComponents = prev.components.map((c) => {
      const addedQty = qtyByCompId[c.id] || 0;
      if (addedQty > 0) {
        return { ...c, assignedCount: (c.assignedCount || 0) + addedQty };
      }
      return c;
    });
  }

  return {
    ...prev,
    components: updatedComponents,
    builds: [newBuild, ...prev.builds],
  };
};

export const handleAddImportedBuilds = (
  prev: AppState,
  builds: PCBuild[]
): AppState => {
  if (builds.length === 0) return prev;
  return {
    ...prev,
    builds: [...builds, ...prev.builds],
  };
};

export const handlePurchasePC = (
  prev: AppState,
  purchase: PurchasePCData
): { nextState: AppState; success: boolean; error?: string } => {
  if (
    typeof purchase.purchasePrice !== 'number' ||
    !Number.isFinite(purchase.purchasePrice) ||
    purchase.purchasePrice <= 0
  ) {
    return { nextState: prev, success: false, error: 'Purchase price must be greater than zero.' };
  }
  if (
    typeof purchase.purchaseDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchase.purchaseDate) ||
    !parseDateLocal(purchase.purchaseDate)
  ) {
    return { nextState: prev, success: false, error: 'Purchase date must be a valid date.' };
  }
  if (!VALID_PAYMENT_METHODS.includes(purchase.paymentMethod) || purchase.paymentMethod === 'Trade-In') {
    return { nextState: prev, success: false, error: 'Invalid purchase payment method.' };
  }

  const submittedBreakdown = purchase.breakdown || [];
  if (submittedBreakdown.length > 0) {
    const validation = validateCostBreakdownAccounting(purchase.purchasePrice, submittedBreakdown);
    if (!validation.valid) {
      return { nextState: prev, success: false, error: validation.error };
    }
  }

  const now = Date.now();
  const buildId = `build-purchased-${now}-${Math.random().toString(36).substring(2, 8)}`;
  const transactionId = `tx-purchased-${now}-${Math.random().toString(36).substring(2, 8)}`;
  const normalizedBreakdown = submittedBreakdown.map((part, index) => ({
    id: part.id?.trim() || `brk-${now}-${index}-${Math.random().toString(36).substring(2, 8)}`,
    category: part.category,
    name: part.name.trim(),
    quantity: part.quantity,
    unitCost: part.unitCost,
    tags: part.tags && part.tags.length > 0 ? [...part.tags] : undefined,
  }));
  const hasCpuOrGpu = normalizedBreakdown.some(
    (part) => part.category === 'CPU' || part.category === 'GPU'
  );
  const generatedName = hasCpuOrGpu
    ? generateBuildTitleFromParts(
      normalizedBreakdown.map((part) => ({
        category: part.category,
        componentName: part.name,
      }))
    )
    : '';
  const buildName = purchase.name?.trim() || generatedName || 'Purchased PC';
  const seller = purchase.seller?.trim() || undefined;

  const newBuild: PCBuild = {
    id: buildId,
    name: buildName,
    parts: [],
    acquisitionComponentBreakdown: normalizedBreakdown,
    status: 'In Progress',
    createdDate: purchase.purchaseDate,
    estimatedCost: purchase.purchasePrice,
    acquisitionSource: 'Purchased',
    purchaseTransactionId: transactionId,
    purchaseDate: purchase.purchaseDate,
    purchaseSeller: seller,
    purchasePaymentMethod: purchase.paymentMethod,
    notes: purchase.notes?.trim() || undefined,
    imageUrl: purchase.imageUrl?.trim() || undefined,
    warrantyDays: BUILD_WARRANTY_DAYS,
  };

  const purchaseTransaction: TransactionLogItem = {
    id: transactionId,
    type: 'PURCHASE',
    title: `Purchased PC: ${buildName}`,
    timestamp: purchase.purchaseDate,
    dateSortable: purchase.purchaseDate,
    itemCount: 1,
    quantity: 1,
    totalAmount: purchase.purchasePrice,
    platform: seller,
    paymentMethod: purchase.paymentMethod,
    itemNameOrSummary: buildName,
    relatedComponentId: buildId,
    purchaseKind: 'PC',
    notes: purchase.notes?.trim() || undefined,
  };

  return {
    nextState: {
      ...prev,
      builds: [newBuild, ...prev.builds],
      transactions: [purchaseTransaction, ...prev.transactions],
    },
    success: true,
  };
};

export const handleUpdateBuildStatus = (
  prev: AppState,
  buildId: string,
  status: PCBuild['status']
): AppState => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) return prev;



  // Safely backfill legacy trade-in source linkage
  let newSourceSaleTransactionId = targetBuild.sourceSaleTransactionId;
  if (
    targetBuild.acquisitionSource === 'Trade-In' &&
    targetBuild.status === 'In Progress' &&
    status === 'Trade-In Processing' &&
    !newSourceSaleTransactionId
  ) {
    const matches = prev.transactions.filter((t) => t.incomingTradeInBuildId === buildId && t.type === 'SALE');
    if (matches.length === 1) {
      newSourceSaleTransactionId = matches[0].id;
    }
  }

  // Automatically set completionDate if it transitions to 'Listed for Sale' and doesn't have one
  const newCompletionDate =
    status === 'Listed for Sale' && !targetBuild.completionDate
      ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
      : targetBuild.completionDate || undefined;

  const updatedTarget: PCBuild = {
    ...targetBuild,
    status,
    completionDate: newCompletionDate,
    sourceSaleTransactionId: newSourceSaleTransactionId,
    ...(status !== 'Sold'
      ? {
          saleDate: undefined,
          platformSoldOn: undefined,
          paymentMethod: undefined,
          buyerName: undefined,
          buyerPhone: undefined,
          daysOnMarket: undefined,
        }
      : {}),
  };

  if (JSON.stringify(updatedTarget) === JSON.stringify(targetBuild)) {
    return prev;
  }

  return {
    ...prev,
    builds: prev.builds.map((b) =>
      b.id === buildId ? updatedTarget : b
    ),
  };
};

export const handleUpdateBuild = (
  prev: AppState,
  buildId: string,
  updates: Partial<PCBuild>
): AppState => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) return prev;

  if ('warrantyDays' in updates) {
    if (!isValidWarrantyDays(updates.warrantyDays)) {
      return prev;
    }
  }

  const { status: _ignoredStatus, ...requestedUpdates } = updates;
  const validUpdates = { ...requestedUpdates };
  if (targetBuild.status === 'Sold') {
    const saleCoupledFields: (keyof PCBuild)[] = [
      'salePrice',
      'saleDate',
      'builtDate',
      'platformSoldOn',
      'paymentMethod',
      'buyerName',
      'buyerPhone',
      'daysOnMarket',
      'saleTransactionId',
    ];
    for (const field of saleCoupledFields) {
      delete validUpdates[field];
    }
  }
  if (Object.keys(validUpdates).length === 0) {
    return prev;
  }

  const isNoOp = Object.entries(validUpdates).every(
    ([key, value]) => (targetBuild as unknown as Record<string, unknown>)[key] === value
  );
  if (isNoOp) {
    return prev;
  }

  return {
    ...prev,
    builds: prev.builds.map((b) =>
      b.id === buildId ? { ...b, ...validUpdates } : b
    ),
  };
};

type BuildPartMutationResult = {
  nextState: AppState;
  success: boolean;
  error?: string;
};

/**
 * Keeps a sold build's exact linked sale transaction in sync after an allocated
 * part mutation. The mutation remains atomic: invalid or ambiguous sale linkage
 * discards the entire candidate state rather than leaving accounting snapshots
 * stale.
 */
const finalizeBuildPartMutation = (
  prev: AppState,
  candidate: AppState,
  buildId: string
): BuildPartMutationResult => {
  const originalBuild = prev.builds.find((build) => build.id === buildId);
  if (!originalBuild || originalBuild.status !== 'Sold') {
    return { nextState: candidate, success: true };
  }

  const linkResult = findLinkedSaleTransaction(originalBuild, prev.transactions);
  if (!linkResult.transaction) {
    return {
      nextState: prev,
      success: false,
      error: `Cannot modify sold build parts: ${linkResult.error || 'Sale transaction not found.'}`,
    };
  }

  const linkedSale = linkResult.transaction;
  const anotherBuildClaimsSale = prev.builds.some(
    (build) => build.id !== buildId && build.saleTransactionId === linkedSale.id
  );
  if (anotherBuildClaimsSale) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot modify sold build parts: Another build references the linked sale transaction.',
    };
  }

  if (
    typeof linkedSale.totalAmount !== 'number' ||
    !Number.isFinite(linkedSale.totalAmount) ||
    linkedSale.totalAmount < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot modify sold build parts: Linked sale amount is invalid.',
    };
  }

  const updatedBuild = candidate.builds.find((build) => build.id === buildId);
  if (!updatedBuild || updatedBuild.status !== 'Sold') {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot modify sold build parts: Updated sold build was not found.',
    };
  }

  const updatedCost = calculateBuildPartsCost(updatedBuild);
  if (!Number.isFinite(updatedCost) || updatedCost < 0) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot modify sold build parts: Updated build cost is invalid.',
    };
  }

  const presentation = getBuildPresentation(updatedBuild, candidate.components);
  const detailsList = presentation.allComponents.map(
    (part) => `${part.quantity}x ${part.name} (${formatCurrency(part.unitCost)}/ea)`
  );

  return {
    nextState: {
      ...candidate,
      builds: candidate.builds.map((build) =>
        build.id === buildId && build.saleTransactionId !== linkedSale.id
          ? { ...build, saleTransactionId: linkedSale.id }
          : build
      ),
      transactions: candidate.transactions.map((transaction) =>
        transaction.id === linkedSale.id
          ? {
              ...transaction,
              itemCount: presentation.lineCount,
              quantity: presentation.totalQuantity,
              detailsList,
              profitMargin: linkedSale.totalAmount - updatedCost,
            }
          : transaction
      ),
    },
    success: true,
  };
};

export const handleAllocatePartToBuild = (
  prev: AppState,
  buildId: string,
  componentId: string,
  purchaseEntryId: string,
  quantity: number
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) {
    return { nextState: prev, success: false, error: 'Target build not found.' };
  }

  const targetComp = prev.components.find((c) => c.id === componentId);
  if (!targetComp) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }

  const purchaseEntry = (targetComp.purchaseHistory || []).find((e) => e.id === purchaseEntryId);
  if (!purchaseEntry) {
    return { nextState: prev, success: false, error: 'Purchase entry not found in component.' };
  }

  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Allocation quantity must be a finite positive whole number.',
    };
  }

  if (
    typeof purchaseEntry.quantity !== 'number' ||
    !Number.isFinite(purchaseEntry.quantity) ||
    !Number.isInteger(purchaseEntry.quantity) ||
    purchaseEntry.quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Purchase entry quantity must be a finite positive whole number.',
    };
  }

  if (
    typeof purchaseEntry.unitPrice !== 'number' ||
    !Number.isFinite(purchaseEntry.unitPrice) ||
    purchaseEntry.unitPrice < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Purchase entry unit price must be a finite non-negative number.',
    };
  }

  const remainingQty = getPurchaseEntryRemainingQuantity(targetComp, purchaseEntryId, prev.builds);
  if (quantity > remainingQty) {
    return {
      nextState: prev,
      success: false,
      error: `Requested quantity (${quantity}) exceeds available batch stock (${remainingQty}).`,
    };
  }

  const avgCost = purchaseEntry.unitPrice;

  // A component + purchase-batch pair is one allocation identity. If the batch
  // cost changed between assignments, retain the exact total historical cost as
  // a weighted unit cost instead of creating indistinguishable duplicate lines.
  const matchingPartIndexes = targetBuild.parts
    .map((part, index) => ({ part, index }))
    .filter(
      ({ part: p }) =>
        p.componentId === componentId &&
        p.purchaseEntryId === purchaseEntryId
    )
    .map(({ index }) => index);
  const existingPartIndex = matchingPartIndexes[0] ?? -1;

  for (const index of matchingPartIndexes) {
    const existingPart = targetBuild.parts[index];
    if (
      typeof existingPart.quantity !== 'number' ||
      !Number.isFinite(existingPart.quantity) ||
      !Number.isInteger(existingPart.quantity) ||
      existingPart.quantity <= 0 ||
      typeof existingPart.unitCostAtAssignment !== 'number' ||
      !Number.isFinite(existingPart.unitCostAtAssignment) ||
      existingPart.unitCostAtAssignment < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Existing build part has invalid stored quantity or unit cost.',
      };
    }
  }

  const updatedBuilds = prev.builds.map((build) => {
    if (build.id === buildId) {
      const newParts = [...build.parts];

      if (existingPartIndex >= 0) {
        const matchingParts = matchingPartIndexes.map((index) => newParts[index]);
        const existingQuantity = matchingParts.reduce((sum, part) => sum + part.quantity, 0);
        const existingCost = matchingParts.reduce(
          (sum, part) => sum + part.quantity * part.unitCostAtAssignment,
          0
        );
        const combinedQuantity = existingQuantity + quantity;
        const combinedUnitCost = (existingCost + quantity * avgCost) / combinedQuantity;
        newParts[existingPartIndex] = {
          ...newParts[existingPartIndex],
          quantity: combinedQuantity,
          unitCostAtAssignment: combinedUnitCost,
          purchaseEntryId: purchaseEntryId,
        };
        for (let i = matchingPartIndexes.length - 1; i >= 1; i--) {
          newParts.splice(matchingPartIndexes[i], 1);
        }
      } else {
        newParts.push({
          componentId: targetComp.id,
          componentName: targetComp.name,
          purchaseEntryId: purchaseEntryId,
          category: targetComp.category,
          quantity,
          unitCostAtAssignment: avgCost,
        });
      }
      return { ...build, parts: newParts };
    }
    return build;
  });

  const updatedComponents = prev.components.map((comp) => {
    if (comp.id === componentId) {
      return { ...comp, assignedCount: (comp.assignedCount || 0) + quantity };
    }
    return comp;
  });

  return finalizeBuildPartMutation(
    prev,
    {
      ...prev,
      builds: updatedBuilds,
      components: updatedComponents,
    },
    buildId
  );
};

export const resolveUniqueAllocationIndex = (
  parts: PCBuildPart[],
  componentId: string,
  purchaseEntryId?: string
): number => {
  const matches: number[] = [];
  parts.forEach((p, idx) => {
    if (p.componentId === componentId) {
      if (purchaseEntryId !== undefined && purchaseEntryId !== '') {
        if (p.purchaseEntryId === purchaseEntryId) {
          matches.push(idx);
        }
      } else {
        if (!p.purchaseEntryId) {
          matches.push(idx);
        }
      }
    }
  });
  return matches.length === 1 ? matches[0] : -1;
};

const returnBaseComponentToInventory = (
  components: InventoryComponent[],
  targetBuild: PCBuild,
  baseItem: { id: string; category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] },
  removeQuantity: number
): InventoryComponent[] => {
  const isPurchased = targetBuild.acquisitionSource === 'Purchased';
  const removeCost = removeQuantity * baseItem.unitCost;
  const purchaseDate =
    targetBuild.purchaseDate ||
    targetBuild.createdDate ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const platform =
    targetBuild.purchaseSeller ||
    (isPurchased ? 'Purchased PC' : 'Trade-In');
  const paymentMethod =
    targetBuild.purchasePaymentMethod ||
    (isPurchased ? 'Cash' : 'Trade-In');
  const entryId = baseItem.id
    ? `pe-${targetBuild.id}-${baseItem.id}`
    : `pe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const newEntry: PurchaseEntry = {
    id: entryId,
    date: purchaseDate,
    condition: 'Used No Box',
    quantity: removeQuantity,
    unitPrice: baseItem.unitCost,
    totalPrice: removeCost,
    taxPercent: 0,
    paymentMethod: paymentMethod as PaymentMethod,
    platform,
    sourcePurchasedBuildId: isPurchased ? targetBuild.id : undefined,
    sourcePurchaseTransactionId: targetBuild.purchaseTransactionId,
    sourceTradeInBuildId: !isPurchased ? targetBuild.id : undefined,
    sourceSaleTransactionId: targetBuild.sourceSaleTransactionId,
    notes: `Extracted from ${isPurchased ? 'purchased' : 'traded-in'} PC: ${targetBuild.name}`,
  };

  const trimmedName = baseItem.name.trim();
  const existingCompIndex = components.findIndex(
    (c) =>
      c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
      c.category === baseItem.category
  );

  if (existingCompIndex !== -1) {
    const existingComp = components[existingCompIndex];
    const batchExists = (existingComp.purchaseHistory || []).some((e) => e.id === entryId);
    const updatedHistory = batchExists
      ? existingComp.purchaseHistory.map((e) =>
          e.id === entryId
            ? { ...e, quantity: e.quantity + removeQuantity, totalPrice: e.totalPrice + removeCost }
            : e
        )
      : [newEntry, ...(existingComp.purchaseHistory || [])].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

    const updatedComponent: InventoryComponent = {
      ...existingComp,
      purchaseHistory: updatedHistory,
      tags: Array.from(new Set([...(existingComp.tags || []), ...(baseItem.tags || [])])),
    };
    return components.map((c, idx) =>
      idx === existingCompIndex ? updatedComponent : c
    );
  }

  const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const tags = baseItem.tags && baseItem.tags.length > 0
    ? [...baseItem.tags]
    : autoTagComponent(trimmedName, '', baseItem.category);
  const newComponent: InventoryComponent = {
    id: newCompId,
    name: trimmedName,
    category: baseItem.category,
    specifications: '',
    assignedCount: 0,
    tags,
    purchaseHistory: [newEntry],
  };
  return [newComponent, ...components];
};

export const handleRemovePartFromBuild = (
  prev: AppState,
  buildId: string,
  componentId: string,
  purchaseEntryId?: string
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) {
    return { nextState: prev, success: false, error: 'Target build not found.' };
  }

  const matches: number[] = [];
  targetBuild.parts.forEach((p, idx) => {
    if (p.componentId === componentId) {
      if (purchaseEntryId !== undefined && purchaseEntryId !== '') {
        if (p.purchaseEntryId === purchaseEntryId) {
          matches.push(idx);
        }
      } else {
        if (!p.purchaseEntryId) {
          matches.push(idx);
        }
      }
    }
  });

  if (matches.length > 1) {
    return {
      nextState: prev,
      success: false,
      error: 'Ambiguous allocation: multiple matching parts found.',
    };
  }

  if (matches.length === 1) {
    const partIndex = matches[0];
    const partToRemove = targetBuild.parts[partIndex];

    const targetComp = prev.components.find((c) => c.id === componentId);
    if (!targetComp) {
      return { nextState: prev, success: false, error: 'Component not found.' };
    }

    if (
      typeof partToRemove.quantity !== 'number' ||
      !Number.isFinite(partToRemove.quantity) ||
      !Number.isInteger(partToRemove.quantity) ||
      partToRemove.quantity <= 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Stored build part quantity must be a finite positive whole number.',
      };
    }

    if (
      typeof partToRemove.unitCostAtAssignment !== 'number' ||
      !Number.isFinite(partToRemove.unitCostAtAssignment) ||
      partToRemove.unitCostAtAssignment < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Stored build part unit cost must be a finite non-negative number.',
      };
    }

    if (targetComp.assignedCount !== undefined && targetComp.assignedCount !== null) {
      if (
        typeof targetComp.assignedCount !== 'number' ||
        !Number.isFinite(targetComp.assignedCount) ||
        !Number.isInteger(targetComp.assignedCount) ||
        targetComp.assignedCount < 0
      ) {
        return {
          nextState: prev,
          success: false,
          error: 'Component assigned count must be a finite non-negative whole number.',
        };
      }
    }

    const currentAssignedCount = targetComp.assignedCount ?? 0;
    const newAssignedCount = Math.max(0, currentAssignedCount - partToRemove.quantity);

    const updatedParts = targetBuild.parts.filter((_, idx) => idx !== partIndex);

    const updatedBuilds = prev.builds.map((build) => {
      if (build.id === buildId) {
        return {
          ...build,
          parts: updatedParts,
        };
      }
      return build;
    });

    const updatedComponents = prev.components.map((comp) => {
      if (comp.id === componentId) {
        return {
          ...comp,
          assignedCount: newAssignedCount,
        };
      }
      return comp;
    });

    return finalizeBuildPartMutation(
      prev,
      {
        ...prev,
        builds: updatedBuilds,
        components: updatedComponents,
      },
      buildId
    );
  }

  // Check base components of acquired PC
  const isAcquired = isAcquiredPC(targetBuild);
  const isPurchased = targetBuild.acquisitionSource === 'Purchased';
  const breakdown = isAcquired
    ? (isPurchased
        ? targetBuild.acquisitionComponentBreakdown || []
        : targetBuild.tradeInComponentBreakdown || targetBuild.acquisitionComponentBreakdown || [])
    : [];

  const baseMatchIndex = breakdown.findIndex(
    (item) =>
      item.id === componentId ||
      (purchaseEntryId && item.id === purchaseEntryId) ||
      item.name.trim().toLowerCase() === componentId.trim().toLowerCase()
  );

  if (baseMatchIndex === -1) {
    return { nextState: prev, success: false, error: 'Allocated part not found in build.' };
  }

  const baseItem = breakdown[baseMatchIndex];
  if (
    typeof baseItem.quantity !== 'number' ||
    !Number.isFinite(baseItem.quantity) ||
    !Number.isInteger(baseItem.quantity) ||
    baseItem.quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part quantity must be a finite positive whole number.',
    };
  }
  if (
    typeof baseItem.unitCost !== 'number' ||
    !Number.isFinite(baseItem.unitCost) ||
    baseItem.unitCost < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part unit cost must be a finite non-negative number.',
    };
  }

  const removeQuantity = baseItem.quantity;
  const removeCost = removeQuantity * baseItem.unitCost;
  const updatedBreakdown = breakdown.filter((_, idx) => idx !== baseMatchIndex);
  const currentEstimatedCost =
    targetBuild.estimatedCost ??
    breakdown.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);
  const newEstimatedCost = Math.max(0, currentEstimatedCost - removeCost);

  const updatedTargetBuild: PCBuild = {
    ...targetBuild,
    estimatedCost: newEstimatedCost,
    ...(isPurchased
      ? { acquisitionComponentBreakdown: updatedBreakdown }
      : { tradeInComponentBreakdown: updatedBreakdown }),
  };

  const updatedComponents = returnBaseComponentToInventory(
    prev.components,
    targetBuild,
    baseItem,
    removeQuantity
  );

  const updatedBuilds = prev.builds.map((b) => (b.id === buildId ? updatedTargetBuild : b));

  return finalizeBuildPartMutation(
    prev,
    {
      ...prev,
      builds: updatedBuilds,
      components: updatedComponents,
    },
    buildId
  );
};

export const handleUpdateBuildPartQuantity = (
  prev: AppState,
  buildId: string,
  componentId: string,
  purchaseEntryId: string | undefined,
  newQuantity: number
): BuildPartMutationResult => {
  if (
    typeof newQuantity !== 'number' ||
    !Number.isFinite(newQuantity) ||
    !Number.isInteger(newQuantity) ||
    newQuantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Build part quantity must be a finite positive whole number.',
    };
  }

  const targetBuild = prev.builds.find((build) => build.id === buildId);
  if (!targetBuild) {
    return { nextState: prev, success: false, error: 'Target build not found.' };
  }

  const matchingIndexes: number[] = [];
  targetBuild.parts.forEach((part, index) => {
    if (part.componentId !== componentId) return;
    if (purchaseEntryId !== undefined && purchaseEntryId !== '') {
      if (part.purchaseEntryId === purchaseEntryId) matchingIndexes.push(index);
    } else if (!part.purchaseEntryId) {
      matchingIndexes.push(index);
    }
  });

  if (matchingIndexes.length === 0) {
    const isAcquired = isAcquiredPC(targetBuild);
    const isPurchased = targetBuild.acquisitionSource === 'Purchased';
    const breakdown = isAcquired
      ? (isPurchased
          ? targetBuild.acquisitionComponentBreakdown || []
          : targetBuild.tradeInComponentBreakdown || targetBuild.acquisitionComponentBreakdown || [])
      : [];

    const baseMatchIndex = breakdown.findIndex(
      (item) =>
        item.id === componentId ||
        (purchaseEntryId && item.id === purchaseEntryId) ||
        item.name.trim().toLowerCase() === componentId.trim().toLowerCase()
    );

    if (baseMatchIndex === -1) {
      return { nextState: prev, success: false, error: 'Allocated part not found in build.' };
    }

    const currentPart = breakdown[baseMatchIndex];
    if (newQuantity === currentPart.quantity) {
      return { nextState: prev, success: true };
    }

    if (newQuantity < currentPart.quantity) {
      const delta = currentPart.quantity - newQuantity;
      const deltaCost = delta * currentPart.unitCost;
      const updatedBreakdown = breakdown.map((item, idx) =>
        idx === baseMatchIndex ? { ...item, quantity: newQuantity } : item
      );
      const currentEstimatedCost =
        targetBuild.estimatedCost ??
        breakdown.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);
      const newEstimatedCost = Math.max(0, currentEstimatedCost - deltaCost);

      const updatedTargetBuild: PCBuild = {
        ...targetBuild,
        estimatedCost: newEstimatedCost,
        ...(isPurchased
          ? { acquisitionComponentBreakdown: updatedBreakdown }
          : { tradeInComponentBreakdown: updatedBreakdown }),
      };

      const updatedComponents = returnBaseComponentToInventory(
        prev.components,
        targetBuild,
        currentPart,
        delta
      );

      const updatedBuilds = prev.builds.map((b) => (b.id === buildId ? updatedTargetBuild : b));

      return finalizeBuildPartMutation(
        prev,
        {
          ...prev,
          builds: updatedBuilds,
          components: updatedComponents,
        },
        buildId
      );
    }

    const delta = newQuantity - currentPart.quantity;
    const targetComp = prev.components.find(
      (c) =>
        c.name.trim().toLowerCase() === currentPart.name.trim().toLowerCase() &&
        c.category === currentPart.category
    );
    if (!targetComp) {
      return {
        nextState: prev,
        success: false,
        error: `Cannot increase base component: no inventory component found for "${currentPart.name}".`,
      };
    }
    const availableQty = calculateUnassignedQuantityStrict(targetComp, prev.builds);
    if (delta > availableQty) {
      return {
        nextState: prev,
        success: false,
        error: `Requested increase (${delta}) exceeds available inventory stock (${availableQty}).`,
      };
    }
    const unassignedBatches = getUnassignedBatches(targetComp, prev.builds);
    if (unassignedBatches.length === 0 || unassignedBatches[0].availableQuantity < delta) {
      return {
        nextState: prev,
        success: false,
        error: `Requested increase (${delta}) exceeds available batch stock.`,
      };
    }
    const chosenBatch = unassignedBatches[0];
    return handleAllocatePartToBuild(prev, buildId, targetComp.id, chosenBatch.entry.id, delta);
  }
  if (matchingIndexes.length > 1) {
    return {
      nextState: prev,
      success: false,
      error: 'Ambiguous allocation: multiple matching parts found.',
    };
  }

  const partIndex = matchingIndexes[0];
  const currentPart = targetBuild.parts[partIndex];
  if (
    typeof currentPart.quantity !== 'number' ||
    !Number.isFinite(currentPart.quantity) ||
    !Number.isInteger(currentPart.quantity) ||
    currentPart.quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part quantity must be a finite positive whole number.',
    };
  }
  if (
    typeof currentPart.unitCostAtAssignment !== 'number' ||
    !Number.isFinite(currentPart.unitCostAtAssignment) ||
    currentPart.unitCostAtAssignment < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part unit cost must be a finite non-negative number.',
    };
  }

  if (newQuantity === currentPart.quantity) {
    return { nextState: prev, success: true };
  }

  const targetComponent = prev.components.find((component) => component.id === componentId);
  if (!targetComponent) {
    return { nextState: prev, success: false, error: 'Component not found.' };
  }
  if (
    typeof targetComponent.assignedCount !== 'number' ||
    !Number.isFinite(targetComponent.assignedCount) ||
    !Number.isInteger(targetComponent.assignedCount) ||
    targetComponent.assignedCount < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Component assigned count must be a finite non-negative whole number.',
    };
  }

  const quantityDelta = newQuantity - currentPart.quantity;
  const nextAssignedCount = targetComponent.assignedCount + quantityDelta;
  if (nextAssignedCount < 0) {
    return {
      nextState: prev,
      success: false,
      error: 'Component assigned count is lower than the requested quantity reduction.',
    };
  }

  let nextUnitCost = currentPart.unitCostAtAssignment;
  if (quantityDelta > 0) {
    if (!currentPart.purchaseEntryId) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot increase an unlinked legacy allocation without an exact purchase batch.',
      };
    }

    const purchaseEntry = (targetComponent.purchaseHistory || []).find(
      (entry) => entry.id === currentPart.purchaseEntryId
    );
    if (!purchaseEntry) {
      return { nextState: prev, success: false, error: 'Purchase entry not found in component.' };
    }
    if (
      typeof purchaseEntry.quantity !== 'number' ||
      !Number.isFinite(purchaseEntry.quantity) ||
      !Number.isInteger(purchaseEntry.quantity) ||
      purchaseEntry.quantity <= 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Purchase entry quantity must be a finite positive whole number.',
      };
    }
    if (
      typeof purchaseEntry.unitPrice !== 'number' ||
      !Number.isFinite(purchaseEntry.unitPrice) ||
      purchaseEntry.unitPrice < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Purchase entry unit price must be a finite non-negative number.',
      };
    }

    const remainingQuantity = getPurchaseEntryRemainingQuantity(
      targetComponent,
      currentPart.purchaseEntryId,
      prev.builds
    );
    if (quantityDelta > remainingQuantity) {
      return {
        nextState: prev,
        success: false,
        error: `Requested increase (${quantityDelta}) exceeds available batch stock (${remainingQuantity}).`,
      };
    }

    nextUnitCost =
      (currentPart.quantity * currentPart.unitCostAtAssignment +
        quantityDelta * purchaseEntry.unitPrice) /
      newQuantity;
  }

  const updatedBuilds = prev.builds.map((build) => {
    if (build.id !== buildId) return build;
    const updatedParts = [...build.parts];
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      quantity: newQuantity,
      unitCostAtAssignment: nextUnitCost,
    };
    return { ...build, parts: updatedParts };
  });
  const updatedComponents = prev.components.map((component) =>
    component.id === componentId
      ? { ...component, assignedCount: nextAssignedCount }
      : component
  );

  return finalizeBuildPartMutation(
    prev,
    {
      ...prev,
      builds: updatedBuilds,
      components: updatedComponents,
    },
    buildId
  );
};

export const handleSwapPartInBuild = (
  prev: AppState,
  buildId: string,
  oldComponentId: string,
  oldPurchaseEntryId: string | undefined,
  newComponentId: string,
  newPurchaseEntryId: string,
  quantity: number
): { nextState: AppState; success: boolean; error?: string } => {
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Quantity must be a positive whole number.',
    };
  }

  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) {
    return { nextState: prev, success: false, error: 'Target build not found.' };
  }

  const matches: number[] = [];
  targetBuild.parts.forEach((p, idx) => {
    if (p.componentId === oldComponentId) {
      if (oldPurchaseEntryId !== undefined && oldPurchaseEntryId !== '') {
        if (p.purchaseEntryId === oldPurchaseEntryId) {
          matches.push(idx);
        }
      } else {
        if (!p.purchaseEntryId) {
          matches.push(idx);
        }
      }
    }
  });

  if (matches.length === 0) {
    const isAcquired = isAcquiredPC(targetBuild);
    const isPurchased = targetBuild.acquisitionSource === 'Purchased';
    const breakdown = isAcquired
      ? (isPurchased
          ? targetBuild.acquisitionComponentBreakdown || []
          : targetBuild.tradeInComponentBreakdown || targetBuild.acquisitionComponentBreakdown || [])
      : [];

    const baseMatchIndex = breakdown.findIndex(
      (item) =>
        item.id === oldComponentId ||
        (oldPurchaseEntryId && item.id === oldPurchaseEntryId) ||
        item.name.trim().toLowerCase() === oldComponentId.trim().toLowerCase()
    );

    if (baseMatchIndex === -1) {
      return { nextState: prev, success: false, error: 'Allocated part not found in build.' };
    }

    const oldBasePart = breakdown[baseMatchIndex];
    if (
      typeof oldBasePart.quantity !== 'number' ||
      !Number.isFinite(oldBasePart.quantity) ||
      !Number.isInteger(oldBasePart.quantity) ||
      oldBasePart.quantity <= 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Stored build part quantity must be a finite positive whole number.',
      };
    }
    if (
      typeof oldBasePart.unitCost !== 'number' ||
      !Number.isFinite(oldBasePart.unitCost) ||
      oldBasePart.unitCost < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Stored build part unit cost must be a finite non-negative number.',
      };
    }

    const newComp = prev.components.find((c) => c.id === newComponentId);
    if (!newComp) {
      return { nextState: prev, success: false, error: 'Replacement component not found in inventory.' };
    }
    if (newComp.category !== oldBasePart.category) {
      return {
        nextState: prev,
        success: false,
        error: 'Replacement component category does not match outgoing allocation category.',
      };
    }

    const newBatch = (newComp.purchaseHistory || []).find((e) => e.id === newPurchaseEntryId);
    if (!newBatch) {
      return {
        nextState: prev,
        success: false,
        error: 'Selected replacement purchase batch not found.',
      };
    }

    if (
      typeof newBatch.quantity !== 'number' ||
      !Number.isFinite(newBatch.quantity) ||
      !Number.isInteger(newBatch.quantity) ||
      newBatch.quantity <= 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Replacement purchase batch quantity must be a finite positive whole number.',
      };
    }
    if (
      typeof newBatch.unitPrice !== 'number' ||
      !Number.isFinite(newBatch.unitPrice) ||
      newBatch.unitPrice < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Replacement purchase batch unit price must be a finite non-negative number.',
      };
    }

    const availableQty = getPurchaseEntryRemainingQuantity(newComp, newPurchaseEntryId, prev.builds);
    if (availableQty < quantity) {
      return {
        nextState: prev,
        success: false,
        error: `Insufficient stock: requested ${quantity}, but only ${availableQty} available.`,
      };
    }

    const componentsWithOldReturned = returnBaseComponentToInventory(
      prev.components,
      targetBuild,
      oldBasePart,
      oldBasePart.quantity
    );

    const updatedComponents = componentsWithOldReturned.map((comp) => {
      if (comp.id === newComponentId) {
        return {
          ...comp,
          assignedCount: (comp.assignedCount || 0) + quantity,
        };
      }
      return comp;
    });

    const updatedBreakdown = breakdown.filter((_, idx) => idx !== baseMatchIndex);
    const oldCost = oldBasePart.quantity * oldBasePart.unitCost;
    const currentEstimatedCost =
      targetBuild.estimatedCost ??
      breakdown.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);
    const newEstimatedCost = Math.max(0, currentEstimatedCost - oldCost);

    const existingPartIndex = targetBuild.parts.findIndex(
      (p) => p.componentId === newComponentId && p.purchaseEntryId === newPurchaseEntryId
    );

    let updatedParts: PCBuildPart[];
    if (existingPartIndex >= 0) {
      const existingPart = targetBuild.parts[existingPartIndex];
      const combinedQuantity = existingPart.quantity + quantity;
      const combinedUnitCost =
        (existingPart.quantity * existingPart.unitCostAtAssignment + quantity * newBatch.unitPrice) /
        combinedQuantity;
      updatedParts = targetBuild.parts.map((p, idx) =>
        idx === existingPartIndex
          ? { ...p, quantity: combinedQuantity, unitCostAtAssignment: combinedUnitCost }
          : p
      );
    } else {
      updatedParts = [
        ...targetBuild.parts,
        {
          componentId: newComp.id,
          componentName: newComp.name,
          purchaseEntryId: newPurchaseEntryId,
          category: newComp.category,
          quantity,
          unitCostAtAssignment: newBatch.unitPrice,
        },
      ];
    }

    const updatedTargetBuild: PCBuild = {
      ...targetBuild,
      estimatedCost: newEstimatedCost,
      parts: updatedParts,
      ...(isPurchased
        ? { acquisitionComponentBreakdown: updatedBreakdown }
        : { tradeInComponentBreakdown: updatedBreakdown }),
    };

    const updatedBuilds = prev.builds.map((b) => (b.id === buildId ? updatedTargetBuild : b));

    return finalizeBuildPartMutation(
      prev,
      {
        ...prev,
        builds: updatedBuilds,
        components: updatedComponents,
      },
      buildId
    );
  }

  if (matches.length > 1) {
    return {
      nextState: prev,
      success: false,
      error: 'Ambiguous allocation: multiple matching parts found.',
    };
  }

  const originalPartIndex = matches[0];
  const originalPart = targetBuild.parts[originalPartIndex];

  const oldComp = prev.components.find((c) => c.id === oldComponentId);
  if (!oldComp) {
    return { nextState: prev, success: false, error: 'Original component not found in inventory.' };
  }

  if (
    typeof originalPart.quantity !== 'number' ||
    !Number.isFinite(originalPart.quantity) ||
    !Number.isInteger(originalPart.quantity) ||
    originalPart.quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part quantity must be a finite positive whole number.',
    };
  }

  if (
    typeof originalPart.unitCostAtAssignment !== 'number' ||
    !Number.isFinite(originalPart.unitCostAtAssignment) ||
    originalPart.unitCostAtAssignment < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Stored build part unit cost must be a finite non-negative number.',
    };
  }

  if (oldComp.assignedCount !== undefined && oldComp.assignedCount !== null) {
    if (
      typeof oldComp.assignedCount !== 'number' ||
      !Number.isFinite(oldComp.assignedCount) ||
      !Number.isInteger(oldComp.assignedCount) ||
      oldComp.assignedCount < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Original component assigned count must be a finite non-negative whole number.',
      };
    }
  }

  if (
    oldComponentId === newComponentId &&
    ((oldPurchaseEntryId !== undefined && oldPurchaseEntryId !== '' && oldPurchaseEntryId === newPurchaseEntryId) ||
      (originalPart.purchaseEntryId !== undefined && originalPart.purchaseEntryId !== '' && originalPart.purchaseEntryId === newPurchaseEntryId))
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot swap an allocation to the same component and purchase batch.',
    };
  }

  const newComp = prev.components.find((c) => c.id === newComponentId);
  if (!newComp) {
    return { nextState: prev, success: false, error: 'Replacement component not found in inventory.' };
  }

  if (newComp.category !== originalPart.category) {
    return {
      nextState: prev,
      success: false,
      error: 'Replacement component category does not match outgoing allocation category.',
    };
  }

  if (newComp.assignedCount !== undefined && newComp.assignedCount !== null) {
    if (
      typeof newComp.assignedCount !== 'number' ||
      !Number.isFinite(newComp.assignedCount) ||
      !Number.isInteger(newComp.assignedCount) ||
      newComp.assignedCount < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Replacement component assigned count must be a finite non-negative whole number.',
      };
    }
  }

  const newBatch = (newComp.purchaseHistory || []).find((e) => e.id === newPurchaseEntryId);
  if (!newBatch) {
    return {
      nextState: prev,
      success: false,
      error: 'Selected replacement purchase batch not found.',
    };
  }

  if (
    typeof newBatch.quantity !== 'number' ||
    !Number.isFinite(newBatch.quantity) ||
    !Number.isInteger(newBatch.quantity) ||
    newBatch.quantity <= 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Replacement purchase batch quantity must be a finite positive whole number.',
    };
  }

  if (
    typeof newBatch.unitPrice !== 'number' ||
    !Number.isFinite(newBatch.unitPrice) ||
    newBatch.unitPrice < 0
  ) {
    return {
      nextState: prev,
      success: false,
      error: 'Replacement purchase batch unit price must be a finite non-negative number.',
    };
  }

  const tentativeBuilds = prev.builds.map((b) =>
    b.id === buildId
      ? { ...b, parts: b.parts.filter((_, idx) => idx !== originalPartIndex) }
      : b
  );
  const tentativeComponents = prev.components.map((c) =>
    c.id === oldComponentId
      ? { ...c, assignedCount: Math.max(0, (c.assignedCount || 0) - originalPart.quantity) }
      : c
  );
  const tentativeNewComp = tentativeComponents.find((c) => c.id === newComponentId);
  if (!tentativeNewComp) {
    return { nextState: prev, success: false, error: 'Replacement component not found in inventory.' };
  }

  const availableQty = getPurchaseEntryRemainingQuantity(
    tentativeNewComp,
    newPurchaseEntryId,
    tentativeBuilds
  );
  if (availableQty < quantity) {
    return {
      nextState: prev,
      success: false,
      error: `Insufficient stock: requested ${quantity}, but only ${availableQty} available.`,
    };
  }

  const remainingParts = targetBuild.parts.filter((_, idx) => idx !== originalPartIndex);
  const existingPartIndex = remainingParts.findIndex(
    (p) =>
      p.componentId === newComponentId &&
      p.purchaseEntryId === newPurchaseEntryId
  );

  let updatedParts: PCBuildPart[];
  if (existingPartIndex >= 0) {
    const existingPart = remainingParts[existingPartIndex];
    if (
      typeof existingPart.quantity !== 'number' ||
      !Number.isFinite(existingPart.quantity) ||
      !Number.isInteger(existingPart.quantity) ||
      existingPart.quantity <= 0 ||
      typeof existingPart.unitCostAtAssignment !== 'number' ||
      !Number.isFinite(existingPart.unitCostAtAssignment) ||
      existingPart.unitCostAtAssignment < 0
    ) {
      return {
        nextState: prev,
        success: false,
        error: 'Existing build part has invalid stored quantity or unit cost.',
      };
    }
    const combinedQuantity = existingPart.quantity + quantity;
    const combinedUnitCost =
      (existingPart.quantity * existingPart.unitCostAtAssignment + quantity * newBatch.unitPrice) /
      combinedQuantity;
    updatedParts = remainingParts.map((p, idx) =>
      idx === existingPartIndex
        ? { ...p, quantity: combinedQuantity, unitCostAtAssignment: combinedUnitCost }
        : p
    );
  } else {
    updatedParts = [
      ...remainingParts,
      {
        componentId: newComp.id,
        componentName: newComp.name,
        purchaseEntryId: newPurchaseEntryId,
        category: newComp.category,
        quantity,
        unitCostAtAssignment: newBatch.unitPrice,
      },
    ];
  }

  const updatedBuilds = prev.builds.map((build) => {
    if (build.id === buildId) {
      return {
        ...build,
        parts: updatedParts,
      };
    }
    return build;
  });

  const updatedComponents = prev.components.map((comp) => {
    if (oldComponentId === newComponentId) {
      if (comp.id === oldComponentId) {
        const current = comp.assignedCount ?? 0;
        return {
          ...comp,
          assignedCount: Math.max(0, current - originalPart.quantity) + quantity,
        };
      }
      return comp;
    }
    if (comp.id === oldComponentId) {
      const current = comp.assignedCount ?? 0;
      return {
        ...comp,
        assignedCount: Math.max(0, current - originalPart.quantity),
      };
    }
    if (comp.id === newComponentId) {
      const current = comp.assignedCount ?? 0;
      return {
        ...comp,
        assignedCount: current + quantity,
      };
    }
    return comp;
  });

  return finalizeBuildPartMutation(
    prev,
    {
      ...prev,
      builds: updatedBuilds,
      components: updatedComponents,
    },
    buildId
  );
};

export const validateSwapInBuild = (
  state: AppState,
  buildId: string,
  oldComponentId: string,
  oldPurchaseEntryId: string | undefined,
  newComponentId: string,
  newPurchaseEntryId: string,
  quantity: number
): { valid: boolean; error?: string } => {
  const result = handleSwapPartInBuild(
    state,
    buildId,
    oldComponentId,
    oldPurchaseEntryId,
    newComponentId,
    newPurchaseEntryId,
    quantity
  );
  return { valid: result.success, error: result.error };
};

const VALID_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'E-Transfer',
  'Cash',
  'PayPal',
  'Credit Card',
  'Debit',
  'Crypto',
  'Trade-In',
];

export const handleSellBuild = (
  prev: AppState,
  buildId: string,
  saleData: SellBuildData
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) return { nextState: prev, success: false, error: 'Build not found.' };

  if (
    typeof saleData.salePrice !== 'number' ||
    !Number.isFinite(saleData.salePrice) ||
    saleData.salePrice <= 0
  ) {
    return { nextState: prev, success: false, error: 'Sale price must be a finite number greater than zero.' };
  }

  const authoritativeBuildCost = calculateBuildPartsCost(targetBuild);
  if (
    typeof authoritativeBuildCost !== 'number' ||
    !Number.isFinite(authoritativeBuildCost) ||
    authoritativeBuildCost < 0
  ) {
    return { nextState: prev, success: false, error: 'Authoritative build cost must be a finite non-negative number.' };
  }

  const profit = saleData.salePrice - authoritativeBuildCost;
  if (!Number.isFinite(profit)) {
    return { nextState: prev, success: false, error: 'Calculated profit must be a finite number.' };
  }

  if (
    typeof saleData.saleDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(saleData.saleDate) ||
    !parseDateLocal(saleData.saleDate)
  ) {
    return { nextState: prev, success: false, error: 'Sale date must be a valid calendar date in exact YYYY-MM-DD format.' };
  }

  if (saleData.builtDate !== undefined && saleData.builtDate !== null) {
    if (
      typeof saleData.builtDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saleData.builtDate) ||
      !parseDateLocal(saleData.builtDate)
    ) {
      return { nextState: prev, success: false, error: 'Built date must be a valid calendar date in exact YYYY-MM-DD format.' };
    }
  }

  const finalBuiltDate = saleData.builtDate || targetBuild.builtDate;
  let daysOnMarket: number | undefined = undefined;
  if (finalBuiltDate) {
    const builtParsed = parseDateLocal(finalBuiltDate);
    if (!builtParsed || !/^\d{4}-\d{2}-\d{2}$/.test(finalBuiltDate)) {
      return { nextState: prev, success: false, error: 'Built date must be a valid calendar date in exact YYYY-MM-DD format.' };
    }
    if (finalBuiltDate > saleData.saleDate) {
      return { nextState: prev, success: false, error: 'Built date cannot be later than sale date.' };
    }
    const saleParsed = parseDateLocal(saleData.saleDate)!;
    const bTime = new Date(builtParsed.year, builtParsed.monthIndex, builtParsed.day).getTime();
    const sTime = new Date(saleParsed.year, saleParsed.monthIndex, saleParsed.day).getTime();
    daysOnMarket = Math.round((sTime - bTime) / (1000 * 60 * 60 * 24));
  }

  if (typeof saleData.platformSoldOn !== 'string' || !saleData.platformSoldOn.trim()) {
    return { nextState: prev, success: false, error: 'Platform sold on must be a non-empty string.' };
  }
  const finalPlatformSoldOn = saleData.platformSoldOn.trim();

  if (!VALID_PAYMENT_METHODS.includes(saleData.paymentMethod)) {
    return { nextState: prev, success: false, error: 'Invalid payment method.' };
  }

  if (saleData.tradeIn !== undefined && saleData.tradeIn !== null) {
    if (
      typeof saleData.tradeIn.tradeInCredit !== 'number' ||
      !Number.isFinite(saleData.tradeIn.tradeInCredit) ||
      saleData.tradeIn.tradeInCredit <= 0
    ) {
      return { nextState: prev, success: false, error: 'Trade-in credit must be a finite number greater than zero.' };
    }
    if (saleData.tradeIn.tradeInCredit > saleData.salePrice) {
      return { nextState: prev, success: false, error: 'Trade-in credit cannot exceed the total effective sale price.' };
    }
    if (
      typeof saleData.tradeIn.tradeInBuildName !== 'string' ||
      !saleData.tradeIn.tradeInBuildName.trim()
    ) {
      return { nextState: prev, success: false, error: 'Trade-in build name must be a non-empty string.' };
    }
  }

  const presentation = getBuildPresentation(targetBuild, prev.components);
  const partsSummary = presentation.allComponents.map(
    (p) => `${p.quantity}x ${p.name} (${formatCurrency(p.unitCost)}/ea)`
  );

  const isEditingSoldBuild = targetBuild.status === 'Sold';
  const linkResult = isEditingSoldBuild
    ? findLinkedSaleTransaction(targetBuild, prev.transactions)
    : undefined;
  const existingSaleTx = linkResult?.transaction;

  if (isEditingSoldBuild && !existingSaleTx) {
    return { nextState: prev, success: false, error: linkResult?.error || 'Cannot edit: Sale transaction not found.' };
  }

  let resolvedWarrantyAtSale: number;
  if ('warrantyDaysAtSale' in saleData && saleData.warrantyDaysAtSale !== undefined) {
    if (!isValidWarrantyDays(saleData.warrantyDaysAtSale)) {
      return { nextState: prev, success: false, error: 'Invalid warranty.' };
    }
    resolvedWarrantyAtSale = Number(saleData.warrantyDaysAtSale);
  } else if (isEditingSoldBuild && existingSaleTx && existingSaleTx.warrantyDaysAtSale !== undefined) {
    resolvedWarrantyAtSale = normalizeWarrantyDays(existingSaleTx.warrantyDaysAtSale, BUILD_WARRANTY_DAYS);
  } else {
    resolvedWarrantyAtSale = normalizeWarrantyDays(targetBuild.warrantyDays, BUILD_WARRANTY_DAYS);
  }

  const today = saleData.saleDate;

  if (isEditingSoldBuild && existingSaleTx) {
    const tradeInEdit = getSaleTradeInEditState(existingSaleTx, prev.builds, prev.components);
    const hasExistingTradeIn = tradeInEdit.hasExistingTradeIn;
    const isLocked = tradeInEdit.isLocked;
    const existingIncomingBuild = tradeInEdit.existingIncomingBuild;

    let incomingTradeInBuildId = existingSaleTx.incomingTradeInBuildId;
    let finalTradeInCredit: number | undefined = existingSaleTx.tradeInCredit;
    let finalTradeInBuildName: string | undefined = existingSaleTx.tradeInBuildName;
    let finalTradeInNotes: string | undefined = existingSaleTx.tradeInNotes;

    if (isLocked) {
      if (saleData.tradeIn === null) {
        return {
          nextState: prev,
          success: false,
          error: 'Cannot remove trade-in: It has downstream activity or is locked.',
        };
      }

      if (saleData.tradeIn !== undefined) {
        const savedCredit = existingSaleTx.tradeInCredit;
        const submittedCredit = saleData.tradeIn.tradeInCredit;
        const creditChanged = savedCredit !== submittedCredit;

        const savedName = (existingSaleTx.tradeInBuildName || '').trim();
        const submittedName = (saleData.tradeIn.tradeInBuildName || '').trim();
        const nameChanged = savedName !== submittedName;

        const savedNotes = (existingSaleTx.tradeInNotes || '').trim() || undefined;
        const submittedNotes = (saleData.tradeIn.tradeInNotes || '').trim() || undefined;
        const notesChanged = savedNotes !== submittedNotes;

        if (creditChanged || nameChanged || notesChanged) {
          return {
            nextState: prev,
            success: false,
            error: 'Cannot modify trade-in terms: The trade-in PC has downstream activity or is locked.',
          };
        }
      }

      if (
        typeof finalTradeInCredit !== 'number' ||
        !Number.isFinite(finalTradeInCredit) ||
        finalTradeInCredit <= 0
      ) {
        return {
          nextState: prev,
          success: false,
          error: 'Saved trade-in credit is invalid or missing.',
        };
      }

      if (finalTradeInCredit > saleData.salePrice) {
        return {
          nextState: prev,
          success: false,
          error: 'Trade-in credit cannot exceed the total effective sale price.',
        };
      }
    } else {
      if (hasExistingTradeIn) {
        if (saleData.tradeIn === null) {
          incomingTradeInBuildId = undefined;
          finalTradeInCredit = undefined;
          finalTradeInBuildName = undefined;
          finalTradeInNotes = undefined;
        } else if (saleData.tradeIn !== undefined) {
          finalTradeInCredit = saleData.tradeIn.tradeInCredit;
          finalTradeInBuildName = saleData.tradeIn.tradeInBuildName.trim();
          finalTradeInNotes = (saleData.tradeIn.tradeInNotes || '').trim() || undefined;

          if (finalTradeInCredit > saleData.salePrice) {
            return {
              nextState: prev,
              success: false,
              error: 'Trade-in credit cannot exceed the total effective sale price.',
            };
          }
        } else {
          if (finalTradeInCredit && finalTradeInCredit > 0 && finalTradeInCredit > saleData.salePrice) {
            return {
              nextState: prev,
              success: false,
              error: 'Trade-in credit cannot exceed the total effective sale price.',
            };
          }
        }
      } else {
        if (saleData.tradeIn !== null && saleData.tradeIn !== undefined) {
          const newTradeInId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          incomingTradeInBuildId = newTradeInId;
          finalTradeInCredit = saleData.tradeIn.tradeInCredit;
          finalTradeInBuildName = saleData.tradeIn.tradeInBuildName.trim();
          finalTradeInNotes = (saleData.tradeIn.tradeInNotes || '').trim() || undefined;

          if (finalTradeInCredit > saleData.salePrice) {
            return {
              nextState: prev,
              success: false,
              error: 'Trade-in credit cannot exceed the total effective sale price.',
            };
          }
        }
      }
    }

    const areStringArraysEqual = (a?: string[], b?: string[]): boolean => {
      if (a === b) return true;
      if (!a && !b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const normalizeOptStr = (val?: string | null): string | undefined => {
      if (val === undefined || val === null) return undefined;
      const t = val.trim();
      return t.length > 0 ? t : undefined;
    };

    const finalBuyerName = saleData.buyerName !== undefined ? normalizeOptStr(saleData.buyerName) : targetBuild.buyerName;
    const finalBuyerPhone = saleData.buyerPhone !== undefined ? normalizeOptStr(saleData.buyerPhone) : targetBuild.buyerPhone;
    const finalImageUrl = saleData.imageUrl !== undefined ? saleData.imageUrl : targetBuild.imageUrl;

    const candidateTargetBuild: PCBuild = {
      ...targetBuild,
      status: 'Sold' as const,
      builtDate: finalBuiltDate,
      salePrice: saleData.salePrice,
      saleDate: saleData.saleDate,
      platformSoldOn: finalPlatformSoldOn,
      paymentMethod: saleData.paymentMethod,
      buyerName: finalBuyerName,
      buyerPhone: finalBuyerPhone,
      imageUrl: finalImageUrl,
      daysOnMarket,
      saleTransactionId: existingSaleTx.id,
    };

    let candidateBuilds: PCBuild[] = prev.builds.map((b) =>
      b.id === buildId ? candidateTargetBuild : b
    );

    if (!isLocked) {
      if (hasExistingTradeIn) {
        if (saleData.tradeIn === null) {
          if (existingSaleTx.incomingTradeInBuildId) {
            candidateBuilds = candidateBuilds.filter((b) => b.id !== existingSaleTx.incomingTradeInBuildId);
          }
        } else if (saleData.tradeIn !== undefined && incomingTradeInBuildId && existingIncomingBuild) {
          candidateBuilds = candidateBuilds.map((b) =>
            b.id === incomingTradeInBuildId
              ? {
                  ...b,
                  name: finalTradeInBuildName!,
                  notes: finalTradeInNotes,
                  estimatedCost: finalTradeInCredit!,
                }
              : b
          );
        }
      } else if (incomingTradeInBuildId && saleData.tradeIn !== null && saleData.tradeIn !== undefined) {
        const newTradeInBuild: PCBuild = {
          id: incomingTradeInBuildId,
          name: finalTradeInBuildName!,
          status: 'Trade-In Processing',
          parts: [],
          estimatedCost: finalTradeInCredit!,
          notes: finalTradeInNotes,
          acquisitionSource: 'Trade-In',
          createdDate: today,
          sourceSaleTransactionId: existingSaleTx.id,
        };
        candidateBuilds.unshift(newTradeInBuild);
      }
    }

    let candidateCashPortion: number | undefined = undefined;
    let candidateTitle = `PC Sold: ${targetBuild.name}`;
    if (finalTradeInCredit && finalTradeInCredit > 0) {
      candidateCashPortion = saleData.salePrice - finalTradeInCredit;
      candidateTitle = `PC Sold: ${targetBuild.name} (${formatCurrency(candidateCashPortion)} Cash + ${formatCurrency(finalTradeInCredit)} Trade-In)`;
    }

    const candidateSaleTx: TransactionLogItem = {
      ...existingSaleTx,
      warrantyDaysAtSale: resolvedWarrantyAtSale,
      title: candidateTitle,
      timestamp: saleData.saleDate,
      dateSortable: saleData.saleDate,
      itemCount: presentation.lineCount,
      quantity: presentation.totalQuantity,
      detailsList: partsSummary,
      totalAmount: saleData.salePrice,
      profitMargin: profit,
      platform: finalPlatformSoldOn,
      paymentMethod: saleData.paymentMethod,
      buyerName: finalBuyerName,
      cashPortion: candidateCashPortion,
      tradeInCredit: finalTradeInCredit,
      incomingTradeInBuildId,
      tradeInBuildName: finalTradeInBuildName,
      tradeInNotes: finalTradeInNotes,
    };

    const isTargetBuildUnchanged =
      targetBuild.status === candidateTargetBuild.status &&
      targetBuild.builtDate === candidateTargetBuild.builtDate &&
      targetBuild.salePrice === candidateTargetBuild.salePrice &&
      targetBuild.saleDate === candidateTargetBuild.saleDate &&
      targetBuild.platformSoldOn === candidateTargetBuild.platformSoldOn &&
      targetBuild.paymentMethod === candidateTargetBuild.paymentMethod &&
      targetBuild.buyerName === candidateTargetBuild.buyerName &&
      targetBuild.buyerPhone === candidateTargetBuild.buyerPhone &&
      targetBuild.imageUrl === candidateTargetBuild.imageUrl &&
      targetBuild.daysOnMarket === candidateTargetBuild.daysOnMarket &&
      targetBuild.saleTransactionId === candidateTargetBuild.saleTransactionId;

    const isTxUnchanged =
      existingSaleTx.warrantyDaysAtSale === candidateSaleTx.warrantyDaysAtSale &&
      existingSaleTx.title === candidateSaleTx.title &&
      existingSaleTx.timestamp === candidateSaleTx.timestamp &&
      existingSaleTx.dateSortable === candidateSaleTx.dateSortable &&
      existingSaleTx.itemCount === candidateSaleTx.itemCount &&
      existingSaleTx.quantity === candidateSaleTx.quantity &&
      areStringArraysEqual(existingSaleTx.detailsList, candidateSaleTx.detailsList) &&
      existingSaleTx.totalAmount === candidateSaleTx.totalAmount &&
      existingSaleTx.profitMargin === candidateSaleTx.profitMargin &&
      existingSaleTx.platform === candidateSaleTx.platform &&
      existingSaleTx.paymentMethod === candidateSaleTx.paymentMethod &&
      existingSaleTx.buyerName === candidateSaleTx.buyerName &&
      existingSaleTx.cashPortion === candidateSaleTx.cashPortion &&
      existingSaleTx.tradeInCredit === candidateSaleTx.tradeInCredit &&
      existingSaleTx.incomingTradeInBuildId === candidateSaleTx.incomingTradeInBuildId &&
      existingSaleTx.tradeInBuildName === candidateSaleTx.tradeInBuildName &&
      existingSaleTx.tradeInNotes === candidateSaleTx.tradeInNotes;

    let areAllBuildsUnchanged = true;
    if (candidateBuilds.length !== prev.builds.length) {
      areAllBuildsUnchanged = false;
    } else {
      for (let i = 0; i < prev.builds.length; i++) {
        const prevB = prev.builds[i];
        const candB = candidateBuilds[i];
        if (prevB.id !== candB.id) {
          areAllBuildsUnchanged = false;
          break;
        }
        if (candB.id === buildId) {
          if (!isTargetBuildUnchanged) {
            areAllBuildsUnchanged = false;
            break;
          }
        } else if (incomingTradeInBuildId && candB.id === incomingTradeInBuildId) {
          if (
            prevB.name !== candB.name ||
            prevB.notes !== candB.notes ||
            prevB.estimatedCost !== candB.estimatedCost ||
            prevB.status !== candB.status
          ) {
            areAllBuildsUnchanged = false;
            break;
          }
        } else {
          if (prevB !== candB) {
            areAllBuildsUnchanged = false;
            break;
          }
        }
      }
    }

    if (areAllBuildsUnchanged && isTxUnchanged) {
      return { nextState: prev, success: true };
    }

    return {
      nextState: {
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === existingSaleTx.id ? candidateSaleTx : t)),
        builds: candidateBuilds,
      },
      success: true,
    };
  }

  const saleTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  let incomingTradeInBuildId: string | undefined = undefined;
  let tradeInCredit: number | undefined = undefined;
  let cashPortion: number | undefined = undefined;
  let txTitle = `PC Sold: ${targetBuild.name}`;

  let updatedBuilds: PCBuild[] = prev.builds.map((b) =>
    b.id === buildId
      ? {
          ...b,
          status: 'Sold' as const,
          builtDate: finalBuiltDate,
          salePrice: saleData.salePrice,
          saleDate: saleData.saleDate,
          platformSoldOn: finalPlatformSoldOn,
          paymentMethod: saleData.paymentMethod,
          buyerName: saleData.buyerName,
          buyerPhone: saleData.buyerPhone,
          imageUrl: saleData.imageUrl !== undefined ? saleData.imageUrl : b.imageUrl,
          daysOnMarket,
          saleTransactionId: saleTxId,
        }
      : b
  );

  if (saleData.tradeIn) {
    tradeInCredit = saleData.tradeIn.tradeInCredit;
    cashPortion = saleData.salePrice - tradeInCredit;
    txTitle = `PC Sold: ${targetBuild.name} (${formatCurrency(cashPortion)} Cash + ${formatCurrency(tradeInCredit)} Trade-In)`;

    incomingTradeInBuildId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newTradeInBuild: PCBuild = {
      id: incomingTradeInBuildId,
      name: saleData.tradeIn.tradeInBuildName.trim(),
      status: 'Trade-In Processing',
      parts: [],
      estimatedCost: saleData.tradeIn.tradeInCredit,
      notes: saleData.tradeIn.tradeInNotes,
      acquisitionSource: 'Trade-In',
      createdDate: today,
      sourceSaleTransactionId: saleTxId,
    };
    updatedBuilds.unshift(newTradeInBuild);
  }

  const saleTx: TransactionLogItem = {
    id: saleTxId,
    warrantyDaysAtSale: resolvedWarrantyAtSale,
    type: 'SALE',
    title: txTitle,
    timestamp: saleData.saleDate,
    dateSortable: saleData.saleDate,
    itemCount: presentation.lineCount,
    quantity: presentation.totalQuantity,
    totalAmount: saleData.salePrice,
    profitMargin: profit,
    platform: finalPlatformSoldOn,
    paymentMethod: saleData.paymentMethod,
    buyerName: saleData.buyerName,
    itemNameOrSummary: targetBuild.name,
    detailsList: partsSummary,
    relatedComponentId: targetBuild.id,
    cashPortion,
    tradeInCredit,
    incomingTradeInBuildId,

    tradeInBuildName: saleData.tradeIn?.tradeInBuildName ? saleData.tradeIn.tradeInBuildName.trim() : undefined,
    tradeInNotes: saleData.tradeIn?.tradeInNotes,
  };

  return {
    nextState: {
      ...prev,
      transactions: [saleTx, ...prev.transactions],
      builds: updatedBuilds,
    },
    success: true,
  };
};

export const handleRelistBuild = (
  prev: AppState,
  buildId: string
): { nextState: AppState; success: boolean; error?: string } => {
  if (typeof buildId !== 'string' || buildId.trim().length === 0) {
    return { nextState: prev, success: false, error: 'Build ID is required.' };
  }

  const matchingBuilds = prev.builds.filter((b) => b.id === buildId);
  if (matchingBuilds.length === 0) {
    return { nextState: prev, success: false, error: 'Build not found.' };
  }
  if (matchingBuilds.length > 1) {
    return {
      nextState: prev,
      success: false,
      error: `Ambiguous build: Multiple builds share ID "${buildId}".`,
    };
  }

  const targetBuild = matchingBuilds[0];
  if (targetBuild.status !== 'Sold') {
    return { nextState: prev, success: false, error: 'Cannot relist: Build is not sold.' };
  }

  const linkResult = findLinkedSaleTransaction(targetBuild, prev.transactions);
  if (!linkResult.transaction) {
    return {
      nextState: prev,
      success: false,
      error: linkResult.error || 'Cannot relist: No matching sale transaction found.',
    };
  }

  const linkedTx = linkResult.transaction;
  const txMatches = prev.transactions.filter((t) => t.id === linkedTx.id);
  if (txMatches.length !== 1) {
    return {
      nextState: prev,
      success: false,
      error: `Cannot relist: Expected exactly one transaction with ID "${linkedTx.id}", found ${txMatches.length}.`,
    };
  }

  if (linkedTx.type !== 'SALE' || linkedTx.relatedComponentId !== targetBuild.id) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot relist: Linked transaction does not correctly reference this build.',
    };
  }

  const otherBuildsWithSameTx = prev.builds.some(
    (b) => b.id !== targetBuild.id && b.saleTransactionId === linkedTx.id
  );
  if (otherBuildsWithSameTx) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot relist: Another build references the linked sale transaction.',
    };
  }

  const rawIncomingId = linkedTx.incomingTradeInBuildId;
  let validatedIncomingBuildId: string | undefined = undefined;

  if (rawIncomingId !== undefined && rawIncomingId !== null) {
    if (typeof rawIncomingId !== 'string' || rawIncomingId.trim().length === 0) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot relist: Linked trade-in build ID is invalid or empty.',
      };
    }
    const trimmedIncomingId = rawIncomingId.trim();

    if (trimmedIncomingId === targetBuild.id) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot relist: Incoming trade-in build ID cannot match the sold build ID.',
      };
    }

    const matchingIncomingBuilds = prev.builds.filter((b) => b.id === trimmedIncomingId);
    if (matchingIncomingBuilds.length === 0) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot relist: The linked incoming trade-in PC record is missing.',
      };
    }
    if (matchingIncomingBuilds.length > 1) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot relist: Ambiguous incoming trade-in build: Multiple builds share this ID.',
      };
    }

    const tradeInBuild = matchingIncomingBuilds[0];
    const pristineCheck = isTradeInBuildPristine(tradeInBuild, prev.components, linkedTx.id);
    if (!pristineCheck.isPristine) {
      return {
        nextState: prev,
        success: false,
        error: `Cannot relist: Incoming trade-in PC has downstream activity (${pristineCheck.reason}).`,
      };
    }

    const otherTxReferencingIncomingBuild = prev.transactions.some(
      (t) =>
        t.id !== linkedTx.id &&
        ((typeof t.incomingTradeInBuildId === 'string' &&
          t.incomingTradeInBuildId.trim() === trimmedIncomingId) ||
          t.relatedComponentId === trimmedIncomingId)
    );
    if (otherTxReferencingIncomingBuild) {
      return {
        nextState: prev,
        success: false,
        error: 'Cannot relist: Another transaction references the linked incoming trade-in build.',
      };
    }

    validatedIncomingBuildId = trimmedIncomingId;
  }

  const otherBuildSourceLinkedToTx = prev.builds.some(
    (b) =>
      b.id !== targetBuild.id &&
      b.id !== validatedIncomingBuildId &&
      b.sourceSaleTransactionId === linkedTx.id
  );
  if (otherBuildSourceLinkedToTx) {
    return {
      nextState: prev,
      success: false,
      error: 'Cannot relist: Another build references the linked sale transaction.',
    };
  }

  // Atomically update:
  // - Remove only the exact linked SALE transaction
  // - Remove only the exact pristine incoming trade-in build, when one exists
  // - Change outgoing build to 'Listed for Sale', clear sale metadata & saleTransactionId, keep allocated parts unchanged
  const updatedBuilds = prev.builds
    .filter((b) => b.id !== validatedIncomingBuildId)
    .map((b) => {
      if (b.id === targetBuild.id) {
        return {
          ...b,
          status: 'Listed for Sale' as const,
          salePrice: undefined,
          saleDate: undefined,
          platformSoldOn: undefined,
          paymentMethod: undefined,
          buyerName: undefined,
          buyerPhone: undefined,
          saleTransactionId: undefined,
          daysOnMarket: undefined,
          completionDate:
            b.completionDate ||
            new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
        };
      }
      return b;
    });

  const updatedTransactions = prev.transactions.filter((t) => t.id !== linkedTx.id);

  return {
    nextState: {
      ...prev,
      builds: updatedBuilds,
      transactions: updatedTransactions,
    },
    success: true,
  };
};

export const handleDeleteBuild = (
  prev: AppState,
  buildId: string
): AppState => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild || !canDeleteBuildDraft(targetBuild)) {
    return prev;
  }

  return {
    ...prev,
    builds: prev.builds.filter((b) => b.id !== buildId),
  };
};

export const handlePartOutAcquiredPC = (
  prev: AppState,
  buildId: string,
  extractedParts: { category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[]
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) return { nextState: prev, success: false, error: 'Build not found.' };

  // Domain-level validation
  const validation = validatePartOutAccounting(targetBuild, extractedParts);
  if (!validation.valid) {
    return { nextState: prev, success: false, error: validation.error };
  }

  // Validate allocated upgrades (if any)
  if (targetBuild.parts && targetBuild.parts.length > 0) {
    for (const part of targetBuild.parts) {
      const component = prev.components.find((c) => c.id === part.componentId);
      if (!component) {
        return {
          nextState: prev,
          success: false,
          error: `Component for allocated upgrade "${part.componentName}" not found in inventory.`,
        };
      }

      if (
        typeof part.quantity !== 'number' ||
        !Number.isFinite(part.quantity) ||
        !Number.isInteger(part.quantity) ||
        part.quantity <= 0
      ) {
        return {
          nextState: prev,
          success: false,
          error: `Invalid quantity for allocated upgrade "${part.componentName}".`,
        };
      }

      if (
        typeof part.unitCostAtAssignment !== 'number' ||
        !Number.isFinite(part.unitCostAtAssignment) ||
        part.unitCostAtAssignment < 0
      ) {
        return {
          nextState: prev,
          success: false,
          error: `Invalid unit cost for allocated upgrade "${part.componentName}".`,
        };
      }

      if (
        component.assignedCount !== undefined &&
        component.assignedCount !== null &&
        (typeof component.assignedCount !== 'number' ||
          !Number.isFinite(component.assignedCount) ||
          !Number.isInteger(component.assignedCount) ||
          component.assignedCount < 0)
      ) {
        return {
          nextState: prev,
          success: false,
          error: `Invalid assigned count for component "${component.name}".`,
        };
      }
    }
  }

  const purchasedPC = isPurchasedPC(targetBuild);
  const tradeInOrigin = purchasedPC
    ? null
    : resolveTradeInBuildOrigin(targetBuild, prev.transactions, prev.builds);
  const acquisitionSeller = purchasedPC
    ? targetBuild.purchaseSeller?.trim() || 'Purchased PC'
    : tradeInOrigin?.buyerName || 'Traded-In PC';
  const acquisitionPaymentMethod: PaymentMethod = purchasedPC
    ? targetBuild.purchasePaymentMethod || 'Cash'
    : 'Trade-In';
  const sourceSaleTransactionId =
    tradeInOrigin?.sourceSaleTransactionId || targetBuild.sourceSaleTransactionId;
  const sourcePurchaseTransactionId = purchasedPC
    ? targetBuild.purchaseTransactionId
    : undefined;

  // Determine extraction date
  const isValidCalendarDate = (dateStr?: string | null): boolean => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
    return Boolean(parseDateLocal(trimmed));
  };

  let extractedDate = '';
  if (purchasedPC && targetBuild.purchaseDate && isValidCalendarDate(targetBuild.purchaseDate)) {
    extractedDate = targetBuild.purchaseDate.trim();
  }
  if (tradeInOrigin?.date && isValidCalendarDate(tradeInOrigin.date)) {
    extractedDate = tradeInOrigin.date.trim();
  }
  if (!extractedDate && sourceSaleTransactionId) {
    const srcTx = prev.transactions.find((t) => t.id === sourceSaleTransactionId);
    if (srcTx?.dateSortable && isValidCalendarDate(srcTx.dateSortable)) {
      extractedDate = srcTx.dateSortable.trim();
    } else if (srcTx?.timestamp && isValidCalendarDate(srcTx.timestamp)) {
      extractedDate = srcTx.timestamp.trim();
    }
  }
  if (!extractedDate && targetBuild.createdDate && isValidCalendarDate(targetBuild.createdDate)) {
    extractedDate = targetBuild.createdDate.trim();
  }
  if (!extractedDate) {
    extractedDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  let currentComponents = [...prev.components];

  // 1. Return allocated upgrade parts to their original batches (unassign them).
  const returnedUpgradePartsList: string[] = [];
  if (targetBuild.parts && targetBuild.parts.length > 0) {
    const qtyByCompId: Record<string, number> = {};
    targetBuild.parts.forEach((p) => {
      qtyByCompId[p.componentId] = (qtyByCompId[p.componentId] || 0) + p.quantity;
      returnedUpgradePartsList.push(`${p.quantity}x ${p.componentName} (Returned allocated upgrade)`);
    });

    currentComponents = currentComponents.map((comp) => {
      const allocatedQty = qtyByCompId[comp.id];
      if (allocatedQty !== undefined && allocatedQty > 0) {
        const currentAssigned = comp.assignedCount ?? 0;
        return {
          ...comp,
          assignedCount: Math.max(0, currentAssigned - allocatedQty),
        };
      }
      return comp;
    });
  }

  // 2. Add extracted components into inventory as new PurchaseEntry records
  extractedParts.forEach((part, idx) => {
    const trimmedName = part.name.trim();
    const existingCompIndex = currentComponents.findIndex(
      (c) =>
        String(c.name || '').trim().toLowerCase() === trimmedName.toLowerCase() &&
        c.category === part.category
    );

    const entryId = `pe-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`;
    const newEntry: PurchaseEntry = {
      id: entryId,
      date: extractedDate,
      condition: 'Used No Box',
      quantity: part.quantity,
      unitPrice: part.unitCost,
      totalPrice: part.quantity * part.unitCost,
      taxPercent: 0,
      paymentMethod: acquisitionPaymentMethod,
      platform: acquisitionSeller,
      sourceTradeInBuildId: purchasedPC ? undefined : targetBuild.id,
      sourceSaleTransactionId: purchasedPC ? undefined : sourceSaleTransactionId,
      sourcePurchasedBuildId: purchasedPC ? targetBuild.id : undefined,
      sourcePurchaseTransactionId,
      notes: `Parted out from ${purchasedPC ? 'purchased' : 'traded-in'} PC: ${targetBuild.name}`,
    };

    if (existingCompIndex !== -1) {
      const existingComp = currentComponents[existingCompIndex];
      const res = computeUnresolvedLegacyReservation(existingComp, prev.builds);
      const updatedComp = {
        ...existingComp,
        purchaseHistory: [newEntry, ...(existingComp.purchaseHistory || [])].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
        unresolvedLegacyReservationByPurchaseEntryId:
          Object.keys(res).length > 0 ? res : existingComp.unresolvedLegacyReservationByPurchaseEntryId,
      };
      if (part.tags && part.tags.length > 0) {
        const existingTags = existingComp.tags || [];
        updatedComp.tags = Array.from(new Set([...existingTags, ...part.tags]));
      }
      currentComponents[existingCompIndex] = updatedComp;
    } else {
      let tags: string[];
      if (part.tags && part.tags.length > 0) {
        tags = [...part.tags];
      } else {
        tags = autoTagComponent(trimmedName, '', part.category);
        const catUpper = String(part.category || '').toUpperCase();
        if (catUpper === 'CASE' || catUpper === 'PSU') {
          if (/\bwhite\b/i.test(trimmedName) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
            tags.push('WHITE');
          }
          if (/\bblack\b/i.test(trimmedName) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
            tags.push('BLACK');
          }
        }
      }
      const newCompId = `comp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`;
      const newComp: InventoryComponent = {
        id: newCompId,
        name: trimmedName,
        category: part.category,
        specifications: '',
        assignedCount: 0,
        tags,
        purchaseHistory: [newEntry],
      };
      currentComponents.unshift(newComp);
    }
  });

  const totalExtractedValue = extractedParts.reduce(
    (sum, p) => sum + p.quantity * p.unitCost,
    0
  );
  const partsSummary = [
    ...extractedParts.map((p) => `${p.quantity}x ${p.name} (${formatCurrency(p.unitCost)}/ea)`),
    ...returnedUpgradePartsList,
  ];

  const partOutTx: TransactionLogItem = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'BUILD_ALLOCATION',
    title: `${purchasedPC ? 'Parted Out Purchased PC' : 'Parted Out Trade-In'}: ${targetBuild.name}`,
    timestamp: extractedDate,
    dateSortable: extractedDate,
    itemCount: extractedParts.length,
    quantity: extractedParts.reduce((sum, p) => sum + p.quantity, 0),
    totalAmount: totalExtractedValue,
    platform: acquisitionSeller,
    buyerName: tradeInOrigin?.buyerName,
    itemNameOrSummary: targetBuild.name,
    detailsList: partsSummary,
    incomingTradeInBuildId: purchasedPC ? undefined : targetBuild.id,
    buildActivityKind: purchasedPC ? 'PURCHASED_PC_PART_OUT' : 'TRADE_IN_PART_OUT',
  };

  return {
    nextState: {
      ...prev,
      components: currentComponents,
      builds: prev.builds.filter((b) => b.id !== buildId),
      transactions: [partOutTx, ...prev.transactions],
    },
    success: true,
  };
};

/** Backward-compatible trade-in entry point retained for existing callers and data tests. */
export const handlePartOutTradeInBuild = (
  prev: AppState,
  buildId: string,
  extractedParts: { category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[]
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((build) => build.id === buildId);
  if (!targetBuild || targetBuild.acquisitionSource !== 'Trade-In') {
    return { nextState: prev, success: false, error: 'Trade-in build not found.' };
  }
  return handlePartOutAcquiredPC(prev, buildId, extractedParts);
};

export const handleDismantleBuild = (
  prev: AppState,
  buildId: string,
  extractedParts: { category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[] = []
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) return { nextState: prev, success: false, error: 'Build not found.' };

  // Route whole-PC acquisitions to the dedicated part-out handler.
  if (isAcquiredPC(targetBuild)) {
    return handlePartOutAcquiredPC(prev, buildId, extractedParts);
  }

  // Guard: ordinary builds without parts or ineligible builds cannot be dismantled
  if (!canDismantleBuild(targetBuild)) {
    return { nextState: prev, success: false, error: 'Build is not eligible for dismantling.' };
  }

  // VALIDATE ORDINARY DISMANTLE ALLOCATIONS
  for (const part of targetBuild.parts || []) {
    const component = prev.components.find((c) => c.id === part.componentId);
    if (!component) {
      return { nextState: prev, success: false, error: `Component ${part.componentName} not found in inventory.` };
    }
    const pe = component.purchaseHistory?.find((entry) => entry.id === part.purchaseEntryId);
    if (!pe) {
      return { nextState: prev, success: false, error: `Purchase entry for ${part.componentName} not found.` };
    }
    if (
      typeof part.quantity !== 'number' ||
      !Number.isFinite(part.quantity) ||
      !Number.isInteger(part.quantity) ||
      part.quantity <= 0
    ) {
      return { nextState: prev, success: false, error: `Invalid quantity ${part.quantity} for part ${part.componentName}.` };
    }
    if (
      typeof part.unitCostAtAssignment !== 'number' ||
      !Number.isFinite(part.unitCostAtAssignment) ||
      part.unitCostAtAssignment < 0
    ) {
      return { nextState: prev, success: false, error: `Invalid cost ${part.unitCostAtAssignment} for part ${part.componentName}.` };
    }

    if (
      component.assignedCount !== undefined &&
      component.assignedCount !== null &&
      (typeof component.assignedCount !== 'number' ||
        !Number.isFinite(component.assignedCount) ||
        !Number.isInteger(component.assignedCount) ||
        component.assignedCount < 0)
    ) {
      return { nextState: prev, success: false, error: `Invalid assigned count for component ${component.name}.` };
    }

    if (
      typeof pe.quantity !== 'number' ||
      !Number.isFinite(pe.quantity) ||
      !Number.isInteger(pe.quantity) ||
      pe.quantity <= 0
    ) {
      return { nextState: prev, success: false, error: `Invalid purchase entry quantity for ${part.componentName}.` };
    }

    if (
      typeof pe.unitPrice !== 'number' ||
      !Number.isFinite(pe.unitPrice) ||
      pe.unitPrice < 0
    ) {
      return { nextState: prev, success: false, error: `Invalid purchase entry unit price for ${part.componentName}.` };
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

  // Unassign allocated parts from inventory components
  const qtyByCompId: Record<string, number> = {};
  targetBuild.parts.forEach((p) => {
    qtyByCompId[p.componentId] = (qtyByCompId[p.componentId] || 0) + p.quantity;
  });

  const currentComponents = prev.components.map((comp) => {
    const allocatedQty = qtyByCompId[comp.id];
    if (allocatedQty !== undefined && allocatedQty > 0) {
      const currentAssigned = comp.assignedCount ?? 0;
      return {
        ...comp,
        assignedCount: Math.max(0, currentAssigned - allocatedQty),
      };
    }
    return comp;
  });

  const totalDismantledAmount = targetBuild.parts.reduce(
    (sum, p) => sum + p.quantity * p.unitCostAtAssignment,
    0
  );
  const partsSummary = targetBuild.parts.map(
    (p) => `${p.quantity}x ${p.componentName} (${formatCurrency(p.unitCostAtAssignment)}/ea - Returned to Stock)`
  );

  const dismantleTx: TransactionLogItem = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'BUILD_ALLOCATION',
    title: `Dismantled: ${targetBuild.name}`,
    timestamp: today,
    dateSortable: today,
    itemCount: targetBuild.parts.length,
    quantity: targetBuild.parts.reduce((sum, p) => sum + p.quantity, 0),
    totalAmount: totalDismantledAmount,
    platform: 'Dismantled Rig',
    itemNameOrSummary: targetBuild.name,
    detailsList: partsSummary,
    buildActivityKind: 'DISMANTLE',
  };

  return {
    nextState: {
      ...prev,
      components: currentComponents,
      builds: prev.builds.filter((b) => b.id !== buildId),
      transactions: [dismantleTx, ...prev.transactions],
    },
    success: true,
  };
};

export const handleSaveAcquiredPCComponentBreakdown = (
  prev: AppState,
  buildId: string,
  breakdown: AcquiredPCComponentInput[]
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((b) => b.id === buildId);
  if (!targetBuild) {
    return { nextState: prev, success: false, error: 'Acquired PC not found.' };
  }

  const validation = validateItemizationAccounting(targetBuild, breakdown);
  if (!validation.valid) {
    return { nextState: prev, success: false, error: validation.error };
  }

  const existingBreakdown = getAcquiredPCBreakdown(targetBuild);
  const existingIds = new Set(existingBreakdown.map((p) => p.id));
  const seenSubmittedIds = new Set<string>();

  for (const p of breakdown) {
    if (p.id) {
      if (seenSubmittedIds.has(p.id)) {
        return { nextState: prev, success: false, error: 'Duplicate breakdown IDs submitted.' };
      }
      seenSubmittedIds.add(p.id);
    }
  }

  const newBreakdown = breakdown.map(p => {
    let finalId = p.id;
    if (!finalId || !existingIds.has(finalId)) {
      finalId = `brk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    return {
      id: finalId,
      category: p.category,
      name: p.name.trim(),
      quantity: Number(p.quantity),
      unitCost: Number(p.unitCost),
      tags: p.tags && p.tags.length > 0 ? [...p.tags] : undefined,
    };
  });

  let isChanged = existingBreakdown.length !== newBreakdown.length;
  if (!isChanged) {
    for (let i = 0; i < newBreakdown.length; i++) {
      const a = existingBreakdown[i];
      const b = newBreakdown[i];
      if (
        a.id !== b.id ||
        a.category !== b.category ||
        a.name !== b.name ||
        a.quantity !== b.quantity ||
        a.unitCost !== b.unitCost ||
        (a.tags?.join(',') || '') !== (b.tags?.join(',') || '')
      ) {
        isChanged = true;
        break;
      }
    }
  }

  if (!isChanged) {
    return { nextState: prev, success: true };
  }

  return {
    nextState: {
      ...prev,
      builds: prev.builds.map((b) =>
        b.id === buildId
          ? b.acquisitionSource === 'Purchased'
            ? { ...b, acquisitionComponentBreakdown: newBreakdown }
            : { ...b, tradeInComponentBreakdown: newBreakdown }
          : b
      ),
    },
    success: true,
  };
};

/** Backward-compatible trade-in entry point retained for existing callers. */
export const handleSaveTradeInComponentBreakdown = (
  prev: AppState,
  buildId: string,
  breakdown: AcquiredPCComponentInput[]
): { nextState: AppState; success: boolean; error?: string } => {
  const targetBuild = prev.builds.find((build) => build.id === buildId);
  if (!targetBuild || targetBuild.acquisitionSource !== 'Trade-In') {
    return { nextState: prev, success: false, error: 'Trade-in build not found.' };
  }
  return handleSaveAcquiredPCComponentBreakdown(prev, buildId, breakdown);
};
