import React, { useState, useMemo, useEffect } from 'react';
import { PCBuild, ComponentCategory } from '../../../types';
import { calculateBuildPartsCost } from '../../../utils/helpers';
import { validatePartOutAccounting } from '../../../utils/buildEligibility';
import { X, Wrench, AlertTriangle } from 'lucide-react';
import { BottomSheetModal } from '../../ui/BottomSheetModal';
import { 
  createInitialParts, 
  ExtractedPartInput, 
  CATEGORY_WEIGHTS 
} from './dismantleHelpers';
import { ModeAKnownParts } from './ModeAKnownParts';
import { ModeBStatusHeader } from './ModeBStatusHeader';
import { ModeBManualEntry } from './ModeBManualEntry';

interface DismantleRigModalProps {
  build: PCBuild | null;
  onClose: () => void;
  onConfirm: (
    buildId: string,
    extractedParts: { id?: string; category: ComponentCategory; name: string; quantity: number; unitCost: number; tags?: string[] }[]
  ) => void;
}

export const DismantleRigModal: React.FC<DismantleRigModalProps> = ({ build, onClose, onConfirm }) => {
  const [manualParts, setManualParts] = useState<ExtractedPartInput[]>(() => createInitialParts());

  useEffect(() => {
    if (build) {
      if (build.acquisitionSource === 'Trade-In' && build.tradeInComponentBreakdown && build.tradeInComponentBreakdown.length > 0) {
        setManualParts(build.tradeInComponentBreakdown.map(p => ({
          id: p.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          category: p.category,
          name: p.name,
          quantity: p.quantity,
          unitCost: p.unitCost,
          isLocked: true,
          tags: p.tags && p.tags.length > 0 ? [...p.tags] : undefined,
        })));
      } else {
        setManualParts(createInitialParts());
      }
    }
  }, [build?.id]);

  const isTradeIn = build?.acquisitionSource === 'Trade-In';
  const isModeA = !isTradeIn && Boolean(build?.parts && build.parts.length > 0);
  const targetCost = build
    ? isTradeIn
      ? build.estimatedCost || 0
      : build.estimatedCost || (isModeA ? calculateBuildPartsCost(build) : 0)
    : 0;

  const totalAllocated = useMemo(() => {
    return manualParts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitCost) || 0), 0);
  }, [manualParts]);

  const remainingBalance = targetCost - totalAllocated;
  const isExactMatch = Math.abs(remainingBalance) < 0.009;
  const hasValidNames = manualParts.every((p) => p.name.trim().length > 0 && p.quantity > 0 && p.unitCost >= 0);
  
  const partOutValidation = useMemo(() => {
    if (!build || !isTradeIn) return { valid: true };
    const extracted = manualParts.map((p) => ({
      category: p.category,
      name: p.name,
      quantity: Number(p.quantity) || 0,
      unitCost: Number(p.unitCost) || 0,
    }));
    return validatePartOutAccounting(build, extracted);
  }, [build, isTradeIn, manualParts]);

  const canConfirmModeB = manualParts.length > 0 && (isTradeIn ? partOutValidation.valid : (isExactMatch && hasValidNames));

  const lockedParts = useMemo(() => manualParts.filter((p) => p.isLocked), [manualParts]);
  const unlockedParts = useMemo(() => manualParts.filter((p) => !p.isLocked), [manualParts]);

  const lockedNamesSummary = useMemo(() => {
    if (lockedParts.length === 0) return '';
    const names = lockedParts.map((p) => p.name.trim() || p.category);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }, [lockedParts]);

  if (!build) return null;

  const handleAddPart = () => {
    setManualParts((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        category: 'Fans',
        name: '',
        quantity: 1,
        unitCost: 0,
        isLocked: false,
        tags: [],
      },
    ]);
  };

  const handleRemovePart = (id: string) => {
    setManualParts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePart = (id: string, updates: Partial<ExtractedPartInput>) => {
    setManualParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleToggleLock = (id: string) => {
    setManualParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isLocked: !p.isLocked } : p))
    );
  };

  const handleAutoDistribute = () => {
    if (manualParts.length === 0 || targetCost <= 0) return;

    const locked = manualParts.filter((p) => p.isLocked);
    const unlocked = manualParts.filter((p) => !p.isLocked);

    if (unlocked.length === 0) return;

    const lockedTotal = locked.reduce(
      (sum, p) => sum + (Number(p.quantity) || 1) * (Number(p.unitCost) || 0),
      0
    );

    const availableBudget = targetCost - lockedTotal;
    const allocatedMap = new Map<string, number>();

    if (availableBudget <= 0) {
      unlocked.forEach((p) => allocatedMap.set(p.id, 0));
    } else {
      const totalWeight = unlocked.reduce(
        (sum, p) => sum + (CATEGORY_WEIGHTS[p.category] ?? 0.02),
        0
      );

      const targetCents = Math.round(availableBudget * 100);
      let allocatedCents = 0;

      let highestWeightItemId = unlocked[0].id;
      let maxWeight = -1;

      unlocked.forEach((p) => {
        const w = CATEGORY_WEIGHTS[p.category] ?? 0.02;
        if (w > maxWeight) {
          maxWeight = w;
          highestWeightItemId = p.id;
        }
        const qty = Math.max(1, Number(p.quantity) || 1);
        const lineCents = (w / totalWeight) * targetCents;
        const unitCents = Math.round(lineCents / qty);
        const actualLineCents = unitCents * qty;

        allocatedCents += actualLineCents;
        allocatedMap.set(p.id, unitCents / 100);
      });

      const diffCents = targetCents - allocatedCents;
      if (diffCents !== 0) {
        const topItem = unlocked.find((p) => p.id === highestWeightItemId) || unlocked[0];
        const qty = Math.max(1, Number(topItem.quantity) || 1);
        const currentUnit = allocatedMap.get(topItem.id) || 0;

        const adjustedUnit = Math.round(currentUnit * 100 + diffCents / qty) / 100;
        allocatedMap.set(topItem.id, Math.max(0, adjustedUnit));

        const currentSumCents = unlocked.reduce((sum, p) => {
          const q = Math.max(1, Number(p.quantity) || 1);
          const u = allocatedMap.get(p.id) ?? 0;
          return sum + Math.round(q * u * 100);
        }, 0);

        const finalDiff = targetCents - currentSumCents;
        if (finalDiff !== 0) {
          const singleItem = unlocked.find((p) => (Number(p.quantity) || 1) === 1) || topItem;
          const currentVal = allocatedMap.get(singleItem.id) || 0;
          allocatedMap.set(
            singleItem.id,
            Math.max(0, Math.round(currentVal * 100 + finalDiff) / 100)
          );
        }
      }
    }

    setManualParts((prev) =>
      prev.map((p) => {
        if (allocatedMap.has(p.id)) {
          return {
            ...p,
            unitCost: allocatedMap.get(p.id) ?? 0,
          };
        }
        return p;
      })
    );
  };

  const handleConfirm = () => {
    if (isModeA) {
      const extracted = build.parts.map((p) => ({
        category: p.category,
        name: p.componentName,
        quantity: p.quantity,
        unitCost: p.unitCostAtAssignment,
      }));
      onConfirm(build.id, extracted);
    } else {
      if (!canConfirmModeB) return;
      const extracted = manualParts.map((p) => ({
        id: p.id,
        category: p.category,
        name: p.name.trim(),
        quantity: Number(p.quantity) || 1,
        unitCost: Number(p.unitCost) || 0,
        tags: (p.tags && p.tags.length > 0) ? p.tags : undefined,
      }));
      onConfirm(build.id, extracted);
    }
  };

  return (
    <BottomSheetModal
      isOpen={!!build}
      onClose={onClose}
      className="w-full max-w-2xl h-[90vh] !max-h-[90vh] !p-0 !overflow-hidden"
    >
      <div className="flex flex-col h-full w-full bg-[#090B10] text-zinc-100 select-none">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/[0.08] shrink-0 bg-[#0D1118]/95 backdrop-blur-md z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2 truncate font-display">
                  <span className="truncate">{isTradeIn ? 'Part Out Traded-In PC' : 'Dismantle PC Build'}</span>
                  {build.acquisitionSource === 'Trade-In' && (
                    <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium shrink-0">
                      TRADE-IN
                    </span>
                  )}
                </h2>
                <p className="text-xs text-zinc-400 truncate font-sans">{build.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isTradeIn && build.parts && build.parts.length > 0 && (
            <div className="mt-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2.5">
              Notice: {build.parts.length} allocated upgrade component(s) will automatically return to their original inventory batches upon parting out.
            </div>
          )}

          {!isModeA && (
            <ModeBStatusHeader
              targetCost={targetCost}
              totalAllocated={totalAllocated}
              remainingBalance={remainingBalance}
              isExactMatch={isExactMatch}
              lockedParts={lockedParts}
              unlockedParts={unlockedParts}
              lockedNamesSummary={lockedNamesSummary}
              handleAutoDistribute={handleAutoDistribute}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-3.5 space-y-3">
          {isModeA ? (
            <ModeAKnownParts build={build} />
          ) : (
            <ModeBManualEntry
              manualParts={manualParts}
              lockedParts={lockedParts}
              handleAddPart={handleAddPart}
              handleRemovePart={handleRemovePart}
              handleUpdatePart={handleUpdatePart}
              handleToggleLock={handleToggleLock}
            />
          )}
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-white/[0.08] shrink-0 bg-[#0D1118]/95 backdrop-blur-md flex flex-col gap-3 z-30">
          {!isModeA && isTradeIn && !partOutValidation.valid && manualParts.length > 0 && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{partOutValidation.error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isModeA && !canConfirmModeB}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isModeA || canConfirmModeB
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 cursor-pointer'
                  : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06] cursor-not-allowed'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              {isTradeIn ? 'Confirm Part-Out' : 'Confirm Dismantle'}
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
