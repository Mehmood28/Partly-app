import React, { useMemo } from 'react';
import { History } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { SessionHistoryItem } from '../context/types';

export interface SessionHistoryPopoverProps {
  id?: string;
  className?: string;
}

type HistoryLogItem = SessionHistoryItem & {
  direction: 'undo' | 'redo';
  isNext: boolean;
};

export const SessionHistoryPopover: React.FC<SessionHistoryPopoverProps> = ({ id, className }) => {
  const { undoHistory, redoHistory, undoCount, redoCount } = useInventory();
  const { hideSupplierNames } = usePrivacy();

  const historyItems = useMemo<HistoryLogItem[]>(
    () =>
      [
        ...undoHistory.map((item, index) => ({
          ...item,
          direction: 'undo' as const,
          isNext: index === 0,
        })),
        ...redoHistory.map((item, index) => ({
          ...item,
          direction: 'redo' as const,
          isNext: index === 0,
        })),
      ].sort((a, b) => b.timestamp - a.timestamp),
    [redoHistory, undoHistory]
  );

  const getItemLabel = (item?: SessionHistoryItem): string => {
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

  return (
    <div
      id={id}
      role="region"
      aria-label="Session History Log"
      className={`bg-[#0D1118] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden text-zinc-100 ${className || ''}`}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-white/[0.08] bg-[#0D1118] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[#A3FF12] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-none font-display">
              Session History Log
            </h2>
            <span className="text-[10px] sm:text-[11px] text-zinc-400">
              This session only
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9px] sm:text-[10px]">
          <span className="px-1.5 py-1 rounded-md bg-[#A3FF12]/15 border border-[#A3FF12]/25 text-[#CFFAFE]">
            {undoCount} undo
          </span>
          <span className="px-1.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-zinc-400">
            {redoCount} redo
          </span>
        </div>
      </div>

      <div className="px-3.5 py-2.5 overflow-y-auto max-h-72 sm:max-h-96 min-h-0 space-y-1.5 flex-1 overscroll-contain">
        {historyItems.length === 0 ? (
          <div className="py-7 text-center text-xs text-zinc-500 italic">
            No actions recorded in this session.
          </div>
        ) : (
          historyItems.map((item, index) => (
            <div
              key={`${item.direction}-${index}-${item.timestamp}`}
              className={`p-2.5 rounded-xl border text-xs transition-colors ${
                item.isNext && item.direction === 'undo'
                  ? 'bg-[#A3FF12]/10 border-[#A3FF12]/25 text-white'
                  : item.isNext
                  ? 'bg-white/[0.06] border-white/[0.12] text-white'
                  : 'bg-white/[0.02] border-white/[0.04] text-zinc-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`text-[9px] font-mono font-semibold px-1.5 py-1 rounded shrink-0 leading-none mt-0.5 ${
                    item.direction === 'undo'
                      ? 'bg-[#A3FF12]/20 text-[#CFFAFE]'
                      : 'bg-white/[0.08] text-zinc-300'
                  }`}
                >
                  {item.isNext ? `Next ${item.direction}` : item.direction}
                </span>
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
          ))
        )}
      </div>
    </div>
  );
};
