import { describe, expect, it } from 'vitest';
import type { AppState, InventoryComponent, PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import {
  handleAddBuild,
  handleAllocatePartToBuild,
  handleRemovePartFromBuild,
  handleSellBuild,
  handleUpdateBuild,
} from '../context/actions/buildActions';
import {
  handleSellComponentPart,
  handleUpdatePurchaseEntry,
} from '../context/actions/componentActions';
import { handleRelistPartSale } from '../context/actions/transactionActions';
import { calculateComponentBatchesWithStock } from '../components/builds/createBuild/buildModalHelpers';
import { calculateBuildPartsCost } from './helpers';
import { buildFinancialRow, findMatchingSoldBuild } from './financialCsv';

const date = '2026-09-09';

const makeBatch = (id: string, quantity: number, unitPrice: number): PurchaseEntry => ({
  id,
  date,
  condition: 'Used No Box',
  quantity,
  unitPrice,
  totalPrice: quantity * unitPrice,
  paymentMethod: 'Cash',
  platform: 'Supplier',
  taxPercent: 0,
});

const makeComponent = (
  id: string,
  quantity: number,
  unitPrice: number
): InventoryComponent => ({
  id,
  name: `Component ${id}`,
  category: 'GPU',
  specifications: '',
  purchaseHistory: [makeBatch(`pe-${id}`, quantity, unitPrice)],
  assignedCount: 0,
  soldCount: 0,
});

const makeBuild = (id: string): PCBuild => ({
  id,
  name: `PC ${id}`,
  parts: [],
  status: 'Listed for Sale',
  createdDate: date,
  estimatedCost: 600,
});

const makeState = (
  components: InventoryComponent[] = [],
  builds: PCBuild[] = [],
  transactions: TransactionLogItem[] = []
): AppState => ({ components, builds, transactions, monthlyGoal: 10000 });

describe('cross-system domain regression fixes', () => {
  it('prevents generic build editing from changing sold-PC accounting fields', () => {
    const sold = handleSellBuild(makeState([], [makeBuild('sold')]), 'sold', {
      salePrice: 1000,
      saleDate: date,
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
      tradeIn: { tradeInCredit: 500, tradeInBuildName: 'Incoming PC' },
    });
    expect(sold.success).toBe(true);

    const edited = handleUpdateBuild(sold.nextState, 'sold', {
      name: 'Corrected PC name',
      salePrice: 300,
      builtDate: '2026-09-08',
      saleTransactionId: 'different-transaction',
    });
    const editedBuild = edited.builds.find((build) => build.id === 'sold')!;
    const saleTx = edited.transactions.find((tx) => tx.id === editedBuild.saleTransactionId)!;

    expect(editedBuild.name).toBe('Corrected PC name');
    expect(editedBuild.salePrice).toBe(1000);
    expect(editedBuild.builtDate).toBeUndefined();
    expect(saleTx.totalAmount).toBe(1000);
    expect(saleTx.tradeInCredit).toBe(500);
  });

  it('reverses both sides of an untouched part trade and blocks unsafe legacy reversal', () => {
    const initial = makeState([makeComponent('outgoing', 1, 400)]);
    const sold = handleSellComponentPart(initial, 'outgoing', 'pe-outgoing', {
      quantity: 1,
      unitSalePrice: 600,
      saleDate: date,
      platform: 'Facebook',
      paymentMethod: 'Cash',
      incomingTradePart: {
        name: 'Incoming GPU',
        category: 'GPU',
        tradeInCredit: 200,
      },
    });
    expect(sold.success).toBe(true);
    const saleTx = sold.nextState.transactions[0];
    expect(saleTx.incomingComponentId).toBeTruthy();
    expect(saleTx.incomingPurchaseEntryId).toBeTruthy();

    const relisted = handleRelistPartSale(sold.nextState, saleTx.id);
    expect(relisted.transactions).toHaveLength(0);
    expect(relisted.components).toHaveLength(1);
    expect(relisted.components[0].id).toBe('outgoing');
    expect(relisted.components[0].purchaseHistory[0].quantity).toBe(1);

    const unsafeLegacy = {
      ...sold.nextState,
      transactions: [{
        ...saleTx,
        incomingComponentId: undefined,
        incomingPurchaseEntryId: undefined,
      }],
    };
    expect(handleRelistPartSale(unsafeLegacy, saleTx.id)).toBe(unsafeLegacy);
  });

  it('respects unresolved legacy reservations in the new-build picker and save boundary', () => {
    const component = makeComponent('reserved', 2, 200);
    component.assignedCount = 1;
    const legacyBuild: PCBuild = {
      ...makeBuild('legacy'),
      estimatedCost: undefined,
      parts: [{
        componentId: component.id,
        componentName: component.name,
        category: component.category,
        quantity: 1,
        unitCostAtAssignment: 200,
      }],
    };
    const initial = makeState([component], [legacyBuild]);

    const picker = calculateComponentBatchesWithStock(component, initial.builds, []);
    expect(picker.batches[0].remainingUnassigned).toBe(1);

    const excessive = handleAddBuild(initial, {
      name: 'Excessive build',
      status: 'Listed for Sale',
      parts: [{
        componentId: component.id,
        componentName: component.name,
        category: component.category,
        purchaseEntryId: 'pe-reserved',
        quantity: 2,
        unitCostAtAssignment: 200,
      }],
    });
    expect(excessive).toBe(initial);
  });

  it('does not reconcile an explicit different build ID or another modern sale identity', () => {
    const soldBuild: PCBuild = {
      ...makeBuild('current'),
      status: 'Sold',
      saleDate: date,
      salePrice: 1000,
      saleTransactionId: 'tx-current',
    };
    const otherTx: TransactionLogItem = {
      id: 'tx-history',
      type: 'SALE',
      title: 'PC Sold: Different PC',
      itemNameOrSummary: 'Different PC',
      timestamp: date,
      dateSortable: date,
      itemCount: 1,
      quantity: 1,
      totalAmount: 1000,
      profitMargin: 100,
      relatedComponentId: 'build-retired',
    };

    expect(findMatchingSoldBuild(otherTx, [soldBuild])).toBeNull();
    expect(buildFinancialRow(otherTx, [soldBuild])).toMatchObject({
      saleRevenue: 1000,
      recordedCostBasis: 900,
      netProfit: 100,
    });

    expect(findMatchingSoldBuild({ ...otherTx, relatedComponentId: undefined }, [soldBuild]))
      .toBeNull();
  });

  it('merges repeat allocations from one batch using exact weighted historical cost', () => {
    const component = makeComponent('cost-change', 3, 10);
    const build = { ...makeBuild('active'), estimatedCost: undefined };
    const first = handleAllocatePartToBuild(
      makeState([component], [build]),
      build.id,
      component.id,
      'pe-cost-change',
      1
    );
    expect(first.success).toBe(true);

    const editedBatch = handleUpdatePurchaseEntry(
      first.nextState,
      component.id,
      'pe-cost-change',
      { ...component.purchaseHistory[0], unitPrice: 12, totalPrice: 36 }
    );
    expect(editedBatch.success).toBe(true);

    const second = handleAllocatePartToBuild(
      editedBatch.nextState,
      build.id,
      component.id,
      'pe-cost-change',
      1
    );
    expect(second.success).toBe(true);
    const parts = second.nextState.builds[0].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ quantity: 2, unitCostAtAssignment: 11 });
    expect(calculateBuildPartsCost(second.nextState.builds[0])).toBe(22);

    const removed = handleRemovePartFromBuild(
      second.nextState,
      build.id,
      component.id,
      'pe-cost-change'
    );
    expect(removed.success).toBe(true);
  });
});
