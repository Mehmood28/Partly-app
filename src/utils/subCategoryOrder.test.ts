import { describe, expect, it } from 'vitest';
import { SUB_CATEGORIES } from './helpers';

describe('subcategory display order', () => {
  it('keeps platform filters consistent wherever they are rendered', () => {
    expect(SUB_CATEGORIES.CPU).toEqual(['AM5', 'AM4', 'Intel']);
    expect(SUB_CATEGORIES.Motherboard).toEqual(['AM5', 'AM4', 'Intel']);
  });

  it('shows dark hardware before white hardware', () => {
    expect(SUB_CATEGORIES.PSU).toEqual(['Black', 'White']);
    expect(SUB_CATEGORIES.Case).toEqual(['Black', 'White']);
  });
});
