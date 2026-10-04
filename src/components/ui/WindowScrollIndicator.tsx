import React, { useEffect, useRef, useState, useCallback } from 'react';

export const WindowScrollIndicator: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [offsets, setOffsets] = useState<{ top: number; bottom: number }>({
    top: 76,
    bottom: 68,
  });
  const [thumbStyle, setThumbStyle] = useState<{ height: number; top: number }>({
    height: 0,
    top: 0,
  });
  const hideTimerRef = useRef<number | null>(null);

  const updateOffsets = useCallback(() => {
    const header = document.querySelector('.partly-header') as HTMLElement | null;
    const nav = document.querySelector('.partly-navigation') as HTMLElement | null;
    const top = header ? Math.round(header.getBoundingClientRect().bottom) + 2 : 76;
    const bottom = nav ? Math.round(window.innerHeight - nav.getBoundingClientRect().top) + 2 : 68;
    const newOffsets = { top: Math.max(0, top), bottom: Math.max(0, bottom) };
    setOffsets(newOffsets);
    return newOffsets;
  }, []);

  const updateThumb = useCallback(() => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 12) {
      setVisible(false);
      return;
    }

    const { top: topOffset, bottom: bottomOffset } = updateOffsets();
    const trackHeight = clientHeight - topOffset - bottomOffset;

    if (trackHeight <= 40) {
      setVisible(false);
      return;
    }

    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(28, Math.round(trackHeight * ratio));
    const availableTrack = Math.max(0, trackHeight - thumbHeight);
    const top = Math.round((scrollY / maxScroll) * availableTrack);

    setThumbStyle({ height: thumbHeight, top });
    setVisible(true);

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 800);
  }, [updateOffsets]);

  useEffect(() => {
    updateOffsets();

    const onScroll = () => {
      updateThumb();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [updateThumb, updateOffsets]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed right-0.5 w-1.5 z-30 transition-opacity duration-300 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        top: `${offsets.top}px`,
        bottom: `${offsets.bottom}px`,
      }}
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
