import { describe, it, expect } from 'vitest';
import { getSaleTradeInEditState } from './buildEligibility';
import { handleSellBuild } from '../context/actions/buildActions';
import { AppState, PCBuild, TransactionLogItem } from '../types';

describe('getSaleTradeInEditState', () => {
  it('identifies no trade-in for normal sale transaction', () => {
    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
    };

    const state = getSaleTradeInEditState(tx, [], []);
    expect(state.hasExistingTradeIn).toBe(false);
    expect(state.isLocked).toBe(false);
    expect(state.lockReason).toBeUndefined();
    expect(state.existingIncomingBuild).toBeUndefined();
  });

  it('does not classify sale as having trade-in when tradeInCredit is 0, negative, NaN, or infinite and other signals are absent', () => {
    const baseTx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
    };

    // tradeInCredit: 0
    const stateZero = getSaleTradeInEditState({ ...baseTx, tradeInCredit: 0 }, [], []);
    expect(stateZero.hasExistingTradeIn).toBe(false);

    // tradeInCredit: negative
    const stateNeg = getSaleTradeInEditState({ ...baseTx, tradeInCredit: -50 }, [], []);
    expect(stateNeg.hasExistingTradeIn).toBe(false);

    // tradeInCredit: NaN
    const stateNaN = getSaleTradeInEditState({ ...baseTx, tradeInCredit: NaN }, [], []);
    expect(stateNaN.hasExistingTradeIn).toBe(false);

    // tradeInCredit: Infinity
    const stateInf = getSaleTradeInEditState({ ...baseTx, tradeInCredit: Infinity }, [], []);
    expect(stateInf.hasExistingTradeIn).toBe(false);
  });

  it('detects trade-in when tradeInBuildName or tradeInNotes is present even without incoming ID or credit', () => {
    const baseTx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
    };

    const stateWithName = getSaleTradeInEditState({ ...baseTx, tradeInBuildName: 'Old Box' }, [], []);
    expect(stateWithName.hasExistingTradeIn).toBe(true);
    expect(stateWithName.isLocked).toBe(true);

    const stateWithNotes = getSaleTradeInEditState({ ...baseTx, tradeInNotes: 'Customer trade-in pending' }, [], []);
    expect(stateWithNotes.hasExistingTradeIn).toBe(true);
    expect(stateWithNotes.isLocked).toBe(true);
  });

  it('detects trade-in when incomingTradeInBuildId is present even if tradeInCredit is 0', () => {
    const tradeInBuild: PCBuild = {
      id: 'trade-in-1',
      name: 'Trade-In Rig',
      status: 'Trade-In Processing',
      parts: [],
      estimatedCost: 0,
      acquisitionSource: 'Trade-In',
      sourceSaleTransactionId: 'tx-1',
      createdDate: '2025-01-10',
    };

    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
      incomingTradeInBuildId: 'trade-in-1',
      tradeInCredit: 0,
    };

    const state = getSaleTradeInEditState(tx, [tradeInBuild], []);
    expect(state.hasExistingTradeIn).toBe(true);
    expect(state.isLocked).toBe(false);
  });

  it('identifies locked legacy trade-in without an incoming build ID', () => {
    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
      tradeInCredit: 250,
      tradeInBuildName: 'Old Rig',
    };

    const state = getSaleTradeInEditState(tx, [], []);
    expect(state.hasExistingTradeIn).toBe(true);
    expect(state.isLocked).toBe(true);
    expect(state.lockReason).toContain('without a linked incoming build');
    expect(state.existingIncomingBuild).toBeUndefined();
  });

  it('identifies locked trade-in when linked incoming build is missing from builds', () => {
    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
      incomingTradeInBuildId: 'build-missing',
      tradeInCredit: 300,
      tradeInBuildName: 'Trade-in Rig',
    };

    const state = getSaleTradeInEditState(tx, [], []);
    expect(state.hasExistingTradeIn).toBe(true);
    expect(state.isLocked).toBe(true);
    expect(state.lockReason).toContain('Incoming trade-in PC record not found');
  });

  it('identifies unlocked trade-in when linked incoming build is pristine', () => {
    const tradeInBuild: PCBuild = {
      id: 'trade-in-1',
      name: 'Trade-In Rig',
      status: 'Trade-In Processing',
      parts: [],
      estimatedCost: 300,
      acquisitionSource: 'Trade-In',
      sourceSaleTransactionId: 'tx-1',
      createdDate: '2025-01-10',
    };

    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
      incomingTradeInBuildId: 'trade-in-1',
      tradeInCredit: 300,
      tradeInBuildName: 'Trade-In Rig',
    };

    const state = getSaleTradeInEditState(tx, [tradeInBuild], []);
    expect(state.hasExistingTradeIn).toBe(true);
    expect(state.isLocked).toBe(false);
    expect(state.lockReason).toBeUndefined();
    expect(state.existingIncomingBuild?.id).toBe('trade-in-1');
  });

  it('identifies locked trade-in when incoming build status has changed from Trade-In Processing', () => {
    const tradeInBuild: PCBuild = {
      id: 'trade-in-1',
      name: 'Trade-In Rig',
      status: 'Listed for Sale',
      parts: [],
      estimatedCost: 300,
      acquisitionSource: 'Trade-In',
      sourceSaleTransactionId: 'tx-1',
      createdDate: '2025-01-10',
    };

    const tx: TransactionLogItem = {
      id: 'tx-1',
      title: 'PC Sold: Gaming Rig',
      timestamp: '2025-01-10',
      dateSortable: '2025-01-10',
      totalAmount: 1000,
      itemCount: 1,
      quantity: 1,
      itemNameOrSummary: 'Gaming Rig',
      detailsList: [],
      profitMargin: 200,
      type: 'SALE',
      relatedComponentId: 'build-1',
      incomingTradeInBuildId: 'trade-in-1',
      tradeInCredit: 300,
      tradeInBuildName: 'Trade-In Rig',
    };

    const state = getSaleTradeInEditState(tx, [tradeInBuild], []);
    expect(state.hasExistingTradeIn).toBe(true);
    expect(state.isLocked).toBe(true);
    expect(state.lockReason).toContain('must be "Trade-In Processing"');
  });
});

