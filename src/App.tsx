import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LaunchpadView } from './components/LaunchpadView';
import { StockView } from './components/StockView';
import { BuildsView, FilterStatus } from './components/BuildsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DataSyncView } from './components/DataSyncView';
import { ComponentModal } from './components/ComponentModal';
import { PurchaseEntryModal } from './components/PurchaseEntryModal';
import { ConfirmModal } from './components/ConfirmModal';
import { BuildModal } from './components/BuildModal';
import { BuyPCModal } from './components/builds/BuyPCModal';
import { SellPartModal } from './components/parts/sellPart/SellPartModal';
import { BulkStockEntryModal, ParsedBulkStockItem } from './components/BulkStockEntryModal';
import { InventoryComponent, PCBuild, PurchaseEntry } from './types';

function AppContent() {
  const { showToast } = useToast();
  const {
    state,
    saveComponent,
    addComponents,
    addPurchaseEntry,
    addBuild,
    purchasePC,
    resetToDefault,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data'>('launchpad');
  const [buildsStatusFilter, setBuildsStatusFilter] = useState<FilterStatus>('Available');

  // Modals state
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState<boolean>(false);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState<boolean>(false);
  const [isBulkEntryModalOpen, setIsBulkEntryModalOpen] = useState<boolean>(false);
  const [editingComponent, setEditingComponent] = useState<InventoryComponent | null>(null);

  const [purchaseModalComponentId, setPurchaseModalComponentId] = useState<string | null>(null);

  const [isBuildModalOpen, setIsBuildModalOpen] = useState<boolean>(false);
  const [isBuyPCModalOpen, setIsBuyPCModalOpen] = useState<boolean>(false);
  const [initialBuildData, setInitialBuildData] = useState<Partial<PCBuild> | null>(null);

  const [isSellPartModalOpen, setIsSellPartModalOpen] = useState<boolean>(false);
  const [sellPartPreselectedComp, setSellPartPreselectedComp] = useState<InventoryComponent | null>(null);
  const [sellPartPreselectedEntryId, setSellPartPreselectedEntryId] = useState<string | null>(null);

  const handleTabChange = React.useCallback((tab: 'launchpad' | 'inventory' | 'builds' | 'analytics' | 'data') => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleNavigateToBuilds = React.useCallback((filter?: FilterStatus) => {
    if (filter) {
      setBuildsStatusFilter(filter);
    }
    setActiveTab('builds');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const isInventoryComponent = (val: unknown): val is InventoryComponent => {
    return !!val && typeof val === 'object' && 'id' in val && typeof (val as { id: unknown }).id === 'string' && 'category' in val;
  };

  const handleOpenSellPart = React.useCallback((comp?: InventoryComponent | unknown, entryId?: string) => {
    if (entryId) {
      setSellPartPreselectedEntryId(entryId);
    } else {
      setSellPartPreselectedEntryId(null);
    }
    if (isInventoryComponent(comp)) {
      setSellPartPreselectedComp(comp);
    } else {
      setSellPartPreselectedComp(null);
    }
    setIsSellPartModalOpen(true);
  }, []);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isResetting, setIsResetting] = useState(false);

  const handleSaveBulkItems = (parsedItems: ParsedBulkStockItem[]) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const newComps: Omit<InventoryComponent, 'id' | 'assignedCount'>[] = parsedItems.map(item => {
      const ph: PurchaseEntry = {
        id: `ph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        date: item.date || today,
        condition: item.condition || 'New Open Box',
        quantity: item.quantity || 1,
        unitPrice: item.unitCost || 0,
        totalPrice: (item.quantity || 1) * (item.unitCost || 0),
        paymentMethod: item.paymentMethod || 'Cash',
        platform: item.vendor || 'Other',
        notes: 'Bulk imported'
      };
      
      return {
        name: item.name,
        category: item.category,
        specifications: '',
        purchaseHistory: [ph],
        targetMarketValuePerUnit: (item.unitCost || 0) * 1.5, // Default market-value estimate.
      };
    });
    
    addComponents(newComps);
  };

  const handleOpenAddComponent = React.useCallback(() => {
    setEditingComponent(null);
    setIsComponentModalOpen(true);
  }, []);

  const handleOpenBulkEntry = React.useCallback(() => {
    setIsBulkEntryModalOpen(true);
  }, []);

  const handleEditComponent = React.useCallback((comp: InventoryComponent) => {
    setEditingComponent(comp);
    setIsComponentModalOpen(true);
  }, []);

  const handleSaveComponent = (
    compData: Omit<InventoryComponent, 'id' | 'assignedCount'>,
    purchaseEntry?: Omit<PurchaseEntry, 'id'>,
    existingComponentId?: string,
    updatedPurchaseEntry?: { entryId: string; entry: Omit<PurchaseEntry, 'id'> }
  ) => {
    const targetId = existingComponentId || (editingComponent ? editingComponent.id : undefined);
    return saveComponent({
      componentData: {
        name: compData.name,
        category: compData.category,
        specifications: compData.specifications,
        tags: compData.tags,
        targetMarketValuePerUnit: compData.targetMarketValuePerUnit,
        purchaseHistory: compData.purchaseHistory,
      },
      existingComponentId: targetId,
      newPurchaseEntry: purchaseEntry,
      updatedPurchaseEntry,
    });
  };

  const handleOpenAddPurchaseEntry = React.useCallback((componentId: string) => {
    setPurchaseModalComponentId(componentId);
  }, []);

  const handleResetAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset & Clear All Data',
      message: 'This permanently clears all inventory, builds, transactions, and statistics on this device. Export a backup first if you may need to restore it.',
      onConfirm: async () => {
        setIsResetting(true);
        try {
          const result = await resetToDefault();
          if (!result.success) {
            showToast(result.error || 'Unable to clear the data.', 'error');
            return;
          }

          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showToast(result.changed ? 'All data was cleared.' : 'The app data is already empty.', result.changed ? 'success' : 'info');
        } finally {
          setIsResetting(false);
        }
      },
    });
  };

  const handleOpenAddBuild = React.useCallback((initialData?: Partial<PCBuild>) => {
    setInitialBuildData(initialData || null);
    setIsBuildModalOpen(true);
  }, []);

  const handleCloseComponentModal = () => {
    setIsComponentModalOpen(false);
    setEditingComponent(null);
  };

  const handleCloseBulkEntryModal = () => {
    setIsBulkEntryModalOpen(false);
  };

  const handleClosePurchaseModal = () => {
    setPurchaseModalComponentId(null);
  };

  const handleCloseBuildModal = () => {
    setIsBuildModalOpen(false);
    setInitialBuildData(null);
  };

  const handleCloseSellPartModal = () => {
    setIsSellPartModalOpen(false);
    setSellPartPreselectedComp(null);
    setSellPartPreselectedEntryId(null);
  };

  const handleCloseConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const targetComponentForPurchase = state.components.find(
    (c) => c.id === purchaseModalComponentId
  );

  return (
    <div className="min-h-dvh bg-transparent text-zinc-100 font-sans selection:bg-[#A8FF3E]/25 selection:text-white flex flex-col md:flex-row">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />
      
      <div className="relative z-0 flex min-w-0 flex-1 flex-col bg-transparent">
        <TopBar
          isSessionHistoryOpen={isSessionHistoryOpen}
          onToggleSessionHistory={() => setIsSessionHistoryOpen((prev) => !prev)}
        />

      {/* Main Container */}
      <main className="app-page app-main flex w-full flex-1 flex-col">
        <React.Suspense fallback={<div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-4 border-[#A8FF3E]/30 border-t-[#A8FF3E] rounded-full animate-spin"></div></div>}>
          {/* Launchpad Tab */}
          <div className={activeTab === 'launchpad' ? 'flex flex-col flex-1 w-full' : 'hidden'}>
            <LaunchpadView
              setActiveTab={handleTabChange}
              onNavigateToBuilds={handleNavigateToBuilds}
              onOpenAddBuild={(data) => {
                handleTabChange('builds');
                handleOpenAddBuild(data);
              }}
              onOpenAddComponent={() => {
                handleTabChange('inventory');
                handleOpenAddComponent();
              }}
              onOpenBulkEntry={() => {
                handleTabChange('inventory');
                handleOpenBulkEntry();
              }}
            />
          </div>

          {/* Stock / Inventory Tab */}
          <div className={activeTab === 'inventory' ? 'flex flex-col flex-1 w-full' : 'hidden'}>
            <StockView
              isActive={activeTab === 'inventory'}
              onOpenBulkEntry={handleOpenBulkEntry}
              onOpenAddComponent={handleOpenAddComponent}
              onOpenAddPurchaseEntry={handleOpenAddPurchaseEntry}
              onEditComponent={handleEditComponent}
              onOpenSellPart={handleOpenSellPart}
            />
          </div>

          {/* Builds Tab */}
          <div className={activeTab === 'builds' ? 'flex flex-col flex-1 w-full' : 'hidden'}>
            <BuildsView 
              isActive={activeTab === 'builds'} 
              onOpenAddBuild={handleOpenAddBuild}
              onOpenBuyPC={() => setIsBuyPCModalOpen(true)}
              statusFilter={buildsStatusFilter}
              onStatusFilterChange={setBuildsStatusFilter}
            />
          </div>

          {/* Analytics Tab */}
          <div className={activeTab === 'analytics' ? 'flex flex-col flex-1 w-full' : 'hidden'}>
            <AnalyticsView />
          </div>

          {/* Data Tab */}
          <div className={activeTab === 'data' ? 'flex flex-col flex-1 w-full' : 'hidden'}>
            <DataSyncView isActive={activeTab === 'data'} onResetData={handleResetAllData} />
          </div>
        </React.Suspense>
      </main>

      <ComponentModal
        isOpen={isComponentModalOpen && activeTab === 'inventory'}
        onClose={handleCloseComponentModal}
        onSave={handleSaveComponent}
        initialComponent={editingComponent}
      />
      <PurchaseEntryModal
        isOpen={!!purchaseModalComponentId && activeTab === 'inventory'}
        componentName={targetComponentForPurchase ? targetComponentForPurchase.name : ''}
        onClose={handleClosePurchaseModal}
        onSave={(entryData) => {
          if (purchaseModalComponentId) addPurchaseEntry(purchaseModalComponentId, entryData);
        }}
      />
      <SellPartModal
        isOpen={isSellPartModalOpen && activeTab === 'inventory'}
        onClose={handleCloseSellPartModal}
        preselectedComponent={sellPartPreselectedComp}
        preselectedEntryId={sellPartPreselectedEntryId}
        onOpenAddComponent={() => {
          handleCloseSellPartModal();
          handleOpenAddComponent();
        }}
      />
      <BulkStockEntryModal
        isOpen={isBulkEntryModalOpen && activeTab === 'inventory'}
        onClose={handleCloseBulkEntryModal}
        onSaveAll={handleSaveBulkItems}
      />
      <BuildModal
        isOpen={isBuildModalOpen && activeTab === 'builds'}
        onClose={handleCloseBuildModal}
        initialData={initialBuildData}
        onSave={addBuild}
      />
      <BuyPCModal
        isOpen={isBuyPCModalOpen}
        isVisible={activeTab === 'builds'}
        onClose={() => setIsBuyPCModalOpen(false)}
        onConfirm={(purchase) => {
          const result = purchasePC(purchase);
          if (!result.success) {
            showToast(result.error || 'Unable to save this PC purchase.', 'error');
            return result;
          }
          setIsBuyPCModalOpen(false);
          setBuildsStatusFilter('Pending');
          showToast('PC purchase saved in Pending builds.', 'success');
          return result;
        }}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen && activeTab === 'data'}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={handleCloseConfirmModal}
        confirmText="Clear All Data"
        isBusy={isResetting}
        busyText="Clearing..."
      />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PrivacyProvider>
        <InventoryProvider>
          <AppContent />
        </InventoryProvider>
      </PrivacyProvider>
    </ToastProvider>
  );
}
