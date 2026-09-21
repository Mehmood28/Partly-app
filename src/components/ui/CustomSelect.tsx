import React, { useState, useRef, useEffect } from 'react';
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
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  icon,
  dropdownClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between font-sans ${
                  isSelected
                    ? 'border border-[#B9EF68]/30 bg-[#B9EF68]/10 font-semibold text-white'
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
    <div className="relative w-full min-w-full" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selectedOption ? selectedOption.label : placeholder}
        onClick={() => setIsOpen(!isOpen)}
        className={`app-field custom-select-trigger flex h-10 min-h-10 w-full cursor-pointer items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
          isOpen
            ? 'border-[#B9EF68]/65 ring-1 ring-[#B9EF68]/20'
            : ''
        } ${className}`}
      >
        <span className="truncate flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className="truncate min-w-0 flex-1 text-left font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-[#B9EF68]' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full z-50 mt-1.5 w-full min-w-full overflow-hidden rounded-lg border border-white/[0.12] bg-[#0b1113]/98 shadow-2xl shadow-black/80 backdrop-blur-xl ${dropdownClassName}`}
        >
          <div className="max-h-60 overflow-y-auto hide-scrollbar">
            {renderOptions()}
          </div>
        </div>
      )}
    </div>
  );
};
