import { describe, expect, it } from 'vitest';
import { CATEGORIES, ComponentCategory } from '../types';
import { sortByCategory } from './sorting';

describe('component display order', () => {
  it('uses the same canonical category order across every picker and list', () => {
    expect(CATEGORIES).toEqual([
      'GPU',
      'CPU',
      'Motherboard',
      'RAM',
      'Cooling',
      'Storage',
      'PSU',
      'Case',
      'Fans',
      'Accessories',
      'Other',
    ]);
  });

  it('sorts build parts by that order and leaves unknown categories last', () => {
    const items = [
      { category: 'Case' },
      { category: 'GPU' },
      { category: 'Cooling' },
      { category: 'Motherboard' },
      { category: 'Legacy' },
    ] as Array<{ category: ComponentCategory | 'Legacy' }>;

    expect(sortByCategory(items).map((item) => item.category)).toEqual([
      'GPU',
      'Motherboard',
      'Cooling',
      'Case',
      'Legacy',
    ]);
  });
});
