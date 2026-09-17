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
    'min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] text-zinc-300 text-[10px] sm:text-xs font-semibold transition-colors hover:border-[#67E8F9]/40 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] touch-manipulation';

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
              ? 'text-white active:scale-[0.98]'
              : 'bg-white/[0.02] text-zinc-600 border-white/[0.04] cursor-not-allowed opacity-45'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Undo</span>
          {undoCount > 0 && <span className="font-mono text-[9px] text-[#CFFAFE]">{undoCount}</span>}
        </button>

        <button
          type="button"
          onClick={redo}
          disabled={redoCount === 0}
          aria-label={redoCount > 0 ? `Redo ${getItemLabel(redoHistory[0]) || 'action'}` : 'Redo unavailable'}
          className={`${sharedButtonClasses} ${
            redoCount > 0
              ? 'text-white active:scale-[0.98]'
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
              ? 'bg-[#A3FF12]/12 text-white border-[#A3FF12]/45'
              : ''
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0 text-[#A3FF12]" />
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
