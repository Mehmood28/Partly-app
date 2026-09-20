import React, { useState, useRef } from 'react';
import { PCBuild, PCBuildPart } from '../../types';
import { CheckCircle2, Clock, FileText, Pencil, Trash2, ChevronUp, ChevronDown, X, PlusCircle, Tag, DollarSign, Copy, ArrowRightLeft, Shield, Image as ImageIcon, Loader2, AlertCircle, Wrench, User, Calendar, MoreVertical } from 'lucide-react';
import { calculateBuildPartsCost, formatCurrency, formatReadableDate, getCategoryPresentation, getConditionDotColor } from '../../utils/helpers';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { executeCopyAdConfirmation } from '../../utils/copyAdHelper';
import { getBuildPresentation } from '../../utils/buildPresentation';
import { sortByCategory } from '../../utils/sorting';
import { useInventory } from '../../context/InventoryContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { SwapPartModal } from './SwapPartModal';
import { EditBuildPartQuantityModal } from './EditBuildPartQuantityModal';
import { BuildShareImageCard } from './BuildShareImageCard';
import { hasShareableBuildImage, shareBuildImageToDiscord } from './discordShareHelpers';
import { SoldBuildTransactionPanel } from './SoldBuildTransactionPanel';
import { normalizePlatform } from '../../utils/platformDisplay';
import { ConfirmModal } from '../ConfirmModal';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { canDeleteBuildDraft, canDismantleBuild, canPartOutAcquiredPC, canMoveToTradeIns } from '../../utils/buildEligibility';
import { resolveTransactionDate } from '../../utils/bulkSaleGrouping';
import { calculateProfitMarginPercent, formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';
import { resolveTradeInBuildOrigin } from '../../utils/tradeInOrigin';
import { getAcquiredPCBreakdown, isAcquiredPC, isPurchasedPC } from '../../utils/acquiredPC';

interface BuildCardProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  build: PCBuild;
  onEdit: (build: PCBuild) => void;
  onDelete: (build: PCBuild) => void;
  onDismantle?: (build: PCBuild) => void;
  onItemize?: (build: PCBuild) => void;
  onSell: (build: PCBuild) => void;
  onAllocate: (build: PCBuild) => void;
  updateStatus: (id: string, status: 'In Progress' | 'Listed for Sale' | 'Trade-In Processing') => void;
  removePart: (
    buildId: string,
    partId: string,
    purchaseEntryId?: string
  ) => { success: boolean; error?: string };
}

