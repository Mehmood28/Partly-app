import { ComponentCategory } from '../../../types';

export interface ExtractedPartInput {
  id: string;
  category: ComponentCategory;
  name: string;
  quantity: number;
  unitCost: number;
  isLocked?: boolean;
  tags?: string[];
}

export const CATEGORY_WEIGHTS: Record<ComponentCategory, number> = {
  GPU: 0.38,
  CPU: 0.22,
  Motherboard: 0.12,
  RAM: 0.08,
  Storage: 0.06,
  PSU: 0.06,
  Case: 0.05,
  Cooling: 0.03,
  Fans: 0.02,
  Accessories: 0.02,
  Other: 0.02,
};

export const STANDARD_8_CATEGORIES: ComponentCategory[] = [
  'GPU',
  'CPU',
  'Motherboard',
  'RAM',
  'Cooling',
  'Storage',
  'PSU',
  'Case',
];

export const createInitialParts = (): ExtractedPartInput[] => {
  return STANDARD_8_CATEGORIES.map((category, idx) => ({
    id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    category,
    name: '',
    quantity: 1,
    unitCost: 0,
    isLocked: false,
    tags: [],
  }));
};
