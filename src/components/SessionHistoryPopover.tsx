import React, { useState } from 'react';
import { RotateCcw, RotateCw, History } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';

export interface SessionHistoryPopoverProps {
  id?: string;
  className?: string;
}

export const SessionHistoryPopover: React.FC<SessionHistoryPopoverProps> = ({ id, className }) => {
  const { undoHistory, redoHistory, undoCount, redoCount, undo, redo } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const [activeTab, setActiveTab] = useState<'undo' | 'redo'>(() => {
    if (undoCount > 0) return 'undo';
    if (redoCount > 0) return 'redo';
    return 'undo';
  });

  const getItemLabel = (item?: { label: string; privacySafeLabel?: string }): string => {
    if (!item) return '';
    if (hideSupplierNames && item.privacySafeLabel) {
      return item.privacySafeLabel;
    }
    return item.label;
  };

  const formatTimestamp = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const currentList = activeTab === 'undo' ? undoHistory : redoHistory;

  return (
    <div
      id={id}
      role="region"
      aria-label="Session History"
      className={`bg-[#0D1118] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden text-zinc-100 ${className || ''}`}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0D1118] shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#7C6CF2] shrink-0" />
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-none font-display">
              Session History
            </h2>
            <span className="text-[10px] sm:text-[11px] text-zinc-400">
              This session only
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Undo / Redo Control */}
      <div className="px-3.5 pt-2.5 pb-1.5 shrink-0">
        <div className="grid grid-cols-2 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('undo')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'undo'
                ? 'bg-[#7C6CF2]/20 text-white border border-[#7C6CF2]/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            } ${undoCount === 0 ? 'opacity-60' : ''}`}
          >
            <span>Undo</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded leading-none ${
                activeTab === 'undo' ? 'bg-[#7C6CF2]/30 text-[#C4BCFC] font-semibold' : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {undoCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('redo')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'redo'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            } ${redoCount === 0 ? 'opacity-60' : ''}`}
          >
            <span>Redo</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded leading-none ${
                activeTab === 'redo' ? 'bg-white/[0.12] text-zinc-200 font-semibold' : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {redoCount}
            </span>
          </button>
        </div>
      </div>

      {/* History List for selected tab */}
      <div className="px-3.5 py-2 overflow-y-auto max-h-60 sm:max-h-72 min-h-0 space-y-1.5 flex-1 overscroll-contain">
        {currentList.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500 italic">
            {activeTab === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentList.map((item, idx) => (
              <div
                key={`${activeTab}-${idx}-${item.timestamp}`}
                className={`p-2.5 rounded-xl border text-xs transition-colors ${
                  idx === 0
                    ? activeTab === 'undo'
                      ? 'bg-[#7C6CF2]/10 border-[#7C6CF2]/25 text-white'
                      : 'bg-white/[0.06] border-white/[0.12] text-white'
                    : 'bg-white/[0.02] border-white/[0.04] text-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {idx === 0 && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 leading-none mt-0.5 ${
                        activeTab === 'undo'
                          ? 'bg-[#7C6CF2]/30 text-[#C4BCFC]'
                          : 'bg-white/[0.12] text-zinc-200'
                      }`}
                    >
                      Next
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs leading-snug line-clamp-2 break-words">
                      {getItemLabel(item)}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      {formatTimestamp(item.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact One-Line Footer: Redo on Left, Undo on Right */}
      <div className="p-2.5 sm:p-3 border-t border-white/[0.08] bg-[#0D1118] flex items-center gap-2 shrink-0">
        {/* Redo Button (Left) */}
        <button
          type="button"
          onClick={redo}
          disabled={redoCount === 0}
          aria-label={
            redoCount > 0
              ? `Redo ${getItemLabel(redoHistory[0]) || 'action'}`
              : 'Redo unavailable'
          }
          className={`flex-1 flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-semibold transition-all min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
            redoCount > 0
              ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 hover:text-white border-white/[0.1] cursor-pointer active:scale-[0.98]'
              : 'bg-white/[0.02] text-zinc-600 border-white/[0.04] cursor-not-allowed opacity-40'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
          <span>Redo</span>
        </button>

        {/* Undo Button (Right) */}
        <button
          type="button"
          onClick={undo}
          disabled={undoCount === 0}
          aria-label={
            undoCount > 0
              ? `Undo ${getItemLabel(undoHistory[0]) || 'action'}`
              : 'Undo unavailable'
          }
          className={`flex-1 flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-semibold transition-all min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
            undoCount > 0
              ? 'bg-[#7C6CF2]/20 hover:bg-[#7C6CF2]/30 text-white border-[#7C6CF2]/40 cursor-pointer active:scale-[0.98]'
              : 'bg-white/[0.02] text-zinc-600 border-white/[0.04] cursor-not-allowed opacity-40'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-[#C4BCFC]" />
          <span>Undo</span>
        </button>
      </div>
    </div>
  );
};
