import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ isOpen, onClose, children, className = '' }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const isHiddenByParent = containerRef.current && containerRef.current.parentElement?.closest('.hidden') !== null;
    if (isOpen && !isHiddenByParent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isHiddenByParent = Boolean(containerRef.current?.parentElement?.closest('.hidden'));
  const modal = (
    <AnimatePresence>
      {isOpen && !isHiddenByParent && (
        <div 
          data-bottom-sheet-modal="true" role="dialog" aria-modal="true"
          className="pointer-events-none fixed inset-0 z-[300] flex items-end justify-center pb-[max(4.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-5"
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
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`pointer-events-auto relative flex max-h-[calc(100dvh-5rem)] w-full flex-col overflow-y-auto rounded-t-[20px] border border-white/[0.12] bg-[#0b1113]/98 p-3.5 shadow-[0_28px_80px_rgba(0,0,0,0.82)] backdrop-blur-xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl sm:p-5 ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return <><span ref={containerRef} hidden aria-hidden="true" />{typeof document !== 'undefined' ? createPortal(modal, document.body) : null}</>;
};
