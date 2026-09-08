import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeAppState,
  parseBackupObject,
  parseBackupJSON,
  prepareBackupImportState,
  areAppStatesEqual,
  isValidMonthlyGoal,
  canonicalizeJSON,
  canonicalStringify,
  executeBackupImport,
  executePersistedStateChange,
} from './storage';
import { AppState } from '../types';

describe('Storage Warranty Sanitization', () => {
  it('preserves valid warranty values and falls back safely for invalid ones', () => {
    const raw = {
      builds: [
        { id: 'b1', name: 'Valid', warrantyDays: 60, createdDate: '2026-07-23' },
        { id: 'b2', name: 'Invalid', warrantyDays: 1.5, createdDate: '2026-07-23' },
        { id: 'b3', name: 'String', warrantyDays: '90', createdDate: '2026-07-23' },
        { id: 'b4', name: 'Empty', createdDate: '2026-07-23' },
      ],
      transactions: [
        { id: 'tx1', type: 'SALE', warrantyDaysAtSale: 120 },
        { id: 'tx2', type: 'SALE', warrantyDaysAtSale: 0 },
        { id: 'tx3', type: 'SALE' },
      ],
      components: [],
      monthlyGoal: 1000,
    };

    const sanitized = sanitizeAppState(raw);

    expect(sanitized.builds[0].warrantyDays).toBe(60);
    expect(sanitized.builds[1].warrantyDays).toBeUndefined();
    expect(sanitized.builds[2].warrantyDays).toBe(90);
    expect(sanitized.builds[3].warrantyDays).toBeUndefined();

    expect(sanitized.transactions[0].warrantyDaysAtSale).toBe(120);
    expect(sanitized.transactions[1].warrantyDaysAtSale).toBeUndefined();
    expect(sanitized.transactions[2].warrantyDaysAtSale).toBeUndefined();
  });
});

describe('JSON Backup Parsing & Recognition', () => {
  it('accepts a components-only backup', () => {
    const res = parseBackupObject({
      components: [{ id: 'c1', name: 'RTX 4070' }],
    });
    expect(res.success).toBe(true);
    expect(res.payload?.components).toHaveLength(1);
    expect(res.payload?.builds).toEqual([]);
    expect(res.payload?.transactions).toEqual([]);
    expect(res.counts).toEqual({ components: 1, builds: 0, transactions: 0 });
  });

  it('accepts a builds-only backup', () => {
    const res = parseBackupObject({
      builds: [{ id: 'b1', name: 'Gaming Rig' }],
    });
    expect(res.success).toBe(true);
    expect(res.payload?.builds).toHaveLength(1);
    expect(res.payload?.components).toEqual([]);
    expect(res.payload?.transactions).toEqual([]);
    expect(res.counts).toEqual({ components: 0, builds: 1, transactions: 0 });
  });

  it('accepts a transactions-only legacy backup', () => {
    const res = parseBackupObject({
      transactions: [{ id: 'tx1', type: 'SALE', totalAmount: 1200 }],
    });
    expect(res.success).toBe(true);
    expect(res.payload?.transactions).toHaveLength(1);
    expect(res.payload?.components).toEqual([]);
    expect(res.payload?.builds).toEqual([]);
    expect(res.counts).toEqual({ components: 0, builds: 0, transactions: 1 });
  });

  it('preserves monthlyGoal and ignores retired sheetStats when supplied', () => {
    const backup = {
      components: [{ id: 'c1', name: 'RAM' }],
      builds: [],
      transactions: [],
      monthlyGoal: 7500.5,
      sheetStats: {
        monthly: [{ month: '2026-03', revenue: 2000, profit: 800, pcsSold: 2 }],
        yearly: { revenue: 2000, profit: 800, pcsSold: 2 },
      },
    };
    const res = parseBackupObject(backup);
    expect(res.success).toBe(true);
    expect(res.payload?.monthlyGoal).toBe(7500.5);
    expect(res.payload).not.toHaveProperty('sheetStats');
  });

  it('rejects JSON with none of the three arrays', () => {
    expect(parseBackupObject({})).toEqual({
      success: false,
      error: 'File does not contain valid Partly inventory, build, or transaction records.',
    });
    expect(parseBackupObject({ monthlyGoal: 5000, otherKey: 'val' })).toEqual({
      success: false,
      error: 'File does not contain valid Partly inventory, build, or transaction records.',
    });
  });

  it('rejects malformed, null, array, and non-object top-level JSON', () => {
    expect(parseBackupObject(null).success).toBe(false);
    expect(parseBackupObject([]).success).toBe(false);
    expect(parseBackupObject('string').success).toBe(false);
    expect(parseBackupObject(12345).success).toBe(false);
    expect(parseBackupJSON('not valid json {').success).toBe(false);
  });
});

