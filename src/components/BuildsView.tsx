import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { PCBuild } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  calculateBuildPartsCost,
} from '../utils/helpers';
import { SellBuildModal } from './builds/SellBuildModal';
import { AllocatePartModal } from './builds/AllocatePartModal';
import { EditBuildModal } from './builds/EditBuildModal';
import { DismantleRigModal } from './builds/dismantle/DismantleRigModal';
import { ItemizeTradeInModal } from './builds/dismantle/ItemizeTradeInModal';
import { BuildCard } from './builds/BuildCard';
import { CustomSelect } from './ui/CustomSelect';
import {
  Hammer,
  Plus,
  ShoppingCart,
  X,
  Search,
} from 'lucide-react';

export type FilterStatus = 'Available' | 'Pending' | 'Trade-Ins' | 'Sold';

interface BuildsViewProps {
  isActive?: boolean;
  onOpenAddBuild: (initialData?: Partial<PCBuild>) => void;
  onOpenBuyPC: () => void;
  statusFilter?: FilterStatus;
  onStatusFilterChange?: (status: FilterStatus) => void;
}

type SortOption =
  | 'newest'
  | 'oldest'
  | 'recently_sold'
  | 'price_high'
  | 'price_low'
  | 'profit_high'
  | 'name_asc';

