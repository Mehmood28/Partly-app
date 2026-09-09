import { describe, expect, it } from 'vitest';
import { PCBuild, TransactionLogItem } from '../types';
import {
  buildFinancialRow,
  calculateFinancialTotals,
  escapeCsvString,
  extractAvailableYears,
  findMatchingSoldBuild,
  filterTransactionsByYear,
  formatCurrencyCell,
  generateFinancialCsv,
  resolveTransactionDate,
} from './financialCsv';

const makeTransaction = (updates: Partial<TransactionLogItem> = {}): TransactionLogItem => ({
  id: 'tx-1',
  type: 'SALE',
  title: 'Part Sold: GPU',
  timestamp: '2026-04-10',
  dateSortable: '2026-04-10',
  itemCount: 1,
  quantity: 1,
  totalAmount: 500,
  profitMargin: 100,
  itemNameOrSummary: 'GPU',
  ...updates,
});

describe('financial CSV reporting', () => {
  it('uses a valid sortable date and falls back to a valid timestamp', () => {
    expect(resolveTransactionDate(makeTransaction())).toMatchObject({
      dateStr: '2026-04-10',
      parsed: { year: 2026, monthIndex: 3, day: 10 },
    });

    expect(resolveTransactionDate(makeTransaction({
      dateSortable: '2026-02-30',
      timestamp: '2025-12-31',
    }))).toMatchObject({
      dateStr: '2025-12-31',
      parsed: { year: 2025, monthIndex: 11, day: 31 },
    });
  });

  it('filters by calendar year and counts records with no valid date', () => {
    const currentYear = new Date().getFullYear();
    const records = [
      makeTransaction({ id: '2026', dateSortable: '2026-01-01' }),
      makeTransaction({ id: '2025', dateSortable: '2025-12-31' }),
      makeTransaction({ id: 'invalid', dateSortable: 'not-a-date', timestamp: 'also-invalid' }),
    ];

    expect(extractAvailableYears(records)).toEqual(
      Array.from(new Set([currentYear, 2026, 2025])).sort((a, b) => b - a)
    );
    expect(filterTransactionsByYear(records, 2026)).toEqual({
      yearTransactions: [records[0]],
      invalidDateCount: 1,
      unmatchedPcSaleCount: 0,
    });
  });

  it('reconciles current PC sales by immutable build relationship', () => {
    const build: PCBuild = {
      id: 'build-current',
      saleTransactionId: 'tx-current',
      name: 'Current PC',
      status: 'Sold',
      createdDate: '2026-04-01',
      saleDate: '2026-04-10',
      salePrice: 1500,
      parts: [],
    };
    const tx = makeTransaction({
      id: 'tx-current',
      title: 'PC Sold: Current PC',
      relatedComponentId: build.id,
      totalAmount: 1500,
    });

    expect(findMatchingSoldBuild(tx, [build])).toBe(build);
  });

  it('reconciles legacy PC sales by date and amount, using the name to disambiguate', () => {
    const first: PCBuild = {
      id: 'build-a',
      name: '9800X3D / RTX 5080',
      status: 'Sold',
      createdDate: '2026-04-01',
      saleDate: '2026-04-10',
      salePrice: 3000,
      parts: [],
    };
    const second: PCBuild = { ...first, id: 'build-b', name: '7800X3D / RTX 5070 Ti' };
    const tx = makeTransaction({
      title: 'Sold (PC): 7800X3D / RTX 5070 Ti',
      itemNameOrSummary: '7800X3D / RTX 5070 Ti',
      totalAmount: 3000,
      relatedComponentId: undefined,
    });

    expect(findMatchingSoldBuild(tx, [first, second])).toBe(second);
  });

  it('excludes unmatched PC sale records while preserving ordinary sales', () => {
    const orphan = makeTransaction({
      id: 'orphan',
      title: 'Sold (PC): Missing Build',
      itemNameOrSummary: 'Missing Build',
      totalAmount: 3450,
      relatedComponentId: undefined,
    });
    const partSale = makeTransaction({ id: 'part' });

    expect(filterTransactionsByYear([orphan, partSale], 2026, [])).toEqual({
      yearTransactions: [partSale],
      invalidDateCount: 0,
      unmatchedPcSaleCount: 1,
    });
  });

  it('maps a purchase without treating it as revenue or profit', () => {
    const row = buildFinancialRow(makeTransaction({
      type: 'PURCHASE',
      title: 'Purchased: SSD',
      itemNameOrSummary: 'SSD',
      quantity: 3,
      totalAmount: 240,
      profitMargin: undefined,
    }));

    expect(row).toMatchObject({
      transactionType: 'PURCHASE',
      itemName: 'SSD',
      quantity: 3,
      purchaseAmount: 240,
    });
    expect(row.saleRevenue).toBeUndefined();
    expect(row.netProfit).toBeUndefined();
  });

  it('reports one PC sold rather than its installed part count', () => {
    const build: PCBuild = {
      id: 'build-1',
      name: '9800X3D / RTX 5080',
      status: 'Sold',
      createdDate: '2026-04-01',
      saleDate: '2026-04-10',
      estimatedCost: 2878.19,
      parts: [],
    };
    const row = buildFinancialRow(makeTransaction({
      title: 'PC Sold: 9800X3D / RTX 5080',
      itemNameOrSummary: '9800X3D / RTX 5080',
      relatedComponentId: build.id,
      itemCount: 8,
      quantity: 8,
      totalAmount: 4300,
      profitMargin: 1421.81,
      cashPortion: 3300,
      tradeInCredit: 1000,
    }), [build]);

    expect(row).toMatchObject({
      transactionType: 'SALE',
      quantity: 1,
      saleRevenue: 4300,
      recordedCostBasis: 2878.19,
      cashReceived: 3300,
      tradeInCredit: 1000,
      netProfit: 1421.81,
    });
  });

  it('uses the sold build snapshot when an old PC transaction profit is stale', () => {
    const build: PCBuild = {
      id: 'build-stale-ledger',
      name: 'Commission PC',
      status: 'Sold',
      createdDate: '2026-08-01',
      saleDate: '2026-08-07',
      salePrice: 875,
      parts: [{
        componentId: 'parts',
        componentName: 'Saved build parts',
        category: 'Other',
        quantity: 1,
        unitCostAtAssignment: 485,
      }],
    };
    const row = buildFinancialRow(makeTransaction({
      id: 'stale-ledger',
      title: 'Sold (PC): Commission PC',
      itemNameOrSummary: 'Commission PC',
      dateSortable: '2026-08-07',
      timestamp: '2026-08-07',
      totalAmount: 875,
      profitMargin: 410,
      relatedComponentId: build.id,
    }), [build]);

    expect(row).toMatchObject({
      saleRevenue: 875,
      recordedCostBasis: 485,
      netProfit: 390,
      quantity: 1,
    });
  });

  it('preserves loose-part quantity, exact batch cost, and a loss', () => {
    const row = buildFinancialRow(makeTransaction({
      quantity: 2,
      relatedComponentQty: 2,
      totalAmount: 190,
      soldUnitCost: 100,
      profitMargin: -10,
    }));

    expect(row).toMatchObject({
      quantity: 2,
      saleRevenue: 190,
      recordedCostBasis: 200,
      cashReceived: 190,
      netProfit: -10,
    });
  });

  it('leaves malformed legacy quantities blank instead of exporting NaN or negatives', () => {
    const row = buildFinancialRow(makeTransaction({
      quantity: Number.NaN,
      relatedComponentQty: -2,
      itemCount: 0,
    }));

    expect(row.quantity).toBe('');
  });

  it('separates trade-up inventory basis and cash without recording a sale', () => {
    const row = buildFinancialRow(makeTransaction({
      type: 'EXCHANGE',
      title: 'Trade Up: RX 9070 XT for RTX 5070 Ti',
      outgoingQuantity: 1,
      outgoingCostBasis: 750,
      cashPaidOnTop: 300,
      incomingCostBasis: 1050,
      totalAmount: 300,
      profitMargin: 0,
      exchangeType: 'TRADE_UP',
    }));

    expect(row).toMatchObject({
      transactionType: 'EXCHANGE',
      quantity: 1,
      recordedCostBasis: 750,
      cashPaidOnTradeUp: 300,
      incomingTradeUpCostBasis: 1050,
    });
    expect(row.saleRevenue).toBeUndefined();
    expect(row.netProfit).toBeUndefined();
  });

  it('does not include internal build allocations in financial totals', () => {
    const row = buildFinancialRow(makeTransaction({
      type: 'BUILD_ALLOCATION',
      title: 'Allocated: GPU',
      totalAmount: 1000,
      profitMargin: 500,
    }));

    expect(row.transactionType).toBe('BUILD_ALLOCATION');
    expect(calculateFinancialTotals([row])).toEqual({
      purchaseAmount: 0,
      saleRevenue: 0,
      recordedCostBasis: 0,
      cashReceived: 0,
      tradeInCredit: 0,
      cashPaidOnTradeUp: 0,
      incomingTradeUpCostBasis: 0,
      netProfit: 0,
    });
  });

  it('adds each financial column independently and keeps negative profit', () => {
    const totals = calculateFinancialTotals([
      buildFinancialRow(makeTransaction({ totalAmount: 100.1, profitMargin: 25.05 })),
      buildFinancialRow(makeTransaction({ id: 'tx-2', totalAmount: 50.2, profitMargin: -10.1 })),
      buildFinancialRow(makeTransaction({ id: 'tx-3', type: 'PURCHASE', totalAmount: 75.3, profitMargin: undefined })),
    ]);

    expect(totals).toMatchObject({
      purchaseAmount: 75.3,
      saleRevenue: 150.3,
      recordedCostBasis: 135.35,
      cashReceived: 150.3,
      netProfit: 14.95,
    });
  });

  it('generates Excel-friendly CSV with escaping, zero values, and a totals row', () => {
    const csv = generateFinancialCsv([
      makeTransaction({
        title: 'Part Sold: GPU',
        itemNameOrSummary: 'GPU, "White"',
        totalAmount: 0,
        profitMargin: -10,
        soldUnitCost: 10,
        notes: 'Customer said "test it"',
      }),
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"GPU, ""White"""');
    expect(csv).toContain('"Customer said ""test it"""');
    expect(csv).toContain(',0.00,10.00,0.00,');
    expect(csv.split('\n').at(-1)).toContain('"TOTAL"');
    expect(csv.split('\n').at(-1)).toContain('-10.00');
  });

  it('formats legitimate zero while rejecting non-finite currency cells', () => {
    expect(formatCurrencyCell(0)).toBe('0.00');
    expect(formatCurrencyCell(Number.NaN)).toBe('');
    expect(formatCurrencyCell(Number.POSITIVE_INFINITY)).toBe('');
    expect(escapeCsvString('a"b')).toBe('"a""b"');
  });
});
