// === Step Types ===
export type StepType = 'hero' | 'create' | 'studio';
export type GenerationPhase = 'idle' | 'preparing' | 'generating' | 'complete';
export type AgentLoopPhaseId = 'intake' | 'research' | 'plan' | 'render' | 'review' | 'refine';
export type AgentLoopPhaseStatus = 'pending' | 'active' | 'complete';
export type AgentLoopStateBackend = 'browser-local' | 'enterprise-interactions-ready';

// === Infographic Mode Types ===
export type InfographicMode =
  | 'technical-deep-dive'
  | 'data-story'
  | 'executive-summary'
  | 'classroom'
  | 'quick-slide'
  | 'custom';
export type AspectRatio = '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | '1:4';
export type ImageResolution = '0.5K' | '1K' | '2K';

// === File Types ===
export type FileCategory = 'document' | 'spreadsheet' | 'image' | 'text';

export interface UploadedFile {
  id: string;
  name: string;
  base64: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  preview?: string;
}

// === Agent Output Types ===
export interface PrepareResult {
  analysis: {
    title: string;
    subtitle: string;
    sectionsCount: number;
    dataPointsCount: number;
    brandColors: string[];
    sourceAttribution: string;
  };
  prompt: string;
  allTextStrings: string[];
}

// === Generation Types ===
export interface GenerationResult {
  imageData: string;
  description: string;
  prompt: string;
  filename?: string;
}

// === Streaming Types ===
export interface ThoughtBubble {
  id: string;
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// === Agent Loop State ===
export interface AgentLoopPhase {
  id: AgentLoopPhaseId;
  label: string;
  status: AgentLoopPhaseStatus;
  detail: string;
}

export interface AgentLoopState {
  sessionId: string;
  turn: number;
  goal: string;
  stopRule: string;
  stateBackend: AgentLoopStateBackend;
  hitlStatus: 'awaiting-input' | 'running' | 'not-started';
  interactionId?: string;
  previousInteractionId?: string;
  phases: AgentLoopPhase[];
}

// === Configuration ===
export interface AdminConfig {
  geminiApiKey: string;
  orchestratorModel: string;
  imageGenModel: string;
  thinkingLevel: 'LOW' | 'HIGH';
  imageResolution: ImageResolution;
  timeoutSeconds: number;
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  geminiApiKey: '',
  orchestratorModel: 'gemini-3.5-flash',
  imageGenModel: 'gemini-3.1-flash-lite-image',
  thinkingLevel: 'LOW',
  imageResolution: '0.5K',
  timeoutSeconds: 180,
};

// === User Configuration ===
export interface InfographicConfig {
  mode: InfographicMode;
  customModeText: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  colorScheme: 'auto' | 'custom';
  customColors?: { primary: string; secondary: string; accent: string };
  specificInstructions: string;
}

export const DEFAULT_INFOGRAPHIC_CONFIG: InfographicConfig = {
  mode: 'data-story',
  customModeText: '',
  aspectRatio: '9:16',
  resolution: '0.5K',
  colorScheme: 'auto',
  specificInstructions: '',
};

// === App State ===
export interface AppState {
  step: StepType;
  files: UploadedFile[];
  config: InfographicConfig;
  prepareResult: PrepareResult | null;
  currentResult: GenerationResult | null;
  history: HistoryEntry[];
  theme: 'light' | 'dark';
  generationPhase: GenerationPhase;
  adminConfig: AdminConfig;
  streamingText: string;
  error: string | null;
  thoughtBubbles: ThoughtBubble[];
  chatMessages: ChatMessage[];
  refineThoughts: ThoughtBubble[];
  isProcessingFiles: boolean;
  agentLoop: AgentLoopState;
}

export interface HistoryEntry {
  id: string;
  imageData: string;
  config: InfographicConfig;
  timestamp: number;
  title: string;
  filename?: string;
}

// === Mode Options ===
export interface ModeOption {
  id: InfographicMode;
  name: string;
  description: string;
  icon: string;
  promptHint: string;
  defaultAspectRatio?: AspectRatio;
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'technical-deep-dive',
    name: 'Technical Deep-Dive',
    description: 'Architecture, systems, code flows — precise and detailed',
    icon: 'biotech',
    promptHint: 'Dense, precise, uses technical terminology. Include architecture diagrams, code snippets in monospace, system flow arrows.',
  },
  {
    id: 'data-story',
    name: 'Data Story',
    description: 'Charts, statistics, trends — numbers that tell a story',
    icon: 'monitoring',
    promptHint: 'Data-forward layout with charts, graphs, statistical callouts, trend lines, percentage highlights.',
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'Key metrics, strategic insights — clean and board-ready',
    icon: 'business_center',
    promptHint: 'Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.',
    defaultAspectRatio: '4:3',
  },
  {
    id: 'classroom',
    name: 'Classroom Explainer',
    description: 'Step-by-step teaching — visual, friendly, illustrative',
    icon: 'school',
    promptHint: 'Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.',
  },
  {
    id: 'quick-slide',
    name: 'Quick Slide',
    description: 'Presentation-ready single slide — high visual impact',
    icon: 'slideshow',
    promptHint: 'Single-slide format with minimal text, high visual impact, presentation-ready. Large typography.',
    defaultAspectRatio: '16:9',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Full creative control — describe your vision',
    icon: 'tune',
    promptHint: '',
  },
];

// === Quick Action Chips per Mode ===
export const QUICK_ACTIONS: Record<InfographicMode, string[]> = {
  'technical-deep-dive': ['Add diagram', 'More detail', 'Add code snippet'],
  'data-story': ['Add more charts', 'Highlight key stat', 'Add trend line'],
  'executive-summary': ['Simplify further', 'Add key metric', 'Make more formal'],
  'classroom': ['Add step numbers', 'More illustrations', 'Simplify language'],
  'quick-slide': ['Larger text', 'More visual impact', 'Reduce clutter'],
  'custom': [],
};

export const GENERAL_QUICK_ACTIONS = ['More colorful', 'Larger text', 'Change layout', 'Add source citations'];

export const ASPECT_RATIO_OPTIONS: { id: AspectRatio; label: string; description: string; width: number; height: number }[] = [
  { id: '1:1', label: 'Square', description: 'Social media posts', width: 1, height: 1 },
  { id: '9:16', label: 'Tall Portrait', description: 'Stories, mobile', width: 9, height: 16 },
  { id: '3:4', label: 'Portrait', description: 'Standard portrait', width: 3, height: 4 },
  { id: '1:4', label: 'Extra Tall', description: 'Long-form infographic', width: 1, height: 4 },
  { id: '16:9', label: 'Landscape', description: 'Presentations', width: 16, height: 9 },
  { id: '4:3', label: 'Wide', description: 'Standard landscape', width: 4, height: 3 },
];

export const MAX_FILES = 14;
export const MAX_FILE_SIZE_MB = 20;
export const MAX_TOTAL_SIZE_MB = 50;
