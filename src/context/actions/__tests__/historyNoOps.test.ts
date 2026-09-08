import { describe, expect, it } from 'vitest';
import { AppState, InventoryComponent, PCBuild, TransactionLogItem } from '../../../types';
import { handleAddImportedBuilds, handleUpdateBuildStatus } from '../buildActions';
import { handleUpdateComponent, handleUpdateMarketValue } from '../componentActions';
import { handleUpdateTransaction } from '../transactionActions';

const component: InventoryComponent = {
  id: 'component-1',
  name: 'Test GPU',
  category: 'GPU',
  specifications: '16GB',
  purchaseHistory: [],
  tags: ['50 Series'],
  assignedCount: 0,
  targetMarketValuePerUnit: 500,
};

const transaction: TransactionLogItem = {
  id: 'transaction-1',
  type: 'PURCHASE',
  title: 'Purchased Test GPU',
  timestamp: '2026-09-08',
  dateSortable: '2026-09-08',
  itemCount: 1,
  quantity: 1,
  totalAmount: 400,
  itemNameOrSummary: 'Test GPU',
};

const state: AppState = {
  components: [component],
  builds: [],
  transactions: [transaction],
  monthlyGoal: 10000,
};

describe('history-sensitive action no-ops', () => {
  it('returns the original state for a missing component update', () => {
    expect(handleUpdateComponent(state, 'missing', { name: 'Changed' })).toBe(state);
  });

  it('returns the original state for a semantic component no-op', () => {
    const result = handleUpdateComponent(state, component.id, {
      name: component.name,
      tags: [...(component.tags || [])],
      purchaseHistory: [],
    });

    expect(result).toBe(state);
  });

  it('creates a new state for a genuine component update', () => {
    const result = handleUpdateComponent(state, component.id, { name: 'Updated GPU' });

    expect(result).not.toBe(state);
    expect(result.components[0].name).toBe('Updated GPU');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'rejects invalid market value %s without changing state',
    (value) => {
      expect(handleUpdateMarketValue(state, component.id, value)).toBe(state);
    }
  );

  it('returns the original state for missing and unchanged market values', () => {
    expect(handleUpdateMarketValue(state, 'missing', 500)).toBe(state);
    expect(handleUpdateMarketValue(state, component.id, 500)).toBe(state);
  });

  it('preserves zero as a valid market value', () => {
    const result = handleUpdateMarketValue(state, component.id, 0);

    expect(result).not.toBe(state);
    expect(result.components[0].targetMarketValuePerUnit).toBe(0);
  });

  it('returns the original state when there are no imported builds', () => {
    expect(handleAddImportedBuilds(state, [])).toBe(state);
  });

  it('adds a non-empty imported build list', () => {
    const build: PCBuild = {
      id: 'build-1',
      name: 'Imported Build',
      parts: [],
      status: 'In Progress',
      createdDate: '2026-09-08',
    };
    const result = handleAddImportedBuilds(state, [build]);

    expect(result).not.toBe(state);
    expect(result.builds[0]).toBe(build);
  });

  it('returns the original state when a build status is already current', () => {
    const build: PCBuild = {
      id: 'build-1',
      name: 'Current Build',
      parts: [],
      status: 'In Progress',
      createdDate: '2026-09-08',
    };
    const current = { ...state, builds: [build] };

    expect(handleUpdateBuildStatus(current, build.id, 'In Progress')).toBe(current);
  });

  it('returns the original state for a semantic transaction no-op', () => {
    const result = handleUpdateTransaction(state, transaction.id, {
        title: transaction.title,
        totalAmount: transaction.totalAmount,
      });
    expect(result.success).toBe(true);
    expect(result.nextState).toBe(state);
  });

  it('returns the original state for a missing transaction update', () => {
    const result = handleUpdateTransaction(state, 'missing', { title: 'Changed' });
    expect(result.success).toBe(false);
    expect(result.nextState).toBe(state);
  });
});
