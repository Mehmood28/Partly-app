import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CustomScrollIndicatorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export const CustomScrollIndicator: React.FC<CustomScrollIndicatorProps> = ({
  containerRef,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const [thumbStyle, setThumbStyle] = useState<{ height: number; top: number }>({
    height: 0,
    top: 0,
  });
  const hideTimerRef = useRef<number | null>(null);

  const updateThumb = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 4) {
      setVisible(false);
      return;
    }

    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(28, Math.round(clientHeight * ratio));
    const availableTrack = clientHeight - thumbHeight;
    const top = Math.round((scrollTop / maxScroll) * availableTrack);

    setThumbStyle({ height: thumbHeight, top });
    setVisible(true);

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 800);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      updateThumb();
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [containerRef, updateThumb]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute right-0.5 top-1 bottom-1 w-1.5 z-20 transition-opacity duration-300 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      <div
        className="w-1 bg-[#B9EF68]/80 rounded-full shadow-[0_0_6px_rgba(185,239,104,0.3)]"
        style={{
          height: `${thumbStyle.height}px`,
          transform: `translateY(${thumbStyle.top}px)`,
        }}
      />
    </div>
  );
};
