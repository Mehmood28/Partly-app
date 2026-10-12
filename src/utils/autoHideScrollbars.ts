/**
 * Automatically hides scrollbars throughout the application until active scrolling occurs.
 * Listens on the capture phase so any scrollable container (modals, inner views, lists)
 * is immediately detected.
 *
 * Behavior matches WindowScrollIndicator:
 * - Shows scrollbar at full visibility while actively scrolling
 * - Waits 800ms of idle time after scrolling ceases
 * - Smoothly fades away over 300ms with an ease-out animation
 */

interface ScrollFadeState {
  hideTimeoutId: number | null;
  fadeRafId: number | null;
}

let isInitialized = false;

export function initAutoHideScrollbars(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  const scrollStates = new WeakMap<HTMLElement, ScrollFadeState>();
  const IDLE_DELAY = 800; // ms before fade begins
  const FADE_DURATION = 300; // ms duration of fade away
  const INITIAL_ALPHA = 0.8; // matches bg-[#B9EF68]/80

  function startFadeOut(el: HTMLElement, state: ScrollFadeState) {
    const startTime = performance.now();

    function frame(now: number) {
      if (!el.isConnected) {
        state.fadeRafId = null;
        scrollStates.delete(el);
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / FADE_DURATION));

      // Ease-out deceleration curve: 1 - (1 - t)^2
      const ease = 1 - Math.pow(1 - progress, 2);
      const currentAlpha = INITIAL_ALPHA * (1 - ease);

      if (progress < 1) {
        el.style.setProperty(
          '--sb-thumb-color',
          `rgba(185, 239, 104, ${currentAlpha.toFixed(3)})`
        );
        state.fadeRafId = requestAnimationFrame(frame);
      } else {
        // Fade completed cleanly
        state.fadeRafId = null;
        el.style.removeProperty('--sb-thumb-color');
        el.removeAttribute('data-scrolling');
        el.classList.remove('is-scrolling');
        scrollStates.delete(el);
      }
    }

    state.fadeRafId = requestAnimationFrame(frame);
  }

  window.addEventListener(
    'scroll',
    (event) => {
      const target = event.target;
      const el =
        target === document
          ? document.documentElement
          : target instanceof HTMLElement
          ? target
          : null;

      // The main window scroll is handled by WindowScrollIndicator
      if (
        !el ||
        el === document.documentElement ||
        el === document.body
      ) {
        return;
      }

      let state = scrollStates.get(el);
      if (!state) {
        state = { hideTimeoutId: null, fadeRafId: null };
        scrollStates.set(el, state);
      }

      // If currently fading out, cancel the fade and restore full visibility
      if (state.fadeRafId !== null) {
        cancelAnimationFrame(state.fadeRafId);
        state.fadeRafId = null;
      }

      // If an idle timer was already pending, reset it
      if (state.hideTimeoutId !== null) {
        window.clearTimeout(state.hideTimeoutId);
        state.hideTimeoutId = null;
      }

      // Show thumb at full active visibility
      el.style.setProperty(
        '--sb-thumb-color',
        `rgba(185, 239, 104, ${INITIAL_ALPHA})`
      );
      el.setAttribute('data-scrolling', 'true');
      el.classList.add('is-scrolling');

      // Schedule fade out after idle period
      state.hideTimeoutId = window.setTimeout(() => {
        state.hideTimeoutId = null;
        startFadeOut(el, state);
      }, IDLE_DELAY);
    },
    { capture: true, passive: true }
  );
}
