import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useModalScrollLock } from './ui/useModalScrollLock';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'emerald' | 'amber' | 'violet';
  isBusy?: boolean;
  busyText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isBusy = false,
  busyText = 'Working...',
}) => {
  useModalScrollLock(isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const isBusyRef = useRef(isBusy);
  onCancelRef.current = onCancel;
  isBusyRef.current = isBusy;

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[data-confirm-initial]')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusyRef.current) {
        event.preventDefault();
        onCancelRef.current();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

  const renderIcon = () => {
    if (variant === 'emerald') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <RotateCcw className="w-4 h-4 text-emerald-400" />
        </div>
      );
    }
    if (variant === 'amber' || variant === 'violet') {
      return (
        <div className="w-8 h-8 rounded-xl bg-[#B9EF68]/15 border border-[#B9EF68]/30 flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4 text-[#B9EF68]" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
      </div>
    );
  };

  const getConfirmButtonClasses = () => {
    if (variant === 'emerald') {
      return 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';
    }
    if (variant === 'amber' || variant === 'violet') {
      return 'bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-[#B9EF68]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]';
    }
    return 'bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500';
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div 
          data-confirm-modal="true" role="alertdialog" aria-modal="true" aria-label={title}
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 pb-[85px] md:pb-4 pointer-events-none" 
          style={{ height: '100dvh', width: '100vw' }}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isBusy ? undefined : onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 mx-auto flex w-full max-w-sm flex-col rounded-[10px] border border-white/[0.12] bg-[#0B1113] p-4 shadow-[0_18px_55px_rgba(0,0,0,.65)] pointer-events-auto sm:p-5"
          >
            <div className="flex items-center gap-2.5 shrink-0 mb-3">
              {renderIcon()}
              <div>
                <h3 className="text-sm font-bold text-zinc-100 font-display">{title}</h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">{message}</p>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                data-confirm-initial
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] disabled:cursor-wait disabled:opacity-60"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isBusy}
                aria-busy={isBusy}
                className={`${getConfirmButtonClasses()} disabled:cursor-wait disabled:opacity-70`}
              >
                <span className="flex items-center gap-1.5">
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {isBusy ? busyText : confirmText}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
