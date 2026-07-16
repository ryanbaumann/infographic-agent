import type { InfographicMode } from '../types';
import type { TrialStatus } from '../services/geminiService';
import Icon from './Icon';

interface StepHeroProps {
  onGetStarted: () => void;
  onTryExample: () => void;
  onSelectMode: (mode: InfographicMode) => void;
  trial: TrialStatus;
}

const EXAMPLES = [
  { mode: 'data-story' as InfographicMode, label: 'Data Story', icon: 'monitoring', color: 'from-gblue-500 to-gblue-700' },
  { mode: 'executive-summary' as InfographicMode, label: 'Executive Summary', icon: 'business_center', color: 'from-ggreen to-ggreen-600' },
  { mode: 'classroom' as InfographicMode, label: 'Classroom Explainer', icon: 'school', color: 'from-gyellow to-gyellow-600' },
  { mode: 'technical-deep-dive' as InfographicMode, label: 'Technical Deep-Dive', icon: 'biotech', color: 'from-gred to-gred-600' },
];

export default function StepHero({ onGetStarted, onTryExample, onSelectMode, trial }: StepHeroProps) {
  return (
    <div className="max-w-4xl mx-auto text-center space-y-8 py-8 sm:space-y-12 sm:py-12 px-4">
      {/* Tagline */}
      <div className="space-y-3 sm:space-y-4">
        <h1 className="text-3xl sm:text-5xl font-bold text-gtext-primary dark:text-gtext-primary-dark leading-tight">
          Turn any content into
          <span className="bg-gradient-to-r from-gblue-500 via-gerror to-gwarning bg-clip-text text-transparent"> beautiful infographics</span>
        </h1>
        <p className="text-base sm:text-lg text-gtext-secondary dark:text-gtext-secondary-dark max-w-2xl mx-auto leading-relaxed">
          Powered by Gemini — upload files, paste URLs, or describe a topic. The AI agent researches, analyzes, and designs your infographic in real-time
        </p>
        <p className="text-sm text-gtext-secondary dark:text-gtext-secondary-dark inline-flex items-center gap-1.5 justify-center">
          <Icon name="verified" className="text-base text-gsuccess" />
          {trial.active
            ? `Free to try — ${trial.remaining} generations on us, then add your own free Gemini key. Your key stays in your browser.`
            : 'Free and open source — runs on your own free Gemini key, stored only in your browser.'}
        </p>
      </div>

      {/* CTAs — primary action first so it stays above the fold on mobile */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          type="button"
          onClick={onGetStarted}
          className="w-full sm:w-auto px-8 py-3.5 rounded-gbtn text-base font-semibold
            bg-gradient-to-r from-gblue-600 via-gblue-500 to-ggreen hover:from-gblue-700 hover:via-gblue-600 hover:to-ggreen-600
            text-white shadow-gcard-sm hover:shadow-gcard
            transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
        >
          <Icon name="arrow_forward" className="text-xl" />
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
          <Icon name="auto_awesome" className="text-base" />
          Try an Example
        </button>
      </div>

      {/* Example Mode Cards — quick shortcuts into a specific mode */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider">
          Or jump straight into a mode
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
                <Icon name={ex.icon} className="text-2xl text-white" />
              </div>
              <span className="text-sm font-medium text-gtext-primary dark:text-gtext-primary-dark">{ex.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CLI Skill Install Chip */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gtext-secondary dark:text-gtext-secondary-dark uppercase tracking-wider">
          Use from any AI coding agent
        </span>
        <a
          href="https://github.com/ryanbaumann/infographic-agent/tree/main/skill/infographic-agent"
          target="_blank"
          rel="noopener noreferrer"
          id="npx-skills-install-link"
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-gpill
            bg-gsurface-light dark:bg-gsurface-card-dark
            border border-gborder-light dark:border-gborder-dark
            hover:border-gblue-300 dark:hover:border-gblue-700
            hover:bg-white dark:hover:bg-gsurface-elevated-dark
            transition-all duration-200 cursor-pointer shadow-gcard-sm hover:shadow-gcard"
        >
          <Icon name="terminal" className="text-base text-gblue-500 group-hover:text-gblue-600 dark:text-gblue-400 transition-colors" />
          <code className="text-xs font-mono font-semibold text-gtext-primary dark:text-gtext-primary-dark">
            npx skills add ryanbaumann/infographic-agent
          </code>
          <Icon name="open_in_new" className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark group-hover:text-gblue-500 transition-colors" />
        </a>
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
              <Icon name={step.icon} className="text-3xl text-gblue-500" />
              <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark">{step.title}</h3>
              <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
