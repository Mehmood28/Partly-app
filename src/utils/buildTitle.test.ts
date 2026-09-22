import { describe, expect, it } from 'vitest';
import { formatShortCpuAndGpu, generateBuildTitleFromParts } from './buildTitle';

describe('build title formatting', () => {
  it('shortens AMD/Intel CPUs and NVIDIA/AMD GPUs consistently', () => {
    expect(formatShortCpuAndGpu('AMD Ryzen 7 9800X3D Processor', 'Gigabyte RTX 5070 Ti Eagle')).toBe('Ryzen 7 9800X3D + RTX 5070 Ti');
    expect(formatShortCpuAndGpu('Intel Core i9-14900K', 'ASUS RX 7900 XT')).toBe('i9-14900K + RX 7900 XT');
  });

  it('keeps the launchpad empty-name fallback distinct from the parts adapter', () => {
    expect(formatShortCpuAndGpu('', '')).toBe('');
    expect(generateBuildTitleFromParts([])).toBe('CPU');
  });

  it('keeps custom component names when no known short form matches', () => {
    expect(formatShortCpuAndGpu('Custom Engineering Sample', '')).toBe('Custom Engineering Sample');
  });
});
