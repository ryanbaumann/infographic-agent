import { useState, useCallback, useEffect } from 'react';
import type { AppState, InfographicConfig, AdminConfig, UploadedFile, GenerationResult, ThoughtBubble, ChatMessage, ImageResolution } from '../types';
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

const isMasterView = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'master';
const isProdDeploy = import.meta.env.PROD || import.meta.env.VITE_PRODUCTION_DEPLOY === 'true';
const allowQualityModel = isMasterView && !isProdDeploy;

function loadAdminConfig(): AdminConfig {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Enforce gemini-3.5-flash as the default and only supported analysis model
      parsed.orchestratorModel = 'gemini-3.5-flash';
      // Enforce gemini-3.1-flash-lite-image if quality model is not allowed
      if (!allowQualityModel) {
        parsed.imageGenModel = 'gemini-3.1-flash-lite-image';
      } else {
        if (parsed.imageGenModel === 'gemini-3.1-flash-image-preview') {
          parsed.imageGenModel = 'gemini-3.1-flash-image';
        }
      }
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
    if (stored) return { ...DEFAULT_INFOGRAPHIC_CONFIG, ...JSON.parse(stored) };
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
    setState(s => ({ ...s, step: 'studio', generationPhase: 'preparing', error: null, streamingText: '', thoughtBubbles: [], refineThoughts: [], chatMessages: [] }));

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
      setState(s => ({ ...s, prepareResult: prepResult, streamingText: 'Preparation complete. Generating image...' }));

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
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        step: 'create',
        generationPhase: 'idle',
        streamingText: '',
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
    setState(s => ({ ...s, error: null, streamingText: 'Refining infographic...', chatMessages: [...s.chatMessages, userMsg], refineThoughts: [] }));

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
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        streamingText: '',
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
    setState(s => ({ ...s, error: null, streamingText: `Upgrading to ${res} resolution...`, chatMessages: [...s.chatMessages, userMsg], refineThoughts: [] }));

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
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: (err as Error).message,
        streamingText: '',
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
      config: entry.config,
      step: 'studio',
      generationPhase: 'complete',
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
