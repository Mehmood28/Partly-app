import { describe, expect, it } from 'vitest';
import { AppState, PCBuild } from '../types';
import { calculateMonthlyMetrics } from './helpers';

const legacyBaseline = {
  monthly: [
    {
      month: '2026-01',
      revenue: 34350,
      profit: 13013,
      pcsSold: 9,
    },
  ],
  yearly: {
    revenue: 34350,
    profit: 13013,
    pcsSold: 9,
  },
};

describe('analytics metrics ignore retired baseline data', () => {
  it('does not let dormant legacy sheet stats alter monthly totals', () => {
    const state = {
      components: [],
      builds: [],
      transactions: [],
      monthlyGoal: 10000,
      sheetStats: legacyBaseline,
    } as AppState;

    expect(calculateMonthlyMetrics(state, 2026, 0)).toMatchObject({
      revenue: 0,
      cost: 0,
      profit: 0,
      pcsSold: 0,
      pcRevenue: 0,
      pcProfit: 0,
    });
  });

  it('still calculates live sold builds while ignoring legacy sheet stats', () => {
    const build: PCBuild = {
      id: 'build-1',
      name: 'Sold PC',
      status: 'Sold',
      parts: [],
      createdDate: '2026-01-10',
      saleDate: '2026-01-10',
      salePrice: 100,
    };
    const state = {
      components: [],
      builds: [build],
      transactions: [],
      monthlyGoal: 10000,
      sheetStats: legacyBaseline,
    } as AppState;

    expect(calculateMonthlyMetrics(state, 2026, 0)).toMatchObject({
      revenue: 100,
      cost: 0,
      profit: 100,
      pcsSold: 1,
      pcRevenue: 100,
      pcProfit: 100,
    });
  });
});
