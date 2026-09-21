import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  useLayoutEffect(() => {
    if (!fitLongestOption || !measureRef.current) {
      setPreferredWidth(null);
      return;
    }
    const labels = Array.from(measureRef.current.children) as HTMLElement[];
    const widestLabel = labels.reduce((width, label) => Math.max(width, label.scrollWidth), 0);
    const chromeWidth = icon ? 68 : 46;
    const viewportLimit = Math.max(112, window.innerWidth - 32);
    setPreferredWidth(Math.min(viewportLimit, Math.ceil(widestLabel + chromeWidth)));
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
      const width = Math.min(window.innerWidth - 16, Math.max(rect.width, preferredWidth || 0));
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const estimatedHeight = Math.min(240, options.length * 34 + 12);
      const roomBelow = window.innerHeight - rect.bottom - 8;
      if (roomBelow >= estimatedHeight || roomBelow >= rect.top) {
        setMenuPosition({ left, top: rect.bottom + 6, width });
      } else {
        setMenuPosition({ left, bottom: window.innerHeight - rect.top + 6, width });
      }
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [isOpen, options.length, preferredWidth]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, options, value]);

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
      if (!isOpen) {
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
    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      chooseOption(activeIndex);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const renderOptions = () => {
    const grouped = options.reduce((acc, opt) => {
      const group = opt.group || 'none';
      if (!acc[group]) acc[group] = [];
      acc[group].push(opt);
      return acc;
    }, {} as Record<string, SelectOption[]>);

    return Object.entries(grouped).map(([group, opts]) => (
      <div key={group} role="group" aria-label={group !== 'none' ? group : undefined}>
        {group !== 'none' && (
          <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#162023] sticky top-0 border-b border-white/[0.04]">
            {group}
          </div>
        )}
        <div className="p-1 space-y-0.5">
          {opts.map((opt) => {
            const isSelected = opt.value === value;
            const optionIndex = options.findIndex((option) => option.value === opt.value);
            const isActive = optionIndex === activeIndex;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(optionIndex)}
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
              </button>
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selectedOption ? selectedOption.label : placeholder}
        onClick={() => setIsOpen(!isOpen)}
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
          role="listbox"
          style={menuPosition}
          className={`fixed z-[500] overflow-hidden rounded-lg border border-white/[0.12] bg-[#0b1113]/98 shadow-2xl shadow-black/80 backdrop-blur-xl ${dropdownClassName}`}
        >
          <div className="max-h-60 overflow-y-auto hide-scrollbar">
            {renderOptions()}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
