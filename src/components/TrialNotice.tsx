import type { TrialStatus } from '../services/geminiService';
import Icon from './Icon';

interface TrialNoticeProps {
  trial: TrialStatus;
  onOpenSettings: () => void;
  className?: string;
}

/**
 * Slim, honest free-trial indicator: shows how many free turns are left on the
 * built-in trial key and offers a one-click path to add your own free key.
 * Renders nothing when the trial isn't the active key source.
 */
export default function TrialNotice({ trial, onOpenSettings, className = '' }: TrialNoticeProps) {
  if (!trial.active) return null;

  const exhausted = trial.exhausted;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs ${
        exhausted ? 'text-gerror' : 'text-gtext-secondary dark:text-gtext-secondary-dark'
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        <Icon name={exhausted ? 'vpn_key' : 'auto_awesome'} className="text-sm" />
        {exhausted ? (
          <span>Free trial used up.</span>
        ) : (
          <span>
            <span className="font-semibold">{trial.remaining}</span> of {trial.limit} free turns left
          </span>
        )}
      </span>
      <span aria-hidden="true" className="hidden sm:inline text-gtext-secondary/40">·</span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="font-medium text-gblue-600 dark:text-gblue-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500 rounded"
      >
        Add your own free key
      </button>
    </div>
  );
}
