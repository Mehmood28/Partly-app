import { forwardRef } from 'react';
import { PCBuild, InventoryComponent } from '../../types';
import { calculateBuildPartsCost, formatCurrency } from '../../utils/helpers';
import { extractBuildSpecs } from './discordShareHelpers';
import { getBuildPresentation } from '../../utils/buildPresentation';

interface BuildShareImageCardProps {
  build: PCBuild;
  components: InventoryComponent[];
}

interface SpecItemConfig {
  category: string;
  key: keyof ReturnType<typeof extractBuildSpecs>;
  colorClass: string;
  bulletColor: string;
}

const SPEC_CONFIGS: SpecItemConfig[] = [
  { category: 'GPU', key: 'GPU', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'CPU', key: 'CPU', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'Motherboard', key: 'Motherboard', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'RAM', key: 'RAM', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'Cooling', key: 'Cooler', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'Storage', key: 'Storage', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'PSU', key: 'PSU', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
  { category: 'Case', key: 'Case', colorClass: 'text-[#9FF8F4]', bulletColor: 'bg-[#83E5DF]' },
];

export const BuildShareImageCard = forwardRef<HTMLDivElement, BuildShareImageCardProps>(({ build, components }, ref) => {
  const partsCost = calculateBuildPartsCost(build);
  const presentation = getBuildPresentation(build, components);
  const specs = extractBuildSpecs(presentation.allComponents);
  const activeSpecs = SPEC_CONFIGS.filter((cfg) => !!specs[cfg.key]);

  return (
    <div
      ref={ref}
      className="w-[580px] bg-[#070A0B] text-zinc-100 p-6 rounded-2xl border border-white/[0.12] shadow-2xl flex flex-col font-sans"
      style={{
        boxShadow: '0 0 40px rgba(163, 255, 18, 0.14)',
      }}
    >
      {/* Top Header / Branding */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#B9EF68] shadow-[0_0_10px_rgba(168,255,62,0.9)]" />
          <span className="text-xs font-mono font-bold tracking-wider text-[#83E5DF]">
            Partly // PC Showcase
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-400 font-semibold px-2 py-0.5 rounded-md bg-[#101719] border border-white/[0.08]">
          Hardware Specs
        </span>
      </div>

      {/* Build Photo (Full, uncropped display preserving native aspect ratio) */}
      {build.imageUrl ? (
        <div className="w-full max-h-[440px] flex items-center justify-center rounded-xl overflow-hidden border border-white/[0.08] mb-5 bg-[#0B1113] p-1">
          <img
            src={build.imageUrl}
            alt={build.name}
            crossOrigin="anonymous"
            className="w-full max-h-[420px] h-auto object-contain block mx-auto rounded-lg"
          />
        </div>
      ) : null}

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight leading-tight mb-1 font-display">
          {build.name}
        </h2>
      </div>

      {/* Purpose-Built Cost Showcase Block (Cost ONLY, never Sold or Est Profit) */}
      <div className="flex items-center justify-between bg-[#0B1113] border border-white/[0.08] rounded-xl px-4 py-3 mb-5">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block mb-0.5">
            Total Build Cost
          </span>
          <span className="text-2xl font-mono font-bold text-[#83E5DF]">
            {formatCurrency(partsCost)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-0.5">
            Installed Hardware
          </span>
          <span className="text-xs font-mono font-bold text-zinc-200">
            {build.parts.length} {build.parts.length === 1 ? 'Component' : 'Components'}
          </span>
        </div>
      </div>

      {/* Itemized Hardware Specifications Grid */}
      <div className="bg-[#0B1113] border border-white/[0.08] rounded-xl p-4 mb-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-3 flex items-center gap-1.5">
          <span>Component Breakdown</span>
        </div>
        {activeSpecs.length === 0 ? (
          <div className="text-xs text-zinc-500 italic py-1">No components listed.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {activeSpecs.map((cfg) => {
              const val = specs[cfg.key];
              return (
                <div
                  key={cfg.category}
                  className="bg-[#101719] border border-white/[0.06] rounded-xl p-2.5 flex items-start gap-2 min-w-0"
                >
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${cfg.bulletColor}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-[11px] font-mono font-semibold block ${cfg.colorClass}`}>
                      {cfg.category}
                    </span>
                    <span className="text-xs font-medium text-zinc-200 break-words block leading-snug">
                      {val}
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
        <div className="text-xs text-zinc-400 italic bg-[#0B1113] p-3 rounded-xl border border-white/[0.08] mb-4 leading-relaxed">
          &ldquo;{build.notes}&rdquo;
        </div>
      ) : null}

      {/* Footer Branding */}
      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>Showcase generated with Partly</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
});

BuildShareImageCard.displayName = 'BuildShareImageCard';
