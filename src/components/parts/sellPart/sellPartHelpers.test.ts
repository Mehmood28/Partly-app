import { describe, it, expect } from 'vitest';
import { parseCashPaidOnTop } from './sellPartHelpers';

describe('parseCashPaidOnTop', () => {
  it('resolves empty string to valid zero', () => {
    const res = parseCashPaidOnTop('');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.value).toBe(0);
    }

    const resSpaces = parseCashPaidOnTop('   ');
    expect(resSpaces.success).toBe(true);
    if (resSpaces.success) {
      expect(resSpaces.value).toBe(0);
    }
  });

  it('resolves "0" to valid zero', () => {
    const res = parseCashPaidOnTop('0');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.value).toBe(0);
    }

    const resDecimalZero = parseCashPaidOnTop('0.00');
    expect(resDecimalZero.success).toBe(true);
    if (resDecimalZero.success) {
      expect(resDecimalZero.value).toBe(0);
    }
  });

  it('preserves valid positive decimals', () => {
    const res = parseCashPaidOnTop('15.50');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.value).toBe(15.5);
    }

    const resInt = parseCashPaidOnTop('100');
    expect(resInt.success).toBe(true);
    if (resInt.success) {
      expect(resInt.value).toBe(100);
    }
  });

  it('rejects "-10" and does not convert it to zero', () => {
    const res = parseCashPaidOnTop('-10');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Cash paid on top must be a finite non-negative number.');
    }
  });

  it('rejects "Infinity" and "-Infinity"', () => {
    const resPosInf = parseCashPaidOnTop('Infinity');
    expect(resPosInf.success).toBe(false);
    if (!resPosInf.success) {
      expect(resPosInf.error).toBe('Cash paid on top must be a finite non-negative number.');
    }

    const resNegInf = parseCashPaidOnTop('-Infinity');
    expect(resNegInf.success).toBe(false);
    if (!resNegInf.success) {
      expect(resNegInf.error).toBe('Cash paid on top must be a finite non-negative number.');
    }
  });

  it('rejects malformed non-empty strings', () => {
    const malformedInputs = ['abc', '10abc', '12.3.4', '$50', 'NaN', 'undefined', 'null'];
    for (const input of malformedInputs) {
      const res = parseCashPaidOnTop(input);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Cash paid on top must be a finite non-negative number.');
      }
    }
  });
});
