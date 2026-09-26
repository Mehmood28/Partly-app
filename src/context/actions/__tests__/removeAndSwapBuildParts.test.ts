import { describe, expect, it } from 'vitest';
import {
  handleAllocatePartToBuild,
  handlePurchasePC,
  handleRemovePartFromBuild,
  handleSwapPartInBuild,
} from '../buildActions';
import { AppState } from '../../../types';
import { calculateBuildPartsCost, calculateUnassignedQuantityStrict } from '../../../utils/helpers';
import { sanitizeAppState } from '../../../utils/storage';

const createScreenshotPurchasedPCState = (): AppState => {
  const initial = handlePurchasePC(
    { components: [], builds: [], transactions: [] },
    {
      name: 'Ultra 7 270K Plus + RTX 5080',
      purchasePrice: 2650,
      purchaseDate: '2026-09-24',
      seller: 'Best Buy Marketplace',
      paymentMethod: 'Cash',
      breakdown: [
        { id: 'part-gpu', category: 'GPU', name: 'PNY RTX 5080 OC 16GB', quantity: 1, unitCost: 1500 },
        { id: 'part-cpu', category: 'CPU', name: 'Intel Core Ultra 7 270K Plus (24C/24T)', quantity: 1, unitCost: 250 },
        { id: 'part-mobo', category: 'Motherboard', name: 'ASUS B860M Max Gaming AX', quantity: 1, unitCost: 150 },
        { id: 'part-ram', category: 'RAM', name: 'T-Force Vulcan 32GB (2x16GB) DDR5 6400MHz CL38', quantity: 1, unitCost: 300 },
        { id: 'part-cooler', category: 'Cooling', name: 'CyberPowerPC 360mm ARGB AIO Black', quantity: 1, unitCost: 70 },
        { id: 'part-ssd', category: 'Storage', name: 'ADATA 860 Legend 2TB GEN4 NVMe SSD', quantity: 1, unitCost: 200 },
        { id: 'part-psu', category: 'PSU', name: 'XPG Core Shift 1000W ATX 3.1 Black', quantity: 1, unitCost: 80 },
        { id: 'part-case', category: 'Case', name: 'Phanteks Evolv X2 Black', quantity: 1, unitCost: 100 },
      ],
    }
  );
  return initial.nextState;
};

