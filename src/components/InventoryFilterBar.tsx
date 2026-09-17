import React from 'react';
import { CATEGORIES, ComponentCategory, InventoryComponent } from '../types';
import { Search, ArrowDownWideNarrow, X } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { calculateUnassignedQuantityStrict, SortOption, SUB_CATEGORIES } from '../utils/helpers';
import { PCBuild } from '../types';

interface InventoryFilterBarProps {
  builds?: PCBuild[];
  components: InventoryComponent[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onlyAvailable?: boolean;
  sortBy?: SortOption;
  onSortByChange?: (sort: SortOption) => void;
  activeSubCategory?: string;
  onSubCategoryChange?: (sub: string) => void;
}

export const InventoryFilterBar: React.FC<InventoryFilterBarProps> = ({
  builds = [],
  components,
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onlyAvailable = true,
  sortBy = 'newest-purchase',
  onSortByChange,
  activeSubCategory = '',
  onSubCategoryChange
}) => {
  const isAvailable = (c: InventoryComponent) => !onlyAvailable || calculateUnassignedQuantityStrict(c, builds) > 0;
  
  const currentSubCats = CATEGORIES.includes(activeCategory as ComponentCategory) 
    ? SUB_CATEGORIES[activeCategory] || [] 
    : [];

  return (
    <div className="space-y-2 w-full">
      {/* Wrapped category index: all options remain visible on mobile. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-white/[0.08] pb-2 text-xs w-full">
        <button
          type="button"
          onClick={() => {
            onCategoryChange('ALL');
            onSubCategoryChange?.('');
          }}
          className={`px-2.5 py-1.5 border-b text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
            activeCategory === 'ALL'
              ? 'border-[#A3FF12] text-[#A3FF12] font-bold bg-[#A3FF12]/[0.04]'
              : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:border-white/[0.12]'
          }`}
        >
          All Categories ({components.filter(isAvailable).length})
        </button>
        
        {CATEGORIES.map((cat) => {
          const count = components.filter((c) => c.category === cat && isAvailable(c)).length;
          if (count === 0 && activeCategory !== cat) return null;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                onCategoryChange(cat);
                onSubCategoryChange?.('');
              }}
              className={`px-2.5 py-1.5 border-b text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
                isActive
                  ? 'border-[#A3FF12] text-[#A3FF12] bg-[#A3FF12]/[0.04]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:border-white/[0.12]'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>
      
      {/* Sub-Category Pills (Fully Visible Wrapping Layout) */}
      {currentSubCats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1 pt-0.5 text-xs w-full">
          {currentSubCats.map(sub => {
            const isActive = activeSubCategory === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => onSubCategoryChange?.(activeSubCategory === sub ? '' : sub)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3FF12] ${
                isActive
                  ? 'bg-[#67E8F9]/10 text-[#A5F3FC] border border-[#67E8F9]/30'
                    : 'bg-[#10141E] text-zinc-500 hover:text-zinc-200 border border-white/[0.08]'
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* Controls Row: Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-full min-w-0">
        <div className="relative flex-1 min-w-0 w-full max-w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search parts by name or model..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 max-w-full box-border bg-[#10141E] border border-white/[0.08] rounded-lg pl-10 pr-9 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-colors focus-visible:ring-2 focus-visible:ring-[#A3FF12]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {onSortByChange && (
          <div className="w-full sm:w-auto shrink-0 z-30 relative min-w-0 max-w-full">
            <CustomSelect
              value={sortBy}
              onChange={(val) => onSortByChange(val as SortOption)}
              options={[
                { value: 'newest-purchase', label: 'Recently Bought (Newest)' },
                { value: 'highest-price', label: 'Highest Price Per Unit' },
                { value: 'lowest-price', label: 'Lowest Price Per Unit' },
                { value: 'highest-stock', label: 'Highest Units in Stock' },
                { value: 'lowest-stock', label: 'Lowest Units in Stock' }
              ]}
              icon={<ArrowDownWideNarrow className="w-4 h-4 text-[#A3FF12]" />}
              className="w-full sm:min-w-[210px]"
              dropdownClassName="shadow-2xl min-w-[230px] py-1.5"
            />
          </div>
        )}
      </div>
    </div>
  );
};