describe('Monthly Goal Validation & Fractional Support', () => {
  it('accepts positive integers and positive finite decimal values', () => {
    expect(isValidMonthlyGoal(1)).toBe(true);
    expect(isValidMonthlyGoal(10000)).toBe(true);
    expect(isValidMonthlyGoal(5000.5)).toBe(true);
    expect(isValidMonthlyGoal(0.01)).toBe(true);
    expect(isValidMonthlyGoal(1234.5678)).toBe(true);
  });

  it('rejects zero, negative, NaN, Infinity, negative Infinity, and non-number values', () => {
    expect(isValidMonthlyGoal(0)).toBe(false);
    expect(isValidMonthlyGoal(-0)).toBe(false);
    expect(isValidMonthlyGoal(-1)).toBe(false);
    expect(isValidMonthlyGoal(-5000.5)).toBe(false);
    expect(isValidMonthlyGoal(NaN)).toBe(false);
    expect(isValidMonthlyGoal(Infinity)).toBe(false);
    expect(isValidMonthlyGoal(-Infinity)).toBe(false);
    expect(isValidMonthlyGoal('5000')).toBe(false);
    expect(isValidMonthlyGoal(null)).toBe(false);
    expect(isValidMonthlyGoal(undefined)).toBe(false);
    expect(isValidMonthlyGoal({})).toBe(false);
    expect(isValidMonthlyGoal([])).toBe(false);
    expect(isValidMonthlyGoal(true)).toBe(false);
  });

  it('preserves 5000.50 in sanitizeAppState', () => {
    const sanitized = sanitizeAppState({
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 5000.5,
    });
    expect(sanitized.monthlyGoal).toBe(5000.5);
  });

  it('restores 5000.50 from a backup in prepareBackupImportState', () => {
    const currentState: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 8000,
    };
    const candidate = prepareBackupImportState(currentState, {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 5000.5,
    });
    expect(candidate.monthlyGoal).toBe(5000.5);
  });

  it('retains a current goal of 5000.50 when backup goal is missing or invalid', () => {
    const currentState: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 5000.5,
    };
    // Missing goal
    const candidateMissing = prepareBackupImportState(currentState, {
      components: [],
      builds: [],
      transactions: [],
    });
    expect(candidateMissing.monthlyGoal).toBe(5000.5);

    // Invalid goals
    const invalidGoals = [0, -100, NaN, Infinity, -Infinity, '5000' as unknown as number];
    for (const invalidGoal of invalidGoals) {
      const candidateInvalid = prepareBackupImportState(currentState, {
        components: [],
        builds: [],
        transactions: [],
        monthlyGoal: invalidGoal,
      });
      expect(candidateInvalid.monthlyGoal).toBe(5000.5);
    }
  });

  it('falls back to 10000 if both backup goal and current goal are invalid or missing', () => {
    const invalidCurrentState: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: undefined,
    };
    const candidate = prepareBackupImportState(invalidCurrentState, {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: -50,
    });
    expect(candidate.monthlyGoal).toBe(10000);
  });
});

