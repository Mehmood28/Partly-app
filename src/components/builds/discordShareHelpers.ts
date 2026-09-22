import { PCBuild } from '../../types';

export interface BuildSpecsMap {
  GPU?: string;
  CPU?: string;
  Motherboard?: string;
  RAM?: string;
  Cooler?: string;
  Storage?: string;
  PSU?: string;
  Case?: string;
}

export const hasShareableBuildImage = (build: Pick<PCBuild, 'imageUrl'>): boolean =>
  typeof build.imageUrl === 'string' && build.imageUrl.trim().length > 0;

export function cleanSpecValue(val: string): string {
  if (!val) return '';
  let cleaned = val
    .replace(/\b(Processor|Desktop Processor|Internal SSD|PCIe \d\.\d|M\.2 2280|NVMe PCIe|Solid State Drive)\b/gi, '')
    .replace(/\b(Fully Modular|Power Supply|Gaming Case|Computer Case|ATX Mid Tower|Mid-Tower Case)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || val;
}

export function extractBuildSpecs(parts: Array<{category: string; name: string; quantity: number; source?: string}>): BuildSpecsMap {
  const specs: BuildSpecsMap = {};
  
  const hasMultipleSources = parts.some(p => p.source?.endsWith('_BASE')) && parts.some(p => p.source === 'ALLOCATED_UPGRADE');

  const formatPartName = (p: {category: string; name: string; quantity: number; source?: string}) => {
    let name = cleanSpecValue(p.name);
    if (hasMultipleSources && p.source === 'ALLOCATED_UPGRADE') {
      name = `${name} (Upgrade)`;
    }
    return p.quantity > 1 ? `${p.quantity}x ${name}` : name;
  };

  const getPartsByCategory = (category: string) => {
    return parts.filter(p => String(p.category || '').toLowerCase() === String(category || '').toLowerCase());
  };

  const gpuParts = getPartsByCategory('GPU');
  if (gpuParts.length > 0) specs.GPU = gpuParts.map(formatPartName).join(' + ');

  const cpuParts = getPartsByCategory('CPU');
  if (cpuParts.length > 0) specs.CPU = cpuParts.map(formatPartName).join(' + ');

  const moboParts = getPartsByCategory('Motherboard');
  if (moboParts.length > 0) specs.Motherboard = moboParts.map(formatPartName).join(' + ');

  const ramParts = getPartsByCategory('RAM');
  if (ramParts.length > 0) specs.RAM = ramParts.map(formatPartName).join(' + ');

  const coolerParts = [...getPartsByCategory('Cooler'), ...getPartsByCategory('Cooling')];
  if (coolerParts.length > 0) specs.Cooler = coolerParts.map(formatPartName).join(' + ');

  const storageParts = getPartsByCategory('Storage');
  if (storageParts.length > 0) specs.Storage = storageParts.map(formatPartName).join(' + ');

  const psuParts = getPartsByCategory('PSU');
  if (psuParts.length > 0) specs.PSU = psuParts.map(formatPartName).join(' + ');

  const caseParts = getPartsByCategory('Case');
  if (caseParts.length > 0) specs.Case = caseParts.map(formatPartName).join(' + ');

  return specs;
}

export async function shareBuildImageToDiscord(buildName: string, imageBase64: string): Promise<void> {
  const payload = {
    buildName,
    imageBase64,
  };

  const response = await fetch('/api/share-build-image-discord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server responded with status ${response.status}`);
  }
}
