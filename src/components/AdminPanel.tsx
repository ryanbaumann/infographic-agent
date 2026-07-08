import { useState } from 'react';
import type { AdminConfig, ImageResolution } from '../types';
import { DEFAULT_ADMIN_CONFIG } from '../types';
import { saveApiKey, clearApiKey, hasApiKey, getTrialTurnsCount } from '../services/geminiService';

interface AdminPanelProps {
  config: AdminConfig;
  onUpdate: (partial: Partial<AdminConfig>) => void;
  onClose: () => void;
}

const inputClasses =
  'w-full px-3 py-2 rounded-gbtn border border-gborder-light dark:border-gborder-dark bg-white dark:bg-gsurface-card-dark text-gtext-primary dark:text-gtext-primary-dark focus:ring-2 focus:ring-gblue-500 focus:border-transparent outline-none';

const labelClasses = 'block text-sm font-medium text-gtext-secondary dark:text-gtext-secondary-dark mb-1.5';

const sectionClasses = 'p-6 border-b border-gborder-light dark:border-gborder-dark';

export default function AdminPanel({ config, onUpdate, onClose }: AdminPanelProps) {
  const thinkingLevels: AdminConfig['thinkingLevel'][] = ['LOW', 'HIGH'];
  const resolutions: ImageResolution[] = ['0.5K', '1K', '2K'];
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyIsSet, setKeyIsSet] = useState(() => hasApiKey(config));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-white dark:bg-gsurface-card-dark shadow-2xl animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gborder-light dark:border-gborder-dark">
          <h2 className="text-xl font-bold text-gtext-primary dark:text-gtext-primary-dark">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Gemini API Key */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Gemini API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={keyIsSet ? 'Key saved — paste a new key to replace it' : 'Paste your Gemini API key'}
              className={inputClasses}
              autoComplete="off"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-2 rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark transition-colors"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              <span className="material-symbols-outlined text-xl">{showKey ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                saveApiKey(keyDraft.trim());
                setKeyDraft('');
                setKeyIsSet(true);
              }}
              disabled={!keyDraft.trim()}
              className="flex-1 px-3 py-2 rounded-gbtn text-sm font-medium bg-gblue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save key
            </button>
            {keyIsSet && (
              <button
                onClick={() => {
                  clearApiKey();
                  setKeyIsSet(false);
                }}
                className="flex-1 px-3 py-2 rounded-gbtn text-sm font-medium bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark transition-colors"
              >
                Clear key
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gtext-secondary dark:text-gtext-secondary-dark">
            Stored only in your browser (localStorage) and sent only to Google&apos;s Gemini API. Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-gblue-600 dark:text-gblue-300 underline">
              aistudio.google.com/apikey
            </a>
            .
          </p>
          {import.meta.env.VITE_GEMINI_API_KEY && !keyIsSet && (
            <div className={`mt-3 p-2.5 rounded-gbtn text-xs border ${
              getTrialTurnsCount() >= 5
                ? 'bg-gerror-50 dark:bg-gerror/10 border-gerror/20 text-gerror'
                : 'bg-gblue-50 dark:bg-gblue-950/20 border-gblue-100 dark:border-gblue-900/30 text-gblue-600 dark:text-gblue-300'
            }`}>
              {getTrialTurnsCount() >= 5 ? (
                <span>
                  <span className="font-semibold">Trial Expired:</span> 5/5 turns used. Please save your own API key to continue.
                </span>
              ) : (
                <span>
                  <span className="font-semibold">Free Trial:</span> {getTrialTurnsCount()}/5 turns used.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Orchestrator Model */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Analysis Model</label>
          <select
            value={config.orchestratorModel}
            onChange={(e) => onUpdate({ orchestratorModel: e.target.value })}
            className={inputClasses}
            disabled
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash</option>
          </select>
        </div>

        {/* Image Generation Model */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Image Model</label>
          <select
            value={config.imageGenModel}
            onChange={(e) => onUpdate({ imageGenModel: e.target.value })}
            className={inputClasses}
            disabled
          >
            <option value="gemini-3.1-flash-lite-image">gemini-3.1-flash-lite-image (Fast)</option>
          </select>
        </div>

        {/* Thinking Level */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Thinking Level</label>
          <div className="flex gap-2">
            {thinkingLevels.map((level) => (
              <button
                key={level}
                onClick={() => onUpdate({ thinkingLevel: level })}
                className={`flex-1 px-3 py-2 rounded-gbtn text-sm font-medium transition-colors ${
                  config.thinkingLevel === level
                    ? 'bg-gblue-500 text-white'
                    : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark hover:bg-gsurface-light/80 dark:hover:bg-gsurface-elevated-dark/80'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Default Resolution */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Default Resolution</label>
          <div className="flex gap-2">
            {resolutions.map((res) => (
              <button
                key={res}
                onClick={() => onUpdate({ imageResolution: res })}
                className={`flex-1 px-3 py-2 rounded-gbtn text-sm font-medium transition-colors ${
                  config.imageResolution === res
                    ? 'bg-gblue-500 text-white'
                    : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark hover:bg-gsurface-light/80 dark:hover:bg-gsurface-elevated-dark/80'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Timeout */}
        <div className={sectionClasses}>
          <label className={labelClasses}>Timeout (seconds)</label>
          <input
            type="number"
            min={30}
            max={600}
            value={config.timeoutSeconds}
            onChange={(e) => onUpdate({ timeoutSeconds: parseInt(e.target.value) })}
            className={inputClasses}
          />
        </div>

        {/* Footer */}
        <div className="p-6">
          <button
            onClick={() => {
              onUpdate(DEFAULT_ADMIN_CONFIG);
            }}
            className="w-full px-4 py-2 rounded-gbtn border-2 border-gborder-light dark:border-gborder-dark text-gtext-secondary dark:text-gtext-secondary-dark hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark font-medium transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </>
  );
}