describe('Remove and Swap Build Parts (Base and Allocated Components)', () => {
  it('correctly handles the specific user scenario: removes RTX 5080 and 1000W PSU, updating cost from $2,650 to $1,070 and returning exact batches to inventory', () => {
    const startState = createScreenshotPurchasedPCState();
    const buildId = startState.builds[0].id;
    const initialTxCount = startState.transactions.length;

    // Starting checks
    expect(calculateBuildPartsCost(startState.builds[0])).toBe(2650);
    expect(startState.components).toHaveLength(0);

    // 1. Remove RTX 5080
    const step1 = handleRemovePartFromBuild(startState, buildId, 'part-gpu');
    expect(step1.success).toBe(true);

    const buildStep1 = step1.nextState.builds.find((b) => b.id === buildId)!;
    expect(calculateBuildPartsCost(buildStep1)).toBe(1150); // $2,650 - $1,500 = $1,150
    expect(buildStep1.acquisitionComponentBreakdown).toHaveLength(7);
    expect(buildStep1.acquisitionComponentBreakdown?.some((p) => p.name === 'PNY RTX 5080 OC 16GB')).toBe(false);

    // Verify GPU is in inventory with exact batch
    const gpuComponent = step1.nextState.components.find((c) => c.name === 'PNY RTX 5080 OC 16GB')!;
    expect(gpuComponent).toBeDefined();
    expect(gpuComponent.category).toBe('GPU');
    expect(gpuComponent.assignedCount).toBe(0);
    expect(gpuComponent.purchaseHistory).toHaveLength(1);
    const gpuBatch = gpuComponent.purchaseHistory[0];
    expect(gpuBatch.id).toBe(`pe-${buildId}-part-gpu`);
    expect(gpuBatch.quantity).toBe(1);
    expect(gpuBatch.unitPrice).toBe(1500);
    expect(gpuBatch.totalPrice).toBe(1500);
    expect(gpuBatch.date).toBe('2026-09-24');
    expect(gpuBatch.sourcePurchasedBuildId).toBe(buildId);
    expect(calculateUnassignedQuantityStrict(gpuComponent, step1.nextState.builds)).toBe(1);

    // Ensure no new purchase transaction was created
    expect(step1.nextState.transactions).toHaveLength(initialTxCount);

    // 2. Remove 1000W PSU
    const step2 = handleRemovePartFromBuild(step1.nextState, buildId, 'part-psu');
    expect(step2.success).toBe(true);

    const buildStep2 = step2.nextState.builds.find((b) => b.id === buildId)!;
    // Expected remaining build cost: $1,070.00 ($2,650 - $1,500 - $80 = $1,070)
    expect(calculateBuildPartsCost(buildStep2)).toBe(1070);
    expect(buildStep2.acquisitionComponentBreakdown).toHaveLength(6);
    expect(buildStep2.acquisitionComponentBreakdown?.some((p) => p.name === 'XPG Core Shift 1000W ATX 3.1 Black')).toBe(false);

    // Verify exact remaining 6 components
    const remainingNames = buildStep2.acquisitionComponentBreakdown?.map((p) => p.name);
    expect(remainingNames).toEqual([
      'Intel Core Ultra 7 270K Plus (24C/24T)',
      'ASUS B860M Max Gaming AX',
      'T-Force Vulcan 32GB (2x16GB) DDR5 6400MHz CL38',
      'CyberPowerPC 360mm ARGB AIO Black',
      'ADATA 860 Legend 2TB GEN4 NVMe SSD',
      'Phanteks Evolv X2 Black',
    ]);

    // Verify PSU in inventory with exact batch
    const psuComponent = step2.nextState.components.find((c) => c.name === 'XPG Core Shift 1000W ATX 3.1 Black')!;
    expect(psuComponent).toBeDefined();
    expect(psuComponent.category).toBe('PSU');
    expect(psuComponent.assignedCount).toBe(0);
    expect(psuComponent.purchaseHistory).toHaveLength(1);
    const psuBatch = psuComponent.purchaseHistory[0];
    expect(psuBatch.id).toBe(`pe-${buildId}-part-psu`);
    expect(psuBatch.quantity).toBe(1);
    expect(psuBatch.unitPrice).toBe(80);
    expect(psuBatch.totalPrice).toBe(80);
    expect(psuBatch.date).toBe('2026-09-24');
    expect(psuBatch.sourcePurchasedBuildId).toBe(buildId);
    expect(calculateUnassignedQuantityStrict(psuComponent, step2.nextState.builds)).toBe(1);

    // 3. Verify no duplicate inventory item is created if component already exists
    // Suppose an existing inventory component already exists for PNY RTX 5080 OC 16GB
    const stateWithPreExistingGPU: AppState = {
      ...startState,
      components: [
        {
          id: 'comp-pre-existing-gpu',
          name: 'PNY RTX 5080 OC 16GB',
          category: 'GPU',
          specifications: '',
          assignedCount: 0,
          purchaseHistory: [
            {
              id: 'pe-old-batch',
              date: '2026-09-01',
              condition: 'Used',
              quantity: 2,
              unitPrice: 1450,
              totalPrice: 2900,
              paymentMethod: 'Cash',
              platform: 'Local',
            },
          ],
        },
      ],
    };

    const stepPreExisting = handleRemovePartFromBuild(stateWithPreExistingGPU, buildId, 'part-gpu');
    expect(stepPreExisting.success).toBe(true);
    // There should still be exactly 1 component named 'PNY RTX 5080 OC 16GB', not 2 duplicate components
    const gpuComps = stepPreExisting.nextState.components.filter((c) => c.name === 'PNY RTX 5080 OC 16GB');
    expect(gpuComps).toHaveLength(1);
    expect(gpuComps[0].id).toBe('comp-pre-existing-gpu');
    expect(gpuComps[0].purchaseHistory).toHaveLength(2);
    expect(gpuComps[0].purchaseHistory.some((e) => e.id === `pe-${buildId}-part-gpu`)).toBe(true);
  });

  it('preserves exact state under persistence hydration and sanitization', () => {
    const startState = createScreenshotPurchasedPCState();
    const buildId = startState.builds[0].id;

    // Remove GPU and PSU
    const step1 = handleRemovePartFromBuild(startState, buildId, 'part-gpu');
    const step2 = handleRemovePartFromBuild(step1.nextState, buildId, 'part-psu');
    expect(step2.success).toBe(true);

    // Simulate saving and loading from persistent storage
    const serialized = JSON.parse(JSON.stringify(step2.nextState));
    const hydratedState = sanitizeAppState(serialized);

    const hydratedBuild = hydratedState.builds.find((b) => b.id === buildId)!;
    expect(calculateBuildPartsCost(hydratedBuild)).toBe(1070);
    expect(hydratedBuild.acquisitionComponentBreakdown).toHaveLength(6);

    const hydratedGPU = hydratedState.components.find((c) => c.name === 'PNY RTX 5080 OC 16GB')!;
    expect(hydratedGPU).toBeDefined();
    expect(calculateUnassignedQuantityStrict(hydratedGPU, hydratedState.builds)).toBe(1);
    expect(hydratedGPU.purchaseHistory[0].unitPrice).toBe(1500);

    const hydratedPSU = hydratedState.components.find((c) => c.name === 'XPG Core Shift 1000W ATX 3.1 Black')!;
    expect(hydratedPSU).toBeDefined();
    expect(calculateUnassignedQuantityStrict(hydratedPSU, hydratedState.builds)).toBe(1);
    expect(hydratedPSU.purchaseHistory[0].unitPrice).toBe(80);
  });

  it('swaps a base part cleanly: returns old exact batch and consumes new exact batch from inventory', () => {
    const baseState = createScreenshotPurchasedPCState();
    const buildId = baseState.builds[0].id;

    // Add a replacement GPU into inventory
    const stateWithInventory: AppState = {
      ...baseState,
      components: [
        {
          id: 'comp-replacement-gpu',
          name: 'ASUS Dual RTX 4070 Super 12GB',
          category: 'GPU',
          specifications: '',
          assignedCount: 0,
          purchaseHistory: [
            {
              id: 'batch-4070-super',
              date: '2026-09-10',
              condition: 'New Open Box',
              quantity: 1,
              unitPrice: 650,
              totalPrice: 650,
              paymentMethod: 'Credit Card',
              platform: 'Newegg',
            },
          ],
        },
      ],
    };

    // Swap the RTX 5080 with the RTX 4070 Super
    const swapResult = handleSwapPartInBuild(
      stateWithInventory,
      buildId,
      'part-gpu',
      undefined,
      'comp-replacement-gpu',
      'batch-4070-super',
      1
    );

    expect(swapResult.success).toBe(true);

    const updatedBuild = swapResult.nextState.builds.find((b) => b.id === buildId)!;
    // Old base RTX 5080 ($1500) removed -> base cost reduced to $1,150
    // Replacement RTX 4070 Super ($650) allocated -> partsSum = $650
    // Total build cost: $1,150 + $650 = $1,800
    expect(calculateBuildPartsCost(updatedBuild)).toBe(1800);
    expect(updatedBuild.acquisitionComponentBreakdown?.some((p) => p.name === 'PNY RTX 5080 OC 16GB')).toBe(false);
    expect(updatedBuild.parts).toHaveLength(1);
    expect(updatedBuild.parts[0].componentName).toBe('ASUS Dual RTX 4070 Super 12GB');
    expect(updatedBuild.parts[0].unitCostAtAssignment).toBe(650);

    // Old GPU returned to available inventory
    const oldGpuInInventory = swapResult.nextState.components.find((c) => c.name === 'PNY RTX 5080 OC 16GB')!;
    expect(oldGpuInInventory).toBeDefined();
    expect(calculateUnassignedQuantityStrict(oldGpuInInventory, swapResult.nextState.builds)).toBe(1);
    expect(oldGpuInInventory.purchaseHistory[0].unitPrice).toBe(1500);

    // Replacement GPU stock consumed (assignedCount = 1, available = 0)
    const replacementInInventory = swapResult.nextState.components.find((c) => c.id === 'comp-replacement-gpu')!;
    expect(replacementInInventory.assignedCount).toBe(1);
    expect(calculateUnassignedQuantityStrict(replacementInInventory, swapResult.nextState.builds)).toBe(0);
  });

  it('rejects swapping or allocating unavailable quantity', () => {
    const baseState = createScreenshotPurchasedPCState();
    const buildId = baseState.builds[0].id;

    // Inventory only has 1 unit of replacement GPU
    const stateWithInventory: AppState = {
      ...baseState,
      components: [
        {
          id: 'comp-replacement-gpu',
          name: 'ASUS Dual RTX 4070 Super 12GB',
          category: 'GPU',
          specifications: '',
          assignedCount: 0,
          purchaseHistory: [
            {
              id: 'batch-4070-super',
              date: '2026-09-10',
              condition: 'New Open Box',
              quantity: 1,
              unitPrice: 650,
              totalPrice: 650,
              paymentMethod: 'Credit Card',
              platform: 'Newegg',
            },
          ],
        },
      ],
    };

    // Attempt to swap requesting 2 units when only 1 is available
    const failSwap = handleSwapPartInBuild(
      stateWithInventory,
      buildId,
      'part-gpu',
      undefined,
      'comp-replacement-gpu',
      'batch-4070-super',
      2
    );
    expect(failSwap.success).toBe(false);
    expect(failSwap.error).toMatch(/Insufficient stock/);

    // Attempt to allocate 5 units when only 1 is available
    const failAllocate = handleAllocatePartToBuild(
      stateWithInventory,
      buildId,
      'comp-replacement-gpu',
      'batch-4070-super',
      5
    );
    expect(failAllocate.success).toBe(false);
    expect(failAllocate.error).toMatch(/exceeds available batch stock/);
  });

  it('removes allocated upgrade parts from build.parts with exact batch preservation', () => {
    const baseState = createScreenshotPurchasedPCState();
    const buildId = baseState.builds[0].id;

    // Allocate an additional cooling fan upgrade to the build
    const stateWithFan: AppState = {
      ...baseState,
      components: [
        {
          id: 'comp-fan',
          name: 'Lian Li Uni Fan SL-Infinity 120 Black',
          category: 'Fans',
          specifications: '',
          assignedCount: 0,
          purchaseHistory: [
            {
              id: 'batch-fan',
              date: '2026-09-12',
              condition: 'Sealed',
              quantity: 3,
              unitPrice: 35,
              totalPrice: 105,
              paymentMethod: 'Cash',
              platform: 'Local',
            },
          ],
        },
      ],
    };

    const allocated = handleAllocatePartToBuild(stateWithFan, buildId, 'comp-fan', 'batch-fan', 1);
    expect(allocated.success).toBe(true);

    const buildWithFan = allocated.nextState.builds.find((b) => b.id === buildId)!;
    expect(calculateBuildPartsCost(buildWithFan)).toBe(2685); // $2650 + $35 = $2685
    expect(buildWithFan.parts).toHaveLength(1);

    // Now remove the allocated upgrade fan
    const removedFan = handleRemovePartFromBuild(allocated.nextState, buildId, 'comp-fan', 'batch-fan');
    expect(removedFan.success).toBe(true);

    const finalBuild = removedFan.nextState.builds.find((b) => b.id === buildId)!;
    expect(calculateBuildPartsCost(finalBuild)).toBe(2650);
    expect(finalBuild.parts).toHaveLength(0);

    const fanComp = removedFan.nextState.components.find((c) => c.id === 'comp-fan')!;
    expect(fanComp.assignedCount).toBe(0);
    expect(calculateUnassignedQuantityStrict(fanComp, removedFan.nextState.builds)).toBe(3);
  });

  it('supports undo restoring the removed GPU and PSU and redo removing them again', () => {
    const startState = createScreenshotPurchasedPCState();
    const buildId = startState.builds[0].id;

    // Simulate undo stack operations:
    // State 0: Initial build with RTX 5080 and 1000W PSU ($2,650)
    expect(calculateBuildPartsCost(startState.builds[0])).toBe(2650);

    // Action 1: Remove RTX 5080
    const step1 = handleRemovePartFromBuild(startState, buildId, 'part-gpu');
    expect(step1.success).toBe(true);
    expect(calculateBuildPartsCost(step1.nextState.builds[0])).toBe(1150);

    // Action 2: Remove 1000W PSU
    const step2 = handleRemovePartFromBuild(step1.nextState, buildId, 'part-psu');
    expect(step2.success).toBe(true);
    expect(calculateBuildPartsCost(step2.nextState.builds[0])).toBe(1070);

    // Undo 1: Restores PSU to build ($1,150)
    const undo1State = step1.nextState;
    expect(calculateBuildPartsCost(undo1State.builds[0])).toBe(1150);
    expect(undo1State.builds[0].acquisitionComponentBreakdown?.some((p) => p.name === 'XPG Core Shift 1000W ATX 3.1 Black')).toBe(true);
    expect(undo1State.components.some((c) => c.name === 'XPG Core Shift 1000W ATX 3.1 Black')).toBe(false);

    // Undo 2: Restores GPU to build ($2,650)
    const undo2State = startState;
    expect(calculateBuildPartsCost(undo2State.builds[0])).toBe(2650);
    expect(undo2State.builds[0].acquisitionComponentBreakdown).toHaveLength(8);
    expect(undo2State.builds[0].acquisitionComponentBreakdown?.some((p) => p.name === 'PNY RTX 5080 OC 16GB')).toBe(true);
    expect(undo2State.components).toHaveLength(0);

    // Redo 1: Re-removes GPU ($1,150)
    const redo1State = step1.nextState;
    expect(calculateBuildPartsCost(redo1State.builds[0])).toBe(1150);
    expect(redo1State.components.some((c) => c.name === 'PNY RTX 5080 OC 16GB')).toBe(true);

    // Redo 2: Re-removes PSU ($1,070)
    const redo2State = step2.nextState;
    expect(calculateBuildPartsCost(redo2State.builds[0])).toBe(1070);
    expect(redo2State.components.some((c) => c.name === 'XPG Core Shift 1000W ATX 3.1 Black')).toBe(true);
    expect(redo2State.builds[0].acquisitionComponentBreakdown).toHaveLength(6);
  });
});
