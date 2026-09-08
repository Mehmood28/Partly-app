import { describe, it, expect } from 'vitest';
import {
  handleAddBuild,
  handleUpdateBuild,
  handleSellBuild,
  handleAllocatePartToBuild,
  handleRemovePartFromBuild,
  handleSwapPartInBuild,
} from '../buildActions';
import { AppState, PCBuild } from '../../../types';

describe('Build Actions Warranty Validation', () => {
  const getMockState = (): AppState => ({
    components: [],
    builds: [
      { id: 'b1', name: 'Legacy', parts: [], status: 'Listed for Sale', createdDate: '2026-07-23' },
      { id: 'b2', name: 'Valid', parts: [], status: 'Listed for Sale', warrantyDays: 60, createdDate: '2026-07-23' }
    ],
    transactions: [],
    monthlyGoal: 1000
  });

  it('rejects invalid warranty in handleAddBuild without changing state', () => {
    const state = getMockState();
    const next1 = handleAddBuild(state, { name: 'New 1', parts: [], status: 'Listed for Sale', warrantyDays: 0 } as any);
    expect(next1).toBe(state); // Reference equality

    const next2 = handleAddBuild(state, { name: 'New 2', parts: [], status: 'Listed for Sale', warrantyDays: -5 } as any);
    expect(next2).toBe(state);

    const next3 = handleAddBuild(state, { name: 'New 3', parts: [], status: 'Listed for Sale', warrantyDays: 1.5 } as any);
    expect(next3).toBe(state);
    
    const next4 = handleAddBuild(state, { name: 'New 4', parts: [], status: 'Listed for Sale', warrantyDays: NaN } as any);
    expect(next4).toBe(state);
  });

  it('accepts valid warranty in handleAddBuild', () => {
    const state = getMockState();
    const next1 = handleAddBuild(state, { name: 'New 1', parts: [], status: 'Listed for Sale', warrantyDays: 90 } as any);
    expect(next1).not.toBe(state);
    expect(next1.builds[0].warrantyDays).toBe(90);
  });

  it('rejects invalid warranty updates in handleUpdateBuild without changing state', () => {
    const state = getMockState();
    const next1 = handleUpdateBuild(state, 'b1', { warrantyDays: 0 });
    expect(next1).toBe(state);
  });

  it('accepts valid warranty updates in handleUpdateBuild', () => {
    const state = getMockState();
    const next1 = handleUpdateBuild(state, 'b1', { warrantyDays: 365 });
    expect(next1).not.toBe(state);
    expect(next1.builds.find(b => b.id === 'b1')?.warrantyDays).toBe(365);
  });

  it('rejects invalid warranty snapshot in handleSellBuild', () => {
    const state = getMockState();
    const result = handleSellBuild(state, 'b1', { 
      salePrice: 1000, 
      saleDate: '2026-07-23', 
      platformSoldOn: 'Facebook', 
      paymentMethod: 'Cash',
      warrantyDaysAtSale: -10 
    });
    expect(result.success).toBe(false);
    expect(result.nextState).toBe(state);
  });

  it('saves warranty snapshot in handleSellBuild', () => {
    const state = getMockState();
    const result = handleSellBuild(state, 'b1', { 
      salePrice: 1000, 
      saleDate: '2026-07-23', 
      platformSoldOn: 'Facebook', 
      paymentMethod: 'Cash',
      warrantyDaysAtSale: 120 
    });
    expect(result.success).toBe(true);
    expect(result.nextState.transactions[0].warrantyDaysAtSale).toBe(120);
  });

  it('defaults new build warranty to 30 when omitted', () => {
    const state = getMockState();
    const next = handleAddBuild(state, { name: 'Default Rig', parts: [], status: 'Listed for Sale' });
    expect(next.builds[0].warrantyDays).toBe(30);
  });

  it('falls back to build warranty or 30 when warrantyDaysAtSale is not provided', () => {
    const state = getMockState();
    // b2 has warrantyDays: 60
    const resultB2 = handleSellBuild(state, 'b2', {
      salePrice: 1500,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(resultB2.success).toBe(true);
    expect(resultB2.nextState.transactions[0].warrantyDaysAtSale).toBe(60);

    // b1 has no warrantyDays, should fall back to 30
    const resultB1 = handleSellBuild(state, 'b1', {
      salePrice: 1000,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(resultB1.success).toBe(true);
    expect(resultB1.nextState.transactions[0].warrantyDaysAtSale).toBe(30);
  });

  it('preserves sale transaction warranty when build default warranty is later changed', () => {
    const state = getMockState();
    const soldResult = handleSellBuild(state, 'b2', {
      salePrice: 1500,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      warrantyDaysAtSale: 60,
    });
    expect(soldResult.success).toBe(true);
    const soldState = soldResult.nextState;
    expect(soldState.transactions[0].warrantyDaysAtSale).toBe(60);

    // Later change to the build
    const updatedState = handleUpdateBuild(soldState, 'b2', { warrantyDays: 365 });
    // Transaction snapshot must still be 60
    expect(updatedState.transactions[0].warrantyDaysAtSale).toBe(60);
    // Build itself was updated to 365
    expect(updatedState.builds.find(b => b.id === 'b2')?.warrantyDays).toBe(365);
  });

  it('Existing sale warranty snapshots remain unchanged when updating build warranty', () => {
    const state: AppState = {
      ...getMockState(),
      builds: [
        { id: 'b-sold-1', name: 'Alpha Rig', parts: [], status: 'Sold', warrantyDays: 30, saleTransactionId: 'tx-alpha', createdDate: '2026-07-23' }
      ],
      transactions: [
        {
          id: 'tx-alpha',
          type: 'SALE',
          title: 'PC Sold: Alpha Rig',
          itemNameOrSummary: 'Alpha Rig',
          timestamp: '2026-07-23',
          dateSortable: '2026-07-23',
          itemCount: 1,
          quantity: 1,
          totalAmount: 1200,
          profitMargin: 250,
          relatedComponentId: 'b-sold-1',
          warrantyDaysAtSale: 45 // Historical sale promise
        }
      ]
    };

    // Build warranty is changed via Copy Ad or edit
    const updatedState = handleUpdateBuild(state, 'b-sold-1', { warrantyDays: 90 });
    expect(updatedState.builds.find(b => b.id === 'b-sold-1')?.warrantyDays).toBe(90);
    // Transaction snapshot must remain untouched at 45
    expect(updatedState.transactions.find(tx => tx.id === 'tx-alpha')?.warrantyDaysAtSale).toBe(45);
  });

  it('returns previous state reference on semantic no-op in handleUpdateBuild', () => {
    const state = getMockState();
    // Same warrantyDays
    const next1 = handleUpdateBuild(state, 'b2', { warrantyDays: 60 });
    expect(next1).toBe(state);

    // Same name
    const next2 = handleUpdateBuild(state, 'b2', { name: 'Valid' });
    expect(next2).toBe(state);

    // Only status (ignored)
    const next3 = handleUpdateBuild(state, 'b2', { status: 'Sold' as any });
    expect(next3).toBe(state);

    // Missing build
    const next4 = handleUpdateBuild(state, 'non-existent', { name: 'New' });
    expect(next4).toBe(state);
  });

  it('simulates context: invalid and no-op build actions create no Undo history', () => {
    let currentState = getMockState();
    const history: string[] = [];
    const saveStateToHistory = (label: string) => history.push(label);
    const setState = (next: AppState) => { currentState = next; };

    const addBuild = (build: any) => {
      const current = currentState;
      const nextState = handleAddBuild(current, build);
      if (nextState !== current) {
        saveStateToHistory(`Create build: ${build.name || 'PC Build'}`);
        setState(nextState);
      }
    };

    const updateBuild = (buildId: string, updates: any) => {
      const current = currentState;
      const build = current.builds.find(b => b.id === buildId);
      if (!build) return;
      const { status: _ignoredStatus, ...validUpdates } = updates;
      if (Object.keys(validUpdates).length === 0) return;
      const nextState = handleUpdateBuild(current, buildId, updates);
      if (nextState !== current) {
        const buildName = validUpdates.name || build.name;
        saveStateToHistory(`Edit build: ${buildName}`);
        setState(nextState);
      }
    };

    // 1. Invalid addBuild (negative warranty) -> no history, no state change
    addBuild({ name: 'Bad Rig', parts: [], status: 'Listed for Sale', warrantyDays: -10 });
    expect(history.length).toBe(0);

    // 2. Missing build updateBuild -> no history, no state change
    updateBuild('missing-id', { name: 'Ghost' });
    expect(history.length).toBe(0);

    // 3. Invalid updateBuild (invalid warranty) -> no history, no state change
    updateBuild('b2', { warrantyDays: -5 });
    expect(history.length).toBe(0);

    // 4. Semantic no-op updateBuild (same value) -> no history, no state change
    updateBuild('b2', { warrantyDays: 60 });
    expect(history.length).toBe(0);

    // 5. Valid addBuild -> creates history with preserved label
    addBuild({ name: 'Good Rig', parts: [], status: 'Listed for Sale', warrantyDays: 45 });
    expect(history).toEqual(['Create build: Good Rig']);

    // 6. Valid updateBuild -> creates history with preserved label
    updateBuild('b2', { name: 'Renamed Valid Rig' });
    expect(history).toEqual(['Create build: Good Rig', 'Edit build: Renamed Valid Rig']);
  });

  it('resolves invalid legacy build warranty to 30 days in handleSellBuild', () => {
    const state: AppState = {
      ...getMockState(),
      builds: [
        { id: 'b-invalid-w', name: 'Corrupt', parts: [], status: 'Listed for Sale', warrantyDays: -99 as any, createdDate: '2026-07-23' }
      ]
    };
    const res = handleSellBuild(state, 'b-invalid-w', {
      salePrice: 1200,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(res.success).toBe(true);
    expect(res.nextState.transactions[0].warrantyDaysAtSale).toBe(30);
  });

  it('resolves invalid legacy transaction warranty to 30 days when editing sold build', () => {
    const state: AppState = {
      ...getMockState(),
      builds: [
        { id: 'b-sold', name: 'Sold Rig', parts: [], status: 'Sold', saleTransactionId: 'tx-legacy', createdDate: '2026-07-23' }
      ],
      transactions: [
        {
          id: 'tx-legacy',
          type: 'SALE',
          title: 'PC Sold: Sold Rig',
          itemNameOrSummary: 'Sold Rig',
          timestamp: '2026-07-23',
          dateSortable: '2026-07-23',
          itemCount: 1,
          quantity: 1,
          totalAmount: 1000,
          profitMargin: 200,
          relatedComponentId: 'b-sold',
          warrantyDaysAtSale: -50 as any
        }
      ]
    };

    const res = handleSellBuild(state, 'b-sold', {
      salePrice: 1100,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(res.success).toBe(true);
    expect(res.nextState.transactions[0].warrantyDaysAtSale).toBe(30);
  });

  it('preserves valid existing sale snapshot when editing sold build unless explicitly edited', () => {
    const state: AppState = {
      ...getMockState(),
      builds: [
        { id: 'b-sold', name: 'Sold Rig', parts: [], status: 'Sold', saleTransactionId: 'tx-valid', warrantyDays: 30, createdDate: '2026-07-23' }
      ],
      transactions: [
        {
          id: 'tx-valid',
          type: 'SALE',
          title: 'PC Sold: Sold Rig',
          itemNameOrSummary: 'Sold Rig',
          timestamp: '2026-07-23',
          dateSortable: '2026-07-23',
          itemCount: 1,
          quantity: 1,
          totalAmount: 1000,
          profitMargin: 200,
          relatedComponentId: 'b-sold',
          warrantyDaysAtSale: 90
        }
      ]
    };

    // Edit price without specifying warrantyDaysAtSale -> snapshot remains 90
    const res1 = handleSellBuild(state, 'b-sold', {
      salePrice: 1200,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(res1.success).toBe(true);
    expect(res1.nextState.transactions[0].warrantyDaysAtSale).toBe(90);

    // Explicitly edit warrantyDaysAtSale to 180 -> snapshot updates to 180
    const res2 = handleSellBuild(state, 'b-sold', {
      salePrice: 1200,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      warrantyDaysAtSale: 180,
    });
    expect(res2.success).toBe(true);
    expect(res2.nextState.transactions[0].warrantyDaysAtSale).toBe(180);

    // Explicitly edit warrantyDaysAtSale with invalid value -> rejects and returns original state reference
    const res3 = handleSellBuild(state, 'b-sold', {
      salePrice: 1200,
      saleDate: '2026-07-23',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      warrantyDaysAtSale: -10,
    });
    expect(res3.success).toBe(false);
    expect(res3.nextState).toBe(state);
  });
});

describe('handleAllocatePartToBuild validation and integrity', () => {
  const getTestState = (): AppState => ({
    components: [
      {
        id: 'c1',
        name: 'NVIDIA RTX 4070',
        category: 'GPU',
        specifications: '12GB GDDR6X',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe1',
            date: '2026-08-01',
            condition: 'Used',
            quantity: 3,
            unitPrice: 500,
            totalPrice: 1500,
            paymentMethod: 'Cash',
            platform: 'Facebook',
          },
        ],
      },
    ],
    builds: [
      {
        id: 'b-active',
        name: 'Gaming Rig',
        parts: [],
        status: 'In Progress',
        createdDate: '2026-08-01',
      },
      {
        id: 'b-sold',
        name: 'Sold Rig',
        parts: [],
        status: 'Sold',
        createdDate: '2026-08-01',
      },
      {
        id: 'b-tradein',
        name: 'Trade-In PC',
        parts: [],
        status: 'Trade-In Processing',
        createdDate: '2026-08-01',
      },
    ],
    transactions: [],
    monthlyGoal: 1000,
  });

  it('rejects NaN quantity and preserves original state reference', () => {
    const state = getTestState();
    const res = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', NaN);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(res.nextState).toBe(state);
  });

  it('rejects Infinity and -Infinity quantities and preserves original state reference', () => {
    const state = getTestState();
    const res1 = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', Infinity);
    expect(res1.success).toBe(false);
    expect(res1.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(res1.nextState).toBe(state);

    const res2 = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', -Infinity);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(res2.nextState).toBe(state);
  });

  it('rejects zero and negative quantities and preserves original state reference', () => {
    const state = getTestState();
    const resZero = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 0);
    expect(resZero.success).toBe(false);
    expect(resZero.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(resZero.nextState).toBe(state);

    const resNeg = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', -2);
    expect(resNeg.success).toBe(false);
    expect(resNeg.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(resNeg.nextState).toBe(state);
  });

  it('rejects fractional quantities and preserves original state reference', () => {
    const state = getTestState();
    const resFraction = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 1.5);
    expect(resFraction.success).toBe(false);
    expect(resFraction.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(resFraction.nextState).toBe(state);

    const resFractionSmall = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 0.99);
    expect(resFractionSmall.success).toBe(false);
    expect(resFractionSmall.error).toBe('Allocation quantity must be a finite positive whole number.');
    expect(resFractionSmall.nextState).toBe(state);
  });

  it('rejects requests exceeding exact batch availability rather than clamping', () => {
    const state = getTestState(); // pe1 has quantity: 3
    const res = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 5);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Requested quantity (5) exceeds available batch stock (3).');
    expect(res.nextState).toBe(state);
  });

  it('rejects missing build, component, and purchase entry IDs and preserves original state reference', () => {
    const state = getTestState();

    const resMissingBuild = handleAllocatePartToBuild(state, 'non-existent-build', 'c1', 'pe1', 1);
    expect(resMissingBuild.success).toBe(false);
    expect(resMissingBuild.error).toBe('Target build not found.');
    expect(resMissingBuild.nextState).toBe(state);

    const resMissingComp = handleAllocatePartToBuild(state, 'b-active', 'non-existent-comp', 'pe1', 1);
    expect(resMissingComp.success).toBe(false);
    expect(resMissingComp.error).toBe('Component not found.');
    expect(resMissingComp.nextState).toBe(state);

    const resMissingEntry = handleAllocatePartToBuild(state, 'b-active', 'c1', 'non-existent-entry', 1);
    expect(resMissingEntry.success).toBe(false);
    expect(resMissingEntry.error).toBe('Purchase entry not found in component.');
    expect(resMissingEntry.nextState).toBe(state);
  });

  it('rejects allocation to a Sold build and preserves original state reference', () => {
    const state = getTestState();
    const res = handleAllocatePartToBuild(state, 'b-sold', 'c1', 'pe1', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot allocate parts to a sold build.');
    expect(res.nextState).toBe(state);
  });

  it('supports allocation to a Trade-In Processing build', () => {
    const state = getTestState();
    const res = handleAllocatePartToBuild(state, 'b-tradein', 'c1', 'pe1', 1);
    expect(res.success).toBe(true);
    expect(res.nextState).not.toBe(state);

    const tradeInBuild = res.nextState.builds.find((b) => b.id === 'b-tradein');
    expect(tradeInBuild?.parts.length).toBe(1);
    expect(tradeInBuild?.parts[0].componentId).toBe('c1');
    expect(tradeInBuild?.parts[0].purchaseEntryId).toBe('pe1');
    expect(tradeInBuild?.parts[0].quantity).toBe(1);
    expect(tradeInBuild?.parts[0].unitCostAtAssignment).toBe(500);
  });

  it('rejects invalid purchase-entry quantity or unit price and preserves original state reference', () => {
    const state = getTestState();

    // Invalid batch quantity (0, negative, non-integer, NaN)
    const stateZeroBatchQty: AppState = {
      ...state,
      components: [
        {
          ...state.components[0],
          purchaseHistory: [{ ...state.components[0].purchaseHistory[0], quantity: 0 }],
        },
      ],
    };
    const resZeroQty = handleAllocatePartToBuild(stateZeroBatchQty, 'b-active', 'c1', 'pe1', 1);
    expect(resZeroQty.success).toBe(false);
    expect(resZeroQty.error).toBe('Purchase entry quantity must be a finite positive whole number.');
    expect(resZeroQty.nextState).toBe(stateZeroBatchQty);

    const stateNegBatchQty: AppState = {
      ...state,
      components: [
        {
          ...state.components[0],
          purchaseHistory: [{ ...state.components[0].purchaseHistory[0], quantity: -5 }],
        },
      ],
    };
    const resNegQty = handleAllocatePartToBuild(stateNegBatchQty, 'b-active', 'c1', 'pe1', 1);
    expect(resNegQty.success).toBe(false);
    expect(resNegQty.error).toBe('Purchase entry quantity must be a finite positive whole number.');
    expect(resNegQty.nextState).toBe(stateNegBatchQty);

    // Invalid batch unitPrice (negative, NaN)
    const stateNegBatchPrice: AppState = {
      ...state,
      components: [
        {
          ...state.components[0],
          purchaseHistory: [{ ...state.components[0].purchaseHistory[0], unitPrice: -20 }],
        },
      ],
    };
    const resNegPrice = handleAllocatePartToBuild(stateNegBatchPrice, 'b-active', 'c1', 'pe1', 1);
    expect(resNegPrice.success).toBe(false);
    expect(resNegPrice.error).toBe('Purchase entry unit price must be a finite non-negative number.');
    expect(resNegPrice.nextState).toBe(stateNegBatchPrice);

    const stateNaNBatchPrice: AppState = {
      ...state,
      components: [
        {
          ...state.components[0],
          purchaseHistory: [{ ...state.components[0].purchaseHistory[0], unitPrice: NaN }],
        },
      ],
    };
    const resNaNPrice = handleAllocatePartToBuild(stateNaNBatchPrice, 'b-active', 'c1', 'pe1', 1);
    expect(resNaNPrice.success).toBe(false);
    expect(resNaNPrice.error).toBe('Purchase entry unit price must be a finite non-negative number.');
    expect(resNaNPrice.nextState).toBe(stateNaNBatchPrice);
  });

  it('rejects allocation when existing build part has invalid stored quantity or unit cost', () => {
    const state: AppState = {
      ...getTestState(),
      builds: [
        {
          id: 'b-active',
          name: 'Gaming Rig',
          parts: [
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              purchaseEntryId: 'pe1',
              category: 'GPU',
              quantity: -1 as any,
              unitCostAtAssignment: 500,
            },
          ],
          status: 'In Progress',
          createdDate: '2026-08-01',
        },
      ],
    };

    const res = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Existing build part has invalid stored quantity or unit cost.');
    expect(res.nextState).toBe(state);
  });

  it('valid exact allocation succeeds, merges matching existing lines, and preserves exact IDs and cost', () => {
    const state = getTestState();
    const res1 = handleAllocatePartToBuild(state, 'b-active', 'c1', 'pe1', 2);
    expect(res1.success).toBe(true);
    expect(res1.nextState).not.toBe(state);

    const activeBuild = res1.nextState.builds.find((b) => b.id === 'b-active')!;
    expect(activeBuild.parts.length).toBe(1);
    expect(activeBuild.parts[0].componentId).toBe('c1');
    expect(activeBuild.parts[0].purchaseEntryId).toBe('pe1');
    expect(activeBuild.parts[0].quantity).toBe(2);
    expect(activeBuild.parts[0].unitCostAtAssignment).toBe(500);

    const compAfter1 = res1.nextState.components.find((c) => c.id === 'c1')!;
    expect(compAfter1.assignedCount).toBe(2);

    // Now allocate remaining 1 unit from same batch -> should merge into existing line
    const res2 = handleAllocatePartToBuild(res1.nextState, 'b-active', 'c1', 'pe1', 1);
    expect(res2.success).toBe(true);
    const activeBuild2 = res2.nextState.builds.find((b) => b.id === 'b-active')!;
    expect(activeBuild2.parts.length).toBe(1);
    expect(activeBuild2.parts[0].quantity).toBe(3);
    expect(activeBuild2.parts[0].unitCostAtAssignment).toBe(500);
    expect(activeBuild2.parts[0].purchaseEntryId).toBe('pe1');

    const compAfter2 = res2.nextState.components.find((c) => c.id === 'c1')!;
    expect(compAfter2.assignedCount).toBe(3);

    // Attempting to allocate 1 more unit should be rejected because all 3 are allocated
    const res3 = handleAllocatePartToBuild(res2.nextState, 'b-active', 'c1', 'pe1', 1);
    expect(res3.success).toBe(false);
    expect(res3.error).toBe('Requested quantity (1) exceeds available batch stock (0).');
    expect(res3.nextState).toBe(res2.nextState);
  });

  it('simulates context: rejected allocations cannot produce an Undo history entry', () => {
    let currentState = getTestState();
    const history: string[] = [];
    const saveStateToHistory = (label: string) => history.push(label);
    const setState = (next: AppState) => {
      currentState = next;
    };

    const allocatePartToBuild = (
      buildId: string,
      componentId: string,
      purchaseEntryId: string,
      quantity: number
    ) => {
      const current = currentState;
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
    };

    // 1. Rejected: NaN quantity -> no history
    const res1 = allocatePartToBuild('b-active', 'c1', 'pe1', NaN);
    expect(res1.success).toBe(false);
    expect(history.length).toBe(0);

    // 2. Rejected: Excessive quantity -> no history
    const res2 = allocatePartToBuild('b-active', 'c1', 'pe1', 10);
    expect(res2.success).toBe(false);
    expect(history.length).toBe(0);

    // 3. Rejected: Sold build -> no history
    const res3 = allocatePartToBuild('b-sold', 'c1', 'pe1', 1);
    expect(res3.success).toBe(false);
    expect(history.length).toBe(0);

    // 4. Rejected: Negative quantity -> no history
    const res4 = allocatePartToBuild('b-active', 'c1', 'pe1', -1);
    expect(res4.success).toBe(false);
    expect(history.length).toBe(0);

    // 5. Successful allocation -> produces exactly 1 history entry and mutates state
    const resSuccess = allocatePartToBuild('b-active', 'c1', 'pe1', 2);
    expect(resSuccess.success).toBe(true);
    expect(history.length).toBe(1);
    expect(history[0]).toBe('Allocate part: NVIDIA RTX 4070 → Gaming Rig');
    expect(currentState.builds.find((b) => b.id === 'b-active')?.parts[0].quantity).toBe(2);
  });
});

describe('handleRemovePartFromBuild validation and integrity', () => {
  const getTestState = (): AppState => ({
    components: [
      {
        id: 'c1',
        name: 'NVIDIA RTX 4070',
        category: 'GPU',
        specifications: '12GB GDDR6X',
        assignedCount: 2,
        purchaseHistory: [
          {
            id: 'pe1',
            date: '2026-08-01',
            condition: 'Used',
            quantity: 3,
            unitPrice: 500,
            totalPrice: 1500,
            paymentMethod: 'Cash',
            platform: 'Facebook',
          },
        ],
      },
      {
        id: 'c2',
        name: 'Intel Core i5-13600K',
        category: 'CPU',
        specifications: '14 cores',
        assignedCount: 1,
        purchaseHistory: [
          {
            id: 'pe2',
            date: '2026-08-01',
            condition: 'Sealed',
            quantity: 2,
            unitPrice: 200,
            totalPrice: 400,
            paymentMethod: 'Cash',
            platform: 'eBay',
          },
        ],
      },
    ],
    builds: [
      {
        id: 'b-active',
        name: 'Gaming Rig',
        parts: [
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            purchaseEntryId: 'pe1',
            category: 'GPU',
            quantity: 2,
            unitCostAtAssignment: 500,
          },
          {
            componentId: 'c2',
            componentName: 'Intel Core i5-13600K',
            purchaseEntryId: 'pe2',
            category: 'CPU',
            quantity: 1,
            unitCostAtAssignment: 200,
          },
        ],
        status: 'In Progress',
        createdDate: '2026-08-01',
      },
      {
        id: 'b-sold',
        name: 'Sold Rig',
        parts: [
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            purchaseEntryId: 'pe1',
            category: 'GPU',
            quantity: 1,
            unitCostAtAssignment: 500,
          },
        ],
        status: 'Sold',
        createdDate: '2026-08-01',
      },
      {
        id: 'b-legacy',
        name: 'Legacy Rig',
        parts: [
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            category: 'GPU',
            quantity: 1,
            unitCostAtAssignment: 500,
          },
        ],
        status: 'In Progress',
        createdDate: '2026-08-01',
      },
      {
        id: 'b-ambiguous',
        name: 'Ambiguous Rig',
        parts: [
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            purchaseEntryId: 'pe1',
            category: 'GPU',
            quantity: 1,
            unitCostAtAssignment: 500,
          },
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            purchaseEntryId: 'pe1',
            category: 'GPU',
            quantity: 1,
            unitCostAtAssignment: 500,
          },
        ],
        status: 'In Progress',
        createdDate: '2026-08-01',
      },
    ],
    transactions: [],
    monthlyGoal: 1000,
  });

  it('rejects a missing build and preserves original state reference', () => {
    const state = getTestState();
    const res = handleRemovePartFromBuild(state, 'non-existent-build', 'c1', 'pe1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Target build not found.');
    expect(res.nextState).toBe(state);
  });

  it('rejects removal from a Sold build and preserves original state reference', () => {
    const state = getTestState();
    const res = handleRemovePartFromBuild(state, 'b-sold', 'c1', 'pe1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot remove parts from a sold build.');
    expect(res.nextState).toBe(state);
  });

  it('rejects a missing allocation and preserves original state reference', () => {
    const state = getTestState();
    // Missing batch ID
    const res1 = handleRemovePartFromBuild(state, 'b-active', 'c1', 'pe-non-existent');
    expect(res1.success).toBe(false);
    expect(res1.error).toBe('Allocated part not found in build.');
    expect(res1.nextState).toBe(state);

    // Component not present in build
    const res2 = handleRemovePartFromBuild(state, 'b-legacy', 'c2', 'pe2');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Allocated part not found in build.');
    expect(res2.nextState).toBe(state);
  });

  it('rejects ambiguous allocations rather than guessing', () => {
    const state = getTestState();
    const res = handleRemovePartFromBuild(state, 'b-ambiguous', 'c1', 'pe1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Ambiguous allocation: multiple matching parts found.');
    expect(res.nextState).toBe(state);

    // Also verify ambiguous legacy allocations (two unlinked parts with same componentId)
    const stateWithAmbiguousLegacy: AppState = {
      ...state,
      builds: [
        {
          id: 'b-ambig-legacy',
          name: 'Ambig Legacy',
          parts: [
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
          ],
          status: 'In Progress',
          createdDate: '2026-08-01',
        },
      ],
    };
    const resLegacyAmbig = handleRemovePartFromBuild(
      stateWithAmbiguousLegacy,
      'b-ambig-legacy',
      'c1',
      undefined
    );
    expect(resLegacyAmbig.success).toBe(false);
    expect(resLegacyAmbig.error).toBe('Ambiguous allocation: multiple matching parts found.');
    expect(resLegacyAmbig.nextState).toBe(stateWithAmbiguousLegacy);
  });

  it('rejects when related component does not exist in inventory', () => {
    const state = getTestState();
    const stateWithGhostPart: AppState = {
      ...state,
      builds: [
        {
          ...state.builds[0],
          parts: [
            {
              componentId: 'c-ghost',
              componentName: 'Ghost Component',
              purchaseEntryId: 'pe1',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
          ],
        },
      ],
    };
    const res = handleRemovePartFromBuild(stateWithGhostPart, 'b-active', 'c-ghost', 'pe1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Component not found.');
    expect(res.nextState).toBe(stateWithGhostPart);
  });

  it('rejects NaN, Infinity, zero, negative, and fractional stored allocation quantities', () => {
    const state = getTestState();

    const invalidQuantities = [NaN, Infinity, -Infinity, 0, -1, 1.5, 0.5];

    for (const q of invalidQuantities) {
      const corruptState: AppState = {
        ...state,
        builds: [
          {
            ...state.builds[0],
            parts: [
              {
                ...state.builds[0].parts[0],
                quantity: q as any,
              },
            ],
          },
        ],
      };

      const res = handleRemovePartFromBuild(corruptState, 'b-active', 'c1', 'pe1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Stored build part quantity must be a finite positive whole number.');
      expect(res.nextState).toBe(corruptState);
    }
  });

  it('rejects NaN, Infinity, and negative stored unit costs', () => {
    const state = getTestState();

    const invalidCosts = [NaN, Infinity, -Infinity, -10, -0.01];

    for (const c of invalidCosts) {
      const corruptState: AppState = {
        ...state,
        builds: [
          {
            ...state.builds[0],
            parts: [
              {
                ...state.builds[0].parts[0],
                unitCostAtAssignment: c as any,
              },
            ],
          },
        ],
      };

      const res = handleRemovePartFromBuild(corruptState, 'b-active', 'c1', 'pe1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Stored build part unit cost must be a finite non-negative number.');
      expect(res.nextState).toBe(corruptState);
    }
  });

  it('rejects invalid assignedCount values without modifying state', () => {
    const state = getTestState();

    const invalidCounts = [NaN, Infinity, -Infinity, -1, 1.5, 'two' as any];

    for (const count of invalidCounts) {
      const corruptState: AppState = {
        ...state,
        components: [
          {
            ...state.components[0],
            assignedCount: count,
          },
          state.components[1],
        ],
      };

      const res = handleRemovePartFromBuild(corruptState, 'b-active', 'c1', 'pe1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Component assigned count must be a finite non-negative whole number.');
      expect(res.nextState).toBe(corruptState);
    }
  });

  it('removes a valid exact linked allocation successfully, updates assignedCount, and leaves other allocations untouched', () => {
    const state = getTestState();
    const originalStateJson = JSON.stringify(state);

    const res = handleRemovePartFromBuild(state, 'b-active', 'c1', 'pe1');
    expect(res.success).toBe(true);
    expect(res.nextState).not.toBe(state);

    // Active build should now only have part 2 (Intel Core i5)
    const activeBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
    expect(activeBuild.parts.length).toBe(1);
    expect(activeBuild.parts[0].componentId).toBe('c2');
    expect(activeBuild.parts[0].purchaseEntryId).toBe('pe2');
    expect(activeBuild.parts[0].quantity).toBe(1);
    expect(activeBuild.parts[0].unitCostAtAssignment).toBe(200);

    // Component c1 assignedCount was 2, quantity removed was 2 -> 0
    const compC1 = res.nextState.components.find((c) => c.id === 'c1')!;
    expect(compC1.assignedCount).toBe(0);

    // Component c2 was untouched
    const compC2 = res.nextState.components.find((c) => c.id === 'c2')!;
    expect(compC2.assignedCount).toBe(1);

    // Other builds untouched
    const soldBuild = res.nextState.builds.find((b) => b.id === 'b-sold')!;
    expect(soldBuild.parts.length).toBe(1);

    // Purchase histories remain byte-for-byte unchanged
    expect(JSON.stringify(res.nextState.components[0].purchaseHistory)).toBe(
      JSON.stringify(state.components[0].purchaseHistory)
    );
    expect(JSON.stringify(res.nextState.components[1].purchaseHistory)).toBe(
      JSON.stringify(state.components[1].purchaseHistory)
    );

    // Original state reference was not mutated
    expect(JSON.stringify(state)).toBe(originalStateJson);
  });

  it('removes a valid unique legacy allocation without purchaseEntryId successfully', () => {
    const state = getTestState();

    // In b-legacy, part has componentId: 'c1' and no purchaseEntryId
    const res = handleRemovePartFromBuild(state, 'b-legacy', 'c1', undefined);
    expect(res.success).toBe(true);
    expect(res.nextState).not.toBe(state);

    const legacyBuild = res.nextState.builds.find((b) => b.id === 'b-legacy')!;
    expect(legacyBuild.parts.length).toBe(0);

    const compC1 = res.nextState.components.find((c) => c.id === 'c1')!;
    // assignedCount was 2, removed 1 -> 1
    expect(compC1.assignedCount).toBe(1);

    // Also test compatibility when component assignedCount is undefined
    const stateWithUndefAssigned: AppState = {
      ...state,
      components: [
        {
          ...state.components[0],
          assignedCount: undefined,
        },
        state.components[1],
      ],
    };
    const resUndef = handleRemovePartFromBuild(stateWithUndefAssigned, 'b-legacy', 'c1', undefined);
    expect(resUndef.success).toBe(true);
    const compUndef = resUndef.nextState.components.find((c) => c.id === 'c1')!;
    expect(compUndef.assignedCount).toBe(0);
  });

  it('simulates context: rejected removal operations cannot create Undo history, and a successful removal creates exactly one', () => {
    let currentState = getTestState();
    const history: string[] = [];
    const saveStateToHistory = (label: string) => history.push(label);
    const setState = (next: AppState) => {
      currentState = next;
    };

    const removePartFromBuild = (
      buildId: string,
      componentId: string,
      purchaseEntryId?: string
    ) => {
      const current = currentState;
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
    };

    // 1. Rejected: Missing build -> no history
    const res1 = removePartFromBuild('non-existent', 'c1', 'pe1');
    expect(res1.success).toBe(false);
    expect(history.length).toBe(0);

    // 2. Rejected: Sold build -> no history
    const res2 = removePartFromBuild('b-sold', 'c1', 'pe1');
    expect(res2.success).toBe(false);
    expect(history.length).toBe(0);

    // 3. Rejected: Missing allocation -> no history
    const res3 = removePartFromBuild('b-active', 'c1', 'pe-missing');
    expect(res3.success).toBe(false);
    expect(history.length).toBe(0);

    // 4. Rejected: Ambiguous allocation -> no history
    const res4 = removePartFromBuild('b-ambiguous', 'c1', 'pe1');
    expect(res4.success).toBe(false);
    expect(history.length).toBe(0);

    // 5. Successful removal -> produces exactly 1 history entry and mutates state
    const resSuccess = removePartFromBuild('b-active', 'c1', 'pe1');
    expect(resSuccess.success).toBe(true);
    expect(history.length).toBe(1);
    expect(history[0]).toBe('Remove part: NVIDIA RTX 4070 ← Gaming Rig');
    expect(currentState.builds.find((b) => b.id === 'b-active')?.parts.length).toBe(1);
  });
});

describe('handleSwapPartInBuild validation and integrity', () => {
  const getTestState = (): AppState => ({
    components: [
      {
        id: 'c1',
        name: 'NVIDIA RTX 4070',
        category: 'GPU',
        specifications: '12GB GDDR6X',
        assignedCount: 1,
        purchaseHistory: [
          {
            id: 'pe1',
            date: '2026-07-01',
            condition: 'Used',
            quantity: 5,
            unitPrice: 500,
            totalPrice: 2500,
            paymentMethod: 'Cash',
            platform: 'Local',
          },
          {
            id: 'pe2',
            date: '2026-07-15',
            condition: 'Sealed',
            quantity: 5,
            unitPrice: 600,
            totalPrice: 3000,
            paymentMethod: 'Credit Card',
            platform: 'Store',
          },
        ],
      },
      {
        id: 'c2',
        name: 'AMD RX 7800 XT',
        category: 'GPU',
        specifications: '16GB GDDR6',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe3',
            date: '2026-07-10',
            condition: 'Used',
            quantity: 2,
            unitPrice: 450,
            totalPrice: 900,
            paymentMethod: 'Cash',
            platform: 'Local',
          },
        ],
      },
      {
        id: 'c3',
        name: 'AMD Ryzen 7 7800X3D',
        category: 'CPU',
        specifications: '8-Core 16-Thread',
        assignedCount: 1,
        purchaseHistory: [
          {
            id: 'pe4',
            date: '2026-07-05',
            condition: 'Sealed',
            quantity: 1,
            unitPrice: 350,
            totalPrice: 350,
            paymentMethod: 'Credit Card',
            platform: 'Store',
          },
        ],
      },
    ],
    builds: [
      {
        id: 'b-active',
        name: 'Gaming Rig',
        status: 'In Progress',
        createdDate: '2026-07-20',
        parts: [
          {
            componentId: 'c1',
            componentName: 'NVIDIA RTX 4070',
            purchaseEntryId: 'pe1',
            category: 'GPU',
            quantity: 1,
            unitCostAtAssignment: 500,
          },
          {
            componentId: 'c3',
            componentName: 'AMD Ryzen 7 7800X3D',
            purchaseEntryId: 'pe4',
            category: 'CPU',
            quantity: 1,
            unitCostAtAssignment: 350,
          },
        ],
      },
      {
        id: 'b-sold',
        name: 'Sold PC',
        status: 'Sold',
        createdDate: '2026-07-15',
        parts: [
          {
            componentId: 'c3',
            componentName: 'AMD Ryzen 7 7800X3D',
            purchaseEntryId: 'pe4',
            category: 'CPU',
            quantity: 1,
            unitCostAtAssignment: 350,
          },
        ],
      },
    ],
    transactions: [
      {
        id: 't1',
        type: 'PURCHASE',
        title: 'GPU Purchase',
        itemNameOrSummary: 'NVIDIA RTX 4070',
        timestamp: '2026-07-01',
        dateSortable: '2026-07-01',
        itemCount: 1,
        quantity: 1,
        totalAmount: 500,
      },
    ],
    monthlyGoal: 1000,
  });

  it('rejects invalid quantities (<=0, NaN, Infinity, floats)', () => {
    const state = getTestState();
    const badQuantities = [0, -1, NaN, Infinity, -Infinity, 1.5];
    for (const qty of badQuantities) {
      const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c2', 'pe3', qty);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Quantity must be a positive whole number.');
      expect(res.nextState).toBe(state);
    }
  });

  it('rejects non-existent target build', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'non-existent-build', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Target build not found.');
    expect(res.nextState).toBe(state);
  });

  it('rejects Sold target build', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-sold', 'c3', 'pe4', 'c2', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot swap parts in a sold build.');
    expect(res.nextState).toBe(state);
  });

  it('rejects non-existent outgoing allocation', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe-missing', 'c2', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Allocated part not found in build.');
    expect(res.nextState).toBe(state);
  });

  it('rejects ambiguous outgoing allocation', () => {
    const state = getTestState();
    const stateWithAmbiguous: AppState = {
      ...state,
      builds: [
        ...state.builds,
        {
          id: 'b-ambiguous',
          name: 'Ambiguous Build',
          status: 'In Progress',
          createdDate: '2026-07-20',
          parts: [
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              purchaseEntryId: 'pe1',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              purchaseEntryId: 'pe1',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
          ],
        },
      ],
    };
    const res = handleSwapPartInBuild(stateWithAmbiguous, 'b-ambiguous', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Ambiguous allocation: multiple matching parts found.');
    expect(res.nextState).toBe(stateWithAmbiguous);
  });

  it('rejects non-existent outgoing component', () => {
    const state = getTestState();
    const stateMissingComp: AppState = {
      ...state,
      components: state.components.filter((c) => c.id !== 'c1'),
    };
    const res = handleSwapPartInBuild(stateMissingComp, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Original component not found in inventory.');
    expect(res.nextState).toBe(stateMissingComp);
  });

  it('rejects invalid outgoing stored quantity or unit cost', () => {
    const state = getTestState();

    const badQtyBuilds = state.builds.map((b) =>
      b.id === 'b-active'
        ? {
            ...b,
            parts: b.parts.map((p) =>
              p.componentId === 'c1' ? { ...p, quantity: 0 } : p
            ),
          }
        : b
    );
    const resQty = handleSwapPartInBuild({ ...state, builds: badQtyBuilds }, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resQty.success).toBe(false);
    expect(resQty.error).toBe('Stored build part quantity must be a finite positive whole number.');

    const badCostBuilds = state.builds.map((b) =>
      b.id === 'b-active'
        ? {
            ...b,
            parts: b.parts.map((p) =>
              p.componentId === 'c1' ? { ...p, unitCostAtAssignment: -10 } : p
            ),
          }
        : b
    );
    const resCost = handleSwapPartInBuild({ ...state, builds: badCostBuilds }, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resCost.success).toBe(false);
    expect(resCost.error).toBe('Stored build part unit cost must be a finite non-negative number.');
  });

  it('rejects invalid outgoing or replacement assignedCount', () => {
    const state = getTestState();

    // Outgoing assignedCount negative
    const badOldCompState: AppState = {
      ...state,
      components: state.components.map((c) =>
        c.id === 'c1' ? { ...c, assignedCount: -1 } : c
      ),
    };
    const resOld = handleSwapPartInBuild(badOldCompState, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resOld.success).toBe(false);
    expect(resOld.error).toBe('Original component assigned count must be a finite non-negative whole number.');

    // Replacement assignedCount float
    const badNewCompState: AppState = {
      ...state,
      components: state.components.map((c) =>
        c.id === 'c2' ? { ...c, assignedCount: 1.5 } : c
      ),
    };
    const resNew = handleSwapPartInBuild(badNewCompState, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resNew.success).toBe(false);
    expect(resNew.error).toBe('Replacement component assigned count must be a finite non-negative whole number.');
  });

  it('rejects same component + same purchaseEntryId no-op', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c1', 'pe1', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot swap an allocation to the same component and purchase batch.');
    expect(res.nextState).toBe(state);
  });

  it('rejects non-existent replacement component', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c-missing', 'pe3', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Replacement component not found in inventory.');
    expect(res.nextState).toBe(state);
  });

  it('rejects replacement category mismatch', () => {
    const state = getTestState();
    // c1 is GPU, c3 is CPU
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c3', 'pe4', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Replacement component category does not match outgoing allocation category.');
    expect(res.nextState).toBe(state);
  });

  it('rejects non-existent replacement batch', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c2', 'pe-missing', 1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Selected replacement purchase batch not found.');
    expect(res.nextState).toBe(state);
  });

  it('rejects invalid replacement batch quantity or unit price', () => {
    const state = getTestState();

    const badBatchQtyState: AppState = {
      ...state,
      components: state.components.map((c) =>
        c.id === 'c2'
          ? {
              ...c,
              purchaseHistory: c.purchaseHistory.map((pe) =>
                pe.id === 'pe3' ? { ...pe, quantity: 0 } : pe
              ),
            }
          : c
      ),
    };
    const resQty = handleSwapPartInBuild(badBatchQtyState, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resQty.success).toBe(false);
    expect(resQty.error).toBe('Replacement purchase batch quantity must be a finite positive whole number.');

    const badBatchPriceState: AppState = {
      ...state,
      components: state.components.map((c) =>
        c.id === 'c2'
          ? {
              ...c,
              purchaseHistory: c.purchaseHistory.map((pe) =>
                pe.id === 'pe3' ? { ...pe, unitPrice: -50 } : pe
              ),
            }
          : c
      ),
    };
    const resPrice = handleSwapPartInBuild(badBatchPriceState, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resPrice.success).toBe(false);
    expect(resPrice.error).toBe('Replacement purchase batch unit price must be a finite non-negative number.');
  });

  it('rejects excessive replacement quantity when stock is insufficient', () => {
    const state = getTestState();
    // c2 pe3 has quantity 2, available 2. Request 5.
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 5);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Insufficient stock');
    expect(res.nextState).toBe(state);
  });

  it('releases outgoing allocation before checking replacement stock', () => {
    // Component cRel has 1 batch peRel with quantity: 1.
    // Build bRel has an unlinked legacy allocation of cRel (quantity: 1).
    // Because bRel holds the legacy allocation, peRel has 0 available quantity in this state!
    const stateWithLegacyHoldingBatch: AppState = {
      ...getTestState(),
      components: [
        {
          id: 'cRel',
          name: 'Test GPU',
          category: 'GPU',
          specifications: 'PCIe 4.0',
          assignedCount: 1,
          purchaseHistory: [
            {
              id: 'peRel',
              date: '2026-07-01',
              condition: 'Used',
              quantity: 1,
              unitPrice: 300,
              totalPrice: 300,
              paymentMethod: 'Cash',
              platform: 'Local',
            },
          ],
        },
      ],
      builds: [
        {
          id: 'bRel',
          name: 'Release Build',
          status: 'In Progress',
          createdDate: '2026-07-20',
          parts: [
            {
              componentId: 'cRel',
              componentName: 'Test GPU',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 300,
            },
          ],
        },
      ],
    };

    // Swap the legacy unlinked allocation in bRel to the exact batch peRel.
    // Because the outgoing allocation is released first, peRel has 1 unit available and the swap succeeds.
    const res = handleSwapPartInBuild(stateWithLegacyHoldingBatch, 'bRel', 'cRel', undefined, 'cRel', 'peRel', 1);
    expect(res.success).toBe(true);
    const updatedBuild = res.nextState.builds.find((b) => b.id === 'bRel')!;
    expect(updatedBuild.parts[0].purchaseEntryId).toBe('peRel');
    expect(updatedBuild.parts[0].quantity).toBe(1);
    expect(updatedBuild.parts[0].unitCostAtAssignment).toBe(300);
  });

  it('same component with a different valid batch succeeds', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c1', 'pe2', 1);
    expect(res.success).toBe(true);

    const updatedBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
    const gpuPart = updatedBuild.parts.find((p) => p.componentId === 'c1')!;
    expect(gpuPart.purchaseEntryId).toBe('pe2');
    expect(gpuPart.unitCostAtAssignment).toBe(600);
    expect(gpuPart.quantity).toBe(1);

    // assignedCount on c1 remains 1
    const c1 = res.nextState.components.find((c) => c.id === 'c1')!;
    expect(c1.assignedCount).toBe(1);
  });

  it('different component in the same category succeeds', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(true);

    const updatedBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
    expect(updatedBuild.parts.find((p) => p.componentId === 'c1')).toBeUndefined();

    const newPart = updatedBuild.parts.find((p) => p.componentId === 'c2')!;
    expect(newPart).toBeDefined();
    expect(newPart.componentName).toBe('AMD RX 7800 XT');
    expect(newPart.purchaseEntryId).toBe('pe3');
    expect(newPart.category).toBe('GPU');
    expect(newPart.quantity).toBe(1);
    expect(newPart.unitCostAtAssignment).toBe(450);

    // c1 assignedCount decremented from 1 to 0
    const c1 = res.nextState.components.find((c) => c.id === 'c1')!;
    expect(c1.assignedCount).toBe(0);

    // c2 assignedCount incremented from 0 to 1
    const c2 = res.nextState.components.find((c) => c.id === 'c2')!;
    expect(c2.assignedCount).toBe(1);
  });

  it('unique unlinked legacy allocation can be swapped', () => {
    const state = getTestState();
    const stateWithLegacy: AppState = {
      ...state,
      builds: [
        ...state.builds,
        {
          id: 'b-legacy',
          name: 'Legacy Build',
          status: 'In Progress',
          createdDate: '2026-07-20',
          parts: [
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
          ],
        },
      ],
      components: state.components.map((c) =>
        c.id === 'c1' ? { ...c, assignedCount: (c.assignedCount || 0) + 1 } : c
      ),
    };
    const res = handleSwapPartInBuild(stateWithLegacy, 'b-legacy', 'c1', undefined, 'c2', 'pe3', 1);
    expect(res.success).toBe(true);

    const updatedBuild = res.nextState.builds.find((b) => b.id === 'b-legacy')!;
    expect(updatedBuild.parts.find((p) => p.componentId === 'c1')).toBeUndefined();

    const newPart = updatedBuild.parts.find((p) => p.componentId === 'c2')!;
    expect(newPart.purchaseEntryId).toBe('pe3');
    expect(newPart.unitCostAtAssignment).toBe(450);

    const c1 = res.nextState.components.find((c) => c.id === 'c1')!;
    expect(c1.assignedCount).toBe(1);
  });

  it('unique allocation with a stale outgoing batch ID can be swapped without guessing a batch', () => {
    const state = getTestState();
    const stateWithStale: AppState = {
      ...state,
      builds: [
        ...state.builds,
        {
          id: 'b-stale',
          name: 'Stale Batch Build',
          status: 'In Progress',
          createdDate: '2026-07-20',
          parts: [
            {
              componentId: 'c1',
              componentName: 'NVIDIA RTX 4070',
              purchaseEntryId: 'pe-deleted',
              category: 'GPU',
              quantity: 1,
              unitCostAtAssignment: 500,
            },
          ],
        },
      ],
      components: state.components.map((c) =>
        c.id === 'c1' ? { ...c, assignedCount: (c.assignedCount || 0) + 1 } : c
      ),
    };
    const res = handleSwapPartInBuild(stateWithStale, 'b-stale', 'c1', 'pe-deleted', 'c2', 'pe3', 1);
    expect(res.success).toBe(true);

    const updatedBuild = res.nextState.builds.find((b) => b.id === 'b-stale')!;
    expect(updatedBuild.parts.find((p) => p.componentId === 'c1')).toBeUndefined();

    const newPart = updatedBuild.parts.find((p) => p.componentId === 'c2')!;
    expect(newPart.purchaseEntryId).toBe('pe3');
    expect(newPart.unitCostAtAssignment).toBe(450);

    // No new batches were added to c1
    const c1 = res.nextState.components.find((c) => c.id === 'c1')!;
    expect(c1.assignedCount).toBe(1);
    expect(c1.purchaseHistory.length).toBe(2);
  });

  it('merges identical allocated line if the replacement part already exists in the build with matching cost', () => {
    const state = getTestState();
    // b-active already has c1 pe1 ($500) and c3 pe4 ($350).
    // Add c2 pe3 ($450, qty 1) to b-active.
    const stateWithExistingPart: AppState = {
      ...state,
      builds: state.builds.map((b) =>
        b.id === 'b-active'
          ? {
              ...b,
              parts: [
                ...b.parts,
                {
                  componentId: 'c2',
                  componentName: 'AMD RX 7800 XT',
                  purchaseEntryId: 'pe3',
                  category: 'GPU',
                  quantity: 1,
                  unitCostAtAssignment: 450,
                },
              ],
            }
          : b
      ),
      components: state.components.map((c) =>
        c.id === 'c2' ? { ...c, assignedCount: 1 } : c
      ),
    };

    // Swap c1 pe1 with 1 more unit of c2 pe3
    const res = handleSwapPartInBuild(stateWithExistingPart, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(true);

    const updatedBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
    // c1 is gone
    expect(updatedBuild.parts.find((p) => p.componentId === 'c1')).toBeUndefined();

    // c2 should now have quantity 2 merged in 1 line
    const c2Parts = updatedBuild.parts.filter((p) => p.componentId === 'c2');
    expect(c2Parts.length).toBe(1);
    expect(c2Parts[0].quantity).toBe(2);
    expect(c2Parts[0].unitCostAtAssignment).toBe(450);

    const c2 = res.nextState.components.find((c) => c.id === 'c2')!;
    expect(c2.assignedCount).toBe(2);
  });

  it('preserves all unrelated builds, allocations, and transactions', () => {
    const state = getTestState();
    const res = handleSwapPartInBuild(state, 'b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res.success).toBe(true);

    // Unrelated builds untouched
    expect(res.nextState.builds.find((b) => b.id === 'b-sold')).toEqual(
      state.builds.find((b) => b.id === 'b-sold')
    );
    expect(res.nextState.builds.find((b) => b.id === 'b-legacy')).toEqual(
      state.builds.find((b) => b.id === 'b-legacy')
    );

    // Other parts in active build untouched
    const activeBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
    expect(activeBuild.parts.find((p) => p.componentId === 'c3')).toEqual(
      state.builds.find((b) => b.id === 'b-active')!.parts.find((p) => p.componentId === 'c3')
    );

    // Transactions untouched
    expect(res.nextState.transactions).toEqual(state.transactions);
  });

  it('simulates context: rejected operations produce no Undo history, and a successful swap produces exactly one', () => {
    let currentState = getTestState();
    const history: string[] = [];
    const saveStateToHistory = (label: string) => history.push(label);
    const setState = (next: AppState) => {
      currentState = next;
    };

    const swapPartInBuild = (
      buildId: string,
      oldComponentId: string,
      oldPurchaseEntryId: string | undefined,
      newComponentId: string,
      newPurchaseEntryId: string,
      quantity: number
    ) => {
      const current = currentState;
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
    };

    // 1. Rejected: Missing build -> no history
    const res1 = swapPartInBuild('missing-build', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res1.success).toBe(false);
    expect(history.length).toBe(0);

    // 2. Rejected: Sold build -> no history
    const res2 = swapPartInBuild('b-sold', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(res2.success).toBe(false);
    expect(history.length).toBe(0);

    // 3. Rejected: Same batch no-op -> no history
    const res3 = swapPartInBuild('b-active', 'c1', 'pe1', 'c1', 'pe1', 1);
    expect(res3.success).toBe(false);
    expect(history.length).toBe(0);

    // 4. Rejected: Category mismatch -> no history
    const res4 = swapPartInBuild('b-active', 'c1', 'pe1', 'c3', 'pe4', 1);
    expect(res4.success).toBe(false);
    expect(history.length).toBe(0);

    // 5. Successful swap -> produces exactly 1 history entry and mutates state
    const resSuccess = swapPartInBuild('b-active', 'c1', 'pe1', 'c2', 'pe3', 1);
    expect(resSuccess.success).toBe(true);
    expect(history.length).toBe(1);
    expect(history[0]).toBe('Swap part in: Gaming Rig');
    expect(currentState.builds.find((b) => b.id === 'b-active')?.parts.find((p) => p.componentId === 'c2')).toBeDefined();
  });
});

