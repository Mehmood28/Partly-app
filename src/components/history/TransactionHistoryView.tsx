import React, { useState, useDeferredValue, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInventory } from '../../context/InventoryContext';
import { TransactionLogItem } from '../../types';
import { Search, X, Filter } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { EditTransactionModal } from '../activity/EditTransactionModal';
import { TransactionActivityCard } from '../activity/TransactionActivityCard';
import { BulkSaleActivityCard } from '../activity/BulkSaleActivityCard';
import { ConfirmModal } from '../ConfirmModal';
import { 
  getSoldPartsDisplayItems, 
  matchesSearchQuery, 
  sortSoldPartDisplayItems, 
  SoldPartSortOption 
} from '../../utils/bulkSaleGrouping';

interface TransactionHistoryViewProps {
  isActive?: boolean;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = React.memo(({ isActive }) => {
  const { state, deleteTransaction, deleteBulkPartSale, relistBulkPartSale } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SoldPartSortOption>('date-desc');
  const [editingTx, setEditingTx] = useState<TransactionLogItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const displayItems = useMemo(() => {
    return getSoldPartsDisplayItems(state.transactions, state.builds);
  }, [state.transactions, state.builds]);

  const filteredDisplayItems = useMemo(() => {
    return displayItems.filter((item) => matchesSearchQuery(item, deferredSearchQuery));
  }, [displayItems, deferredSearchQuery]);

  const sortedDisplayItems = useMemo(() => {
    return sortSoldPartDisplayItems(filteredDisplayItems, sortBy);
  }, [filteredDisplayItems, sortBy]);

  const isVirtualized = sortedDisplayItems.length > 12;
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef<number>(0);

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? sortedDisplayItems.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    getItemKey: (index) => sortedDisplayItems[index]?.id ?? index,
    overscan: 5,
    useCachedMeasurements: !isActive,
    useFlushSync: false,
  });

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
  }, [sortBy, deferredSearchQuery, isVirtualized, rowVirtualizer]);

  return (
    <div className="sold-parts-view space-y-4">
      <header className="sold-parts-heading">
        <h2>Sold Parts</h2>
        <p>Track loose-part sales and trade-ups</p>
      </header>

      <div className="sold-parts-toolbar">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search sold parts, trade-ups, platform, payment method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-field pl-9 pr-8 placeholder:text-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div>
          <CustomSelect
            options={[
              { value: 'date-desc', label: 'Newest' },
              { value: 'date-asc', label: 'Oldest' },
              { value: 'amount-desc', label: 'Highest Revenue' },
              { value: 'amount-asc', label: 'Lowest Revenue' },
              { value: 'profit-desc', label: 'Highest Profit' },
            ]}
            value={sortBy}
            onChange={(val) => setSortBy(val as SoldPartSortOption)}
          />
        </div>
      </div>

      {/* Cards List (Virtualized or Normal Document Flow) */}
      {sortedDisplayItems.length === 0 ? (
        <div className="text-center py-10 bg-[#0B1113] border border-white/[0.08] rounded-xl p-6 text-zinc-400 space-y-2">
          <Filter className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-200">No sold parts or trade-ups found</p>
          <p className="text-xs text-zinc-400">Try changing your search query or selling/trading components from stock.</p>
        </div>
      ) : !isVirtualized ? (
        <div className="space-y-2">
          {sortedDisplayItems.map((item) => {
            if (item.type === 'bulk-group') {
              return (
                <BulkSaleActivityCard
                  key={item.id}
                  group={item}
                  isExpanded={expandedIds.has(item.id)}
                  onToggle={() => handleToggleExpand(item.id)}
                  onEditLine={(txToEdit) => setEditingTx(txToEdit)}
                  onDeleteGroup={(bulkSaleGroupId) => deleteBulkPartSale(bulkSaleGroupId)}
                  onRelistGroup={(bulkSaleGroupId) => relistBulkPartSale(bulkSaleGroupId)}
                />
              );
            }

            return (
              <TransactionActivityCard
                key={item.id}
                tx={item.tx}
                isExpanded={expandedIds.has(item.id)}
                onToggle={() => handleToggleExpand(item.id)}
                onEdit={(txToEdit) => setEditingTx(txToEdit)}
                onDelete={(idToDelete) => setDeleteConfirmId(idToDelete)}
              />
            );
          })}
        </div>
      ) : (
        <div
          ref={parentRef}
          onScroll={(e) => {
            if (isActive) {
              scrollOffsetRef.current = e.currentTarget.scrollTop;
            }
          }}
          className="h-[calc(100dvh-330px)] overflow-y-auto pr-1 md:h-[calc(100dvh-210px)]"
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
              const item = sortedDisplayItems[virtualRow.index];
              if (!item) return null;
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
                  {item.type === 'bulk-group' ? (
                    <BulkSaleActivityCard
                      group={item}
                      isExpanded={expandedIds.has(item.id)}
                      onToggle={() => handleToggleExpand(item.id)}
                      onEditLine={(txToEdit) => setEditingTx(txToEdit)}
                      onDeleteGroup={(bulkSaleGroupId) => deleteBulkPartSale(bulkSaleGroupId)}
                      onRelistGroup={(bulkSaleGroupId) => relistBulkPartSale(bulkSaleGroupId)}
                    />
                  ) : (
                    <TransactionActivityCard
                      tx={item.tx}
                      isExpanded={expandedIds.has(item.id)}
                      onToggle={() => handleToggleExpand(item.id)}
                      onEdit={(txToEdit) => setEditingTx(txToEdit)}
                      onDelete={(idToDelete) => setDeleteConfirmId(idToDelete)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Part Sale Record"
        message="Are you sure you want to delete this part sale record? This removes only the sale activity record and does not return sold stock. Use Relist if you want to return stock to inventory."
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteTransaction(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
});
