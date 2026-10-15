export interface CompatibilityPart {
  category: string;
  name: string;
  tags?: string[];
}

export type SocketType = 'AM5' | 'AM4' | 'LGA1851' | 'LGA1700' | 'Intel' | 'AMD';
export type RamGeneration = 'DDR4' | 'DDR5';
export type FormFactor = 'ATX' | 'mATX' | 'ITX';

export const detectCpuSocket = (part: CompatibilityPart): SocketType | null => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('AM5')) return 'AM5';
  if (tags.includes('AM4')) return 'AM4';
  if (tags.includes('LGA1851')) return 'LGA1851';
  if (tags.includes('LGA1700')) return 'LGA1700';

  // Intel Core Ultra 200 series (Arrow Lake) uses LGA1851
  if (/Ultra\s+[3579]\s+\d{3}/i.test(name) || /LGA1851/i.test(name)) {
    return 'LGA1851';
  }

  // Intel 12th, 13th, 14th gen use LGA1700
  if (/i[3579]-?1[234]\d{3}/i.test(name) || /LGA1700/i.test(name)) {
    return 'LGA1700';
  }

  // AMD Ryzen 7000, 8000, 9000 use AM5
  if (/Ryzen\s+[3579]\s+[789]\d{3}/i.test(name) || /AM5/i.test(name)) {
    return 'AM5';
  }

  // AMD Ryzen 1000 through 5000 use AM4
  if (/Ryzen\s+[3579]\s+[12345]\d{3}/i.test(name) || /AM4/i.test(name)) {
    return 'AM4';
  }

  if (tags.includes('INTEL') || /^Intel/i.test(name)) {
    return 'Intel';
  }
  if (tags.includes('AMD') || /^AMD/i.test(name)) {
    return 'AMD';
  }

  return null;
};

export const detectMotherboardSocket = (part: CompatibilityPart): SocketType | null => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('AM5')) return 'AM5';
  if (tags.includes('AM4')) return 'AM4';
  if (tags.includes('LGA1851')) return 'LGA1851';
  if (tags.includes('LGA1700')) return 'LGA1700';

  if (/\b(B650|X670|B850|X870|A620)[A-Z0-9]*\b/i.test(name)) {
    return 'AM5';
  }
  if (/\b(A320|B350|X370|B450|X470|A520|B550|X570)[A-Z0-9]*\b/i.test(name)) {
    return 'AM4';
  }
  if (/\b(Z890|B860|H810)[A-Z0-9]*\b/i.test(name) || /LGA1851/i.test(name)) {
    return 'LGA1851';
  }
  if (/\b(Z690|B660|H610|Z790|B760|H770)[A-Z0-9]*\b/i.test(name) || /LGA1700/i.test(name)) {
    return 'LGA1700';
  }

  if (tags.includes('INTEL')) return 'Intel';
  return null;
};

export const detectRamGeneration = (part: CompatibilityPart): RamGeneration | null => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('DDR5') || /\bDDR5\b/i.test(name)) return 'DDR5';
  if (tags.includes('DDR4') || /\bDDR4\b/i.test(name)) return 'DDR4';
  return null;
};

export const detectMoboFormFactor = (part: CompatibilityPart): FormFactor => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('ITX') || /\b(Mini-ITX|Mini ITX|ITX)\b/i.test(name)) return 'ITX';
  if (tags.includes('MATX') || /\b(mATX|Micro-ATX|Micro ATX)\b/i.test(name) || /\b[BZXAH]\d{3}M\b/i.test(name) || /-M\b/i.test(name)) {
    return 'mATX';
  }
  return 'ATX';
};

export const detectCaseFormFactor = (part: CompatibilityPart): FormFactor => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('ITX') || /\b(Mini-ITX|Mini ITX|ITX|NR200|Terra|A4-H2O|Ridge|FormD|Chopin)\b/i.test(name)) {
    return 'ITX';
  }
  if (tags.includes('MATX') || /\b(mATX|Micro-ATX|Micro ATX)\b/i.test(name)) {
    return 'mATX';
  }
  return 'ATX';
};

export const detectCoolerSize = (part: CompatibilityPart): '360mm' | '240mm' | 'Air Cooler' | null => {
  const tags = (part.tags || []).map((t) => t.toUpperCase());
  const name = part.name.trim();

  if (tags.includes('360MM') || /\b360(?:mm)?\b/i.test(name)) return '360mm';
  if (tags.includes('240MM') || /\b240(?:mm)?\b/i.test(name)) return '240mm';
  if (tags.includes('AIR COOLER') || /Air Cooler/i.test(name)) return 'Air Cooler';
  return null;
};

