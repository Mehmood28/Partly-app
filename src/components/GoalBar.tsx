import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatCurrency, calculateMonthlyMetrics } from '../utils/helpers';
import { Target, Edit2, Check, Clock, CheckCircle2 } from 'lucide-react';

/**
 * Parses raw user input for Monthly Profit Goal strictly.
 * Allows leading '$', commas, and surrounding whitespace.
 * Preserves decimals without truncation.
 * Rejects empty, 0, negative, NaN, Infinity, letters, and malformed strings.
 */
export const parseGoalInput = (input: string): number | null => {
  let cleaned = input.trim();
  if (cleaned.startsWith('$')) {
    cleaned = cleaned.slice(1).trim();
  }
  cleaned = cleaned.replace(/,/g, '');

  if (!cleaned || /[a-zA-Z]/.test(cleaned)) {
    return null;
  }

  const val = Number(cleaned);
  if (!Number.isNaN(val) && Number.isFinite(val) && val > 0) {
    return val;
  }

  return null;
};

export const GoalBar: React.FC = () => {
  const { state, updateMonthlyGoal } = useInventory();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Read strictly from state.monthlyGoal with 10000 in-memory defensive fallback
  const monthlyGoal =
    typeof state.monthlyGoal === 'number' &&
    Number.isFinite(state.monthlyGoal) &&
    !Number.isNaN(state.monthlyGoal) &&
    state.monthlyGoal > 0
      ? state.monthlyGoal
      : 10000;
  
  const now = new Date();
  const { profit: currentMonthProfit } = calculateMonthlyMetrics(state, now.getFullYear(), now.getMonth());

  const percentage = Math.max(0, Math.min(100, Math.round((currentMonthProfit / monthlyGoal) * 100)));

  // Calculate days remaining in the current month
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(0, lastDayOfMonth - currentDay);
  
  // Calculate remaining profit needed to complete the goal
  const amountLeft = Math.max(0, monthlyGoal - currentMonthProfit);
  const isCompleted = currentMonthProfit >= monthlyGoal;

  const handleSave = () => {
    const val = parseGoalInput(editValue);
    if (val !== null) {
      updateMonthlyGoal(val);
    }
    setIsEditing(false);
  };

  return (
    <section className="app-panel overflow-hidden border-l-2 border-l-[#A8FF3E] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#A8FF3E]/25 bg-[#A8FF3E]/[0.08] text-[#A8FF3E]">
            <Target className="h-4 w-4" />
          </span>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-zinc-100 sm:text-sm">Monthly Profit Goal</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-400 sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#A8FF3E]" />
            {daysRemaining === 0 ? 'Last day' : `${daysRemaining}d left`}
          </span>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Goal reached</span>
          ) : (
            <span><strong className="text-[#62E6E6]">{formatCurrency(amountLeft)}</strong> left</span>
          )}
          <span className="border-l border-white/[0.12] pl-3 font-bold text-emerald-400">{percentage}%</span>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">Goal $</span>
            <input 
              type="number" 
              inputMode="decimal"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="app-field h-10 min-h-10 w-28 px-2 font-mono text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button 
              onClick={handleSave} 
              className="app-button flex h-10 min-h-10 items-center justify-center px-3 text-[#A8FF3E]"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div 
            className="group flex min-w-0 cursor-pointer items-baseline gap-2"
            onClick={() => { setEditValue(String(monthlyGoal)); setIsEditing(true); }}
            title="Click to change target profit goal"
          >
            <span className="font-mono text-xl font-bold tracking-[-0.04em] text-zinc-100 sm:text-2xl">
              {formatCurrency(currentMonthProfit)}
            </span>
            <span className="font-mono text-xs text-zinc-500 sm:text-sm">
              / {formatCurrency(monthlyGoal)}
            </span>
            <Edit2 className="ml-0.5 h-3.5 w-3.5 self-center text-zinc-500 transition-colors group-hover:text-[#A8FF3E]" />
          </div>
        )}

        <div className="shrink-0 pb-0.5 font-mono text-[10px] text-zinc-500 sm:text-xs">
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/45">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-[#A8FF3E] via-[#7CF27E] to-[#62E6E6] shadow-[0_0_15px_rgba(98,230,230,0.28)] transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
};
