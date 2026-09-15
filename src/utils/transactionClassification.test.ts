import { describe, expect, it } from 'vitest';
import { TransactionLogItem } from '../types';
import { classifyTransaction } from './transactionClassification';

const purchase = (overrides: Partial<TransactionLogItem> = {}): TransactionLogItem => ({
  id: 'purchase-1',
  type: 'PURCHASE',
  title: 'Purchased: Canada Computers',
  timestamp: '2026-09-11',
  dateSortable: '2026-09-11',
  itemCount: 1,
  quantity: 1,
  totalAmount: 158.19,
  itemNameOrSummary: 'DarkFlash TH285 PLUS BLACK',
  ...overrides,
});

describe('transaction purchase classification', () => {
  it('does not classify explicit one-item legacy scanner data as bulk', () => {
    const transaction = purchase({
      title: 'Bulk Purchase: Canada Computers',
      itemNameOrSummary: 'Bulk added 1 items from Canada Computers',
      detailsList: ['1x DarkFlash TH285 PLUS BLACK ($158.19/ea)'],
    });

    expect(classifyTransaction(transaction).isBulkPurchase).toBe(false);
  });

  it('still classifies a scanner purchase containing multiple items as bulk', () => {
    const transaction = purchase({
      title: 'Bulk Purchase: Canada Computers',
      itemCount: 2,
      quantity: 3,
      detailsList: [
        '1x DarkFlash TH285 PLUS BLACK ($158.19/ea)',
        '2x Arctic P12 Fans ($10.00/ea)',
      ],
    });

    expect(classifyTransaction(transaction).isBulkPurchase).toBe(true);
  });

  it('keeps title-only legacy bulk records classified as bulk when no count exists', () => {
    const transaction = purchase({
      title: 'Bulk Purchase: Unknown',
      itemCount: 0,
      detailsList: undefined,
    });

    expect(classifyTransaction(transaction).isBulkPurchase).toBe(true);
  });

  it('classifies a whole-PC purchase as one purchase rather than a bulk import', () => {
    const transaction = purchase({
      title: 'Purchased PC: Ryzen 5 5600X + RTX 3060',
      itemNameOrSummary: 'Ryzen 5 5600X + RTX 3060',
      purchaseKind: 'PC',
      relatedComponentId: 'build-purchased-1',
      totalAmount: 520,
    });

    expect(classifyTransaction(transaction).isBulkPurchase).toBe(false);
  });
});
