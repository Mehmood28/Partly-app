import { RefObject, useEffect, useRef } from 'react';

interface DialogStackEntry {
  id: symbol;
  priority: number;
}

const dialogStack: DialogStackEntry[] = [];

const isTopmostDialog = (id: symbol) => {
  const topmost = dialogStack.reduce<DialogStackEntry | undefined>((current, candidate) => {
    if (!current || candidate.priority >= current.priority) return candidate;
    return current;
  }, undefined);
  return topmost?.id === id;
};

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

const isAvailableFocusTarget = (element: HTMLElement) => {
  if (element.matches('[disabled], [aria-disabled="true"], [hidden], [inert]')) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (element.tabIndex < 0) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.visibility !== 'collapse'
    && element.getClientRects().length > 0;
};

const getFocusTargets = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(isAvailableFocusTarget);

interface UseDialogBehaviorOptions {
  isOpen: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  consumeEscape?: boolean;
  initialFocusSelector?: string;
  priority?: number;
}

export const useDialogBehavior = ({
  isOpen,
  dialogRef,
  onEscape,
  consumeEscape = false,
  initialFocusSelector,
  priority = 0,
}: UseDialogBehaviorOptions) => {
  const dialogIdRef = useRef(Symbol('dialog'));
  const openerRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const consumeEscapeRef = useRef(consumeEscape);
  onEscapeRef.current = onEscape;
  consumeEscapeRef.current = consumeEscape;

  useEffect(() => {
    if (!isOpen) return;

    const dialogId = dialogIdRef.current;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogStack.push({ id: dialogId, priority });

    const frame = requestAnimationFrame(() => {
      if (!isTopmostDialog(dialogId)) return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const requestedTarget = initialFocusSelector
        ? dialog.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const target = requestedTarget && isAvailableFocusTarget(requestedTarget)
        ? requestedTarget
        : getFocusTargets(dialog)[0];
      (target || dialog).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog(dialogId)) return;

      if (event.key === 'Escape') {
        if (!consumeEscapeRef.current && !onEscapeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (!consumeEscapeRef.current) onEscapeRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusTargets = getFocusTargets(dialog);
      if (!focusTargets.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusTargets[0];
      const last = focusTargets[focusTargets.length - 1];
      const activeElement = document.activeElement;
      if (!dialog.contains(activeElement) || activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);

      const stackIndex = dialogStack.findIndex((entry) => entry.id === dialogId);
      const wasTopmost = isTopmostDialog(dialogId);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);

      const opener = openerRef.current;
      if (wasTopmost && opener?.isConnected && isAvailableFocusTarget(opener)) opener.focus();
    };
  }, [dialogRef, initialFocusSelector, isOpen, priority]);
};
