import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AppState, ComponentCategory, InventoryComponent, PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import {
  getSyncInitialAppState,
  persistAppState,
  sanitizeAppState,
  resolveInitialAppState,
  executeBackupImport,
} from '../utils/storage';
import {
  InventoryContextType,
  ImportDataResult,
  SellComponentPartData,
  ExchangeComponentPartData,
  SellBuildData,
  SaveComponentOptions,
} from './types';
import { useUndoRedo } from './useUndoRedo';
import { getAllBatchesWithRemaining } from '../utils/helpers';
import {
  handleSaveComponent,
  handleAddComponent,
  handleAddComponents,
  handleUpdateComponent,
  handleDeleteComponent,
  handleAddPurchaseEntry,
  handleUpdatePurchaseEntry,
  handleDeletePurchaseEntry,
  handleUpdateMarketValue,
  handleSellComponentPart,
  handleSellComponentPartsBulk,
  handleExchangeComponentPart,
} from './actions/componentActions';
import {
  handleAddBuild,
  handleAddImportedBuilds,
  handleUpdateBuildStatus,
  handleUpdateBuild,
  handleAllocatePartToBuild,
  handleRemovePartFromBuild,
  handleSwapPartInBuild,
  handleSellBuild,
  handleRelistBuild,
  handleDeleteBuild,
  handleDismantleBuild,
  handleSaveTradeInComponentBreakdown,
} from './actions/buildActions';
import {
  handleAddTransaction,
  handleUpdateTransaction,
  handleDeleteTransaction,
  handleDeleteBulkPartSale,
  isEligibleBulkPartSaleTransaction,
  handleRelistPartSale,
  handleRelistBulkPartSale,
  handleUpdateSheetStats,
  handleUpdateMonthlyGoal,
  getResetState,
  getValidatedRelistQuantity,
} from './actions/transactionActions';

export type { InventoryContextType, SellComponentPartData, SellBuildData };

