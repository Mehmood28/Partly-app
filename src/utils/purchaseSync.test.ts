import { describe, it, expect } from 'vitest';
import {
  resolvePurchaseLineItems,
  recalculatePurchaseRollups,
  syncComponentUpdateToPurchaseTransactions,
  syncPurchaseTransactionUpdateToComponents,
  reconcileAllPurchaseTransactions,
} from './purchaseSync';
import { InventoryComponent, TransactionLogItem, PCBuild } from '../types';

describe('purchaseSync', () => {
  it('resolves and links renamed stock component to purchase line item', () => {
    const tx: TransactionLogItem = {
      id: 'tx-oct14-bulk',
      type: 'PURCHASE',
      title: 'Bulk Purchase: MIXED',
      timestamp: '2026-10-14',
      dateSortable: '2026-10-14',
      itemCount: 4,
      quantity: 4,
      totalAmount: 400,
      seller: 'MIXED',
      platform: 'MIXED',
      paymentMethod: 'MIXED' as any,
      itemNameOrSummary: 'Purchased Mixed Parts (4 Parts)',
      detailsList: [
        '1x AMD Ryzen 5 7600X ($200.00/ea)',
        '1x MSI B650-P Pro ($120.00/ea)',
        '1x Gigabyte GP-P750GM 750W 80+ Gold ($50.00/ea)', // Old model name in details
        '1x 1 TB Lexar NQ780 ($30.00/ea)',
      ],
    };

    const components: InventoryComponent[] = [
      {
        id: 'comp-cpu',
        name: 'AMD Ryzen 5 7600X',
        category: 'CPU',
        specifications: 'AM5',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe-cpu',
            date: '2026-10-14',
            condition: 'New Open Box',
            quantity: 1,
            unitPrice: 200,
            totalPrice: 200,
            paymentMethod: 'Cash',
            platform: 'Harsh',
            seller: 'Harsh',
            sourcePurchaseTransactionId: 'tx-oct14-bulk',
          },
        ],
      },
      {
        id: 'comp-mobo',
        name: 'MSI B650-P Pro',
        category: 'Motherboard',
        specifications: 'WiFi',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe-mobo',
            date: '2026-10-14',
            condition: 'New Open Box',
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            paymentMethod: 'Cash',
            platform: 'Harsh',
            seller: 'Harsh',
            sourcePurchaseTransactionId: 'tx-oct14-bulk',
          },
        ],
      },
      {
        id: 'comp-psu',
        name: 'Gigabyte GP-UD750GM 80P Black', // Renamed in stock!
        category: 'PSU',
        specifications: '80P Black',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe-psu',
            date: '2026-10-14',
            condition: 'New Open Box',
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
            paymentMethod: 'Cash',
            platform: 'Harsh',
            seller: 'Harsh',
            sourcePurchaseTransactionId: 'tx-oct14-bulk',
          },
        ],
      },
      {
        id: 'comp-ssd',
        name: '1 TB Lexar NQ780',
        category: 'Storage',
        specifications: 'NVMe',
        assignedCount: 0,
        purchaseHistory: [
          {
            id: 'pe-ssd',
            date: '2026-10-14',
            condition: 'New Open Box',
            quantity: 1,
            unitPrice: 30,
            totalPrice: 30,
            paymentMethod: 'Cash',
            platform: 'Harsh',
            seller: 'Harsh',
            sourcePurchaseTransactionId: 'tx-oct14-bulk',
          },
        ],
      },
    ];

    const lineItems = resolvePurchaseLineItems(tx, components);
    expect(lineItems.length).toBe(4);

    const psuItem = lineItems.find((li) => li.componentId === 'comp-psu');
    expect(psuItem).toBeDefined();
    expect(psuItem?.name).toBe('Gigabyte GP-UD750GM 80P Black');
    expect(psuItem?.seller).toBe('Harsh');
    expect(psuItem?.paymentMethod).toBe('Cash');

    const rolledUp = recalculatePurchaseRollups(tx, lineItems);
    expect(rolledUp.seller).toBe('Harsh');
    expect(rolledUp.platform).toBe('Harsh');
    expect(rolledUp.paymentMethod).toBe('Cash');
    expect(rolledUp.title).toBe('Bulk Purchase: Harsh');
    expect(rolledUp.detailsList?.some((d) => d.includes('Gigabyte GP-UD750GM 80P Black'))).toBe(true);
  });

  it('syncs edits from Stock tab to Purchase transaction', () => {
    const tx: TransactionLogItem = {
      id: 'tx-oct14-bulk',
      type: 'PURCHASE',
      title: 'Bulk Purchase: Harsh',
      timestamp: '2026-10-14',
      dateSortable: '2026-10-14',
      itemCount: 1,
      quantity: 1,
      totalAmount: 100,
      seller: 'Harsh',
      platform: 'Harsh',
      paymentMethod: 'Cash',
      itemNameOrSummary: 'Gigabyte GP-P750GM',
      purchaseLineItems: [
        {
          id: 'pli-1',
          componentId: 'comp-1',
          purchaseEntryId: 'pe-1',
          name: 'Gigabyte GP-P750GM',
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
          seller: 'Direct / Local',
          paymentMethod: 'E-Transfer',
          condition: 'Used',
        },
      ],
    };

    const updatedComp: InventoryComponent = {
      id: 'comp-1',
      name: 'Gigabyte GP-UD750GM 80P Black',
      category: 'PSU',
      specifications: '80P Black',
      assignedCount: 0,
      purchaseHistory: [
        {
          id: 'pe-1',
          date: '2026-10-14',
          condition: 'New Open Box',
          quantity: 1,
          unitPrice: 110,
          totalPrice: 110,
          paymentMethod: 'Cash',
          platform: 'Harsh',
          seller: 'Harsh',
          sourcePurchaseTransactionId: 'tx-oct14-bulk',
        },
      ],
    };

    const updatedTxs = syncComponentUpdateToPurchaseTransactions([tx], updatedComp, 'pe-1', {
      condition: 'New Open Box',
      platform: 'Harsh',
      seller: 'Harsh',
      paymentMethod: 'Cash',
      quantity: 1,
      unitPrice: 110,
      totalPrice: 110,
    });

    expect(updatedTxs[0].seller).toBe('Harsh');
    expect(updatedTxs[0].paymentMethod).toBe('Cash');
    expect(updatedTxs[0].totalAmount).toBe(110);
    expect(updatedTxs[0].purchaseLineItems?.[0].name).toBe('Gigabyte GP-UD750GM 80P Black');
  });

  it('syncs edits from Purchase Modal to In Stock components and builds', () => {
    const comp: InventoryComponent = {
      id: 'comp-psu',
      name: 'Old PSU Name',
      category: 'PSU',
      specifications: 'Old Specs',
      assignedCount: 1,
      purchaseHistory: [
        {
          id: 'pe-psu',
          date: '2026-10-14',
          condition: 'Used',
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
          paymentMethod: 'E-Transfer',
          platform: 'Direct / Local',
          seller: 'Direct / Local',
          sourcePurchaseTransactionId: 'tx-1',
        },
      ],
    };

    const build: PCBuild = {
      id: 'build-1',
      name: 'Test Rig',
      status: 'Available',
      createdDate: '2026-10-15',
      parts: [
        {
          componentId: 'comp-psu',
          componentName: 'Old PSU Name',
          category: 'PSU',
          quantity: 1,
          unitCostAtAssignment: 50,
        },
      ],
    };

    const updatedLineItems = [
      {
        id: 'pli-1',
        componentId: 'comp-psu',
        purchaseEntryId: 'pe-psu',
        name: 'Gigabyte GP-UD750GM 80P Black',
        specifications: '80P Black',
        condition: 'New Open Box' as const,
        seller: 'Harsh',
        paymentMethod: 'Cash' as const,
        quantity: 1,
        unitPrice: 85,
        totalPrice: 85,
      },
    ];

    const { nextComponents, nextBuilds } = syncPurchaseTransactionUpdateToComponents(
      [comp],
      [build],
      'tx-1',
      updatedLineItems
    );

    expect(nextComponents[0].name).toBe('Gigabyte GP-UD750GM 80P Black');
    expect(nextComponents[0].specifications).toBe('80P Black');
    expect(nextComponents[0].seller).toBe('Harsh');
    expect(nextComponents[0].purchaseHistory[0].condition).toBe('New Open Box');
    expect(nextComponents[0].purchaseHistory[0].seller).toBe('Harsh');
    expect(nextComponents[0].purchaseHistory[0].paymentMethod).toBe('Cash');
    expect(nextComponents[0].purchaseHistory[0].unitPrice).toBe(85);

    // Build parts were also synced to new component name
    expect(nextBuilds[0].parts[0].componentName).toBe('Gigabyte GP-UD750GM 80P Black');
  });

  it('reconciles all existing purchase transactions automatically', () => {
    const tx: TransactionLogItem = {
      id: 'tx-oct14-bulk',
      type: 'PURCHASE',
      title: 'Bulk Purchase: Direct / Local',
      timestamp: '2026-10-14',
      dateSortable: '2026-10-14',
      itemCount: 1,
      quantity: 1,
      totalAmount: 90,
      seller: 'Direct / Local',
      platform: 'Direct / Local',
      paymentMethod: 'E-Transfer',
      itemNameOrSummary: 'Gigabyte GP-P750GM 750W 80+ Gold',
      detailsList: ['1x Gigabyte GP-P750GM 750W 80+ Gold ($90.00/ea)'],
    };

    const comp: InventoryComponent = {
      id: 'comp-psu',
      name: 'Gigabyte GP-UD750GM 80P Black',
      category: 'PSU',
      specifications: '80P Black',
      assignedCount: 0,
      purchaseHistory: [
        {
          id: 'pe-psu',
          date: '2026-10-14',
          condition: 'New Open Box',
          quantity: 1,
          unitPrice: 90,
          totalPrice: 90,
          paymentMethod: 'Cash',
          platform: 'Harsh',
          seller: 'Harsh',
          sourcePurchaseTransactionId: 'tx-oct14-bulk',
        },
      ],
    };

    const reconciled = reconcileAllPurchaseTransactions([tx], [comp]);
    expect(reconciled[0].seller).toBe('Harsh');
    expect(reconciled[0].paymentMethod).toBe('Cash');
    expect(reconciled[0].detailsList?.[0]).toContain('Gigabyte GP-UD750GM 80P Black');
    expect(reconciled[0].title).toBe('Bulk Purchase: Harsh');
  });

  it('keeps MIXED when items have different sellers or payment methods', () => {
    const tx: TransactionLogItem = {
      id: 'tx-mixed',
      type: 'PURCHASE',
      title: 'Bulk Purchase',
      timestamp: '2026-10-14',
      dateSortable: '2026-10-14',
      itemCount: 2,
      quantity: 2,
      totalAmount: 150,
      seller: '',
      platform: '',
      itemNameOrSummary: 'Purchased Mixed Parts',
      detailsList: [],
    };

    const rolledUp = recalculatePurchaseRollups(tx, [
      {
        name: 'Part 1',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
        seller: 'Harsh',
        paymentMethod: 'Cash',
      },
      {
        name: 'Part 2',
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        seller: 'Amazon',
        paymentMethod: 'Credit Card',
      },
    ]);

    expect(rolledUp.seller).toBe('MIXED');
    expect(rolledUp.paymentMethod).toBe('MIXED');
    expect(rolledUp.title).toBe('Bulk Purchase: MIXED');
  });

  it('preserves user customTitleOverride if provided', () => {
    const tx: TransactionLogItem = {
      id: 'tx-custom',
      type: 'PURCHASE',
      title: 'My Custom Purchase Title',
      customTitleOverride: 'My Custom Purchase Title',
      timestamp: '2026-10-14',
      dateSortable: '2026-10-14',
      itemCount: 1,
      quantity: 1,
      totalAmount: 50,
      seller: 'Harsh',
      platform: 'Harsh',
      paymentMethod: 'Cash',
      itemNameOrSummary: 'Part',
      detailsList: [],
    };

    const rolledUp = recalculatePurchaseRollups(tx, [
      {
        name: 'Part',
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        seller: 'Harsh',
        paymentMethod: 'Cash',
      },
    ]);

    expect(rolledUp.title).toBe('My Custom Purchase Title');
  });
});
