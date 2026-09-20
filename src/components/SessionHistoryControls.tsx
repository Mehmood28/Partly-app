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
    'min-h-[44px] flex min-w-0 items-center justify-center gap-2 bg-transparent px-2 text-sm font-medium transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B9EF68] touch-manipulation';

  return (
    <div className="relative w-full">
      <div className="session-toolbar">
        <button
          type="button"
          onClick={undo}
          disabled={undoCount === 0}
          aria-label={undoCount > 0 ? `Undo ${getItemLabel(undoHistory[0]) || 'action'}` : 'Undo unavailable'}
          className={`${sharedButtonClasses} ${
            undoCount > 0
              ? 'text-zinc-100 active:scale-[0.98]'
              : 'cursor-not-allowed text-zinc-500 opacity-60'
          }`}
        >
          <RotateCcw className="w-5 h-5 shrink-0" />
          <span>Undo</span>
          {undoCount > 0 && <span className="font-mono text-[11px] text-[#9FF8F4]">{undoCount}</span>}
        </button>

        <button
          type="button"
          onClick={redo}
          disabled={redoCount === 0}
          aria-label={redoCount > 0 ? `Redo ${getItemLabel(redoHistory[0]) || 'action'}` : 'Redo unavailable'}
          className={`${sharedButtonClasses} ${
            redoCount > 0
              ? 'text-zinc-100 active:scale-[0.98]'
              : 'cursor-not-allowed text-zinc-500 opacity-60'
          }`}
        >
          <RotateCw className="w-5 h-5 shrink-0" />
          <span>Redo</span>
          {redoCount > 0 && <span className="font-mono text-[11px] text-zinc-400">{redoCount}</span>}
        </button>

        <button
          type="button"
          onClick={onToggleSessionHistory}
          aria-expanded={isSessionHistoryOpen}
          aria-controls={popoverId}
          aria-label={`History log with ${undoCount} undo and ${redoCount} redo actions`}
          className={`${sharedButtonClasses} cursor-pointer ${
            isSessionHistoryOpen
              ? 'bg-[#B9EF68]/10 text-white'
              : 'text-zinc-300'
          }`}
        >
          <History className="w-5 h-5 shrink-0 text-[#B9EF68]" />
          <span>History Log</span>
        </button>
      </div>

      {isSessionHistoryOpen && (
        <div
          className={
            placement === 'mobile'
              ? 'absolute right-0 top-full z-[300] mt-2 w-full sm:w-96'
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
