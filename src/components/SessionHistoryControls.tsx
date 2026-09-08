import React from 'react';
import { History, RotateCcw, RotateCw } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePrivacy } from '../context/PrivacyContext';
import { SessionHistoryPopover } from './SessionHistoryPopover';

interface SessionHistoryControlsProps {
  isSessionHistoryOpen: boolean;
  onToggleSessionHistory: () => void;
  placement: 'mobile' | 'desktop';
}

export const SessionHistoryControls: React.FC<SessionHistoryControlsProps> = ({
  isSessionHistoryOpen,
  onToggleSessionHistory,
  placement,
}) => {
  const { undoHistory, redoHistory, undoCount, redoCount, undo, redo } = useInventory();
  const { hideSupplierNames } = usePrivacy();
  const popoverId = `session-history-popover-${placement}`;

  const getItemLabel = (item?: { label: string; privacySafeLabel?: string }): string => {
    if (!item) return '';
    if (hideSupplierNames && item.privacySafeLabel) {
      return item.privacySafeLabel;
    }
    return item.label;
  };

  const sharedButtonClasses =
    'min-h-[36px] flex items-center justify-center gap-1.5 rounded-xl border text-[10px] sm:text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] touch-manipulation';

  return (
    <div className="relative w-full">
      <div className={`grid gap-1.5 ${placement === 'mobile' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <button
          type="button"
          onClick={undo}
          disabled={undoCount === 0}
          aria-label={undoCount > 0 ? `Undo ${getItemLabel(undoHistory[0]) || 'action'}` : 'Undo unavailable'}
          className={`${sharedButtonClasses} ${
            undoCount > 0
              ? 'bg-[#7C6CF2]/15 hover:bg-[#7C6CF2]/25 text-white border-[#7C6CF2]/30 active:scale-[0.98]'
              : 'bg-white/[0.02] text-zinc-600 border-white/[0.04] cursor-not-allowed opacity-45'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Undo</span>
          {undoCount > 0 && <span className="font-mono text-[9px] text-[#C4BCFC]">{undoCount}</span>}
        </button>

        <button
          type="button"
          onClick={redo}
          disabled={redoCount === 0}
          aria-label={redoCount > 0 ? `Redo ${getItemLabel(redoHistory[0]) || 'action'}` : 'Redo unavailable'}
          className={`${sharedButtonClasses} ${
            redoCount > 0
              ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 hover:text-white border-white/[0.1] active:scale-[0.98]'
              : 'bg-white/[0.02] text-zinc-600 border-white/[0.04] cursor-not-allowed opacity-45'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          <span>Redo</span>
          {redoCount > 0 && <span className="font-mono text-[9px] text-zinc-400">{redoCount}</span>}
        </button>

        <button
          type="button"
          onClick={onToggleSessionHistory}
          aria-expanded={isSessionHistoryOpen}
          aria-controls={popoverId}
          aria-label={`History log with ${undoCount} undo and ${redoCount} redo actions`}
          className={`${sharedButtonClasses} cursor-pointer ${placement === 'desktop' ? 'col-span-2' : ''} ${
            isSessionHistoryOpen
              ? 'bg-[#7C6CF2]/20 text-white border-[#7C6CF2]/40'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/[0.06]'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0 text-[#7C6CF2]" />
          <span>History Log</span>
        </button>
      </div>

      {isSessionHistoryOpen && (
        <div
          className={
            placement === 'mobile'
              ? 'absolute right-0 top-full mt-2 w-full z-[300]'
              : 'absolute left-[calc(100%+1.5rem)] bottom-0 w-80 sm:w-96 max-w-[calc(100vw-18rem)] z-[300]'
          }
        >
          <SessionHistoryPopover
            id={popoverId}
            className={
              placement === 'mobile'
                ? 'max-h-[calc(100dvh-150px)]'
                : 'max-h-[min(520px,calc(100dvh-5rem))]'
            }
          />
        </div>
      )}
    </div>
  );
};
