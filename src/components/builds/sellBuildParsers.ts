import { parseDateLocal } from '../../utils/helpers';

export type ParseResult<T = number> =
  | { success: true; value: T; error?: undefined }
  | { success: false; error: string; value?: undefined };

export type TradeInSaleInputsResult =
  | { success: true; cashReceived: number; tradeInCredit: number; totalEffectivePrice: number; error?: undefined }
  | { success: false; error: string; cashReceived?: undefined; tradeInCredit?: undefined; totalEffectivePrice?: undefined };

/**
 * Strict numeric parser that consumes the entire trimmed string.
 * Rejects:
 * - Empty strings
 * - Partial numbers (e.g. "10abc", "1,000xyz")
 * - NaN, Infinity, -Infinity
 * - Double signs or misplaced symbols (e.g. "--10")
 * - Hexadecimal or scientific notation (e.g. "0x10", "1e5")
 * Supports legitimate decimal values (e.g. "10", "10.5", "0.25", ".5")
 * and standard thousands-separated numbers (e.g. "1,000", "1,000.50").
 */
export function parseStrictNumber(input: unknown): ParseResult<number> {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return { success: false, error: 'Value must be a finite number.' };
    }
    return { success: true, value: input };
  }

  if (typeof input !== 'string') {
    return { success: false, error: 'Input must be a string or number.' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: 'Value cannot be empty.' };
  }

  // Reject NaN / Infinity literals
  if (/^(nan|infinity|-infinity|\+infinity)$/i.test(trimmed)) {
    return { success: false, error: 'Value must be a valid finite number.' };
  }

  // Strict pattern: optional sign, digits with optional decimals, OR formatted thousands
  // Does NOT match hex, scientific notation, trailing letters, or multiple signs
  const STRICT_NUM_REGEX = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+|(?:\d{1,3}(?:,\d{3})+)(?:\.\d+)?)$/;
  if (!STRICT_NUM_REGEX.test(trimmed)) {
    return { success: false, error: 'Value contains invalid characters or formatting.' };
  }

  const normalized = trimmed.replace(/,/g, '');
  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    return { success: false, error: 'Value must be a finite number.' };
  }

  // Treat -0 as 0
  return { success: true, value: Object.is(num, -0) ? 0 : num };
}

/**
 * Parses ordinary selling price:
 * - Must be non-empty
 * - Must be finite
 * - Must be strictly greater than zero
 */
export function parseOrdinarySalePrice(input: unknown): ParseResult<number> {
  const res = parseStrictNumber(input);
  if (!res.success) {
    return { success: false, error: res.error === 'Value cannot be empty.' ? 'Selling price is required.' : res.error };
  }
  if (res.value <= 0) {
    return { success: false, error: 'Selling price must be greater than zero.' };
  }
  return { success: true, value: res.value };
}

/**
 * Parses cash received for a trade-in sale:
 * - Must be non-empty
 * - Must be finite
 * - Must be non-negative (zero cash is valid)
 */
export function parseCashReceived(input: unknown): ParseResult<number> {
  const res = parseStrictNumber(input);
  if (!res.success) {
    return { success: false, error: res.error === 'Value cannot be empty.' ? 'Cash received is required.' : res.error };
  }
  if (res.value < 0) {
    return { success: false, error: 'Cash received cannot be negative.' };
  }
  return { success: true, value: res.value };
}

/**
 * Parses trade-in credit:
 * - Must be non-empty
 * - Must be finite
 * - Must be strictly greater than zero
 */
export function parseTradeInCredit(input: unknown): ParseResult<number> {
  const res = parseStrictNumber(input);
  if (!res.success) {
    return { success: false, error: res.error === 'Value cannot be empty.' ? 'Trade-in credit is required.' : res.error };
  }
  if (res.value <= 0) {
    return { success: false, error: 'Trade-in credit must be greater than zero.' };
  }
  return { success: true, value: res.value };
}

/**
 * Validates combined trade-in inputs:
 * - Cash received (>= 0)
 * - Trade-in credit (> 0)
 * - Total = cash + credit (> 0)
 * - Credit cannot exceed total
 */
export function parseTradeInSaleInputs(
  cashInput: unknown,
  creditInput: unknown
): TradeInSaleInputsResult {
  const cashRes = parseCashReceived(cashInput);
  if (!cashRes.success) {
    return { success: false, error: cashRes.error };
  }
  const creditRes = parseTradeInCredit(creditInput);
  if (!creditRes.success) {
    return { success: false, error: creditRes.error };
  }

  const totalEffectivePrice = cashRes.value + creditRes.value;
  if (!Number.isFinite(totalEffectivePrice) || totalEffectivePrice <= 0) {
    return { success: false, error: 'Total effective sale price must be greater than zero.' };
  }

  if (creditRes.value > totalEffectivePrice) {
    return { success: false, error: 'Trade-in credit cannot exceed the total effective sale price.' };
  }

  return {
    success: true,
    cashReceived: cashRes.value,
    tradeInCredit: creditRes.value,
    totalEffectivePrice,
  };
}

/**
 * Validates a calendar date in exact YYYY-MM-DD format using parseDateLocal.
 */
export function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return Boolean(parseDateLocal(trimmed));
}
