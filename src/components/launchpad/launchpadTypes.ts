import { InventoryComponent, PCBuild } from '../../types';

export interface RecommendedBuild {
  id: string;
  name: string;
  parts: (InventoryComponent & { assignedQty: number; avgCost: number })[];
  totalCost: number;
  estimatedPrice: number;
  projectedProfit: number;
  margin: number;
  tier?: string;
  tierName?: string;
  notes?: string;
  warning?: string;
}

export interface LaunchpadViewProps {
  setActiveTab: (tab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data') => void;
  onNavigateToBuilds?: (filter?: 'Available' | 'Pending' | 'Sold') => void;
  onOpenAddBuild: (initialData?: Partial<PCBuild>) => void;
  onOpenAddComponent?: () => void;
  onOpenBulkEntry?: () => void;
}
