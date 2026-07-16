import {
  Plus,
  PlusCircle,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Briefcase,
  MessageSquare,
  CheckCircle2,
  X,
  GitCompare,
  Moon,
  Sun,
  Download,
  GripHorizontal,
  AlertCircle,
  Maximize2,
  History,
  Home,
  Link as LinkIcon,
  Activity,
  UserCheck,
  LoaderCircle,
  Brain,
  Circle,
  Route,
  GraduationCap,
  Search,
  Send,
  Presentation,
  RefreshCw,
  Timer,
  SlidersHorizontal,
  Upload,
  BadgeCheck,
  KeyRound,
  TriangleAlert,
  Award,
  FileText,
  Table2,
  Image as ImageIcon,
  Newspaper,
  BarChart3,
  Sparkle,
  Settings,
  Terminal,
  ExternalLink,
  ChevronRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps the Material Symbols ligature names the app was written against to
 * inline lucide-react SVG icons. Inline SVGs ship in the bundle, so icons
 * render instantly and reliably with zero network dependency — no icon-font
 * request that can be blocked, delayed, or fall back to raw ligature text.
 */
const ICONS: Record<string, LucideIcon> = {
  add: Plus,
  add_circle: PlusCircle,
  analytics: BarChart3,
  arrow_forward: ArrowRight,
  auto_awesome: Sparkles,
  biotech: FlaskConical,
  business_center: Briefcase,
  chat: MessageSquare,
  check_circle: CheckCircle2,
  close: X,
  compare: GitCompare,
  dark_mode: Moon,
  description: FileText,
  download: Download,
  drag_handle: GripHorizontal,
  error: AlertCircle,
  fullscreen: Maximize2,
  high_quality: Sparkle,
  history: History,
  home: Home,
  image: ImageIcon,
  insert_chart: BarChart3,
  light_mode: Sun,
  link: LinkIcon,
  monitoring: Activity,
  person_check: UserCheck,
  progress_activity: LoaderCircle,
  psychology: Brain,
  radio_button_unchecked: Circle,
  route: Route,
  school: GraduationCap,
  search: Search,
  send: Send,
  settings: Settings,
  slideshow: Presentation,
  sync: RefreshCw,
  table_chart: Table2,
  timer: Timer,
  tune: SlidersHorizontal,
  upload_file: Upload,
  verified: BadgeCheck,
  vpn_key: KeyRound,
  warning: TriangleAlert,
  workspace_premium: Award,
  article: Newspaper,
  terminal: Terminal,
  open_in_new: ExternalLink,
  chevron_right: ChevronRight,
  check: Check,
  content_copy: Copy,
  visibility: Eye,
  visibility_off: EyeOff,
};

interface IconProps {
  name: string;
  className?: string;
  /** Optional accessible label. When omitted the icon is decorative (aria-hidden). */
  label?: string;
  strokeWidth?: number;
}

/**
 * Renders a named icon as an inline SVG sized to 1em, so surrounding
 * `text-*` font-size classes control its dimensions just like the old
 * icon font did. Color follows `currentColor` via text-color classes.
 */
export default function Icon({ name, className, label, strokeWidth = 2 }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) {
    if (import.meta.env.DEV) console.warn(`[Icon] Unknown icon name: "${name}"`);
    return null;
  }
  return (
    <Cmp
      className={className}
      width="1em"
      height="1em"
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
