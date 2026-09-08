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
    <div className="bg-[#0D1118] border border-white/[0.08] hover:border-[#7C6CF2]/40 transition-all duration-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#7C6CF2]/15 text-[#7C6CF2] border border-[#7C6CF2]/30">
            <Target className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
            Monthly Profit Goal
          </span>
        </div>

        {/* Status Pills: Days Left & Amount Left */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono font-medium text-zinc-300">
            <Clock className="w-3 h-3 text-[#7C6CF2]" />
            {daysRemaining === 0 ? 'Last day' : `${daysRemaining}d left`}
          </span>

          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-medium text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              Goal Reached!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono font-medium text-zinc-300">
              <span className="text-[#9D91FA] font-bold">{formatCurrency(amountLeft)}</span> left
            </span>
          )}

          <span className="text-xs font-bold text-emerald-400 font-mono pl-1">
            {percentage}%
          </span>
        </div>
      </div>
      
      {/* Target Amount Edit & Realized Row */}
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">Goal: $</span>
            <input 
              type="number" 
              inputMode="decimal"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="bg-[#090B10] border border-[#7C6CF2]/50 rounded-lg px-2 py-1 text-xs text-zinc-100 w-28 focus:outline-none focus:ring-1 focus:ring-[#7C6CF2] font-mono"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button 
              onClick={handleSave} 
              className="bg-[#7C6CF2]/20 text-[#7C6CF2] border border-[#7C6CF2]/40 hover:bg-[#7C6CF2]/30 px-2.5 py-1 rounded-lg text-xs font-medium"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div 
            className="flex items-baseline gap-1.5 group cursor-pointer" 
            onClick={() => { setEditValue(String(monthlyGoal)); setIsEditing(true); }}
            title="Click to change target profit goal"
          >
            <span className="text-sm sm:text-base font-bold text-zinc-100 font-mono">
              {formatCurrency(currentMonthProfit)}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              / {formatCurrency(monthlyGoal)}
            </span>
            <Edit2 className="w-3 h-3 text-zinc-400 group-hover:text-[#7C6CF2] transition-colors ml-0.5 self-center" />
          </div>
        )}

        <div className="text-[11px] text-zinc-400 font-mono">
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-[#090B10] border border-white/[0.06] rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[#7C6CF2] via-[#8D7FF5] to-emerald-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
