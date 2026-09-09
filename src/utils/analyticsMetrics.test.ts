import { describe, expect, it } from 'vitest';
import { AppState, PCBuild, TransactionLogItem } from '../types';
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

describe('analytics accounting boundaries', () => {
  const soldBuild: PCBuild = {
    id: 'build-sold',
    name: 'Sold PC',
    status: 'Sold',
    createdDate: '2026-04-01',
    saleDate: '2026-04-15',
    salePrice: 1500,
    parts: [
      {
        componentId: 'gpu',
        componentName: 'GPU',
        category: 'GPU',
        quantity: 1,
        unitCostAtAssignment: 800,
      },
      {
        componentId: 'cpu',
        componentName: 'CPU',
        category: 'CPU',
        quantity: 1,
        unitCostAtAssignment: 200,
      },
    ],
  };

  const makeSale = (updates: Partial<TransactionLogItem>): TransactionLogItem => ({
    id: 'tx-part',
    type: 'SALE',
    title: 'Part Sold: RAM',
    timestamp: '2026-04-20',
    dateSortable: '2026-04-20',
    itemCount: 1,
    quantity: 1,
    totalAmount: 200,
    profitMargin: 50,
    itemNameOrSummary: 'RAM',
    ...updates,
  });

  it('combines PC and loose-part totals while keeping PC averages PC-only', () => {
    const state: AppState = {
      components: [],
      builds: [soldBuild],
      transactions: [makeSale({})],
    };

    expect(calculateMonthlyMetrics(state, 2026, 3)).toEqual({
      revenue: 1700,
      cost: 1150,
      profit: 550,
      pcsSold: 1,
      pcRevenue: 1500,
      pcCost: 1000,
      pcProfit: 500,
      partRevenue: 200,
      partCost: 150,
      partProfit: 50,
    });
  });

  it('does not double-count the transaction corresponding to a sold build', () => {
    const state: AppState = {
      components: [],
      builds: [soldBuild],
      transactions: [makeSale({
        id: 'tx-pc',
        title: 'PC Sold: Sold PC',
        relatedComponentId: soldBuild.id,
        itemCount: 8,
        quantity: 8,
        totalAmount: 1500,
        profitMargin: 500,
      })],
    };

    expect(calculateMonthlyMetrics(state, 2026, 3)).toMatchObject({
      revenue: 1500,
      cost: 1000,
      profit: 500,
      pcsSold: 1,
      partRevenue: 0,
      partProfit: 0,
    });
  });

  it('preserves loose-part losses as negative profit', () => {
    const state: AppState = {
      components: [],
      builds: [],
      transactions: [makeSale({ totalAmount: 90, profitMargin: -10 })],
    };

    expect(calculateMonthlyMetrics(state, 2026, 3)).toMatchObject({
      revenue: 90,
      cost: 100,
      profit: -10,
      pcsSold: 0,
      partProfit: -10,
    });
  });

  it('uses valid fallback dates and excludes impossible calendar dates', () => {
    const state: AppState = {
      components: [],
      builds: [],
      transactions: [
        makeSale({ id: 'fallback', dateSortable: '2026-02-30', timestamp: '2026-04-20' }),
        makeSale({ id: 'invalid', dateSortable: '2026-02-30', timestamp: 'not-a-date' }),
      ],
    };

    expect(calculateMonthlyMetrics(state, 2026, 3)).toMatchObject({
      revenue: 200,
      cost: 150,
      profit: 50,
      pcsSold: 0,
    });
  });

  it('includes trade-in acquisition value plus added upgrade parts in PC cost', () => {
    const tradeInBuild: PCBuild = {
      ...soldBuild,
      id: 'trade-in-build',
      acquisitionSource: 'Trade-In',
      estimatedCost: 700,
      salePrice: 1300,
      parts: [{
        componentId: 'ssd',
        componentName: 'SSD Upgrade',
        category: 'Storage',
        quantity: 1,
        unitCostAtAssignment: 100,
      }],
    };
    const state: AppState = {
      components: [],
      builds: [tradeInBuild],
      transactions: [],
    };

    expect(calculateMonthlyMetrics(state, 2026, 3)).toMatchObject({
      revenue: 1300,
      cost: 800,
      profit: 500,
      pcCost: 800,
      pcProfit: 500,
      pcsSold: 1,
    });
  });
});
