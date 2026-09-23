import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InventoryContext } from '../../context/InventoryContext';
import { handleDismantleBuild, handlePurchasePC } from '../../context/actions/buildActions';
import { AppState, InventoryComponent, PCBuild, TransactionLogItem } from '../../types';
import { parseBatchItem } from './activityHelpers';
import { PurchaseExpandedView } from './PurchaseExpandedView';
import { TransactionActivityCard } from './TransactionActivityCard';

const makeEntry = (id: string, platform: string, condition: 'New Open Box' | 'Used') => ({
  id,
  date: '2026-09-01',
  condition,
  quantity: 1,
  unitPrice: 100,
  totalPrice: 100,
  paymentMethod: platform === 'Supplier A' ? 'Cash' as const : 'E-Transfer' as const,
  platform,
});

const componentA: InventoryComponent = {
  id: 'component-a',
  name: 'Same Name GPU',
  category: 'GPU',
  specifications: '',
  assignedCount: 0,
  purchaseHistory: [
    makeEntry('batch-a', 'Supplier A', 'New Open Box'),
    makeEntry('batch-b', 'Supplier B', 'Used'),
  ],
};

const componentB: InventoryComponent = {
  ...componentA,
  id: 'component-b',
  category: 'CPU',
  purchaseHistory: [makeEntry('batch-c', 'Supplier C', 'Used')],
};

const makePurchase = (overrides: Partial<TransactionLogItem> = {}): TransactionLogItem => ({
  id: 'purchase-1',
  type: 'PURCHASE',
  title: 'Purchased: Supplier B',
  timestamp: '2026-09-01',
  dateSortable: '2026-09-01',
  itemCount: 1,
  quantity: 1,
  totalAmount: 100,
  platform: 'Supplier B',
  paymentMethod: 'E-Transfer',
  itemNameOrSummary: 'Same Name GPU',
  detailsList: ['Same Name GPU ($100/ea)'],
  relatedComponentId: componentA.id,
  relatedPurchaseEntryId: 'batch-b',
  ...overrides,
});