export const detectCpuTdp = (part: CompatibilityPart): number => {
  const name = part.name.trim();
  const tags = (part.tags || []).map((t) => t.toUpperCase());

  // Check tags for explicit wattage e.g. '125W', '65W'
  for (const t of tags) {
    const tm = t.match(/^(\d{2,3})W$/i);
    if (tm) {
      const val = parseInt(tm[1], 10);
      if (val >= 35 && val <= 350) return val;
    }
  }

  // Check explicit wattage tag or name
  const wattMatch = name.match(/\b(\d{2,3})\s*W\b/i);
  if (wattMatch) {
    const val = parseInt(wattMatch[1], 10);
    if (val >= 35 && val <= 350) return val;
  }

  // Flagship / Enthusiast CPUs
  if (/i9-?1[34]\d{3}|Ultra\s+9|9950X|7950X/i.test(name)) return 220;
  if (/i7-?1[34]\d{3}|i9-?12\d{3}|Ultra\s+7|9900X|7900X|9800X3D|7800X3D/i.test(name)) return 150;
  if (/i5-?1[34]\d{3}|i7-?12\d{3}|Ultra\s+5|9700X|7700X|5800X3D/i.test(name)) return 120;
  if (/Ryzen\s+5\s+[79]\d{3}|i5-?12\d{3}/i.test(name)) return 90;
  if (/Ryzen\s+5\s+[35]\d{3}|i3-?\d{4}/i.test(name)) return 65;

  return 100;
};

export const detectGpuTdp = (part: CompatibilityPart): number => {
  const name = part.name.trim();

  // Enthusiast Tier
  if (/5090|4090/i.test(name)) return 450;
  if (/5080|4080|7900\s*XTX/i.test(name)) return 320;
  if (/5070\s*Ti|4070\s*Ti|7900\s*XT|3080\s*Ti|3090/i.test(name)) return 285;
  if (/3080/i.test(name)) return 320;
  if (/5070|4070\s*Super|7800\s*XT|6800\s*XT|3070\s*Ti/i.test(name)) return 220;
  if (/4070|3070|7700\s*XT/i.test(name)) return 200;
  if (/4060\s*Ti|3060\s*Ti|6700\s*XT/i.test(name)) return 165;
  if (/4060|3060|7600|6600/i.test(name)) return 120;

  return 200;
};

export const detectPsuWattage = (part: CompatibilityPart): number | null => {
  const name = part.name.trim();
  const tags = (part.tags || []).map((t) => t.toUpperCase());

  // Look for tag with wattage e.g. '850W' or '1000W'
  for (const t of tags) {
    const tm = t.match(/^(\d{3,4})W$/i);
    if (tm) return parseInt(tm[1], 10);
  }

  // Look for wattage pattern in name: e.g. '850W', '850 W', '850 Watt', 'RM850', 'SF750'
  const wattMatch = name.match(/\b(\d{3,4})\s*(?:W|Watt|Watts)\b/i);
  if (wattMatch) {
    const val = parseInt(wattMatch[1], 10);
    if (val >= 250 && val <= 2000) return val;
  }

  const modelMatch = name.match(/(?:RM|SF|GX|GF|TX|CX|AX|HX|PX|GM|FM|BM|GL|BN|MAG\s*A|MEG\s*A|Hydro)\s*(\d{3,4})/i);
  if (modelMatch) {
    const val = parseInt(modelMatch[1], 10);
    if (val >= 250 && val <= 2000) return val;
  }

  return null;
};