export const BuildCard: React.FC<BuildCardProps> = React.memo(({
  isExpanded: propIsExpanded,
  onToggle,
  build,
  onEdit,
  onDelete,
  onDismantle,
  onItemize,
  onSell,
  onAllocate,
  updateStatus,
  removePart,
}) => {
  const { state, relistBuild, updateBuild } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const [internalIsExpanded, setInternalIsExpanded] = useState<boolean>(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalIsExpanded;
  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalIsExpanded(!internalIsExpanded);
  };
  const [swapPartData, setSwapPartData] = useState<PCBuildPart | null>(null);
  const [quantityPartData, setQuantityPartData] = useState<PCBuildPart | null>(null);
  const [partActionsData, setPartActionsData] = useState<PCBuildPart | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirmation modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant?: 'danger' | 'emerald' | 'amber' | 'violet';
    onConfirm: () => void;
  } | null>(null);

  // Sharing states
  const [imageShareStatus, setImageShareStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isCopyAdModalOpen, setIsCopyAdModalOpen] = useState(false);
  const [copyAdWarrantyDays, setCopyAdWarrantyDays] = useState<string>('30');
  const [copyAdCustomWarranty, setCopyAdCustomWarranty] = useState<string>('');
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const imageCardRef = useRef<HTMLDivElement>(null);

  const partsCost = calculateBuildPartsCost(build);
  const isSold = build.status === 'Sold';
  const isTradeIn = build.acquisitionSource === 'Trade-In';
  const isPurchased = isPurchasedPC(build);
  const isAcquired = isAcquiredPC(build);
  const acquiredBreakdown = getAcquiredPCBreakdown(build);
  const hasBuildImage = hasShareableBuildImage(build);
  const tradeInOrigin = isTradeIn
    ? resolveTradeInBuildOrigin(build, state.transactions, state.builds)
    : null;
  const tradeInOriginDate = tradeInOrigin?.date
    ? formatReadableDate(tradeInOrigin.date) || tradeInOrigin.date
    : undefined;
  const purchaseDate = build.purchaseDate
    ? formatReadableDate(build.purchaseDate) || build.purchaseDate
    : undefined;

  const executeShareImageDiscord = async () => {
    if (!hasBuildImage) return;
    if (imageShareStatus === 'loading' || imageShareStatus === 'success') return;
    if (!imageCardRef.current) return;
    setImageShareStatus('loading');
    setImageShareError(null);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(imageCardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        skipFonts: true,
        fontEmbedCSS: '',
      });
      await shareBuildImageToDiscord(build.name, dataUrl);
      setImageShareStatus('success');
      setTimeout(() => {
        setImageShareStatus('idle');
      }, 3000);
    } catch (err: unknown) {
      setImageShareStatus('error');
      setImageShareError(err instanceof Error ? err.message : 'Failed to share image to Discord');
    }
  };

  const handleShareImageDiscord = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasBuildImage) return;
    if (imageShareStatus === 'loading' || imageShareStatus === 'success') return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Share Build Image?',
      message: `Render and share an image for "${build.name}"?`,
      confirmText: 'Share Image',
      variant: 'violet',
      onConfirm: () => {
        setConfirmModalConfig(null);
        executeShareImageDiscord();
      },
    });
  };

  const exactTransaction = React.useMemo(() => {
    if (!isSold) return null;
    const matches = state.transactions.filter(
      (tx) => tx.type === 'SALE' && tx.relatedComponentId === build.id
    );
    if (matches.length === 0) return null;
    return matches.slice().sort((a, b) => {
      const timeA = resolveTransactionDate(a)?.sortValue ?? 0;
      const timeB = resolveTransactionDate(b)?.sortValue ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    })[0];
  }, [isSold, state.transactions, build.id]);

  const displayedPrice = isSold
    ? (exactTransaction?.totalAmount ?? build.salePrice)
    : build.salePrice;
  const profit = (displayedPrice || 0) - partsCost;
  const profitMarginPercent = calculateProfitMarginPercent(profit, displayedPrice || 0);

  const handleCopyAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wDays = build.warrantyDays ?? 30;
    if ([30, 60, 90, 365].includes(wDays)) {
      setCopyAdWarrantyDays(String(wDays));
      setCopyAdCustomWarranty('');
    } else {
      setCopyAdWarrantyDays('Custom');
      setCopyAdCustomWarranty(String(wDays));
    }
    setIsCopyAdModalOpen(true);
  };

  const handleCopyAdConfirm = async () => {
    const presentation = getBuildPresentation(build, state.components);
    await executeCopyAdConfirmation({
      build,
      components: presentation.allComponents,
      copyAdWarrantyDays,
      copyAdCustomWarranty,
      updateBuild,
      showToast,
      setCopied,
      closeModal: () => setIsCopyAdModalOpen(false),
    });
  };

  const soldDate = exactTransaction?.dateSortable || exactTransaction?.timestamp || build.saleDate;
  const formattedSoldDate = soldDate ? formatReadableDate(soldDate) : null;
  const formattedBuiltDate = formatReadableDate(build.builtDate || build.completionDate || build.createdDate) || build.createdDate;
  const displayStatus = build.status === 'Listed for Sale'
    ? 'Available'
    : build.status === 'In Progress'
      ? 'Pending'
      : build.status === 'Trade-In Processing'
        ? 'Trade-In'
        : build.status;

  const openRemovePartConfirm = (part: PCBuildPart) => {
    setPartActionsData(null);
    setConfirmModalConfig({
      isOpen: true,
      title: 'Remove Allocated Part?',
      message: isSold
        ? `Remove "${part.componentName}" from sold build "${build.name}"? The part will return to loose stock and the recorded build cost and profit will be updated.`
        : `Remove "${part.componentName}" from "${build.name}"? The part will return to loose stock.`,
      confirmText: 'Remove Part',
      variant: 'danger',
      onConfirm: () => {
        setConfirmModalConfig(null);
        const result = removePart(build.id, part.componentId, part.purchaseEntryId);
        if (!result.success) {
          showToast(result.error || 'Failed to remove part from build.', 'error');
          return;
        }
        showToast(`Removed "${part.componentName}" from "${build.name}".`, 'success');
      },
    });
  };

  return (
    <div className={`app-panel build-card group relative flex flex-col transition-all duration-200 ${isExpanded ? 'border-white/20' : 'hover:border-[#B9EF68]/30'}`}>
      {!isExpanded && (
        <div className="build-header build-header-collapsed" onClick={handleToggle} role="button" tabIndex={0} aria-expanded={false} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}>
          {build.imageUrl ? (
            <img className="build-thumbnail" src={build.imageUrl} alt={build.name} />
          ) : (
            <div className="build-thumbnail build-thumbnail-placeholder" aria-hidden="true"><ImageIcon /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="build-collapsed-title-row">
              <h3>{build.name}</h3>
              {isSold && <time>{formattedSoldDate || 'Date N/A'}</time>}
            </div>
            <div className="build-summary build-summary-columns">
              <span><em>Cost</em><strong>{formatCurrency(partsCost)}</strong></span>
              <span><em>{isSold ? 'Sold' : 'Target'}</em><strong>{displayedPrice !== undefined ? formatCurrency(displayedPrice) : '—'}</strong></span>
              <span><em>Profit</em><strong className={getProfitTextColor(profit)}>{displayedPrice !== undefined ? formatSignedCurrency(profit) : '—'}</strong></span>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400" />
        </div>
      )}
      {isExpanded && (
        <div className="build-expanded space-y-4 px-3 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-5">
          <div className="build-overview">
            <div className="build-overview-copy">
              <button type="button" className="build-expanded-toggle" onClick={handleToggle} aria-label={`Collapse ${build.name}`}>
                <ChevronUp />
              </button>
              <h3 className="build-expanded-title">{build.name}</h3>
              <span className="build-status">{displayStatus}{isAcquired ? ` · ${isPurchased ? 'Purchased PC' : 'Trade-in PC'}` : ''}</span>
              <div className="build-finances">
                <div><span>Cost</span><strong>{formatCurrency(partsCost)}</strong></div>
                <div><span>{isSold ? 'Sold' : 'Target'}</span><strong>{displayedPrice !== undefined ? formatCurrency(displayedPrice) : '—'}</strong></div>
                <div><span>Profit</span><strong className={getProfitTextColor(profit)}>{displayedPrice !== undefined ? formatSignedCurrency(profit) : '—'}</strong></div>
              </div>
              <div className="build-date"><Calendar /><span>Built {formattedBuiltDate}</span>{isSold && <span>· {profitMarginPercent.toFixed(1)}% margin</span>}</div>
              <div className="build-action-bar">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(build); }}
                  className="app-button"
                  title="Edit Build Details"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {!isSold && isAcquired && onItemize && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onItemize(build); }}
                    className="app-button"
                    title={acquiredBreakdown.length > 0 ? 'Edit acquired PC component breakdown' : 'Itemize acquired PC into components'}
                  >
                    <FileText className="w-3.5 h-3.5" /> {acquiredBreakdown.length > 0 ? 'Edit Breakdown' : 'Itemize'}
                  </button>
                )}
                {!isSold && onDismantle && (isAcquired ? canPartOutAcquiredPC(build) : canDismantleBuild(build)) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDismantle(build); }}
                    className="app-button"
                    title={isAcquired ? 'Part out acquired PC into inventory parts' : 'Dismantle rig and return parts to stock'}
                  >
                    <Wrench className="w-3.5 h-3.5" /> {isAcquired ? 'Part Out' : 'Dismantle'}
                  </button>
                )}
                {isSold && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModalConfig({
                        isOpen: true,
                        title: 'Relist Build?',
                        message: `Relist "${build.name}" for sale? The build will return to available status, its sale transaction will be reversed, and its allocated parts will be preserved.`,
                        confirmText: 'Relist Build',
                        variant: 'emerald',
                        onConfirm: () => {
                          setConfirmModalConfig(null);
                          const result = relistBuild(build.id);
                          if (!result.success) {
                            showToast(result.error || 'Failed to relist build.', 'error');
                          } else {
                            showToast(`Relisted "${build.name}" for sale!`);
                          }
                        },
                      });
                    }}
                    className="app-button"
                    title="Relist Build"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Relist
                  </button>
                )}
                {canDeleteBuildDraft(build) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(build); }}
                    className="app-button app-button-danger"
                    title="Delete empty draft build"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Draft
                  </button>
                )}
                {isSold && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSell(build); }}
                      className="app-button"
                      title="Edit Sale Details"
                    >
                      <Tag className="w-3.5 h-3.5" /> Edit Sale
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModalConfig({
                          isOpen: true,
                          title: 'Download Invoice?',
                          message: `Generate and download a PDF invoice for "${build.name}"?`,
                          confirmText: 'Download Invoice',
                          variant: 'violet',
                          onConfirm: () => {
                            setConfirmModalConfig(null);
                            generateInvoice(build, state.components);
                          },
                        });
                      }}
                      className="app-button"
                      title="Download Invoice PDF"
                    >
                      <FileText className="w-3.5 h-3.5" /> Invoice
                    </button>
                  </>
                )}
                {!isSold && (
                  <button
                    onClick={handleCopyAdClick}
                    className="app-button"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Ad'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareImageDiscord}
                  disabled={!hasBuildImage || imageShareStatus === 'loading' || imageShareStatus === 'success'}
                  className={`app-button ${
                    !hasBuildImage
                      ? 'border-white/[0.05] text-zinc-600 bg-[#0B1113]/60 cursor-not-allowed opacity-60'
                      : imageShareStatus === 'success'
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 cursor-default'
                      : imageShareStatus === 'error'
                      ? 'border-rose-500/40 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                      : 'border-white/[0.08] text-zinc-200 bg-[#0B1113] hover:border-[#B9EF68]/40'
                  }`}
                  title={
                    !hasBuildImage
                      ? 'Add a build image to enable sharing'
                      : imageShareError || 'Share build as rendered image to Discord'
                  }
                >
                  {imageShareStatus === 'loading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B9EF68]" />
                  ) : imageShareStatus === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  {imageShareStatus === 'loading'
                    ? 'Rendering...'
                    : imageShareStatus === 'success'
                    ? 'Shared!'
                    : 'Share Image'}
                </button>
              </div>
            </div>
            {build.imageUrl ? (
              <img src={build.imageUrl} alt={build.name} />
            ) : (
              <div className="build-hero-placeholder"><ImageIcon /></div>
            )}
          </div>

          <div className="space-y-3">
            {imageShareError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{imageShareError}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageShareError(null);
                    setImageShareStatus('idle');
                  }}
                  className="text-rose-400 hover:text-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {isTradeIn && tradeInOrigin && (tradeInOrigin.buyerName || tradeInOriginDate) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0B1113] p-2.5 rounded-xl border border-white/[0.08] min-w-0">
                <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-300 shrink-0" /> Traded In By
                </div>
                <div className="text-zinc-200 font-medium truncate text-xs">
                  {tradeInOrigin.buyerName || 'N/A'}
                </div>
              </div>
              <div className="bg-[#0B1113] p-2.5 rounded-xl border border-white/[0.08] min-w-0">
                <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-300 shrink-0" /> Trade-In Date
                </div>
                <div className="text-zinc-200 font-medium truncate font-mono text-xs">
                  {tradeInOriginDate || 'N/A'}
                </div>
              </div>
            </div>
          )}

          {isPurchased && (build.purchaseSeller || purchaseDate) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0B1113] p-2.5 rounded-xl border border-white/[0.08] min-w-0">
                <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-300 shrink-0" /> Purchased From
                </div>
                <div className="text-zinc-200 font-medium truncate text-xs">
                  {build.purchaseSeller || 'Not recorded'}
                </div>
              </div>
              <div className="bg-[#0B1113] p-2.5 rounded-xl border border-white/[0.08] min-w-0">
                <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-300 shrink-0" /> Purchase Date
                </div>
                <div className="text-zinc-200 font-medium truncate font-mono text-xs">
                  {purchaseDate || 'Not recorded'}
                </div>
              </div>
            </div>
          )}

          {/* Sold-Build Full Transaction & Financials Panel */}
          {isSold && (
            <SoldBuildTransactionPanel
              build={build}
              transaction={exactTransaction}
            />
          )}

          {/* Full Allocated Parts List */}
          <div className="space-y-2 pt-1">
            {build.notes && (
              <div className="app-panel-quiet p-3 text-xs italic leading-relaxed text-zinc-400">
                {build.notes}
              </div>
            )}

            {isAcquired && acquiredBreakdown.length > 0 && (
              <div className="app-ledger">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5">
                  <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                    {isPurchased ? 'PURCHASED PC' : 'TRADE-IN'} COMPONENTS · {acquiredBreakdown.length} items
                  </span>
                  <span className="font-mono text-xs font-semibold text-zinc-200 whitespace-nowrap">
                    {formatCurrency(acquiredBreakdown.reduce((sum, p) => sum + p.quantity * p.unitCost, 0))}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {sortByCategory(acquiredBreakdown).map((part, idx) => {
                    const category = getCategoryPresentation(part.category);
                    const totalCost = part.quantity * part.unitCost;
                    return (
                      <div key={part.id || idx} className="relative px-3 py-2.5 pr-4 text-xs">

                        <div className="allocated-part-main">
                          <span className={`w-[3.8rem] shrink-0 pt-0.5 font-mono text-[11px] font-bold tracking-wide ${category.textClass}`}>
                            {category.label}
                          </span>
                          <span className="min-w-0 flex-1 font-medium leading-snug text-zinc-200 break-words">{part.name}</span>
                          <span className="shrink-0 font-mono text-xs font-bold text-zinc-100 whitespace-nowrap">
                            {formatCurrency(totalCost)}
                          </span>
                        </div>
                        <div className="ml-[4.3rem] mt-1 font-mono text-[11px] leading-snug text-zinc-500">
                          {part.quantity > 1 ? `${part.quantity} × ${formatCurrency(part.unitCost)} each` : 'Base component'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="app-ledger">
              <div className="parts-heading">
                <span className="">
                  Allocated Parts · {build.parts.length} items
                </span>
                <span className="whitespace-nowrap font-mono text-[11px] font-bold text-[#83E5DF] sm:text-xs">
                  Build Cost {formatCurrency(partsCost)}
                </span>
              </div>
              {build.parts.length === 0 ? (
                <div className="px-3 py-3 text-xs text-zinc-500 italic">
                  {isAcquired && acquiredBreakdown.length > 0
                    ? 'No stock upgrades allocated.'
                    : 'No components assigned yet.'}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {sortByCategory(build.parts).map((part, partIdx) => {
                    const comp = state.components.find((c) => c.id === part.componentId);
                    let purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);
                    if (!purchaseEntry && comp?.purchaseHistory?.length) {
                      purchaseEntry = comp.purchaseHistory.find((pe) => pe.unitPrice === part.unitCostAtAssignment) || comp.purchaseHistory[0];
                    }
                    const category = getCategoryPresentation(part.category);
                    // Assignment cost is immutable, so every row total always reconciles to Build Cost.
                    const unitCost = part.unitCostAtAssignment;
                    const totalCost = unitCost * part.quantity;
                    const metadata = [
                      purchaseEntry?.condition,
                      !hideSupplierNames && purchaseEntry?.platform ? normalizePlatform(String(purchaseEntry.platform)) : undefined,
                      purchaseEntry?.paymentMethod ? String(purchaseEntry.paymentMethod) : undefined,
                      purchaseEntry?.date ? formatReadableDate(purchaseEntry.date) || purchaseEntry.date : undefined,
                    ].filter(Boolean) as string[];

                    return (
                      <div
                        key={`${part.componentId}-${part.purchaseEntryId || partIdx}-${part.unitCostAtAssignment}`}
                        className="allocated-part"
                      >

                        <div className="allocated-part-main">
                          <span className={`allocated-type ${category.textClass}`}>
                            {category.label}
                          </span>
                          <span className="allocated-name">{part.componentName}</span>
                          <span className="allocated-cost">{formatCurrency(totalCost)}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPartActionsData(part); }}
                            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
                            title={`Actions for ${part.componentName}`}
                            aria-label={`Actions for ${part.componentName}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="allocated-meta">
                          {purchaseEntry?.condition && <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(purchaseEntry.condition)}`} />{purchaseEntry.condition}</span>}
                          {metadata.slice(purchaseEntry?.condition ? 1 : 0).map((item, index) => <span key={`${item}-${index}`}>· {item}</span>)}
                          {part.quantity > 1 && <span>· {part.quantity} × {formatCurrency(unitCost)} each</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isSold && (
            <div className="border-t border-white/[0.08] pt-3">
              <button
                onClick={(e) => { e.stopPropagation(); onAllocate(build); }}
                className="app-button flex w-full items-center justify-center gap-1.5 px-3"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#B9EF68]" /> Add Part
              </button>
            </div>
          )}

          {/* Primary build workflow actions. Financials live only in the hero above. */}
          {!isSold && (
            <div className="border-t border-white/[0.08] pt-3">
              <div className="build-workflow-actions grid grid-cols-3 gap-2 pt-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onAllocate(build); }}
                  className="app-button flex items-center justify-center gap-1.5 px-3"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#B9EF68]" /> Add Part
                </button>
                {build.status === 'Listed for Sale' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModalConfig({
                        isOpen: true,
                        title: 'Mark as Pending Sale?',
                        message: `Mark "${build.name}" as pending sale?`,
                        confirmText: 'Mark Pending',
                        variant: 'violet',
                        onConfirm: () => {
                          setConfirmModalConfig(null);
                          updateStatus(build.id, 'In Progress');
                        },
                      });
                    }}
                    className="app-button flex items-center justify-center gap-1 px-3 text-[#9FF8F4]"
                    title="Mark build as Pending Sale"
                  >
                    <Clock className="w-3.5 h-3.5" /> Mark Pending
                  </button>
                )}
                {build.status === 'In Progress' && (
                  <>
                    {canMoveToTradeIns(build) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(build.id, 'Trade-In Processing');
                          showToast(`Moved "${build.name}" to Trade-Ins`);
                        }}
                        className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/15 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
                        title="Move legacy trade-in build to Trade-Ins"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Move to Trade-Ins
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModalConfig({
                            isOpen: true,
                            title: 'Mark Build Available?',
                            message: `Mark "${build.name}" as available for sale?`,
                            confirmText: 'Mark Available',
                            variant: 'violet',
                            onConfirm: () => {
                              setConfirmModalConfig(null);
                              updateStatus(build.id, 'Listed for Sale');
                            },
                          });
                        }}
                        className="bg-[#B9EF68]/15 border border-[#B9EF68]/30 text-[#83E5DF] hover:bg-[#B9EF68]/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
                        title="Mark build as Available"
                      >
                        <Tag className="w-3.5 h-3.5" /> Mark Available
                      </button>
                    )}
                  </>
                )}
                {build.status === 'Trade-In Processing' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModalConfig({
                        isOpen: true,
                        title: 'List Trade-In For Sale?',
                        message: `List "${build.name}" as available for sale?`,
                        confirmText: 'List for Sale',
                        variant: 'violet',
                        onConfirm: () => {
                          setConfirmModalConfig(null);
                          updateStatus(build.id, 'Listed for Sale');
                        },
                      });
                    }}
                    className="bg-[#B9EF68]/15 border border-[#B9EF68]/30 text-[#83E5DF] hover:bg-[#B9EF68]/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
                    title="List trade-in PC for sale"
                  >
                    <Tag className="w-3.5 h-3.5" /> List For Sale
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSell(build); }}
                  className="app-button flex items-center justify-center gap-1 border-emerald-500/35 bg-emerald-500/10 px-3 text-emerald-300 hover:bg-emerald-500/20"
                >
                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" /> Mark Sold
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {swapPartData && (
        <SwapPartModal
          build={build}
          currentPart={swapPartData}
          onClose={() => setSwapPartData(null)}
        />
      )}
      {quantityPartData && (
        <EditBuildPartQuantityModal
          build={build}
          part={quantityPartData}
          onClose={() => setQuantityPartData(null)}
        />
      )}

      {partActionsData && (
        <BottomSheetModal
          isOpen={Boolean(partActionsData)}
          onClose={() => setPartActionsData(null)}
          className="build-modal stock-modal max-w-sm"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="min-w-0">
                <div className={`font-mono text-[11px] font-bold uppercase tracking-wider ${getCategoryPresentation(partActionsData.category).textClass}`}>
                  {getCategoryPresentation(partActionsData.category).label}
                </div>
                <h3 className="mt-1 break-words text-sm font-semibold text-zinc-100">{partActionsData.componentName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPartActionsData(null)}
                aria-label="Close part actions"
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => { setSwapPartData(partActionsData); setPartActionsData(null); }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#101719] px-3 text-left text-xs font-medium text-zinc-200 transition-colors hover:border-[#B9EF68]/40 hover:text-white"
              >
                <ArrowRightLeft className="h-4 w-4 text-[#83E5DF]" /> Swap part
              </button>
              <button
                type="button"
                onClick={() => { setQuantityPartData(partActionsData); setPartActionsData(null); }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#101719] px-3 text-left text-xs font-medium text-zinc-200 transition-colors hover:border-[#B9EF68]/40 hover:text-white"
              >
                <Pencil className="h-4 w-4 text-[#83E5DF]" /> Change quantity
              </button>
              <button
                type="button"
                onClick={() => openRemovePartConfirm(partActionsData)}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 text-left text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <Trash2 className="h-4 w-4" /> Remove from build
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* Confirmation Modal */}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          variant={confirmModalConfig.variant || 'violet'}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig(null)}
        />
      )}

      {/* Copy Ad Warranty Modal */}
      {isCopyAdModalOpen && (
        <BottomSheetModal
          isOpen={isCopyAdModalOpen}
          onClose={() => setIsCopyAdModalOpen(false)}
          className="build-modal stock-modal max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#B9EF68]" /> Copy Marketplace Ad
              </h3>
              <button
                type="button"
                onClick={() => setIsCopyAdModalOpen(false)}
                aria-label="Close modal"
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Select or customize the warranty duration to include in the generated marketplace listing.
              </p>

              <div className="space-y-2">
                <label className="block text-zinc-300 font-medium text-xs">Warranty Duration</label>

                {/* 2-column grid for preset buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: '30', label: '30 Days' },
                    { value: '60', label: '60 Days' },
                    { value: '90', label: '90 Days' },
                    { value: '365', label: '1 Year' },
                  ].map((preset) => {
                    const isSelected = copyAdWarrantyDays === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCopyAdWarrantyDays(preset.value)}
                        aria-pressed={isSelected}
                        className={`min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                          isSelected
                            ? 'bg-[#B9EF68] text-[#07100B] border border-[#B9EF68] shadow-sm shadow-[#B9EF68]/25 font-semibold'
                            : 'bg-[#101719] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Full-width Custom button */}
                <button
                  type="button"
                  onClick={() => setCopyAdWarrantyDays('Custom')}
                  aria-pressed={copyAdWarrantyDays === 'Custom'}
                  className={`w-full min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68] ${
                    copyAdWarrantyDays === 'Custom'
                      ? 'bg-[#B9EF68] text-[#07100B] border border-[#B9EF68] shadow-sm shadow-[#B9EF68]/25 font-semibold'
                      : 'bg-[#101719] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
                  }`}
                >
                  Custom
                </button>

                {/* Positive whole-number input directly below Custom button */}
                {copyAdWarrantyDays === 'Custom' && (
                  <div className="pt-1">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={copyAdCustomWarranty}
                      onChange={(e) => setCopyAdCustomWarranty(e.target.value)}
                      className="w-full min-h-[44px] h-11 bg-[#101719] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#B9EF68] focus:ring-1 focus:ring-[#B9EF68]/40 transition-colors font-mono"
                      placeholder="Enter warranty days (e.g. 14, 45, 180)"
                      aria-label="Custom warranty days"
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsCopyAdModalOpen(false)}
                className="min-h-[44px] px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyAdConfirm}
                className="min-h-[44px] bg-[#B9EF68] hover:bg-[#C4FF79] text-[#07100B] font-semibold shadow-md shadow-[#B9EF68]/20 px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9EF68]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Ad
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* Off-screen card used for HTML-to-Image rendering */}
      {hasBuildImage && (
        <div
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            zIndex: -9999,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <BuildShareImageCard ref={imageCardRef} build={build} components={state.components} />
        </div>
      )}
    </div>
  );
});
