import { useState, useCallback, useEffect } from 'react';
import type { AppState, InfographicConfig, AdminConfig, UploadedFile, GenerationResult, ThoughtBubble, ChatMessage, ImageResolution, AgentLoopPhaseId, AgentLoopState } from '../types';
import { DEFAULT_ADMIN_CONFIG, DEFAULT_INFOGRAPHIC_CONFIG, MAX_FILES, MAX_FILE_SIZE_MB, MAX_TOTAL_SIZE_MB } from '../types';
import type { StepType } from '../types';
import { processFile } from '../services/fileProcessor';
import { prepareInfographic, generateInfographic, refineInfographic, generateFilename, incrementTrialTurns } from '../services/geminiService';
import { downloadImage } from '../services/downloadService';
import localforage from 'localforage';

interface ApiContentPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

interface ApiContent {
  role: 'user' | 'model';
  parts: ApiContentPart[];
}

const ADMIN_STORAGE_KEY = 'infographic-admin-config';
const THEME_STORAGE_KEY = 'infographic-theme';
const HISTORY_STORAGE_KEY = 'infographic-history';
const CONFIG_STORAGE_KEY = 'infographic-user-config';
const HAS_VISITED_KEY = 'infographic-has-visited';
const SUPPORTED_RESOLUTIONS: ImageResolution[] = ['0.5K', '1K', '2K'];

const LOOP_PHASES: Array<{ id: AgentLoopPhaseId; label: string; detail: string }> = [
  { id: 'intake', label: 'Intake', detail: 'Collect source files, URLs, text, and generation preferences.' },
  { id: 'research', label: 'Research', detail: 'Ground claims with uploaded content, Google Search, and URL context when needed.' },
  { id: 'plan', label: 'Plan', detail: 'Finalize text, facts, layout hierarchy, palette, and image prompt.' },
  { id: 'render', label: 'Render', detail: 'Send the verified prompt and references to the image model.' },
  { id: 'review', label: 'Review', detail: 'Hold the current artifact for human approval or targeted feedback.' },
  { id: 'refine', label: 'Refine', detail: 'Apply one requested edit while preserving unchanged content.' },
];

function createAgentLoopState({
  sessionId = `loop_${Date.now()}`,
  turn = 0,
  activePhase = 'intake',
  goal = 'Create an infographic from user-provided context.',
  stopRule = 'Stop after a rendered draft; continue only when the user asks for a refinement.',
  hitlStatus,
  interactionId,
  previousInteractionId,
}: {
  sessionId?: string;
  turn?: number;
  activePhase?: AgentLoopPhaseId;
  goal?: string;
  stopRule?: string;
  hitlStatus?: AgentLoopState['hitlStatus'];
  interactionId?: string;
  previousInteractionId?: string;
} = {}): AgentLoopState {
  const activeIndex = LOOP_PHASES.findIndex(phase => phase.id === activePhase);
  const phases = LOOP_PHASES.map((phase, index) => {
    let status: AgentLoopState['phases'][number]['status'] = 'pending';
    if (activePhase === 'refine') {
      status = phase.id === 'refine' ? 'active' : 'complete';
    } else if (activeIndex >= 0) {
      if (index < activeIndex) status = 'complete';
      if (index === activeIndex) status = 'active';
    }
    return { ...phase, status };
  });

  return {
    sessionId,
    turn,
    goal,
    stopRule,
    stateBackend: 'browser-local',
    hitlStatus: hitlStatus ?? (activePhase === 'review' ? 'awaiting-input' : 'running'),
    interactionId,
    previousInteractionId,
    phases,
  };
}

function buildLoopGoal(config: InfographicConfig, filesCount: number): string {
  return `Create a ${config.mode} infographic from ${filesCount} source ${filesCount === 1 ? 'item' : 'items'}.`;
}

function normalizeResolution(value: unknown): ImageResolution {
  return SUPPORTED_RESOLUTIONS.includes(value as ImageResolution)
    ? value as ImageResolution
    : DEFAULT_INFOGRAPHIC_CONFIG.resolution;
}

