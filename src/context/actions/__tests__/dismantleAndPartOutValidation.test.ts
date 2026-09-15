import { describe, it, expect, vi } from 'vitest';
import { handleDismantleBuild, handlePartOutTradeInBuild } from '../buildActions';
import { AppState, ComponentCategory, InventoryComponent, PCBuild, TransactionLogItem } from '../../../types';

describe('Phase 3B - Part Out and Ordinary Dismantle Accounting Integrity', () => {
  const getMockTradeInState = (options?: {
    estimatedCost?: number;
    upgradeParts?: PCBuild['parts'];
    assignedCount?: number;
    srcDateSortable?: string;
    srcTimestamp?: string;
    buildCreatedDate?: string;
  }): AppState => {
    const component: InventoryComponent = {
      id: 'comp-ram',
      name: 'DDR4 16GB RAM',
      category: 'RAM',
      specifications: '3200MHz',
      assignedCount: options?.assignedCount ?? 1,
      tags: [],
      purchaseHistory: [
        {
          id: 'pe-ram-1',
          date: '2026-05-01',
          condition: 'Used',
          quantity: 2,
          unitPrice: 40,
          totalPrice: 80,
          taxPercent: 0,
          paymentMethod: 'Cash',
          platform: 'Local',
        },
      ],
    };

    const tradeInBuild: PCBuild = {
      id: 'b-trade-in',
      name: 'Trade-In PC Alpha',
      status: 'Trade-In Processing',
      acquisitionSource: 'Trade-In',
      createdDate: options?.buildCreatedDate ?? '2026-06-01',
      estimatedCost: options?.estimatedCost ?? 300,
      sourceSaleTransactionId: 'tx-src-sale',
      parts: options?.upgradeParts ?? [
        {
          componentId: 'comp-ram',
          componentName: 'DDR4 16GB RAM',
          category: 'RAM',
          quantity: 1,
          unitCostAtAssignment: 40,
          purchaseEntryId: 'pe-ram-1',
        },
      ],
    };

    const srcTx: TransactionLogItem = {
      id: 'tx-src-sale',
      type: 'SALE',
      title: 'Sold Outgoing Rig with Trade-In',
      timestamp: options?.srcTimestamp ?? '2026-06-01',
      dateSortable: options?.srcDateSortable ?? '2026-06-01',
      itemCount: 1,
      quantity: 1,
      totalAmount: 1000,
      platform: 'Facebook',
      buyerName: 'Balraj Shah',
      itemNameOrSummary: 'Gaming Rig Sold',
      incomingTradeInBuildId: 'b-trade-in',
      tradeInBuildName: 'Trade-In PC Alpha',
    };

    return {
      components: [component],
      builds: [tradeInBuild],
      transactions: [srcTx],
      monthlyGoal: 1000,
    };
  };

  const getMockOrdinaryState = (options?: {
    partQty?: number;
    partCost?: number;
    assignedCount?: number;
    peQty?: number;
    pePrice?: number;
  }): AppState => {
    const component: InventoryComponent = {
      id: 'comp-gpu',
      name: 'RTX 3070',
      category: 'GPU',
      specifications: '8GB',
      assignedCount: options?.assignedCount ?? 1,
      tags: [],
      purchaseHistory: [
        {
          id: 'pe-gpu-1',
          date: '2026-04-01',
          condition: 'Used',
          quantity: options?.peQty ?? 2,
          unitPrice: options?.pePrice ?? 350,
          totalPrice: (options?.peQty ?? 2) * (options?.pePrice ?? 350),
          taxPercent: 0,
          paymentMethod: 'Cash',
          platform: 'Local',
        },
      ],
    };

    const ordinaryBuild: PCBuild = {
      id: 'b-ordinary',
      name: 'Gaming Rig Beta',
      status: 'Listed for Sale',
      acquisitionSource: 'Built',
      createdDate: '2026-05-10',
      builtDate: '2026-05-15',
      estimatedCost: 350,
      parts: [
        {
          componentId: 'comp-gpu',
          componentName: 'RTX 3070',
          category: 'GPU',
          quantity: options?.partQty ?? 1,
          unitCostAtAssignment: options?.partCost ?? 350,
          purchaseEntryId: 'pe-gpu-1',
        },
      ],
    };

    return {
      components: [component],
      builds: [ordinaryBuild],
      transactions: [],
      monthlyGoal: 1000,
    };
  };

  describe('Part Out Validation & Accounting', () => {
    const defaultExtracted: { category: ComponentCategory; name: string; quantity: number; unitCost: number }[] = [
      { category: 'GPU', name: 'GTX 1660 Super', quantity: 1, unitCost: 180 },
      { category: 'CPU', name: 'Ryzen 5 3600', quantity: 1, unitCost: 120 },
    ];

    it('rejects invalid allocated upgrade quantity', () => {
      const invalidQuantities = [0, -1, 1.5, NaN, Infinity, '1' as any];
      for (const qty of invalidQuantities) {
        const state = getMockTradeInState({
          upgradeParts: [
            {
              componentId: 'comp-ram',
              componentName: 'DDR4 16GB RAM',
              category: 'RAM',
              quantity: qty,
              unitCostAtAssignment: 40,
              purchaseEntryId: 'pe-ram-1',
            },
          ],
        });

        const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid quantity for allocated upgrade');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects invalid allocated upgrade unit cost', () => {
      const invalidCosts = [-1, -0.01, NaN, Infinity, '40' as any];
      for (const cost of invalidCosts) {
        const state = getMockTradeInState({
          upgradeParts: [
            {
              componentId: 'comp-ram',
              componentName: 'DDR4 16GB RAM',
              category: 'RAM',
              quantity: 1,
              unitCostAtAssignment: cost,
              purchaseEntryId: 'pe-ram-1',
            },
          ],
        });

        const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid unit cost for allocated upgrade');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects missing related upgrade component', () => {
      const state = getMockTradeInState({
        upgradeParts: [
          {
            componentId: 'comp-nonexistent',
            componentName: 'Missing RAM',
            category: 'RAM',
            quantity: 1,
            unitCostAtAssignment: 40,
            purchaseEntryId: 'pe-missing',
          },
        ],
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(false);
      expect(res.error).toContain('not found in inventory');
      expect(res.nextState).toBe(state);
    });

    it('rejects invalid component assignedCount', () => {
      const invalidAssigned = [-1, 1.5, NaN, Infinity, '1' as any];
      for (const assigned of invalidAssigned) {
        const state = getMockTradeInState({ assignedCount: assigned });

        const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid assigned count for component');
        expect(res.nextState).toBe(state);
      }
    });

    it('supports unique unlinked legacy upgrades without inventing batch IDs', () => {
      const state = getMockTradeInState({
        assignedCount: 2,
        upgradeParts: [
          {
            componentId: 'comp-ram',
            componentName: 'DDR4 16GB RAM',
            category: 'RAM',
            quantity: 1,
            unitCostAtAssignment: 40,
            purchaseEntryId: undefined as any, // unlinked legacy
          },
        ],
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(true);
      expect(res.nextState.builds.find((b) => b.id === 'b-trade-in')).toBeUndefined();

      const ram = res.nextState.components.find((c) => c.id === 'comp-ram');
      expect(ram).toBeDefined();
      expect(ram?.assignedCount).toBe(1); // reduced from 2 to 1
      // purchaseHistory has NOT been polluted with invented batch IDs
      expect(ram?.purchaseHistory.length).toBe(1);
      expect(ram?.purchaseHistory[0].id).toBe('pe-ram-1');
    });

    it('does not guess or reassign stale legacy batch references', () => {
      const state = getMockTradeInState({
        assignedCount: 1,
        upgradeParts: [
          {
            componentId: 'comp-ram',
            componentName: 'DDR4 16GB RAM',
            category: 'RAM',
            quantity: 1,
            unitCostAtAssignment: 40,
            purchaseEntryId: 'pe-deleted-historical-batch',
          },
        ],
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(true);

      const ram = res.nextState.components.find((c) => c.id === 'comp-ram');
      expect(ram?.assignedCount).toBe(0);
      expect(ram?.purchaseHistory.length).toBe(1);
      expect(ram?.purchaseHistory[0].id).toBe('pe-ram-1'); // original untouched
    });

    it('preserves exact extracted quantity, unitPrice, and totalPrice', () => {
      const state = getMockTradeInState({ estimatedCost: 350.50 });
      const extracted = [
        { category: 'GPU' as ComponentCategory, name: 'GTX 1660 Super', quantity: 2, unitCost: 125.25 },
        { category: 'CPU' as ComponentCategory, name: 'Ryzen 5 3600', quantity: 1, unitCost: 100 },
      ];

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', extracted);
      expect(res.success).toBe(true);

      const gpu = res.nextState.components.find((c) => c.name === 'GTX 1660 Super');
      expect(gpu).toBeDefined();
      const gpuEntry = gpu?.purchaseHistory[0];
      expect(gpuEntry?.quantity).toBe(2);
      expect(gpuEntry?.unitPrice).toBe(125.25);
      expect(gpuEntry?.totalPrice).toBe(250.50);
      expect(gpuEntry?.platform).toBe('Balraj Shah');
      expect(gpuEntry?.paymentMethod).toBe('Trade-In');
      expect(gpuEntry?.sourceSaleTransactionId).toBe('tx-src-sale');

      const tx = res.nextState.transactions.find((t) => t.incomingTradeInBuildId === 'b-trade-in');
      expect(tx).toBeDefined();
      expect(tx?.quantity).toBe(3);
      expect(tx?.totalAmount).toBe(350.50);
      expect(tx?.platform).toBe('Balraj Shah');
      expect(tx?.buyerName).toBe('Balraj Shah');
    });

    it('stores the resolved seller and sale link for a legacy trade-in build', () => {
      const state = getMockTradeInState({ upgradeParts: [] });
      state.builds[0] = { ...state.builds[0], sourceSaleTransactionId: undefined };

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(true);

      const gpuEntry = res.nextState.components
        .find((component) => component.name === 'GTX 1660 Super')
        ?.purchaseHistory[0];
      expect(gpuEntry?.platform).toBe('Balraj Shah');
      expect(gpuEntry?.sourceSaleTransactionId).toBe('tx-src-sale');
    });

    it('stores the sold build buyer when legacy trade-in links and labels are stale', () => {
      const state = getMockTradeInState({ upgradeParts: [] });
      state.builds[0] = {
        ...state.builds[0],
        id: 'deleted-trade-in-build',
        name: '5900X + RTX 3080',
        sourceSaleTransactionId: 'missing-sale',
      };
      state.builds.push({
        id: 'sold-build',
        name: 'Ryzen 7 9800X3D + RTX 5080',
        status: 'Sold',
        createdDate: '2026-05-20',
        saleDate: '2026-06-01',
        saleTransactionId: 'tx-src-sale',
        buyerName: 'Balraj Shah',
        parts: [],
      });
      state.transactions[0] = {
        ...state.transactions[0],
        buyerName: undefined,
        incomingTradeInBuildId: undefined,
        tradeInBuildName: 'Traded Rig',
        tradeInCredit: 300,
      };

      const res = handlePartOutTradeInBuild(
        state,
        'deleted-trade-in-build',
        defaultExtracted
      );
      expect(res.success).toBe(true);

      const gpuEntry = res.nextState.components
        .find((component) => component.name === 'GTX 1660 Super')
        ?.purchaseHistory[0];
      expect(gpuEntry?.platform).toBe('Balraj Shah');
      expect(gpuEntry?.sourceSaleTransactionId).toBe('tx-src-sale');
    });

    it('preserves valid zero unit cost and zero total amount', () => {
      const state = getMockTradeInState({
        estimatedCost: 0,
        upgradeParts: [],
      });
      const zeroExtracted = [
        { category: 'Case' as ComponentCategory, name: 'Generic ATX Case', quantity: 1, unitCost: 0 },
      ];

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', zeroExtracted);
      expect(res.success).toBe(true);

      const caseComp = res.nextState.components.find((c) => c.name === 'Generic ATX Case');
      expect(caseComp).toBeDefined();
      const caseEntry = caseComp?.purchaseHistory[0];
      expect(caseEntry?.quantity).toBe(1);
      expect(caseEntry?.unitPrice).toBe(0);
      expect(caseEntry?.totalPrice).toBe(0);

      const tx = res.nextState.transactions.find((t) => t.incomingTradeInBuildId === 'b-trade-in');
      expect(tx?.totalAmount).toBe(0);
    });

    it('skips impossible source dates in favour of next valid source or fallback', () => {
      // 2026-02-30 is impossible
      const state = getMockTradeInState({
        srcDateSortable: '2026-02-30',
        srcTimestamp: '2026-02-31', // also impossible
        buildCreatedDate: '2026-05-20', // valid
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(true);

      const tx = res.nextState.transactions.find((t) => t.incomingTradeInBuildId === 'b-trade-in');
      expect(tx?.timestamp).toBe('2026-05-20');
      expect(tx?.dateSortable).toBe('2026-05-20');

      const gpu = res.nextState.components.find((c) => c.name === 'GTX 1660 Super');
      expect(gpu?.purchaseHistory[0].date).toBe('2026-05-20');
    });

    it('falls back to Toronto date when all source dates are invalid or impossible', () => {
      const state = getMockTradeInState({
        srcDateSortable: '2026-02-30',
        srcTimestamp: 'not-a-date',
        buildCreatedDate: '2026-13-45',
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(true);

      const tx = res.nextState.transactions.find((t) => t.incomingTradeInBuildId === 'b-trade-in');
      expect(tx?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('preserves builds, components, transactions, and original state reference on failure', () => {
      const state = getMockTradeInState({
        upgradeParts: [
          {
            componentId: 'comp-ram',
            componentName: 'DDR4 16GB RAM',
            category: 'RAM',
            quantity: -5,
            unitCostAtAssignment: 40,
            purchaseEntryId: 'pe-ram-1',
          },
        ],
      });

      const res = handlePartOutTradeInBuild(state, 'b-trade-in', defaultExtracted);
      expect(res.success).toBe(false);
      expect(res.nextState).toBe(state);
      expect(state.builds.length).toBe(1);
      expect(state.components.length).toBe(1);
      expect(state.transactions.length).toBe(1);
    });
  });

  describe('Ordinary Dismantle Validation & Accounting', () => {
    it('rejects invalid component assignedCount', () => {
      const invalidAssigned = [-1, 1.25, NaN, Infinity, '1' as any];
      for (const assigned of invalidAssigned) {
        const state = getMockOrdinaryState({ assignedCount: assigned });
        const res = handleDismantleBuild(state, 'b-ordinary');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid assigned count for component');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects invalid referenced batch quantity', () => {
      const invalidPeQuantities = [0, -1, 1.5, NaN, Infinity, '2' as any];
      for (const qty of invalidPeQuantities) {
        const state = getMockOrdinaryState({ peQty: qty });
        const res = handleDismantleBuild(state, 'b-ordinary');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid purchase entry quantity');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects invalid referenced batch unit price', () => {
      const invalidPrices = [-1, -0.01, NaN, Infinity, '100' as any];
      for (const price of invalidPrices) {
        const state = getMockOrdinaryState({ pePrice: price });
        const res = handleDismantleBuild(state, 'b-ordinary');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Invalid purchase entry unit price');
        expect(res.nextState).toBe(state);
      }
    });

    it('preserves valid zero allocation cost without fallback substitution', () => {
      const state = getMockOrdinaryState({ partCost: 0, pePrice: 0 });
      const res = handleDismantleBuild(state, 'b-ordinary');
      expect(res.success).toBe(true);

      const tx = res.nextState.transactions.find((t) => t.buildActivityKind === 'DISMANTLE');
      expect(tx).toBeDefined();
      expect(tx?.totalAmount).toBe(0);
      expect(tx?.detailsList?.[0]).toContain('$0.00/ea');
    });

    it('uses exact allocation quantities without fallback substitution', () => {
      const state = getMockOrdinaryState({ partQty: 3, assignedCount: 5 });
      const res = handleDismantleBuild(state, 'b-ordinary');
      expect(res.success).toBe(true);

      const gpu = res.nextState.components.find((c) => c.id === 'comp-gpu');
      expect(gpu?.assignedCount).toBe(2); // 5 - 3 = 2

      const tx = res.nextState.transactions.find((t) => t.buildActivityKind === 'DISMANTLE');
      expect(tx?.quantity).toBe(3);
    });

    it('leaves purchase histories completely unchanged after dismantling', () => {
      const state = getMockOrdinaryState();
      const originalHistory = JSON.stringify(state.components[0].purchaseHistory);

      const res = handleDismantleBuild(state, 'b-ordinary');
      expect(res.success).toBe(true);

      const updatedHistory = JSON.stringify(res.nextState.components[0].purchaseHistory);
      expect(updatedHistory).toBe(originalHistory);
    });
  });

  describe('Atomic Behavior & Undo History', () => {
    it('does not save history when dismantling fails', () => {
      const state = getMockOrdinaryState({ assignedCount: -1 });
      const history: string[] = [];
      const saveStateToHistory = vi.fn((label: string) => history.push(label));

      // Simulate InventoryContext dismantleBuild
      const dismantleBuild = (buildId: string) => {
        const res = handleDismantleBuild(state, buildId);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        if (res.nextState === state) {
          return { success: true };
        }
        saveStateToHistory(`Dismantle build: ${buildId}`);
        return { success: true };
      };

      const result = dismantleBuild('b-ordinary');
      expect(result.success).toBe(false);
      expect(saveStateToHistory).not.toHaveBeenCalled();
      expect(history.length).toBe(0);
    });

    it('produces exactly one Undo entry on successful ordinary dismantling', () => {
      const state = getMockOrdinaryState();
      const history: string[] = [];
      const saveStateToHistory = vi.fn((label: string) => history.push(label));

      const dismantleBuild = (buildId: string) => {
        const targetBuild = state.builds.find((b) => b.id === buildId);
        const buildName = targetBuild?.name || 'Build';
        const isTradeIn = targetBuild?.acquisitionSource === 'Trade-In';

        const res = handleDismantleBuild(state, buildId);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        if (res.nextState === state) {
          return { success: true };
        }
        saveStateToHistory(isTradeIn ? `Part out trade-in: ${buildName}` : `Dismantle build: ${buildName}`);
        return { success: true };
      };

      const result = dismantleBuild('b-ordinary');
      expect(result.success).toBe(true);
      expect(saveStateToHistory).toHaveBeenCalledTimes(1);
      expect(history).toEqual(['Dismantle build: Gaming Rig Beta']);
    });

    it('produces exactly one Undo entry on successful trade-in part out', () => {
      const state = getMockTradeInState();
      const history: string[] = [];
      const saveStateToHistory = vi.fn((label: string) => history.push(label));
      const defaultExtracted: { category: ComponentCategory; name: string; quantity: number; unitCost: number }[] = [
        { category: 'GPU', name: 'GTX 1660 Super', quantity: 1, unitCost: 180 },
        { category: 'CPU', name: 'Ryzen 5 3600', quantity: 1, unitCost: 120 },
      ];

      const dismantleBuild = (buildId: string, extracted?: typeof defaultExtracted) => {
        const targetBuild = state.builds.find((b) => b.id === buildId);
        const buildName = targetBuild?.name || 'Build';
        const isTradeIn = targetBuild?.acquisitionSource === 'Trade-In';

        const res = handleDismantleBuild(state, buildId, extracted);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        if (res.nextState === state) {
          return { success: true };
        }
        saveStateToHistory(isTradeIn ? `Part out trade-in: ${buildName}` : `Dismantle build: ${buildName}`);
        return { success: true };
      };

      const result = dismantleBuild('b-trade-in', defaultExtracted);
      expect(result.success).toBe(true);
      expect(saveStateToHistory).toHaveBeenCalledTimes(1);
      expect(history).toEqual(['Part out trade-in: Trade-In PC Alpha']);
    });
  });
});
