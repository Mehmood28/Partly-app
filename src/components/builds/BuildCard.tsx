import React, { useState, useRef } from 'react';
import { PCBuild, PCBuildPart } from '../../types';
import { CircuitBoard, Zap, Fan, Package, CheckCircle2, Clock, FileText, Pencil, Trash2, ChevronUp, ChevronDown, X, PlusCircle, Tag, DollarSign, Copy, Cpu, Monitor, HardDrive, Database, ArrowRightLeft, Shield, Image as ImageIcon, Loader2, AlertCircle, Wrench } from 'lucide-react';
import { calculateBuildPartsCost, formatCurrency, formatReadableDate, getConditionColor, getCategoryBadgeColor, getTagBadgeColor, getPlatformBadgeColor, getPaymentMethodBadgeColor } from '../../utils/helpers';
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
import { shareBuildImageToDiscord } from './discordShareHelpers';
import { SoldBuildTransactionPanel } from './SoldBuildTransactionPanel';
import { normalizePlatform } from '../../utils/platformDisplay';
import { ConfirmModal } from '../ConfirmModal';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { canDeleteBuildDraft, canDismantleBuild, canPartOutTradeInBuild, canMoveToTradeIns } from '../../utils/buildEligibility';
import { resolveTransactionDate } from '../../utils/bulkSaleGrouping';
import { formatSignedCurrency, getProfitBadgeClasses } from '../../utils/financialDisplay';

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

  const executeShareImageDiscord = async () => {
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

  const renderCategoryIcon = (category: string) => {
    const className = 'w-4 h-4 text-[#7C6CF2]';
    switch (category) {
      case 'GPU': return <Monitor className={className} />;
      case 'CPU': return <Cpu className={className} />;
      case 'RAM': return <HardDrive className={className} />;
      case 'Storage': return <Database className={className} />;
      case 'Motherboard': return <CircuitBoard className={className} />;
      case 'PSU': return <Zap className={className} />;
      case 'Cooling': return <Fan className={className} />;
      case 'Case': return <Package className={className} />;
      default: return <Cpu className={className} />;
    }
  };

  const isListed = build.status === 'Listed for Sale';
  const profit = (build.salePrice || 0) - partsCost;
  const roi = partsCost > 0 ? (profit / partsCost) * 100 : 0;

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

  const formattedSoldDate = build.saleDate ? formatReadableDate(build.saleDate) : null;

  return (
    <div className="bg-[#0D1118] border border-white/[0.08] hover:border-[#7C6CF2]/40 rounded-xl relative flex flex-col transition-all duration-200 overflow-hidden shadow-sm group">
      {/* Collapsed Header - Always Visible */}
      <div 
        className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors flex items-center justify-between"
        onClick={handleToggle}
      >
        {/* Left Side: Thumbnail & Title */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          {/* Thumbnail */}
          {!isExpanded && (
            build.imageUrl ? (
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-white/[0.08]">
                <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-white/[0.08] bg-[#121722] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-[#7C6CF2]" />
              </div>
            )
          )}
          
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-1">
                <h3 className="font-semibold text-zinc-100 text-xs sm:text-sm leading-tight break-words" title={build.name}>
                  {build.name}
                </h3>
                {build.acquisitionSource === 'Trade-In' && (
                  <span className="bg-purple-500/15 text-purple-400 border border-purple-500/40 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase inline-flex items-center">
                    TRADE-IN
                  </span>
                )}
              </div>
              
              <span
                className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border shrink-0 mt-0.5 leading-none ${
                  isSold
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : isListed
                    ? 'bg-[#7C6CF2]/15 text-[#9D91FA] border-[#7C6CF2]/30'
                    : build.status === 'Trade-In Processing'
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/40'
                }`}
              >
                {build.status === 'Listed for Sale'
                  ? 'Available'
                  : build.status === 'In Progress'
                  ? 'Pending'
                  : build.status === 'Trade-In Processing'
                  ? 'Processing'
                  : build.status}
              </span>
            </div>

            {/* Quick Financial Summary (Collapsed) */}
            {!isExpanded && (
              <div className="flex flex-col gap-1 w-full mt-1">
                <div className="flex items-center gap-1.5 flex-wrap font-mono">
                  <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                    COST: {formatCurrency(partsCost)}
                  </span>
                  {isSold ? (
                    <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                      SOLD: {formatCurrency(build.salePrice || 0)}
                    </span>
                  ) : (
                    build.salePrice ? (
                      <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                        TARGET: {formatCurrency(build.salePrice)}
                      </span>
                    ) : null
                  )}
                  {isSold ? (
                    <span className={`${getProfitBadgeClasses(profit)} border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                      PROFIT: {formatSignedCurrency(profit)}
                    </span>
                  ) : (
                    build.salePrice ? (
                      <span className={`${getProfitBadgeClasses(build.salePrice - partsCost)} border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                        EST PROFIT: {formatSignedCurrency(build.salePrice - partsCost)}
                      </span>
                    ) : null
                  )}
                </div>

                {isSold && formattedSoldDate && (
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono tracking-tight leading-tight">
                    <span className="text-zinc-500 font-normal">Sold: </span>
                    <span className="text-zinc-300 font-medium">{formattedSoldDate}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pl-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-white/[0.08] mt-1 bg-[#121722]">
          {/* Top Actions in expanded view: Logically sorted */}
          <div className="space-y-2 pt-2.5">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              {/* Rig Management Group: Edit, Dismantle, Delete, Relist, Move to Trade-Ins */}
              <div className="flex gap-1.5 flex-wrap items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(build); }}
                  className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                  title="Edit Build Details"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {!isSold && isTradeIn && onItemize && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onItemize(build); }}
                    className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-emerald-500/40 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                    title={build.tradeInComponentBreakdown && build.tradeInComponentBreakdown.length > 0 ? 'Edit trade-in component breakdown' : 'Itemize trade-in into components'}
                  >
                    <FileText className="w-3.5 h-3.5" /> {build.tradeInComponentBreakdown && build.tradeInComponentBreakdown.length > 0 ? 'Edit Breakdown' : 'Itemize'}
                  </button>
                )}
                {!isSold && onDismantle && (isTradeIn ? canPartOutTradeInBuild(build) : canDismantleBuild(build)) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDismantle(build); }}
                    className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                    title={isTradeIn ? 'Part out traded-in PC into inventory parts' : 'Dismantle rig and return parts to stock'}
                  >
                    <Wrench className="w-3.5 h-3.5" /> {isTradeIn ? 'Part Out' : 'Dismantle'}
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
                    className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 font-medium"
                    title="Relist Build"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Relist
                  </button>
                )}
                {canDeleteBuildDraft(build) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(build); }}
                    className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                    title="Delete empty draft build"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Draft
                  </button>
                )}
              </div>
              
              {/* Sale & Sharing Actions Group */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {isSold && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSell(build); }}
                      className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 font-medium"
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
                      className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 font-medium"
                      title="Download Invoice PDF"
                    >
                      <FileText className="w-3.5 h-3.5" /> Invoice
                    </button>
                  </>
                )}
                {!isSold && (
                  <button
                    onClick={handleCopyAdClick}
                    className="bg-[#0D1118] border border-white/[0.08] text-zinc-200 hover:text-white hover:border-[#7C6CF2]/40 px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 font-medium"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Ad'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareImageDiscord}
                  disabled={imageShareStatus === 'loading' || imageShareStatus === 'success'}
                  className={`border px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 font-medium ${
                    imageShareStatus === 'success'
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 cursor-default'
                      : imageShareStatus === 'error'
                      ? 'border-rose-500/40 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                      : 'border-white/[0.08] text-zinc-200 bg-[#0D1118] hover:border-[#7C6CF2]/40'
                  }`}
                  title={imageShareError || 'Share build as rendered image to Discord'}
                >
                  {imageShareStatus === 'loading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C6CF2]" />
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

            {/* Error notifications */}
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

          {/* Sold-Build Full Transaction & Financials Panel */}
          {isSold && (
            <SoldBuildTransactionPanel
              build={build}
              partsCost={partsCost}
              profit={profit}
              roi={roi}
              transaction={exactTransaction}
            />
          )}

          {/* Build Image Presentation */}
          {build.imageUrl && (
            <div className="flex justify-center w-full">
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#0A0D14] flex items-center justify-center p-1 sm:p-1.5 max-w-full">
                <img 
                  src={build.imageUrl} 
                  alt={build.name} 
                  className="w-auto h-auto max-h-72 sm:max-h-80 max-w-full object-contain rounded-lg block" 
                />
              </div>
            </div>
          )}

          {/* Full Allocated Parts List */}
          <div className="space-y-2 pt-1">
            {build.notes && (
              <div className="text-xs text-zinc-400 italic bg-[#0D1118] p-2.5 rounded-xl border border-white/[0.08]">
                {build.notes}
              </div>
            )}

            {isTradeIn && build.tradeInComponentBreakdown && build.tradeInComponentBreakdown.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>TRADE-IN COMPONENTS ({build.tradeInComponentBreakdown.length})</span>
                  <span className="text-emerald-400/80">
                    {formatCurrency(build.tradeInComponentBreakdown.reduce((sum, p) => sum + p.quantity * p.unitCost, 0))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {build.tradeInComponentBreakdown.map((part, idx) => (
                    <div
                      key={part.id || idx}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between p-2 rounded-xl bg-[#0D1118] border border-white/[0.08] text-xs gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-1.5 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: getCategoryBadgeColor(part.category).replace('text-', 'bg-').split(' ')[0] }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-200 truncate pr-2 flex items-center gap-2">
                            <span>{part.name}</span>
                            {part.quantity > 1 && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                x{part.quantity}
                              </span>
                            )}
                          </div>
                          <div className="text-zinc-500 truncate mt-0.5 flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-mono font-medium">
                              {part.category}
                            </span>
                            {part.tags && part.tags.length > 0 && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                <span className="text-[10px] text-zinc-400 truncate">
                                  {part.tags.join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-white/[0.04] sm:border-0 shrink-0">
                        <div className="text-right">
                          <div className="text-emerald-400 font-mono font-medium">
                            {formatCurrency(part.quantity * part.unitCost)}
                          </div>
                          {part.quantity > 1 && (
                            <div className="text-zinc-500 font-mono text-[10px] mt-0.5">
                              {formatCurrency(part.unitCost)} ea
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <div className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                ALLOCATED PARTS ({build.parts.length})
              </div>
              {build.parts.length === 0 ? (
                <div className="text-xs text-zinc-500 italic py-2">
                  {isTradeIn && build.tradeInComponentBreakdown && build.tradeInComponentBreakdown.length > 0 
                    ? 'No stock upgrades allocated.'
                    : 'No components assigned yet.'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sortByCategory(build.parts).map((part, partIdx) => {
                    const comp = state.components.find((c) => c.id === part.componentId);
                    let purchaseEntry = comp?.purchaseHistory?.find((pe) => pe.id === part.purchaseEntryId);
                    if (!purchaseEntry && comp?.purchaseHistory?.length) {
                      purchaseEntry = comp.purchaseHistory.find((pe) => pe.unitPrice === part.unitCostAtAssignment) || comp.purchaseHistory[0];
                    }

                    return (
                      <div
                        key={`${part.componentId}-${part.purchaseEntryId || partIdx}-${part.unitCostAtAssignment}`}
                        className="bg-[#0D1118] border border-white/[0.08] rounded-xl mb-1.5 flex flex-col text-xs overflow-hidden transition-all shadow-sm"
                      >
                        <div className="p-2.5 flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center shrink-0 mt-0.5">
                            {renderCategoryIcon(part.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-zinc-100 break-words block leading-snug text-xs sm:text-sm">
                                {part.componentName}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSwapPartData(part); }}
                                  className="text-zinc-400 hover:text-[#7C6CF2] p-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                                  title="Swap Part"
                                  aria-label={`Swap ${part.componentName}`}
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setQuantityPartData(part); }}
                                  className="text-zinc-400 hover:text-[#7C6CF2] p-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                                  title="Change Quantity"
                                  aria-label={`Change quantity for ${part.componentName}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                                  }}
                                  className="text-zinc-400 hover:text-rose-400 p-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                                  title="Remove Part"
                                  aria-label={`Remove ${part.componentName}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5 font-mono">
                              <span className={`${getCategoryBadgeColor(part.category)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                                {part.category}
                              </span>
                              {comp?.tags && Array.isArray(comp.tags) && comp.tags.map((tag, idx) => typeof tag === 'string' ? (
                                <span key={idx} className={`${getTagBadgeColor(tag)} px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                                  {tag}
                                </span>
                              ) : null)}
                              {purchaseEntry && (
                                <>
                                  <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                                    {purchaseEntry.date}
                                  </span>
                                  <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap ${getConditionColor(purchaseEntry.condition)}`}>
                                    {purchaseEntry.condition.toUpperCase()}
                                  </span>
                                </>
                              )}
                              <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] shrink-0 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                                {part.quantity > 1 
                                  ? `${part.quantity}x ${formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCostAtAssignment)}/ea` 
                                  : formatCurrency(purchaseEntry ? purchaseEntry.unitPrice : part.unitCostAtAssignment)}
                              </span>
                              {!hideSupplierNames && purchaseEntry?.platform && (
                                <span className={`${getPlatformBadgeColor(purchaseEntry.platform)} shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                                  {normalizePlatform(String(purchaseEntry.platform))}
                                </span>
                              )}
                              {purchaseEntry?.paymentMethod && (
                                <span className={`${getPaymentMethodBadgeColor(purchaseEntry.paymentMethod)} shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                                  {String(purchaseEntry.paymentMethod)}
                                </span>
                              )}
                            </div>
                          </div>
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
                className="w-full bg-[#0D1118] hover:bg-white/[0.04] text-zinc-200 text-xs font-medium py-1.5 px-3 rounded-xl border border-white/[0.08] flex items-center justify-center gap-1.5 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#7C6CF2]" /> Add Part
              </button>
            </div>
          )}

          {/* Build Financial Summary Footer (for available/pending-sale builds) */}
          {!isSold && (
            <div className="border-t border-white/[0.08] pt-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5 font-mono">
                <span className="bg-white/[0.04] text-zinc-300 border border-white/[0.08] px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                  COST: {formatCurrency(partsCost)}
                </span>
                {build.salePrice && (
                  <span className="bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap">
                    TARGET: {formatCurrency(build.salePrice)}
                  </span>
                )}
                {build.salePrice && (
                  <span className={`${getProfitBadgeClasses(build.salePrice - partsCost)} border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap`}>
                    EST PROFIT: {formatSignedCurrency(build.salePrice - partsCost)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onAllocate(build); }}
                  className="flex-1 min-w-[85px] bg-[#0D1118] hover:bg-white/[0.04] text-zinc-200 text-xs font-medium py-1.5 px-3 rounded-xl border border-white/[0.08] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#7C6CF2]" /> Add Part
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
                    className="bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
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
                        className="bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
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
                        className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] hover:bg-[#7C6CF2]/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
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
                    className="bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 text-[#9D91FA] hover:bg-[#7C6CF2]/25 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
                    title="List trade-in PC for sale"
                  >
                    <Tag className="w-3.5 h-3.5" /> List For Sale
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSell(build); }}
                  className="flex-1 min-w-[90px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center gap-1 transition-colors px-3 py-1.5 rounded-xl text-xs font-medium"
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
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-display flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#7C6CF2]" /> Copy Marketplace Ad
              </h3>
              <button
                type="button"
                onClick={() => setIsCopyAdModalOpen(false)}
                aria-label="Close modal"
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
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
                        className={`min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
                          isSelected
                            ? 'bg-[#7C6CF2] text-white border border-[#7C6CF2] shadow-sm shadow-[#7C6CF2]/25 font-semibold'
                            : 'bg-[#121722] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
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
                  className={`w-full min-h-[44px] h-11 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2] ${
                    copyAdWarrantyDays === 'Custom'
                      ? 'bg-[#7C6CF2] text-white border border-[#7C6CF2] shadow-sm shadow-[#7C6CF2]/25 font-semibold'
                      : 'bg-[#121722] text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.08]'
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
                      className="w-full min-h-[44px] h-11 bg-[#121722] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40 transition-colors font-mono"
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
                className="min-h-[44px] px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyAdConfirm}
                className="min-h-[44px] bg-[#7C6CF2] hover:bg-[#8D7FF5] text-white font-semibold shadow-md shadow-[#7C6CF2]/20 px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF2]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Ad
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* Off-screen card used for HTML-to-Image rendering */}
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
    </div>
  );
});
