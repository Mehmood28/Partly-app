import {
  Cpu,
  Monitor,
  HardDrive,
  Database,
  CircuitBoard,
  Zap,
  Box,
  Fan,
  Package,
} from 'lucide-react';
import { ComponentCategory, InventoryComponent, PCBuild, PCBuildPart } from '../../../types';
import { getAllBatchesWithRemaining } from '../../../utils/helpers';

export const getCategoryIcon = (cat: ComponentCategory) => {
  switch (cat) {
    case 'CPU':
      return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
    case 'GPU':
      return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
    case 'RAM':
      return <HardDrive className="w-3.5 h-3.5 text-emerald-400" />;
    case 'Storage':
      return <Database className="w-3.5 h-3.5 text-blue-400" />;
    case 'Motherboard':
      return <CircuitBoard className="w-3.5 h-3.5 text-pink-400" />;
    case 'PSU':
      return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
    case 'Case':
      return <Box className="w-3.5 h-3.5 text-orange-400" />;
    case 'Cooling':
    case 'Fans':
      return <Fan className="w-3.5 h-3.5 text-cyan-400" />;
    default:
      return <Package className="w-3.5 h-3.5 text-zinc-400" />;
  }
};

export const generateBuildTitleFromParts = (selectedParts: PCBuildPart[]): string => {
  const cpuName = selectedParts.find(p => p.category === 'CPU')?.componentName || 'CPU';
  const gpuName = selectedParts.find(p => p.category === 'GPU')?.componentName || '';
  
  let shortCpu = cpuName;
  if (cpuName.toUpperCase().includes('INTEL') || cpuName.toUpperCase().includes('CORE')) {
    const match = cpuName.match(/(i\d-\d{4,5}[a-zA-Z0-9]*|\d{4,5}[a-zA-Z0-9]*)/i);
    if (match) shortCpu = match[0];
  } else {
    const match = cpuName.match(/Ryzen \d \d{4,5}[a-zA-Z0-9]*/i);
    if (match) shortCpu = match[0];
  }
  const shortGpu = gpuName.match(/(RTX|GTX|RX) \d{4}( XT| Ti| Super)?/i)?.[0] || gpuName.split(' ')[0];

  if (gpuName) {
    return `${shortCpu} + ${shortGpu}`;
  } else {
    return `${shortCpu}`;
  }
};

export interface ComponentBatchInfo {
  entry: InventoryComponent['purchaseHistory'][0];
  remainingUnassigned: number;
}

export interface ComponentGroupWithStock {
  comp: InventoryComponent;
  batches: ComponentBatchInfo[];
  totalUnassigned: number;
  weightedAvgCost: number;
}

export const calculateComponentBatchesWithStock = (
  comp: InventoryComponent,
  builds: PCBuild[],
  selectedParts: PCBuildPart[],
  initialBuildId?: string
): ComponentGroupWithStock => {
  const effectiveBuilds = initialBuildId
    ? builds.filter((build) => build.id !== initialBuildId)
    : builds;
  const batches = getAllBatchesWithRemaining(comp, effectiveBuilds)
    .map(({ entry, availableQuantity }) => {
      const qtyInBuild = selectedParts.reduce(
        (sum, part) =>
          part.componentId === comp.id && part.purchaseEntryId === entry.id
            ? sum + part.quantity
            : sum,
        0
      );
      return {
        entry,
        remainingUnassigned: Math.max(0, availableQuantity - qtyInBuild),
        qtyInBuild,
      };
    })
    .filter(({ remainingUnassigned, qtyInBuild }) => remainingUnassigned > 0 || qtyInBuild > 0)
    .map(({ entry, remainingUnassigned }) => ({ entry, remainingUnassigned }));

  const totalUnassigned = batches.reduce((sum, b) => sum + b.remainingUnassigned, 0);
  const totalUnassignedValue = batches.reduce(
    (sum, b) => sum + b.remainingUnassigned * b.entry.unitPrice,
    0
  );
  const weightedAvgCost = totalUnassigned > 0 ? totalUnassignedValue / totalUnassigned : 0;

  return { comp, batches, totalUnassigned, weightedAvgCost };
};
