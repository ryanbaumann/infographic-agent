import { useState, useRef, useCallback } from 'react';
import type { UploadedFile, InfographicConfig, InfographicMode, AspectRatio, HistoryEntry } from '../types';
import { MODE_OPTIONS, ASPECT_RATIO_OPTIONS } from '../types';
import { formatFileSize } from '../services/fileProcessor';

interface StepCreateProps {
  files: UploadedFile[];
  config: InfographicConfig;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onUpdateConfig: (partial: Partial<InfographicConfig>) => void;
  onGenerate: () => void;
  onAddSample: () => void;
  onAddTextContext: (text: string) => void;
  error: string | null;
  onClearError: () => void;
  history: HistoryEntry[];
  onLoadHistory: (entry: HistoryEntry) => void;
  onOpenSettings: () => void;
}

const ACCEPTED_TYPES = '.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt,.md';

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'document':
      return 'description';
    case 'spreadsheet':
      return 'table_chart';
    case 'image':
      return 'image';
    case 'text':
      return 'article';
    default:
      return 'description';
  }
}

export default function StepCreate({
  files,
  config,
  onAddFiles,
  onRemoveFile,
  onUpdateConfig,
  onGenerate,
  onAddSample,
  onAddTextContext,
  error,
  onClearError,
  history,
  onLoadHistory,
  onOpenSettings,
}: StepCreateProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;

  // -- Drag-and-drop handlers --

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onAddFiles(droppedFiles);
      }
    },
    [onAddFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onAddFiles(selectedFiles);
      }
      e.target.value = '';
    },
    [onAddFiles]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddText = useCallback(() => {
    if (!textValue.trim()) return;
    onAddTextContext(textValue);
    setTextValue('');
  }, [textValue, onAddTextContext]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 pb-8">
      {/* ---- Error Banner ---- */}
      {error && error.includes('Trial limit exceeded') ? (
        <div className="bg-gradient-to-br from-gblue-50 to-gblue-100/50 dark:from-gblue-950/20 dark:to-gblue-900/10 rounded-gcard p-6 border border-gblue-100 dark:border-gblue-900/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-gcard-sm animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gblue-500 text-white rounded-gbtn flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl">auto_awesome</span>
            </div>
            <div>
              <h4 className="text-base font-bold text-gtext-primary dark:text-gtext-primary-dark">Trial limit reached (5 turns used)</h4>
              <p className="text-sm text-gtext-secondary dark:text-gtext-secondary-dark mt-1 max-w-xl">
                We hope you enjoyed creating infographics! To continue generating and refining, please configure your own Gemini API key. It's completely free to get from Google AI Studio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={onClearError}
              className="flex-1 md:flex-initial px-4 py-2 text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark rounded-gbtn border border-gborder-light dark:border-gborder-dark transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 md:flex-initial px-4 py-2 text-sm font-semibold text-white bg-gblue-600 hover:bg-gblue-700 rounded-gbtn shadow-sm transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">vpn_key</span>
              Add API Key
            </button>
          </div>
        </div>
      ) : error && (
        <div role="alert" className="bg-gerror-50 dark:bg-gerror/10 rounded-gbtn p-4 border border-gerror/20 flex items-start gap-3 animate-fade-in">
          <span aria-hidden="true" className="material-symbols-outlined text-gerror text-lg flex-shrink-0 mt-0.5">error</span>
          <p className="flex-1 text-sm text-gerror dark:text-gerror">{error}</p>
          <button
            type="button"
            onClick={onClearError}
            className="text-gerror/60 hover:text-gerror flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gerror rounded"
            aria-label="Dismiss error"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* ---- Two-Column Layout ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================================================================ */}
        {/* LEFT COLUMN: Input                                               */}
        {/* ================================================================ */}
        <div className="space-y-4">
          {/* -- Drop Zone -- */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBrowseClick();
              }
            }}
            className={`relative border-2 border-dashed rounded-gcard p-6 sm:p-8 text-center cursor-pointer
              transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] sm:min-h-[180px]
              focus-visible:ring-2 focus-visible:ring-gblue-500 focus-visible:outline-none
              ${
                isDragging
                  ? 'border-gblue-500 bg-gblue-50 dark:bg-gblue-900/20'
                  : 'border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              onChange={handleFileInputChange}
              className="hidden"
            />

            <span
              className={`material-symbols-outlined text-4xl mb-3 transition-colors duration-200 ${
                isDragging
                  ? 'text-gblue-500'
                  : 'text-gtext-secondary dark:text-gtext-secondary-dark'
              }`}
            >
              upload_file
            </span>
            <p className="text-sm font-medium text-gtext-primary dark:text-gtext-primary-dark">
              {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark mt-1">
              PDF, CSV, Excel, Images, Text, Markdown
            </p>
          </div>

          {/* -- Text Input Area -- */}
          <div className="relative">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleAddText();
                }
              }}
              placeholder="Describe what you want to visualize — the AI agent can visit URLs, search Google for research, analyze data, and more..."
              rows={3}
              className="w-full rounded-gcard border border-gborder-light dark:border-gborder-dark
                bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark
                px-4 py-3 text-sm placeholder:text-gtext-secondary dark:placeholder:text-gtext-secondary-dark
                focus:outline-none focus:ring-2 focus:ring-gblue-500 focus:ring-offset-2
                transition-all duration-200 resize-none"
            />
            {textValue.trim() && (
              <button
                type="button"
                onClick={handleAddText}
                className="absolute bottom-3 right-3 bg-gblue-600 hover:bg-gblue-700 text-white
                  px-3 py-1.5 rounded-gbtn text-xs font-medium transition-all duration-200
                  inline-flex items-center gap-1 shadow-gcard-sm"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add
              </button>
            )}
          </div>

          {/* Agent capability hints */}
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {[
              { icon: 'link', label: 'Visit URLs' },
              { icon: 'search', label: 'Google Search' },
              { icon: 'analytics', label: 'Analyze data' },
              { icon: 'route', label: 'Plan then render' },
              { icon: 'person_check', label: 'HITL refine' },
            ].map((cap) => (
              <span
                key={cap.label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-gpill
                  text-[11px] font-medium text-gtext-secondary dark:text-gtext-secondary-dark
                  bg-gsurface-light dark:bg-gsurface-elevated-dark
                  border border-gborder-light dark:border-gborder-dark"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{cap.icon}</span>
                {cap.label}
              </span>
            ))}
          </div>

          {/* -- File List -- */}
          {hasFiles && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gtext-secondary dark:text-gtext-secondary-dark">
                  {files.length} {files.length === 1 ? 'file' : 'files'} attached
                </span>
                <button
                  type="button"
                  onClick={() => files.forEach((f) => onRemoveFile(f.id))}
                  className="text-xs font-medium text-gtext-secondary dark:text-gtext-secondary-dark hover:text-gerror transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500 rounded px-1 py-0.5"
                  aria-label="Remove all attached files"
                >
                  Clear all
                </button>
              </div>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 bg-white dark:bg-gsurface-card-dark
                    border border-gborder-light dark:border-gborder-dark rounded-gbtn
                    px-3 py-2.5 group transition-all duration-200 hover:shadow-gcard-sm"
                >
                  {/* Category icon */}
                  <span className="material-symbols-outlined text-xl text-gblue-500 flex-shrink-0">
                    {getCategoryIcon(file.category)}
                  </span>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gtext-primary dark:text-gtext-primary-dark truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Remove button — always visible on touch, hover-reveal on desktop */}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gtext-secondary dark:text-gtext-secondary-dark
                      hover:text-gerror transition-all duration-200 flex-shrink-0 p-1 -mr-1
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500 rounded"
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* -- Try an Example -- */}
          <button
            type="button"
            onClick={onAddSample}
            className="text-sm font-medium text-gblue-600 dark:text-gblue-300
              hover:text-gblue-700 dark:hover:text-gblue-200
              border border-gblue-200 dark:border-gblue-800 rounded-gbtn
              px-4 py-2 transition-all duration-200
              inline-flex items-center gap-1.5
              hover:bg-gblue-50 dark:hover:bg-gblue-900/20"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            Try an Example
          </button>

          {/* -- History / Start from Existing -- */}
          {history.length > 0 && (
            <div className="space-y-3 mt-6">
              <h4 className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider mb-2">
                Start from Existing
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {history.map((entry, index) => {
                  const hasImage = !!entry.imageData;
                  return (
                    <button key={entry.id} type="button" onClick={() => onLoadHistory(entry)} disabled={!hasImage}
                      className={`flex-shrink-0 px-4 py-2 rounded-gpill text-sm font-medium border transition-all duration-200 inline-flex items-center gap-2
                        bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700 cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed`}>
                      <span className="font-semibold">v{history.length - index}</span>
                      <span className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">
                        {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: Configure                                          */}
        {/* ================================================================ */}
        <div className="space-y-6">
          {/* -- Mode Section -- */}
          <section>
            <h4 className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider mb-2">
              Mode
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODE_OPTIONS.map((option) => {
                const isSelected = config.mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      const update: Partial<InfographicConfig> = { mode: option.id as InfographicMode };
                      if (option.defaultAspectRatio) {
                        update.aspectRatio = option.defaultAspectRatio;
                      }
                      onUpdateConfig(update);
                    }}
                    className={`flex items-start p-4 rounded-gcard border cursor-pointer transition-all duration-200 text-left w-full focus-visible:ring-2 focus-visible:ring-gblue-500 focus-visible:outline-none
                      ${
                        isSelected
                          ? 'border-gblue-600 bg-gblue-50 dark:bg-gblue-900/30 dark:border-gblue-500'
                          : 'border-gborder-light dark:border-gborder-dark bg-white dark:bg-gsurface-card-dark hover:border-gblue-300 dark:hover:border-gblue-700'
                      }
                      ${option.id === 'custom' ? 'sm:col-span-2' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`material-symbols-outlined text-xl mt-0.5 ${
                          isSelected
                            ? 'text-gblue-600 dark:text-gblue-400'
                            : 'text-gtext-secondary dark:text-gtext-secondary-dark'
                        }`}
                      >
                        {option.icon}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-gblue-600 dark:text-gblue-300'
                              : 'text-gtext-primary dark:text-gtext-primary-dark'
                          }`}
                        >
                          {option.name}
                        </p>
                        <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark mt-0.5 line-clamp-2">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom mode textarea */}
            {config.mode === 'custom' && (
              <textarea
                value={config.customModeText}
                onChange={(e) => onUpdateConfig({ customModeText: e.target.value })}
                placeholder="Describe the style you envision..."
                rows={3}
                className="mt-2 w-full rounded-gbtn border border-gborder-light dark:border-gborder-dark
                  bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark
                  px-3 py-2 text-sm placeholder:text-gtext-secondary dark:placeholder:text-gtext-secondary-dark
                  focus:outline-none focus:ring-2 focus:ring-gblue-500 focus:ring-offset-2
                  transition-all duration-200 resize-none animate-fade-in"
              />
            )}
          </section>

          {/* -- Aspect Ratio Section -- */}
          <section>
            <h4 className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider mb-2">
              Aspect Ratio
            </h4>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const isSelected = config.aspectRatio === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onUpdateConfig({ aspectRatio: option.id as AspectRatio })}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-gpill
                      border transition-all duration-200 text-sm font-medium focus-visible:ring-2 focus-visible:ring-gblue-500 focus-visible:outline-none
                      ${
                        isSelected
                          ? 'bg-gblue-600 text-white border-gblue-600 dark:bg-gblue-600 dark:border-gblue-500'
                          : 'bg-gsurface-light dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700'
                      }`}
                  >
                    {/* Proportional rectangle */}
                    <div
                      className={`border rounded-sm flex-shrink-0 ${
                        isSelected
                          ? 'border-white/70'
                          : 'border-gtext-secondary/40 dark:border-gtext-secondary-dark/40'
                      }`}
                      style={{
                        aspectRatio: `${option.width}/${option.height}`,
                        height: '18px',
                        minWidth: '6px',
                      }}
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* -- Colors Section -- */}
          <section>
            <h4 className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider mb-2">
              Colors
            </h4>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdateConfig({ colorScheme: 'auto' })}
                className={`px-4 py-2 rounded-gpill text-sm font-medium border transition-all duration-200
                  ${
                    config.colorScheme === 'auto'
                      ? 'bg-gblue-600 text-white border-gblue-600'
                      : 'bg-transparent text-gtext-primary dark:text-gtext-primary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700'
                  }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    colorScheme: 'custom',
                    customColors: config.customColors || {
                      primary: '#4285F4',
                      secondary: '#34A853',
                      accent: '#FBBC04',
                    },
                  })
                }
                className={`px-4 py-2 rounded-gpill text-sm font-medium border transition-all duration-200
                  ${
                    config.colorScheme === 'custom'
                      ? 'bg-gblue-600 text-white border-gblue-600'
                      : 'bg-transparent text-gtext-primary dark:text-gtext-primary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700'
                  }`}
              >
                Custom
              </button>
            </div>

            {config.colorScheme === 'custom' && (
              <div className="flex gap-4 p-3 rounded-gbtn bg-gsurface-light dark:bg-gsurface-elevated-dark border border-gborder-light dark:border-gborder-dark animate-fade-in">
                {[
                  { label: 'Primary', key: 'primary' as const, fallback: '#4285F4' },
                  { label: 'Secondary', key: 'secondary' as const, fallback: '#34A853' },
                  { label: 'Accent', key: 'accent' as const, fallback: '#FBBC04' },
                ].map((c) => (
                  <div key={c.key} className="flex flex-col items-center gap-1.5">
                    <label className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark font-medium">
                      {c.label}
                    </label>
                    <input
                      type="color"
                      value={config.customColors?.[c.key] || c.fallback}
                      onChange={(e) =>
                        onUpdateConfig({
                          customColors: {
                            primary: config.customColors?.primary || '#4285F4',
                            secondary: config.customColors?.secondary || '#34A853',
                            accent: config.customColors?.accent || '#FBBC04',
                            [c.key]: e.target.value,
                          },
                        })
                      }
                      className="w-9 h-9 rounded-gbtn cursor-pointer border border-gborder-light dark:border-gborder-dark"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* -- Instructions Section (collapsed by default) -- */}
          <section>
            <button
              type="button"
              onClick={() => setInstructionsOpen(!instructionsOpen)}
              className="flex items-center gap-1.5 w-full text-left group"
            >
              <span
                className={`material-symbols-outlined text-base text-gtext-secondary dark:text-gtext-secondary-dark
                  transition-transform duration-200 ${instructionsOpen ? 'rotate-90' : ''}`}
              >
                chevron_right
              </span>
              <h4 className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider group-hover:text-gtext-primary dark:group-hover:text-gtext-primary-dark transition-colors">
                Instructions
              </h4>
            </button>

            {instructionsOpen && (
              <textarea
                value={config.specificInstructions}
                onChange={(e) => onUpdateConfig({ specificInstructions: e.target.value })}
                placeholder="Any specific instructions for the infographic..."
                rows={3}
                className="mt-2 w-full rounded-gbtn border border-gborder-light dark:border-gborder-dark
                  bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark
                  px-3 py-2 text-sm placeholder:text-gtext-secondary dark:placeholder:text-gtext-secondary-dark
                  focus:outline-none focus:ring-2 focus:ring-gblue-500 focus:ring-offset-2
                  transition-all duration-200 resize-none animate-fade-in"
              />
            )}
          </section>
        </div>
      </div>

      {/* ---- Full-Width Generate Button ---- */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!hasFiles}
          className={`w-full py-3.5 rounded-gbtn text-base font-semibold
            transition-all duration-200 inline-flex items-center justify-center gap-2
            ${
              hasFiles
                ? 'bg-gradient-to-r from-gblue-600 via-gblue-500 to-ggreen hover:from-gblue-700 hover:via-gblue-600 hover:to-ggreen-600 text-white shadow-gcard-sm hover:shadow-gcard cursor-pointer'
                : 'bg-gradient-to-r from-gblue-600/50 to-ggreen/50 text-white/60 opacity-50 cursor-not-allowed'
            }`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-xl">auto_awesome</span>
          Generate Infographic
        </button>
      </div>
    </div>
  );
}
