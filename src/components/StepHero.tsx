import type { InfographicMode } from '../types';

interface StepHeroProps {
  onGetStarted: () => void;
  onTryExample: () => void;
  onSelectMode: (mode: InfographicMode) => void;
}

const EXAMPLES = [
  { mode: 'data-story' as InfographicMode, label: 'Data Story', icon: 'monitoring', color: 'from-gblue-500 to-gblue-700' },
  { mode: 'executive-summary' as InfographicMode, label: 'Executive Summary', icon: 'business_center', color: 'from-ggreen to-ggreen-600' },
  { mode: 'classroom' as InfographicMode, label: 'Classroom Explainer', icon: 'school', color: 'from-gyellow to-gyellow-600' },
  { mode: 'technical-deep-dive' as InfographicMode, label: 'Technical Deep-Dive', icon: 'biotech', color: 'from-gred to-gred-600' },
];

export default function StepHero({ onGetStarted, onTryExample, onSelectMode }: StepHeroProps) {
  return (
    <div className="max-w-4xl mx-auto text-center space-y-12 py-12 px-4">
      {/* Tagline */}
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-gtext-primary dark:text-gtext-primary-dark leading-tight">
          Turn any content into
          <span className="bg-gradient-to-r from-gblue-500 via-gerror to-gwarning bg-clip-text text-transparent"> beautiful infographics</span>
        </h1>
        <p className="text-lg text-gtext-secondary dark:text-gtext-secondary-dark max-w-2xl mx-auto leading-relaxed">
          Powered by Gemini — upload files, paste URLs, or describe a topic. The AI agent researches, analyzes, and designs your infographic in real-time
        </p>
      </div>

      {/* Example Mode Cards */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider">
          Choose a mode to get started
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.mode}
              type="button"
              onClick={() => onSelectMode(ex.mode)}
              className="group flex flex-col items-center gap-3 p-4 rounded-gcard border border-gborder-light dark:border-gborder-dark
                bg-white dark:bg-gsurface-card-dark hover:border-gblue-300 dark:hover:border-gblue-700
                hover:shadow-gcard-sm transition-all duration-200 cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${ex.color} flex items-center justify-center shadow-gcard-sm
                group-hover:scale-110 transition-transform duration-200`}>
                <span className="material-symbols-outlined text-2xl text-white">{ex.icon}</span>
              </div>
              <span className="text-sm font-medium text-gtext-primary dark:text-gtext-primary-dark">{ex.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          type="button"
          onClick={onGetStarted}
          className="w-full sm:w-auto px-8 py-3.5 rounded-gbtn text-base font-semibold
            bg-gradient-to-r from-gblue-600 via-gblue-500 to-ggreen hover:from-gblue-700 hover:via-gblue-600 hover:to-ggreen-600
            text-white shadow-gcard-sm hover:shadow-gcard
            transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
          Get Started
        </button>
        <button
          type="button"
          onClick={onTryExample}
          className="w-full sm:w-auto px-6 py-3 rounded-gbtn text-sm font-medium
            text-gblue-600 dark:text-gblue-300
            border border-gblue-200 dark:border-gblue-800
            hover:bg-gblue-50 dark:hover:bg-gblue-900/20
            transition-all duration-200 inline-flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          Try an Example
        </button>
      </div>

      {/* How it works */}
      <div className="pt-8 border-t border-gborder-light dark:border-gborder-dark">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 max-w-3xl mx-auto">
          {[
            { icon: 'upload_file', title: 'Upload or Describe', desc: 'Drop files, paste URLs, or describe a topic to research' },
            { icon: 'tune', title: 'Configure', desc: 'Pick a mode and customize settings' },
            { icon: 'auto_awesome', title: 'Generate', desc: 'Watch AI think and design in real-time' },
          ].map((step) => (
            <div key={step.title} className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl text-gblue-500">{step.icon}</span>
              <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark">{step.title}</h3>
              <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
