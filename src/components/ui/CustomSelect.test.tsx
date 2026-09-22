// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomSelect, SelectOption } from './CustomSelect';

const options: SelectOption[] = [
  { value: 'a', label: 'Alpha', group: 'First' },
  { value: 'b', label: 'Beta', group: 'First' },
  { value: 'c', label: 'Gamma', group: 'Second' },
];

describe('CustomSelect keyboard opening and menu height', () => {
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
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderSelect = (value = '') => {
    act(() => root.render(<CustomSelect options={options} value={value} onChange={() => undefined} />));
    return container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  };

  it('keeps the last option active when ArrowUp opens an unselected select', () => {
    const trigger = renderSelect();
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })));
    expect(trigger.getAttribute('aria-activedescendant')).toMatch(/-option-2$/);
  });

  it('opens on the selected option when a value exists', () => {
    const trigger = renderSelect('b');
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })));
    expect(trigger.getAttribute('aria-activedescendant')).toMatch(/-option-1$/);
  });

  it('caps content at 240px and reserves the two-pixel menu border budget', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const longOptions = Array.from({ length: 20 }, (_, index) => ({ value: String(index), label: `Option ${index}` }));
    act(() => root.render(<CustomSelect options={longOptions} value="" onChange={() => undefined} />));
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 210,
      top: 100,
      bottom: 140,
      width: 200,
      height: 40,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });

    act(() => trigger.click());
    const listbox = document.body.querySelector<HTMLElement>('[role="listbox"]')!;
    const scroller = listbox.firstElementChild as HTMLElement;
    expect(listbox.style.maxHeight).toBe('242px');
    expect(scroller.style.maxHeight).toBe('240px');
  });

  it('uses the same border-aware budget in a short viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 120 });
    const longOptions = Array.from({ length: 20 }, (_, index) => ({ value: String(index), label: `Option ${index}` }));
    act(() => root.render(<CustomSelect options={longOptions} value="" onChange={() => undefined} />));
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 210,
      top: 30,
      bottom: 70,
      width: 200,
      height: 40,
      x: 10,
      y: 30,
      toJSON: () => ({}),
    });

    act(() => trigger.click());
    const listbox = document.body.querySelector<HTMLElement>('[role="listbox"]')!;
    const scroller = listbox.firstElementChild as HTMLElement;
    expect(listbox.style.maxHeight).toBe('36px');
    expect(scroller.style.maxHeight).toBe('34px');
    expect(scroller.querySelector('[data-option-index="19"]')).not.toBeNull();
  });
});
