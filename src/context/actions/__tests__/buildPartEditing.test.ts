import { describe, expect, it } from 'vitest';
import {
  handleAllocatePartToBuild,
  handleRemovePartFromBuild,
  handleRelistBuild,
  handleSwapPartInBuild,
  handleUpdateBuildPartQuantity,
} from '../buildActions';
import { AppState, InventoryComponent, PCBuild, TransactionLogItem } from '../../../types';
import { calculateBuildPartsCost, getPurchaseEntryRemainingQuantity } from '../../../utils/helpers';

const makeFanComponent = (
  id: string,
  name: string,
  purchaseEntryId: string,
  quantity: number,
  unitPrice: number,
  assignedCount: number
): InventoryComponent => ({
  id,
  name,
  category: 'Fans',
  specifications: '',
  assignedCount,
  purchaseHistory: [
    {
      id: purchaseEntryId,
      date: '2026-05-05',
      condition: 'Sealed',
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      paymentMethod: 'Cash',
      platform: 'Local',
    },
  ],
});

const makeSoldState = (): AppState => {
  const soldBuild: PCBuild = {
    id: 'build-sold',
    name: 'Sold Gaming PC',
    status: 'Sold',
    createdDate: '2026-08-01',
    saleDate: '2026-08-18',
    salePrice: 100,
    platformSoldOn: 'Facebook',
    paymentMethod: 'Cash',
    buyerName: 'Buyer',
    saleTransactionId: 'tx-sale',
    parts: [
      {
        componentId: 'fans-prism',
        componentName: 'Prism 8 Pro Fan',
        purchaseEntryId: 'batch-prism',
        category: 'Fans',
        quantity: 7,
        unitCostAtAssignment: 4,
      },
    ],
  };

  const saleTransaction: TransactionLogItem = {
    id: 'tx-sale',
    type: 'SALE',
    title: 'PC Sold: Sold Gaming PC',
    timestamp: '2026-08-18',
    dateSortable: '2026-08-18',
    itemCount: 1,
    quantity: 7,
    totalAmount: 100,
    profitMargin: 72,
    platform: 'Facebook',
    paymentMethod: 'Cash',
    buyerName: 'Buyer',
    itemNameOrSummary: 'Sold Gaming PC',
    detailsList: ['7x Prism 8 Pro Fan ($4.00/ea)'],
    relatedComponentId: 'build-sold',
  };

  return {
    components: [
      makeFanComponent('fans-prism', 'Prism 8 Pro Fan', 'batch-prism', 12, 4, 7),
      makeFanComponent('fans-alt', 'TL-C12C Fan', 'batch-alt', 5, 10, 0),
    ],
    builds: [soldBuild],
    transactions: [
      saleTransaction,
      {
        id: 'tx-unrelated',
        type: 'PURCHASE',
        title: 'Unrelated Purchase',
        timestamp: '2026-08-01',
        dateSortable: '2026-08-01',
        itemCount: 1,
        quantity: 1,
        totalAmount: 25,
        itemNameOrSummary: 'Unrelated Part',
      },
    ],
    monthlyGoal: 10000,
  };
};

