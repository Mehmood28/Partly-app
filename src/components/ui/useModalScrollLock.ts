import { useEffect } from 'react';

let activeLocks = 0;
let lockedScrollY = 0;
let previousStyles: {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
} | null = null;

export const useModalScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;

    if (activeLocks === 0) {
      lockedScrollY = window.scrollY;
      previousStyles = {
        htmlOverflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow,
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyWidth: document.body.style.width,
      };

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.width = '100%';
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks !== 0 || !previousStyles) return;

      document.documentElement.style.overflow = previousStyles.htmlOverflow;
      document.body.style.overflow = previousStyles.bodyOverflow;
      document.body.style.position = previousStyles.bodyPosition;
      document.body.style.top = previousStyles.bodyTop;
      document.body.style.width = previousStyles.bodyWidth;
      previousStyles = null;
      window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
    };
  }, [isLocked]);
};
