import { formatCurrency } from './helpers';

export const formatSignedCurrency = (amount: number): string => {
  const finiteAmount = Number.isFinite(amount) ? amount : 0;
  const safeAmount = Object.is(finiteAmount, -0) ? 0 : finiteAmount;
  return `${safeAmount > 0 ? '+' : ''}${formatCurrency(safeAmount)}`;
};

export const getProfitTextColor = (amount: number): string => {
  if (amount > 0) return 'text-emerald-400';
  if (amount < 0) return 'text-rose-400';
  return 'text-zinc-300';
};

export const getProfitBadgeClasses = (amount: number): string => {
  if (amount > 0) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  }
  if (amount < 0) {
    return 'bg-rose-500/15 text-rose-400 border-rose-500/40';
  }
  return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
};

export const getProfitSummaryClasses = (amount: number): string => {
  if (amount > 0) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (amount < 0) {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }
  return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
};
