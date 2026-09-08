import { describe, expect, it } from 'vitest';
import { AppState, PCBuild } from '../types';
import { handleUpdateMonthlyBaseline } from '../context/actions/transactionActions';
import { calculateMonthlyMetrics } from './helpers';
import {
  getMonthlyBaseline,
  getBaselineYears,
  normalizeSheetStats,
  parseBaselineInputs,
} from './baselineStats';

const emptyState: AppState = {
  components: [],
  builds: [],
  transactions: [],
  monthlyGoal: 10000,
  sheetStats: {
    monthly: [],
    yearly: { revenue: 0, profit: 0, pcsSold: 0 },
  },
};

describe('baseline input parsing', () => {
  it('accepts zero values and legitimate negative profit', () => {
    expect(parseBaselineInputs('0', '0', '0')).toEqual({
      success: true,
      values: { revenue: 0, profit: 0, pcsSold: 0 },
    });
    expect(parseBaselineInputs('1000.50', '-25.25', '2')).toEqual({
      success: true,
      values: { revenue: 1000.5, profit: -25.25, pcsSold: 2 },
    });
  });

  it.each([
    ['', '0', '0'],
    ['10abc', '0', '0'],
    [Number.NaN, '0', '0'],
    [Number.POSITIVE_INFINITY, '0', '0'],
    ['-1', '0', '0'],
  ])('rejects invalid revenue without coercing it to zero', (revenue, profit, pcsSold) => {
    expect(parseBaselineInputs(revenue, profit, pcsSold).success).toBe(false);
  });

  it('rejects impossible profit and invalid PC counts', () => {
    expect(parseBaselineInputs('100', '101', '1').success).toBe(false);
    expect(parseBaselineInputs('100', '20', '-1').success).toBe(false);
    expect(parseBaselineInputs('100', '20', '1.5').success).toBe(false);
    expect(parseBaselineInputs('100', '20', '2pcs').success).toBe(false);
  });
});

describe('baseline normalization and year isolation', () => {
  it('migrates legacy month formats to 2026 and recalculates yearly totals', () => {
    const normalized = normalizeSheetStats({
      monthly: [
        { month: '2026-01', revenue: 500, profit: 200, pcsSold: 1 },
        { month: 'February', revenue: 1000, profit: 300, pcsSold: 2 },
      ],
      yearly: { revenue: 999999, profit: 999999, pcsSold: 999999 },
    });

    expect(normalized.monthly).toEqual([
      { year: 2026, month: 'January', revenue: 500, profit: 200, pcsSold: 1 },
      { year: 2026, month: 'February', revenue: 1000, profit: 300, pcsSold: 2 },
    ]);
    expect(normalized.yearly).toEqual({ revenue: 1500, profit: 500, pcsSold: 3 });
  });

  it('keeps years separate and discards invalid rows', () => {
    const normalized = normalizeSheetStats({
      monthly: [
        { year: 2026, month: 'January', revenue: 500, profit: 200, pcsSold: 1 },
        { year: 2027, month: 'January', revenue: 700, profit: 250, pcsSold: 2 },
        { year: 2027, month: 'Not a month', revenue: 10, profit: 1, pcsSold: 1 },
        { year: 2027, month: 'March', revenue: Number.NaN, profit: 0, pcsSold: 0 },
      ],
      yearly: { revenue: 0, profit: 0, pcsSold: 0 },
    });

    expect(normalized.monthly).toHaveLength(2);
    expect(getMonthlyBaseline(normalized, 2026, 0).revenue).toBe(500);
    expect(getMonthlyBaseline(normalized, 2027, 0).revenue).toBe(700);
    expect(getMonthlyBaseline(normalized, 2028, 0).revenue).toBe(0);
    expect(getBaselineYears(normalized)).toEqual([2027, 2026]);
  });
});

describe('monthly baseline domain action', () => {
  it('rejects invalid periods and values with the original state reference', () => {
    const badYear = handleUpdateMonthlyBaseline(emptyState, 1999, 0, {
      revenue: 100,
      profit: 20,
      pcsSold: 1,
    });
    expect(badYear.success).toBe(false);
    expect(badYear.nextState).toBe(emptyState);

    const badValue = handleUpdateMonthlyBaseline(emptyState, 2026, 0, {
      revenue: 100,
      profit: 101,
      pcsSold: 1,
    });
    expect(badValue.success).toBe(false);
    expect(badValue.nextState).toBe(emptyState);
  });

  it('returns the original reference for an unchanged save', () => {
    const first = handleUpdateMonthlyBaseline(emptyState, 2026, 0, {
      revenue: 500,
      profit: 200,
      pcsSold: 1,
    });
    expect(first.success).toBe(true);

    const unchanged = handleUpdateMonthlyBaseline(first.nextState, 2026, 0, {
      revenue: 500,
      profit: 200,
      pcsSold: 1,
    });
    expect(unchanged.success).toBe(true);
    expect(unchanged.nextState).toBe(first.nextState);
  });

  it('updates only the selected period and recalculates aggregate baseline totals', () => {
    const january = handleUpdateMonthlyBaseline(emptyState, 2026, 0, {
      revenue: 500,
      profit: 200,
      pcsSold: 1,
    }).nextState;
    const next = handleUpdateMonthlyBaseline(january, 2027, 0, {
      revenue: 700,
      profit: 250,
      pcsSold: 2,
    });

    expect(next.success).toBe(true);
    expect(next.nextState.sheetStats?.monthly).toHaveLength(2);
    expect(next.nextState.sheetStats?.yearly).toEqual({ revenue: 1200, profit: 450, pcsSold: 3 });
  });
});

describe('analytics baseline integration', () => {
  it('adds the selected baseline to live PC metrics without leaking into another year', () => {
    const soldBuild: PCBuild = {
      id: 'build-1',
      name: 'Sold PC',
      status: 'Sold',
      parts: [],
      createdDate: '2026-01-10',
      saleDate: '2026-01-10',
      salePrice: 100,
    };
    const state = handleUpdateMonthlyBaseline(
      { ...emptyState, builds: [soldBuild] },
      2026,
      0,
      { revenue: 1000, profit: 300, pcsSold: 2 }
    ).nextState;

    const january2026 = calculateMonthlyMetrics(state, 2026, 0);
    expect(january2026.pcRevenue).toBe(1100);
    expect(january2026.pcCost).toBe(700);
    expect(january2026.pcProfit).toBe(400);
    expect(january2026.pcsSold).toBe(3);

    const january2027 = calculateMonthlyMetrics(state, 2027, 0);
    expect(january2027.pcRevenue).toBe(0);
    expect(january2027.pcsSold).toBe(0);
  });
});
