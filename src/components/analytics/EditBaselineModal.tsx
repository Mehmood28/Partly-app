import React, { useState, useEffect } from 'react';
import { Pencil, X } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { parseBaselineInputs } from '../../utils/baselineStats';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface EditBaselineModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonthIdx: number;
  selectedYear: number;
  initialRev: number;
  initialProf: number;
  initialPcs: number;
}

export const EditBaselineModal: React.FC<EditBaselineModalProps> = ({ isOpen, onClose, selectedMonthIdx, selectedYear, initialRev, initialProf, initialPcs }) => {
  const { updateMonthlyBaseline } = useInventory();
  const { showToast } = useToast();
  
  const [editRev, setEditRev] = useState('');
  const [editProf, setEditProf] = useState('');
  const [editPcs, setEditPcs] = useState('');

  const selectedMonthName = MONTH_NAMES[selectedMonthIdx];

  useEffect(() => {
    if (isOpen) {
      setEditRev(String(initialRev));
      setEditProf(String(initialProf));
      setEditPcs(String(initialPcs));
    }
  }, [isOpen, initialRev, initialProf, initialPcs]);

  

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseBaselineInputs(editRev, editProf, editPcs);
    if (!parsed.success) {
      showToast(parsed.error, 'error');
      return;
    }

    const result = updateMonthlyBaseline(selectedYear, selectedMonthIdx, parsed.values);
    if (!result.success) {
      showToast(result.error || 'Unable to save baseline stats.', 'error');
      return;
    }

    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-[#7C6CF2]" /> Edit Baseline: {selectedMonthName} {selectedYear}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/[0.04]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          Enter only figures not already recorded in Partly for {selectedMonthName} {selectedYear}. Live activity recorded in Partly will be added automatically.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-medium text-[11px]">PCs Sold</label>
            <input
              type="number" inputMode="numeric"
              min="0"
              step="1"
              required
              value={editPcs}
              onChange={(e) => setEditPcs(e.target.value)}
              className="w-full h-9 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors font-mono"
              placeholder="e.g. 2"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium text-[11px]">Total Revenue ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
              <input
              type="number" inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={editRev}
              onChange={(e) => setEditRev(e.target.value)}
              className="w-full h-9 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors pl-7 font-mono"
              placeholder="e.g. 2200"
            />
            </div>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium text-[11px]">Net Profit ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none font-mono">$</span>
              <input
              type="number" inputMode="decimal"
              step="0.01"
              required
              value={editProf}
              onChange={(e) => setEditProf(e.target.value)}
              className="w-full h-9 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors pl-7 font-mono"
              placeholder="e.g. 530"
            />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 bg-[#121722] hover:bg-white/[0.04] border border-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-[#7C6CF2] hover:bg-[#6855EE] text-white font-medium text-xs shadow-sm transition-colors"
            >
              Save Baseline Stats
            </button>
          </div>
        </form>
      </div>
    </BottomSheetModal>
  );
};
