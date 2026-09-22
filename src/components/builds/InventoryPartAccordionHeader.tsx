import React, { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CategoryIcon } from '../ui/CategoryIcon';

interface InventoryPartAccordionHeaderProps {
  category: string;
  name: string;
  metadata: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

export const InventoryPartAccordionHeader: React.FC<InventoryPartAccordionHeaderProps> = ({
  category,
  name,
  metadata,
  isExpanded,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={isExpanded}
    className="swap-component-header group w-full cursor-pointer text-left"
  >
    <span className="swap-category-icon">
      <CategoryIcon category={category} className="w-4 h-4 text-[#B9EF68]" />
    </span>
    <span className="min-w-0">
      <span className="block break-words font-sans text-xs font-semibold leading-snug text-zinc-100 transition-colors sm:text-sm">
        {name}
      </span>
      <span className="swap-component-meta">{metadata}</span>
    </span>
    <span className="shrink-0 self-center">
      {isExpanded
        ? <ChevronUp className="w-4 h-4 text-zinc-400" />
        : <ChevronDown className="w-4 h-4 text-zinc-400" />}
    </span>
  </button>
);
