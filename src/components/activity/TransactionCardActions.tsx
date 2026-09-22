import React from 'react';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { TransactionLogItem } from '../../types';

interface TransactionCardActionsProps {
  tx: TransactionLogItem;
  isPartSale: boolean;
  onEdit: (tx: TransactionLogItem) => void;
  onDelete: (id: string) => void;
  onRelistPart?: (tx: TransactionLogItem) => void;
  onRelistBulkSale?: () => void;
}

export const TransactionCardActions: React.FC<TransactionCardActionsProps> = ({
  tx,
  isPartSale,
  onEdit,
  onDelete,
  onRelistPart,
  onRelistBulkSale,
}) => (
    <div className="record-actions">
      <div className="contents">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
          className="app-button flex items-center justify-center gap-1.5 px-2"
          title="Edit Log Record"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit Record
        </button>
        {isPartSale && tx.bulkSaleGroupId && onRelistBulkSale ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRelistBulkSale(); }}
            className="app-button flex items-center justify-center gap-1.5 px-2 text-[#9FF8F4]"
            title="Relist entire bulk sale back into stock"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Relist Entire Bulk Sale
          </button>
        ) : isPartSale && onRelistPart && (
          <button
            onClick={(e) => { e.stopPropagation(); onRelistPart(tx); }}
            className="app-button flex items-center justify-center gap-1.5 border-emerald-500/35 bg-emerald-500/10 px-2 text-emerald-400 hover:bg-emerald-500/20"
            title="Relist this part back into stock"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Relist Part
          </button>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
        className="app-button app-button-danger flex items-center justify-center gap-1.5 px-2"
        title="Delete Activity Log"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
);
