import React, { ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useModalScrollLock } from './useModalScrollLock';
import { useDialogBehavior } from './useDialogBehavior';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  layout?: 'content' | 'workspace';
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ isOpen, onClose, children, className = '', layout = 'content' }) => {
  useModalScrollLock(isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({
    isOpen,
    dialogRef,
    onEscape: onClose,
    initialFocusSelector: '[data-autofocus]',
  });

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div 
          data-bottom-sheet-modal="true" role="dialog" aria-modal="true"
          className="pointer-events-none fixed inset-0 z-[300] flex items-end justify-center px-4 pb-[max(4.75rem,env(safe-area-inset-bottom))] pt-3 sm:items-center sm:p-5"
          style={{ height: '100dvh', width: '100vw' }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="pointer-events-auto absolute inset-0 bg-black/82 backdrop-blur-md"
          />
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            data-modal-layout={layout}
            className={`pointer-events-auto relative flex w-full flex-col rounded-[14px] border border-white/[0.12] bg-[#0b1113]/98 p-3.5 shadow-[0_28px_80px_rgba(0,0,0,0.82)] backdrop-blur-xl sm:rounded-2xl sm:p-5 ${layout === 'workspace' ? 'modal-layout-workspace' : 'modal-layout-content'} ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};
