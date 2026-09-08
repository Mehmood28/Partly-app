import localforage from 'localforage';
import { AppState, Condition, InventoryComponent, PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import { normalizeDateString, normalizeTimestampString, autoTagComponent } from './helpers';

export const STORAGE_KEY = 'pc_inventory_tracker_v2';
export const DB_NAME = 'PartlyPCInventoryDB';
export const STORE_NAME = 'partly_state';

// Configure localforage to prioritize IndexedDB, falling back to WebSQL then localStorage
localforage.config({
  name: DB_NAME,
  storeName: STORE_NAME,
  description: 'Partly PC Inventory Tracker IndexedDB Store',
});

const mapCondition = (cond: unknown): Condition => {
  if (!cond) return 'Used No Box';
  if (typeof cond !== 'string') return 'Used No Box';
  const upper = cond.toUpperCase();
  if (upper === 'NEW') return 'Sealed';
  if (upper === 'USED' || upper === 'REFURB') return 'Used No Box';
  if (
    cond === 'Sealed' ||
    cond === 'New Open Box' ||
    cond === 'New No Box' ||
    cond === 'Used Open Box' ||
    cond === 'Used No Box'
  )
    return cond;
  if (cond === 'Used') return 'Used No Box';
  return 'Used No Box';
};

/**
 * Sanitizes and normalizes loaded AppState to ensure data integrity
 */
export const sanitizeAppState = (parsed: unknown): AppState => {
  if (!parsed || typeof parsed !== 'object') {
    return getDefaultAppState();
  }

  const parsedObj = parsed as Record<string, unknown>;
  const rawBuilds = Array.isArray(parsedObj.builds) ? (parsedObj.builds as PCBuild[]) : [];
  const rawTransactions = Array.isArray(parsedObj.transactions) ? (parsedObj.transactions as TransactionLogItem[]) : [];
  const rawComponents = Array.isArray(parsedObj.components) ? (parsedObj.components as InventoryComponent[]) : [];

  // 1. Normalize dates in builds and strip obsolete platformFees
  const dateCleanedBuilds: PCBuild[] = rawBuilds.map((b: PCBuild) => {
    const rawB = b as unknown as Record<string, unknown>;
    const { platformFees: _obsoleteFees, ...restB } = rawB;
    const newB: PCBuild = {
      ...(restB as unknown as PCBuild),
      notes: b.notes ? b.notes.replace(/Sheet Status: [^\n;]*/gi, '').trim() || undefined : undefined,
    };
    if ('warrantyDays' in newB) {
      if (newB.warrantyDays !== undefined && newB.warrantyDays !== null) {
        const parsed = Number(newB.warrantyDays);
        if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
          delete newB.warrantyDays;
        } else {
          newB.warrantyDays = parsed;
        }
      } else {
        delete newB.warrantyDays;
      }
    }
    if (newB.createdDate) {
      newB.createdDate = normalizeDateString(newB.createdDate);
    }
    if (newB.saleDate) {
      newB.saleDate = normalizeDateString(newB.saleDate);
    }
    return newB;
  });

  // 2. Normalize dates in transactions and strip obsolete platformFees
  const cleanedTransactions: TransactionLogItem[] = rawTransactions.map((tx: TransactionLogItem) => {
    const rawTx = tx as unknown as Record<string, unknown>;
    const { platformFees: _obsoleteFees, ...restTx } = rawTx;
    const newTx: TransactionLogItem = { ...(restTx as unknown as TransactionLogItem) };
    if ('warrantyDaysAtSale' in newTx) {
      if (newTx.warrantyDaysAtSale !== undefined && newTx.warrantyDaysAtSale !== null) {
        const parsed = Number(newTx.warrantyDaysAtSale);
        if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
          delete newTx.warrantyDaysAtSale;
        } else {
          newTx.warrantyDaysAtSale = parsed;
        }
      } else {
        delete newTx.warrantyDaysAtSale;
      }
    }
    if (tx.timestamp) {
      newTx.timestamp = normalizeTimestampString(tx.timestamp);
    }
    if (tx.dateSortable) {
      newTx.dateSortable = normalizeDateString(tx.dateSortable);
    }
    return newTx;
  });

  // 3. Clean & tag components
  const cleanedComponents: InventoryComponent[] = rawComponents.map((comp: InventoryComponent) => {
    const specsStr = typeof comp.specifications === 'string' ? comp.specifications : (comp.specifications ? String(comp.specifications) : '');
    const nameStr = typeof comp.name === 'string' ? comp.name : (comp.name ? String(comp.name) : '');
    const catStr = typeof comp.category === 'string' ? comp.category : (comp.category ? String(comp.category) : 'Other');

    const tags: string[] = Array.isArray(comp.tags)
      ? [...comp.tags]
      : autoTagComponent(nameStr, specsStr, catStr);

    const catUpper = catStr.toUpperCase();
    if (catUpper === 'CASE' || catUpper === 'PSU') {
      const title = nameStr;
      if (/\bwhite\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'WHITE')) {
        tags.push('WHITE');
      }
      if (/\bblack\b/i.test(title) && !tags.some((t: string) => String(t).toUpperCase() === 'BLACK')) {
        tags.push('BLACK');
      }
    }

    let sanitizedReservation: Record<string, number> | undefined = undefined;
    if (comp.unresolvedLegacyReservationByPurchaseEntryId && typeof comp.unresolvedLegacyReservationByPurchaseEntryId === 'object') {
      const resMap: Record<string, number> = {};
      for (const [k, v] of Object.entries(comp.unresolvedLegacyReservationByPurchaseEntryId)) {
        const num = Number(v);
        if (Number.isFinite(num) && num > 0) {
          resMap[k] = num;
        }
      }
      if (Object.keys(resMap).length > 0) {
        sanitizedReservation = resMap;
      }
    }

    return {
      ...comp,
      name: nameStr,
      specifications: specsStr,
      category: comp.category || 'Other',
      tags,
      unresolvedLegacyReservationByPurchaseEntryId: sanitizedReservation,
      purchaseHistory: Array.isArray(comp.purchaseHistory)
        ? comp.purchaseHistory.map((entry: PurchaseEntry) => ({
            ...entry,
            condition: mapCondition(entry.condition),
          }))
        : [],
    };
  });

  // 4. Safe legacy backfill for build parts lacking purchaseEntryId
  const componentMap = new Map<string, InventoryComponent>();
  cleanedComponents.forEach((c) => {
    if (c && c.id) {
      componentMap.set(c.id, c);
    }
  });

  // Track aggregate build allocations for components that have exactly one purchase batch
  const compAllocations = new Map<
    string,
    { totalRequired: number; unlinkedCount: number; soleEntryId: string | null }
  >();

  cleanedComponents.forEach((c) => {
    if (c.purchaseHistory && c.purchaseHistory.length === 1) {
      const soleEntry = c.purchaseHistory[0];
      compAllocations.set(c.id, {
        totalRequired: 0,
        unlinkedCount: 0,
        soleEntryId: soleEntry.id,
      });
    }
  });

  dateCleanedBuilds.forEach((b) => {
    (b.parts || []).forEach((p) => {
      if (p.componentId && compAllocations.has(p.componentId)) {
        const alloc = compAllocations.get(p.componentId)!;
        const qty = Number(p.quantity) || 0;
        alloc.totalRequired += qty;
        if (!p.purchaseEntryId) {
          alloc.unlinkedCount += qty;
        }
      }
    });
  });

  const eligibleSoleEntries = new Map<string, string>(); // componentId -> soleEntryId
  compAllocations.forEach((alloc, compId) => {
    const comp = componentMap.get(compId);
    if (comp && comp.purchaseHistory && comp.purchaseHistory.length === 1 && alloc.soleEntryId) {
      const soleEntryCapacity = Number(comp.purchaseHistory[0].quantity) || 0;
      const assignedCount = Number(comp.assignedCount) || 0;
      const requiredCapacity = Math.max(alloc.totalRequired, assignedCount);
      if (alloc.unlinkedCount > 0 && requiredCapacity <= soleEntryCapacity) {
        eligibleSoleEntries.set(compId, alloc.soleEntryId);
      }
    }
  });

  const cleanedBuilds: PCBuild[] = dateCleanedBuilds.map((b) => {
    if (!b.parts || b.parts.length === 0) return b;
    let hasChanges = false;
    const newParts = b.parts.map((p) => {
      if (!p.purchaseEntryId && p.componentId && eligibleSoleEntries.has(p.componentId)) {
        hasChanges = true;
        return {
          ...p,
          purchaseEntryId: eligibleSoleEntries.get(p.componentId)!,
        };
      }
      return p;
    });
    return hasChanges ? { ...b, parts: newParts } : b;
  });

  // 5. User sheetStats
  const rawSheetStats = typeof parsedObj.sheetStats === 'object' && parsedObj.sheetStats !== null ? (parsedObj.sheetStats as Record<string, unknown>) : null;
  const savedMonthly = rawSheetStats && Array.isArray(rawSheetStats.monthly) ? (rawSheetStats.monthly as { month: string; revenue: number; profit: number; pcsSold: number }[]) : [];
  const yearlyStats = {
    revenue: savedMonthly.reduce((sum: number, m: { revenue?: number }) => sum + (Number(m.revenue) || 0), 0),
    profit: savedMonthly.reduce((sum: number, m: { profit?: number }) => sum + (Number(m.profit) || 0), 0),
    pcsSold: savedMonthly.reduce((sum: number, m: { pcsSold?: number }) => sum + (Number(m.pcsSold) || 0), 0),
  };

  let resolvedGoal = 10000;
  if (isValidMonthlyGoal(parsedObj.monthlyGoal)) {
    resolvedGoal = parsedObj.monthlyGoal;
  }

  return {
    ...parsedObj,
    components: cleanedComponents,
    builds: cleanedBuilds,
    transactions: cleanedTransactions,
    sheetStats: {
      monthly: savedMonthly,
      yearly: yearlyStats,
    },
    monthlyGoal: resolvedGoal,
  };
};

