import {
  AppState,
  ComponentCategory,
  InventoryComponent,
  PCBuild,
  PurchaseEntry,
  TransactionLogItem,
} from '../types';
import { MonthlyBaselineValues } from '../utils/baselineStats';

export interface BulkSaleLine {
  componentId: string;
  purchaseEntryId: string;
  quantity: number;
  unitSalePrice: number;
}

export interface BulkSaleSharedData {
  saleDate: string;
  buyerName?: string;
  platform?: PurchaseEntry['platform'];
  paymentMethod?: PurchaseEntry['paymentMethod'];
  notes?: string;
}

export interface SellComponentPartData {
  quantity: number;
  unitSalePrice: number;
  saleDate: string;
  platform?: PurchaseEntry['platform'];
  paymentMethod?: PurchaseEntry['paymentMethod'];
  buyerName?: string;
  notes?: string;
  incomingTradePart?: {
    name: string;
    category: ComponentCategory;
    tradeInCredit: number;
    tags?: string[];
  };
}

export interface ExchangeComponentPartData {
  quantity: number;
  cashPaidOnTop: number;
  exchangeDate: string;
  platform?: PurchaseEntry['platform'];
  paymentMethod?: PurchaseEntry['paymentMethod'];
  notes?: string;
  incomingPart: {
    name: string;
    category: ComponentCategory;
    tags?: string[];
  };
}

export interface SellBuildData {
  salePrice: number;
  warrantyDaysAtSale?: number;
  saleDate: string;
  builtDate?: string;
  platformSoldOn: PCBuild['platformSoldOn'];
  paymentMethod: PCBuild['paymentMethod'];
  buyerName?: string;
  buyerPhone?: string;
  imageUrl?: string;
  tradeIn?: {
    tradeInCredit: number;
    tradeInBuildName: string;
    tradeInNotes?: string;
  } | null;
}

export interface SaveComponentOptions {
  componentData: Omit<InventoryComponent, 'id' | 'assignedCount'>;
  existingComponentId?: string;
  newPurchaseEntry?: Omit<PurchaseEntry, 'id'>;
  updatedPurchaseEntry?: {
    entryId: string;
    entry: Omit<PurchaseEntry, 'id'>;
  };
}

export interface SessionHistoryItem {
  label: string;
  privacySafeLabel?: string;
  timestamp: number;
}

export interface ImportDataResult {
  success: boolean;
  changed: boolean;
  error?: string;
}

export interface InventoryContextType {
  state: AppState;
  isHydrated: boolean;
  undoCount: number;
  undo: () => void;
  redoCount: number;
  redo: () => void;
  undoHistory: SessionHistoryItem[];
  redoHistory: SessionHistoryItem[];
  resetToDefault: () => Promise<ImportDataResult>;

  // Component Actions
  saveComponent: (options: SaveComponentOptions) => { success: boolean; error?: string };
  addComponent: (comp: Omit<InventoryComponent, 'id' | 'assignedCount'>) => void;
  addComponents: (comps: Omit<InventoryComponent, 'id' | 'assignedCount'>[]) => void;
  updateComponent: (id: string, updates: Partial<InventoryComponent>) => void;
  deleteComponent: (id: string) => { success: boolean; error?: string };
  addPurchaseEntry: (componentId: string, entry: Omit<PurchaseEntry, 'id'>) => void;
  updatePurchaseEntry: (componentId: string, entryId: string, entry: Omit<PurchaseEntry, 'id'>) => { success: boolean; error?: string };
  deletePurchaseEntry: (componentId: string, entryId: string) => { success: boolean; error?: string };
  updateMarketValue: (componentId: string, value: number) => void;
  sellComponentPart: (
    componentId: string,
    purchaseEntryId: string,
    saleData: SellComponentPartData
  ) => { success: boolean; error?: string };
  sellComponentPartsBulk: (
    lines: BulkSaleLine[],
    sharedSaleData: BulkSaleSharedData
  ) => { success: boolean; error?: string };
  exchangeComponentPart: (
    outgoingComponentId: string,
    outgoingPurchaseEntryId: string,
    exchangeData: ExchangeComponentPartData
  ) => { success: boolean; error?: string };

  // Build Actions
  addBuild: (build: Omit<PCBuild, 'id' | 'createdDate'>) => void;
  addImportedBuilds: (builds: PCBuild[]) => void;
  updateBuildStatus: (buildId: string, status: PCBuild['status']) => void;
  updateBuild: (buildId: string, updates: Partial<PCBuild>) => void;
  allocatePartToBuild: (
    buildId: string,
    componentId: string,
    purchaseEntryId: string,
    quantity: number
  ) => { success: boolean; error?: string };
  removePartFromBuild: (
    buildId: string,
    componentId: string,
    purchaseEntryId?: string
  ) => { success: boolean; error?: string };
  swapPartInBuild: (
    buildId: string,
    oldComponentId: string,
    oldPurchaseEntryId: string | undefined,
    newComponentId: string,
    newPurchaseEntryId: string,
    quantity: number
  ) => { success: boolean; error?: string };
  sellBuild: (
    buildId: string,
    saleData: SellBuildData
  ) => { success: boolean; error?: string };
  relistBuild: (buildId: string) => { success: boolean; error?: string };
  deleteBuild: (buildId: string) => void;
  saveTradeInComponentBreakdown: (
    buildId: string,
    breakdown: { id?: string; category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[]
  ) => { success: boolean; error?: string };
  dismantleBuild: (
    buildId: string,
    extractedParts?: { category: ComponentCategory; name: string; quantity: number; unitCost: number }[]
  ) => { success: boolean; error?: string };

  // Transaction Actions
  addTransaction: (tx: Omit<TransactionLogItem, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<TransactionLogItem>) => void;
  deleteTransaction: (id: string) => void;
  deleteBulkPartSale: (bulkSaleGroupId: string) => void;
  relistPartSale: (transactionId: string) => void;
  relistBulkPartSale: (bulkSaleGroupId: string) => void;

  // Sync & Analytics Actions
  importData: (data: Partial<AppState>) => Promise<ImportDataResult>;
  updateMonthlyBaseline: (
    year: number,
    monthIndex: number,
    values: MonthlyBaselineValues
  ) => { success: boolean; error?: string };
  updateMonthlyGoal: (goal: number) => void;

  // Backup state
  lastBackupTimestamp: number | null;
  actionsSinceBackup: number;
  recordBackup: () => void;
}
