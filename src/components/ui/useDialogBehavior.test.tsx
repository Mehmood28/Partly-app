// @vitest-environment jsdom

import React, { act, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialogBehavior } from './useDialogBehavior';

const DialogHarness: React.FC<{ busy: boolean }> = ({ busy }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({
    isOpen: true,
    dialogRef,
    consumeEscape: busy,
  });

  return (
    <div ref={dialogRef} role="dialog" tabIndex={-1}>
      <button type="button" disabled={busy}>First</button>
      <button type="button" disabled={busy}>Last</button>
    </div>
  );
};

describe('useDialogBehavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('moves focus from the panel to the first or last control after busy controls re-enable', () => {
    act(() => root.render(<DialogHarness busy />));
    const panel = container.querySelector<HTMLElement>('[role="dialog"]')!;
    panel.focus();

    act(() => root.render(<DialogHarness busy={false} />));
    const [first, last] = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));

    act(() => panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);

    panel.focus();
    act(() => panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);
  });
});