export const getDefaultAppState = (): AppState => {
  return {
    components: [],
    builds: [],
    transactions: [],
    monthlyGoal: 10000,
    sheetStats: {
      monthly: [],
      yearly: { revenue: 0, profit: 0, pcsSold: 0 },
    },
  };
};

/**
 * Versioned persistence envelope definitions and validators
 */
export const ENVELOPE_FORMAT = 'partly_versioned_envelope' as const;
export const ENVELOPE_VERSION = 1;

export interface StorageEnvelope {
  format: typeof ENVELOPE_FORMAT;
  version: number;
  revision: number;
  savedAt: string;
  state: AppState;
}

export const isStorageEnvelope = (obj: unknown): obj is StorageEnvelope => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    candidate.format === ENVELOPE_FORMAT &&
    candidate.version === ENVELOPE_VERSION &&
    typeof candidate.revision === 'number' &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision >= 0 &&
    typeof candidate.savedAt === 'string' &&
    candidate.savedAt.trim().length > 0 &&
    !Number.isNaN(Date.parse(candidate.savedAt)) &&
    typeof candidate.state === 'object' &&
    candidate.state !== null &&
    !Array.isArray(candidate.state) &&
    Array.isArray((candidate.state as Record<string, unknown>).components) &&
    Array.isArray((candidate.state as Record<string, unknown>).builds) &&
    Array.isArray((candidate.state as Record<string, unknown>).transactions)
  );
};