describe('activity exact identity display', () => {
  it('uses exact component and batch IDs for same-price batches', () => {
    const parsed = parseBatchItem('Same Name GPU ($100/ea)', [componentA, componentB], makePurchase());
    expect(parsed.comp?.id).toBe(componentA.id);
    expect(parsed.condition).toBe('Used');
    expect(parsed.platform).toBe('Supplier B');
    expect(parsed.paymentMethod).toBe('E-Transfer');
  });

  it('does not name-match a conflicting or stale explicit component/batch ID', () => {
    const conflicting = parseBatchItem(
      'Same Name GPU ($100/ea)',
      [componentA, componentB],
      makePurchase({ relatedComponentId: componentB.id, relatedPurchaseEntryId: 'batch-a' }),
    );
    expect(conflicting.comp?.id).toBe(componentB.id);
    expect(conflicting.condition).toBe('');

    const stale = parseBatchItem(
      'Same Name GPU',
      [componentA, componentB],
      makePurchase({ relatedComponentId: 'missing-component', relatedPurchaseEntryId: 'missing-batch' }),
    );
    expect(stale.comp).toBeUndefined();
    expect(stale.condition).toBe('');
    expect(stale.unitPrice).toBe(0);
  });

  it('does not name-match live inventory when only an explicit batch ID is stored', () => {
    const batchOnly = parseBatchItem(
      'Same Name GPU',
      [componentA, componentB],
      makePurchase({ relatedComponentId: undefined, relatedPurchaseEntryId: 'batch-b' }),
    );
    expect(batchOnly.comp).toBeUndefined();
    expect(batchOnly.condition).toBe('');
    expect(batchOnly.unitPrice).toBe(0);

    const storedSnapshot = makeEntry('batch-b', 'Snapshot Supplier', 'Used');
    const snapshotBacked = parseBatchItem(
      'Same Name GPU',
      [componentA, componentB],
      makePurchase({
        relatedComponentId: undefined,
        relatedPurchaseEntryId: 'batch-b',
        originalPurchaseEntrySnapshot: storedSnapshot,
      }),
    );
    expect(snapshotBacked.comp).toBeUndefined();
    expect(snapshotBacked.condition).toBe('Used');
    expect(snapshotBacked.platform).toBe('Snapshot Supplier');
  });

  it('preserves only a stored snapshot that matches the explicit batch ID', () => {
    const matchingSnapshot = makeEntry('deleted-batch', 'Snapshot Supplier', 'Used');
    const matched = parseBatchItem(
      'Same Name GPU',
      [componentA],
      makePurchase({
        relatedPurchaseEntryId: 'deleted-batch',
        originalPurchaseEntrySnapshot: matchingSnapshot,
      }),
    );
    expect(matched.condition).toBe('Used');
    expect(matched.platform).toBe('Snapshot Supplier');
    expect(matched.unitPrice).toBe(100);

    const conflicting = parseBatchItem(
      'Same Name GPU',
      [componentA],
      makePurchase({
        relatedPurchaseEntryId: 'different-batch',
        originalPurchaseEntrySnapshot: matchingSnapshot,
      }),
    );
    expect(conflicting.condition).toBe('');
    expect(conflicting.unitPrice).toBe(0);
  });

  it('shows condition only from an exact batch or matching stored snapshot', () => {
    const exactTx = makePurchase();
    const staleTx = makePurchase({ relatedPurchaseEntryId: 'missing-batch' });
    const state = { components: [componentA], builds: [], transactions: [exactTx, staleTx], monthlyGoal: 10000 } as AppState;
    const renderCard = (tx: TransactionLogItem) => renderToStaticMarkup(
      <InventoryContext.Provider value={{ state, relistPartSale: () => ({ success: true }), relistBulkPartSale: () => ({ success: true }) } as never}>
        <TransactionActivityCard tx={tx} onEdit={() => undefined} onDelete={() => undefined} />
      </InventoryContext.Provider>,
    );

    expect(renderCard(exactTx)).toContain('Used');
    expect(renderCard(exactTx)).not.toContain('New Open Box');
    expect(renderCard(staleTx)).not.toContain('New Open Box');
    expect(renderCard(staleTx)).not.toContain('>Used<');
  });

  it('requires all present purchased-PC source IDs to agree before using part-out metadata', () => {
    const purchasedBuild: PCBuild = {
      id: 'purchased-build',
      name: 'Purchased Rig',
      status: 'Sold',
      createdDate: '2026-09-01',
      acquisitionSource: 'Purchased',
      purchaseTransactionId: 'purchase-pc',
      parts: [],
    };
    const pcTx = makePurchase({
      id: 'purchase-pc',
      purchaseKind: 'PC',
      relatedComponentId: purchasedBuild.id,
      itemNameOrSummary: purchasedBuild.name,
      detailsList: [],
    });
    const makePartComponent = (id: string, name: string, sourcePurchaseTransactionId?: string, sourcePurchasedBuildId?: string, notes?: string): InventoryComponent => ({
      id,
      name,
      category: 'GPU',
      specifications: '',
      assignedCount: 0,
      purchaseHistory: [{
        ...makeEntry(`batch-${id}`, 'PC Seller', 'Used'),
        sourcePurchaseTransactionId,
        sourcePurchasedBuildId,
        notes,
      }],
    });
    const exact = makePartComponent('exact', 'Exact Part', pcTx.id, purchasedBuild.id);
    const conflicting = makePartComponent('conflict', 'Conflicting Part', 'different-transaction', purchasedBuild.id, 'Parted out from purchased PC: Purchased Rig');
    const legacy = makePartComponent('legacy', 'Legacy Part', undefined, undefined, 'Parted out from purchased PC: Purchased Rig');

    const markup = renderToStaticMarkup(
      <PurchaseExpandedView
        tx={pcTx}
        isBulkPurchase={false}
        isPCPurchase
        purchasedBuild={purchasedBuild}
        components={[exact, conflicting, legacy]}
      />,
    );
    expect(markup).toContain('Exact Part');
    expect(markup).toContain('Legacy Part');
    expect(markup).not.toContain('Conflicting Part');
  });

  it('does not restore part-out metadata when an explicit build link was rejected', () => {
    const pcTx = makePurchase({
      id: 'purchase-pc-conflict',
      purchaseKind: 'PC',
      relatedComponentId: 'build-b',
      itemNameOrSummary: 'Conflicting Rig',
      detailsList: [],
    });
    const linkedOnlyByRejectedBuild: InventoryComponent = {
      ...componentA,
      id: 'rejected-part',
      name: 'Rejected Build Part',
      purchaseHistory: [{
        ...makeEntry('rejected-entry', 'PC Seller', 'Used'),
        sourcePurchasedBuildId: 'build-b',
        notes: 'Parted out from purchased PC: Conflicting Rig',
      }],
    };

    const markup = renderToStaticMarkup(
      <PurchaseExpandedView
        tx={pcTx}
        isBulkPurchase={false}
        isPCPurchase
        components={[linkedOnlyByRejectedBuild]}
      />,
    );
    expect(markup).not.toContain('Rejected Build Part');
  });

  it('shows both exact-linked stock parts after a purchased PC is parted out and its build removed', () => {
    const breakdown = [
      { category: 'CPU' as const, name: 'Ryzen 5 5600X', quantity: 1, unitCost: 200 },
      { category: 'GPU' as const, name: 'RTX 3060 12GB', quantity: 1, unitCost: 320 },
    ];
    const purchase = handlePurchasePC(
      { components: [], builds: [], transactions: [] },
      { name: 'Purchased Rig', purchasePrice: 520, purchaseDate: '2026-09-15', paymentMethod: 'Cash', breakdown },
    );
    expect(purchase.success).toBe(true);
    const purchasedBuild = purchase.nextState.builds[0];
    const purchaseTx = purchase.nextState.transactions[0];
    const partOut = handleDismantleBuild(purchase.nextState, purchasedBuild.id, breakdown);
    expect(partOut.success).toBe(true);
    expect(partOut.nextState.builds).toEqual([]);
    expect(partOut.nextState.components).toHaveLength(2);
    for (const component of partOut.nextState.components) {
      expect(component.purchaseHistory[0].sourcePurchaseTransactionId).toBe(purchaseTx.id);
      expect(component.purchaseHistory[0].sourcePurchasedBuildId).toBe(purchasedBuild.id);
    }

    const markup = renderToStaticMarkup(
      <InventoryContext.Provider value={{ state: partOut.nextState, relistPartSale: () => ({ success: true }), relistBulkPartSale: () => ({ success: true }) } as never}>
        <TransactionActivityCard tx={purchaseTx} isExpanded onEdit={() => undefined} onDelete={() => undefined} />
      </InventoryContext.Provider>,
    );
    expect(markup).toContain('Ryzen 5 5600X');
    expect(markup).toContain('RTX 3060 12GB');
    expect(markup).toContain('Purchase items');
  });

  it('does not select either purchased build when explicit build and transaction links conflict', () => {
    const pcTx = makePurchase({
      id: 'purchase-pc-conflict',
      purchaseKind: 'PC',
      relatedComponentId: 'build-b',
      itemNameOrSummary: 'Conflicting Rig',
      detailsList: [],
    });
    const buildA = {
      id: 'build-a',
      name: 'Build A',
      status: 'Sold',
      createdDate: '2026-09-01',
      acquisitionSource: 'Purchased',
      purchaseTransactionId: pcTx.id,
      acquisitionComponentBreakdown: [{
        category: 'GPU',
        name: 'Build A Part',
        quantity: 1,
        unitCost: 100,
      }],
      parts: [],
    } as PCBuild;
    const buildB = {
      ...buildA,
      id: 'build-b',
      name: 'Build B',
      purchaseTransactionId: 'different-purchase',
      acquisitionComponentBreakdown: [{
        category: 'CPU',
        name: 'Build B Part',
        quantity: 1,
        unitCost: 100,
      }],
    } as PCBuild;
    const conflictingStock: InventoryComponent = {
      ...componentA,
      id: 'conflicting-stock',
      name: 'Conflicting Stock Part',
      purchaseHistory: [{
        ...makeEntry('conflicting-stock-entry', 'PC Seller', 'Used'),
        sourcePurchaseTransactionId: pcTx.id,
        sourcePurchasedBuildId: buildB.id,
      }],
    };
    const state = { components: [conflictingStock], builds: [buildA, buildB], transactions: [pcTx], monthlyGoal: 10000 } as AppState;
    const markup = renderToStaticMarkup(
      <InventoryContext.Provider value={{ state, relistPartSale: () => ({ success: true }), relistBulkPartSale: () => ({ success: true }) } as never}>
        <TransactionActivityCard tx={pcTx} isExpanded onEdit={() => undefined} onDelete={() => undefined} />
      </InventoryContext.Provider>,
    );
    expect(markup).not.toContain('Build A Part');
    expect(markup).not.toContain('Build B Part');
    expect(markup).not.toContain('Conflicting Stock Part');
  });
});
