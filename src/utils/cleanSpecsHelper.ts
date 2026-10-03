import { PCBuild } from '../types';
import { getBuildPresentation } from './buildPresentation';

export interface SpecComponentItem {
  category: string;
  name?: string;
  componentName?: string;
  quantity?: number;
}

const CATEGORY_ORDER: { key: string; label: string; aliases: string[] }[] = [
  { key: 'CPU', label: 'CPU', aliases: ['cpu'] },
  { key: 'GPU', label: 'GPU', aliases: ['gpu', 'graphics card', 'video card'] },
  { key: 'Cooling', label: 'Cooler', aliases: ['cooling', 'cooler', 'cpu cooler', 'fan cooler', 'aio'] },
  { key: 'Motherboard', label: 'Motherboard', aliases: ['motherboard', 'mobo', 'board'] },
  { key: 'RAM', label: 'RAM', aliases: ['ram', 'memory'] },
  { key: 'Storage', label: 'Storage', aliases: ['storage', 'ssd', 'hdd', 'nvme'] },
  { key: 'Case', label: 'Case', aliases: ['case', 'chassis'] },
  { key: 'PSU', label: 'Power Supply', aliases: ['psu', 'power supply', 'power supply unit'] },
  { key: 'Fans', label: 'Fans', aliases: ['fans', 'case fans'] },
  { key: 'Accessories', label: 'Accessories', aliases: ['accessories', 'other', 'extras'] },
];

export function formatCleanSpecs(
  input: SpecComponentItem[] | PCBuild | null | undefined,
  allComponents?: any[]
): string {
  let parts: SpecComponentItem[] = [];

  if (Array.isArray(input)) {
    parts = input.filter(Boolean);
  } else if (input && typeof input === 'object') {
    if (allComponents) {
      const presentation = getBuildPresentation(input as PCBuild, allComponents);
      parts = (presentation?.allComponents || []).filter(Boolean);
    } else {
      parts = ((input as PCBuild).parts || []).filter(Boolean);
    }
  }

  if (!parts || parts.length === 0) {
    return `PC Specifications:\n(No components selected)`;
  }

  const specLines: string[] = [];

  for (const group of CATEGORY_ORDER) {
    const matchedParts = parts.filter((p) => {
      if (!p) return false;
      const cat = String(p.category || '').toLowerCase().trim();
      return group.aliases.some((alias) => cat === alias) || cat === group.key.toLowerCase();
    });

    if (matchedParts.length > 0) {
      const partNames = matchedParts
        .map((p) => {
          if (!p) return null;
          const rawName = p.name || p.componentName;
          const name = rawName ? String(rawName).trim() : 'Unknown Component';
          const qty = typeof p.quantity === 'number' && Number.isFinite(p.quantity) ? p.quantity : 1;
          return qty > 1 ? `${qty}x ${name}` : name;
        })
        .filter(Boolean);
      if (partNames.length > 0) {
        specLines.push(`• ${group.label}: ${partNames.join(' + ')}`);
      }
    }
  }

  // Also include any parts whose category didn't match standard groups
  const processedCategories = new Set(
    CATEGORY_ORDER.flatMap((g) => [g.key.toLowerCase(), ...g.aliases])
  );
  const leftoverParts = parts.filter((p) => {
    if (!p) return false;
    const cat = String(p.category || '').toLowerCase().trim();
    return !processedCategories.has(cat);
  });

  if (leftoverParts.length > 0) {
    const leftoverNames = leftoverParts
      .map((p) => {
        if (!p) return null;
        const rawName = p.name || p.componentName;
        const name = rawName ? String(rawName).trim() : 'Unknown Component';
        const qty = typeof p.quantity === 'number' && Number.isFinite(p.quantity) ? p.quantity : 1;
        return qty > 1 ? `${qty}x ${name}` : name;
      })
      .filter(Boolean);
    if (leftoverNames.length > 0) {
      specLines.push(`• Other: ${leftoverNames.join(' + ')}`);
    }
  }

  return `PC Specifications:\n${specLines.join('\n')}`;
}

export async function copyCleanSpecs(
  input: SpecComponentItem[] | PCBuild | null | undefined,
  allComponents?: any[],
  clipboard?: { writeText: (text: string) => Promise<void> } | null
): Promise<{ success: boolean; text: string }> {
  const specText = formatCleanSpecs(input, allComponents);
  const targetClipboard =
    clipboard !== undefined
      ? clipboard
      : typeof navigator !== 'undefined'
      ? navigator.clipboard
      : null;

  if (targetClipboard && typeof targetClipboard.writeText === 'function') {
    try {
      await targetClipboard.writeText(specText);
      return { success: true, text: specText };
    } catch (_e) {
      // fallback below
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = specText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) return { success: true, text: specText };
    } catch (_err) {
      // ignore
    }
  }

  return { success: false, text: specText };
}