export const isValidLegacyAppState = (raw: unknown): raw is Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  if (obj.format === ENVELOPE_FORMAT) return false;
  return (
    Array.isArray(obj.components) ||
    Array.isArray(obj.builds) ||
    Array.isArray(obj.transactions) ||
    (typeof obj.sheetStats === 'object' && obj.sheetStats !== null) ||
    typeof obj.monthlyGoal === 'number'
  );
};

export interface CandidateSnapshot {
  source: 'indexeddb' | 'localstorage';
  state: AppState;
  revision: number;
  savedAt?: string;
  isEnvelope: boolean;
  rawEnvelope?: StorageEnvelope;
}

export const parseCandidate = (
  raw: unknown,
  source: 'indexeddb' | 'localstorage'
): CandidateSnapshot | null => {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (isStorageEnvelope(raw)) {
    return {
      source,
      state: sanitizeAppState(raw.state),
      revision: raw.revision,
      savedAt: raw.savedAt,
      isEnvelope: true,
      rawEnvelope: raw,
    };
  }

  if (isValidLegacyAppState(raw)) {
    return {
      source,
      state: sanitizeAppState(raw),
      revision: 0,
      isEnvelope: false,
    };
  }

  return null;
};

// Monotonic revision counter
let highestKnownRevision = 0;

export const setHighestKnownRevision = (rev: number): void => {
  if (
    typeof rev === 'number' &&
    Number.isSafeInteger(rev) &&
    rev >= 0 &&
    rev > highestKnownRevision
  ) {
    highestKnownRevision = rev;
  }
};

export const getHighestKnownRevision = (): number => highestKnownRevision;

export const resetStorageRevisionForTesting = (rev = 0): void => {
  highestKnownRevision =
    typeof rev === 'number' && Number.isSafeInteger(rev) && rev >= 0 ? rev : 0;
};

