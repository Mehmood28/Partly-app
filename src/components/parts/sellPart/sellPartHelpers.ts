import { InventoryComponent } from '../../../types';

export const getEstimatedNumericValue = (_comp: InventoryComponent, avgCost: number): number => {
  return avgCost > 0 ? avgCost : 0;
};

export interface ParseCashPaidResult {
  success: boolean;
  value: number;
  error?: string;
}

export const parseCashPaidOnTop = (input: string | number | undefined | null): ParseCashPaidResult => {
  if (input === undefined || input === null) {
    return { success: true, value: 0 };
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || isNaN(input) || input < 0 || Object.is(input, -0)) {
      return { success: false, value: 0, error: 'Cash paid on top must be a finite non-negative number.' };
    }
    return { success: true, value: input };
  }

  const trimmed = String(input).trim();
  if (trimmed === '') {
    return { success: true, value: 0 };
  }

  if (trimmed.startsWith('-') || /infinity|nan/i.test(trimmed)) {
    return { success: false, value: 0, error: 'Cash paid on top must be a finite non-negative number.' };
  }

  const num = Number(trimmed);
  if (isNaN(num) || !Number.isFinite(num) || num < 0 || Object.is(num, -0)) {
    return { success: false, value: 0, error: 'Cash paid on top must be a finite non-negative number.' };
  }

  return { success: true, value: num };
};
