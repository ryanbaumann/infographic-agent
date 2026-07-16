import { useState } from 'react';
import { useInfographicFlow } from './hooks/useInfographicFlow';
import { getTrialStatus } from './services/geminiService';
import Icon from './components/Icon';
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
  const trial = getTrialStatus(state.adminConfig);

  return (
    <div className="min-h-screen flex flex-col bg-gsurface-light dark:bg-gsurface-dark transition-colors duration-300"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gsurface-dark/80 backdrop-blur-md border-b border-gborder-light dark:border-gborder-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
              <Icon name="insert_chart" className="text-2xl text-gblue-600" />
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
                    <Icon name={icon} className="text-base sm:text-sm" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <ThemeToggle theme={state.theme} onToggle={flow.toggleTheme} />
              <a
                href="https://github.com/ryanbaumann/infographic-agent"
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500"
                title="GitHub Repository"
                aria-label="GitHub Repository"
              >
                <svg className="w-5 h-5 fill-gtext-secondary dark:fill-gtext-secondary-dark" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              </a>
              <button
                onClick={() => setShowAdmin(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500"
                title="Settings"
                aria-label="Open settings"
              >
                <Icon name="settings" className="text-xl text-gtext-secondary dark:text-gtext-secondary-dark" />
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
            trial={trial}
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
            trial={trial}
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
            onDownload={flow.handleDownload}
            onReset={flow.reset}
            history={state.history}
            onLoadHistory={flow.loadHistoryEntry}
            thoughtBubbles={state.thoughtBubbles}
            chatMessages={state.chatMessages}
            refineThoughts={state.refineThoughts}
            agentLoop={state.agentLoop}
            mode={state.config.mode}
            aspectRatio={state.config.aspectRatio}
            onOpenSettings={() => setShowAdmin(true)}
            trial={trial}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gborder-light dark:border-gborder-dark py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gtext-secondary dark:text-gtext-secondary-dark flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>Powered by Gemini API</span>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://github.com/ryanbaumann/infographic-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gblue-600 dark:text-gblue-300 hover:underline inline-flex items-center gap-1"
          >
            GitHub Repository
          </a>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://github.com/ryanbaumann/infographic-agent/tree/main/skill/infographic-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gblue-600 dark:text-gblue-300 hover:underline inline-flex items-center gap-1"
            title="Install as a tool into your AI coding agent"
          >
            Agent Skill (<code>npx skills add</code>)
          </a>
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