function loadHasVisited(): boolean {
  try {
    return localStorage.getItem(HAS_VISITED_KEY) === 'true';
  } catch { return false; }
}

function safePersist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // QuotaExceededError or SecurityError — silently ignore.
  }
}

function loadAdminConfig(): AdminConfig {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Enforce gemini-3.5-flash as the default and only supported analysis model
      parsed.orchestratorModel = 'gemini-3.5-flash';
      // Enforce gemini-3.1-flash-lite-image as the only supported image model
      parsed.imageGenModel = 'gemini-3.1-flash-lite-image';
      parsed.imageResolution = normalizeResolution(parsed.imageResolution);
      return { ...DEFAULT_ADMIN_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_ADMIN_CONFIG };
}

function loadTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return 'light';
}

function loadUserConfig(): InfographicConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.resolution = normalizeResolution(parsed.resolution);
      return { ...DEFAULT_INFOGRAPHIC_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_INFOGRAPHIC_CONFIG };
}



function suggestMode(files: UploadedFile[]): InfographicConfig['mode'] | null {
  if (files.some(f => f.category === 'spreadsheet')) return 'data-story';
  if (files.some(f => f.category === 'document')) return 'executive-summary';
  return null;
}

const initialState: AppState = {
  step: loadHasVisited() ? 'create' : 'hero',
  files: [],
  config: loadUserConfig(),
  prepareResult: null,
  currentResult: null,
  history: [],
  theme: loadTheme(),
  generationPhase: 'idle',
  adminConfig: loadAdminConfig(),
  streamingText: '',
  error: null,
  thoughtBubbles: [],
  chatMessages: [],
  refineThoughts: [],
  isProcessingFiles: false,
  agentLoop: createAgentLoopState({ hitlStatus: 'not-started' }),
};

