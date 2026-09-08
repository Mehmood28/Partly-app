export type ComponentCategory =
  | 'GPU'
  | 'CPU'
  | 'RAM'
  | 'Storage'
  | 'Motherboard'
  | 'PSU'
  | 'Case'
  | 'Cooling'
  | 'Fans'
  | 'Accessories'
  | 'Other';

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  'GPU',
  'CPU',
  'RAM',
  'Storage',
  'Motherboard',
  'PSU',
  'Case',
  'Cooling',
  'Fans',
  'Accessories',
  'Other',
];

export type Condition = 'Sealed' | 'New Open Box' | 'New No Box' | 'Used Open Box' | 'Used No Box' | 'Used';

export type PaymentMethod =
  | 'E-Transfer'
  | 'Cash'
  | 'PayPal'
  | 'Credit Card'
  | 'Debit'
  | 'Crypto'
  | 'Trade-In';

export type Platform = string;

export interface PurchaseEntry {
  id: string;
  date: string; // e.g. "2026-07-31"
  condition: Condition;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  platform: Platform;
  taxPercent?: number; // e.g. 13 for 13% tax
  notes?: string;
  _originalComponentId?: string;
  sourceTradeInBuildId?: string;
  sourceSaleTransactionId?: string;
}

export interface InventoryComponent {
  id: string;
  name: string; // e.g. "ASUS Prime RTX 5080"
  category: ComponentCategory;
  specifications: string; // e.g. "Black" or "2x16 GB · 6400MHz · CL32 · DDR5 · Black"
  purchaseHistory: PurchaseEntry[];
  tags?: string[];
  targetMarketValuePerUnit?: number; // Target/estimated market value per unit
  assignedCount: number; // Number of units assigned to active or sold PC builds
  soldCount?: number; // Number of units sold individually as loose parts
  unresolvedLegacyReservationByPurchaseEntryId?: Record<string, number>; // Availability fallback metadata for unlinked legacy allocations
}

export interface PCBuildPart {
  componentId: string;
  componentName: string;
  purchaseEntryId?: string;
  category: ComponentCategory;
  quantity: number;
  unitCostAtAssignment: number; // Weighted average cost per unit at time of build
}

export type BuildStatus = 'In Progress' | 'Listed for Sale' | 'Sold' | 'Trade-In Processing';

export interface PCBuild {
  id: string;
  warrantyDays?: number;
  name: string; // e.g. "7700 + 4070 CUSTOM"
  parts: PCBuildPart[];
  tradeInComponentBreakdown?: {
    id: string;
    category: ComponentCategory;
    name: string;
    quantity: number;
    unitCost: number;
    tags?: string[];
  }[];
  status: BuildStatus;
  createdDate: string;
  builtDate?: string; // Date when the PC was physically built
  completionDate?: string; // Date when rig was marked Listed for Sale or Completed
  daysOnMarket?: number; // Days between completion and sale
  estimatedCost?: number;
  notes?: string;
  imageUrl?: string;
  acquisitionSource?: 'Built' | 'Trade-In';
  sourceSaleTransactionId?: string; // Immutable ID of the sale transaction where this trade-in PC was acquired
  saleTransactionId?: string; // Immutable ID of the sale transaction for this sold PC build
  // Sale details if sold
  saleDate?: string;
  salePrice?: number;
  platformSoldOn?: Platform;
  paymentMethod?: PaymentMethod;
  buyerName?: string;
  buyerPhone?: string;
  costAdjustment?: number;
  _reconcileTag?: string;
}

export type TransactionType = 'SALE' | 'PURCHASE' | 'BUILD_ALLOCATION' | 'EXCHANGE';

export interface TransactionLogItem {
  id: string;
  warrantyDaysAtSale?: number;
  type: TransactionType;
  title: string; // e.g. "Sold: Facebook Marketplace" or "Purchased: Amazon"
  timestamp: string; // e.g. "2026-07-23 1:44 PM" or "2026-07-23"
  dateSortable: string; // ISO or YYYY-MM-DD
  itemCount: number;
  quantity: number;
  totalAmount: number; // Sale price, purchase cost, or cash paid on top
  profitMargin?: number; // e.g. +160.00 for sales, 0 for exchanges
  platform?: Platform;
  paymentMethod?: PaymentMethod;
  secondaryPaymentMethod?: PaymentMethod;
  itemNameOrSummary: string; // e.g. "1 TB Lexar NQ780" or "Gigabyte Windforce RTX 5070 Ti"
  detailsList?: string[]; // e.g. ["MSI MAG A850GN", "2 TB Lexar NQ780", "32 GB Teamgroup T-FORCE VULCAN"]
  relatedComponentId?: string;
  relatedComponentQty?: number;
  cashPortion?: number;
  tradeInCredit?: number;
  buyerName?: string;

  // Exact-batch & Bulk Sale metadata
  relatedPurchaseEntryId?: string;
  soldUnitCost?: number;
  bulkSaleGroupId?: string;
  originalPurchaseEntrySnapshot?: PurchaseEntry;

  // Additive metadata for EXCHANGE / Trade Up
  outgoingComponentId?: string;
  outgoingPurchaseEntryId?: string;
  outgoingQuantity?: number;
  outgoingCostBasis?: number;
  cashPaidOnTop?: number;
  incomingComponentId?: string;
  incomingPurchaseEntryId?: string;
  incomingCostBasis?: number;
  exchangeType?: 'TRADE_UP';
  notes?: string;

  // Trade-In & Dismantle metadata
  incomingTradeInBuildId?: string;
  tradeInBuildName?: string;
  tradeInDescription?: string;
  tradeInNotes?: string;
  buildActivityKind?: 'DISMANTLE' | 'TRADE_IN_PART_OUT';
}

export interface SheetStats {
  monthly: {
    year?: number;
    month: string;
    revenue: number;
    profit: number;
    pcsSold: number;
  }[];
  yearly: {
    revenue: number;
    profit: number;
    pcsSold: number;
  };
}

export interface AppState {
  components: InventoryComponent[];
  builds: PCBuild[];
  transactions: TransactionLogItem[];
  sheetStats?: SheetStats;
  monthlyGoal?: number;
}

export const CATEGORIES: ComponentCategory[] = [
  'GPU',
  'CPU',
  'Motherboard',
  'RAM',
  'Cooling',
  'Storage',
  'PSU',
  'Case',
  'Fans',
  'Accessories',
  'Other',
];
