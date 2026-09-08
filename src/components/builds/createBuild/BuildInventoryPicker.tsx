import React, { useState, useMemo } from 'react';
import { Tag, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { CATEGORIES, ComponentCategory, InventoryComponent, PCBuild, PCBuildPart } from '../../../types';
import { filterAndSortComponents, formatCurrency } from '../../../utils/helpers';
import { usePrivacy } from '../../../context/PrivacyContext';
import { InventoryFilterBar } from '../../InventoryFilterBar';
import {
  calculateComponentBatchesWithStock,
  getCategoryIcon,
} from './buildModalHelpers';

interface BuildInventoryPickerProps {
  components: InventoryComponent[];
  builds: PCBuild[];
  selectedParts: PCBuildPart[];
  initialBuildId?: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  activeCategoryTab: ComponentCategory | 'All' | 'ALL';
  onCategoryChange: (category: string) => void;
  activeSubCategory: string;
  onSubCategoryChange: (subCat: string) => void;
  onAddPart: (comp: InventoryComponent, entryId: string) => void;
}

export const BuildInventoryPicker: React.FC<BuildInventoryPickerProps> = ({
  components,
  builds,
  selectedParts,
  initialBuildId,
  searchQuery,
  onSearchQueryChange,
  activeCategoryTab,
  onCategoryChange,
  activeSubCategory,
  onSubCategoryChange,
  onAddPart,
}) => {
  const { hideSupplierNames } = usePrivacy();
  const [expandedInventoryPartId, setExpandedInventoryPartId] = useState<string | null>(null);

  const filteredComponents = useMemo(() => {
    return filterAndSortComponents(components, {
      searchQuery,
      category: activeCategoryTab === 'All' || activeCategoryTab === 'ALL' ? undefined : activeCategoryTab,
      subCategory: activeSubCategory,
      onlyAvailable: true,
      builds,
    });
  }, [components, searchQuery, activeCategoryTab, activeSubCategory, builds]);

  const handleAddPartClick = (comp: InventoryComponent, entryId: string) => {
    setExpandedInventoryPartId(null);
    onAddPart(comp, entryId);
  };

  return (
    <div className="space-y-3">
      <div className="border-b border-white/[0.08] pb-2">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 mb-1 font-display">
          <Tag className="w-3.5 h-3.5 text-[#7C6CF2]" /> Pick Parts from Inventory
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
      />

      <div
        className="space-y-2 max-h-64 overflow-y-auto pr-1"
        onPointerDownCapture={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
      >
        {filteredComponents.length === 0 ? (
          <div className="bg-[#121722] border border-white/[0.08] rounded-xl p-4 text-center text-xs text-zinc-400 font-sans">
            No parts found in this category. Add components in the Stock tab first.
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            if (activeCategoryTab !== 'All' && activeCategoryTab !== 'ALL' && activeCategoryTab !== cat)
              return null;

            const catComps = filteredComponents.filter((c) => c.category === cat);
            if (catComps.length === 0) return null;

            const componentGroups = catComps
              .map((comp) => calculateComponentBatchesWithStock(comp, builds, selectedParts, initialBuildId))
              .filter((g) => g.totalUnassigned > 0 || g.batches.length > 0);

            if (componentGroups.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 pt-2 font-display">
                  {getCategoryIcon(cat)} {cat} Parts
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {componentGroups.map(({ comp, batches, totalUnassigned, weightedAvgCost }) => {
                    const isExpanded = expandedInventoryPartId === comp.id;
                    return (
                      <div
                        key={comp.id}
                        className="bg-[#121722] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl flex flex-col text-xs overflow-hidden transition-all"
                      >
                        <div
                          className="px-3 py-2 flex items-center justify-between cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedInventoryPartId(isExpanded ? null : comp.id);
                          }}
                        >
                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="text-xs font-semibold text-zinc-100 truncate font-sans">{comp.name}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-nowrap overflow-hidden">
                              {comp.tags &&
                                comp.tags.length > 0 &&
                                comp.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center whitespace-nowrap"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              <span className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                                {totalUnassigned} in stock
                              </span>
                              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-medium leading-none inline-flex items-center justify-center whitespace-nowrap">
                                Avg: {formatCurrency(weightedAvgCost)}/ea
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-[#0D1118] border-t border-white/[0.08] p-3 text-xs flex flex-col gap-2.5">
                            {comp.specifications && typeof comp.specifications === 'string' && (
                              <div className="text-zinc-300 leading-relaxed whitespace-normal break-words font-sans">
                                {comp.specifications}
                              </div>
                            )}
                            <div className="flex flex-col border-t border-white/[0.06] pt-2 gap-2">
                              {batches.map(({ entry, remainingUnassigned }) => (
                                <div
                                  key={entry.id}
                                  className="bg-[#121722] border border-white/[0.08] hover:border-[#7C6CF2]/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition-all"
                                >
                                  <div className="flex items-center gap-2 flex-wrap flex-1">
                                    <span className="bg-white/[0.04] text-zinc-200 border border-white/[0.08] shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold leading-none inline-flex items-center justify-center">
                                      {remainingUnassigned} available @ {formatCurrency(entry.unitPrice)}
                                    </span>
                                    <span className="bg-[#7C6CF2]/10 text-[#9D91FA] border border-[#7C6CF2]/20 shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-medium leading-none inline-flex items-center justify-center">
                                      {entry.condition}
                                    </span>
                                    <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px] font-mono">
                                      {entry.date}
                                    </span>
                                    {!hideSupplierNames && entry.platform && (
                                      <span className="text-zinc-400 shrink-0 whitespace-nowrap text-[11px]">
                                        {entry.platform}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={remainingUnassigned <= 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddPartClick(comp, entry.id);
                                    }}
                                    className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
                                      remainingUnassigned > 0
                                        ? 'bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white shadow-sm shadow-[#7C6CF2]/20'
                                        : 'opacity-40 pointer-events-none bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                                    }`}
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
