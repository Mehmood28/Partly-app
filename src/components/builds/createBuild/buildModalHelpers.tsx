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
export { generateBuildTitleFromParts } from '../../../utils/buildTitle';

export const getCategoryIcon = (cat: ComponentCategory) => {
  switch (cat) {
    case 'CPU':
      return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
    case 'GPU':
      return <Monitor className="w-3.5 h-3.5 text-cyan-300" />;
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
