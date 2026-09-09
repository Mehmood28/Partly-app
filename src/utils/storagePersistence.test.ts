import localforage from 'localforage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../types';
import {
  isStorageEnvelope,
  persistAppState,
  resetStorageRevisionForTesting,
  STORAGE_KEY,
} from './storage';

describe('persistAppState immediate mirror', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    } satisfies Storage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetStorageRevisionForTesting();
  });

  it('writes the latest state to localStorage before IndexedDB finishes', async () => {
    let finishIndexedDb: (() => void) | undefined;
    vi.spyOn(localforage, 'setItem').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishIndexedDb = () => resolve(null);
        })
    );

    const state: AppState = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 12345,
    };

    let settled = false;
    const persistence = persistAppState(state).then((result) => {
      settled = true;
      return result;
    });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    expect(isStorageEnvelope(saved)).toBe(true);
    expect(saved.state.monthlyGoal).toBe(12345);

    await Promise.resolve();
    expect(settled).toBe(false);

    finishIndexedDb?.();
    await persistence;
    expect(settled).toBe(true);
  });
});
