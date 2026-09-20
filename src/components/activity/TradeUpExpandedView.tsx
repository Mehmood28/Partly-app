import React from 'react';
import { InventoryComponent, TransactionLogItem } from '../../types';
import { formatCurrency, getCategoryPresentation } from '../../utils/helpers';

interface TradeUpExpandedViewProps {
  tx: TransactionLogItem;
  outgoingCostBasis: number;
  cashPaidOnTop: number;
  incomingCostBasis: number;
  matchedOutgoingComp?: InventoryComponent;
  matchedIncomingComp?: InventoryComponent;
}

export const TradeUpExpandedView: React.FC<TradeUpExpandedViewProps> = ({
  tx,
  outgoingCostBasis,
  cashPaidOnTop,
  incomingCostBasis,
  matchedOutgoingComp,
  matchedIncomingComp,
}) => {
  const linkedComponents = [
    matchedOutgoingComp ? { label: 'Outgoing', component: matchedOutgoingComp } : null,
    matchedIncomingComp ? { label: 'Incoming', component: matchedIncomingComp } : null,
  ].filter(Boolean) as Array<{ label: string; component: InventoryComponent }>;

  return (
    <div className="record-detail space-y-4">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08]">
        <div className="bg-[#0B1113] p-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Outgoing Basis</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-zinc-200">{formatCurrency(outgoingCostBasis)}</div>
        </div>
        <div className="bg-[#0B1113] p-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Cash Added</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-zinc-100">+{formatCurrency(cashPaidOnTop)}</div>
        </div>
        <div className="bg-[#0B1113] p-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Incoming Basis</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-[#9FF8F4]">{formatCurrency(incomingCostBasis)}</div>
        </div>
      </div>

      <section className="border-y border-white/[0.08] py-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Exchange audit trail</div>
        {tx.detailsList && tx.detailsList.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {tx.detailsList.map((detail, idx) => (
              <div key={idx} className="py-1.5 font-mono text-[11px] leading-relaxed text-zinc-300">{detail}</div>
            ))}
          </div>
        ) : (
          <div className="font-mono text-[11px] text-zinc-300">{tx.itemNameOrSummary || tx.title} · {formatCurrency(incomingCostBasis)} incoming basis</div>
        )}
        {tx.notes && <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">{tx.notes}</div>}
      </section>

      {linkedComponents.length > 0 && (
        <div className="overflow-hidden rounded-lg border-x border-y border-white/[0.08]">
          {linkedComponents.map(({ label, component }) => {
            const category = getCategoryPresentation(component.category);
            return (
              <div key={`${label}-${component.id}`} className="relative grid grid-cols-[3.8rem_minmax(0,1fr)] gap-2 border-b border-white/[0.06] px-2.5 py-2.5 last:border-b-0">
                <span className={`pt-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${category.textClass}`}>{category.label}</span>
                <div className="min-w-0">
                  <div className="break-words text-xs font-medium text-zinc-100">{component.name}</div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-500">{label}{component.tags?.length ? ` · ${component.tags.join(' · ')}` : ''}</div>
                </div>
                <span className={`absolute inset-y-2 right-0 w-0.5 rounded-full ${category.railClass}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