describe('build part quantity editing', () => {
  it.each(['In Progress', 'Listed for Sale', 'Trade-In Processing'] as const)(
    'supports exact quantity corrections while the build is %s',
    (status) => {
      const soldState = makeSoldState();
      const state: AppState = {
        ...soldState,
        builds: [
          {
            ...soldState.builds[0],
            status,
            saleDate: undefined,
            salePrice: undefined,
            platformSoldOn: undefined,
            paymentMethod: undefined,
            buyerName: undefined,
            saleTransactionId: undefined,
          },
        ],
        transactions: soldState.transactions.slice(1),
      };

      const result = handleUpdateBuildPartQuantity(
        state,
        'build-sold',
        'fans-prism',
        'batch-prism',
        3
      );

      expect(result.success).toBe(true);
      expect(result.nextState.builds[0].status).toBe(status);
      expect(result.nextState.builds[0].parts[0].quantity).toBe(3);
      expect(result.nextState.components[0].assignedCount).toBe(3);
    }
  );

  it('changes 7 fans to 3 and returns four exact-batch units to stock', () => {
    const state = makeSoldState();
    const unrelatedTransaction = state.transactions[1];

    const result = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );

    expect(result.success).toBe(true);
    const build = result.nextState.builds[0];
    const component = result.nextState.components.find((item) => item.id === 'fans-prism')!;
    const sale = result.nextState.transactions.find((transaction) => transaction.id === 'tx-sale')!;

    expect(build.status).toBe('Sold');
    expect(build.parts[0]).toMatchObject({
      componentId: 'fans-prism',
      purchaseEntryId: 'batch-prism',
      quantity: 3,
      unitCostAtAssignment: 4,
    });
    expect(build.saleDate).toBe('2026-08-18');
    expect(build.salePrice).toBe(100);
    expect(build.buyerName).toBe('Buyer');
    expect(component.assignedCount).toBe(3);
    expect(getPurchaseEntryRemainingQuantity(component, 'batch-prism', result.nextState.builds)).toBe(9);
    expect(calculateBuildPartsCost(build)).toBe(12);
    expect(sale).toMatchObject({
      itemCount: 1,
      quantity: 3,
      profitMargin: 88,
      detailsList: ['3x Prism 8 Pro Fan ($4.00/ea)'],
      totalAmount: 100,
      relatedComponentId: 'build-sold',
    });
    expect(result.nextState.transactions[1]).toBe(unrelatedTransaction);
  });

  it('uses weighted historical cost when increasing an existing allocation', () => {
    const state = makeSoldState();
    state.components[0] = makeFanComponent(
      'fans-prism',
      'Prism 8 Pro Fan',
      'batch-prism',
      12,
      6,
      7
    );

    const result = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      8
    );

    expect(result.success).toBe(true);
    expect(result.nextState.builds[0].parts[0].unitCostAtAssignment).toBe(4.25);
    expect(result.nextState.components[0].assignedCount).toBe(8);
    expect(result.nextState.transactions[0].profitMargin).toBe(66);
    expect(result.nextState.transactions[0].detailsList).toEqual([
      '8x Prism 8 Pro Fan ($4.25/ea)',
    ]);
  });

  it('rejects invalid quantities, excessive increases, and semantic no-ops correctly', () => {
    const state = makeSoldState();
    for (const invalid of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
      const result = handleUpdateBuildPartQuantity(
        state,
        'build-sold',
        'fans-prism',
        'batch-prism',
        invalid
      );
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }

    const excessive = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      13
    );
    expect(excessive.success).toBe(false);
    expect(excessive.error).toContain('exceeds available batch stock (5)');
    expect(excessive.nextState).toBe(state);

    const noOp = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      7
    );
    expect(noOp.success).toBe(true);
    expect(noOp.nextState).toBe(state);
  });

  it('allows a unique legacy allocation to decrease but blocks increasing it without a batch', () => {
    const component = makeFanComponent('fans-prism', 'Prism 8 Pro Fan', 'batch-prism', 12, 4, 7);
    const legacyState: AppState = {
      components: [component],
      builds: [
        {
          id: 'legacy-build',
          name: 'Legacy Build',
          status: 'In Progress',
          createdDate: '2026-08-01',
          parts: [
            {
              componentId: 'fans-prism',
              componentName: 'Prism 8 Pro Fan',
              category: 'Fans',
              quantity: 7,
              unitCostAtAssignment: 4,
            },
          ],
        },
      ],
      transactions: [],
    };

    const decreased = handleUpdateBuildPartQuantity(
      legacyState,
      'legacy-build',
      'fans-prism',
      undefined,
      3
    );
    expect(decreased.success).toBe(true);
    expect(decreased.nextState.builds[0].parts[0].quantity).toBe(3);
    expect(decreased.nextState.components[0].assignedCount).toBe(3);

    const increased = handleUpdateBuildPartQuantity(
      legacyState,
      'legacy-build',
      'fans-prism',
      undefined,
      8
    );
    expect(increased.success).toBe(false);
    expect(increased.error).toContain('exact purchase batch');
    expect(increased.nextState).toBe(legacyState);
  });
});

