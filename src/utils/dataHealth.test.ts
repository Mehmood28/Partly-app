import { describe, expect, it } from 'vitest';
import { AppState } from '../types';
import { inspectDataHealth } from './dataHealth';

const emptyState = (): AppState => ({
  components: [],
  builds: [],
  transactions: [],
  monthlyGoal: 10000,
});

describe('inspectDataHealth', () => {
  it('returns a clean report for valid exact relationships', () => {
    const state: AppState = {
      ...emptyState(),
      components: [
        {
          id: 'c1',
          name: 'CPU',
          category: 'CPU',
          specifications: '',
          assignedCount: 1,
          purchaseHistory: [
            {
              id: 'pe1',
              date: '2026-09-01',
              condition: 'Sealed',
              quantity: 1,
              unitPrice: 100,
              totalPrice: 100,
              paymentMethod: 'Cash',
              platform: 'Local',
            },
          ],
        },
      ],
      builds: [
        {
          id: 'b1',
          name: 'Build',
          status: 'In Progress',
          createdDate: '2026-09-01',
          parts: [
            {
              componentId: 'c1',
              componentName: 'CPU',
              purchaseEntryId: 'pe1',
              category: 'CPU',
              quantity: 1,
              unitCostAtAssignment: 100,
            },
          ],
        },
      ],
    };

    expect(inspectDataHealth(state)).toEqual({ issues: [], warningCount: 0 });
  });

  it('reports missing components and stale purchase batches without changing state', () => {
    const state: AppState = {
      ...emptyState(),
      components: [
        {
          id: 'c1',
          name: 'CPU',
          category: 'CPU',
          specifications: '',
          assignedCount: 1,
          purchaseHistory: [],
        },
      ],
      builds: [
        {
          id: 'b1',
          name: 'Build',
          status: 'In Progress',
          createdDate: '2026-09-01',
          parts: [
            { componentId: 'missing', componentName: 'RAM', category: 'RAM', quantity: 1, unitCostAtAssignment: 50 },
            { componentId: 'c1', componentName: 'CPU', purchaseEntryId: 'deleted-batch', category: 'CPU', quantity: 1, unitCostAtAssignment: 100 },
          ],
        },
      ],
    };
    const before = structuredClone(state);

    const report = inspectDataHealth(state);

    expect(report.warningCount).toBe(2);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'MISSING_COMPONENT_REFERENCE',
      'MISSING_PURCHASE_ENTRY_REFERENCE',
    ]);
    expect(state).toEqual(before);
  });

  it('reports active unlinked allocations and ignores self-contained sold snapshots', () => {
    const state: AppState = {
      ...emptyState(),
      components: [
        { id: 'c1', name: 'CPU', category: 'CPU', specifications: '', assignedCount: 2, purchaseHistory: [] },
      ],
      builds: [
        {
          id: 'active', name: 'Active', status: 'In Progress', createdDate: '2026-09-01',
          parts: [{ componentId: 'c1', componentName: 'CPU', category: 'CPU', quantity: 1, unitCostAtAssignment: 50 }],
        },
        {
          id: 'sold', name: 'Sold', status: 'Sold', createdDate: '2026-01-01',
          parts: [{ componentId: 'c1', componentName: 'CPU', category: 'CPU', quantity: 1, unitCostAtAssignment: 50 }],
        },
      ],
    };

    const report = inspectDataHealth(state);

    expect(report.warningCount).toBe(1);
    expect(report.issues.map((issue) => issue.code)).toEqual(['UNLINKED_ACTIVE_BUILD_PART']);
  });

  it('reports duplicate IDs once per duplicated value', () => {
    const state = {
      ...emptyState(),
      components: [
        { id: 'same', purchaseHistory: [{ id: 'batch' }] },
        { id: 'same', purchaseHistory: [{ id: 'batch' }] },
      ],
      builds: [{ id: 'build' }, { id: 'build' }],
      transactions: [{ id: 'tx' }, { id: 'tx' }],
    } as unknown as AppState;

    const report = inspectDataHealth(state);

    expect(report.warningCount).toBe(4);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'DUPLICATE_COMPONENT_ID',
      'DUPLICATE_BUILD_ID',
      'DUPLICATE_TRANSACTION_ID',
      'DUPLICATE_PURCHASE_ENTRY_ID',
    ]);
  });
});
