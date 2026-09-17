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
    <section className="app-section relative">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="app-section-kicker"><Sparkles /> Custom AI Build Request</h3>
        <span className="hidden text-[10px] text-zinc-600 sm:inline-block">Describe. Generate. Refine.</span>
      </div>
      <div className="app-panel p-2.5 sm:p-3">
      <div className="relative z-10 flex w-full min-w-0 max-w-full flex-col gap-2.5 lg:flex-row">
        <div className="relative flex-1 min-w-0 w-full max-w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGeneratingCustomBuild && onGenerate()}
            placeholder="e.g. 'White AM5 build with RTX 4080', 'Budget esports rig under $800'..."
            className="app-field h-12 box-border pl-10 pr-9 text-xs placeholder:text-zinc-600 sm:text-sm"
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
          className="app-button app-button-primary h-12 shrink-0 px-6 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isGeneratingCustomBuild ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Build</span>
            </>
          )}
        </button>
      </div>
      </div>
      
      {customError && (
        <div className="relative z-10 mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400">
          {customError}
        </div>
      )}
    </section>
  );
};
