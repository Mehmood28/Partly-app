import { CATEGORIES, ComponentCategory } from '../types';

export const sortByCategory = <T extends { category: ComponentCategory | string }>(
  items: T[]
): T[] => {
  return [...items].sort((a, b) => {
    const idxA = CATEGORIES.indexOf(a.category as ComponentCategory);
    const idxB = CATEGORIES.indexOf(b.category as ComponentCategory);
    
    // If category not found, put it at the end
    const rankA = idxA === -1 ? 999 : idxA;
    const rankB = idxB === -1 ? 999 : idxB;
    
    return rankA - rankB;
  });
};
