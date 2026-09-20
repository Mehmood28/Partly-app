import React from 'react';
import { TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

interface BuildAllocationExpandedViewProps {
  tx: TransactionLogItem;
}

export const BuildAllocationExpandedView: React.FC<BuildAllocationExpandedViewProps> = ({ tx }) => (
  <div className="record-detail space-y-4">
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08]">
      <div className="bg-[#0B1113] p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Build Cost</div>
        <div className="mt-0.5 font-mono text-sm font-bold text-[#9FF8F4]">{formatCurrency(tx.totalAmount)}</div>
      </div>
      <div className="bg-[#0B1113] p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Parts Allocated</div>
        <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">{tx.itemCount || tx.quantity || 0}</div>
      </div>
    </div>

    {tx.detailsList && tx.detailsList.length > 0 && (
      <section>
        <div className="border-b border-white/[0.08] pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Allocated components</div>
        <div className="overflow-hidden rounded-b-lg border-x border-b border-white/[0.08]">
          {tx.detailsList.map((detail, idx) => (
            <div key={idx} className="border-b border-white/[0.06] px-2.5 py-2 text-xs leading-snug text-zinc-200 last:border-b-0">{detail}</div>
          ))}
        </div>
      </section>
    )}
  </div>
);