export const getNextRevision = (): number => {
  const now = Date.now();
  const next = Math.max(now, highestKnownRevision + 1);
  highestKnownRevision = next;
  return next;
};

export const isValidMonthlyGoal = (val: unknown): val is number =>
  typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val) && val > 0;

export interface ParsedBackupPayload {
  components: InventoryComponent[];
  builds: PCBuild[];
  transactions: TransactionLogItem[];
  sheetStats?: AppState['sheetStats'];
  monthlyGoal?: number;
}

export interface ParseBackupResult {
  success: boolean;
  payload?: ParsedBackupPayload;
  counts?: {
    components: number;
    builds: number;
    transactions: number;
  };
  error?: string;
}

export const parseBackupObject = (json: unknown): ParseBackupResult => {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {
      success: false,
      error: 'Invalid JSON structure: Expected a JSON object.',
    };
  }

  const candidate = json as Record<string, unknown>;
  const hasComponentsArray = Array.isArray(candidate.components);
  const hasBuildsArray = Array.isArray(candidate.builds);
  const hasTransactionsArray = Array.isArray(candidate.transactions);

  if (!hasComponentsArray && !hasBuildsArray && !hasTransactionsArray) {
    return {
      success: false,
      error: 'File does not contain valid Partly inventory, build, or transaction records.',
    };
  }

  const components = hasComponentsArray ? (candidate.components as InventoryComponent[]) : [];
  const builds = hasBuildsArray ? (candidate.builds as PCBuild[]) : [];
  const transactions = hasTransactionsArray ? (candidate.transactions as TransactionLogItem[]) : [];

  return {
    success: true,
    payload: {
      components,
      builds,
      transactions,
      sheetStats:
        candidate.sheetStats && typeof candidate.sheetStats === 'object'
          ? (candidate.sheetStats as AppState['sheetStats'])
          : undefined,
      monthlyGoal:
        typeof candidate.monthlyGoal === 'number'
          ? candidate.monthlyGoal
          : undefined,
    },
    counts: {
      components: components.length,
      builds: builds.length,
      transactions: transactions.length,
    },
  };
};

export const parseBackupJSON = (jsonString: string): ParseBackupResult => {
  try {
    const json = JSON.parse(jsonString);
    return parseBackupObject(json);
  } catch (err: unknown) {
    return {
      success: false,
      error: `Failed to import JSON: ${err instanceof Error ? err.message : 'Invalid JSON format'}`,
    };
  }
};

export const prepareBackupImportState = (
  currentState: AppState,
  backup: Partial<AppState>
): AppState => {
  let resolvedGoal = 10000;
  if (isValidMonthlyGoal(backup.monthlyGoal)) {
    resolvedGoal = backup.monthlyGoal;
  } else if (isValidMonthlyGoal(currentState.monthlyGoal)) {
    resolvedGoal = currentState.monthlyGoal;
  }

  const candidateRaw = {
    ...backup,
    components: Array.isArray(backup.components) ? backup.components : [],
    builds: Array.isArray(backup.builds) ? backup.builds : [],
    transactions: Array.isArray(backup.transactions) ? backup.transactions : [],
    sheetStats:
      backup.sheetStats !== undefined && backup.sheetStats !== null
        ? backup.sheetStats
        : currentState.sheetStats,
    monthlyGoal: resolvedGoal,
  };

  return sanitizeAppState(candidateRaw);
};

export const canonicalizeJSON = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJSON(item));
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = canonicalizeJSON(val);
    }
  }

  return result;
};

export const canonicalStringify = (value: unknown): string => {
  return JSON.stringify(canonicalizeJSON(value));
};

export const areAppStatesEqual = (a: AppState, b: AppState): boolean => {
  try {
    if (a === b) return true;
    if (!a || !b) return false;
    return canonicalStringify(a) === canonicalStringify(b);
  } catch {
    return false;
  }
};

// Serialized write queue so older async writes cannot finish after newer ones
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Persists AppState to IndexedDB and localStorage wrapped in a versioned envelope
 */
