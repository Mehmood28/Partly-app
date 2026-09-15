import { describe, expect, it } from 'vitest';
import { allocateOptionalPartCosts, ExtractedPartInput } from './dismantleHelpers';

const part = (
  id: string,
  category: ExtractedPartInput['category'],
  name: string,
  overrides: Partial<ExtractedPartInput> = {}
): ExtractedPartInput => ({
  id,
  category,
  name,
  quantity: 1,
  unitCost: 0,
  isLocked: false,
  ...overrides,
});

describe('allocateOptionalPartCosts', () => {
  it('ignores blank damaged or unwanted rows and allocates the exact whole-PC price', () => {
    const result = allocateOptionalPartCosts([
      part('gpu', 'GPU', 'ASUS KO RTX 3060 12GB'),
      part('cpu', 'CPU', 'Ryzen 5 5600X'),
      part('board', 'Motherboard', 'Gigabyte B350M-DS3H'),
      part('ram', 'RAM', '16GB DDR4-3200'),
      part('cooler', 'Cooling', 'Cooler Master Hyper 212 Evo'),
      part('storage', 'Storage', '1TB M.2 SSD'),
      part('psu', 'PSU', 'Gigabyte 650W'),
      part('case', 'Case', ''),
      part('fans', 'Fans', '   '),
    ], 520);

    expect(result.success).toBe(true);
    expect(result.parts).toHaveLength(7);
    expect(result.parts.some((candidate) => candidate.category === 'Case')).toBe(false);
    expect(result.parts.some((candidate) => candidate.category === 'Fans')).toBe(false);
    expect(result.parts.reduce(
      (sum, candidate) => sum + Math.round(candidate.quantity * candidate.unitCost * 100),
      0
    )).toBe(52000);
  });

  it('preserves manually locked costs while splitting the remainder', () => {
    const result = allocateOptionalPartCosts([
      part('gpu', 'GPU', 'RTX 3060', { unitCost: 300, isLocked: true }),
      part('cpu', 'CPU', 'Ryzen 5 5600X'),
      part('board', 'Motherboard', 'B350M'),
    ], 520);

    expect(result.success).toBe(true);
    expect(result.parts.find((candidate) => candidate.id === 'gpu')?.unitCost).toBe(300);
    expect(result.parts.reduce(
      (sum, candidate) => sum + Math.round(candidate.quantity * candidate.unitCost * 100),
      0
    )).toBe(52000);
  });

  it('allows a PC purchase to be recorded before any component is itemized', () => {
    const result = allocateOptionalPartCosts([
      part('case', 'Case', ''),
      part('fans', 'Fans', ''),
    ], 520);

    expect(result).toEqual({ success: true, parts: [] });
  });

  it('rejects locked component costs above the total PC price', () => {
    const result = allocateOptionalPartCosts([
      part('gpu', 'GPU', 'RTX 3060', { unitCost: 600, isLocked: true }),
      part('cpu', 'CPU', 'Ryzen 5 5600X'),
    ], 520);

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceed');
  });
});
