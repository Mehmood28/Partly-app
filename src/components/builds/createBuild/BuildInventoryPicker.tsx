import React, { useState, useMemo } from 'react';
import { Tag, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { CATEGORIES, ComponentCategory, InventoryComponent, PCBuild, PCBuildPart } from '../../../types';
import { filterAndSortComponents, formatCurrency, formatReadableDate, getConditionDotColor } from '../../../utils/helpers';
import { usePrivacy } from '../../../context/PrivacyContext';
import { InventoryFilterBar } from '../../InventoryFilterBar';
import { normalizePlatform } from '../../../utils/platformDisplay';
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
    <div className="app-panel space-y-3 p-3.5 sm:p-4">
      <div className="border-b border-white/[0.08] pb-2">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 mb-1 font-display">
          <Tag className="w-3.5 h-3.5 text-[#A8FF3E]" /> Pick Parts from Inventory
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
          <div className="bg-[#101719] border border-white/[0.08] rounded-xl p-4 text-center text-xs text-zinc-400 font-sans">
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
                      <div key={comp.id} className="app-panel-quiet flex flex-col overflow-hidden text-xs transition-all hover:border-[#A8FF3E]/30">
                        <div
                          className="px-3 py-2 flex items-center justify-between cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedInventoryPartId(isExpanded ? null : comp.id);
                          }}
                        >
                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="text-xs font-semibold leading-snug text-zinc-100 break-words font-sans">{comp.name}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] text-zinc-500">
                              {comp.tags?.filter(Boolean).map((tag, idx) => <span key={idx}>{idx > 0 ? '· ' : ''}{tag}</span>)}
                              {comp.tags?.filter(Boolean).length ? <span>·</span> : null}
                              <span className="font-semibold text-[#62E6E6]">{totalUnassigned} in stock</span>
                              <span>· Avg {formatCurrency(weightedAvgCost)}/ea</span>
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
                          <div className="flex flex-col gap-2.5 border-t border-white/[0.08] bg-[#0b1113] p-3 text-xs">
                            <div className="flex flex-col gap-2">
                              {batches.map(({ entry, remainingUnassigned }) => (
                                <div
                                  key={entry.id}
                                  className="app-panel-quiet flex items-center justify-between gap-2 px-3 py-2.5 transition-all hover:border-[#A8FF3E]/30"
                                >
                                  <div className="min-w-0 flex-1 font-mono text-[10px] sm:text-[11px]">
                                    <div className="font-bold text-zinc-200">{remainingUnassigned} available @ {formatCurrency(entry.unitPrice)}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-zinc-500">
                                      <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(entry.condition)}`} />{entry.condition}</span>
                                      {!hideSupplierNames && entry.platform && <span>· {normalizePlatform(String(entry.platform))}</span>}
                                      {entry.paymentMethod && <span>· {String(entry.paymentMethod)}</span>}
                                      {entry.date && <span>· {formatReadableDate(entry.date) || entry.date}</span>}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={remainingUnassigned <= 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddPartClick(comp, entry.id);
                                    }}
                                    className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E] ${
                                      remainingUnassigned > 0
                                        ? 'app-button-primary border px-3 text-[#07100B]'
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
