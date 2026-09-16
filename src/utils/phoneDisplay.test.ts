import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, phoneHref } from './phoneDisplay';

describe('phone display formatting', () => {
  it('formats ten-digit and country-code-prefixed North American numbers', () => {
    expect(formatPhoneForDisplay('4166664828')).toBe('(416) 666-4828');
    expect(formatPhoneForDisplay('+1 416-666-4828')).toBe('(416) 666-4828');
  });

  it('preserves partial or non-North-American values and produces a safe tel link', () => {
    expect(formatPhoneForDisplay('416-666')).toBe('416-666');
    expect(phoneHref('(416) 666-4828')).toBe('tel:4166664828');
  });
});
