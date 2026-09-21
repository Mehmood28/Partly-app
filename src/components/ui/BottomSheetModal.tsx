import React, { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useModalScrollLock } from './useModalScrollLock';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ isOpen, onClose, children, className = '' }) => {
  useModalScrollLock(isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const target = dialog?.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      (target || dialog)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

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
            className={`pointer-events-auto relative flex max-h-[calc(100dvh-5.5rem)] w-full flex-col overflow-y-auto rounded-[14px] border border-white/[0.12] bg-[#0b1113]/98 p-3.5 shadow-[0_28px_80px_rgba(0,0,0,0.82)] backdrop-blur-xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl sm:p-5 ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};