describe('sold build part mutations', () => {
  it('adds multiple exact-batch units and synchronizes the linked sale', () => {
    const state = makeSoldState();
    const result = handleAllocatePartToBuild(state, 'build-sold', 'fans-alt', 'batch-alt', 2);

    expect(result.success).toBe(true);
    const build = result.nextState.builds[0];
    const replacement = result.nextState.components.find((item) => item.id === 'fans-alt')!;
    const sale = result.nextState.transactions[0];
    expect(build.parts.find((part) => part.componentId === 'fans-alt')).toMatchObject({
      purchaseEntryId: 'batch-alt',
      quantity: 2,
      unitCostAtAssignment: 10,
    });
    expect(replacement.assignedCount).toBe(2);
    expect(getPurchaseEntryRemainingQuantity(replacement, 'batch-alt', result.nextState.builds)).toBe(3);
    expect(sale.itemCount).toBe(2);
    expect(sale.quantity).toBe(9);
    expect(sale.profitMargin).toBe(52);
    expect(sale.detailsList).toEqual([
      '7x Prism 8 Pro Fan ($4.00/ea)',
      '2x TL-C12C Fan ($10.00/ea)',
    ]);
  });

  it('removes a sold-build allocation and returns it to the exact batch', () => {
    const state = makeSoldState();
    const result = handleRemovePartFromBuild(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism'
    );

    expect(result.success).toBe(true);
    expect(result.nextState.builds[0].parts).toEqual([]);
    expect(result.nextState.components[0].assignedCount).toBe(0);
    expect(
      getPurchaseEntryRemainingQuantity(
        result.nextState.components[0],
        'batch-prism',
        result.nextState.builds
      )
    ).toBe(12);
    expect(result.nextState.transactions[0]).toMatchObject({
      itemCount: 0,
      quantity: 0,
      detailsList: [],
      profitMargin: 100,
    });
  });

  it('swaps a sold-build allocation atomically across exact batches', () => {
    const state = makeSoldState();
    const result = handleSwapPartInBuild(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      'fans-alt',
      'batch-alt',
      3
    );

    expect(result.success).toBe(true);
    expect(result.nextState.builds[0].parts).toEqual([
      expect.objectContaining({
        componentId: 'fans-alt',
        purchaseEntryId: 'batch-alt',
        quantity: 3,
        unitCostAtAssignment: 10,
      }),
    ]);
    expect(result.nextState.components.find((item) => item.id === 'fans-prism')?.assignedCount).toBe(0);
    expect(result.nextState.components.find((item) => item.id === 'fans-alt')?.assignedCount).toBe(3);
    expect(result.nextState.transactions[0]).toMatchObject({
      itemCount: 1,
      quantity: 3,
      profitMargin: 70,
      detailsList: ['3x TL-C12C Fan ($10.00/ea)'],
    });
  });

  it('uses the unique exact relatedComponentId fallback and backfills saleTransactionId', () => {
    const state = makeSoldState();
    state.builds[0] = { ...state.builds[0], saleTransactionId: undefined };

    const result = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );

    expect(result.success).toBe(true);
    expect(result.nextState.builds[0].saleTransactionId).toBe('tx-sale');
    expect(result.nextState.transactions[0].profitMargin).toBe(88);
  });

  it('blocks missing, mismatched, ambiguous, and multiply claimed sale links atomically', () => {
    const base = makeSoldState();

    const missing: AppState = { ...base, transactions: base.transactions.slice(1) };
    const missingResult = handleUpdateBuildPartQuantity(
      missing,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );
    expect(missingResult.success).toBe(false);
    expect(missingResult.nextState).toBe(missing);

    const mismatched: AppState = {
      ...base,
      transactions: base.transactions.map((transaction) =>
        transaction.id === 'tx-sale'
          ? { ...transaction, relatedComponentId: 'different-build' }
          : transaction
      ),
    };
    const mismatchedResult = handleUpdateBuildPartQuantity(
      mismatched,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );
    expect(mismatchedResult.success).toBe(false);
    expect(mismatchedResult.nextState).toBe(mismatched);

    const ambiguous: AppState = {
      ...base,
      transactions: [base.transactions[0], { ...base.transactions[0] }, base.transactions[1]],
    };
    const ambiguousResult = handleUpdateBuildPartQuantity(
      ambiguous,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );
    expect(ambiguousResult.success).toBe(false);
    expect(ambiguousResult.nextState).toBe(ambiguous);

    const multiplyClaimed: AppState = {
      ...base,
      builds: [
        ...base.builds,
        {
          id: 'other-build',
          name: 'Other Build',
          status: 'Sold',
          createdDate: '2026-08-01',
          parts: [],
          saleTransactionId: 'tx-sale',
        },
      ],
    };
    const multiplyClaimedResult = handleUpdateBuildPartQuantity(
      multiplyClaimed,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );
    expect(multiplyClaimedResult.success).toBe(false);
    expect(multiplyClaimedResult.error).toContain('Another build references');
    expect(multiplyClaimedResult.nextState).toBe(multiplyClaimed);
  });

  it('keeps trade-in consideration and incoming build linkage unchanged', () => {
    const state = makeSoldState();
    state.transactions[0] = {
      ...state.transactions[0],
      cashPortion: 60,
      tradeInCredit: 40,
      incomingTradeInBuildId: 'incoming-build',
      tradeInBuildName: 'Incoming PC',
    };
    state.builds.push({
      id: 'incoming-build',
      name: 'Incoming PC',
      status: 'Trade-In Processing',
      createdDate: '2026-08-18',
      parts: [],
      estimatedCost: 40,
      acquisitionSource: 'Trade-In',
      sourceSaleTransactionId: 'tx-sale',
    });

    const result = handleUpdateBuildPartQuantity(
      state,
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );

    expect(result.success).toBe(true);
    expect(result.nextState.transactions[0]).toMatchObject({
      cashPortion: 60,
      tradeInCredit: 40,
      incomingTradeInBuildId: 'incoming-build',
      tradeInBuildName: 'Incoming PC',
      profitMargin: 88,
    });
    expect(result.nextState.builds.find((build) => build.id === 'incoming-build')).toEqual(
      state.builds[1]
    );
  });

  it('preserves corrected allocations when the sold build is subsequently relisted', () => {
    const corrected = handleUpdateBuildPartQuantity(
      makeSoldState(),
      'build-sold',
      'fans-prism',
      'batch-prism',
      3
    );
    expect(corrected.success).toBe(true);

    const relisted = handleRelistBuild(corrected.nextState, 'build-sold');
    expect(relisted.success).toBe(true);
    expect(relisted.nextState.transactions.some((transaction) => transaction.id === 'tx-sale')).toBe(false);
    expect(relisted.nextState.builds[0]).toMatchObject({
      id: 'build-sold',
      status: 'Listed for Sale',
      parts: [
        expect.objectContaining({
          componentId: 'fans-prism',
          purchaseEntryId: 'batch-prism',
          quantity: 3,
        }),
      ],
    });
  });
});
