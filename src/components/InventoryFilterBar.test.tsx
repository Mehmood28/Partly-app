import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, InventoryComponent } from '../types';
import { determineSubCategory, filterAndSortComponents, SUB_CATEGORIES } from '../utils/helpers';
import { InventoryFilterBar } from './InventoryFilterBar';

const component = (id: string, name: string, category: InventoryComponent['category'], date = '2026-01-01'): InventoryComponent => ({
  id,
  name,
  category,
  specifications: '',
  assignedCount: 0,
  purchaseHistory: [{ id: `${id}-batch`, date, condition: 'Used', quantity: 1, unitPrice: 100, totalPrice: 100, paymentMethod: 'Cash', platform: 'Shop' }],
});

const parts = [
  component('cpu', 'Ryzen 7 7700', 'CPU'),
  component('gpu', 'RTX 5070', 'GPU', '2026-03-01'),
  component('board', 'B650 board', 'Motherboard'),
];

describe('shared part picker filters', () => {
  it('renders available categories and subcategories in canonical order, with search and sort', () => {
    const markup = renderToStaticMarkup(
      <InventoryFilterBar
        components={parts}
        builds={[]}
        searchQuery=""
        onSearchChange={() => undefined}
        activeCategory="GPU"
        onCategoryChange={() => undefined}
        activeSubCategory=""
        onSubCategoryChange={() => undefined}
        onSortByChange={() => undefined}
      />
    );
    const shownCategories = CATEGORIES.filter((category) => parts.some((part) => part.category === category));
    const positions = shownCategories.map((category) => markup.indexOf(`${category} (1)`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const subPositions = SUB_CATEGORIES.GPU.map((sub) => markup.indexOf(`>${sub}</button>`));
    expect(subPositions).toEqual([...subPositions].sort((a, b) => a - b));
    expect(markup).toContain('Search parts by name or model');
    expect(markup).toContain('Recently Bought');
  });

  it('uses the same inferred subcategory for an older untagged part in every picker', () => {
    expect(determineSubCategory(parts[1])).toBe('50 Series');
    expect(filterAndSortComponents(parts, { category: 'GPU', subCategory: '50 Series', searchQuery: '5070', sortBy: 'newest-purchase', builds: [] }).map((part) => part.id)).toEqual(['gpu']);
  });
});
