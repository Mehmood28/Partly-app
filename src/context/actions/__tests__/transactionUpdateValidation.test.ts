import { describe, expect, it } from 'vitest';
import { AppState, PCBuild, TransactionLogItem } from '../../../types';
import { handleUpdateTransaction } from '../transactionActions';

const transaction: TransactionLogItem = {
  id: 'tx-1',
  type: 'SALE',
  title: 'Part Sold: GPU',
  timestamp: '2026-09-08',
  dateSortable: '2026-09-08',
  itemCount: 1,
  quantity: 1,
  totalAmount: 500,
  profitMargin: 75,
  platform: 'Facebook',
  paymentMethod: 'Cash',
  itemNameOrSummary: 'RTX 4070',
  relatedComponentId: 'component-1',
};

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  components: [],
  builds: [],
  transactions: [transaction],
  monthlyGoal: 10000,
  ...overrides,
});

describe('handleUpdateTransaction validation', () => {
  it('rejects empty, missing, and ambiguous IDs without changing state', () => {
    const duplicate = { ...transaction, title: 'Duplicate' };
    const ambiguousState = makeState({ transactions: [transaction, duplicate] });

    for (const [state, id] of [
      [makeState(), ''],
      [makeState(), 'missing'],
      [ambiguousState, 'tx-1'],
    ] as const) {
      const result = handleUpdateTransaction(state, id, { title: 'Changed' });
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  });

  it('blocks generic edits to a linked PC sale', () => {
    const build: PCBuild = {
      id: 'component-1',
      name: 'Gaming PC',
      parts: [],
      status: 'Sold',
      createdDate: '2026-09-01',
      saleTransactionId: transaction.id,
    };
    const state = makeState({ builds: [build] });
    const result = handleUpdateTransaction(state, transaction.id, { totalAmount: 600 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Builds tab');
    expect(result.nextState).toBe(state);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'rejects invalid total amount %s',
    (totalAmount) => {
      const state = makeState();
      const result = handleUpdateTransaction(state, transaction.id, { totalAmount });
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid profit %s',
    (profitMargin) => {
      const state = makeState();
      const result = handleUpdateTransaction(state, transaction.id, { profitMargin });
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  );

  it.each(['', '2026-02-30', '2026-9-08', '09/08/2026'])(
    'rejects invalid date %j',
    (dateSortable) => {
      const state = makeState();
      const result = handleUpdateTransaction(state, transaction.id, { dateSortable });
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  );

  it('rejects blank labels, invalid payment methods, and immutable field changes', () => {
    const state = makeState();
    const invalidUpdates: Partial<TransactionLogItem>[] = [
      { title: ' ' },
      { itemNameOrSummary: ' ' },
      { paymentMethod: 'Cheque' as any },
      { id: 'different' },
      { type: 'PURCHASE' },
    ];

    for (const updates of invalidUpdates) {
      const result = handleUpdateTransaction(state, transaction.id, updates);
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  });

  it('rejects malformed non-string text inputs without throwing', () => {
    const state = makeState();
    const invalidUpdates = [
      { title: null },
      { itemNameOrSummary: 123 },
      { dateSortable: null },
      { platform: 123 },
    ] as unknown as Partial<TransactionLogItem>[];

    for (const updates of invalidUpdates) {
      const result = handleUpdateTransaction(state, transaction.id, updates);
      expect(result.success).toBe(false);
      expect(result.nextState).toBe(state);
    }
  });

  it('returns the original state for a semantic no-op', () => {
    const state = makeState();
    const result = handleUpdateTransaction(state, transaction.id, {
      title: transaction.title,
      totalAmount: transaction.totalAmount,
      profitMargin: transaction.profitMargin,
      dateSortable: transaction.dateSortable,
    });

    expect(result.success).toBe(true);
    expect(result.nextState).toBe(state);
  });

  it('applies a valid edit, including zero amount and negative profit', () => {
    const state = makeState();
    const result = handleUpdateTransaction(state, transaction.id, {
      title: '  Part Sold: Updated GPU  ',
      itemNameOrSummary: '  RTX 4070 Super  ',
      totalAmount: 0,
      profitMargin: -25,
      platform: '  Kijiji  ',
      paymentMethod: 'E-Transfer',
      dateSortable: '2026-09-07',
    });

    expect(result.success).toBe(true);
    expect(result.nextState).not.toBe(state);
    expect(result.nextState.transactions[0]).toMatchObject({
      id: transaction.id,
      type: transaction.type,
      title: 'Part Sold: Updated GPU',
      itemNameOrSummary: 'RTX 4070 Super',
      totalAmount: 0,
      profitMargin: -25,
      platform: 'Kijiji',
      paymentMethod: 'E-Transfer',
      dateSortable: '2026-09-07',
      relatedComponentId: transaction.relatedComponentId,
    });
  });

  it('can clear optional platform and payment method fields', () => {
    const state = makeState();
    const result = handleUpdateTransaction(state, transaction.id, {
      platform: undefined,
      paymentMethod: undefined,
    });

    expect(result.success).toBe(true);
    expect(result.nextState.transactions[0].platform).toBeUndefined();
    expect(result.nextState.transactions[0].paymentMethod).toBeUndefined();
  });
});
