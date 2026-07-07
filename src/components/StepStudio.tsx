import { useState, useEffect, useRef, useCallback } from 'react';
import type { GenerationPhase, PrepareResult, GenerationResult, HistoryEntry, ThoughtBubble, ChatMessage, InfographicMode, ImageResolution, AspectRatio } from '../types';
import { useBlobUrl } from '../hooks/useBlobUrl';
import BeforeAfterSlider from './BeforeAfterSlider';
import ThoughtStream from './ThoughtStream';
import ChatPanel from './ChatPanel';

interface StepStudioProps {
  phase: GenerationPhase;
  streamingText: string;
  prepareResult: PrepareResult | null;
  currentResult: GenerationResult | null;
  error: string | null;
  onRefine: (instruction: string) => void;
  onUpgradeResolution: (res: ImageResolution) => void;
  onDownload: () => void;
  onReset: () => void;
  history: HistoryEntry[];
  onLoadHistory: (entry: HistoryEntry) => void;
  thoughtBubbles: ThoughtBubble[];
  chatMessages: ChatMessage[];
  refineThoughts: ThoughtBubble[];
  mode: InfographicMode;
  aspectRatio: AspectRatio;
  onClearError: () => void;
}

export default function StepStudio({
  phase,
  streamingText,
  prepareResult,
  currentResult,
  error,
  onRefine,
  onUpgradeResolution,
  onDownload,
  onReset,
  history,
  onLoadHistory,
  thoughtBubbles,
  chatMessages,
  refineThoughts,
  mode,
  aspectRatio,
  onClearError,
}: StepStudioProps) {
  // === State ===
  const [elapsed, setElapsed] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [previousImage, setPreviousImage] = useState<string | null>(null);
  const previousImageRef = useRef<string | null>(null);
  const isRefiningRef = useRef(false);

  const currentImageUrl = useBlobUrl(currentResult?.imageData);
  const previousImageUrl = useBlobUrl(previousImage || undefined);

  const aspectMap: Record<string, string> = {
    '1:1': '1/1',
    '9:16': '9/16',
    '16:9': '16/9',
    '3:4': '3/4',
    '4:3': '4/3',
    '1:4': '1/4'
  };
  const skeletonAspect = aspectMap[aspectRatio] || '3/4';


  // === Timer ===
  useEffect(() => {
    if (phase === 'preparing' || phase === 'generating') {
      const start = Date.now();
      const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // === Fullscreen escape ===
  useEffect(() => {
    if (!fullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen]);

  // === Track previous image for before/after comparison ===
  useEffect(() => {
    if (currentResult?.imageData && isRefiningRef.current) {
      setPreviousImage(previousImageRef.current);
      isRefiningRef.current = false;
    }
  }, [currentResult?.imageData]);

  // === Refinement submission ===
  const isRefining = streamingText !== '' && phase === 'complete';

  const handleRefineFromChat = useCallback((text: string) => {
    if (!currentResult) return;
    previousImageRef.current = currentResult.imageData;
    isRefiningRef.current = true;
    onRefine(text);
  }, [currentResult, onRefine]);

  // === Helpers ===
  const isInProgress = phase === 'preparing' || phase === 'generating';
  const isComplete = phase === 'complete';

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // =========================================================================
  // RENDER: During generation (preparing / generating)
  // =========================================================================
  if (isInProgress) {
    return (
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {error && <ErrorBanner error={error} onDismiss={onClearError} />}
        <div className="flex flex-col lg:flex-row gap-6">
          <ThoughtStream
            thoughts={thoughtBubbles}
            phase={phase}
            elapsed={elapsed}
            prepareResult={prepareResult}
          />
          <div className="w-full lg:w-3/4 flex items-center justify-center">
            {currentImageUrl ? (
              <div className="animate-fade-in w-full flex items-center justify-center">
                <img
                  src={currentImageUrl}
                  alt="Generated infographic"
                  className="rounded-gcard shadow-gcard max-w-full max-h-[50vh] lg:max-h-[80vh] object-contain"
                />
              </div>
            ) : (
              <div className="relative rounded-gcard overflow-hidden w-full max-w-lg flex items-center justify-center bg-gradient-to-r from-gsurface-light via-white to-gsurface-light dark:from-gsurface-dark dark:via-gsurface-card-dark dark:to-gsurface-dark bg-[length:200%_100%] animate-shimmer" style={{ aspectRatio: skeletonAspect }}>
                <div className="text-center space-y-4" aria-live="polite">
                  <span className="material-symbols-outlined text-5xl text-gtext-secondary/40 dark:text-gtext-secondary-dark/40">auto_awesome</span>
                  <p className="text-gtext-secondary dark:text-gtext-secondary-dark font-medium text-lg">Creating your infographic...</p>
                  <p className="text-gtext-secondary/60 dark:text-gtext-secondary-dark/60 text-sm">{formatTime(elapsed)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Complete state (sidebar layout with ChatPanel)
  // =========================================================================
  if (isComplete && currentResult) {
    return (
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {fullscreen && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer" onClick={() => setFullscreen(false)}>
            <img src={currentImageUrl} alt="Infographic fullscreen" className="max-w-[95vw] max-h-[95vh] object-contain" />
            <button type="button" className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}>
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
          </div>
        )}
        {error && <ErrorBanner error={error} onDismiss={onClearError} />}
        <div className="flex flex-col-reverse lg:flex-row gap-6">
          <ChatPanel messages={chatMessages} mode={mode} onSendMessage={handleRefineFromChat} isRefining={isRefining} refineThoughts={refineThoughts} />
          <div className="flex-1 min-w-0 space-y-4">
            {previousImage && previousImage !== currentResult.imageData && !isRefining ? (
               <div className="space-y-3">
                 <div className="flex items-center justify-between px-2">
                   <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark flex items-center gap-1.5">
                     <span className="material-symbols-outlined text-lg text-gblue-600 dark:text-gblue-300">compare</span>
                     Before / After Comparison
                   </h3>
                   <button type="button" onClick={() => setPreviousImage(null)} className="text-xs text-gtext-secondary hover:text-gtext-primary transition-colors">
                     Dismiss
                   </button>
                 </div>
                 <div className="flex items-center justify-center">
                    <div className="w-full max-h-[45vh] lg:max-h-[65vh] relative flex justify-center">
                       <BeforeAfterSlider
                          className="relative rounded-gcard shadow-gcard overflow-hidden inline-block"
                          imgClassName="max-h-[45vh] lg:max-h-[65vh]"
                          beforeImage={previousImageUrl || previousImage || ''}
                          afterImage={currentImageUrl || currentResult.imageData}
                       />
                    </div>
                 </div>
               </div>
            ) : (
               <div className="flex items-center justify-center relative">
                 <img src={currentImageUrl} alt="Generated infographic" className={`max-h-[45vh] lg:max-h-[65vh] object-contain rounded-gcard shadow-gcard transition-all duration-300 ${isRefining ? 'opacity-40 blur-[2px] brightness-75 grayscale-[30%]' : 'cursor-pointer hover:shadow-gcard-dark'}`} onClick={() => !isRefining && setFullscreen(true)} />
                 {isRefining && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gblue-500 border-t-transparent shadow-lg mb-4"></div>
                      <span aria-live="polite" className="bg-gsurface-dark/90 dark:bg-black/80 text-white px-5 py-2.5 rounded-gpill font-medium backdrop-blur-md shadow-2xl text-sm border border-white/20 animate-fade-in">{streamingText || 'Generating image...'}</span>
                    </div>
                 )}
               </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={onReset} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-gbtn border border-gborder-light dark:border-gborder-dark text-gtext-primary dark:text-gtext-primary-dark bg-white dark:bg-gsurface-card-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark font-medium text-sm transition-all duration-200 shadow-gcard-sm">
                <span className="material-symbols-outlined text-xl">add</span>New
              </button>
              <button type="button" onClick={() => onUpgradeResolution('1K')} disabled={isRefining} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-gbtn border border-gborder-light dark:border-gborder-dark text-gtext-primary dark:text-gtext-primary-dark bg-white dark:bg-gsurface-card-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark font-medium text-sm transition-all duration-200 shadow-gcard-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-xl">hd</span>Upgrade to 1K
              </button>
              <button type="button" onClick={() => onUpgradeResolution('2K')} disabled={isRefining} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-gbtn border border-gborder-light dark:border-gborder-dark text-gtext-primary dark:text-gtext-primary-dark bg-white dark:bg-gsurface-card-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark font-medium text-sm transition-all duration-200 shadow-gcard-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-xl">high_quality</span>Upgrade to 2K
              </button>
              <button type="button" onClick={onDownload} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-gbtn bg-gblue-600 hover:bg-gblue-700 text-white font-medium text-sm transition-all duration-200 shadow-gcard-sm">
                <span className="material-symbols-outlined text-xl">download</span>Download
              </button>
              <button type="button" onClick={() => setFullscreen(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-gbtn border border-gborder-light dark:border-gborder-dark text-gtext-primary dark:text-gtext-primary-dark bg-white dark:bg-gsurface-card-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark font-medium text-sm transition-all duration-200 shadow-gcard-sm">
                <span className="material-symbols-outlined text-xl">fullscreen</span>Fullscreen
              </button>
            </div>
            {history.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg text-gtext-secondary dark:text-gtext-secondary-dark">history</span>
                  History
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {history.map((entry, index) => {
                    const isCurrent = currentResult.imageData === entry.imageData;
                    const hasImage = !!entry.imageData;
                    return (
                      <button key={entry.id} type="button" onClick={() => onLoadHistory(entry)} disabled={!hasImage}
                        className={`flex-shrink-0 px-4 py-2 rounded-gpill text-sm font-medium border transition-all duration-200 inline-flex items-center gap-2 ${
                          isCurrent ? 'bg-gblue-600 text-white border-gblue-600 dark:bg-gblue-600 dark:border-gblue-500'
                          : hasImage ? 'bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700 cursor-pointer'
                          : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary/50 dark:text-gtext-secondary-dark/50 border-gborder-light/50 dark:border-gborder-dark/50 cursor-not-allowed'
                        }`}>
                        <span className="font-semibold">v{history.length - index}</span>
                        <span className={`text-xs ${isCurrent ? 'text-white/70' : ''}`}>{formatTimestamp(entry.timestamp)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Idle / fallback (shouldn't normally appear on studio step)
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto text-center py-20">
      <span className="material-symbols-outlined text-6xl text-gtext-secondary/30 dark:text-gtext-secondary-dark/30">
        auto_awesome
      </span>
      <p className="text-lg text-gtext-secondary dark:text-gtext-secondary-dark mt-4">
        Preparing to generate your infographic...
      </p>
    </div>
  );
}

// =========================================================================
// Sub-component: Error Banner
// =========================================================================
function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(error).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* clipboard unavailable — ignore */
      }
    );
  }, [error]);

  return (
    <div role="alert" className="bg-gerror-50 dark:bg-gerror/10 rounded-gbtn p-4 border border-gerror/20 flex items-start justify-between animate-fade-in mb-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="material-symbols-outlined text-gerror text-lg flex-shrink-0 mt-0.5">error</span>
        <div>
          <p className="text-sm font-medium text-gerror">Something went wrong</p>
          <p className="text-sm text-gerror/80 mt-1">{error}</p>
          <button
            onClick={handleCopy}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gerror/70 hover:text-gerror transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gerror rounded px-1 py-0.5"
            aria-label="Copy error details to clipboard"
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied' : 'Copy details'}
          </button>
        </div>
      </div>
      <button onClick={onDismiss} className="text-gerror/60 hover:text-gerror flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gerror rounded" aria-label="Dismiss error">
        <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}