export const checkBuildCompatibility = (
  parts: Array<{ category: string; name: string; tags?: string[] }>
): string[] => {
  const warnings: string[] = [];

  const cpus = parts.filter((p) => p.category === 'CPU');
  const gpus = parts.filter((p) => p.category === 'GPU');
  const mobos = parts.filter((p) => p.category === 'Motherboard');
  const rams = parts.filter((p) => p.category === 'RAM');
  const cases = parts.filter((p) => p.category === 'Case');
  const coolers = parts.filter((p) => p.category === 'Cooling');
  const psus = parts.filter((p) => p.category === 'PSU');

  const cpu = cpus[0];
  const gpu = gpus[0];
  const mobo = mobos[0];
  const pcCase = cases[0];
  const cooler = coolers[0];
  const psu = psus[0];

  let cpuSocket: SocketType | null = null;
  let moboSocket: SocketType | null = null;

  // 1. CPU vs Motherboard socket (AM5, AM4, LGA1851, LGA1700)
  if (cpu && mobo) {
    cpuSocket = detectCpuSocket(cpu);
    moboSocket = detectMotherboardSocket(mobo);

    if (cpuSocket && moboSocket) {
      const isSpecificCpu = ['AM5', 'AM4', 'LGA1851', 'LGA1700'].includes(cpuSocket);
      const isSpecificMobo = ['AM5', 'AM4', 'LGA1851', 'LGA1700'].includes(moboSocket);

      if (isSpecificCpu && isSpecificMobo && cpuSocket !== moboSocket) {
        warnings.push(
          `Socket conflict: CPU (${cpu.name}) uses ${cpuSocket}, but Motherboard (${mobo.name}) uses ${moboSocket}.`
        );
      } else if (
        (cpuSocket === 'AM5' || cpuSocket === 'AM4') &&
        (moboSocket === 'Intel' || moboSocket === 'LGA1700' || moboSocket === 'LGA1851')
      ) {
        warnings.push(
          `Platform mismatch: AMD CPU (${cpu.name}) cannot be installed in Intel motherboard (${mobo.name}).`
        );
      } else if (
        (cpuSocket === 'Intel' || cpuSocket === 'LGA1700' || cpuSocket === 'LGA1851') &&
        (moboSocket === 'AM5' || moboSocket === 'AM4')
      ) {
        warnings.push(
          `Platform mismatch: Intel CPU (${cpu.name}) cannot be installed in AMD ${moboSocket} motherboard (${mobo.name}).`
        );
      }
    }
  }

  // 2. RAM generation (DDR4 vs DDR5) against CPU / Motherboard
  if (rams.length > 0) {
    const ramGen = detectRamGeneration(rams[0]);
    if (ramGen) {
      const targetSocket = moboSocket || cpuSocket || (mobo ? detectMotherboardSocket(mobo) : null) || (cpu ? detectCpuSocket(cpu) : null);
      const moboName = mobo?.name || '';
      const moboTags = (mobo?.tags || []).map((t) => t.toUpperCase());

      // AM5 and LGA1851 require DDR5 exclusively
      if (targetSocket === 'AM5' || targetSocket === 'LGA1851') {
        if (ramGen === 'DDR4') {
          warnings.push(
            `Memory incompatibility: ${rams[0].name} is DDR4, but ${targetSocket} platform requires DDR5.`
          );
        }
      }
      // AM4 requires DDR4 exclusively
      else if (targetSocket === 'AM4') {
        if (ramGen === 'DDR5') {
          warnings.push(
            `Memory incompatibility: ${rams[0].name} is DDR5, but AM4 platform requires DDR4.`
          );
        }
      }
      // LGA1700 motherboards specify DDR4 or DDR5
      else if (mobo) {
        const moboIsDdr4 = moboTags.includes('DDR4') || /\b(DDR4|D4)\b/i.test(moboName);
        const moboIsDdr5 = moboTags.includes('DDR5') || /\b(DDR5|D5)\b/i.test(moboName);

        if (moboIsDdr4 && ramGen === 'DDR5') {
          warnings.push(
            `Memory incompatibility: Motherboard (${mobo.name}) requires DDR4, but ${rams[0].name} is DDR5.`
          );
        } else if (moboIsDdr5 && ramGen === 'DDR4') {
          warnings.push(
            `Memory incompatibility: Motherboard (${mobo.name}) requires DDR5, but ${rams[0].name} is DDR4.`
          );
        }
      }
    }
  }

  // 3. Motherboard form factor (ATX, mATX, ITX) against Case form factor
  if (mobo && pcCase) {
    const moboFactor = detectMoboFormFactor(mobo);
    const caseFactor = detectCaseFormFactor(pcCase);

    if (caseFactor === 'ITX' && (moboFactor === 'ATX' || moboFactor === 'mATX')) {
      warnings.push(
        `Form factor conflict: Motherboard (${mobo.name}) is ${moboFactor}, but Case (${pcCase.name}) only supports Mini-ITX.`
      );
    } else if (caseFactor === 'mATX' && moboFactor === 'ATX') {
      warnings.push(
        `Form factor conflict: Motherboard (${mobo.name}) is standard ATX, but Case (${pcCase.name}) only supports Micro-ATX.`
      );
    }
  }

  // 4. 360mm Cooler against ITX Case
  if (cooler && pcCase) {
    const coolerSize = detectCoolerSize(cooler);
    const caseFactor = detectCaseFormFactor(pcCase);

    if (coolerSize === '360mm' && caseFactor === 'ITX') {
      warnings.push(
        `Size conflict: 360mm cooler (${cooler.name}) will not fit in compact Mini-ITX case (${pcCase.name}).`
      );
    }
  }

  // 5. Estimated wattage vs PSU wattage
  if (psu && (cpu || gpu)) {
    const psuWattage = detectPsuWattage(psu);
    if (psuWattage) {
      const cpuTdp = cpu ? detectCpuTdp(cpu) : 65;
      const gpuTdp = gpu ? detectGpuTdp(gpu) : 0;
      const estimatedWattage = cpuTdp + gpuTdp + 100; // 100W buffer for mobo, RAM, fans, SSDs

      if (psuWattage < estimatedWattage) {
        const recommendedWattage = estimatedWattage <= 650 ? '650W' : estimatedWattage <= 750 ? '750W' : '850W+';
        warnings.push(
          `Power warning: Estimated build consumption (~${estimatedWattage}W with 100W overhead) exceeds PSU capacity (${psuWattage}W). A ${recommendedWattage} PSU is recommended.`
        );
      }
    }
  }

  return warnings;
};
