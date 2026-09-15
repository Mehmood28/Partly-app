import { ComponentCategory, PCBuild, InventoryComponent } from '../types';
import { sortByCategory } from './sorting';
import { getAcquiredPCBreakdown } from './acquiredPC';

export type DisplayComponentSource = 'TRADE_IN_BASE' | 'PURCHASED_BASE' | 'ALLOCATED_UPGRADE';

export interface BuildDisplayComponent {
  id: string; // A stable display ID for list keys
  source: DisplayComponentSource;
  category: ComponentCategory;
  name: string;
  quantity: number;
  unitCost: number;
  tags?: string[];
  
  // For ALLOCATED_UPGRADE only:
  originalComponentId?: string;
  originalPurchaseEntryId?: string;
}

export interface BuildPresentation {
  baseComponents: BuildDisplayComponent[];
  upgrades: BuildDisplayComponent[];
  allComponents: BuildDisplayComponent[];
  lineCount: number;
  totalQuantity: number;
}

export function getBuildPresentation(build: PCBuild | null | undefined, components: InventoryComponent[]): BuildPresentation {
  if (!build) {
    return { baseComponents: [], upgrades: [], allComponents: [], lineCount: 0, totalQuantity: 0 };
  }

  const baseComponents: BuildDisplayComponent[] = [];
  const upgrades: BuildDisplayComponent[] = [];

  const acquiredBreakdown = getAcquiredPCBreakdown(build);
  if (acquiredBreakdown.length > 0) {
    for (let i = 0; i < acquiredBreakdown.length; i++) {
      const p = acquiredBreakdown[i];
      baseComponents.push({
        id: p.id || `base-${i}-${p.category}-${p.name}`,
        source: build.acquisitionSource === 'Purchased' ? 'PURCHASED_BASE' : 'TRADE_IN_BASE',
        category: p.category,
        name: p.name,
        quantity: p.quantity,
        unitCost: p.unitCost,
        tags: p.tags,
      });
    }
  }

  if (build.parts && build.parts.length > 0) {
    for (let i = 0; i < build.parts.length; i++) {
      const part = build.parts[i];
      const inventoryComponent = components.find(c => c.id === part.componentId);
      
      let name = part.componentName || 'Unknown Component';
      let tags: string[] = [];

      if (inventoryComponent) {
        name = inventoryComponent.name;
        tags = inventoryComponent.tags || [];
      }

      upgrades.push({
        id: `upg-${part.componentId}-${part.purchaseEntryId || i}-${part.unitCostAtAssignment}`,
        source: 'ALLOCATED_UPGRADE',
        category: part.category,
        name,
        quantity: part.quantity || 1,
        unitCost: part.unitCostAtAssignment,
        tags,
        originalComponentId: part.componentId,
        originalPurchaseEntryId: part.purchaseEntryId,
      });
    }
  }

  const sortedBase = sortByCategory(baseComponents);
  const sortedUpgrades = sortByCategory(upgrades);
  
  const allComponents = sortByCategory([...baseComponents, ...upgrades]);
  
  const lineCount = allComponents.length;
  const totalQuantity = allComponents.reduce((sum, c) => sum + c.quantity, 0);

  return {
    baseComponents: sortedBase,
    upgrades: sortedUpgrades,
    allComponents,
    lineCount,
    totalQuantity
  };
}