export const persistAppState = async (
  state: AppState
): Promise<StorageEnvelope> => {
  const task = async (): Promise<StorageEnvelope> => {
    const revision = getNextRevision();
    setHighestKnownRevision(revision);

    const envelope: StorageEnvelope = {
      format: ENVELOPE_FORMAT,
      version: ENVELOPE_VERSION,
      revision,
      savedAt: new Date().toISOString(),
      state,
    };

    let idbSuccess = false;
    let localSuccess = false;
    let idbError: unknown = null;
    let localError: unknown = null;

    // 1. Write to IndexedDB
    try {
      await localforage.setItem(STORAGE_KEY, envelope);
      idbSuccess = true;
    } catch (err) {
      idbError = err;
      console.error('Failed to write state to IndexedDB:', err);
    }

    // 2. Write to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      localSuccess = true;
    } catch (err) {
      localError = err;
      console.warn('Failed to write state to localStorage:', err);
    }

    // 3. Reject if both failed so callers can log the failure
    if (!idbSuccess && !localSuccess) {
      throw new Error(
        `Failed to persist state to both IndexedDB and localStorage. IDB error: ${idbError}, localStorage error: ${localError}`
      );
    }

    return envelope;
  };

  const currentWrite = writeQueue.then(task, task);
  writeQueue = currentWrite.catch(() => {});
  return currentWrite;
};

export interface BackupImportExecutionResult {
  success: boolean;
  changed: boolean;
  nextState: AppState;
  error?: string;
}

type BackupStatePersister = (state: AppState) => Promise<unknown>;

/**
 * Prepares and durably persists a backup before the caller commits it to React state.
 * A failed persistence attempt leaves the current in-memory state untouched.
 */
export const executeBackupImport = async (
  currentState: AppState,
  backup: Partial<AppState>,
  persistState: BackupStatePersister = persistAppState
): Promise<BackupImportExecutionResult> => {
  let candidateState: AppState;

  try {
    candidateState = prepareBackupImportState(currentState, backup);
  } catch (err: unknown) {
    return {
      success: false,
      changed: false,
      nextState: currentState,
      error: err instanceof Error ? err.message : 'Unable to prepare the imported backup.',
    };
  }

  if (areAppStatesEqual(currentState, candidateState)) {
    return {
      success: true,
      changed: false,
      nextState: currentState,
    };
  }

  try {
    await persistState(candidateState);
  } catch {
    return {
      success: false,
      changed: false,
      nextState: currentState,
      error: 'Unable to save the imported backup. Your current data was left unchanged.',
    };
  }

  return {
    success: true,
    changed: true,
    nextState: candidateState,
  };
};

/**
 * Synchronous initial state loader from localStorage to guarantee instant initial paint
 */
export const getSyncInitialAppState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isStorageEnvelope(parsed)) {
        setHighestKnownRevision(parsed.revision);
        return sanitizeAppState(parsed.state);
      }
      if (isValidLegacyAppState(parsed)) {
        return sanitizeAppState(parsed);
      }
    }
  } catch (err) {
    console.warn('Could not read sync initial state from localStorage:', err);
  }
  return getDefaultAppState();
};

export interface ResolutionResult {
  state: AppState;
  revision: number;
  winnerSource: 'indexeddb' | 'localstorage' | 'default';
  reconciled: boolean;
}

export const selectWinningCandidate = (
  idbCandidate: CandidateSnapshot | null,
  localCandidate: CandidateSnapshot | null
): CandidateSnapshot | null => {
  if (idbCandidate && !localCandidate) {
    return idbCandidate;
  }
  if (!idbCandidate && localCandidate) {
    return localCandidate;
  }
  if (!idbCandidate && !localCandidate) {
    return null;
  }

  const idb = idbCandidate!;
  const local = localCandidate!;

  // Higher revision strictly wins regardless of record count
  if (idb.revision > local.revision) {
    return idb;
  }
  if (local.revision > idb.revision) {
    return local;
  }

  // Equal revision tie
  if (idb.isEnvelope && local.isEnvelope) {
    // Both are envelopes with identical revision: prefer IndexedDB deterministically
    return idb;
  }

  if (!idb.isEnvelope && !local.isEnvelope) {
    // Both are legacy revision-0 snapshots
    const equal = areAppStatesEqual(idb.state, local.state);
    if (equal) {
      return idb;
    }
    // ONE-TIME LEGACY TIE RULE:
    // When two legacy snapshots differ and no trustworthy revision exists, prefer localStorage
    // because the existing persistAppState implementation wrote IndexedDB first and the local mirror
    // afterward; do not use record count. If IndexedDB had an outdated write or failed to sync,
    // localStorage represents the final mirrored write.
    return local;
  }

  return idb.isEnvelope ? idb : local;
};

let activeResolutionPromise: Promise<ResolutionResult> | null = null;

/**
 * Asynchronously resolves the authoritative storage snapshot between IndexedDB and localStorage,
 * deterministically reconciles/migrates storage, and returns the winning state.
 */