export function useInfographicFlow() {
  const [state, setState] = useState<AppState>(initialState);

  // Persist theme
  useEffect(() => {
    safePersist(THEME_STORAGE_KEY, state.theme);
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  // Persist admin config
  useEffect(() => {
    safePersist(ADMIN_STORAGE_KEY, JSON.stringify(state.adminConfig));
  }, [state.adminConfig]);

  // Persist user config
  useEffect(() => {
    safePersist(CONFIG_STORAGE_KEY, JSON.stringify(state.config));
  }, [state.config]);

  // Load history from IndexedDB on mount
  useEffect(() => {
    localforage.getItem<AppState['history']>(HISTORY_STORAGE_KEY).then(stored => {
      if (stored && Array.isArray(stored)) {
        setState(s => ({ ...s, history: stored }));
      }
    }).catch(() => {});
  }, []);

  // Persist history to IndexedDB
  useEffect(() => {
    if (state.history.length > 0) {
      localforage.setItem(HISTORY_STORAGE_KEY, state.history).catch(() => {});
    }
  }, [state.history]);

  const addFiles = useCallback(async (rawFiles: File[]) => {
    setState(s => ({ ...s, isProcessingFiles: true }));
    
    try {
      const validRawFiles: File[] = [];
      let totalSizeAccumulator = state.files.reduce((sum, f) => sum + f.size, 0);

      for (const file of rawFiles) {
        if (state.files.length + validRawFiles.length >= MAX_FILES) break;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue;
        
        if (totalSizeAccumulator + file.size > MAX_TOTAL_SIZE_MB * 1024 * 1024) continue;
        
        validRawFiles.push(file);
        totalSizeAccumulator += file.size;
      }

      const processedFiles = await Promise.all(validRawFiles.map(f => processFile(f)));

      if (processedFiles.length > 0) {
        setState(s => {
          const allFiles = [...s.files, ...processedFiles];
          const suggested = suggestMode(allFiles);
          const shouldAutoSet = suggested && s.config.mode === DEFAULT_INFOGRAPHIC_CONFIG.mode;
          return {
            ...s,
            files: allFiles,
            config: shouldAutoSet ? { ...s.config, mode: suggested } : s.config,
          };
        });
      }
    } finally {
      setState(s => ({ ...s, isProcessingFiles: false }));
    }
  }, [state.files]);

  const removeFile = useCallback((id: string) => {
    setState(s => ({ ...s, files: s.files.filter(f => f.id !== id) }));
  }, []);

  const updateConfig = useCallback((partial: Partial<InfographicConfig>) => {
    setState(s => ({ ...s, config: { ...s.config, ...partial } }));
  }, []);

  const setStep = useCallback((step: StepType) => {
    setState(s => ({ ...s, step }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const updateAdminConfig = useCallback((partial: Partial<AdminConfig>) => {
    setState(s => ({ ...s, adminConfig: { ...s.adminConfig, ...partial } }));
  }, []);

  const handleGenerate = useCallback(async () => {
    const sessionId = `loop_${Date.now()}`;
    setState(s => ({
      ...s,
      step: 'studio',
      generationPhase: 'preparing',
      error: null,
      streamingText: '',
      thoughtBubbles: [],
      refineThoughts: [],
      chatMessages: [],
      agentLoop: createAgentLoopState({
        sessionId,
        turn: 1,
        activePhase: 'research',
        goal: buildLoopGoal(state.config, state.files.length),
      }),
    }));

    try {
      localStorage.setItem(HAS_VISITED_KEY, 'true');
    } catch {
      // ignore storage errors
    }

    try {
      // Phase 1: Prepare (analyze content, plan layout, engineer prompt)
      setState(s => ({ ...s, streamingText: 'Analyzing content & preparing infographic plan...' }));

      const onThought = (thought: string) => {
        const bubble: ThoughtBubble = {
          id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: thought,
          timestamp: Date.now(),
        };
        setState(s => ({ ...s, thoughtBubbles: [...s.thoughtBubbles, bubble] }));
      };

      const prepResult = await prepareInfographic(state.files, state.config, state.adminConfig, onThought);
      setState(s => ({
        ...s,
        prepareResult: prepResult,
        streamingText: 'Preparation complete. Generating image...',
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'render',
          goal: s.agentLoop.goal,
          stopRule: s.agentLoop.stopRule,
        }),
      }));

      // Phase 2: Generate image
      setState(s => ({ ...s, generationPhase: 'generating', streamingText: 'Generating infographic...' }));
      const referenceImages = state.files.filter(f => f.category === 'image').slice(0, 3);
      const [result, filename] = await Promise.all([
        generateInfographic(prepResult.prompt, referenceImages, { ...state.config, resolution: state.adminConfig.imageResolution || state.config.resolution }, state.adminConfig),
        generateFilename(prepResult.prompt, state.adminConfig)
      ]);
      result.filename = filename;

      const historyEntry = {
        id: `history_${Date.now()}`,
        imageData: result.imageData,
        config: { ...state.config },
        timestamp: Date.now(),
        title: prepResult.analysis.title || 'Infographic',
        filename: result.filename,
      };

      const firstMessage: ChatMessage = {
        id: `chat_${Date.now()}`,
        role: 'assistant',
        text: result.description || `Here's your ${prepResult.analysis.title || 'infographic'}! It has ${prepResult.analysis.sectionsCount} sections with ${prepResult.analysis.dataPointsCount} data points. Click the chips below or type a message to refine it.`,
        timestamp: Date.now(),
      };

      // Increment trial turns if using trial key
      const isTrial = !state.adminConfig.geminiApiKey && !localStorage.getItem('infographic-gemini-key') && !!import.meta.env.VITE_GEMINI_API_KEY;
      if (isTrial) {
        incrementTrialTurns();
      }

      setState(s => ({
        ...s,
        currentResult: result,
        generationPhase: 'complete',
        streamingText: '',
        history: [historyEntry, ...s.history].slice(0, 20),
        chatMessages: [firstMessage],
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'review',
          goal: s.agentLoop.goal,
          stopRule: 'Stop here unless the user requests a focused refinement.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        step: 'create',
        generationPhase: 'idle',
        streamingText: '',
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'intake',
          goal: s.agentLoop.goal,
          stopRule: 'Resolve the error or adjust source inputs before restarting.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    }
  }, [state.files, state.config, state.adminConfig]);

  const handleRefine = useCallback(async (instruction: string) => {
    if (!state.currentResult?.imageData) return;

    const userMsg: ChatMessage = {
      id: `chat_${Date.now()}_user`,
      role: 'user',
      text: instruction,
      timestamp: Date.now(),
    };
    setState(s => ({
      ...s,
      error: null,
      streamingText: 'Refining infographic...',
      chatMessages: [...s.chatMessages, userMsg],
      refineThoughts: [],
      agentLoop: createAgentLoopState({
        sessionId: s.agentLoop.sessionId,
        turn: s.agentLoop.turn + 1,
        activePhase: 'refine',
        goal: `Apply focused edit: ${instruction.slice(0, 80)}`,
        stopRule: 'Stop after this edit is rendered and reviewed.',
      }),
    }));

    try {
      const onRefineThought = (thought: string) => {
        const bubble: ThoughtBubble = {
          id: `refine_thought_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: thought,
          timestamp: Date.now(),
        };
        setState(s => ({ ...s, refineThoughts: [...s.refineThoughts, bubble] }));
      };

      // Construct API history
      const apiHistory: ApiContent[] = [];
      apiHistory.push({
        role: 'user',
        parts: [{ text: state.prepareResult?.prompt || 'Generate an infographic.' }],
      });
      
      apiHistory.push({
        role: 'model',
        parts: [{ text: state.chatMessages[0]?.text || 'Here is the infographic.' }],
      });

      for (let i = 1; i < state.chatMessages.length; i += 2) {
        const userMsg = state.chatMessages[i];
        const assistantMsg = state.chatMessages[i + 1];
        
        if (userMsg && userMsg.role === 'user') {
          apiHistory.push({
            role: 'user',
            parts: [{ text: userMsg.text }],
          });
        }
        
        if (assistantMsg && assistantMsg.role === 'assistant') {
          apiHistory.push({
            role: 'model',
            parts: [{ text: assistantMsg.text }],
          });
        }
      }

      const result = await refineInfographic(
        state.currentResult.imageData,
        instruction,
        state.adminConfig,
        { ...state.config, resolution: state.adminConfig.imageResolution || state.config.resolution },
        onRefineThought,
        apiHistory
      );
      result.filename = state.currentResult.filename;

      const historyEntry = {
        id: `history_${Date.now()}`,
        imageData: result.imageData,
        config: { ...state.config },
        timestamp: Date.now(),
        title: `Refined: ${instruction.slice(0, 40)}`,
        filename: result.filename,
      };

      const assistantMsg: ChatMessage = {
        id: `chat_${Date.now()}_assistant`,
        role: 'assistant',
        text: result.description || `Done! I've applied: "${instruction}"`,
        timestamp: Date.now(),
      };

      // Increment trial turns if using trial key
      const isTrial = !state.adminConfig.geminiApiKey && !localStorage.getItem('infographic-gemini-key') && !!import.meta.env.VITE_GEMINI_API_KEY;
      if (isTrial) {
        incrementTrialTurns();
      }

      setState(s => ({
        ...s,
        currentResult: result,
        streamingText: '',
        history: [historyEntry, ...s.history].slice(0, 20),
        chatMessages: [...s.chatMessages, assistantMsg],
        refineThoughts: [],
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'review',
          goal: s.agentLoop.goal,
          stopRule: 'Stop here unless the user requests another focused refinement.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        streamingText: '',
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'review',
          goal: s.agentLoop.goal,
          stopRule: 'Resolve the failed refinement or request a narrower edit.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    }
  }, [state.currentResult, state.adminConfig, state.config, state.chatMessages, state.prepareResult]);

  const handleUpgradeResolution = useCallback(async (res: ImageResolution) => {
    if (!state.currentResult?.imageData) return;

    // Update the config so it's persisted and shown in UI
    updateAdminConfig({ imageResolution: res });
    updateConfig({ resolution: res });

    const instruction = `Redraw exactly this image, preserving all details, perfect text fidelity, and layout, but generate it in High Resolution (${res}).`;

    const userMsg: ChatMessage = {
      id: `chat_${Date.now()}_user`,
      role: 'user',
      text: `Upgrade resolution to ${res}`,
      timestamp: Date.now(),
    };
    setState(s => ({
      ...s,
      error: null,
      streamingText: `Upgrading to ${res} resolution...`,
      chatMessages: [...s.chatMessages, userMsg],
      refineThoughts: [],
      agentLoop: createAgentLoopState({
        sessionId: s.agentLoop.sessionId,
        turn: s.agentLoop.turn + 1,
        activePhase: 'refine',
        goal: `Upgrade the current infographic to ${res} resolution.`,
        stopRule: 'Stop after the higher-resolution render is available for review.',
      }),
    }));

    try {
      const onRefineThought = (thought: string) => {
        const bubble: ThoughtBubble = {
          id: `refine_thought_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: thought,
          timestamp: Date.now(),
        };
        setState(s => ({ ...s, refineThoughts: [...s.refineThoughts, bubble] }));
      };

      // Construct API history
      const apiHistory: ApiContent[] = [];
      apiHistory.push({
        role: 'user',
        parts: [{ text: state.prepareResult?.prompt || 'Generate an infographic.' }],
      });
      
      apiHistory.push({
        role: 'model',
        parts: [{ text: state.chatMessages[0]?.text || 'Here is the infographic.' }],
      });

      for (let i = 1; i < state.chatMessages.length; i += 2) {
        const userMsg = state.chatMessages[i];
        const assistantMsg = state.chatMessages[i + 1];
        
        if (userMsg && userMsg.role === 'user') {
          apiHistory.push({
            role: 'user',
            parts: [{ text: userMsg.text }],
          });
        }
        
        if (assistantMsg && assistantMsg.role === 'assistant') {
          apiHistory.push({
            role: 'model',
            parts: [{ text: assistantMsg.text }],
          });
        }
      }

      const result = await refineInfographic(
        state.currentResult.imageData,
        instruction,
        { ...state.adminConfig, imageResolution: res },
        { ...state.config, resolution: res },
        onRefineThought,
        apiHistory
      );

      const historyEntry = {
        id: `history_${Date.now()}`,
        imageData: result.imageData,
        config: { ...state.config, resolution: res },
        timestamp: Date.now(),
        title: `Upgraded to ${res}`,
      };

      const assistantMsg: ChatMessage = {
        id: `chat_${Date.now()}_assistant`,
        role: 'assistant',
        text: result.description || `I've upgraded the resolution to ${res}.`,
        timestamp: Date.now(),
      };

      // Increment trial turns if using trial key
      const isTrial = !state.adminConfig.geminiApiKey && !localStorage.getItem('infographic-gemini-key') && !!import.meta.env.VITE_GEMINI_API_KEY;
      if (isTrial) {
        incrementTrialTurns();
      }

      setState(s => ({
        ...s,
        currentResult: result,
        streamingText: '',
        history: [historyEntry, ...s.history].slice(0, 20),
        chatMessages: [...s.chatMessages, assistantMsg],
        refineThoughts: [],
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'review',
          goal: s.agentLoop.goal,
          stopRule: 'Stop here unless the user requests another focused refinement.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        streamingText: '',
        agentLoop: createAgentLoopState({
          sessionId: s.agentLoop.sessionId,
          turn: s.agentLoop.turn,
          activePhase: 'review',
          goal: s.agentLoop.goal,
          stopRule: 'Resolve the failed resolution upgrade or request a lower resolution.',
          hitlStatus: 'awaiting-input',
        }),
      }));
    }
  }, [state.currentResult, state.adminConfig, state.config, updateAdminConfig, updateConfig, state.chatMessages, state.prepareResult]);

  const handleDownload = useCallback(() => {
    if (!state.currentResult?.imageData) return;
    const filename = state.currentResult.filename || `infographic-${Date.now()}`;
    downloadImage(state.currentResult.imageData, filename);
  }, [state.currentResult]);

  const loadHistoryEntry = useCallback((entry: AppState['history'][0]) => {
    const result: GenerationResult = {
      imageData: entry.imageData,
      description: '',
      prompt: '',
      filename: entry.filename,
    };
    setState(s => ({
      ...s,
      currentResult: result,
      config: { ...entry.config, resolution: normalizeResolution(entry.config.resolution) },
      step: 'studio',
      generationPhase: 'complete',
      agentLoop: createAgentLoopState({
        sessionId: `history_${entry.id}`,
        turn: 1,
        activePhase: 'review',
        goal: `Review saved infographic: ${entry.title}`,
        stopRule: 'Stop here unless the user requests a focused refinement.',
        hitlStatus: 'awaiting-input',
      }),
    }));
  }, []);

  const addTextContext = useCallback((text: string) => {
    if (!text.trim()) return;

    const trimmed = text.trim();
    const textFile: UploadedFile = {
      id: `file_text_${Date.now()}`,
      name: `pasted-text-${Date.now()}.txt`,
      base64: btoa(unescape(encodeURIComponent(trimmed))),
      mimeType: 'text/plain',
      category: 'text',
      size: trimmed.length,
      preview: trimmed.slice(0, 200),
    };

    setState(s => ({ ...s, files: [...s.files, textFile] }));
  }, []);

  const addSampleData = useCallback(() => {
    const sampleText = `# The State of AI in 2026

## Key Statistics
- 78% of enterprises now use AI in production workflows
- Global AI market size: $420 billion (up 35% from 2025)
- Average ROI on AI investments: 3.2x within 18 months

## Top AI Trends
1. Multi-Agent Systems: Autonomous AI teams handling complex workflows
2. Native Image Generation: Models like Gemini generate and edit images conversationally
3. Edge AI: On-device models running at near-cloud quality
4. AI-Powered Developer Tools: 65% of code now AI-assisted

## Industry Adoption
- Healthcare: 89% of hospitals use AI diagnostics
- Finance: AI manages $2.1 trillion in assets
- Manufacturing: 72% reduction in defects with AI quality control
- Education: Personalized learning paths for 340 million students

## Looking Ahead
Experts predict that by 2028, AI agents will handle 40% of routine business processes autonomously.

Source: Global AI Index 2026 Report`;

    const sampleFile: UploadedFile = {
      id: `file_sample_${Date.now()}`,
      name: 'ai-trends-2026.txt',
      base64: btoa(unescape(encodeURIComponent(sampleText))),
      mimeType: 'text/plain',
      category: 'text',
      size: sampleText.length,
      preview: sampleText.slice(0, 200),
    };

    setState(s => ({ ...s, files: [sampleFile, ...s.files] }));
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(s => ({
      ...initialState,
      step: 'create' as const,
      theme: s.theme,
      adminConfig: s.adminConfig,
      history: s.history,
      config: s.config,
      thoughtBubbles: [],
      chatMessages: [],
      refineThoughts: [],
      agentLoop: createAgentLoopState({ hitlStatus: 'not-started' }),
    }));
  }, []);

  return {
    state,
    addFiles,
    removeFile,
    updateConfig,
    setStep,
    toggleTheme,
    updateAdminConfig,
    handleGenerate,
    handleRefine,
    handleUpgradeResolution,
    handleDownload,
    loadHistoryEntry,
    addSampleData,
    addTextContext,
    clearError,
    reset,
  };
}
