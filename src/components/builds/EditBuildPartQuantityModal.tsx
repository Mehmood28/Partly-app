import React, { useMemo, useState } from 'react';
import { Hash, X } from 'lucide-react';
import { PCBuild, PCBuildPart } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { getPurchaseEntryRemainingQuantity } from '../../utils/helpers';
import { BottomSheetModal } from '../ui/BottomSheetModal';

interface EditBuildPartQuantityModalProps {
  build: PCBuild;
  part: PCBuildPart;
  isOpen?: boolean;
  onClose: () => void;
}

export const EditBuildPartQuantityModal: React.FC<EditBuildPartQuantityModalProps> = ({
  build,
  part,
  isOpen = true,
  onClose,
}) => {
  const { state, updateBuildPartQuantity } = useInventory();
  const { showToast } = useToast();
  const [quantityInput, setQuantityInput] = useState(String(part.quantity));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const exactBatchAvailability = useMemo(() => {
    if (!part.purchaseEntryId) return null;
    const component = state.components.find((candidate) => candidate.id === part.componentId);
    if (!component) return null;
    const batchExists = (component.purchaseHistory || []).some(
      (entry) => entry.id === part.purchaseEntryId
    );
    if (!batchExists) return null;
    return getPurchaseEntryRemainingQuantity(component, part.purchaseEntryId, state.builds);
  }, [part.componentId, part.purchaseEntryId, state.builds, state.components]);

  const maximumQuantity = exactBatchAvailability === null
    ? part.quantity
    : part.quantity + exactBatchAvailability;
  const parsedQuantity = Number(quantityInput);
  const isValidQuantity =
    Number.isFinite(parsedQuantity) &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity > 0;
  const isUnchanged = isValidQuantity && parsedQuantity === part.quantity;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!isValidQuantity) {
      setErrorMessage('Quantity must be a positive whole number.');
      return;
    }
    if (parsedQuantity > maximumQuantity) {
      setErrorMessage(`Only ${maximumQuantity} total units are available from this batch.`);
      return;
    }
    if (isUnchanged) {
      onClose();
      return;
    }

    const result = updateBuildPartQuantity(
      build.id,
      part.componentId,
      part.purchaseEntryId,
      parsedQuantity
    );
    if (!result.success) {
      const message = result.error || 'Failed to change part quantity.';
      setErrorMessage(message);
      showToast(message, 'error');
      return;
    }

    showToast(
      `Changed "${part.componentName}" from ${part.quantity} to ${parsedQuantity} in "${build.name}".`,
      'success'
    );
    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} className="build-modal stock-modal max-w-sm">
      <form className="space-y-4 w-full" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#B9EF68]" /> Change Part Quantity
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quantity editor"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <div className="text-xs font-semibold text-zinc-100 break-words">
            {part.componentName}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Current quantity: {part.quantity}
          </div>
        </div>

        {build.status === 'Sold' && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
            This sold-build correction will update loose stock, recorded build cost, and sale profit together.
          </div>
        )}

        <div>
          <label htmlFor="build-part-quantity" className="block text-zinc-300 font-medium mb-1.5 text-xs">
            Quantity
          </label>
          <input
            id="build-part-quantity"
            type="number"
            inputMode="numeric"
            min="1"
            max={maximumQuantity}
            step="1"
            autoFocus
            value={quantityInput}
            onChange={(event) => {
              setQuantityInput(event.target.value);
              setErrorMessage(null);
            }}
            className="w-full h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors"
          />
          <p className="text-[11px] text-zinc-500 mt-1.5">
            {exactBatchAvailability === null
              ? 'This legacy allocation can be reduced, but it cannot be increased without an exact purchase batch.'
              : `${exactBatchAvailability} additional ${exactBatchAvailability === 1 ? 'unit is' : 'units are'} available from this exact batch.`}
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValidQuantity || isUnchanged}
            className="bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold shadow-md shadow-[#B9EF68]/20 px-4 py-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Quantity
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
};
