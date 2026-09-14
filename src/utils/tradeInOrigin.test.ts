import { describe, expect, it } from 'vitest';
import { PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import { hasShareableBuildImage } from '../components/builds/discordShareHelpers';
import {
  isPartedOutTradeInEntry,
  resolvePartedOutEntryOrigin,
  resolveTradeInBuildOrigin,
} from './tradeInOrigin';

const sourceSale: TransactionLogItem = {
  id: 'sale-1',
  type: 'SALE',
  title: 'PC Sold',
  timestamp: '2026-09-04',
  dateSortable: '2026-09-04',
  itemCount: 1,
  quantity: 1,
  totalAmount: 4300,
  itemNameOrSummary: 'Sold PC',
  relatedComponentId: 'sold-build',
  incomingTradeInBuildId: 'trade-in-build',
};

const soldBuild: PCBuild = {
  id: 'sold-build',
  name: 'Sold PC',
  status: 'Sold',
  createdDate: '2026-08-30',
  saleDate: '2026-09-04',
  saleTransactionId: 'sale-1',
  buyerName: 'Balraj Shah',
  parts: [],
};

const tradeInBuild: PCBuild = {
  id: 'trade-in-build',
  name: '5900X + RTX 3080',
  status: 'Trade-In Processing',
  createdDate: '2026-09-04',
  acquisitionSource: 'Trade-In',
  sourceSaleTransactionId: 'sale-1',
  parts: [],
};

const partedOutEntry: PurchaseEntry = {
  id: 'entry-1',
  date: '2026-09-04',
  condition: 'Used No Box',
  quantity: 1,
  unitPrice: 400,
  totalPrice: 400,
  paymentMethod: 'Trade-In',
  platform: 'Traded-In PC',
  sourceTradeInBuildId: 'trade-in-build',
  sourceSaleTransactionId: 'sale-1',
};

describe('trade-in origin presentation', () => {
  it('resolves the buyer and date through exact immutable links for existing sales', () => {
    expect(resolveTradeInBuildOrigin(tradeInBuild, [sourceSale], [soldBuild, tradeInBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });

    expect(resolvePartedOutEntryOrigin(partedOutEntry, [sourceSale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
  });

  it('recovers legacy part-outs through a unique exact incoming trade-in build link', () => {
    const legacyEntry = { ...partedOutEntry, sourceSaleTransactionId: undefined };
    const legacyBuild = { ...tradeInBuild, sourceSaleTransactionId: undefined };

    expect(resolvePartedOutEntryOrigin(legacyEntry, [sourceSale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
    expect(resolveTradeInBuildOrigin(legacyBuild, [sourceSale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
  });

  it('prefers the buyer snapshot on the exact source sale transaction', () => {
    const origin = resolveTradeInBuildOrigin(
      tradeInBuild,
      [{ ...sourceSale, buyerName: 'Updated Buyer' }],
      [soldBuild, tradeInBuild]
    );
    expect(origin?.buyerName).toBe('Updated Buyer');
  });

  it('does not infer origin from similar records or ambiguous transaction IDs', () => {
    expect(resolveTradeInBuildOrigin(tradeInBuild, [{ ...sourceSale, id: 'sale-10' }], [soldBuild])).toBeNull();
    expect(resolveTradeInBuildOrigin(tradeInBuild, [sourceSale, { ...sourceSale }], [soldBuild])).toBeNull();
  });

  it('rejects ambiguous legacy links and never overrides a present invalid source ID', () => {
    const legacyEntry = { ...partedOutEntry, sourceSaleTransactionId: undefined };
    const duplicateIncomingSale = { ...sourceSale, id: 'sale-2' };
    expect(
      resolvePartedOutEntryOrigin(legacyEntry, [sourceSale, duplicateIncomingSale], [soldBuild])
    ).toBeNull();
    expect(
      resolvePartedOutEntryOrigin(
        { ...partedOutEntry, sourceSaleTransactionId: 'missing-sale' },
        [sourceSale],
        [soldBuild]
      )
    ).toBeNull();
  });

  it('identifies only PC part-out batches and requires a non-empty image for sharing', () => {
    expect(isPartedOutTradeInEntry(partedOutEntry)).toBe(true);
    expect(isPartedOutTradeInEntry({ ...partedOutEntry, sourceTradeInBuildId: undefined })).toBe(false);
    expect(hasShareableBuildImage({ imageUrl: ' https://example.com/pc.jpg ' })).toBe(true);
    expect(hasShareableBuildImage({ imageUrl: '   ' })).toBe(false);
    expect(hasShareableBuildImage({})).toBe(false);
  });
});
