import React, { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ isOpen, onClose, children, className = '' }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isHiddenByParent = containerRef.current && containerRef.current.closest('.hidden') !== null;
    if (isOpen && !isHiddenByParent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          ref={containerRef}
          data-bottom-sheet-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6 pb-[85px] md:pb-6 md:pl-68 pointer-events-none" 
          style={{ height: '100dvh', width: '100vw' }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`bg-[#0D1118] backdrop-blur-xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl w-full p-4 sm:p-6 relative max-h-[calc(100dvh-7rem)] md:max-h-[calc(100dvh-3rem)] overflow-y-auto pointer-events-auto flex flex-col ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
