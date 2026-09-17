import React, { useState, useMemo, useEffect } from 'react';
import { PCBuild, ComponentCategory } from '../../../types';
import { calculateBuildPartsCost } from '../../../utils/helpers';
import { validatePartOutAccounting } from '../../../utils/buildEligibility';
import { X, Wrench, AlertTriangle } from 'lucide-react';
import { BottomSheetModal } from '../../ui/BottomSheetModal';
import { 
  createInitialParts, 
  ExtractedPartInput, 
  allocateOptionalPartCosts,
} from './dismantleHelpers';
import { ModeAKnownParts } from './ModeAKnownParts';
import { ModeBStatusHeader } from './ModeBStatusHeader';
import { ModeBManualEntry } from './ModeBManualEntry';
import { getAcquiredPCBreakdown, getAcquiredPCLabel, isAcquiredPC } from '../../../utils/acquiredPC';

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
      const breakdown = getAcquiredPCBreakdown(build);
      if (breakdown.length > 0) {
        setManualParts(breakdown.map(p => ({
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
  const isAcquired = isAcquiredPC(build);
  const isModeA = !isAcquired && Boolean(build?.parts && build.parts.length > 0);
  const targetCost = build
    ? isAcquired
      ? build.estimatedCost || 0
      : build.estimatedCost || (isModeA ? calculateBuildPartsCost(build) : 0)
    : 0;

  const activeParts = useMemo(
    () => manualParts.filter((part) => part.name.trim().length > 0),
    [manualParts]
  );

  const totalAllocated = useMemo(() => {
    return activeParts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitCost) || 0), 0);
  }, [activeParts]);

  const remainingBalance = targetCost - totalAllocated;
  const isExactMatch = Math.abs(remainingBalance) < 0.009;
  const hasValidNames = activeParts.every((p) => p.quantity > 0 && p.unitCost >= 0);
  
  const partOutValidation = useMemo(() => {
    if (!build || !isAcquired) return { valid: true };
    const extracted = activeParts.map((p) => ({
      category: p.category,
      name: p.name,
      quantity: Number(p.quantity) || 0,
      unitCost: Number(p.unitCost) || 0,
    }));
    return validatePartOutAccounting(build, extracted);
  }, [build, isAcquired, activeParts]);

  const canConfirmModeB = activeParts.length > 0 && (isAcquired ? partOutValidation.valid : (isExactMatch && hasValidNames));

  const lockedParts = useMemo(() => activeParts.filter((p) => p.isLocked), [activeParts]);
  const unlockedParts = useMemo(() => activeParts.filter((p) => !p.isLocked), [activeParts]);

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
    const result = allocateOptionalPartCosts(manualParts, targetCost);
    if (!result.success) return;
    const allocatedById = new Map(result.parts.map((part) => [part.id, part.unitCost]));
    setManualParts((prev) => prev.map((part) =>
      allocatedById.has(part.id)
        ? { ...part, unitCost: allocatedById.get(part.id) || 0 }
        : part
    ));
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
      const extracted = activeParts.map((p) => ({
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
      <div className="flex flex-col h-full w-full bg-[#070A0B] text-zinc-100 select-none">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/[0.08] shrink-0 bg-[#0B1113]/95 backdrop-blur-md z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2 truncate font-display">
                  <span className="truncate">{isAcquired ? `Part Out ${getAcquiredPCLabel(build)}` : 'Dismantle PC Build'}</span>
                  {isAcquired && (
                    <span className="bg-[#A8FF3E]/15 text-[#62E6E6] border border-[#A8FF3E]/30 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium shrink-0">
                      {isTradeIn ? 'TRADE-IN' : 'PURCHASED'}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-zinc-400 truncate font-sans">{build.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isAcquired && build.parts && build.parts.length > 0 && (
            <div className="mt-2 text-xs text-[#9FF8F4] bg-[#62E6E6]/[0.06] border border-[#62E6E6]/25 rounded-xl p-2.5">
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
              optionalRows={isAcquired}
              heading={isAcquired ? 'Components to Add to Stock' : 'Itemize Components'}
            />
          )}
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-white/[0.08] shrink-0 bg-[#0B1113]/95 backdrop-blur-md flex flex-col gap-3 z-30">
          {!isModeA && isAcquired && !partOutValidation.valid && activeParts.length > 0 && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{partOutValidation.error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E]"
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
              {isAcquired ? 'Confirm Part-Out' : 'Confirm Dismantle'}
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
};
