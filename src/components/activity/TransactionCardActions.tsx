import React from 'react';
import { Pencil, FileText, Trash2, RotateCcw } from 'lucide-react';
import { TransactionLogItem } from '../../types';

interface TransactionCardActionsProps {
  tx: TransactionLogItem;
  isPCSale: boolean;
  hasLinkedBuild?: boolean;
  isPartSale: boolean;
  onEdit: (tx: TransactionLogItem) => void;
  onDelete: (id: string) => void;
  onDownloadInvoice: (e: React.MouseEvent) => void;
  onRelistPart?: (tx: TransactionLogItem) => void;
  onRelistBulkSale?: () => void;
}

export const TransactionCardActions: React.FC<TransactionCardActionsProps> = ({
  tx,
  isPCSale,
  hasLinkedBuild,
  isPartSale,
  onEdit,
  onDelete,
  onDownloadInvoice,
  onRelistPart,
  onRelistBulkSale,
}) => {
  const isManagedViaBuilds = isPCSale && hasLinkedBuild;
  
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        {!isManagedViaBuilds && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
            className="bg-neutral-900 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            title="Edit Log Record"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Record
          </button>
        )}
        {(isPCSale || isPartSale) && (
          <button
            onClick={onDownloadInvoice}
            className="bg-neutral-900 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            title="Download Invoice PDF"
          >
            <FileText className="w-3.5 h-3.5" /> Invoice PDF
          </button>
        )}
        {isManagedViaBuilds && (
          <span className="text-[11px] text-neutral-500 italic">
            PC Sale managed via Builds &gt; Sold
          </span>
        )}
        {isPartSale && tx.bulkSaleGroupId && onRelistBulkSale ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRelistBulkSale(); }}
            className="bg-indigo-950/40 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-400/60 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            title="Relist entire bulk sale back into stock"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Relist Entire Bulk Sale
          </button>
        ) : isPartSale && onRelistPart && (
          <button
            onClick={(e) => { e.stopPropagation(); onRelistPart(tx); }}
            className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            title="Relist this part back into stock"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Relist Part
          </button>
        )}
      </div>

      {!isManagedViaBuilds && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
          className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          title="Delete Activity Log"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      )}
    </div>
  );
};
