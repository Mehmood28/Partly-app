import React from 'react';
import { CATEGORIES, ComponentCategory, InventoryComponent } from '../types';
import { Search, ArrowDownWideNarrow, X } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { calculateUnassignedQuantityStrict, SortOption, CATEGORY_TAG_GROUPS } from '../utils/helpers';
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
  activeSubTags?: string[];
  onSubTagToggle?: (tag: string) => void;
  showSearch?: boolean;
  showSort?: boolean;
  compactControls?: boolean;
  showCategories?: boolean;
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
  activeSubTags,
  onSubTagToggle,
  showSearch = true,
  showSort = true,
  compactControls = false,
  showCategories = true,
}) => {
  const isAvailable = (c: InventoryComponent) => !onlyAvailable || calculateUnassignedQuantityStrict(c, builds) > 0;
  
  const currentTagGroups = (activeCategory !== 'ALL' && CATEGORIES.includes(activeCategory as ComponentCategory))
    ? (CATEGORY_TAG_GROUPS[activeCategory] || [])
    : [];

  return (
    <div className={`inventory-filter-bar w-full space-y-2 ${compactControls ? 'is-compact' : ''}`}>
      {showCategories && (
        <div className="category-filters flex overflow-x-auto no-scrollbar gap-1.5 items-center w-full">
          <button
            type="button"
            onClick={() => {
              onCategoryChange('ALL');
              onSubCategoryChange?.('');
            }}
            data-active={activeCategory === 'ALL'}
            className={`app-chip app-category-chip flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9EF68] ${
              activeCategory === 'ALL'
                ? 'app-chip-active text-[#B9EF68] bg-[#B9EF68]/[0.03] shadow-[inset_0_0_0_1px_#B9EF68]'
                : 'text-[#b1bac4] border border-zinc-800 bg-transparent hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span className="whitespace-nowrap text-[11px] font-medium leading-none">All Categories</span>
            <span className="shrink-0 font-mono text-[10px] opacity-75">
              ({components.filter(isAvailable).length})
            </span>
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
                data-active={isActive}
                className={`app-chip app-category-chip flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9EF68] ${
                  isActive
                    ? 'app-chip-active text-[#B9EF68] bg-[#B9EF68]/[0.03] shadow-[inset_0_0_0_1px_#B9EF68]'
                    : 'text-[#b1bac4] border border-zinc-800 bg-transparent hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span className="whitespace-nowrap text-[11px] font-medium leading-none">{cat}</span>
                <span className="shrink-0 font-mono text-[10px] opacity-75">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Secondary Tag Group Filter Bar (Single Horizontal Scrolling Row with Dividers) */}
      {currentTagGroups.length > 0 && (
        <div className="subcategory-filters flex w-full overflow-x-auto no-scrollbar gap-1.5 items-center whitespace-nowrap">
          {currentTagGroups.map((group, groupIdx) => (
            <React.Fragment key={group.label}>
              {groupIdx > 0 && (
                <div
                  className="h-3 w-px bg-white/20 shrink-0 mx-0.5"
                  aria-hidden="true"
                />
              )}
              {group.tags.map((sub) => {
                const isActive = activeSubTags
                  ? activeSubTags.some((t) => t.toLowerCase() === sub.toLowerCase())
                  : activeSubCategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      if (onSubTagToggle) {
                        onSubTagToggle(sub);
                      } else if (onSubCategoryChange) {
                        onSubCategoryChange(activeSubCategory === sub ? '' : sub);
                      }
                    }}
                    data-active={isActive}
                    className={`app-chip app-subcategory-chip flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9EF68] ${
                      isActive
                        ? 'app-chip-active text-[#B9EF68] bg-[#B9EF68]/[0.03] shadow-[inset_0_0_0_1px_#B9EF68]'
                        : 'text-[#b1bac4] border border-zinc-800 bg-transparent hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <span className="whitespace-nowrap text-[10.5px] font-medium leading-none">{sub}</span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Controls Row: Search & Sort */}
      {(showSearch || (showSort && onSortByChange)) && <div className="inventory-filter-controls flex w-full min-w-0 max-w-full flex-col gap-2 sm:flex-row">
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
