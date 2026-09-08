import React from 'react';
import { TransactionLogItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

interface BuildAllocationExpandedViewProps {
  tx: TransactionLogItem;
}

export const BuildAllocationExpandedView: React.FC<BuildAllocationExpandedViewProps> = ({ tx }) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Total Build Cost</div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#9D91FA]">{formatCurrency(tx.totalAmount)}</div>
        </div>
        <div className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.08]">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">Total Parts Allocated</div>
          <div className="text-sm sm:text-base font-bold font-mono text-zinc-200">{tx.itemCount || tx.quantity || 0} components</div>
        </div>
      </div>

      {tx.detailsList && tx.detailsList.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Allocated Components</div>
          <div className="space-y-1">
            {tx.detailsList.map((d, idx) => (
              <div key={idx} className="bg-[#121722] p-2.5 rounded-xl border border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-zinc-200 break-words">{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
