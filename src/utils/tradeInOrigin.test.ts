import { describe, expect, it } from 'vitest';
import { PCBuild, PurchaseEntry, TransactionLogItem } from '../types';
import { hasShareableBuildImage } from '../components/builds/discordShareHelpers';
import {
  isPartedOutTradeInEntry,
  resolvePartedOutEntryOrigin,
  resolvePurchaseEntrySeller,
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
  notes: 'Parted out from traded-in PC: 5900X + RTX 3080',
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

  it('recovers an older part-out through its unique trade-in name and date', () => {
    const olderSale = {
      ...sourceSale,
      incomingTradeInBuildId: undefined,
      tradeInBuildName: '5900X + RTX 3080',
    };
    const olderEntry = {
      ...partedOutEntry,
      sourceSaleTransactionId: undefined,
    };

    expect(resolvePartedOutEntryOrigin(olderEntry, [olderSale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
    expect(resolvePurchaseEntrySeller(olderEntry, [olderSale], [soldBuild])).toBe('Balraj Shah');
  });

  it('uses the buyer saved on the sold build as the authoritative name', () => {
    const origin = resolveTradeInBuildOrigin(
      tradeInBuild,
      [{ ...sourceSale, buyerName: 'Updated Buyer' }],
      [soldBuild, tradeInBuild]
    );
    expect(origin?.buyerName).toBe('Balraj Shah');
  });

  it('uses the sold build reverse link when a legacy sale lacks its related build ID', () => {
    const legacySale = {
      ...sourceSale,
      buyerName: undefined,
      relatedComponentId: undefined,
    };

    expect(resolvePartedOutEntryOrigin(partedOutEntry, [legacySale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
  });

  it('repairs a stale source ID from one trade-in sale on the same date', () => {
    const legacySale = {
      ...sourceSale,
      buyerName: undefined,
      relatedComponentId: undefined,
      incomingTradeInBuildId: undefined,
      tradeInBuildName: 'Traded Rig',
      tradeInCredit: 1000,
    };
    const legacyEntry = {
      ...partedOutEntry,
      sourceSaleTransactionId: 'missing-sale',
      sourceTradeInBuildId: 'deleted-trade-in-build',
    };

    expect(resolvePartedOutEntryOrigin(legacyEntry, [legacySale], [soldBuild])).toEqual({
      buyerName: 'Balraj Shah',
      date: '2026-09-04',
      sourceSaleTransactionId: 'sale-1',
    });
    expect(resolvePurchaseEntrySeller(legacyEntry, [legacySale], [soldBuild])).toBe('Balraj Shah');
  });

  it('does not infer origin from an unrelated normal sale or duplicate transaction IDs', () => {
    const unrelatedSale = {
      ...sourceSale,
      id: 'sale-10',
      timestamp: '2026-09-05',
      dateSortable: '2026-09-05',
      incomingTradeInBuildId: undefined,
      tradeInBuildName: undefined,
      tradeInCredit: undefined,
    };
    expect(resolveTradeInBuildOrigin(tradeInBuild, [unrelatedSale], [soldBuild])).toBeNull();
    expect(resolveTradeInBuildOrigin(tradeInBuild, [sourceSale, { ...sourceSale }], [soldBuild])).toBeNull();
  });

  it('rejects ambiguous legacy links instead of guessing a buyer', () => {
    const legacyEntry = { ...partedOutEntry, sourceSaleTransactionId: undefined };
    const duplicateIncomingSale = { ...sourceSale, id: 'sale-2' };
    expect(
      resolvePartedOutEntryOrigin(legacyEntry, [sourceSale, duplicateIncomingSale], [soldBuild])
    ).toBeNull();

    const olderEntry = { ...legacyEntry, notes: 'Parted out from traded-in PC: 5900X + RTX 3080' };
    const legacyNamedSale = {
      ...sourceSale,
      incomingTradeInBuildId: undefined,
      tradeInBuildName: '5900X + RTX 3080',
    };
    expect(
      resolvePartedOutEntryOrigin(
        olderEntry,
        [legacyNamedSale, { ...legacyNamedSale, id: 'sale-2' }],
        [soldBuild]
      )
    ).toBeNull();

    const staleEntry = {
      ...partedOutEntry,
      sourceSaleTransactionId: 'missing-sale',
      sourceTradeInBuildId: 'deleted-trade-in-build',
      notes: 'Parted out from traded-in PC: Different Label',
    };
    const datedSale = {
      ...sourceSale,
      incomingTradeInBuildId: undefined,
      tradeInBuildName: 'First Trade-In',
      tradeInCredit: 1000,
    };
    expect(
      resolvePartedOutEntryOrigin(
        staleEntry,
        [datedSale, { ...datedSale, id: 'sale-2', tradeInBuildName: 'Second Trade-In' }],
        [soldBuild]
      )
    ).toBeNull();
  });

  it('falls back to the stored platform when no buyer can be resolved', () => {
    expect(resolvePurchaseEntrySeller(partedOutEntry, [], [])).toBe('Traded-In PC');
  });

  it('identifies only PC part-out batches and requires a non-empty image for sharing', () => {
    expect(isPartedOutTradeInEntry(partedOutEntry)).toBe(true);
    expect(isPartedOutTradeInEntry({ ...partedOutEntry, sourceTradeInBuildId: undefined })).toBe(false);
    expect(hasShareableBuildImage({ imageUrl: ' https://example.com/pc.jpg ' })).toBe(true);
    expect(hasShareableBuildImage({ imageUrl: '   ' })).toBe(false);
    expect(hasShareableBuildImage({})).toBe(false);
  });
});
