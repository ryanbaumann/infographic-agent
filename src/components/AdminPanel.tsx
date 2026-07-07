import type { AdminConfig, ImageResolution } from '../types';
import { DEFAULT_ADMIN_CONFIG } from '../types';

const isMasterView = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'master';
const isProdDeploy = import.meta.env.PROD || import.meta.env.VITE_PRODUCTION_DEPLOY === 'true';
const allowQualityModel = isMasterView && !isProdDeploy;

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
  const resolutions: ImageResolution[] = ['0.5K', '1K', '2K', '4K'];

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
            disabled={!allowQualityModel}
          >
            <option value="gemini-3.1-flash-lite-image">gemini-3.1-flash-lite-image (Fast)</option>
            {allowQualityModel && (
              <option value="gemini-3.1-flash-image">gemini-3.1-flash-image (Quality)</option>
            )}
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
