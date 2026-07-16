import Icon from './Icon';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-gbtn hover:bg-gsurface-light dark:hover:bg-gsurface-elevated-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon name={theme === 'light' ? 'dark_mode' : 'light_mode'} className="text-xl text-gtext-secondary dark:text-gtext-secondary-dark" />
    </button>
  );
}
