import { describe, expect, it } from 'vitest';
import { TransactionLogItem } from '../types';
import { createBulkGroupDisplayItem } from './bulkSaleGrouping';

const sale = (id: string, revenue: number, profit: number): TransactionLogItem => ({
  id,
  type: 'SALE',
  title: 'Part Sold',
  timestamp: '2026-09-17',
  dateSortable: '2026-09-17',
  itemCount: 1,
  quantity: 1,
  totalAmount: revenue,
  profitMargin: profit,
  itemNameOrSummary: `Part ${id}`,
  bulkSaleGroupId: 'bulk-1',
});

describe('bulk sale display grouping', () => {
  it('uses revenue-based profit margin for grouped sales', () => {
    const group = createBulkGroupDisplayItem('bulk-1', [
      sale('a', 600, 100),
      sale('b', 600, 100),
    ]);

    expect(group.totalRevenue).toBe(1200);
    expect(group.totalProfit).toBe(200);
    expect(group.totalCost).toBe(1000);
    expect(group.profitMarginPercent).toBeCloseTo(16.6667, 3);
  });
});
