import { describe, expect, it } from 'vitest';
import { prepareTransactionEdit } from './transactionEditParsers';

const validInputs = {
  type: 'SALE' as const,
  title: 'Part Sold: GPU',
  itemNameOrSummary: 'RTX 4070',
  totalAmount: '500',
  profitMargin: '75',
  platform: 'Facebook',
  paymentMethod: 'Cash',
  dateSortable: '2026-09-08',
};

describe('prepareTransactionEdit', () => {
  it('trims text and prepares a valid sale edit', () => {
    const result = prepareTransactionEdit({
      ...validInputs,
      title: '  Part Sold: GPU  ',
      platform: '  Facebook  ',
    });

    expect(result).toEqual({
      success: true,
      value: {
        title: 'Part Sold: GPU',
        itemNameOrSummary: 'RTX 4070',
        totalAmount: 500,
        profitMargin: 75,
        platform: 'Facebook',
        paymentMethod: 'Cash',
        dateSortable: '2026-09-08',
      },
    });
  });

  it('allows a legitimate zero amount and negative sale profit', () => {
    const result = prepareTransactionEdit({
      ...validInputs,
      totalAmount: '0',
      profitMargin: '-25.50',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.totalAmount).toBe(0);
      expect(result.value.profitMargin).toBe(-25.5);
    }
  });

  it.each(['', ' ', 'NaN', 'Infinity', '-Infinity', '10abc', '1e3', '-1'])(
    'rejects invalid total amount %j',
    (totalAmount) => {
      const result = prepareTransactionEdit({ ...validInputs, totalAmount });
      expect(result).toEqual({
        success: false,
        error: 'Total amount must be a finite non-negative number.',
      });
    }
  );

  it.each(['', 'NaN', 'Infinity', '10abc'])(
    'rejects invalid sale profit %j',
    (profitMargin) => {
      const result = prepareTransactionEdit({ ...validInputs, profitMargin });
      expect(result).toEqual({
        success: false,
        error: 'Net profit must be a finite number.',
      });
    }
  );

  it('does not require profit for a purchase', () => {
    const result = prepareTransactionEdit({
      ...validInputs,
      type: 'PURCHASE',
      profitMargin: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.value.profitMargin).toBeUndefined();
  });

  it.each(['', '2026-02-30', '2026-9-08', '09/08/2026'])(
    'rejects invalid calendar date %j',
    (dateSortable) => {
      const result = prepareTransactionEdit({ ...validInputs, dateSortable });
      expect(result).toEqual({
        success: false,
        error: 'Date must be a valid calendar date.',
      });
    }
  );

  it('rejects blank title and summary', () => {
    expect(prepareTransactionEdit({ ...validInputs, title: ' ' })).toEqual({
      success: false,
      error: 'Record title is required.',
    });
    expect(prepareTransactionEdit({ ...validInputs, itemNameOrSummary: ' ' })).toEqual({
      success: false,
      error: 'Item or summary is required.',
    });
  });

  it('rejects invalid payment methods and permits an empty method', () => {
    expect(
      prepareTransactionEdit({ ...validInputs, paymentMethod: 'Cheque' })
    ).toEqual({ success: false, error: 'Select a valid payment method.' });

    const empty = prepareTransactionEdit({ ...validInputs, paymentMethod: '' });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.value.paymentMethod).toBeUndefined();
  });
});
