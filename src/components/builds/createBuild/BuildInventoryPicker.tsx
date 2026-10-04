import React, { useState, useMemo } from 'react';
import { Tag, Plus } from 'lucide-react';
import { CATEGORIES, ComponentCategory, InventoryComponent, PCBuild, PCBuildPart } from '../../../types';
import { filterAndSortComponents, SortOption } from '../../../utils/helpers';
import { InventoryFilterBar } from '../../InventoryFilterBar';
import { ComponentCard } from '../../ComponentCard';
import { CategoryIcon } from '../../ui/CategoryIcon';

interface BuildInventoryPickerProps {
  components: InventoryComponent[];
  builds: PCBuild[];
  selectedParts?: PCBuildPart[];
  initialBuildId?: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  activeCategoryTab: ComponentCategory | 'All' | 'ALL';
  onCategoryChange: (category: string) => void;
  activeSubCategory?: string;
  onSubCategoryChange?: (subCat: string) => void;
  activeSubTags?: string[];
  onSubTagToggle?: (tag: string) => void;
  onAddPart: (comp: InventoryComponent, entryId: string) => void;
}

export const BuildInventoryPicker: React.FC<BuildInventoryPickerProps> = ({
  components,
  builds,
  selectedParts,
  searchQuery,
  onSearchQueryChange,
  activeCategoryTab,
  onCategoryChange,
  activeSubCategory,
  onSubCategoryChange,
  activeSubTags,
  onSubTagToggle,
  onAddPart,
}) => {
  const [expandedInventoryPartId, setExpandedInventoryPartId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest-purchase');

  const filteredComponents = useMemo(() => {
    return filterAndSortComponents(components, {
      searchQuery,
      category: activeCategoryTab === 'All' || activeCategoryTab === 'ALL' ? undefined : activeCategoryTab,
      subCategory: activeSubCategory,
      subTags: activeSubTags,
      onlyAvailable: true,
      builds,
      sortBy,
    });
  }, [components, searchQuery, activeCategoryTab, activeSubCategory, activeSubTags, builds, sortBy]);

  const handleAddPartClick = (comp: InventoryComponent, entryId: string) => {
    setExpandedInventoryPartId(null);
    onAddPart(comp, entryId);
  };

  return (
    <div className="form-section space-y-3">
      <div className="border-b border-white/[0.08] pb-2">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 mb-1 font-display">
          <Tag className="w-3.5 h-3.5 text-[#B9EF68]" /> Pick Parts from Inventory
        </h4>
        <span className="text-xs text-zinc-400 font-sans">Filter by category or view all available stock</span>
      </div>

      <InventoryFilterBar
        components={components}
        searchQuery={searchQuery}
        onSearchChange={onSearchQueryChange}
        activeCategory={activeCategoryTab}
        onCategoryChange={onCategoryChange}
        onlyAvailable={true}
        activeSubCategory={activeSubCategory}
        onSubCategoryChange={onSubCategoryChange}
        activeSubTags={activeSubTags}
        onSubTagToggle={onSubTagToggle}
        builds={builds}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      <div
        className="build-inventory-list flex flex-col gap-[5px]"
      >
        {filteredComponents.length === 0 ? (
          <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-4 text-center text-xs text-zinc-400 font-sans">
            No parts found in this category. Add components in the Stock tab first.
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            if (activeCategoryTab !== 'All' && activeCategoryTab !== 'ALL' && activeCategoryTab !== cat)
              return null;

            const catComps = filteredComponents.filter((c) => c.category === cat);
            if (catComps.length === 0) return null;

            return (
              <div key={cat} className="flex flex-col gap-[5px]">
                <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 pt-2 font-display">
                  <CategoryIcon
                    category={cat}
                    className="w-3.5 h-3.5 text-[#83E5DF]"
                    fallbackClassName="w-3.5 h-3.5 text-zinc-400"
                  /> {cat} Parts
                </div>
                <div className="grid grid-cols-1 gap-[5px]">
                  {catComps.map((comp) => {
                    const isExpanded = expandedInventoryPartId === comp.id;
                    return (
                      <ComponentCard
                        key={comp.id}
                        component={comp}
                        draftSelectedParts={selectedParts}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedInventoryPartId(isExpanded ? null : comp.id)}
                        showAdminActions={false}
                        renderBatchActions={(batch) => {
                          const isUsedUp = batch.availableQuantity <= 0;
                          return (
                            <button
                              type="button"
                              disabled={isUsedUp}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isUsedUp) {
                                  handleAddPartClick(comp, batch.entry.id);
                                }
                              }}
                              className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 flex items-center gap-1 focus-visible:outline-none ${
                                !isUsedUp
                                  ? 'app-button-primary border px-3 text-[#07100B]'
                                  : 'opacity-40 pointer-events-none bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" /> {isUsedUp ? 'Added' : 'Add'}
                            </button>
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
