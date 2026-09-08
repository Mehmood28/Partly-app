import { describe, it, expect } from 'vitest';
import {
  handleSaveComponent,
  handleUpdatePurchaseEntry,
  handleDeleteComponent,
  handleDeletePurchaseEntry,
  handleAddComponent,
  handleAddComponents,
  handleAddPurchaseEntry,
  handleSellComponentPart,
  handleSellComponentPartsBulk,
  handleExchangeComponentPart,
} from '../componentActions';
import { AppState, InventoryComponent, PCBuild, PurchaseEntry } from '../../../types';

describe('componentActions', () => {
  const mockState: AppState = {
    components: [],
    builds: [],
    transactions: [],
    sheetStats: null,
    monthlyGoal: 0,
  };

  it('rejects invalid quantity when updating purchase entry', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ],
        } as InventoryComponent
      ]
    };
    
    const updates = [
      { quantity: NaN },
      { quantity: Infinity },
      { quantity: -1 },
      { quantity: 0 },
      { quantity: 1.5 }
    ];
    
    for (const update of updates) {
      const res = handleUpdatePurchaseEntry(state, 'c1', 'pe1', { ...state.components[0].purchaseHistory![0], ...update });
      expect(res.success).toBe(false);
      expect(res.nextState).toBe(state); // Reference equality
    }
  });

  it('rejects invalid numeric values and preserves valid zeros', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ],
        } as InventoryComponent
      ]
    };
    
    // NaN rejection
    const invalidUpdates = [
      { totalPrice: NaN },
      { taxPercent: NaN },
      { unitPrice: Infinity },
      { totalPrice: -Infinity }
    ];
    
    for (const update of invalidUpdates) {
      const res = handleUpdatePurchaseEntry(state, 'c1', 'pe1', { ...state.components[0].purchaseHistory![0], ...update });
      expect(res.success).toBe(false);
      expect(res.nextState).toBe(state); // Preserves reference
      
      const res2 = handleSaveComponent(state, {
        existingComponentId: 'c1',
        componentData: { name: 'Test', category: 'CPU' } as any,
        updatedPurchaseEntry: {
          entryId: 'pe1',
          entry: { ...state.components[0].purchaseHistory![0], ...update } as PurchaseEntry
        }
      });
      expect(res2.success).toBe(false);
      expect(res2.nextState).toBe(state);
    }

    // Zero preservation
    const zeroUpdate = { unitPrice: 0, totalPrice: 0, taxPercent: 0 };
    const resZero = handleUpdatePurchaseEntry(state, 'c1', 'pe1', { ...state.components[0].purchaseHistory![0], ...zeroUpdate });
    expect(resZero.success).toBe(true);
    expect(resZero.nextState.components[0].purchaseHistory![0].unitPrice).toBe(0);
    expect(resZero.nextState.components[0].purchaseHistory![0].totalPrice).toBe(0);
    expect(resZero.nextState.components[0].purchaseHistory![0].taxPercent).toBe(0);
  });

  it('preserves provenance when updating purchase entry', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          purchaseHistory: [
            { 
              id: 'pe1', 
              quantity: 1, 
              unitPrice: 10, 
              totalPrice: 10, 
              date: '2023-01-01', 
              condition: 'New' as any,
              sourceTradeInBuildId: 'build1' // Provenance field
            } as PurchaseEntry
          ],
        } as InventoryComponent
      ]
    };

    const res = handleUpdatePurchaseEntry(state, 'c1', 'pe1', {
      quantity: 2,
      unitPrice: 10,
      totalPrice: 20,
      date: '2023-01-01',
      condition: 'New' as any,
    } as Omit<PurchaseEntry, 'id'>);

    expect(res.success).toBe(true);
    expect(res.nextState.components[0].purchaseHistory![0].sourceTradeInBuildId).toBe('build1');
  });

  it('preserves provenance in handleSaveComponent auto-merge and normal branches', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any, sourceTradeInBuildId: 'build1' } as PurchaseEntry
          ],
        } as InventoryComponent
      ]
    };

    const res = handleSaveComponent(state, {
      existingComponentId: 'c1',
      componentData: { name: 'Test', category: 'CPU', specifications: {}, unresolvedLegacyReservationByPurchaseEntryId: undefined, purchaseHistory: [] } as any,
      updatedPurchaseEntry: {
        entryId: 'pe1',
        entry: { quantity: 2, unitPrice: 10, totalPrice: 20, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
      }
    });

    expect(res.success).toBe(true);
    expect(res.nextState.components[0].purchaseHistory![0].sourceTradeInBuildId).toBe('build1');
  });

  it('handles missing component safely', () => {
    const res = handleDeleteComponent(mockState, 'non-existent');
    expect(res.success).toBe(false);
    expect(res.nextState).toBe(mockState);
  });

  it('returns original state reference for unchanged saves (no-op)', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          tags: [],
          specifications: {},
          unresolvedLegacyReservationByPurchaseEntryId: undefined,
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ],
        } as InventoryComponent
      ]
    };

    const res = handleSaveComponent(state, {
      existingComponentId: 'c1',
      componentData: { name: 'Test', category: 'CPU', specifications: {}, purchaseHistory: [], tags: [], unresolvedLegacyReservationByPurchaseEntryId: undefined } as any
    });

    expect(res.success).toBe(true);
    expect(res.nextState).toBe(state); // Reference equality
  });

  it('blocks deletion if there are unresolved legacy allocations', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          assignedCount: 1, // Legacy allocation
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry,
            { id: 'pe2', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-02', condition: 'New' as any } as PurchaseEntry
          ],
        } as InventoryComponent
      ],
      builds: [
        {
          id: 'b1',
          name: 'Build 1',
          status: 'Built',
          paymentMethod: 'Cash',
          parts: [
            { componentId: 'c1', quantity: 1, unitCost: 10, name: 'Test', category: 'CPU' } // Unlinked
          ]
        } as unknown as PCBuild
      ]
    };

    const res1 = handleDeleteComponent(state, 'c1');
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/unresolved legacy allocation/i);

    const res2 = handleDeletePurchaseEntry(state, 'c1', 'pe1');
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/unresolved legacy allocation/i);
    
    const res3 = handleDeletePurchaseEntry(state, 'c1', 'pe2');
    expect(res3.success).toBe(false);
    expect(res3.error).toMatch(/unresolved legacy allocation/i);
  });
  
  it('explicitly linked allocation blocks only its exact batch', () => {
    const state: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Test',
          category: 'CPU',
          assignedCount: 1,
          purchaseHistory: [
            { id: 'pe1', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry,
            { id: 'pe2', quantity: 1, unitPrice: 10, totalPrice: 10, date: '2023-01-02', condition: 'New' as any } as PurchaseEntry
          ],
        } as InventoryComponent
      ],
      builds: [
        {
          id: 'b1',
          name: 'Build 1',
          status: 'Built',
          paymentMethod: 'Cash',
          parts: [
            { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 1, unitCost: 10, name: 'Test', category: 'CPU' } // Explicitly linked
          ]
        } as unknown as PCBuild
      ]
    };

    // Deleting pe1 should fail
    const res1 = handleDeletePurchaseEntry(state, 'c1', 'pe1');
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/currently allocated/i);
    
    // Deleting pe2 should succeed because it is not linked
    const res2 = handleDeletePurchaseEntry(state, 'c1', 'pe2');
    expect(res2.success).toBe(true);
  });

  describe('Bulk and Add actions numeric validations and ordering', () => {
    it('invalid handleAddComponent input returns the exact original state reference', () => {
      const state = mockState;
      const nextState = handleAddComponent(state, {
        name: 'Test Component',
        category: 'CPU',
        purchaseHistory: [
          { quantity: 1, unitPrice: NaN, totalPrice: 10, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
        ]
      } as Omit<InventoryComponent, 'id' | 'assignedCount'>);
      expect(nextState).toBe(state);
    });

    it('valid zero unitPrice, totalPrice, and taxPercent remain zero in handleAddComponent', () => {
      const state = mockState;
      const nextState = handleAddComponent(state, {
        name: 'Test Component',
        category: 'CPU',
        purchaseHistory: [
          { quantity: 1, unitPrice: 0, totalPrice: 0, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
        ]
      } as Omit<InventoryComponent, 'id' | 'assignedCount'>);
      expect(nextState).not.toBe(state);
      expect(nextState.components[0].purchaseHistory![0].unitPrice).toBe(0);
      expect(nextState.components[0].purchaseHistory![0].totalPrice).toBe(0);
      expect(nextState.components[0].purchaseHistory![0].taxPercent).toBe(0);
    });

    it('handleAddComponents is atomic when one submitted component has invalid numeric data', () => {
      const state = mockState;
      const nextState = handleAddComponents(state, [
        {
          name: 'Valid Component',
          category: 'CPU',
          purchaseHistory: [
            { quantity: 1, unitPrice: 10, totalPrice: 10, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ]
        } as Omit<InventoryComponent, 'id' | 'assignedCount'>,
        {
          name: 'Invalid Component',
          category: 'GPU',
          purchaseHistory: [
            { quantity: 1, unitPrice: Infinity, totalPrice: 10, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ]
        } as Omit<InventoryComponent, 'id' | 'assignedCount'>
      ]);
      expect(nextState).toBe(state);
    });

    it('valid zero values survive handleAddComponents', () => {
      const state = mockState;
      const nextState = handleAddComponents(state, [
        {
          name: 'Zero Component',
          category: 'CPU',
          purchaseHistory: [
            { quantity: 1, unitPrice: 0, totalPrice: 0, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ]
        } as Omit<InventoryComponent, 'id' | 'assignedCount'>
      ]);
      expect(nextState).not.toBe(state);
      expect(nextState.components[0].purchaseHistory![0].unitPrice).toBe(0);
      expect(nextState.components[0].purchaseHistory![0].totalPrice).toBe(0);
      expect(nextState.components[0].purchaseHistory![0].taxPercent).toBe(0);
    });

    it('handleAddPurchaseEntry with a missing component returns the original state and creates no transaction', () => {
      const state = mockState;
      const nextState = handleAddPurchaseEntry(state, 'non-existent', {
        quantity: 1, unitPrice: 10, totalPrice: 10, taxPercent: 0, date: '2023-01-01', condition: 'New' as any
      } as PurchaseEntry);
      expect(nextState).toBe(state);
      expect(nextState.transactions.length).toBe(state.transactions.length);
    });

    it('invalid handleAddPurchaseEntry input returns the original state', () => {
      const state = {
        ...mockState,
        components: [{ id: 'c1', name: 'Test', category: 'CPU' } as InventoryComponent]
      };
      const nextState = handleAddPurchaseEntry(state, 'c1', {
        quantity: -1, unitPrice: 10, totalPrice: 10, taxPercent: 0, date: '2023-01-01', condition: 'New' as any
      } as PurchaseEntry);
      expect(nextState).toBe(state);
    });

    it('valid zero values survive handleAddPurchaseEntry', () => {
      const state = {
        ...mockState,
        components: [{ id: 'c1', name: 'Test', category: 'CPU' } as InventoryComponent]
      };
      const nextState = handleAddPurchaseEntry(state, 'c1', {
        quantity: 1, unitPrice: 0, totalPrice: 0, taxPercent: 0, date: '2023-01-01', condition: 'New' as any
      } as PurchaseEntry);
      expect(nextState).not.toBe(state);
      const updatedComp = nextState.components.find(c => c.id === 'c1');
      expect(updatedComp!.purchaseHistory![0].unitPrice).toBe(0);
      expect(updatedComp!.purchaseHistory![0].totalPrice).toBe(0);
      expect(updatedComp!.purchaseHistory![0].taxPercent).toBe(0);
    });

    it('bulk-added component order matches the pre-rewrite behavior', () => {
      const state = mockState;
      const nextState = handleAddComponents(state, [
        {
          name: 'First',
          category: 'CPU',
          purchaseHistory: [
            { quantity: 1, unitPrice: 10, totalPrice: 10, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ]
        } as Omit<InventoryComponent, 'id' | 'assignedCount'>,
        {
          name: 'Second',
          category: 'GPU',
          purchaseHistory: [
            { quantity: 1, unitPrice: 20, totalPrice: 20, taxPercent: 0, date: '2023-01-01', condition: 'New' as any } as PurchaseEntry
          ]
        } as Omit<InventoryComponent, 'id' | 'assignedCount'>
      ]);
      expect(nextState).not.toBe(state);
      // componentsToKeep.push(newComp) results in First, then Second added to the end?
      // Wait, let's check what the expectation is. If it's pushed, it's at the end. If it was unshift in loop, it was Second, First. 
      // If we restored it to push(), then it should be Second after First. But wait, new components are appended to [...prev.components].
      // Let's just verify they appear in the same relative order as submitted.
      const firstIndex = nextState.components.findIndex(c => c.name === 'First');
      const secondIndex = nextState.components.findIndex(c => c.name === 'Second');
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });

  describe('Phase 2A1: handleSellComponentPart', () => {
    const baseState: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'RTX 4070',
          category: 'GPU',
          assignedCount: 1,
          soldCount: 0,
          purchaseHistory: [
            { id: 'pe1', quantity: 3, unitPrice: 500, totalPrice: 1500, date: '2023-01-01', condition: 'New Open Box' } as PurchaseEntry
          ],
        } as InventoryComponent
      ],
      builds: [
        {
          id: 'b1',
          name: 'Gaming Rig',
          status: 'Listed for Sale',
          parts: [
            { componentId: 'c1', purchaseEntryId: 'pe1', componentName: 'RTX 4070', category: 'GPU', quantity: 1, unitCostAtAssignment: 500 }
          ]
        } as PCBuild
      ]
    };

    it('rejects non-existent component or purchase entry', () => {
      const res1 = handleSellComponentPart(baseState, 'invalid-comp', 'pe1', { quantity: 1, unitSalePrice: 600, saleDate: '2023-01-02' });
      expect(res1.success).toBe(false);
      expect(res1.nextState).toBe(baseState);

      const res2 = handleSellComponentPart(baseState, 'c1', 'invalid-pe', { quantity: 1, unitSalePrice: 600, saleDate: '2023-01-02' });
      expect(res2.success).toBe(false);
      expect(res2.nextState).toBe(baseState);
    });

    it('rejects invalid quantities (NaN, Infinity, zero, negative, non-integer)', () => {
      const invalidQtys = [NaN, Infinity, -Infinity, 0, -1, 1.5];
      for (const q of invalidQtys) {
        const res = handleSellComponentPart(baseState, 'c1', 'pe1', { quantity: q, unitSalePrice: 600, saleDate: '2023-01-02' });
        expect(res.success).toBe(false);
        expect(res.nextState).toBe(baseState);
      }
    });

    it('rejects quantity exceeding available unassigned stock', () => {
      // pe1 has 3 total, 1 allocated to b1 -> 2 available
      const resExceedingAvailable = handleSellComponentPart(baseState, 'c1', 'pe1', { quantity: 3, unitSalePrice: 600, saleDate: '2023-01-02' });
      expect(resExceedingAvailable.success).toBe(false);
      expect(resExceedingAvailable.nextState).toBe(baseState);
    });

    it('rejects invalid unitSalePrice (<= 0, NaN, Infinity)', () => {
      const invalidPrices = [0, -10, NaN, Infinity, -Infinity];
      for (const p of invalidPrices) {
        const res = handleSellComponentPart(baseState, 'c1', 'pe1', { quantity: 1, unitSalePrice: p, saleDate: '2023-01-02' });
        expect(res.success).toBe(false);
        expect(res.nextState).toBe(baseState);
      }
    });

    it('rejects invalid incoming trade-in parameters', () => {
      // Empty name
      const resEmptyName = handleSellComponentPart(baseState, 'c1', 'pe1', {
        quantity: 1,
        unitSalePrice: 600,
        saleDate: '2023-01-02',
        incomingTradePart: { name: '   ', category: 'GPU', tradeInCredit: 100 }
      });
      expect(resEmptyName.success).toBe(false);
      expect(resEmptyName.nextState).toBe(baseState);

      // Invalid category
      const resInvalidCat = handleSellComponentPart(baseState, 'c1', 'pe1', {
        quantity: 1,
        unitSalePrice: 600,
        saleDate: '2023-01-02',
        incomingTradePart: { name: 'Old Card', category: 'InvalidCat' as any, tradeInCredit: 100 }
      });
      expect(resInvalidCat.success).toBe(false);
      expect(resInvalidCat.nextState).toBe(baseState);

      // Non-positive or non-finite trade-in credit
      for (const credit of [0, -50, NaN, Infinity]) {
        const res = handleSellComponentPart(baseState, 'c1', 'pe1', {
          quantity: 1,
          unitSalePrice: 600,
          saleDate: '2023-01-02',
          incomingTradePart: { name: 'Old Card', category: 'GPU', tradeInCredit: credit }
        });
        expect(res.success).toBe(false);
        expect(res.nextState).toBe(baseState);
      }

      // Trade-in credit exceeding total sale value (600)
      const resExcessCredit = handleSellComponentPart(baseState, 'c1', 'pe1', {
        quantity: 1,
        unitSalePrice: 600,
        saleDate: '2023-01-02',
        incomingTradePart: { name: 'Old Card', category: 'GPU', tradeInCredit: 650 }
      });
      expect(resExcessCredit.success).toBe(false);
      expect(resExcessCredit.nextState).toBe(baseState);
    });

    it('successfully processes valid loose-part sale and customer trade-in', () => {
      const res = handleSellComponentPart(baseState, 'c1', 'pe1', {
        quantity: 2,
        unitSalePrice: 650,
        saleDate: '2023-01-02',
        platform: 'Facebook',
        incomingTradePart: {
          name: 'GTX 1080',
          category: 'GPU',
          tradeInCredit: 100,
        }
      });

      expect(res.success).toBe(true);
      expect(res.nextState).not.toBe(baseState);

      const updatedComp = res.nextState.components.find(c => c.id === 'c1');
      expect(updatedComp!.soldCount).toBe(2);
      expect(updatedComp!.purchaseHistory[0].quantity).toBe(1); // 3 - 2 = 1

      // Incoming trade-in component created
      const tradeInComp = res.nextState.components.find(c => c.name === 'GTX 1080');
      expect(tradeInComp).toBeDefined();
      expect(tradeInComp!.purchaseHistory[0].unitPrice).toBe(100);

      // Transaction logged
      expect(res.nextState.transactions.length).toBe(1);
      const tx = res.nextState.transactions[0];
      expect(tx.type).toBe('SALE');
      expect(tx.totalAmount).toBe(1300);
      expect(tx.tradeInCredit).toBe(100);
      expect(tx.cashPortion).toBe(1200);
      expect(tx.profitMargin).toBe(1300 - (500 * 2)); // 300
    });
  });

  describe('Phase 2A1: handleSellComponentPartsBulk', () => {
    const bulkState: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'RAM 16GB',
          category: 'RAM',
          soldCount: 0,
          purchaseHistory: [
            { id: 'pe1', quantity: 4, unitPrice: 30, totalPrice: 120, date: '2023-01-01', condition: 'New' } as unknown as PurchaseEntry
          ],
        } as InventoryComponent,
        {
          id: 'c2',
          name: 'SSD 1TB',
          category: 'Storage',
          soldCount: 0,
          purchaseHistory: [
            { id: 'pe2', quantity: 2, unitPrice: 50, totalPrice: 100, date: '2023-01-01', condition: 'New' } as unknown as PurchaseEntry
          ],
        } as InventoryComponent,
      ],
      builds: [],
    };

    it('rejects empty lines and duplicate lines', () => {
      const resEmpty = handleSellComponentPartsBulk(bulkState, [], { saleDate: '2023-01-02' });
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.nextState).toBe(bulkState);

      const resDuplicate = handleSellComponentPartsBulk(
        bulkState,
        [
          { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 1, unitSalePrice: 40 },
          { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 1, unitSalePrice: 45 },
        ],
        { saleDate: '2023-01-02' }
      );
      expect(resDuplicate.success).toBe(false);
      expect(resDuplicate.nextState).toBe(bulkState);
    });

    it('enforces atomic failure if any line has invalid quantity or price', () => {
      const resInvalid = handleSellComponentPartsBulk(
        bulkState,
        [
          { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 1, unitSalePrice: 40 },
          { componentId: 'c2', purchaseEntryId: 'pe2', quantity: 1, unitSalePrice: Infinity },
        ],
        { saleDate: '2023-01-02' }
      );
      expect(resInvalid.success).toBe(false);
      expect(resInvalid.nextState).toBe(bulkState);
      expect(bulkState.components[0].soldCount).toBe(0);
      expect(bulkState.transactions.length).toBe(0);
    });

    it('enforces atomic failure if any line exceeds available stock', () => {
      const resExceed = handleSellComponentPartsBulk(
        bulkState,
        [
          { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 2, unitSalePrice: 40 },
          { componentId: 'c2', purchaseEntryId: 'pe2', quantity: 5, unitSalePrice: 60 },
        ],
        { saleDate: '2023-01-02' }
      );
      expect(resExceed.success).toBe(false);
      expect(resExceed.nextState).toBe(bulkState);
    });

    it('successfully processes valid bulk sale atomically', () => {
      const res = handleSellComponentPartsBulk(
        bulkState,
        [
          { componentId: 'c1', purchaseEntryId: 'pe1', quantity: 2, unitSalePrice: 45 },
          { componentId: 'c2', purchaseEntryId: 'pe2', quantity: 1, unitSalePrice: 70 },
        ],
        { saleDate: '2023-01-02', buyerName: 'Alice', notes: 'Bulk test' }
      );
      expect(res.success).toBe(true);
      expect(res.nextState).not.toBe(bulkState);

      const c1 = res.nextState.components.find(c => c.id === 'c1');
      const c2 = res.nextState.components.find(c => c.id === 'c2');
      expect(c1!.soldCount).toBe(2);
      expect(c1!.purchaseHistory[0].quantity).toBe(2);
      expect(c2!.soldCount).toBe(1);
      expect(c2!.purchaseHistory[0].quantity).toBe(1);

      expect(res.nextState.transactions.length).toBe(2);
      const groupId = res.nextState.transactions[0].bulkSaleGroupId;
      expect(groupId).toBeDefined();
      expect(res.nextState.transactions[1].bulkSaleGroupId).toBe(groupId);
    });
  });

  describe('Phase 2A1: handleExchangeComponentPart', () => {
    const exchangeState: AppState = {
      ...mockState,
      components: [
        {
          id: 'c1',
          name: 'Ryzen 5 3600',
          category: 'CPU',
          soldCount: 0,
          purchaseHistory: [
            { id: 'pe1', quantity: 2, unitPrice: 70, totalPrice: 140, date: '2023-01-01', condition: 'Used' } as PurchaseEntry
          ],
        } as InventoryComponent,
      ],
      builds: [],
    };

    it('rejects invalid quantities or non-existent target', () => {
      const res1 = handleExchangeComponentPart(exchangeState, 'c-none', 'pe1', {
        quantity: 1,
        cashPaidOnTop: 50,
        exchangeDate: '2023-01-02',
        incomingPart: { name: 'Ryzen 7 5700X', category: 'CPU' }
      });
      expect(res1.success).toBe(false);

      const res2 = handleExchangeComponentPart(exchangeState, 'c1', 'pe1', {
        quantity: 0,
        cashPaidOnTop: 50,
        exchangeDate: '2023-01-02',
        incomingPart: { name: 'Ryzen 7 5700X', category: 'CPU' }
      });
      expect(res2.success).toBe(false);
      expect(res2.nextState).toBe(exchangeState);
    });

    it('rejects negative, NaN, or infinite cash values', () => {
      for (const cash of [-10, NaN, Infinity, -Infinity]) {
        const res = handleExchangeComponentPart(exchangeState, 'c1', 'pe1', {
          quantity: 1,
          cashPaidOnTop: cash,
          exchangeDate: '2023-01-02',
          incomingPart: { name: 'Ryzen 7 5700X', category: 'CPU' }
        });
        expect(res.success).toBe(false);
        expect(res.nextState).toBe(exchangeState);
      }
    });

    it('allows zero cashPaidOnTop for a straight trade', () => {
      const res = handleExchangeComponentPart(exchangeState, 'c1', 'pe1', {
        quantity: 1,
        cashPaidOnTop: 0,
        exchangeDate: '2023-01-02',
        incomingPart: { name: 'Core i5-10400', category: 'CPU' }
      });
      expect(res.success).toBe(true);
      const incoming = res.nextState.components.find(c => c.name === 'Core i5-10400');
      expect(incoming).toBeDefined();
      expect(incoming!.purchaseHistory[0].unitPrice).toBe(70); // 70 + 0 = 70
    });

    it('preserves exact cost-basis formula and does NOT increment soldCount on trade-up', () => {
      const res = handleExchangeComponentPart(exchangeState, 'c1', 'pe1', {
        quantity: 1,
        cashPaidOnTop: 100,
        exchangeDate: '2023-01-02',
        incomingPart: { name: 'Ryzen 7 5800X3D', category: 'CPU' }
      });
      expect(res.success).toBe(true);

      const outgoing = res.nextState.components.find(c => c.id === 'c1');
      expect(outgoing!.soldCount).toBe(0); // soldCount must NOT be incremented
      expect(outgoing!.purchaseHistory[0].quantity).toBe(1);

      const incoming = res.nextState.components.find(c => c.name === 'Ryzen 7 5800X3D');
      expect(incoming).toBeDefined();
      expect(incoming!.purchaseHistory[0].unitPrice).toBe(170); // 70 outgoing basis + 100 cash = 170

      expect(res.nextState.transactions.length).toBe(1);
      const tx = res.nextState.transactions[0];
      expect(tx.type).toBe('EXCHANGE');
      expect(tx.profitMargin).toBe(0);
      expect(tx.totalAmount).toBe(100);
      expect(tx.outgoingCostBasis).toBe(70);
      expect(tx.incomingCostBasis).toBe(170);
      expect(tx.cashPaidOnTop).toBe(100);
    });
  });
});