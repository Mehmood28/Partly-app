import { ComponentCategory } from '../types';

export interface BuildTitlePart {
  category: ComponentCategory;
  componentName: string;
}

export const generateBuildTitleFromParts = (parts: BuildTitlePart[]): string => {
  const cpuName = parts.find((part) => part.category === 'CPU')?.componentName || 'CPU';
  const gpuName = parts.find((part) => part.category === 'GPU')?.componentName || '';

  let shortCpu = cpuName;
  if (cpuName.toUpperCase().includes('INTEL') || cpuName.toUpperCase().includes('CORE')) {
    const match = cpuName.match(/(i\d-\d{4,5}[a-zA-Z0-9]*|\d{4,5}[a-zA-Z0-9]*)/i);
    if (match) shortCpu = match[0];
  } else {
    const match = cpuName.match(/Ryzen \d \d{4,5}[a-zA-Z0-9]*/i);
    if (match) shortCpu = match[0];
  }
  const shortGpu = gpuName.match(/(RTX|GTX|RX) \d{4}( XT| Ti| Super)?/i)?.[0] || gpuName.split(' ')[0];

  return gpuName ? `${shortCpu} + ${shortGpu}` : shortCpu;
};
