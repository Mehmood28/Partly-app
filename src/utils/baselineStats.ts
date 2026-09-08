import { SheetStats } from '../types';

export const LEGACY_BASELINE_YEAR = 2026;

export const BASELINE_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export interface MonthlyBaselineValues {
  revenue: number;
  profit: number;
  pcsSold: number;
}

export type BaselineParseResult =
  | { success: true; values: MonthlyBaselineValues; error?: undefined }
  | { success: false; error: string; values?: undefined };

const STRICT_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

const parseStrictFiniteNumber = (input: unknown): number | null => {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? (Object.is(input, -0) ? 0 : input) : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || !STRICT_NUMBER.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
};

export const parseBaselineInputs = (
  revenueInput: unknown,
  profitInput: unknown,
  pcsSoldInput: unknown
): BaselineParseResult => {
  const revenue = parseStrictFiniteNumber(revenueInput);
  if (revenue === null || revenue < 0) {
    return { success: false, error: 'Revenue must be a finite non-negative number.' };
  }

  const profit = parseStrictFiniteNumber(profitInput);
  if (profit === null) {
    return { success: false, error: 'Profit must be a finite number.' };
  }
  if (profit > revenue) {
    return { success: false, error: 'Profit cannot be greater than revenue.' };
  }

  const pcsSold = parseStrictFiniteNumber(pcsSoldInput);
  if (pcsSold === null || pcsSold < 0 || !Number.isInteger(pcsSold)) {
    return { success: false, error: 'PCs sold must be a non-negative whole number.' };
  }

  return { success: true, values: { revenue, profit, pcsSold } };
};

interface ResolvedBaselinePeriod {
  year: number;
  monthIndex: number;
}

const resolveBaselinePeriod = (month: unknown, explicitYear?: unknown): ResolvedBaselinePeriod | null => {
  if (typeof month !== 'string') return null;
  const trimmed = month.trim();
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const monthIndex = Number(isoMatch[2]) - 1;
    return Number.isInteger(year) && year >= 2000 && year <= 9999 && monthIndex >= 0 && monthIndex <= 11
      ? { year, monthIndex }
      : null;
  }

  const monthIndex = BASELINE_MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === trimmed.toLowerCase()
  );
  if (monthIndex < 0) return null;

  const year = explicitYear === undefined ? LEGACY_BASELINE_YEAR : Number(explicitYear);
  return Number.isInteger(year) && year >= 2000 && year <= 9999 ? { year, monthIndex } : null;
};

export const normalizeSheetStats = (value: unknown): SheetStats => {
  const raw = value && typeof value === 'object' ? (value as Partial<SheetStats>) : {};
  const rows = Array.isArray(raw.monthly) ? raw.monthly : [];
  const byPeriod = new Map<string, SheetStats['monthly'][number]>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const period = resolveBaselinePeriod(row.month, row.year);
    const parsed = parseBaselineInputs(row.revenue, row.profit, row.pcsSold);
    if (!period || !parsed.success) continue;

    byPeriod.set(`${period.year}-${period.monthIndex}`, {
      year: period.year,
      month: BASELINE_MONTH_NAMES[period.monthIndex],
      ...parsed.values,
    });
  }

  const monthly = Array.from(byPeriod.values()).sort((a, b) => {
    const yearDiff = (a.year ?? LEGACY_BASELINE_YEAR) - (b.year ?? LEGACY_BASELINE_YEAR);
    if (yearDiff !== 0) return yearDiff;
    return BASELINE_MONTH_NAMES.indexOf(a.month as (typeof BASELINE_MONTH_NAMES)[number]) -
      BASELINE_MONTH_NAMES.indexOf(b.month as (typeof BASELINE_MONTH_NAMES)[number]);
  });

  return {
    monthly,
    yearly: {
      revenue: monthly.reduce((sum, row) => sum + row.revenue, 0),
      profit: monthly.reduce((sum, row) => sum + row.profit, 0),
      pcsSold: monthly.reduce((sum, row) => sum + row.pcsSold, 0),
    },
  };
};

export const getMonthlyBaseline = (
  stats: SheetStats | undefined,
  year: number,
  monthIndex: number
): MonthlyBaselineValues => {
  if (!stats || !Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return { revenue: 0, profit: 0, pcsSold: 0 };
  }

  const row = normalizeSheetStats(stats).monthly.find(
    (entry) => entry.year === year && entry.month === BASELINE_MONTH_NAMES[monthIndex]
  );
  return row
    ? { revenue: row.revenue, profit: row.profit, pcsSold: row.pcsSold }
    : { revenue: 0, profit: 0, pcsSold: 0 };
};

export const getBaselineYears = (stats: SheetStats | undefined): number[] => {
  if (!stats) return [];
  return Array.from(
    new Set(normalizeSheetStats(stats).monthly.map((entry) => entry.year).filter((year): year is number => year !== undefined))
  ).sort((a, b) => b - a);
};

export const upsertMonthlyBaseline = (
  stats: SheetStats | undefined,
  year: number,
  monthIndex: number,
  values: MonthlyBaselineValues
): SheetStats => {
  const normalized = normalizeSheetStats(stats);
  const monthly = normalized.monthly.filter(
    (entry) => !(entry.year === year && entry.month === BASELINE_MONTH_NAMES[monthIndex])
  );
  monthly.push({ year, month: BASELINE_MONTH_NAMES[monthIndex], ...values });
  return normalizeSheetStats({ monthly, yearly: normalized.yearly });
};