describe('handleSellBuild - Sold PC Editing and Trade-In Integrity', () => {
  const baseBuild: PCBuild = {
    id: 'build-sold-1',
    name: 'Main Gaming PC',
    status: 'Sold',
    parts: [],
    salePrice: 1200,
    saleDate: '2025-02-01',
    platformSoldOn: 'Facebook',
    paymentMethod: 'Cash',
    buyerName: 'John Doe',
    createdDate: '2025-01-15',
    saleTransactionId: 'tx-sold-1',
  };

  const baseTx: TransactionLogItem = {
    id: 'tx-sold-1',
    warrantyDaysAtSale: 30,
    title: 'PC Sold: Main Gaming PC ($900.00 Cash + $300.00 Trade-In)',
    timestamp: '2025-02-01',
    dateSortable: '2025-02-01',
    totalAmount: 1200,
    cashPortion: 900,
    tradeInCredit: 300,
    incomingTradeInBuildId: 'trade-in-build-1',
    tradeInBuildName: 'Old Rig',
    tradeInNotes: 'Good condition',
    platform: 'Facebook',
    paymentMethod: 'Cash',
    buyerName: 'John Doe',
    itemNameOrSummary: 'Main Gaming PC',
    itemCount: 0,
    quantity: 0,
    detailsList: [],
    profitMargin: 1200,
    type: 'SALE',
    relatedComponentId: 'build-sold-1',
  };

  const pristineTradeInBuild: PCBuild = {
    id: 'trade-in-build-1',
    name: 'Old Rig',
    status: 'Trade-In Processing',
    parts: [],
    estimatedCost: 300,
    notes: 'Good condition',
    acquisitionSource: 'Trade-In',
    sourceSaleTransactionId: 'tx-sold-1',
    createdDate: '2025-02-01',
  };

  const createInitialState = (overrides?: Partial<AppState>): AppState => ({
    components: [],
    builds: [baseBuild, pristineTradeInBuild],
    transactions: [baseTx],
    ...overrides,
  });

  it('performs semantic no-op when resubmitting unchanged sold build', () => {
    const state = createInitialState();
    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).toBe(state);
  });

  it('allows updating unrelated sale fields when trade-in is locked', () => {
    const lockedTradeIn: PCBuild = { ...pristineTradeInBuild, status: 'Listed for Sale' };
    const state = createInitialState({ builds: [baseBuild, lockedTradeIn] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1300,
      saleDate: '2025-02-01',
      platformSoldOn: 'Kijiji',
      paymentMethod: 'E-Transfer',
      buyerName: 'Jane Smith',
      tradeIn: undefined,
    });

    expect(result.success).toBe(true);
    const updatedBuild = result.nextState.builds.find((b) => b.id === 'build-sold-1');
    expect(updatedBuild?.buyerName).toBe('Jane Smith');
    expect(updatedBuild?.salePrice).toBe(1300);
    expect(updatedBuild?.platformSoldOn).toBe('Kijiji');

    const updatedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(updatedTx?.buyerName).toBe('Jane Smith');
    expect(updatedTx?.totalAmount).toBe(1300);
    expect(updatedTx?.tradeInCredit).toBe(300);
    expect(updatedTx?.cashPortion).toBe(1000);
    expect(updatedTx?.incomingTradeInBuildId).toBe('trade-in-build-1');
  });

  it('rejects changing trade-in credit when trade-in is locked', () => {
    const lockedTradeIn: PCBuild = { ...pristineTradeInBuild, status: 'Listed for Sale' };
    const state = createInitialState({ builds: [baseBuild, lockedTradeIn] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: {
        tradeInCredit: 400,
        tradeInBuildName: 'Old Rig',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot modify trade-in terms');
  });

  it('rejects removing trade-in (tradeIn: null) when trade-in is locked', () => {
    const lockedTradeIn: PCBuild = { ...pristineTradeInBuild, status: 'Listed for Sale' };
    const state = createInitialState({ builds: [baseBuild, lockedTradeIn] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot remove trade-in');
  });

  it('allows removing trade-in (tradeIn: null) when pristine and unlocked', () => {
    const state = createInitialState();

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 900,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: null,
    });

    expect(result.success).toBe(true);
    expect(result.nextState.builds.find((b) => b.id === 'trade-in-build-1')).toBeUndefined();
    const updatedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(updatedTx?.incomingTradeInBuildId).toBeUndefined();
    expect(updatedTx?.tradeInCredit).toBeUndefined();
    expect(updatedTx?.cashPortion).toBeUndefined();
  });

  it('allows modifying trade-in terms when pristine and unlocked', () => {
    const state = createInitialState();

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1300,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: {
        tradeInCredit: 350,
        tradeInBuildName: 'Updated Trade-In Rig',
        tradeInNotes: 'New notes',
      },
    });

    expect(result.success).toBe(true);
    const updatedTradeIn = result.nextState.builds.find((b) => b.id === 'trade-in-build-1');
    expect(updatedTradeIn?.name).toBe('Updated Trade-In Rig');
    expect(updatedTradeIn?.estimatedCost).toBe(350);
    expect(updatedTradeIn?.notes).toBe('New notes');

    const updatedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(updatedTx?.tradeInCredit).toBe(350);
    expect(updatedTx?.tradeInBuildName).toBe('Updated Trade-In Rig');
    expect(updatedTx?.tradeInNotes).toBe('New notes');
  });

  it('does not reject when locked trade-in name or notes differ only by whitespace', () => {
    const lockedTradeIn: PCBuild = { ...pristineTradeInBuild, status: 'Listed for Sale' };
    const state = createInitialState({ builds: [baseBuild, lockedTradeIn] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: '  Old Rig  ',
        tradeInNotes: ' Good condition ',
      },
    });

    expect(result.success).toBe(true);
  });

  it('detects stale daysOnMarket on targetBuild, prevents no-op, and repairs it', () => {
    // baseBuild has builtDate: undefined by default; let's give it builtDate: '2025-01-15'
    // Between 2025-01-15 and 2025-02-01 is 17 days
    const staleBuild: PCBuild = {
      ...baseBuild,
      builtDate: '2025-01-15',
      daysOnMarket: 999, // Stale!
    };
    const state = createInitialState({ builds: [staleBuild, pristineTradeInBuild] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      builtDate: '2025-01-15',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state); // Not a no-op!
    const repairedBuild = result.nextState.builds.find((b) => b.id === 'build-sold-1');
    expect(repairedBuild?.daysOnMarket).toBe(17);
    expect(repairedBuild?.id).toBe('build-sold-1');
  });

  it('detects stale cashPortion and title on transaction, prevents no-op, and repairs them', () => {
    const staleTx: TransactionLogItem = {
      ...baseTx,
      title: 'Outdated Title',
      cashPortion: undefined, // Missing cash portion!
    };
    const state = createInitialState({ transactions: [staleTx] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state);
    const repairedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(repairedTx?.cashPortion).toBe(900);
    expect(repairedTx?.title).toBe('PC Sold: Main Gaming PC ($900.00 Cash + $300.00 Trade-In)');
    expect(repairedTx?.id).toBe('tx-sold-1');
  });

  it('detects stale timestamp when dateSortable matches, prevents no-op, and repairs timestamp', () => {
    const staleTx: TransactionLogItem = {
      ...baseTx,
      timestamp: '2025-01-01', // Stale timestamp!
      dateSortable: '2025-02-01',
    };
    const state = createInitialState({ transactions: [staleTx] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state);
    const repairedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(repairedTx?.timestamp).toBe('2025-02-01');
    expect(repairedTx?.dateSortable).toBe('2025-02-01');
  });

  it('detects stale dateSortable when timestamp matches, prevents no-op, and repairs dateSortable', () => {
    const staleTx: TransactionLogItem = {
      ...baseTx,
      timestamp: '2025-02-01',
      dateSortable: '2025-01-01', // Stale dateSortable!
    };
    const state = createInitialState({ transactions: [staleTx] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state);
    const repairedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(repairedTx?.timestamp).toBe('2025-02-01');
    expect(repairedTx?.dateSortable).toBe('2025-02-01');
  });

  it('detects stale detailsList on transaction, prevents no-op, and repairs it', () => {
    const staleTx: TransactionLogItem = {
      ...baseTx,
      detailsList: ['Stale old part summary'],
    };
    const state = createInitialState({ transactions: [staleTx] });

    const result = handleSellBuild(state, 'build-sold-1', {
      salePrice: 1200,
      saleDate: '2025-02-01',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      buyerName: 'John Doe',
      tradeIn: {
        tradeInCredit: 300,
        tradeInBuildName: 'Old Rig',
        tradeInNotes: 'Good condition',
      },
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state);
    const repairedTx = result.nextState.transactions.find((t) => t.id === 'tx-sold-1');
    expect(repairedTx?.detailsList).toEqual([]);
  });
});
