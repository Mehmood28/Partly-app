import { describe, expect, it } from 'vitest';
import { AppState, PCBuild } from '../../../types';
import { calculateBuildPartsCost } from '../../../utils/helpers';
import { getBuildPresentation } from '../../../utils/buildPresentation';
import {
  handleDismantleBuild,
  handlePurchasePC,
  handleSaveAcquiredPCComponentBreakdown,
} from '../buildActions';

const emptyState = (): AppState => ({ components: [], builds: [], transactions: [] });

const breakdown = [
  { id: 'cpu-row', category: 'CPU' as const, name: 'Ryzen 5 5600X', quantity: 1, unitCost: 200 },
  { id: 'gpu-row', category: 'GPU' as const, name: 'ASUS KO RTX 3060 12GB', quantity: 1, unitCost: 320 },
];

describe('purchased PC actions', () => {
  it('creates one pending acquired-PC asset and one purchase transaction', () => {
    const state = emptyState();
    const result = handlePurchasePC(state, {
      purchasePrice: 520,
      purchaseDate: '2026-09-15',
      seller: 'Facebook · Alex',
      paymentMethod: 'Cash',
      notes: 'Damaged case and unwanted RGB fans omitted.',
      breakdown,
    });

    expect(result.success).toBe(true);
    expect(result.nextState.components).toEqual([]);
    expect(result.nextState.builds).toHaveLength(1);
    expect(result.nextState.transactions).toHaveLength(1);

    const build = result.nextState.builds[0];
    const transaction = result.nextState.transactions[0];
    expect(build.name).toBe('Ryzen 5 5600X + RTX 3060');
    expect(build.status).toBe('In Progress');
    expect(build.acquisitionSource).toBe('Purchased');
    expect(build.estimatedCost).toBe(520);
    expect(build.purchaseSeller).toBe('Facebook · Alex');
    expect(build.acquisitionComponentBreakdown).toHaveLength(2);
    expect(transaction.type).toBe('PURCHASE');
    expect(transaction.purchaseKind).toBe('PC');
    expect(transaction.totalAmount).toBe(520);
    expect(transaction.itemCount).toBe(1);
    expect(transaction.quantity).toBe(1);
    expect(transaction.relatedComponentId).toBe(build.id);
    expect(build.purchaseTransactionId).toBe(transaction.id);
  });

  it('uses the same concise CPU + GPU title as a standard build', () => {
    const result = handlePurchasePC(emptyState(), {
      purchasePrice: 180,
      purchaseDate: '2026-09-15',
      paymentMethod: 'Cash',
      breakdown: [
        { category: 'CPU', name: 'Intel Core i5-12400F (6C/12T)', quantity: 1, unitCost: 60 },
        { category: 'GPU', name: 'XFX Speedster SWFT 210 RX 6600 8GB', quantity: 1, unitCost: 120 },
      ],
    });

    expect(result.nextState.builds[0].name).toBe('i5-12400F + RX 6600');
  });

  it('accepts an optional empty component breakdown', () => {
    const result = handlePurchasePC(emptyState(), {
      name: 'Marketplace PC',
      purchasePrice: 520,
      purchaseDate: '2026-09-15',
      paymentMethod: 'E-Transfer',
      breakdown: [],
    });

    expect(result.success).toBe(true);
    expect(result.nextState.builds[0].acquisitionComponentBreakdown).toEqual([]);
    expect(result.nextState.builds[0].name).toBe('Marketplace PC');
  });

  it('rejects an invalid component cost split atomically', () => {
    const state = emptyState();
    const result = handlePurchasePC(state, {
      purchasePrice: 520,
      purchaseDate: '2026-09-15',
      paymentMethod: 'Cash',
      breakdown: [{ category: 'GPU', name: 'RTX 3060', quantity: 1, unitCost: 400 }],
    });

    expect(result.success).toBe(false);
    expect(result.nextState).toBe(state);
  });

  it('includes the purchased-PC base once and adds only later stock upgrades', () => {
    const build: PCBuild = {
      id: 'purchased-build',
      name: 'Purchased PC',
      parts: [{
        componentId: 'upgrade-ram',
        purchaseEntryId: 'upgrade-batch',
        componentName: '32GB DDR4',
        category: 'RAM',
        quantity: 1,
        unitCostAtAssignment: 80,
      }],
      acquisitionComponentBreakdown: breakdown,
      acquisitionSource: 'Purchased',
      status: 'In Progress',
      createdDate: '2026-09-15',
      estimatedCost: 520,
    };

    expect(calculateBuildPartsCost(build)).toBe(600);
    const presentation = getBuildPresentation(build, []);
    expect(presentation.baseComponents).toHaveLength(2);
    expect(presentation.baseComponents.every((part) => part.source === 'PURCHASED_BASE')).toBe(true);
    expect(presentation.upgrades).toHaveLength(1);
  });

  it('saves a purchased-PC breakdown without using trade-in-only storage', () => {
    const purchase = handlePurchasePC(emptyState(), {
      name: 'Unitemized PC',
      purchasePrice: 520,
      purchaseDate: '2026-09-15',
      paymentMethod: 'Cash',
    });
    const buildId = purchase.nextState.builds[0].id;
    const result = handleSaveAcquiredPCComponentBreakdown(
      purchase.nextState,
      buildId,
      breakdown
    );

    expect(result.success).toBe(true);
    const build = result.nextState.builds[0];
    expect(build.acquisitionComponentBreakdown).toHaveLength(2);
    expect(build.tradeInComponentBreakdown).toBeUndefined();
  });

  it('parts out a purchased PC into stock while preserving its single purchase expense', () => {
    const purchase = handlePurchasePC(emptyState(), {
      name: '5600X + 3060 PC',
      purchasePrice: 520,
      purchaseDate: '2026-09-15',
      seller: 'Balraj Shah',
      paymentMethod: 'E-Transfer',
      breakdown,
    });
    const purchasedBuild = purchase.nextState.builds[0];
    const purchaseTransaction = purchase.nextState.transactions[0];
    const result = handleDismantleBuild(purchase.nextState, purchasedBuild.id, breakdown);

    expect(result.success).toBe(true);
    expect(result.nextState.builds).toEqual([]);
    expect(result.nextState.components).toHaveLength(2);
    expect(result.nextState.transactions.filter((tx) => tx.type === 'PURCHASE')).toEqual([
      purchaseTransaction,
    ]);

    const cpuEntry = result.nextState.components
      .find((component) => component.category === 'CPU')
      ?.purchaseHistory[0];
    expect(cpuEntry?.platform).toBe('Balraj Shah');
    expect(cpuEntry?.paymentMethod).toBe('E-Transfer');
    expect(cpuEntry?.sourcePurchasedBuildId).toBe(purchasedBuild.id);
    expect(cpuEntry?.sourcePurchaseTransactionId).toBe(purchaseTransaction.id);
    expect(cpuEntry?.sourceTradeInBuildId).toBeUndefined();
    expect(result.nextState.transactions[0].buildActivityKind).toBe('PURCHASED_PC_PART_OUT');
  });
});
