import { ComponentCategory } from '../types';

export interface BuildTitlePart {
  category: ComponentCategory;
  componentName: string;
}

export const formatShortCpuAndGpu = (cpuName: string, gpuName: string): string => {
  let shortCpu = cpuName
    .replace(/\s*\(\d+C\/\d+T\)/i, '')
    .replace(/\s*\(\d+-Core[^\)]*\)/i, '')
    .replace(/\s*\d+-Core\s+Processor/i, '')
    .trim();

  const ultraMatch = cpuName.match(/(?:Intel\s+)?(?:Core\s+)?(Ultra\s+[3579]\s+\d{3,4}[a-zA-Z0-9]*(?:\s+Plus)?)/i);
  const ryzenMatch = cpuName.match(/(Ryzen\s+[3579]\s+\d{4,5}[a-zA-Z0-9]*(?:\s*X3D|\s*XT|\s*X|\s*G)?)/i);
  const iSeriesMatch = cpuName.match(/(i[3579]-?\s*\d{4,5}[a-zA-Z0-9]*)/i);

  if (ultraMatch) {
    shortCpu = ultraMatch[1].replace(/\s+/g, ' ');
  } else if (ryzenMatch) {
    shortCpu = ryzenMatch[1].replace(/\s+/g, ' ');
  } else if (iSeriesMatch) {
    shortCpu = iSeriesMatch[1].replace(/\s+/g, ' ');
  }

  const shortGpu = gpuName.match(/(RTX|GTX|RX|ARC)\s*\d{4}(?:\s*XTX|\s*XT|\s*GRE|\s*Ti\s*Super|\s*Ti|\s*Super)?/i)?.[0] || gpuName.split(' ')[0];
  return gpuName ? `${shortCpu} + ${shortGpu}` : shortCpu;
};

export const generateBuildTitleFromParts = (parts: BuildTitlePart[]): string => {
  const cpuName = parts.find((part) => part.category === 'CPU')?.componentName || 'CPU';
  const gpuName = parts.find((part) => part.category === 'GPU')?.componentName || '';
  return formatShortCpuAndGpu(cpuName, gpuName);
};
