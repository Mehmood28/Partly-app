import React from 'react';
import { Sparkles, Search, X } from 'lucide-react';

interface CustomAIBuildRequestProps {
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  isGeneratingCustomBuild: boolean;
  onGenerate: () => void;
  customError: string | null;
}

export const CustomAIBuildRequest: React.FC<CustomAIBuildRequestProps> = ({
  customPrompt,
  setCustomPrompt,
  isGeneratingCustomBuild,
  onGenerate,
  customError,
}) => {
  return (
    <section className="border-t border-white/[0.08] pt-4 relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#A3FF12]" />
          Custom AI Build Request
        </h3>
        <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline-block">In-Stock Optimization</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 relative z-10 w-full max-w-full min-w-0">
        <div className="relative flex-1 min-w-0 w-full max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGeneratingCustomBuild && onGenerate()}
            placeholder="e.g. 'White AM5 build with RTX 4080', 'Budget esports rig under $800'..."
            className="w-full h-11 box-border bg-[#10141E] border border-white/[0.08] rounded-lg pl-9 pr-9 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#A3FF12] focus:ring-1 focus:ring-[#A3FF12]/40 transition-all placeholder-zinc-500"
          />
          {customPrompt && (
            <button
              type="button"
              onClick={() => setCustomPrompt('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-md transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={!customPrompt.trim() || isGeneratingCustomBuild}
          className="h-11 bg-[#A3FF12] hover:bg-[#C2FF5C] disabled:opacity-50 disabled:cursor-not-allowed text-[#11150C] px-4 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          {isGeneratingCustomBuild ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Generate Build</span>
            </>
          )}
        </button>
      </div>
      
      {customError && (
        <div className="mt-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 relative z-10 px-3 py-1.5 rounded-lg text-xs font-medium">
          {customError}
        </div>
      )}
    </section>
  );
};
