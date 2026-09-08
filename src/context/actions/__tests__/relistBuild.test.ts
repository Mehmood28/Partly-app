import { describe, it, expect } from 'vitest';
import { handleRelistBuild } from '../buildActions';
import { AppState, PCBuild, TransactionLogItem, InventoryComponent } from '../../../types';

describe('handleRelistBuild & Linked Trade-In Cleanup', () => {
  const getBaseState = (): AppState => {
    const soldBuild: PCBuild = {
      id: 'build-sold-1',
      name: 'Custom Gaming Beast',
      status: 'Sold',
      createdDate: '2025-01-01',
      builtDate: '2025-01-10',
      completionDate: '2025-01-12',
      saleDate: '2025-01-20',
      salePrice: 1500,
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'Alice Smith',
      buyerPhone: '555-1234',
      saleTransactionId: 'tx-sale-1',
      daysOnMarket: 8,
      imageUrl: 'https://example.com/rig.jpg',
      warrantyDays: 60,
      estimatedCost: 1000,
      notes: 'Custom braided cables included',
      parts: [
        {
          componentId: 'c-gpu',
          componentName: 'RTX 4070',
          purchaseEntryId: 'pe-gpu-1',
          category: 'GPU',
          quantity: 1,
          unitCostAtAssignment: 600,
        },
        {
          componentId: 'c-cpu',
          componentName: 'Ryzen 7700X',
          purchaseEntryId: 'pe-cpu-1',
          category: 'CPU',
          quantity: 1,
          unitCostAtAssignment: 400,
        },
      ],
    };

    const saleTx: TransactionLogItem = {
      id: 'tx-sale-1',
      type: 'SALE',
      title: 'PC Sold: Custom Gaming Beast',
      timestamp: '2025-01-20',
      dateSortable: '2025-01-20',
      totalAmount: 1500,
      profitMargin: 500,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Custom Gaming Beast',
      detailsList: ['RTX 4070', 'Ryzen 7700X'],
      relatedComponentId: 'build-sold-1',
      platform: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'Alice Smith',
    };

    const otherBuild: PCBuild = {
      id: 'build-unrelated',
      name: 'Workstation 9000',
      status: 'Listed for Sale',
      createdDate: '2025-01-05',
      parts: [],
    };

    const otherTx: TransactionLogItem = {
      id: 'tx-unrelated',
      type: 'PURCHASE',
      title: 'Bought SSDs',
      timestamp: '2025-01-02',
      dateSortable: '2025-01-02',
      totalAmount: 200,
      itemCount: 2,
      quantity: 2,
      itemNameOrSummary: 'Crucial P3 Plus',
    };

    const compGpu: InventoryComponent = {
      id: 'c-gpu',
      name: 'NVIDIA RTX 4070',
      category: 'GPU',
      specifications: '12GB GDDR6X',
      assignedCount: 1,
      purchaseHistory: [
        {
          id: 'pe-gpu-1',
          date: '2024-12-15',
          condition: 'Sealed',
          quantity: 1,
          unitPrice: 600,
          totalPrice: 600,
          paymentMethod: 'Credit Card',
          platform: 'Amazon',
        },
      ],
    };

    return {
      builds: [soldBuild, otherBuild],
      transactions: [saleTx, otherTx],
      components: [compGpu],
      monthlyGoal: 2000,
    };
  };

  it('rejects empty, blank, or invalid build ID', () => {
    const state = getBaseState();

    const emptyRes = handleRelistBuild(state, '');
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.error).toBe('Build ID is required.');
    expect(emptyRes.nextState).toBe(state);

    const blankRes = handleRelistBuild(state, '   ');
    expect(blankRes.success).toBe(false);
    expect(blankRes.error).toBe('Build ID is required.');
    expect(blankRes.nextState).toBe(state);

    const nullRes = handleRelistBuild(state, null as any);
    expect(nullRes.success).toBe(false);
    expect(nullRes.error).toBe('Build ID is required.');
    expect(nullRes.nextState).toBe(state);
  });

  it('rejects missing target build', () => {
    const state = getBaseState();
    const res = handleRelistBuild(state, 'build-nonexistent');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Build not found.');
    expect(res.nextState).toBe(state);
  });

  it('rejects duplicate target build IDs', () => {
    const state = getBaseState();
    const duplicateBuild: PCBuild = {
      ...state.builds[0],
      name: 'Duplicate Rig',
    };
    const stateWithDup: AppState = {
      ...state,
      builds: [...state.builds, duplicateBuild],
    };

    const res = handleRelistBuild(stateWithDup, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Ambiguous build: Multiple builds share ID "build-sold-1".');
    expect(res.nextState).toBe(stateWithDup);
  });

  it('rejects non-Sold target build', () => {
    const state = getBaseState();
    const res = handleRelistBuild(state, 'build-unrelated'); // status is 'Listed for Sale'
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot relist: Build is not sold.');
    expect(res.nextState).toBe(state);
  });

  it('rejects missing linked sale transaction', () => {
    const state = getBaseState();
    const stateWithoutTx: AppState = {
      ...state,
      transactions: state.transactions.filter((t) => t.id !== 'tx-sale-1'),
    };

    const res = handleRelistBuild(stateWithoutTx, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('not found');
    expect(res.nextState).toBe(stateWithoutTx);
  });

  it('rejects mismatched explicit saleTransactionId', () => {
    const state = getBaseState();
    // Transaction points to a different component/build
    const mismatchedTxState: AppState = {
      ...state,
      transactions: state.transactions.map((t) =>
        t.id === 'tx-sale-1' ? { ...t, relatedComponentId: 'build-unrelated' } : t
      ),
    };

    const res = handleRelistBuild(mismatchedTxState, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mismatched linkage');
    expect(res.nextState).toBe(mismatchedTxState);

    // Or transaction type is not SALE
    const nonSaleTxState: AppState = {
      ...state,
      transactions: state.transactions.map((t) =>
        t.id === 'tx-sale-1' ? { ...t, type: 'PURCHASE' as const } : t
      ),
    };
    const resNonSale = handleRelistBuild(nonSaleTxState, 'build-sold-1');
    expect(resNonSale.success).toBe(false);
    expect(resNonSale.nextState).toBe(nonSaleTxState);
  });

  it('rejects ambiguous legacy sale matches', () => {
    const state = getBaseState();
    // Target has no explicit saleTransactionId (legacy)
    const legacyBuild: PCBuild = {
      ...state.builds[0],
      saleTransactionId: undefined,
    };
    // Two sale transactions reference this build
    const secondSaleTx: TransactionLogItem = {
      ...state.transactions[0],
      id: 'tx-sale-dup',
    };
    const ambiguousState: AppState = {
      ...state,
      builds: [legacyBuild, state.builds[1]],
      transactions: [...state.transactions, secondSaleTx],
    };

    const res = handleRelistBuild(ambiguousState, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Ambiguous linkage');
    expect(res.nextState).toBe(ambiguousState);
  });

  it('rejects when linked sale transaction is referenced by another build', () => {
    const state = getBaseState();
    // Another build claims the same saleTransactionId
    const corruptedState: AppState = {
      ...state,
      builds: state.builds.map((b) =>
        b.id === 'build-unrelated' ? { ...b, saleTransactionId: 'tx-sale-1' } : b
      ),
    };

    const res = handleRelistBuild(corruptedState, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot relist: Another build references the linked sale transaction.');
    expect(res.nextState).toBe(corruptedState);
  });

  it('rejects when multiple transactions share the explicit linked sale transaction ID, deleting nothing and returning original state reference', () => {
    const state = getBaseState();
    const duplicateTx: TransactionLogItem = {
      ...state.transactions[0],
      title: 'PC Sold: Duplicate Transaction',
    };
    const stateWithDupTx: AppState = {
      ...state,
      transactions: [...state.transactions, duplicateTx],
    };

    const res = handleRelistBuild(stateWithDupTx, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Ambiguous linkage: Multiple transactions share ID "tx-sale-1"');
    expect(res.nextState).toBe(stateWithDupTx);
    expect(res.nextState.transactions.length).toBe(stateWithDupTx.transactions.length);
    expect(res.nextState.builds.length).toBe(stateWithDupTx.builds.length);
  });

  it('rejects when another build references the linked sale transaction via sourceSaleTransactionId', () => {
    const state = getBaseState();
    const stateWithOtherBuildSource: AppState = {
      ...state,
      builds: state.builds.map((b) =>
        b.id === 'build-unrelated' ? { ...b, sourceSaleTransactionId: 'tx-sale-1' } : b
      ),
    };

    const res = handleRelistBuild(stateWithOtherBuildSource, 'build-sold-1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot relist: Another build references the linked sale transaction.');
    expect(res.nextState).toBe(stateWithOtherBuildSource);
  });

  describe('trade-in validations', () => {
    const getTradeInState = () => {
      const base = getBaseState();
      const tradeInBuild: PCBuild = {
        id: 'trade-in-1',
        name: 'Incoming Trade-In Rig',
        status: 'Trade-In Processing',
        acquisitionSource: 'Trade-In',
        sourceSaleTransactionId: 'tx-sale-1',
        createdDate: '2025-01-20',
        parts: [],
        estimatedCost: 300,
      };

      const saleTxWithTradeIn: TransactionLogItem = {
        ...base.transactions[0],
        totalAmount: 1500,
        cashPortion: 1200,
        tradeInCredit: 300,
        incomingTradeInBuildId: 'trade-in-1',
        tradeInBuildName: 'Incoming Trade-In Rig',
      };

      return {
        ...base,
        builds: [...base.builds, tradeInBuild],
        transactions: [saleTxWithTradeIn, base.transactions[1]],
      };
    };

    it('rejects invalid or empty incomingTradeInBuildId when present', () => {
      const state = getTradeInState();
      const badIdState: AppState = {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === 'tx-sale-1' ? { ...t, incomingTradeInBuildId: '   ' } : t
        ),
      };

      const res = handleRelistBuild(badIdState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot relist: Linked trade-in build ID is invalid or empty.');
      expect(res.nextState).toBe(badIdState);
    });

    it('rejects when incomingTradeInBuildId equals outgoing build ID', () => {
      const state = getTradeInState();
      const selfRefState: AppState = {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === 'tx-sale-1' ? { ...t, incomingTradeInBuildId: 'build-sold-1' } : t
        ),
      };

      const res = handleRelistBuild(selfRefState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        'Cannot relist: Incoming trade-in build ID cannot match the sold build ID.'
      );
      expect(res.nextState).toBe(selfRefState);
    });

    it('rejects missing incoming trade-in build', () => {
      const state = getTradeInState();
      const missingIncomingState: AppState = {
        ...state,
        builds: state.builds.filter((b) => b.id !== 'trade-in-1'),
      };

      const res = handleRelistBuild(missingIncomingState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot relist: The linked incoming trade-in PC record is missing.');
      expect(res.nextState).toBe(missingIncomingState);
    });

    it('rejects duplicate incoming build IDs', () => {
      const state = getTradeInState();
      const duplicateTradeIn: PCBuild = {
        ...state.builds.find((b) => b.id === 'trade-in-1')!,
        name: 'Duplicate Trade-In',
      };
      const duplicateIncomingState: AppState = {
        ...state,
        builds: [...state.builds, duplicateTradeIn],
      };

      const res = handleRelistBuild(duplicateIncomingState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain(
        'Ambiguous incoming trade-in build: Multiple builds share this ID.'
      );
      expect(res.nextState).toBe(duplicateIncomingState);
    });

    it('rejects when another transaction references the same incoming trade-in build', () => {
      const state = getTradeInState();
      const anotherTx: TransactionLogItem = {
        id: 'tx-conflict',
        type: 'SALE',
        title: 'Conflict Sale',
        timestamp: '2025-01-25',
        dateSortable: '2025-01-25',
        totalAmount: 100,
        itemCount: 1,
        quantity: 1,
        itemNameOrSummary: 'Conflict',
        incomingTradeInBuildId: 'trade-in-1',
      };
      const conflictState: AppState = {
        ...state,
        transactions: [...state.transactions, anotherTx],
      };

      const res = handleRelistBuild(conflictState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        'Cannot relist: Another transaction references the linked incoming trade-in build.'
      );
      expect(res.nextState).toBe(conflictState);
    });

    it('rejects when another transaction has a whitespace-padded incomingTradeInBuildId referencing the same trade-in build', () => {
      const state = getTradeInState();
      const paddedTx: TransactionLogItem = {
        id: 'tx-conflict-padded',
        type: 'SALE',
        title: 'Conflict Sale Padded',
        timestamp: '2025-01-25',
        dateSortable: '2025-01-25',
        totalAmount: 100,
        itemCount: 1,
        quantity: 1,
        itemNameOrSummary: 'Conflict Padded',
        incomingTradeInBuildId: '   trade-in-1   ',
      };
      const conflictState: AppState = {
        ...state,
        transactions: [...state.transactions, paddedTx],
      };

      const res = handleRelistBuild(conflictState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        'Cannot relist: Another transaction references the linked incoming trade-in build.'
      );
      expect(res.nextState).toBe(conflictState);
    });

    it('rejects incoming build with wrong sourceSaleTransactionId', () => {
      const state = getTradeInState();
      const wrongSourceState: AppState = {
        ...state,
        builds: state.builds.map((b) =>
          b.id === 'trade-in-1' ? { ...b, sourceSaleTransactionId: 'tx-other-sale' } : b
        ),
      };

      const res = handleRelistBuild(wrongSourceState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Source sale transaction mismatch');
      expect(res.nextState).toBe(wrongSourceState);
    });

    it('rejects incoming build with wrong status', () => {
      const state = getTradeInState();
      const wrongStatusState: AppState = {
        ...state,
        builds: state.builds.map((b) =>
          b.id === 'trade-in-1' ? { ...b, status: 'In Progress' as const } : b
        ),
      };

      const res = handleRelistBuild(wrongStatusState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('must be "Trade-In Processing"');
      expect(res.nextState).toBe(wrongStatusState);
    });

    it('rejects incoming build containing allocated parts', () => {
      const state = getTradeInState();
      const withPartsState: AppState = {
        ...state,
        builds: state.builds.map((b) =>
          b.id === 'trade-in-1'
            ? {
                ...b,
                parts: [
                  {
                    componentId: 'c-gpu',
                    componentName: 'RTX 4070',
                    purchaseEntryId: 'pe-gpu-1',
                    category: 'GPU',
                    quantity: 1,
                    unitCostAtAssignment: 600,
                  },
                ],
              }
            : b
        ),
      };

      const res = handleRelistBuild(withPartsState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Trade-in build has allocated upgrade parts');
      expect(res.nextState).toBe(withPartsState);
    });

    it('rejects incoming build containing a saved component breakdown', () => {
      const state = getTradeInState();
      const withBreakdownState: AppState = {
        ...state,
        builds: state.builds.map((b) =>
          b.id === 'trade-in-1'
            ? {
                ...b,
                tradeInComponentBreakdown: [
                  {
                    id: 'bd-1',
                    category: 'GPU',
                    name: 'GTX 1080',
                    quantity: 1,
                    unitCost: 150,
                  },
                ],
              }
            : b
        ),
      };

      const res = handleRelistBuild(withBreakdownState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Trade-in PC has a saved component breakdown');
      expect(res.nextState).toBe(withBreakdownState);
    });

    it('rejects incoming build with extracted purchase-entry provenance', () => {
      const state = getTradeInState();
      const withExtractedBatchState: AppState = {
        ...state,
        components: state.components.map((c) =>
          c.id === 'c-gpu'
            ? {
                ...c,
                purchaseHistory: [
                  ...c.purchaseHistory,
                  {
                    id: 'pe-extracted',
                    date: '2025-01-20',
                    condition: 'Used',
                    unitPrice: 100,
                    quantity: 1,
                    totalPrice: 100,
                    paymentMethod: 'Trade-In',
                    platform: 'Facebook',
                    sourceTradeInBuildId: 'trade-in-1',
                  },
                ],
              }
            : c
        ),
      };

      const res = handleRelistBuild(withExtractedBatchState, 'build-sold-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Trade-in PC has already been parted out into inventory stock');
      expect(res.nextState).toBe(withExtractedBatchState);
    });
  });

  describe('successful relist operations', () => {
    it('successfully relists sold PC without a trade-in, removing only the sale transaction and clearing sale fields', () => {
      const state = getBaseState();
      const res = handleRelistBuild(state, 'build-sold-1');

      expect(res.success).toBe(true);
      expect(res.nextState).not.toBe(state);

      // Sale transaction removed
      expect(res.nextState.transactions.find((t) => t.id === 'tx-sale-1')).toBeUndefined();
      // Unrelated transaction untouched
      expect(res.nextState.transactions.find((t) => t.id === 'tx-unrelated')).toEqual(
        state.transactions.find((t) => t.id === 'tx-unrelated')
      );

      // Target build updated to 'Listed for Sale'
      const relistedBuild = res.nextState.builds.find((b) => b.id === 'build-sold-1')!;
      expect(relistedBuild.status).toBe('Listed for Sale');
      expect(relistedBuild.salePrice).toBeUndefined();
      expect(relistedBuild.saleDate).toBeUndefined();
      expect(relistedBuild.platformSoldOn).toBeUndefined();
      expect(relistedBuild.paymentMethod).toBeUndefined();
      expect(relistedBuild.buyerName).toBeUndefined();
      expect(relistedBuild.buyerPhone).toBeUndefined();
      expect(relistedBuild.saleTransactionId).toBeUndefined();
      expect(relistedBuild.daysOnMarket).toBeUndefined();

      // Protected fields preserved
      expect(relistedBuild.id).toBe('build-sold-1');
      expect(relistedBuild.name).toBe('Custom Gaming Beast');
      expect(relistedBuild.createdDate).toBe('2025-01-01');
      expect(relistedBuild.builtDate).toBe('2025-01-10');
      expect(relistedBuild.completionDate).toBe('2025-01-12'); // Preserved existing completionDate
      expect(relistedBuild.imageUrl).toBe('https://example.com/rig.jpg');
      expect(relistedBuild.warrantyDays).toBe(60);
      expect(relistedBuild.estimatedCost).toBe(1000);
      expect(relistedBuild.notes).toBe('Custom braided cables included');
      expect(relistedBuild.parts).toEqual(state.builds[0].parts);

      // Unrelated build untouched
      expect(res.nextState.builds.find((b) => b.id === 'build-unrelated')).toEqual(
        state.builds.find((b) => b.id === 'build-unrelated')
      );

      // Components untouched
      expect(res.nextState.components).toBe(state.components);
    });

    it('successfully relists sold PC with a pristine incoming trade-in, removing both the sale transaction and trade-in build', () => {
      const base = getBaseState();
      const tradeInBuild: PCBuild = {
        id: 'trade-in-1',
        name: 'Pristine Trade-In',
        status: 'Trade-In Processing',
        acquisitionSource: 'Trade-In',
        sourceSaleTransactionId: 'tx-sale-1',
        createdDate: '2025-01-20',
        parts: [],
        estimatedCost: 350,
      };

      const saleTxWithTradeIn: TransactionLogItem = {
        ...base.transactions[0],
        cashPortion: 1150,
        tradeInCredit: 350,
        incomingTradeInBuildId: 'trade-in-1',
        tradeInBuildName: 'Pristine Trade-In',
      };

      const state: AppState = {
        ...base,
        builds: [...base.builds, tradeInBuild],
        transactions: [saleTxWithTradeIn, base.transactions[1]],
      };

      const res = handleRelistBuild(state, 'build-sold-1');
      expect(res.success).toBe(true);
      expect(res.nextState).not.toBe(state);

      // Both sale tx and trade-in build are removed
      expect(res.nextState.transactions.find((t) => t.id === 'tx-sale-1')).toBeUndefined();
      expect(res.nextState.builds.find((b) => b.id === 'trade-in-1')).toBeUndefined();

      // Sold build is relisted
      const relisted = res.nextState.builds.find((b) => b.id === 'build-sold-1')!;
      expect(relisted.status).toBe('Listed for Sale');
      expect(relisted.saleTransactionId).toBeUndefined();
      expect(relisted.parts).toEqual(base.builds[0].parts);

      // Unrelated records untouched
      expect(res.nextState.builds.find((b) => b.id === 'build-unrelated')).toEqual(
        base.builds.find((b) => b.id === 'build-unrelated')
      );
      expect(res.nextState.transactions.find((t) => t.id === 'tx-unrelated')).toEqual(
        base.transactions.find((t) => t.id === 'tx-unrelated')
      );
    });

    it('successfully relists legacy credit-only sale without an incoming build ID', () => {
      const base = getBaseState();
      const legacySaleTx: TransactionLogItem = {
        ...base.transactions[0],
        tradeInCredit: 250,
        tradeInBuildName: 'Old Custom Rig',
        tradeInNotes: 'Accepted without separate build record',
        incomingTradeInBuildId: undefined, // No incoming build record
      };

      const state: AppState = {
        ...base,
        transactions: [legacySaleTx, base.transactions[1]],
      };

      const res = handleRelistBuild(state, 'build-sold-1');
      expect(res.success).toBe(true);
      expect(res.nextState).not.toBe(state);

      // Sale tx removed, build relisted, no crash or missing build error
      expect(res.nextState.transactions.find((t) => t.id === 'tx-sale-1')).toBeUndefined();
      const relisted = res.nextState.builds.find((b) => b.id === 'build-sold-1')!;
      expect(relisted.status).toBe('Listed for Sale');
      expect(relisted.saleTransactionId).toBeUndefined();
    });

    it('sets completionDate to current date when previously missing', () => {
      const base = getBaseState();
      const buildWithoutCompletion: PCBuild = {
        ...base.builds[0],
        completionDate: undefined,
      };
      const state: AppState = {
        ...base,
        builds: [buildWithoutCompletion, base.builds[1]],
      };

      const res = handleRelistBuild(state, 'build-sold-1');
      expect(res.success).toBe(true);
      const relisted = res.nextState.builds.find((b) => b.id === 'build-sold-1')!;
      expect(typeof relisted.completionDate).toBe('string');
      expect(relisted.completionDate?.length).toBeGreaterThan(0);
    });
  });

  describe('context undo history integration', () => {
    it('simulates InventoryContext: failures produce zero Undo entries, success produces exactly one', () => {
      let currentState = getBaseState();
      const history: string[] = [];
      const saveStateToHistory = (label: string) => history.push(label);
      const setState = (next: AppState) => {
        currentState = next;
      };

      const relistBuild = (buildId: string) => {
        const res = handleRelistBuild(currentState, buildId);
        if (!res.success) {
          return { success: false, error: res.error };
        }
        if (res.nextState === currentState) {
          return { success: true };
        }
        const targetBuild = currentState.builds.find((b) => b.id === buildId);
        const buildName = targetBuild?.name || 'Build';
        saveStateToHistory(`Relist build: ${buildName}`);
        setState(res.nextState);
        return { success: true };
      };

      // 1. Rejected: empty ID
      const r1 = relistBuild('');
      expect(r1.success).toBe(false);
      expect(history.length).toBe(0);

      // 2. Rejected: non-existent build
      const r2 = relistBuild('build-missing');
      expect(r2.success).toBe(false);
      expect(history.length).toBe(0);

      // 3. Rejected: non-sold build
      const r3 = relistBuild('build-unrelated');
      expect(r3.success).toBe(false);
      expect(history.length).toBe(0);

      // 4. Rejected: duplicate linked transaction IDs
      const duplicateTx: TransactionLogItem = {
        ...currentState.transactions[0],
        title: 'PC Sold: Duplicate Transaction',
      };
      const savedStateBeforeDup = currentState;
      currentState = {
        ...currentState,
        transactions: [...currentState.transactions, duplicateTx],
      };
      const rDup = relistBuild('build-sold-1');
      expect(rDup.success).toBe(false);
      expect(history.length).toBe(0);
      currentState = savedStateBeforeDup;

      // 5. Successful relist
      const rSuccess = relistBuild('build-sold-1');
      expect(rSuccess.success).toBe(true);
      expect(history.length).toBe(1);
      expect(history[0]).toBe('Relist build: Custom Gaming Beast');
      expect(currentState.builds.find((b) => b.id === 'build-sold-1')?.status).toBe(
        'Listed for Sale'
      );
    });
  });
});