export const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronously initialize from localStorage for instant initial paint
  const [state, setState] = useState<AppState>(() => getSyncInitialAppState());
  const [isHydrated, setIsHydrated] = useState(false);

  // On initial mount, deterministically resolve storage candidate and hydrate
  useEffect(() => {
    let isMounted = true;
    resolveInitialAppState()
      .then((result) => {
        if (!isMounted) return;
        setState(result.state);
        setIsHydrated(true);
      })
      .catch((err) => {
        console.error('Error during initial storage resolution:', err);
        if (!isMounted) return;
        setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced auto-save to IndexedDB (with localStorage mirror fallback), gated until hydration completes
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeoutId = setTimeout(() => {
      persistAppState(state).catch((err) => console.error('Auto-persist error:', err));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [state, isHydrated]);

  // Undo / Redo & Backup Tracking
  const {
    stateRef,
    undoCount,
    redoCount,
    undoHistory,
    redoHistory,
    undo,
    redo,
    saveStateToHistory,
    lastBackupTimestamp,
    actionsSinceBackup,
    recordBackup,
  } = useUndoRedo(state, setState);

  // General & Sync Actions
  const resetToDefault = useCallback(() => {
    saveStateToHistory('Reset all app data');
    const emptyState = getResetState();
    persistAppState(emptyState).catch(() => {});
    setState(emptyState);
  }, [saveStateToHistory]);

  const loadSampleData = useCallback(async () => {
    saveStateToHistory('Load sample data');

    try {
      const res = await fetch('/api/load-sample-data');
      if (res.ok) {
        const data = await res.json();
        const isPositiveFinite = (val: unknown): val is number =>
          typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val) && val > 0;
        const sampleGoal = isPositiveFinite(data.monthlyGoal) ? data.monthlyGoal : 10000;

        const sampleState: AppState = sanitizeAppState({
          components: data.components || [],
          builds: data.builds || [],
          transactions: data.transactions || [],
          sheetStats: data.sheetStats || undefined,
          monthlyGoal: sampleGoal,
        });
        persistAppState(sampleState).catch(() => {});
        setState(sampleState);
        return;
      }
    } catch (e) {
      console.error('Failed to load sample data from API, falling back to static', e);
    }

    const fallbackSampleState = getResetState();
    persistAppState(fallbackSampleState).catch(() => {});
    setState(fallbackSampleState);
  }, [saveStateToHistory]);

  const importData = useCallback(
    async (data: Partial<AppState>): Promise<ImportDataResult> => {
      const currentState = stateRef.current;
      const result = await executeBackupImport(currentState, data);

      if (!result.success || !result.changed) {
        return {
          success: result.success,
          changed: result.changed,
          error: result.error,
        };
      }

      saveStateToHistory('Import backup');
      setState(result.nextState);
      return { success: true, changed: true };
    },
    [saveStateToHistory, stateRef]
  );

  const updateSheetStats = useCallback((stats: AppState['sheetStats']) => {
    setState((prev) => handleUpdateSheetStats(prev, stats));
  }, []);

  const updateMonthlyGoal = useCallback(
    (goal: number) => {
      if (
        typeof goal !== 'number' ||
        !Number.isFinite(goal) ||
        Number.isNaN(goal) ||
        goal <= 0 ||
        stateRef.current.monthlyGoal === goal
      ) {
        return;
      }
      saveStateToHistory('Update monthly goal');
      setState((prev) => handleUpdateMonthlyGoal(prev, goal));
    },
    [saveStateToHistory, stateRef]
  );

  // Component Actions
  const saveComponent = useCallback(
    (options: SaveComponentOptions) => {
      const targetId = options.existingComponentId;
      const existing = targetId ? stateRef.current.components.find((c) => c.id === targetId) : undefined;
      
      const compName = options.componentData.name || (existing ? existing.name : 'Component');
      const label = existing ? `Edit component: ${compName}` : `Add component: ${compName}`;
      
      const result = handleSaveComponent(stateRef.current, options);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (result.nextState !== stateRef.current) {
        saveStateToHistory(label);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const addComponent = useCallback(
    (compData: Omit<InventoryComponent, 'id' | 'assignedCount'>) => {
      const current = stateRef.current;
      const nextState = handleAddComponent(current, compData);
      if (nextState !== current) {
        const label = `Add component: ${compData.name || 'Component'}`;
        saveStateToHistory(label);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const addComponents = useCallback(
    (compsData: Omit<InventoryComponent, 'id' | 'assignedCount'>[]) => {
      const current = stateRef.current;
      const nextState = handleAddComponents(current, compsData);
      if (nextState !== current) {
        const count = compsData.length;
        const label = count === 1 ? `Add component: ${compsData[0].name || 'Component'}` : `Add ${count} components`;
        saveStateToHistory(label);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const updateComponent = useCallback(
    (id: string, updates: Partial<InventoryComponent>) => {
      const current = stateRef.current;
      const existing = current.components.find((c) => c.id === id);
      const compName = updates.name || (existing ? existing.name : 'Component');
      const nextState = handleUpdateComponent(current, id, updates);
      if (nextState !== current) {
        saveStateToHistory(`Edit component: ${compName}`);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const deleteComponent = useCallback(
    (id: string) => {
      const existing = stateRef.current.components.find((c) => c.id === id);
      const compName = existing ? existing.name : 'Component';
      
      const result = handleDeleteComponent(stateRef.current, id);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (result.nextState !== stateRef.current) {
        saveStateToHistory(`Delete component: ${compName}`);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const addPurchaseEntry = useCallback(
    (componentId: string, entry: Omit<PurchaseEntry, 'id'>) => {
      const current = stateRef.current;
      const nextState = handleAddPurchaseEntry(current, componentId, entry);
      if (nextState !== current) {
        const comp = current.components.find((c) => c.id === componentId);
        const compName = comp ? comp.name : 'Component';
        saveStateToHistory(`Add purchase batch: ${compName}`);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const updatePurchaseEntry = useCallback(
    (componentId: string, entryId: string, entry: Omit<PurchaseEntry, 'id'>) => {
      const comp = stateRef.current.components.find((c) => c.id === componentId);
      const compName = comp ? comp.name : 'Component';
      
      const result = handleUpdatePurchaseEntry(stateRef.current, componentId, entryId, entry);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (result.nextState !== stateRef.current) {
        saveStateToHistory(`Edit purchase batch: ${compName}`);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const deletePurchaseEntry = useCallback(
    (componentId: string, entryId: string) => {
      const comp = stateRef.current.components.find((c) => c.id === componentId);
      const compName = comp ? comp.name : 'Component';
      
      const result = handleDeletePurchaseEntry(stateRef.current, componentId, entryId);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (result.nextState !== stateRef.current) {
        saveStateToHistory(`Delete purchase batch: ${compName}`);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const updateMarketValue = useCallback(
    (componentId: string, value: number) => {
      const current = stateRef.current;
      const comp = current.components.find((c) => c.id === componentId);
      const compName = comp ? comp.name : 'Component';
      const nextState = handleUpdateMarketValue(current, componentId, value);
      if (nextState !== current) {
        saveStateToHistory(`Update market value: ${compName}`);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const sellComponentPart = useCallback(
    (componentId: string, purchaseEntryId: string, saleData: SellComponentPartData) => {
      const current = stateRef.current;
      const result = handleSellComponentPart(current, componentId, purchaseEntryId, saleData);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      if (result.nextState !== current) {
        const comp = current.components.find((c) => c.id === componentId);
        const compName = comp ? comp.name : 'part';
        const label = saleData.incomingTradePart
          ? `Trade part: ${compName}`
          : saleData.quantity > 1
          ? `Sell ${saleData.quantity}× ${compName}`
          : `Sell ${compName}`;
        saveStateToHistory(label);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const sellComponentPartsBulk = useCallback(
    (lines: import('./types').BulkSaleLine[], sharedSaleData: import('./types').BulkSaleSharedData) => {
      const current = stateRef.current;
      const result = handleSellComponentPartsBulk(current, lines, sharedSaleData);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      if (result.nextState !== current) {
        const totalUnits = lines.reduce((sum, l) => sum + (l.quantity || 1), 0);
        const label = `Bulk part sale: ${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`;
        saveStateToHistory(label);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const exchangeComponentPart = useCallback(
    (outgoingComponentId: string, outgoingPurchaseEntryId: string, exchangeData: ExchangeComponentPartData) => {
      const current = stateRef.current;
      const result = handleExchangeComponentPart(current, outgoingComponentId, outgoingPurchaseEntryId, exchangeData);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      if (result.nextState !== current) {
        const comp = current.components.find((c) => c.id === outgoingComponentId);
        const compName = comp ? comp.name : 'part';
        saveStateToHistory(`Trade part: ${compName}`);
        setState(result.nextState);
      }
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  // Build Actions
  const addBuild = useCallback(
    (build: Omit<PCBuild, 'id' | 'createdDate'>) => {
      const current = stateRef.current;
      const nextState = handleAddBuild(current, build);
      if (nextState !== current) {
        const label = `Create build: ${build.name || 'PC Build'}`;
        saveStateToHistory(label);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const addImportedBuilds = useCallback(
    (builds: PCBuild[]) => {
      const current = stateRef.current;
      const nextState = handleAddImportedBuilds(current, builds);
      if (nextState === current) return;
      const count = builds.length;
      const label = count === 1 ? `Import 1 build` : `Import ${count} builds`;
      saveStateToHistory(label);
      setState(nextState);
    },
    [saveStateToHistory, stateRef]
  );

  const updateBuildStatus = useCallback(
    (buildId: string, status: PCBuild['status']) => {
      const build = stateRef.current.builds.find((b) => b.id === buildId);
      const buildName = build ? build.name : 'Build';
      const nextState = handleUpdateBuildStatus(stateRef.current, buildId, status);
      if (nextState !== stateRef.current) {
        saveStateToHistory(`Set build to ${status}: ${buildName}`);
        setState(() => nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const updateBuild = useCallback(
    (buildId: string, updates: Partial<PCBuild>) => {
      const current = stateRef.current;
      const build = current.builds.find((b) => b.id === buildId);
      if (!build) return;

      const { status: _ignoredStatus, ...validUpdates } = updates;
      if (Object.keys(validUpdates).length === 0) {
        return;
      }

      const nextState = handleUpdateBuild(current, buildId, updates);
      if (nextState !== current) {
        const buildName = validUpdates.name || build.name;
        saveStateToHistory(`Edit build: ${buildName}`);
        setState(nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const allocatePartToBuild = useCallback(
    (
      buildId: string,
      componentId: string,
      purchaseEntryId: string,
      quantity: number
    ): { success: boolean; error?: string } => {
      const current = stateRef.current;
      const result = handleAllocatePartToBuild(current, buildId, componentId, purchaseEntryId, quantity);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.nextState !== current) {
        const build = current.builds.find((b) => b.id === buildId);
        const comp = current.components.find((c) => c.id === componentId);
        const compName = comp ? comp.name : 'Part';
        const buildName = build ? build.name : 'Build';
        saveStateToHistory(`Allocate part: ${compName} → ${buildName}`);
        setState(result.nextState);
      }

      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const removePartFromBuild = useCallback(
    (
      buildId: string,
      componentId: string,
      purchaseEntryId?: string
    ): { success: boolean; error?: string } => {
      const current = stateRef.current;
      const result = handleRemovePartFromBuild(current, buildId, componentId, purchaseEntryId);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.nextState !== current) {
        const build = current.builds.find((b) => b.id === buildId);
        const comp = current.components.find((c) => c.id === componentId);
        const compName = comp ? comp.name : 'Part';
        const buildName = build ? build.name : 'Build';
        saveStateToHistory(`Remove part: ${compName} ← ${buildName}`);
        setState(result.nextState);
      }

      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const swapPartInBuild = useCallback(
    (
      buildId: string,
      oldComponentId: string,
      oldPurchaseEntryId: string | undefined,
      newComponentId: string,
      newPurchaseEntryId: string,
      quantity: number
    ): { success: boolean; error?: string } => {
      const current = stateRef.current;
      const result = handleSwapPartInBuild(
        current,
        buildId,
        oldComponentId,
        oldPurchaseEntryId,
        newComponentId,
        newPurchaseEntryId,
        quantity
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.nextState !== current) {
        const build = current.builds.find((b) => b.id === buildId);
        const buildName = build ? build.name : 'Build';
        saveStateToHistory(`Swap part in: ${buildName}`);
        setState(result.nextState);
      }

      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const sellBuild = useCallback(
    (buildId: string, saleData: SellBuildData): { success: boolean; error?: string } => {
      const build = stateRef.current.builds.find((b) => b.id === buildId);
      if (!build) return { success: false, error: 'Build not found.' };
      const buildName = build.name || 'Build';
      const isEditing = build.status === 'Sold';
      
      const res = handleSellBuild(stateRef.current, buildId, saleData);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      if (res.nextState === stateRef.current) {
        return { success: true };
      }
      saveStateToHistory(isEditing ? `Edit sale: ${buildName}` : `Sell build: ${buildName}`);
      setState(() => res.nextState);
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const relistBuild = useCallback(
    (buildId: string): { success: boolean; error?: string } => {
      const res = handleRelistBuild(stateRef.current, buildId);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      if (res.nextState === stateRef.current) {
        return { success: true };
      }
      const build = stateRef.current.builds.find((b) => b.id === buildId);
      const buildName = build?.name || 'Build';
      saveStateToHistory(`Relist build: ${buildName}`);
      setState(() => res.nextState);
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const deleteBuild = useCallback(
    (buildId: string) => {
      const current = stateRef.current;
      const build = current.builds.find((b) => b.id === buildId);
      if (
        !build ||
        build.status === 'Sold' ||
        (build.parts && build.parts.length > 0) ||
        build.acquisitionSource === 'Trade-In'
      ) {
        return;
      }
      const nextState = handleDeleteBuild(current, buildId);
      if (nextState === current) return;
      const buildName = build.name;
      saveStateToHistory(`Delete build draft: ${buildName}`);
      setState(nextState);
    },
    [saveStateToHistory, stateRef]
  );

  const saveTradeInComponentBreakdown = useCallback(
    (buildId: string, breakdown: { id?: string; category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[]): { success: boolean; error?: string } => {
      const build = stateRef.current.builds.find(b => b.id === buildId);
      if (!build) return { success: false, error: 'Build not found.' };
      
      const res = handleSaveTradeInComponentBreakdown(stateRef.current, buildId, breakdown);
      if (!res.success) return { success: false, error: res.error };
      if (res.nextState === stateRef.current) return { success: true };
      
      saveStateToHistory(`Itemize trade-in PC: ${build.name || 'Build'}`);
      setState(() => res.nextState);
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  const dismantleBuild = useCallback(
    (
      buildId: string,
      extractedParts?: { category: ComponentCategory; name: string; quantity: number; unitCost: number }[]
    ): { success: boolean; error?: string } => {
      const build = stateRef.current.builds.find((b) => b.id === buildId);
      if (!build) return { success: false, error: 'Build not found.' };
      const buildName = build.name || 'Build';
      const isTradeIn = build.acquisitionSource === 'Trade-In';
      
      const res = handleDismantleBuild(stateRef.current, buildId, extractedParts);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      if (res.nextState === stateRef.current) {
        return { success: true };
      }
      saveStateToHistory(isTradeIn ? `Part out trade-in: ${buildName}` : `Dismantle build: ${buildName}`);
      setState(() => res.nextState);
      return { success: true };
    },
    [saveStateToHistory, stateRef]
  );

  // Transaction Actions
  const addTransaction = useCallback(
    (txData: Omit<TransactionLogItem, 'id'>) => {
      const summary = txData.title || txData.type || 'Transaction';
      const isPurchase = txData.type === 'PURCHASE';
      const rawLabel = `Add transaction: ${summary}`;
      const privacySafeLabel = isPurchase ? 'Add purchase transaction' : undefined;
      saveStateToHistory(rawLabel, privacySafeLabel);
      setState((prev) => handleAddTransaction(prev, txData));
    },
    [saveStateToHistory]
  );

  const updateTransaction = useCallback(
    (id: string, updates: Partial<TransactionLogItem>) => {
      const existing = stateRef.current.transactions.find((t) => t.id === id);
      if (!existing) return;
      const effectiveType = updates.type ?? existing.type;
      const isPurchase = effectiveType === 'PURCHASE';
      const summary = updates.title || existing.title || 'Transaction';
      
      const nextState = handleUpdateTransaction(stateRef.current, id, updates);
      if (nextState !== stateRef.current) {
        const rawLabel = `Edit transaction: ${summary}`;
        const privacySafeLabel = isPurchase ? 'Edit purchase transaction' : undefined;
        saveStateToHistory(rawLabel, privacySafeLabel);
        setState(() => nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const existing = stateRef.current.transactions.find((t) => t.id === id);
      if (!existing) return;

      // Check if this transaction created an incoming trade-in PC that has already been parted out or modified
      if (existing.incomingTradeInBuildId) {
        const tradeInBuild = stateRef.current.builds.find((b) => b.id === existing.incomingTradeInBuildId);
        const hasExtractedEntries = stateRef.current.components.some((c) =>
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
          return;
        }
      }

      const nextState = handleDeleteTransaction(stateRef.current, id);
      if (nextState !== stateRef.current) {
        const isPurchase = existing.type === 'PURCHASE';
        const summary = existing.title || 'Transaction';
        const rawLabel = `Delete transaction: ${summary}`;
        const privacySafeLabel = isPurchase ? 'Delete purchase transaction' : undefined;
        saveStateToHistory(rawLabel, privacySafeLabel);
        setState(() => nextState);
      }
    },
    [saveStateToHistory, stateRef]
  );

  const deleteBulkPartSale = useCallback(
    (bulkSaleGroupId: string) => {
      if (!bulkSaleGroupId) return;
      const current = stateRef.current;
      const hasEligible = current.transactions.some((t) =>
        isEligibleBulkPartSaleTransaction(t, bulkSaleGroupId, current.builds)
      );
      if (!hasEligible) return;
      const nextState = handleDeleteBulkPartSale(current, bulkSaleGroupId);
      if (nextState === current) return;
      saveStateToHistory('Delete bulk part sale record');
      setState(nextState);
    },
    [saveStateToHistory, stateRef]
  );

  const relistPartSale = useCallback(
    (transactionId: string) => {
      const current = stateRef.current;
      const tx = current.transactions.find((t) => t.id === transactionId);
      if (!tx || tx.type !== 'SALE') return;
      const relistQty = getValidatedRelistQuantity(tx);
      if (relistQty === null) return;

      const nextState = handleRelistPartSale(current, transactionId);
      if (nextState === current) return;
      const summary = tx.title || 'sale';
      saveStateToHistory(`Relist part sale: ${summary}`);
      setState(nextState);
    },
    [saveStateToHistory, stateRef]
  );

  const relistBulkPartSale = useCallback(
    (bulkSaleGroupId: string) => {
      if (!bulkSaleGroupId) return;
      const current = stateRef.current;
      const groupTxs = current.transactions.filter(
        (t) => t.type === 'SALE' && t.bulkSaleGroupId === bulkSaleGroupId
      );
      if (groupTxs.length === 0) return;

      for (const tx of groupTxs) {
        const relistQty = getValidatedRelistQuantity(tx);
        if (relistQty === null) return;
      }

      const nextState = handleRelistBulkPartSale(current, bulkSaleGroupId);
      if (nextState === current) return;
      saveStateToHistory('Relist bulk part sale');
      setState(nextState);
    },
    [saveStateToHistory, stateRef]
  );

  const contextValue: InventoryContextType = useMemo(
    () => ({
      state,
      isHydrated,
      undoCount,
      undo,
      redoCount,
      redo,
      undoHistory,
      redoHistory,
      resetToDefault,
      saveComponent,
      addComponent,
      addComponents,
      updateComponent,
      deleteComponent,
      addPurchaseEntry,
      updatePurchaseEntry,
      deletePurchaseEntry,
      updateMarketValue,
      sellComponentPart,
      sellComponentPartsBulk,
      exchangeComponentPart,
      addBuild,
      addImportedBuilds,
      updateBuildStatus,
      updateBuild,
      allocatePartToBuild,
      removePartFromBuild,
      swapPartInBuild,
      sellBuild,
      relistBuild,
      deleteBuild,
      dismantleBuild,
      saveTradeInComponentBreakdown,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      deleteBulkPartSale,
      relistPartSale,
      relistBulkPartSale,
      importData,
      loadSampleData,
      updateSheetStats,
      updateMonthlyGoal,
      lastBackupTimestamp,
      actionsSinceBackup,
      recordBackup,
    }),
    [
      state,
      undoCount,
      undo,
      redoCount,
      redo,
      undoHistory,
      redoHistory,
      resetToDefault,
      saveComponent,
      addComponent,
      addComponents,
      updateComponent,
      deleteComponent,
      addPurchaseEntry,
      updatePurchaseEntry,
      deletePurchaseEntry,
      updateMarketValue,
      sellComponentPart,
      sellComponentPartsBulk,
      exchangeComponentPart,
      addBuild,
      addImportedBuilds,
      updateBuildStatus,
      updateBuild,
      allocatePartToBuild,
      removePartFromBuild,
      swapPartInBuild,
      sellBuild,
      relistBuild,
      deleteBuild,
      dismantleBuild,
      saveTradeInComponentBreakdown,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      deleteBulkPartSale,
      relistPartSale,
      relistBulkPartSale,
      importData,
      loadSampleData,
      updateSheetStats,
      updateMonthlyGoal,
      lastBackupTimestamp,
      actionsSinceBackup,
      recordBackup,
      isHydrated,
    ]
  );

  return (
    <InventoryContext.Provider value={contextValue}>
      {!isHydrated ? (
        <div className="min-h-screen bg-[#080B10] flex items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#7C6CF2]/20 border-t-[#7C6CF2] rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider text-zinc-500 uppercase">Loading workspace...</span>
          </div>
        </div>
      ) : (
        children
      )}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
