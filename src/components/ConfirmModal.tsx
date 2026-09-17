import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const anchorRef = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const isHiddenByParent = Boolean(anchorRef.current?.parentElement?.closest('.hidden'));
    if (isOpen && !isHiddenByParent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
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
        <div className="w-8 h-8 rounded-xl bg-[#A3FF12]/15 border border-[#A3FF12]/30 flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4 text-[#A3FF12]" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-red-400" />
      </div>
    );
  };

  const getConfirmButtonClasses = () => {
    if (variant === 'emerald') {
      return 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';
    }
    if (variant === 'amber' || variant === 'violet') {
      return 'bg-[#A3FF12] hover:bg-[#C2FF5C] text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-[#A3FF12]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12]';
    }
    return 'bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500';
  };

  const isHiddenByParent = Boolean(anchorRef.current?.parentElement?.closest('.hidden'));
  const shouldRender = isOpen && !isHiddenByParent;

  const modalContent = (
    <AnimatePresence>
      {shouldRender && (
        <div 
          data-confirm-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 pb-[85px] md:pb-4 pointer-events-none" 
          style={{ height: '100dvh', width: '100vw' }}
        >
          <motion.div
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
            className="bg-[#0D1118] border border-white/[0.08] rounded-2xl w-full max-w-sm p-4 sm:p-5 relative flex flex-col shadow-2xl z-10 mx-auto pointer-events-auto"
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
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] disabled:cursor-wait disabled:opacity-60"
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

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  );
};
