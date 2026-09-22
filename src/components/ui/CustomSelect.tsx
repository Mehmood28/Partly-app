import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

const MENU_CONTENT_HEIGHT_CAP = 240;
const MENU_CHROME_HEIGHT = 2;

export interface SelectOption {
  label: string;
  value: string;
  group?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  dropdownClassName?: string;
  fitLongestOption?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  icon,
  dropdownClassName = '',
  fitLongestOption = true,
}) => {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestedOpeningIndexRef = useRef<number | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  useLayoutEffect(() => {
    const measurePreferredWidth = () => {
      if (!fitLongestOption || !measureRef.current) {
        setPreferredWidth(null);
        return;
      }
      const labels = Array.from(measureRef.current.children) as HTMLElement[];
      const widestLabel = labels.reduce((width, label) => Math.max(width, label.scrollWidth), 0);
      const chromeWidth = icon ? 68 : 46;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportLimit = Math.max(112, viewportWidth - 32);
      setPreferredWidth(Math.min(viewportLimit, Math.ceil(widestLabel + chromeWidth)));
    };
    measurePreferredWidth();
    window.addEventListener('resize', measurePreferredWidth);
    window.visualViewport?.addEventListener('resize', measurePreferredWidth);
    return () => {
      window.removeEventListener('resize', measurePreferredWidth);
      window.visualViewport?.removeEventListener('resize', measurePreferredWidth);
    };
  }, [fitLongestOption, icon, options, placeholder]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setMenuPosition(null);
      return;
    }
    const positionMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const viewportPadding = 8;
      const menuGap = 6;
      const width = Math.min(viewportWidth - viewportPadding * 2, Math.max(rect.width, preferredWidth || 0));
      const left = Math.min(Math.max(viewportLeft + viewportPadding, rect.left), viewportRight - width - viewportPadding);
      const groupCount = new Set(options.map((option) => option.group).filter(Boolean)).size;
      const estimatedContentHeight = Math.min(MENU_CONTENT_HEIGHT_CAP, options.length * 34 + groupCount * 27 + 8);
      const estimatedHeight = estimatedContentHeight + MENU_CHROME_HEIGHT;
      const roomBelow = Math.max(0, viewportBottom - rect.bottom - menuGap - viewportPadding);
      const roomAbove = Math.max(0, rect.top - viewportTop - menuGap - viewportPadding);
      if (roomBelow >= estimatedHeight || roomBelow >= roomAbove) {
        setMenuPosition({
          left,
          top: rect.bottom + menuGap,
          width,
          maxHeight: Math.min(roomBelow, MENU_CONTENT_HEIGHT_CAP + MENU_CHROME_HEIGHT),
        });
      } else {
        setMenuPosition({
          left,
          bottom: window.innerHeight - rect.top + menuGap,
          width,
          maxHeight: Math.min(roomAbove, MENU_CONTENT_HEIGHT_CAP + MENU_CHROME_HEIGHT),
        });
      }
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
    };
  }, [isOpen, options.length, preferredWidth]);

  useEffect(() => {
    if (!isOpen) return;
    const requestedOpeningIndex = requestedOpeningIndexRef.current;
    requestedOpeningIndexRef.current = null;
    if (requestedOpeningIndex !== null && requestedOpeningIndex >= 0 && requestedOpeningIndex < options.length) {
      setActiveIndex(requestedOpeningIndex);
      return;
    }
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(options.length ? (selectedIndex >= 0 ? selectedIndex : 0) : -1);
  }, [isOpen, options, value]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  const chooseOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      if (!isOpen) {
        const selectedIndex = options.findIndex((option) => option.value === value);
        const requestedOpeningIndex = selectedIndex >= 0
          ? selectedIndex
          : event.key === 'ArrowDown'
            ? 0
            : options.length - 1;
        requestedOpeningIndexRef.current = requestedOpeningIndex;
        setActiveIndex(requestedOpeningIndex);
        setIsOpen(true);
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const base = current < 0 ? 0 : current;
        return (base + direction + options.length) % options.length;
      });
      return;
    }
    if ((event.key === 'Home' || event.key === 'End') && isOpen) {
      event.preventDefault();
      if (options.length) setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      chooseOption(activeIndex);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (event.key === 'Tab' && isOpen) {
      setIsOpen(false);
    }
  };

  const renderOptions = () => {
    const grouped = options.reduce((acc, opt, index) => {
      const group = opt.group || 'none';
      if (!acc[group]) acc[group] = [];
      acc[group].push({ option: opt, index });
      return acc;
    }, {} as Record<string, { option: SelectOption; index: number }[]>);

    return Object.entries(grouped).map(([group, opts]) => (
      <div key={group} role="group" aria-label={group !== 'none' ? group : undefined}>
        {group !== 'none' && (
          <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#162023] sticky top-0 border-b border-white/[0.04]">
            {group}
          </div>
        )}
        <div className="p-1 space-y-0.5">
          {opts.map(({ option: opt, index: optionIndex }) => {
            const isSelected = opt.value === value;
            const isActive = optionIndex === activeIndex;
            return (
              <div
                key={`${opt.value}-${optionIndex}`}
                id={`${listboxId}-option-${optionIndex}`}
                data-option-index={optionIndex}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(optionIndex)}
                className={`w-full cursor-pointer rounded-md border border-transparent px-2.5 py-1.5 text-left text-[11px] transition-colors flex items-center justify-between font-sans ${
                  isSelected
                    ? 'custom-select-option-selected font-semibold'
                    : isActive
                      ? 'bg-white/[0.06] text-white'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words pr-2">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#B9EF68] shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div
      className="relative w-full min-w-0 max-w-full"
      ref={containerRef}
    >
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 invisible whitespace-nowrap text-xs font-medium [&>span]:inline-block">
        <span>{placeholder}</span>
        {options.map((option) => <span key={`${option.value}-${option.label}`}>{option.label}</span>)}
      </div>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-disabled={!options.length}
        aria-label={selectedOption ? selectedOption.label : placeholder}
        onClick={() => {
          if (options.length) {
            requestedOpeningIndexRef.current = null;
            setIsOpen(!isOpen);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`app-field custom-select-trigger flex h-10 min-h-10 w-full cursor-pointer items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
          isOpen
            ? 'border-[#B9EF68]/65 ring-1 ring-[#B9EF68]/20'
            : ''
        } ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-[#B9EF68]' : ''}`}
        />
      </button>

      {isOpen && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          style={menuPosition}
          className={`fixed z-[500] overflow-hidden rounded-lg border border-white/[0.12] bg-[#0b1113]/98 shadow-2xl shadow-black/80 backdrop-blur-xl ${dropdownClassName}`}
        >
          <div
            className="overflow-y-auto hide-scrollbar"
            style={{ maxHeight: Math.max(0, menuPosition.maxHeight - MENU_CHROME_HEIGHT) }}
          >
            {renderOptions()}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
