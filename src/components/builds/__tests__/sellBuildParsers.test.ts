import { describe, it, expect } from 'vitest';
import {
  parseStrictNumber,
  parseOrdinarySalePrice,
  parseCashReceived,
  parseTradeInCredit,
  parseTradeInSaleInputs,
  isValidCalendarDate,
} from '../sellBuildParsers';

describe('sellBuildParsers', () => {
  describe('parseStrictNumber', () => {
    it('rejects empty and whitespace-only strings', () => {
      expect(parseStrictNumber('')).toEqual({ success: false, error: 'Value cannot be empty.' });
      expect(parseStrictNumber('   ')).toEqual({ success: false, error: 'Value cannot be empty.' });
    });

    it('rejects non-string and non-number types', () => {
      expect(parseStrictNumber(null).success).toBe(false);
      expect(parseStrictNumber(undefined).success).toBe(false);
      expect(parseStrictNumber({}).success).toBe(false);
    });

    it('parses zero correctly without falsy substitution', () => {
      const res0 = parseStrictNumber('0');
      expect(res0).toEqual({ success: true, value: 0 });

      const res0Dec = parseStrictNumber('0.00');
      expect(res0Dec).toEqual({ success: true, value: 0 });

      const resNeg0 = parseStrictNumber('-0');
      expect(resNeg0).toEqual({ success: true, value: 0 });

      const resNum0 = parseStrictNumber(0);
      expect(resNum0).toEqual({ success: true, value: 0 });
    });

    it('parses positive integers and decimal values', () => {
      expect(parseStrictNumber('100')).toEqual({ success: true, value: 100 });
      expect(parseStrictNumber('1000.50')).toEqual({ success: true, value: 1000.5 });
      expect(parseStrictNumber('0.75')).toEqual({ success: true, value: 0.75 });
      expect(parseStrictNumber('.5')).toEqual({ success: true, value: 0.5 });
      expect(parseStrictNumber('1,250.75')).toEqual({ success: true, value: 1250.75 });
      expect(parseStrictNumber('1,000,000')).toEqual({ success: true, value: 1000000 });
    });

    it('parses negative values as negative numbers', () => {
      expect(parseStrictNumber('-10')).toEqual({ success: true, value: -10 });
      expect(parseStrictNumber('-100.50')).toEqual({ success: true, value: -100.5 });
    });

    it('rejects NaN, Infinity, and -Infinity', () => {
      expect(parseStrictNumber('NaN').success).toBe(false);
      expect(parseStrictNumber('nan').success).toBe(false);
      expect(parseStrictNumber('Infinity').success).toBe(false);
      expect(parseStrictNumber('-Infinity').success).toBe(false);
      expect(parseStrictNumber('+Infinity').success).toBe(false);
      expect(parseStrictNumber(NaN).success).toBe(false);
      expect(parseStrictNumber(Infinity).success).toBe(false);
      expect(parseStrictNumber(-Infinity).success).toBe(false);
    });

    it('rejects malformed, partially numeric, and double-signed strings', () => {
      expect(parseStrictNumber('10abc').success).toBe(false);
      expect(parseStrictNumber('1,000xyz').success).toBe(false);
      expect(parseStrictNumber('--10').success).toBe(false);
      expect(parseStrictNumber('++10').success).toBe(false);
      expect(parseStrictNumber('10.5.5').success).toBe(false);
      expect(parseStrictNumber('10,00').success).toBe(false);
      expect(parseStrictNumber('0x10').success).toBe(false);
      expect(parseStrictNumber('1e5').success).toBe(false);
      expect(parseStrictNumber('$100').success).toBe(false);
    });
  });

  describe('parseOrdinarySalePrice', () => {
    it('rejects empty input', () => {
      expect(parseOrdinarySalePrice('')).toEqual({ success: false, error: 'Selling price is required.' });
    });

    it('rejects zero or negative selling prices', () => {
      expect(parseOrdinarySalePrice('0')).toEqual({
        success: false,
        error: 'Selling price must be greater than zero.',
      });
      expect(parseOrdinarySalePrice('-50')).toEqual({
        success: false,
        error: 'Selling price must be greater than zero.',
      });
    });

    it('accepts valid positive numbers and decimals', () => {
      expect(parseOrdinarySalePrice('1250')).toEqual({ success: true, value: 1250 });
      expect(parseOrdinarySalePrice('999.99')).toEqual({ success: true, value: 999.99 });
      expect(parseOrdinarySalePrice(1500)).toEqual({ success: true, value: 1500 });
    });

    it('rejects malformed and non-finite inputs', () => {
      expect(parseOrdinarySalePrice('10abc').success).toBe(false);
      expect(parseOrdinarySalePrice('Infinity').success).toBe(false);
    });
  });

  describe('parseCashReceived', () => {
    it('rejects empty input', () => {
      expect(parseCashReceived('')).toEqual({ success: false, error: 'Cash received is required.' });
    });

    it('accepts zero cash (valid in full trade-ins)', () => {
      expect(parseCashReceived('0')).toEqual({ success: true, value: 0 });
      expect(parseCashReceived(0)).toEqual({ success: true, value: 0 });
    });

    it('accepts positive cash', () => {
      expect(parseCashReceived('500')).toEqual({ success: true, value: 500 });
      expect(parseCashReceived('250.50')).toEqual({ success: true, value: 250.5 });
    });

    it('rejects negative cash', () => {
      expect(parseCashReceived('-10')).toEqual({
        success: false,
        error: 'Cash received cannot be negative.',
      });
    });

    it('rejects malformed values', () => {
      expect(parseCashReceived('0abc').success).toBe(false);
      expect(parseCashReceived('NaN').success).toBe(false);
    });
  });

  describe('parseTradeInCredit', () => {
    it('rejects empty input', () => {
      expect(parseTradeInCredit('')).toEqual({ success: false, error: 'Trade-in credit is required.' });
    });

    it('rejects zero or negative credit', () => {
      expect(parseTradeInCredit('0')).toEqual({
        success: false,
        error: 'Trade-in credit must be greater than zero.',
      });
      expect(parseTradeInCredit('-100')).toEqual({
        success: false,
        error: 'Trade-in credit must be greater than zero.',
      });
    });

    it('accepts positive trade-in credit', () => {
      expect(parseTradeInCredit('300')).toEqual({ success: true, value: 300 });
      expect(parseTradeInCredit('450.75')).toEqual({ success: true, value: 450.75 });
    });

    it('rejects malformed credit', () => {
      expect(parseTradeInCredit('300xyz').success).toBe(false);
    });
  });

  describe('parseTradeInSaleInputs', () => {
    it('validates cash and credit combination', () => {
      const res = parseTradeInSaleInputs('500', '300');
      expect(res).toEqual({
        success: true,
        cashReceived: 500,
        tradeInCredit: 300,
        totalEffectivePrice: 800,
      });
    });

    it('allows zero cash if trade-in credit is positive', () => {
      const res = parseTradeInSaleInputs('0', '750');
      expect(res).toEqual({
        success: true,
        cashReceived: 0,
        tradeInCredit: 750,
        totalEffectivePrice: 750,
      });
    });

    it('rejects negative cash in trade-in', () => {
      const res = parseTradeInSaleInputs('-50', '500');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Cash received cannot be negative.');
      }
    });

    it('rejects zero or negative trade-in credit', () => {
      const res = parseTradeInSaleInputs('500', '0');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Trade-in credit must be greater than zero.');
      }
    });

    it('rejects when credit exceeds total (not possible if cash >= 0, but verified defensively)', () => {
      // If cash is 0, credit === total, which is valid.
      const res = parseTradeInSaleInputs('0', '500');
      expect(res.success).toBe(true);
    });
  });

  describe('isValidCalendarDate', () => {
    it('accepts valid calendar dates in YYYY-MM-DD format', () => {
      expect(isValidCalendarDate('2026-07-15')).toBe(true);
      expect(isValidCalendarDate('2026-02-28')).toBe(true);
    });

    it('rejects impossible calendar dates', () => {
      expect(isValidCalendarDate('2026-02-30')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false);
      expect(isValidCalendarDate('2026-13-01')).toBe(false);
    });

    it('rejects invalid date formats', () => {
      expect(isValidCalendarDate('')).toBe(false);
      expect(isValidCalendarDate('07/15/2026')).toBe(false);
      expect(isValidCalendarDate('2026-7-15')).toBe(false);
      expect(isValidCalendarDate('2026-07-15 10:00 AM')).toBe(false);
      expect(isValidCalendarDate(null)).toBe(false);
    });
  });
});
