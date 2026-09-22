import React, { useState, useRef, useEffect } from 'react';
import { PCBuild, PCBuildPart } from '../../types';
import { CheckCircle2, Clock, FileText, Pencil, Trash2, ChevronUp, ChevronDown, X, PlusCircle, Tag, DollarSign, Copy, ArrowRightLeft, Image as ImageIcon, Loader2, AlertCircle, Wrench, User, Calendar, List, MoreVertical } from 'lucide-react';
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
import { canDeleteBuildDraft, canDismantleBuild, canPartOutAcquiredPC, canMoveToTradeIns } from '../../utils/buildEligibility';
import { resolveTransactionDate } from '../../utils/bulkSaleGrouping';
import { calculateProfitMarginPercent, formatSignedCurrency, getProfitTextColor } from '../../utils/financialDisplay';
import { resolveTradeInBuildOrigin } from '../../utils/tradeInOrigin';
import { getAcquiredPCBreakdown, isAcquiredPC, isPurchasedPC } from '../../utils/acquiredPC';
import { CategoryIcon } from '../ui/CategoryIcon';
import { CopyAdWarrantyModal } from './CopyAdWarrantyModal';
import { isWarrantyPreset } from '../../utils/warranty';

interface BuildCardProps {
  isActive?: boolean;
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
  isActive = true,
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

  useEffect(() => {
    if (!partActionsData) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-part-actions-menu]')) setPartActionsData(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [partActionsData]);

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
    if (isWarrantyPreset(wDays)) {
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
        <div className="build-expanded px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="build-overview">
            <div className="build-overview-copy">
              <button type="button" className="build-expanded-heading" onClick={handleToggle} aria-label={`Collapse ${build.name}`}>
                <span className="min-w-0">
                  <span className="build-expanded-title" title={build.name}>{build.name}</span>
                </span>
                <ChevronUp />
              </button>
              <div className={`build-finances ${isSold ? 'build-finances-sold' : ''}`}>
                <div><span>Cost</span><strong>{formatCurrency(partsCost)}</strong></div>
                <div><span>{isSold ? 'Sold' : 'Target'}</span><strong>{displayedPrice !== undefined ? formatCurrency(displayedPrice) : '—'}</strong></div>
                <div><span>Profit</span><strong className={getProfitTextColor(profit)}>{displayedPrice !== undefined ? formatSignedCurrency(profit) : '—'}</strong></div>
                {isSold && <div><span>Margin</span><strong>{profitMarginPercent.toFixed(1)}%</strong></div>}
              </div>
              {!isSold && <div className="build-date"><Calendar /><span>Built {formattedBuiltDate}</span></div>}
              <div className="build-action-bar">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(build); }}
                  className="app-button"
                  title="Edit Build Details"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAllocate(build); }}
                  className="app-button"
                  title="Add Part"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#B9EF68]" /> Add Part
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

          {imageShareError && (
            <div className="build-expanded-body">
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
            </div>
          )}

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
          <div className="build-parts-section">
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
                      <div key={part.id || idx} className="allocated-part allocated-part-static">
                        <span className={`allocated-type ${category.textClass}`}>
                          <CategoryIcon category={part.category} className="allocated-type-icon" />
                          <span>{category.label}</span>
                        </span>
                        <span className="allocated-details">
                          <strong className="allocated-name">{part.name}</strong>
                          <span className="allocated-meta">
                            {part.quantity > 1 ? `${part.quantity} × ${formatCurrency(part.unitCost)} each` : 'Base component'}
                          </span>
                        </span>
                        <span className="allocated-cost">{formatCurrency(totalCost)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="app-ledger">
              <div className="parts-heading">
                <span>
                  <List aria-hidden="true" /> Allocated Parts · {build.parts.length} items
                </span>
                <span className="whitespace-nowrap font-mono text-[11px] font-bold text-[#83E5DF] sm:text-xs">
                  Total Cost: {formatCurrency(partsCost)}
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
                    const purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);
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

                    const isActionsOpen = partActionsData === part;
                    return (
                      <div
                        key={`${part.componentId}-${part.purchaseEntryId || partIdx}-${part.unitCostAtAssignment}`}
                        className="allocated-part allocated-part-managed"
                      >
                        <span className={`allocated-type ${category.textClass}`}>
                          <CategoryIcon category={part.category} className="allocated-type-icon" />
                          <span>{category.label}</span>
                        </span>
                        <span className="allocated-details">
                          <strong className="allocated-name">{part.componentName}</strong>
                          <span className="allocated-meta">
                            {purchaseEntry?.condition && <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(purchaseEntry.condition)}`} />{purchaseEntry.condition}</span>}
                            {metadata.slice(purchaseEntry?.condition ? 1 : 0).map((item, index) => <span key={`${item}-${index}`}>· {item}</span>)}
                            {part.quantity > 1 && <span>· {part.quantity} × {formatCurrency(unitCost)} each</span>}
                          </span>
                        </span>
                        <span className="allocated-cost">{formatCurrency(totalCost)}</span>
                        <span className="allocated-part-actions" data-part-actions-menu>
                          <button
                            type="button"
                            className="allocated-part-menu-trigger"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPartActionsData(isActionsOpen ? null : part);
                            }}
                            aria-label={`Actions for ${part.componentName}`}
                            aria-expanded={isActionsOpen}
                          >
                            <MoreVertical />
                          </button>
                          {isActionsOpen && (
                            <span className="allocated-part-menu" role="menu">
                              <button type="button" role="menuitem" onClick={() => { setSwapPartData(part); setPartActionsData(null); }}>
                                <ArrowRightLeft /> Swap part
                              </button>
                              <button type="button" role="menuitem" onClick={() => { setQuantityPartData(part); setPartActionsData(null); }}>
                                <Pencil /> Change quantity
                              </button>
                              <button type="button" role="menuitem" className="danger" onClick={() => openRemovePartConfirm(part)}>
                                <Trash2 /> Remove from build
                              </button>
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Primary build workflow actions. Financials live only in the hero above. */}
          {!isSold && (
            <div className="border-t border-white/[0.08] pt-3">
              <div className="build-workflow-actions grid grid-cols-2 gap-2 pt-0.5">
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
                        className="app-button mark-available-action flex items-center gap-1 px-3"
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
          isOpen={isActive}
          build={build}
          currentPart={swapPartData}
          onClose={() => setSwapPartData(null)}
        />
      )}
      {quantityPartData && (
        <EditBuildPartQuantityModal
          isOpen={isActive}
          build={build}
          part={quantityPartData}
          onClose={() => setQuantityPartData(null)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen && isActive}
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
        <CopyAdWarrantyModal
          isOpen={isCopyAdModalOpen && isActive}
          onClose={() => setIsCopyAdModalOpen(false)}
          warrantyDays={copyAdWarrantyDays}
          onWarrantyDaysChange={setCopyAdWarrantyDays}
          customWarrantyDays={copyAdCustomWarranty}
          onCustomWarrantyDaysChange={setCopyAdCustomWarranty}
          onConfirm={handleCopyAdConfirm}
        />
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