describe('prepareBackupImportState & Field Preservation', () => {
  const baseCurrentState: AppState = {
    components: [
      {
        id: 'cur-c1',
        name: 'Old CPU',
        category: 'CPU',
        specifications: '3.5GHz',
        purchaseHistory: [],
        assignedCount: 0,
      },
    ],
    builds: [],
    transactions: [],
    monthlyGoal: 8000,
  };

  it('restores monthlyGoal from a valid backup', () => {
    const candidate = prepareBackupImportState(baseCurrentState, {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 5000,
    });
    expect(candidate.monthlyGoal).toBe(5000);
  });

  it('strips retired sheetStats from imported backups', () => {
    const candidate = prepareBackupImportState(baseCurrentState, {
      components: [],
      builds: [],
      transactions: [],
      sheetStats: {
        monthly: [{ month: '2026-05', revenue: 3000, profit: 1200, pcsSold: 3 }],
        yearly: { revenue: 3000, profit: 1200, pcsSold: 3 },
      },
    } as Partial<AppState>);
    expect(candidate).not.toHaveProperty('sheetStats');
  });

  it('replaces all three primary collections with sanitized versions', () => {
    const candidate = prepareBackupImportState(baseCurrentState, {
      components: [
        {
          id: 'new-c1',
          name: 'New GPU',
          category: 'GPU',
          specifications: '16GB',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [
        {
          id: 'new-b1',
          name: 'New Build',
          status: 'In Progress',
          parts: [],
          createdDate: '2026-08-01',
        },
      ],
      transactions: [
        {
          id: 'new-tx1',
          type: 'PURCHASE',
          title: 'Purchased: Parts',
          timestamp: '2026-08-01',
          dateSortable: '2026-08-01',
          itemCount: 1,
          quantity: 1,
          totalAmount: 300,
          itemNameOrSummary: 'Parts',
        },
      ],
    });
    expect(candidate.components).toHaveLength(1);
    expect(candidate.components[0].id).toBe('new-c1');
    expect(candidate.builds).toHaveLength(1);
    expect(candidate.builds[0].id).toBe('new-b1');
    expect(candidate.transactions).toHaveLength(1);
    expect(candidate.transactions[0].id).toBe('new-tx1');
  });

  it('does not mutate the supplied backup object or current state', () => {
    const frozenCurrent = Object.freeze({
      components: Object.freeze([
        {
          id: 'c1',
          name: 'GPU',
          category: 'GPU' as const,
          specifications: '',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ]),
      builds: Object.freeze([]),
      transactions: Object.freeze([]),
      monthlyGoal: 6000,
    });
    const rawBackup = {
      components: [
        {
          id: 'c2',
          name: 'CPU',
          category: 'CPU' as const,
          specifications: '',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 9000,
    };
    const backupCopy = JSON.parse(JSON.stringify(rawBackup));

    const candidate = prepareBackupImportState(frozenCurrent as unknown as AppState, rawBackup);

    expect(rawBackup).toEqual(backupCopy);
    expect(candidate.monthlyGoal).toBe(9000);
    expect(candidate.components[0].id).toBe('c2');
  });
});

describe('AppState Top-Level Field Passthrough & Sanitization Overrides', () => {
  it('survives sanitization unchanged for an additional top-level field', () => {
    const rawWithExtra = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 5000,
      customMetadata: { theme: 'dark', version: 2 },
      userNote: 'Special workspace',
    };

    const sanitized = sanitizeAppState(rawWithExtra) as unknown as Record<string, unknown>;
    expect(sanitized.customMetadata).toEqual({ theme: 'dark', version: 2 });
    expect(sanitized.userNote).toBe('Special workspace');
  });

  it('ensures known sanitized fields still replace their raw values', () => {
    const raw = {
      components: [
        {
          id: 'c1',
          name: 'GPU',
          category: 'GPU',
          specifications: '',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [
        {
          id: 'b1',
          name: 'Build',
          status: 'In Progress',
          parts: [],
          createdDate: '2026-08-01',
          platformFees: 50, // Should be stripped by sanitization
        },
      ],
      transactions: [],
      monthlyGoal: -100, // Invalid -> should be sanitized to 10000 fallback
    };

    const sanitized = sanitizeAppState(raw);
    expect(sanitized.monthlyGoal).toBe(10000);
    expect((sanitized.builds[0] as unknown as Record<string, unknown>).platformFees).toBeUndefined();
  });
});

describe('Canonicalization & areAppStatesEqual Semantic Comparison', () => {
  it('considers equivalent states with different object key insertion order as equal', () => {
    const stateA: AppState = {
      components: [
        {
          id: 'c1',
          name: 'RTX 4090',
          category: 'GPU',
          specifications: '24GB',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    // Construct stateB with scrambled property order at all levels
    const stateB: AppState = {
      monthlyGoal: 10000,
      transactions: [],
      builds: [],
      components: [
        {
          assignedCount: 0,
          purchaseHistory: [],
          specifications: '24GB',
          category: 'GPU',
          name: 'RTX 4090',
          id: 'c1',
        },
      ],
    };

    expect(areAppStatesEqual(stateA, stateB)).toBe(true);
  });

  it('detects a difference in an actual nested value', () => {
    const base: AppState = {
      components: [
        {
          id: 'c1',
          name: 'RTX 4090',
          category: 'GPU',
          specifications: '24GB',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    const changed: AppState = {
      ...base,
      components: [
        {
          ...base.components[0],
          name: 'RTX 4080',
        },
      ],
    };

    expect(areAppStatesEqual(base, changed)).toBe(false);
  });

  it('detects collection order differences (array order is preserved)', () => {
    const stateA: AppState = {
      components: [
        { id: 'c1', name: 'GPU', category: 'GPU', specifications: '', purchaseHistory: [], assignedCount: 0 },
        { id: 'c2', name: 'CPU', category: 'CPU', specifications: '', purchaseHistory: [], assignedCount: 0 },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    const stateB: AppState = {
      components: [
        { id: 'c2', name: 'CPU', category: 'CPU', specifications: '', purchaseHistory: [], assignedCount: 0 },
        { id: 'c1', name: 'GPU', category: 'GPU', specifications: '', purchaseHistory: [], assignedCount: 0 },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    expect(areAppStatesEqual(stateA, stateB)).toBe(false);
  });

  it('detects when an item is added or removed', () => {
    const stateA: AppState = {
      components: [
        { id: 'c1', name: 'GPU', category: 'GPU', specifications: '', purchaseHistory: [], assignedCount: 0 },
      ],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    const stateB: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    expect(areAppStatesEqual(stateA, stateB)).toBe(false);
  });

  it('detects a difference in an additional top-level field', () => {
    const stateA = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
      customFeatureFlag: true,
    } as unknown as AppState;

    const stateB = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
      customFeatureFlag: false,
    } as unknown as AppState;

    expect(areAppStatesEqual(stateA, stateB)).toBe(false);
  });

  it('does not mutate either input during canonicalization or comparison', () => {
    const objA = { z: 1, a: { y: 2, b: [3, 2, 1] } };
    const objACopy = JSON.parse(JSON.stringify(objA));
    Object.freeze(objA);
    Object.freeze(objA.a);
    Object.freeze(objA.a.b);

    const canonical = canonicalizeJSON(objA);
    expect(objA).toEqual(objACopy);
    expect(canonical).toEqual(objACopy);

    const state1: AppState = {
      components: [{ id: 'c1', name: 'GPU', category: 'GPU', specifications: '', purchaseHistory: [], assignedCount: 0 }],
      builds: [],
      transactions: [],
      monthlyGoal: 5000,
    };
    const state2 = JSON.parse(JSON.stringify(state1));
    Object.freeze(state1);

    expect(areAppStatesEqual(state1, state2)).toBe(true);
    expect(state1).toEqual(state2);
  });
});

describe('Semantic No-Op & Import Handling Logic', () => {
  it('returns success with changed: false when candidate state is identical', () => {
    const currentState: AppState = sanitizeAppState({
      components: [
        {
          id: 'c1',
          name: 'Test GPU',
          category: 'GPU',
          specifications: '16GB',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
      builds: [
        {
          id: 'b1',
          name: 'Test Build',
          status: 'In Progress',
          parts: [],
          createdDate: '2026-08-01',
        },
      ],
      transactions: [
        {
          id: 'tx1',
          type: 'SALE',
          title: 'Sold: Build Sale',
          timestamp: '2026-08-01',
          dateSortable: '2026-08-01',
          itemCount: 1,
          quantity: 1,
          totalAmount: 500,
          itemNameOrSummary: 'Build Sale',
        },
      ],
      monthlyGoal: 10000,
    });

    const sanitizedCandidate = prepareBackupImportState(currentState, {
      components: currentState.components,
      builds: currentState.builds,
      transactions: currentState.transactions,
      monthlyGoal: currentState.monthlyGoal,
    });

    const isIdentical = areAppStatesEqual(currentState, sanitizedCandidate);
    expect(isIdentical).toBe(true);

    const saveHistory = vi.fn();
    const setState = vi.fn();
    const persistState = vi.fn();

    // Replicate importData decision engine
    const runImport = (data: Partial<AppState>) => {
      const candidate = prepareBackupImportState(currentState, data);
      if (areAppStatesEqual(currentState, candidate)) {
        return { success: true, changed: false };
      }
      saveHistory('Import backup');
      persistState(candidate);
      setState(candidate);
      return { success: true, changed: true };
    };

    const result = runImport(currentState);
    expect(result).toEqual({ success: true, changed: false });
    expect(saveHistory).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    expect(persistState).not.toHaveBeenCalled();
  });

  it('creates exactly one undo entry and updates state when candidate is different', () => {
    const currentState: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
    };

    const saveHistory = vi.fn();
    const setState = vi.fn();
    const persistState = vi.fn();

    const runImport = (data: Partial<AppState>) => {
      const candidate = prepareBackupImportState(currentState, data);
      if (areAppStatesEqual(currentState, candidate)) {
        return { success: true, changed: false };
      }
      saveHistory('Import backup');
      persistState(candidate);
      setState(candidate);
      return { success: true, changed: true };
    };

    const result = runImport({
      components: [
        {
          id: 'new-c',
          name: 'New Component',
          category: 'GPU',
          specifications: '',
          purchaseHistory: [],
          assignedCount: 0,
        },
      ],
    });

    expect(result).toEqual({ success: true, changed: true });
    expect(saveHistory).toHaveBeenCalledTimes(1);
    expect(saveHistory).toHaveBeenCalledWith('Import backup');
    expect(setState).toHaveBeenCalledTimes(1);
    expect(persistState).toHaveBeenCalledTimes(1);
  });
});

describe('executeBackupImport durable commit boundary', () => {
  const currentState: AppState = {
    components: [],
    builds: [],
    transactions: [],
    monthlyGoal: 10000,
  };

  it('skips persistence and preserves the exact state reference for a semantic no-op', async () => {
    const persistState = vi.fn(async () => undefined);

    const result = await executeBackupImport(currentState, currentState, persistState);

    expect(result).toEqual({
      success: true,
      changed: false,
      nextState: currentState,
    });
    expect(result.nextState).toBe(currentState);
    expect(persistState).not.toHaveBeenCalled();
  });

  it('awaits one successful persistence before returning the changed candidate', async () => {
    let finishPersist: (() => void) | undefined;
    const persistState = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPersist = resolve;
        })
    );

    let settled = false;
    const execution = executeBackupImport(
      currentState,
      { ...currentState, monthlyGoal: 12500.5 },
      persistState
    ).then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(persistState).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishPersist?.();
    const result = await execution;

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.nextState).not.toBe(currentState);
    expect(result.nextState.monthlyGoal).toBe(12500.5);
    expect(persistState).toHaveBeenCalledWith(result.nextState);
  });

  it('returns the original state and a user-facing error when persistence fails', async () => {
    const persistState = vi.fn(async () => {
      throw new Error('Both storage backends failed');
    });

    const result = await executeBackupImport(
      currentState,
      { ...currentState, monthlyGoal: 15000 },
      persistState
    );

    expect(result).toEqual({
      success: false,
      changed: false,
      nextState: currentState,
      error: 'Unable to save the imported backup. Your current data was left unchanged.',
    });
    expect(result.nextState).toBe(currentState);
    expect(persistState).toHaveBeenCalledTimes(1);
  });
});

describe('executePersistedStateChange durable commit boundary', () => {
  const currentState: AppState = {
    components: [],
    builds: [],
    transactions: [],
    monthlyGoal: 10000,
  };

  it('skips persistence and preserves the current reference for an identical reset', async () => {
    const persistState = vi.fn(async () => undefined);

    const result = await executePersistedStateChange(
      currentState,
      { ...currentState },
      'Reset failed.',
      persistState
    );

    expect(result).toEqual({ success: true, changed: false, nextState: currentState });
    expect(result.nextState).toBe(currentState);
    expect(persistState).not.toHaveBeenCalled();
  });

  it('waits for persistence before returning a changed reset state', async () => {
    const candidateState = { ...currentState, monthlyGoal: 1 };
    let finishPersist: (() => void) | undefined;
    const persistState = vi.fn(
      () => new Promise<void>((resolve) => {
        finishPersist = resolve;
      })
    );

    let settled = false;
    const execution = executePersistedStateChange(
      currentState,
      candidateState,
      'Reset failed.',
      persistState
    ).then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(persistState).toHaveBeenCalledWith(candidateState);
    expect(settled).toBe(false);

    finishPersist?.();
    const result = await execution;
    expect(result).toEqual({ success: true, changed: true, nextState: candidateState });
  });

  it('returns the original reference and supplied error when persistence fails', async () => {
    const persistState = vi.fn(async () => {
      throw new Error('storage unavailable');
    });

    const result = await executePersistedStateChange(
      currentState,
      { ...currentState, monthlyGoal: 1 },
      'Reset failed.',
      persistState
    );

    expect(result).toEqual({
      success: false,
      changed: false,
      nextState: currentState,
      error: 'Reset failed.',
    });
    expect(result.nextState).toBe(currentState);
  });
});