export const BuildsView: React.FC<BuildsViewProps> = React.memo(({ 
  isActive, 
  onOpenAddBuild,
  onOpenBuyPC,
  statusFilter: propStatusFilter,
  onStatusFilterChange
}) => {
  const {
    state,
    updateBuildStatus,
    removePartFromBuild,
    sellBuild,
    deleteBuild,
    dismantleBuild,
    saveAcquiredPCComponentBreakdown,
  } = useInventory();
  const { showToast } = useToast();

  const [sellingBuild, setSellingBuild] = useState<PCBuild | null>(null);
  const [allocatingBuild, setAllocatingBuild] = useState<PCBuild | null>(null);
  const [deletingBuild, setDeletingBuild] = useState<PCBuild | null>(null);
  const [dismantlingBuild, setDismantlingBuild] = useState<PCBuild | null>(null);
  const [itemizingBuild, setItemizingBuild] = useState<PCBuild | null>(null);


  const [editingBuild, setEditingBuild] = useState<PCBuild | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const handleOpenSellModal = React.useCallback((build: PCBuild) => {
    setSellingBuild(build);
  }, []);

  // Filter and search state
  const [localStatusFilter, setLocalStatusFilter] = useState<FilterStatus>('Available');
  const statusFilter = propStatusFilter !== undefined ? propStatusFilter : localStatusFilter;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedBuildId, setExpandedBuildId] = useState<string | null>(null);
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const handleTabChange = React.useCallback((status: FilterStatus) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(status);
    } else {
      setLocalStatusFilter(status);
    }
    if (status === 'Sold') {
      setSortBy('recently_sold');
    } else if (sortBy === 'recently_sold') {
      setSortBy('newest');
    }
  }, [onStatusFilterChange, sortBy]);

  const handleOpenEditModal = React.useCallback((build: PCBuild) => {
    setEditingBuild(build);
  }, []);


  // Counts
  const { availableCount, pendingCount, tradeInCount, soldCount } = React.useMemo(() => {
    let available = 0, pending = 0, tradeIns = 0, sold = 0;
    for (const b of state.builds) {
      if (b.status === 'Listed for Sale') available++;
      else if (b.status === 'In Progress') pending++;
      else if (b.status === 'Trade-In Processing') tradeIns++;
      else if (b.status === 'Sold') sold++;
    }
    return { availableCount: available, pendingCount: pending, tradeInCount: tradeIns, soldCount: sold };
  }, [state.builds]);

  // Filtered & Sorted builds
  const filteredBuilds = React.useMemo(() => {
    return state.builds
      .filter((build) => {
        // Filter by status tab
        if (statusFilter === 'Available' && build.status !== 'Listed for Sale') return false;
        if (statusFilter === 'Pending' && build.status !== 'In Progress') return false;
        if (statusFilter === 'Trade-Ins' && build.status !== 'Trade-In Processing') return false;
        if (statusFilter === 'Sold' && build.status !== 'Sold') return false;

        // Filter by search
        if (deferredSearchQuery.trim()) {
          const q = deferredSearchQuery.toLowerCase();
          const matchesName = String(build.name || "").toLowerCase().includes(q);
          const matchesNotes = String(build.notes || "").toLowerCase().includes(q);
          const matchesStatus = String(build.status || "").toLowerCase().includes(q);
          return matchesName || matchesNotes || matchesStatus;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recently_sold') {
          const dateA = a.status === 'Sold' ? (a.saleDate || a.createdDate || '') : (a.createdDate || '');
          const dateB = b.status === 'Sold' ? (b.saleDate || b.createdDate || '') : (b.createdDate || '');
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return b.id.localeCompare(a.id);
        }
        if (sortBy === 'newest') {
          const dateA = a.createdDate || '';
          const dateB = b.createdDate || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return b.id.localeCompare(a.id);
        }
        if (sortBy === 'oldest') {
          const dateA = a.createdDate || '';
          const dateB = b.createdDate || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return a.id.localeCompare(b.id);
        }
        if (sortBy === 'price_high') {
          const priceA = a.salePrice ?? (a.estimatedCost || calculateBuildPartsCost(a));
          const priceB = b.salePrice ?? (b.estimatedCost || calculateBuildPartsCost(b));
          if (priceA !== priceB) return priceB - priceA;
          return b.id.localeCompare(a.id);
        }
        if (sortBy === 'price_low') {
          const priceA = a.salePrice ?? (a.estimatedCost || calculateBuildPartsCost(a));
          const priceB = b.salePrice ?? (b.estimatedCost || calculateBuildPartsCost(b));
          if (priceA !== priceB) return priceA - priceB;
          return a.id.localeCompare(b.id);
        }
        if (sortBy === 'profit_high') {
          const costA = calculateBuildPartsCost(a);
          const costB = calculateBuildPartsCost(b);
          const profitA = (a.salePrice ?? a.estimatedCost ?? costA) - costA;
          const profitB = (b.salePrice ?? b.estimatedCost ?? costB) - costB;
          if (profitA !== profitB) return profitB - profitA;
          return b.id.localeCompare(a.id);
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [state.builds, statusFilter, deferredSearchQuery, sortBy]);

  // Chunk into 2-card rows for dynamic virtualization
  const buildRows = useMemo(() => {
    const rows: PCBuild[][] = [];
    for (let i = 0; i < filteredBuilds.length; i += 2) {
      rows.push(filteredBuilds.slice(i, i + 2));
    }
    return rows;
  }, [filteredBuilds]);

  const isVirtualized = buildRows.length > 12;
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef<number>(0);

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? buildRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 4,
    getItemKey: (index) => buildRows[index]?.map(b => b.id).join('-') ?? index,
    useCachedMeasurements: !isActive,
    useFlushSync: false,
  });

  // Restore scroll position when tab becomes active (virtualized path only)
  React.useLayoutEffect(() => {
    if (isActive && isVirtualized && parentRef.current && scrollOffsetRef.current > 0) {
      const maxScroll = Math.max(0, parentRef.current.scrollHeight - parentRef.current.clientHeight);
      const targetOffset = Math.min(scrollOffsetRef.current, maxScroll);
      scrollOffsetRef.current = targetOffset;
      queueMicrotask(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = targetOffset;
          rowVirtualizer.scrollToOffset(targetOffset);
        }
      });
    } else if (!isVirtualized) {
      scrollOffsetRef.current = 0;
    }
  }, [isActive, isVirtualized, rowVirtualizer]);

  // Reset list scroll to top only when user changes local filter/search/sort criteria
  const isFirstFilterRun = useRef(true);
  React.useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    scrollOffsetRef.current = 0;
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
    if (isVirtualized) {
      rowVirtualizer.scrollToOffset(0);
    }
  }, [statusFilter, sortBy, deferredSearchQuery, isVirtualized, rowVirtualizer]);

  return (
    <div className="space-y-2">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D1118] border border-white/[0.08] p-3 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2]">
              <Hammer className="w-3.5 h-3.5" />
            </div>
            PC BUILDS
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1">
            Manage PC builds, inventory allocation, listings, and sales.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={onOpenBuyPC}
            className="bg-[#121722] hover:bg-white/[0.06] border border-[#7C6CF2]/30 text-[#9D91FA] font-semibold shadow-sm text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Buy PC
          </button>
          <button
            onClick={() => onOpenAddBuild()}
            className="bg-[#7C6CF2] hover:bg-[#6A58EA] text-white font-semibold shadow-sm text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Create New PC Build
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-[#0D1118] border border-white/[0.08] p-2.5 rounded-xl shadow-sm">
        {/* Status Filter Tabs: Available, Pending, Sold */}
        <div className="flex items-center gap-1.5 flex-nowrap sm:flex-wrap pb-0.5 md:pb-0 text-xs">
          <button 
            type="button"
            onClick={() => handleTabChange('Available')} 
            className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap transition-all shrink-0 cursor-pointer ${statusFilter === 'Available' ? 'bg-[#7C6CF2] text-white shadow-sm shadow-[#7C6CF2]/20' : 'bg-[#121722] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]'}`}
          >
            AVAILABLE ({availableCount})
          </button>

          <button 
            type="button"
            onClick={() => handleTabChange('Pending')} 
            className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap transition-all shrink-0 cursor-pointer ${statusFilter === 'Pending' ? 'bg-[#7C6CF2] text-white shadow-sm shadow-[#7C6CF2]/20' : 'bg-[#121722] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]'}`}
          >
            PENDING ({pendingCount})
          </button>

          <button 
            type="button"
            onClick={() => handleTabChange('Trade-Ins')} 
            className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap transition-all shrink-0 cursor-pointer ${statusFilter === 'Trade-Ins' ? 'bg-[#7C6CF2] text-white shadow-sm shadow-[#7C6CF2]/20' : 'bg-[#121722] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]'}`}
          >
            TRADE-INS ({tradeInCount})
          </button>

          <button 
            type="button"
            onClick={() => handleTabChange('Sold')} 
            className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap transition-all shrink-0 cursor-pointer ${statusFilter === 'Sold' ? 'bg-[#7C6CF2] text-white shadow-sm shadow-[#7C6CF2]/20' : 'bg-[#121722] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]'}`}
          >
            SOLD ({soldCount})
          </button>
        </div>

        {/* Controls: Sort dropdown & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto min-w-0 max-w-full">
          {statusFilter === 'Sold' && (
            <div className="w-full sm:w-auto min-w-0 shrink-0">
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val as SortOption)}
                options={[
                  { value: 'newest', label: 'Sort: Newest Created' },
                  { value: 'oldest', label: 'Sort: Oldest Created' },
                  { value: 'recently_sold', label: 'Sort: Recently Sold First' },
                  { value: 'price_high', label: 'Sort: Price (High to Low)' },
                  { value: 'price_low', label: 'Sort: Price (Low to High)' },
                  { value: 'profit_high', label: 'Sort: Profit (High to Low)' },
                  { value: 'name_asc', label: 'Sort: Build Name (A-Z)' },
                ]}
                className="py-0.5 w-full sm:min-w-[170px]"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative w-full max-w-full md:w-56 min-w-0 flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search builds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-full box-border h-9 pl-9 pr-8 bg-[#121722] border border-white/[0.08] rounded-xl py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PC Builds Grid (Virtualized or Normal Document Flow) */}
      {filteredBuilds.length === 0 ? (
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-10 text-center text-zinc-400 space-y-2">
          <div className="text-sm font-semibold text-zinc-200">No {statusFilter.toLowerCase()} builds found</div>
          <p className="text-xs text-zinc-400">
            {statusFilter === 'Available'
              ? 'You have no builds listed as Available right now. Create a new build or switch tabs!'
              : statusFilter === 'Pending'
              ? 'You have no builds with a pending sale.'
              : statusFilter === 'Trade-Ins'
              ? 'You have no traded-in PCs pending processing or part-out.'
              : 'Try selecting a different filter tab or clearing your search.'}
          </p>
        </div>
      ) : !isVirtualized ? (
        <div className="space-y-1.5 pr-1">
          {buildRows.map((rowBuilds, rowIndex) => (
            <div key={rowBuilds.map(b => b.id).join('-') || rowIndex} className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
              {rowBuilds.map((build) => (
                <BuildCard
                  isExpanded={expandedBuildId === build.id}
                  onToggle={() => setExpandedBuildId(expandedBuildId === build.id ? null : build.id)}
                  key={build.id}
                  build={build}
                  onEdit={handleOpenEditModal}
                  onDelete={setDeletingBuild}
                  onDismantle={setDismantlingBuild}
                  onItemize={setItemizingBuild}
                  onSell={handleOpenSellModal}
                  onAllocate={setAllocatingBuild}
                  updateStatus={updateBuildStatus}
                  removePart={removePartFromBuild}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div 
          ref={parentRef}
          onScroll={(e) => {
            if (isActive) {
              scrollOffsetRef.current = e.currentTarget.scrollTop;
            }
          }}
          className="h-[calc(100dvh-275px)] md:h-[calc(100dvh-170px)] overflow-y-auto pr-1"
          style={{
            overflowAnchor: 'none',
            scrollbarWidth: 'thin',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowBuilds = buildRows[virtualRow.index] || [];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '6px',
                  }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {rowBuilds.map((build) => (
                      <BuildCard
                        isExpanded={expandedBuildId === build.id}
                        onToggle={() => setExpandedBuildId(expandedBuildId === build.id ? null : build.id)}
                        key={build.id}
                        build={build}
                        onEdit={handleOpenEditModal}
                        onDelete={setDeletingBuild}
                        onDismantle={setDismantlingBuild}
                        onItemize={setItemizingBuild}
                        onSell={handleOpenSellModal}
                        onAllocate={setAllocatingBuild}
                        updateStatus={updateBuildStatus}
                        removePart={removePartFromBuild}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EditBuildModal build={editingBuild} onClose={() => setEditingBuild(null)} />
      <AllocatePartModal build={allocatingBuild} onClose={() => setAllocatingBuild(null)} />
      <DismantleRigModal
        build={dismantlingBuild}
        onClose={() => setDismantlingBuild(null)}
        onConfirm={(buildId, extractedParts) => {
          const isTradeIn = dismantlingBuild?.acquisitionSource === 'Trade-In';
          const isPurchased = dismantlingBuild?.acquisitionSource === 'Purchased';
          const res = dismantleBuild(buildId, extractedParts);
          if (!res.success) {
            showToast(res.error || 'Failed to dismantle build', 'error');
            return;
          }
          setDismantlingBuild(null);
          const totalExtractedCount = extractedParts.reduce((sum, p) => sum + (p.quantity || 1), 0);
          if (isTradeIn) {
            showToast(`Trade-in parted out — ${totalExtractedCount} parts added to inventory stock.`);
          } else if (isPurchased) {
            showToast(`Purchased PC parted out — ${totalExtractedCount} parts added to inventory stock.`);
          } else {
            showToast(`Rig dismantled — ${totalExtractedCount} parts returned to inventory stock.`);
          }
        }}
      />
      <ItemizeTradeInModal
        build={itemizingBuild}
        onClose={() => setItemizingBuild(null)}
        onConfirm={(buildId, breakdown) => {
          const acquisitionType = itemizingBuild?.acquisitionSource === 'Purchased' ? 'Purchased PC' : 'Trade-in PC';
          const res = saveAcquiredPCComponentBreakdown(buildId, breakdown);
          if (!res.success) {
            showToast(res.error || 'Failed to save breakdown', 'error');
            return;
          }
          setItemizingBuild(null);
          showToast(`${acquisitionType} successfully itemized.`);
        }}
      />
      <SellBuildModal 
        build={sellingBuild} 
        onClose={() => setSellingBuild(null)} 
        onConfirm={(buildId, saleData) => {
          const res = sellBuild(buildId, saleData);
          if (!res.success) {
            showToast(res.error || 'Failed to complete sale', 'error');
            return;
          }
          setSellingBuild(null);
          handleTabChange('Sold');
        }} 
      />
      <ConfirmModal
        isOpen={!!deletingBuild}
        title="Delete Build Draft"
        message={`Are you sure you want to delete the draft build "${deletingBuild?.name}"?`}
        confirmText="Delete Draft"
        onConfirm={() => {
          if (deletingBuild) {
            deleteBuild(deletingBuild.id);
            setDeletingBuild(null);
          }
        }}
        onCancel={() => setDeletingBuild(null)}
      />
    </div>
  );
});
