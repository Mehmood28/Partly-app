import { describe, it, expect } from 'vitest';
import { handleSellBuild } from '../buildActions';
import { AppState, PCBuild } from '../../../types';

describe('Phase 3A - handleSellBuild Domain Validation', () => {
  const getMockState = (): AppState => {
    const build: PCBuild = {
      id: 'b-active',
      name: 'Gaming Rig 1',
      status: 'Listed for Sale',
      createdDate: '2026-07-01',
      builtDate: '2026-07-10',
      parts: [],
      warrantyDays: 30,
    };
    return {
      components: [],
      builds: [build],
      transactions: [],
      monthlyGoal: 1000,
    };
  };

  it('rejects nonexistent buildId', () => {
    const state = getMockState();
    const res = handleSellBuild(state, 'nonexistent', {
      salePrice: 1200,
      saleDate: '2026-07-20',
      platformSoldOn: 'Facebook',
      paymentMethod: 'Cash',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Build not found.');
    expect(res.nextState).toBe(state);
  });

  describe('salePrice validation', () => {
    it('rejects non-numeric, NaN, Infinity, zero, and negative salePrice', () => {
      const state = getMockState();
      const invalidPrices = [0, -1, -500, NaN, Infinity, -Infinity, '1200' as any, null as any, undefined as any];

      for (const price of invalidPrices) {
        const res = handleSellBuild(state, 'b-active', {
          salePrice: price,
          saleDate: '2026-07-20',
          platformSoldOn: 'Facebook',
          paymentMethod: 'Cash',
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Sale price must be a finite number greater than zero.');
        expect(res.nextState).toBe(state);
      }
    });

    it('accepts valid positive finite salePrice', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1450.50,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
      });
      expect(res.success).toBe(true);
      expect(res.nextState.transactions[0].totalAmount).toBe(1450.50);
    });
  });

  describe('date validation and daysOnMarket calculation', () => {
    it('rejects invalid saleDate formats and invalid calendar dates', () => {
      const state = getMockState();
      const invalidDates = [
        '2026-7-20',
        '07-20-2026',
        '2026/07/20',
        '2026-02-30', // impossible Feb date
        '2026-13-01', // impossible month
        '2026-04-31', // April has 30 days
        '',
        'invalid',
      ];

      for (const date of invalidDates) {
        const res = handleSellBuild(state, 'b-active', {
          salePrice: 1000,
          saleDate: date,
          platformSoldOn: 'Facebook',
          paymentMethod: 'Cash',
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Sale date must be a valid calendar date in exact YYYY-MM-DD format.');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects invalid builtDate formats and invalid calendar dates', () => {
      const state = getMockState();
      const invalidDates = ['2026-02-31', 'invalid', '2026/05/10'];

      for (const date of invalidDates) {
        const res = handleSellBuild(state, 'b-active', {
          salePrice: 1000,
          saleDate: '2026-07-20',
          builtDate: date,
          platformSoldOn: 'Facebook',
          paymentMethod: 'Cash',
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Built date must be a valid calendar date in exact YYYY-MM-DD format.');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects builtDate that is strictly after saleDate', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        builtDate: '2026-07-21',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Built date cannot be later than sale date.');
      expect(res.nextState).toBe(state);
    });

    it('calculates daysOnMarket accurately without Math.max masking', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-25',
        builtDate: '2026-07-10', // 15 days later
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
      });
      expect(res.success).toBe(true);
      const soldBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
      expect(soldBuild.daysOnMarket).toBe(15);
    });

    it('calculates daysOnMarket as 0 when builtDate equals saleDate', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-10',
        builtDate: '2026-07-10',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
      });
      expect(res.success).toBe(true);
      const soldBuild = res.nextState.builds.find((b) => b.id === 'b-active')!;
      expect(soldBuild.daysOnMarket).toBe(0);
    });
  });

  describe('platform and payment method validation', () => {
    it('rejects empty or whitespace platformSoldOn and trims valid platform', () => {
      const state = getMockState();
      const resEmpty = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        platformSoldOn: '   ',
        paymentMethod: 'Cash',
      });
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toContain('Platform sold on must be a non-empty string.');
      expect(resEmpty.nextState).toBe(state);

      const resValid = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        platformSoldOn: '  Craigslist  ',
        paymentMethod: 'Cash',
      });
      expect(resValid.success).toBe(true);
      expect(resValid.nextState.transactions[0].platform).toBe('Craigslist');
      expect(resValid.nextState.builds[0].platformSoldOn).toBe('Craigslist');
    });

    it('rejects invalid payment method', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Barter' as any,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid payment method.');
      expect(res.nextState).toBe(state);
    });
  });

  describe('trade-in validation', () => {
    it('rejects trade-in credit that is zero, negative, NaN, or non-finite', () => {
      const state = getMockState();
      const invalidCredits = [0, -10, NaN, Infinity, '500' as any];

      for (const credit of invalidCredits) {
        const res = handleSellBuild(state, 'b-active', {
          salePrice: 1000,
          saleDate: '2026-07-20',
          platformSoldOn: 'Facebook',
          paymentMethod: 'Cash',
          tradeIn: {
            tradeInCredit: credit,
            tradeInBuildName: 'Old Rig',
          },
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Trade-in credit must be a finite number greater than zero.');
        expect(res.nextState).toBe(state);
      }
    });

    it('rejects trade-in credit exceeding total effective sale price', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
        tradeIn: {
          tradeInCredit: 1200,
          tradeInBuildName: 'Old Rig',
        },
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Trade-in credit cannot exceed the total effective sale price.');
      expect(res.nextState).toBe(state);
    });

    it('rejects empty or whitespace tradeInBuildName', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1000,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
        tradeIn: {
          tradeInCredit: 400,
          tradeInBuildName: '   ',
        },
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Trade-in build name must be a non-empty string.');
      expect(res.nextState).toBe(state);
    });

    it('accepts valid trade-in and computes exact cash portion and trade-in build', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 1500,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Cash',
        tradeIn: {
          tradeInCredit: 500,
          tradeInBuildName: '  Customer GTX 1070 Rig  ',
          tradeInNotes: 'Minor scratch on panel',
        },
      });
      expect(res.success).toBe(true);
      const tx = res.nextState.transactions[0];
      expect(tx.tradeInCredit).toBe(500);
      expect(tx.cashPortion).toBe(1000);
      expect(tx.tradeInBuildName).toBe('Customer GTX 1070 Rig');

      const incomingBuild = res.nextState.builds.find((b) => b.id === tx.incomingTradeInBuildId)!;
      expect(incomingBuild).toBeDefined();
      expect(incomingBuild.name).toBe('Customer GTX 1070 Rig');
      expect(incomingBuild.estimatedCost).toBe(500);
      expect(incomingBuild.status).toBe('Trade-In Processing');
    });

    it('handles trade-in where credit equals full sale price (zero cash portion)', () => {
      const state = getMockState();
      const res = handleSellBuild(state, 'b-active', {
        salePrice: 800,
        saleDate: '2026-07-20',
        platformSoldOn: 'Facebook',
        paymentMethod: 'Trade-In',
        tradeIn: {
          tradeInCredit: 800,
          tradeInBuildName: 'Direct Trade Rig',
        },
      });
      expect(res.success).toBe(true);
      const tx = res.nextState.transactions[0];
      expect(tx.tradeInCredit).toBe(800);
      expect(tx.cashPortion).toBe(0);
    });
  });
});
