import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface ScrollVirtualizer {
  scrollToOffset: (offset: number) => void;
}

interface UseVirtualListScrollOptions {
  isActive?: boolean;
  isVirtualized: boolean;
  parentRef: React.RefObject<HTMLDivElement | null>;
  scrollOffsetRef: React.RefObject<number>;
  virtualizer: ScrollVirtualizer;
  resetDependencies: readonly unknown[];
}

export const useVirtualListScroll = ({
  isActive,
  isVirtualized,
  parentRef,
  scrollOffsetRef,
  virtualizer,
  resetDependencies,
}: UseVirtualListScrollOptions) => {
  const isFirstReset = useRef(true);

  useLayoutEffect(() => {
    if (isActive && isVirtualized && parentRef.current && scrollOffsetRef.current > 0) {
      const maxScroll = Math.max(0, parentRef.current.scrollHeight - parentRef.current.clientHeight);
      const targetOffset = Math.min(scrollOffsetRef.current, maxScroll);
      scrollOffsetRef.current = targetOffset;
      queueMicrotask(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = targetOffset;
          virtualizer.scrollToOffset(targetOffset);
        }
      });
    } else if (!isVirtualized) {
      scrollOffsetRef.current = 0;
    }
  }, [isActive, isVirtualized, virtualizer]);

  useEffect(() => {
    if (isFirstReset.current) {
      isFirstReset.current = false;
      return;
    }
    scrollOffsetRef.current = 0;
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
    if (isVirtualized) {
      virtualizer.scrollToOffset(0);
    }
  }, [...resetDependencies, isVirtualized, virtualizer]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (isActive) {
      scrollOffsetRef.current = event.currentTarget.scrollTop;
    }
  }, [isActive]);

  return handleScroll;
};
