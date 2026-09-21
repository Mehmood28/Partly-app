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
  showSearch?: boolean;
  showSort?: boolean;
  compactControls?: boolean;
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
  onSubCategoryChange,
  showSearch = true,
  showSort = true,
  compactControls = false,
}) => {
  const isAvailable = (c: InventoryComponent) => !onlyAvailable || calculateUnassignedQuantityStrict(c, builds) > 0;
  
  const currentSubCats = CATEGORIES.includes(activeCategory as ComponentCategory) 
    ? SUB_CATEGORIES[activeCategory] || [] 
    : [];

  return (
    <div className={`inventory-filter-bar w-full space-y-3 ${compactControls ? 'is-compact' : ''}`}>
      <div className="category-filters">
        <button
          type="button"
          onClick={() => {
            onCategoryChange('ALL');
            onSubCategoryChange?.('');
          }}
          className={`app-chip px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
            activeCategory === 'ALL'
              ? 'app-chip-active'
              : ''
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
              className={`app-chip px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                isActive
                  ? 'app-chip-active'
                  : ''
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>
      
      {/* Sub-Category Pills (Fully Visible Wrapping Layout) */}
      {currentSubCats.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {currentSubCats.map(sub => {
            const isActive = activeSubCategory === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => onSubCategoryChange?.(activeSubCategory === sub ? '' : sub)}
                className={`app-chip min-h-[32px] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                isActive
                  ? 'border-[#83E5DF]/50 bg-[#83E5DF]/[0.08] text-[#9FF8F4]'
                    : ''
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* Controls Row: Search & Sort */}
      {(showSearch || (showSort && onSortByChange)) && <div className="inventory-filter-controls flex w-full min-w-0 max-w-full flex-col gap-2.5 sm:flex-row">
        {showSearch && (
        <div className="relative flex-1 min-w-0 w-full max-w-full group">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search parts by name or model..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="app-field max-w-full box-border pl-8 pr-8 text-sm placeholder:text-zinc-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        )}
        
        {showSort && onSortByChange && (
          <div className="inventory-sort-control w-full sm:w-auto shrink-0 z-30 relative min-w-0 max-w-full">
            <CustomSelect
              value={sortBy}
              onChange={(val) => onSortByChange(val as SortOption)}
              options={[
                { value: 'newest-purchase', label: 'Recently Bought' },
                { value: 'highest-price', label: 'Highest Price Per Unit' },
                { value: 'lowest-price', label: 'Lowest Price Per Unit' },
                { value: 'highest-stock', label: 'Highest Units in Stock' },
                { value: 'lowest-stock', label: 'Lowest Units in Stock' }
              ]}
              icon={<ArrowDownWideNarrow className="h-4 w-4 text-[#B9EF68]" />}
              className="w-full sm:min-w-[210px]"
              dropdownClassName="shadow-2xl min-w-[230px] py-1.5"
            />
          </div>
        )}
      </div>}
    </div>
  );
};
