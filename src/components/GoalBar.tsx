import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatCurrency, calculateMonthlyMetrics } from '../utils/helpers';
import { Edit2, Check } from 'lucide-react';

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
    <section className="goal-section">
      <div className="section-heading"><h2>Monthly Profit Goal</h2><span>{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</span></div>
      {isEditing ? (
        <form className="goal-editor" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <label htmlFor="monthly-goal">Goal $</label><input id="monthly-goal" type="number" inputMode="decimal" className="app-field" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} />
          <button className="app-button app-button-primary" aria-label="Save monthly goal"><Check /></button>
        </form>
      ) : (
        <button className="goal-amount" onClick={() => { setEditValue(String(monthlyGoal)); setIsEditing(true); }} title="Change monthly profit goal">
          <strong>{formatCurrency(currentMonthProfit)}</strong><span>/ {formatCurrency(monthlyGoal)}</span><Edit2 />
        </button>
      )}
      <div className="goal-details"><span>{daysRemaining === 0 ? 'Last day' : `${daysRemaining}d left`}</span><span>{isCompleted ? 'Goal reached' : <><strong>{formatCurrency(amountLeft)}</strong> left</>}</span><strong>{percentage}%</strong></div>
      <div className="goal-track" role="progressbar" aria-label="Monthly profit goal" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><div style={{width: `${percentage}%`}} /></div>
    </section>
  );
};
