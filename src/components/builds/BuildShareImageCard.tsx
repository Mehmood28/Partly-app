import { forwardRef } from 'react';
import { PCBuild, InventoryComponent } from '../../types';
import { getBuildPresentation } from '../../utils/buildPresentation';
import { calculateBuildPartsCost, formatCurrency, getCategoryPresentation } from '../../utils/helpers';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Layers } from 'lucide-react';
import { PARTLY_LOGO_BASE64 } from './partlyLogoBase64';

interface BuildShareImageCardProps {
  build: PCBuild;
  components: InventoryComponent[];
}

export const BuildShareImageCard = forwardRef<HTMLDivElement, BuildShareImageCardProps>(({ build, components }, ref) => {
  const partsCost = calculateBuildPartsCost(build);
  const presentation = getBuildPresentation(build, components);
  const parts = presentation.allComponents;

  return (
    // Outer canvas wrapper with safe transparent padding so borders are never clipped by Discord's image viewer
    <div
      ref={ref}
      className="p-3 bg-transparent flex flex-col items-center antialiased"
      style={{
        width: '670px',
        boxSizing: 'border-box',
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}
    >
      {/* Main Card Container */}
      <div
        className="w-full bg-[#070A0B] text-zinc-100 p-4 rounded-2xl border border-white/[0.12] flex flex-col font-sans"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(131, 229, 223, 0.06)',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header / Branding with Partly Logo & Text */}
        <div className="flex items-center gap-2.5 pb-2.5 mb-3 border-b border-white/[0.08]">
          <img
            src={PARTLY_LOGO_BASE64}
            alt="Partly"
            className="w-[22px] h-[22px] object-contain shrink-0"
          />
          <span className="text-[17px] font-bold tracking-tight text-white leading-none">
            Partly
          </span>
        </div>

        {/* Full-Width 1:1 Photo (Matches specs width, zero horizontal dead space) */}
        {build.imageUrl ? (
          <div className="w-full aspect-square rounded-xl overflow-hidden border border-white/[0.08] mb-3 bg-[#0B1113] relative shadow-md">
            <img
              src={build.imageUrl}
              alt={build.name}
              crossOrigin="anonymous"
              className="w-full h-full object-cover block"
            />
          </div>
        ) : null}

        {/* Unified Specification Container: Title + Cost in Header, Specs underneath */}
        <div className="bg-[#0B1113] border border-white/[0.08] rounded-xl overflow-hidden">
          {/* Unified Header with Icon, Build Title, and Cost */}
          <div className="px-3.5 py-2.5 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Layers className="w-4 h-4 text-[#83E5DF] shrink-0" />
              <h2 className="text-[16px] font-semibold text-white tracking-tight leading-snug break-words truncate">
                {build.name}
              </h2>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-right pl-3">
              <span className="text-[16px] font-semibold text-white tracking-tight leading-none">Cost:</span>
              <span className="text-[16px] font-mono font-bold text-[#83E5DF] leading-none">
                {formatCurrency(partsCost)}
              </span>
            </div>
          </div>

          {/* Clean Parts List (Category, Plain text quantity like "3x Prism 8 Pro", Part Name) */}
          {parts.length === 0 ? (
            <div className="text-xs text-zinc-500 italic p-4 text-center">No allocated components.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {parts.map((part) => {
                const category = getCategoryPresentation(part.category);
                const displayName = part.quantity > 1 ? `${part.quantity}x ${part.name}` : part.name;

                return (
                  <div
                    key={part.id}
                    className="px-3.5 py-2 flex items-center gap-3 bg-[#0B1113] hover:bg-white/[0.015] transition-colors"
                  >
                    {/* Category Badge & Icon */}
                    <div className="flex items-center gap-2 w-[92px] shrink-0 text-[#9FF8F4]">
                      <CategoryIcon category={part.category} className="w-4 h-4 shrink-0 text-[#83E5DF]" />
                      <span className="text-[14.5px] font-semibold tracking-tight">{category.label}</span>
                    </div>

                    {/* Part Name with inline quantity */}
                    <div className="min-w-0 flex-1">
                      <span className="text-[14.5px] font-medium text-zinc-100 leading-snug break-words">
                        {displayName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Description / Notes if present */}
        {build.notes ? (
          <div className="text-xs text-zinc-400 italic bg-[#0B1113] px-3.5 py-2 rounded-xl border border-white/[0.08] mt-2.5 leading-relaxed">
            &ldquo;{build.notes}&rdquo;
          </div>
        ) : null}
      </div>
    </div>
  );
});

BuildShareImageCard.displayName = 'BuildShareImageCard';
