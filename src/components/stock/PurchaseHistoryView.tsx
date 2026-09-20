import React, { useState, useDeferredValue, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInventory } from '../../context/InventoryContext';
import { TransactionLogItem } from '../../types';
import { Search, X, Filter, ArrowDownWideNarrow } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { EditTransactionModal } from '../activity/EditTransactionModal';
import { TransactionActivityCard } from '../activity/TransactionActivityCard';
import { ConfirmModal } from '../ConfirmModal';
import { classifyTransaction } from '../../utils/transactionClassification';
import { resolveTransactionDate } from '../../utils/bulkSaleGrouping';

interface PurchaseHistoryViewProps {
  isActive?: boolean;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export const PurchaseHistoryView: React.FC<PurchaseHistoryViewProps> = React.memo(({ isActive }) => {
  const { state, deleteTransaction } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
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

  const purchaseTransactions = useMemo(() => {
    return state.transactions.filter((tx) => classifyTransaction(tx, state.builds).isPurchase);
  }, [state.transactions, state.builds]);

  const filteredTransactions = useMemo(() => {
    return purchaseTransactions.filter((tx) => {
      const q = deferredSearchQuery.trim().toLowerCase();
      if (!q) return true;

      return (
        String(tx.title || '').toLowerCase().includes(q) ||
        String(tx.itemNameOrSummary || '').toLowerCase().includes(q) ||
        String(tx.platform || '').toLowerCase().includes(q) ||
        String(tx.paymentMethod || '').toLowerCase().includes(q) ||
        (tx.detailsList && tx.detailsList.some((d) => d.toLowerCase().includes(q)))
      );
    });
  }, [purchaseTransactions, deferredSearchQuery]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (sortBy === 'date-desc') {
        const timeA = resolveTransactionDate(a)?.sortValue ?? 0;
        const timeB = resolveTransactionDate(b)?.sortValue ?? 0;
        return timeB - timeA;
      }
      if (sortBy === 'date-asc') {
        const timeA = resolveTransactionDate(a)?.sortValue ?? 0;
        const timeB = resolveTransactionDate(b)?.sortValue ?? 0;
        return timeA - timeB;
      }
      if (sortBy === 'amount-desc') {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (sortBy === 'amount-asc') {
        return (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      return 0;
    });
  }, [filteredTransactions, sortBy]);

  // A nested viewport makes the compact ledger stop well above the fixed
  // navigation on phones. Keep ordinary histories in the document scroll and
  // reserve virtualization for unusually large datasets only.
  const isVirtualized = sortedTransactions.length > 250;
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef<number>(0);

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? sortedTransactions.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    getItemKey: (index) => sortedTransactions[index]?.id ?? index,
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
    <div className="purchase-history-view space-y-4">
      <header className="purchase-page-heading">
        <h2>Purchases</h2>
        <p>Log and track all inventory purchases</p>
      </header>

      <div className="records-toolbar purchase-records-toolbar">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search purchase logs, vendor, platform..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-field h-12 pl-9 pr-8 text-xs placeholder:text-zinc-600 sm:text-sm"
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

        <div className="w-full sm:w-48 shrink-0">
          <CustomSelect
            options={[
              { value: 'date-desc', label: 'Newest' },
              { value: 'date-asc', label: 'Oldest' },
              { value: 'amount-desc', label: 'Highest Cost' },
              { value: 'amount-asc', label: 'Lowest Cost' },
            ]}
            value={sortBy}
            onChange={(val) => setSortBy(val as SortOption)}
            icon={<ArrowDownWideNarrow className="h-3.5 w-3.5 text-[#B9EF68]" />}
          />
        </div>
      </div>

      {/* Cards List (Virtualized or Normal Document Flow) */}
      {sortedTransactions.length === 0 ? (
        <div className="text-center py-10 bg-[#0B1113] border border-white/[0.08] rounded-xl p-6 text-zinc-400 space-y-2">
          <Filter className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-200">No purchase records found</p>
          <p className="text-xs text-zinc-400">Try changing your search query.</p>
        </div>
      ) : !isVirtualized ? (
        <div className="space-y-2">
          {sortedTransactions.map((tx) => (
            <TransactionActivityCard
              key={tx.id}
              tx={tx}
              isExpanded={expandedIds.has(tx.id)}
              onToggle={() => handleToggleExpand(tx.id)}
              onEdit={(txToEdit) => setEditingTx(txToEdit)}
              onDelete={(idToDelete) => setDeleteConfirmId(idToDelete)}
            />
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
              const tx = sortedTransactions[virtualRow.index];
              if (!tx) return null;
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
                  <TransactionActivityCard
                    tx={tx}
                    isExpanded={expandedIds.has(tx.id)}
                    onToggle={() => handleToggleExpand(tx.id)}
                    onEdit={(txToEdit) => setEditingTx(txToEdit)}
                    onDelete={(idToDelete) => setDeleteConfirmId(idToDelete)}
                  />
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
        title="Delete Purchase Record"
        message="Are you sure you want to delete this purchase record? This removes only the purchase activity record and does not change its inventory batch."
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