export const resolveInitialAppState = (): Promise<ResolutionResult> => {
  if (activeResolutionPromise) {
    return activeResolutionPromise;
  }

  activeResolutionPromise = (async (): Promise<ResolutionResult> => {
    try {
      // 1. Read IndexedDB candidate independently
      let idbCandidate: CandidateSnapshot | null = null;
      try {
        const raw = await localforage.getItem(STORAGE_KEY);
        idbCandidate = parseCandidate(raw, 'indexeddb');
      } catch (err) {
        console.warn('Error reading from IndexedDB during resolution:', err);
        idbCandidate = null;
      }

      // 2. Read localStorage candidate independently
      let localCandidate: CandidateSnapshot | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          const raw = JSON.parse(saved);
          localCandidate = parseCandidate(raw, 'localstorage');
        }
      } catch (err) {
        console.warn('Error reading from localStorage during resolution:', err);
        localCandidate = null;
      }

      // 3. Register any seen revisions
      if (idbCandidate?.revision) setHighestKnownRevision(idbCandidate.revision);
      if (localCandidate?.revision) setHighestKnownRevision(localCandidate.revision);

      // 4. Select winner deterministically
      const winner = selectWinningCandidate(idbCandidate, localCandidate);

      if (!winner) {
        const defaultState = getDefaultAppState();
        return {
          state: defaultState,
          revision: 0,
          winnerSource: 'default',
          reconciled: true,
        };
      }

      // 5. Reconcile / migrate backends without altering contained AppState
      let reconciled = true;

      if (!winner.isEnvelope) {
        // Legacy migration: create a new versioned envelope and write to both backends
        try {
          await persistAppState(winner.state);
          reconciled = true;
        } catch (err) {
          console.warn('Failed to migrate legacy state to versioned persistence:', err);
          reconciled = false;
        }
      } else {
        // Winner is an envelope. Check if the other backend is missing, legacy, has a lower revision,
        // or has equal revision with divergent content.
        const idbNeedsReconcile =
          !idbCandidate ||
          !idbCandidate.isEnvelope ||
          idbCandidate.revision < winner.revision ||
          (idbCandidate.revision === winner.revision &&
            !areAppStatesEqual(winner.state, idbCandidate.state));

        const localNeedsReconcile =
          !localCandidate ||
          !localCandidate.isEnvelope ||
          localCandidate.revision < winner.revision ||
          (localCandidate.revision === winner.revision &&
            !areAppStatesEqual(winner.state, localCandidate.state));

        // Only the backend that is NOT the winner source should be rewritten
        const needsIdbUpdate = winner.source !== 'indexeddb' && idbNeedsReconcile;
        const needsLocalUpdate = winner.source !== 'localstorage' && localNeedsReconcile;

        if (needsIdbUpdate || needsLocalUpdate) {
          const envelopeToSave: StorageEnvelope = {
            format: ENVELOPE_FORMAT,
            version: ENVELOPE_VERSION,
            revision: winner.revision,
            savedAt: winner.savedAt || new Date().toISOString(),
            state: winner.state,
          };

          let idbWriteSuccess = true;
          let localWriteSuccess = true;

          const reconcileTask = async () => {
            if (needsIdbUpdate) {
              idbWriteSuccess = false;
              try {
                await localforage.setItem(STORAGE_KEY, envelopeToSave);
                idbWriteSuccess = true;
              } catch (err) {
                console.warn('Failed to reconcile IndexedDB:', err);
              }
            }
            if (needsLocalUpdate) {
              localWriteSuccess = false;
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(envelopeToSave));
                localWriteSuccess = true;
              } catch (err) {
                console.warn('Failed to reconcile localStorage:', err);
              }
            }
          };

          const write = writeQueue.then(reconcileTask, reconcileTask);
          writeQueue = write.catch(() => {});
          await write;

          reconciled = idbWriteSuccess && localWriteSuccess;
        } else {
          // No reconciliation was required
          reconciled = true;
        }
      }

      return {
        state: winner.state,
        revision: winner.isEnvelope ? winner.revision : getHighestKnownRevision(),
        winnerSource: winner.source,
        reconciled,
      };
    } finally {
      activeResolutionPromise = null;
    }
  })();

  return activeResolutionPromise;
};

/**
 * Backwards-compatible async loader
 */
export const loadAppStateFromIndexedDB = async (): Promise<AppState> => {
  const result = await resolveInitialAppState();
  return result.state;
};
