import { useState } from 'react';
import { useInfographicFlow } from './hooks/useInfographicFlow';
import ThemeToggle from './components/ThemeToggle';
import AdminPanel from './components/AdminPanel';
import StepHero from './components/StepHero';
import StepCreate from './components/StepCreate';
import StepStudio from './components/StepStudio';

export default function App() {
  const flow = useInfographicFlow();
  const { state } = flow;
  const [showAdmin, setShowAdmin] = useState(false);

  const isStudioDisabled = !state.currentResult && state.generationPhase === 'idle';

  return (
    <div className="min-h-screen flex flex-col bg-gsurface-light dark:bg-gsurface-dark transition-colors duration-300"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gsurface-dark/80 backdrop-blur-md border-b border-gborder-light dark:border-gborder-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-gblue-600">insert_chart</span>
              <span className="font-semibold text-xl text-gtext-primary dark:text-gtext-primary-dark hidden sm:inline">
                Infographic Agent
              </span>
            </div>

            {/* Center: Segmented control */}
            <div className="flex items-center bg-gsurface-light dark:bg-gsurface-dark rounded-full p-1">
              {([
                { step: 'hero' as const, label: 'Home', icon: 'home', onClick: () => flow.setStep('hero'), disabled: false },
                { step: 'create' as const, label: 'Create', icon: 'add_circle', onClick: () => flow.setStep('create'), disabled: false },
                { step: 'studio' as const, label: 'Studio', icon: 'auto_awesome', onClick: () => !isStudioDisabled && flow.setStep('studio'), disabled: isStudioDisabled },
              ]).map(({ step, label, icon, onClick, disabled }) => {
                const isActive = state.step === step;
                return (
                  <button
                    key={step}
                    onClick={onClick}
                    disabled={disabled}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={disabled ? `${label} (generate an infographic first)` : `Go to ${label}`}
                    title={disabled ? 'Generate an infographic first' : label}
                    className={`px-2 sm:px-4 py-1.5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-200 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500 ${
                      isActive
                        ? 'bg-white dark:bg-gsurface-elevated-dark text-gblue-600 shadow-sm'
                        : disabled
                          ? 'text-gtext-secondary/40 dark:text-gtext-secondary-dark/40 cursor-not-allowed'
                          : 'text-gtext-secondary dark:text-gtext-secondary-dark'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-base sm:text-sm">{icon}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <ThemeToggle theme={state.theme} onToggle={flow.toggleTheme} />
              <button
                onClick={() => setShowAdmin(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500"
                title="Settings"
                aria-label="Open settings"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-gtext-secondary dark:text-gtext-secondary-dark">
                  settings
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {state.step === 'hero' && (
          <StepHero
            onGetStarted={() => flow.setStep('create')}
            onTryExample={() => {
              flow.addSampleData();
              flow.setStep('create');
            }}
            onSelectMode={(mode) => {
              flow.updateConfig({ mode });
              flow.setStep('create');
            }}
          />
        )}
        {state.step === 'create' && (
          <StepCreate
            files={state.files}
            config={state.config}
            onAddFiles={flow.addFiles}
            onRemoveFile={flow.removeFile}
            onUpdateConfig={flow.updateConfig}
            onGenerate={flow.handleGenerate}
            onAddSample={flow.addSampleData}
            onAddTextContext={flow.addTextContext}
            error={state.error}
            onClearError={flow.clearError}
            history={state.history}
            onLoadHistory={flow.loadHistoryEntry}
            onOpenSettings={() => setShowAdmin(true)}
          />
        )}
        {state.step === 'studio' && (
          <StepStudio
            phase={state.generationPhase}
            streamingText={state.streamingText}
            prepareResult={state.prepareResult}
            currentResult={state.currentResult}
            error={state.error}
            onClearError={flow.clearError}
            onRefine={flow.handleRefine}
            onUpgradeResolution={flow.handleUpgradeResolution}
            onDownload={flow.handleDownload}
            onReset={flow.reset}
            history={state.history}
            onLoadHistory={flow.loadHistoryEntry}
            thoughtBubbles={state.thoughtBubbles}
            chatMessages={state.chatMessages}
            refineThoughts={state.refineThoughts}
            mode={state.config.mode}
            aspectRatio={state.config.aspectRatio}
            onOpenSettings={() => setShowAdmin(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gborder-light dark:border-gborder-dark py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gtext-secondary dark:text-gtext-secondary-dark">
          Powered by Gemini 3.1 Flash Image
        </div>
      </footer>

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel
          config={state.adminConfig}
          onUpdate={flow.updateAdminConfig}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
