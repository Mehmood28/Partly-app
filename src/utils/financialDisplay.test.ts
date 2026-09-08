import { describe, expect, it } from 'vitest';
import {
  formatSignedCurrency,
  getProfitBadgeClasses,
  getProfitSummaryClasses,
  getProfitTextColor,
} from './financialDisplay';

describe('financial display helpers', () => {
  it('formats positive, negative, and zero values with exactly one sign', () => {
    expect(formatSignedCurrency(25)).toBe('+$25.00');
    expect(formatSignedCurrency(-10)).toBe('-$10.00');
    expect(formatSignedCurrency(0)).toBe('$0.00');
    expect(formatSignedCurrency(-0)).toBe('$0.00');
  });

  it('uses zero as a safe display fallback for non-finite values', () => {
    expect(formatSignedCurrency(Number.NaN)).toBe('$0.00');
    expect(formatSignedCurrency(Number.POSITIVE_INFINITY)).toBe('$0.00');
  });

  it('uses green for profit, red for loss, and neutral for zero', () => {
    expect(getProfitTextColor(1)).toBe('text-emerald-400');
    expect(getProfitTextColor(-1)).toBe('text-rose-400');
    expect(getProfitTextColor(0)).toBe('text-zinc-300');

    expect(getProfitBadgeClasses(1)).toContain('text-emerald-400');
    expect(getProfitBadgeClasses(-1)).toContain('text-rose-400');
    expect(getProfitBadgeClasses(0)).toContain('text-zinc-300');

    expect(getProfitSummaryClasses(1)).toContain('text-emerald-300');
    expect(getProfitSummaryClasses(-1)).toContain('text-rose-300');
    expect(getProfitSummaryClasses(0)).toContain('text-zinc-300');
  });
});
