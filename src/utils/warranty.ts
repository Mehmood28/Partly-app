import { parseDateLocal } from './helpers';

export const BUILD_WARRANTY_DAYS = 30;

export interface BuildWarrantyInfo {
  isActive: boolean;
  daysLeft: number;
  expiryDate: Date;
  expiryFormatted: string;
  statusText: string;
}

/**
 * Checks if a value is a valid warranty days duration (finite, positive whole number).
 */
export function isValidWarrantyDays(days: unknown): boolean {
  if (days === undefined || days === null || days === '') return false;
  const parsed = Number(days);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0;
}

/**
 * Normalizes warranty days to a finite positive whole number.
 * Returns fallback (default 30) for invalid, negative, fractional, NaN, or missing values.
 */
export function normalizeWarrantyDays(days: unknown, fallback: number = BUILD_WARRANTY_DAYS): number {
  if (isValidWarrantyDays(days)) {
    return Number(days);
  }
  return fallback;
}

/**
 * Validates and normalizes warranty days.
 * Returns a finite, positive whole number.
 * Defaults to BUILD_WARRANTY_DAYS (30) for invalid, negative, fractional, NaN, or missing values.
 */
export function validateWarrantyDays(days: unknown): number {
  return normalizeWarrantyDays(days, BUILD_WARRANTY_DAYS);
}

export function formatWarrantyLabel(days: number | string | null | undefined): string {
  const validDays = normalizeWarrantyDays(days, BUILD_WARRANTY_DAYS);
  if (validDays === 365) return '1 Year Parts and Labour Warranty';
  if (validDays === 730) return '2 Year Parts and Labour Warranty';
  return `${validDays} Day Parts and Labour Warranty`;
}

/**
 * Calculates PC build parts & labour warranty information.
 *
 * Day Zero Rule & Timing Invariants:
 * 1. The exact build `saleDate` is Day 0 (the date of sale/delivery).
 * 2. The warranty term is exactly `warrantyDays` calendar days from the sale date.
 * 3. On the sale date itself (Day 0, today), exactly `warrantyDays` days remain (ACTIVE).
 * 4. On Day `warrantyDays - 1`, exactly 1 day remains (ACTIVE).
 * 5. On Day `warrantyDays` (the exact expiry date), 0 days remain (EXPIRED).
 * 6. Beyond Day `warrantyDays` (> warrantyDays calendar days elapsed), the warranty is EXPIRED.
 * 7. Future sale dates (later than the reference calendar date) return null so no warranty banner is shown.
 * 8. Calendar dates are parsed using parseDateLocal to prevent UTC-to-local timezone day shifts.
 * 9. Invalid, empty, or unparseable sale dates return null so UI surfaces can hide or mark unavailable.
 */
export function getBuildWarrantyInfo(
  saleDate?: string | null,
  referenceDate: Date = new Date(),
  warrantyDays: unknown = BUILD_WARRANTY_DAYS
): BuildWarrantyInfo | null {
  if (!saleDate || typeof saleDate !== 'string') {
    return null;
  }

  if (!referenceDate || isNaN(referenceDate.getTime())) {
    return null;
  }

  const parsed = parseDateLocal(saleDate);
  if (!parsed) {
    return null;
  }

  const validWarrantyDays = normalizeWarrantyDays(warrantyDays, BUILD_WARRANTY_DAYS);

  const { year, monthIndex, day } = parsed;
  // Local calendar midnight of the sale date
  const saleMidnight = new Date(year, monthIndex, day, 0, 0, 0, 0);

  // Exact expiry date is `validWarrantyDays` calendar days after the sale date
  const expiryDate = new Date(year, monthIndex, day + validWarrantyDays, 0, 0, 0, 0);

  // Local calendar midnight of the reference comparison date (current date by default)
  const referenceMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );

  // Difference in calendar days from saleDate to referenceDate.
  // Using Math.round eliminates any 23-hour or 25-hour daylight saving time (DST) shifts.
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.round((referenceMidnight.getTime() - saleMidnight.getTime()) / msPerDay);

  // If saleDate is in the future relative to the reference calendar date, do not show warranty
  if (daysElapsed < 0) {
    return null;
  }

  const daysLeft = Math.max(0, validWarrantyDays - daysElapsed);
  const isActive = daysElapsed < validWarrantyDays;
  const expiryFormatted = expiryDate.toLocaleDateString();

  const statusText = isActive
    ? `ACTIVE (${daysLeft} DAYS REMAINING)`
    : `EXPIRED (${expiryFormatted})`;

  return {
    isActive,
    daysLeft,
    expiryDate,
    expiryFormatted,
    statusText,
  };
}
