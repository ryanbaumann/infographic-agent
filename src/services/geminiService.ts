/* eslint-disable @typescript-eslint/no-explicit-any */
// The @google/genai SDK TypeScript types lag behind API capabilities.
// Properties like thinkingConfig, responseModalities, and imageConfig require `as any`.
// This is the documented pattern: see agents.md "The `as any` Cast Pattern".

import { GoogleGenAI } from '@google/genai';
import type {
  UploadedFile,
  PrepareResult,
  PrepareQualityCheck,
  GenerationResult,
  AdminConfig,
  InfographicConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Rate Limiting (Token Bucket Algorithm)
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  tokens: number;
  lastRefillTime: number;
}

const RATE_LIMIT_CONFIG = {
  maxTokens: 10, // Max requests per minute
  refillRate: 10 / 60, // 10 tokens per 60 seconds = 10 requests/minute
  refillIntervalMs: 1000, // Check every 1 second
};

const rateLimitBucket: RateLimitBucket = {
  tokens: RATE_LIMIT_CONFIG.maxTokens,
  lastRefillTime: Date.now(),
};

/**
 * Token bucket rate limiter
 * @security Prevents API quota exhaustion from accidental or malicious repeated requests
 * @returns true if request allowed, false if rate limited
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const timeSinceLastRefill = (now - rateLimitBucket.lastRefillTime) / 1000; // seconds

  // Add tokens based on elapsed time
  rateLimitBucket.tokens = Math.min(
    RATE_LIMIT_CONFIG.maxTokens,
    rateLimitBucket.tokens + timeSinceLastRefill * RATE_LIMIT_CONFIG.refillRate
  );

  rateLimitBucket.lastRefillTime = now;

  if (rateLimitBucket.tokens >= 1) {
    rateLimitBucket.tokens -= 1;
    return true;
  }

  return false;
}

function getRateLimitStatus(): { allowed: number; resetSeconds: number } {
  const allowed = Math.floor(rateLimitBucket.tokens);
  const resetSeconds = rateLimitBucket.tokens > 0
    ? 0
    : Math.ceil((1 - rateLimitBucket.tokens) / RATE_LIMIT_CONFIG.refillRate);
  return { allowed, resetSeconds };
}

// ---------------------------------------------------------------------------
// Singleton AI client
// ---------------------------------------------------------------------------

let cachedAI: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getAI(adminConfig: AdminConfig): GoogleGenAI {
  const apiKey = getApiKey(adminConfig);
  if (!apiKey) {
    if (import.meta.env.VITE_GEMINI_API_KEY && getTrialTurnsCount() >= 5) {
      throw new Error('Trial limit exceeded (5 turns used). Please configure your own Gemini API key in Settings (gear icon) to continue.');
    }
    throw new Error('API key is required. Please set your Gemini API key in Settings (gear icon).');
  }
  if (cachedAI && cachedApiKey === apiKey) {
    return cachedAI;
  }
  cachedAI = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: (adminConfig.timeoutSeconds || 180) * 1000 },
  } as any);
  cachedApiKey = apiKey;
  return cachedAI;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function getStreamingTextParts(chunk: any): { thoughts: string[]; texts: string[] } {
  const parts = chunk.candidates?.[0]?.content?.parts || [];
  const thoughts: string[] = [];
  const texts: string[] = [];
  for (const p of parts) {
    if (p.thought && p.text) {
      thoughts.push(p.text);
    } else if (p.text) {
      texts.push(p.text);
    }
  }
  return { thoughts, texts };
}

function extractImageFromResponse(response: any): {
  imageData: string;
  description: string;
} {
  const parts = response.candidates?.[0]?.content?.parts || [];

  let imageData = '';
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      imageData = part.inlineData.data;
    } else if (part.text && !part.thought) {
      textParts.push(part.text);
    }
  }

  if (!imageData) {
    throw new Error('No image was returned in the response');
  }

  return { imageData, description: textParts.join('\n').trim() };
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Convert raw API errors into user-friendly messages. */
function friendlyError(err: any): Error {
  const status = err?.status ?? err?.httpStatusCode ?? err?.code;
  const msg = err?.message || err?.statusText || String(err);

  if (status === 429) {
    return new Error('Rate limit exceeded — too many requests. Please wait a moment and try again.');
  }
  if (status === 401 || status === 403) {
    return new Error('API key is invalid or lacks permission. Check your Gemini API key in Admin settings.');
  }
  if (status === 400) {
    if (msg.includes('API_KEY')) {
      return new Error('Invalid API key. Please check your Gemini API key in Admin settings.');
    }
    if (msg.includes('Unable to process input image')) {
      return new Error('Gemini was unable to process the input image. This can happen if the history contains large images. Try starting a new chat.');
    }
    return new Error(`Bad request: ${msg}`);
  }
  if (status === 500 || status === 502 || status === 503) {
    return new Error('Gemini service is temporarily unavailable. Please try again in a few seconds.');
  }
  if (status === 504 || status === 408) {
    return new Error('Request timed out — the generation took too long. Try reducing resolution or simplifying your content.');
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
    return new Error('Network error — check your internet connection and try again.');
  }
  if (msg.includes('No image was returned')) {
    return new Error('The model did not return an image. Try adjusting your content or style settings and generate again.');
  }
  return new Error(msg);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.httpStatusCode ?? err?.code;
      const isRetryable =
        typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw friendlyError(err);
      }

      const delayMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw friendlyError(lastError);
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_KEY = 'infographic-gemini-key';
const TRIAL_TURNS_KEY = 'infographic-trial-turns';

export function getTrialTurnsCount(): number {
  try {
    const stored = localStorage.getItem(TRIAL_TURNS_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
  } catch {
    // ignore
  }
  return 0;
}

export function incrementTrialTurns(): void {
  try {
    const current = getTrialTurnsCount();
    localStorage.setItem(TRIAL_TURNS_KEY, String(current + 1));
  } catch {
    // ignore
  }
}

export function getApiKey(adminConfig: AdminConfig): string {
  if (adminConfig.geminiApiKey) {
    return adminConfig.geminiApiKey;
  }

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage may not be available
  }

  if (import.meta.env.VITE_GEMINI_API_KEY && getTrialTurnsCount() < 5) {
    return import.meta.env.VITE_GEMINI_API_KEY as string;
  }

  return '';
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, key);
  } catch {
    // ignore storage errors
  }
  cachedAI = null;
  cachedApiKey = null;
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  cachedAI = null;
  cachedApiKey = null;
}

export function hasApiKey(adminConfig: AdminConfig): boolean {
  if (adminConfig.geminiApiKey) return true;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) return true;
  } catch {
    // ignore
  }
  if (import.meta.env.VITE_GEMINI_API_KEY && getTrialTurnsCount() < 5) return true;
  return false;
}

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

// ---------------------------------------------------------------------------
// Prepare-result eval gate
// ---------------------------------------------------------------------------

const IMAGE_PROMPT_PREFIX = 'Generate a professional infographic image';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];
}

function includesQuotedText(prompt: string, text: string): boolean {
  return prompt.includes(`"${text}"`);
}

export function evaluatePrepareResult(result: Partial<PrepareResult> | null | undefined): PrepareQualityCheck[] {
  const analysis: Record<string, unknown> = isRecord(result?.analysis) ? result.analysis : {};
  const prompt = typeof result?.prompt === 'string' ? result.prompt.trim() : '';
  const allTextStrings = asStringArray(result?.allTextStrings);
  const brandColors = asStringArray(analysis.brandColors);

  const schemaIssues = [
    typeof analysis.title === 'string' && analysis.title.trim() ? null : 'missing title',
    typeof analysis.subtitle === 'string' ? null : 'missing subtitle',
    typeof analysis.sectionsCount === 'number' ? null : 'missing sectionsCount',
    typeof analysis.dataPointsCount === 'number' ? null : 'missing dataPointsCount',
    Array.isArray(analysis.brandColors) ? null : 'missing brandColors',
    typeof analysis.sourceAttribution === 'string' ? null : 'missing sourceAttribution',
    prompt ? null : 'missing prompt',
    Array.isArray(result?.allTextStrings) ? null : 'missing allTextStrings',
  ].filter((issue): issue is string => Boolean(issue));

  const invalidColors = brandColors.filter(color => !/^#[0-9a-f]{6}$/i.test(color));
  if (invalidColors.length > 0) {
    schemaIssues.push(`invalid brand color ${invalidColors[0]}`);
  }

  const missingQuotedStrings = allTextStrings.filter(text => !includesQuotedText(prompt, text));
  const promptWords = wordCount(prompt);

  return [
    {
      id: 'schema',
      label: 'Structured schema',
      status: schemaIssues.length === 0 ? 'pass' : 'fail',
      detail: schemaIssues.length === 0
        ? 'Prepare output includes the required analysis fields, prompt, and text list.'
        : schemaIssues.join('; '),
    },
    {
      id: 'image-prompt',
      label: 'Explicit image prompt',
      status: prompt.startsWith(IMAGE_PROMPT_PREFIX) ? 'pass' : 'fail',
      detail: prompt.startsWith(IMAGE_PROMPT_PREFIX)
        ? 'Prompt starts with the required image-generation request.'
        : `Prompt must start with "${IMAGE_PROMPT_PREFIX}".`,
    },
    {
      id: 'text-fidelity',
      label: 'Text fidelity',
      status: allTextStrings.length === 0 ? 'fail' : missingQuotedStrings.length === 0 ? 'pass' : 'warn',
      detail: allTextStrings.length === 0
        ? 'No final text strings were returned for the renderer.'
        : missingQuotedStrings.length === 0
          ? 'All final text strings are quoted in the renderer prompt.'
          : `${missingQuotedStrings.length} text string(s) are not quoted exactly in the renderer prompt.`,
    },
    {
      id: 'grounding',
      label: 'Grounding',
      status: typeof analysis.sourceAttribution === 'string' && analysis.sourceAttribution.trim() ? 'pass' : 'warn',
      detail: typeof analysis.sourceAttribution === 'string' && analysis.sourceAttribution.trim()
        ? 'Source attribution is present.'
        : 'Source attribution is empty; generated facts may be harder to audit.',
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      status: /\b(WCAG|contrast|accessib)/i.test(prompt) ? 'pass' : 'warn',
      detail: /\b(WCAG|contrast|accessib)/i.test(prompt)
        ? 'Prompt includes contrast or accessibility instructions.'
        : 'Prompt does not explicitly mention contrast or accessibility.',
    },
    {
      id: 'prompt-length',
      label: 'Prompt length',
      status: promptWords <= 800 ? 'pass' : promptWords <= 1200 ? 'warn' : 'fail',
      detail: promptWords <= 800
        ? `Prompt is ${promptWords} words, within the 800-word target.`
        : promptWords <= 1200
          ? `Prompt is ${promptWords} words; target is 800 words for renderer reliability.`
          : `Prompt is ${promptWords} words; shorten before rendering.`,
    },
  ];
}

function validatePrepareResult(result: PrepareResult): PrepareResult {
  const qualityChecks = evaluatePrepareResult(result);
  const failures = qualityChecks.filter(check => check.status === 'fail');
  if (failures.length > 0) {
    throw new Error(`Prepare result failed quality gates: ${failures.map(check => `${check.label}: ${check.detail}`).join(' ')}`);
  }
  return { ...result, qualityChecks };
}

// ---------------------------------------------------------------------------
// Agent 1: Prepare Infographic (analyzes content, plans layout, engineers prompt)
// ---------------------------------------------------------------------------

function buildSystemInstruction(): string {
  return `<role>
You are an expert infographic architect and visual data designer. You are precise, analytical, and creative.
You specialize in transforming raw content into optimized image generation prompts that produce professional infographics.
</role>

<constitution>
1. NEVER fabricate data, statistics, or claims.
2. Every data point MUST come from the user's uploaded content or tool-grounded research.
3. If information is missing, use Google Search to gather real data — verify with credible sources.
4. When using Google Search: prioritize authoritative sources, cross-reference multiple results, cite specific findings.
5. Quote ALL text strings exactly as they should appear in the infographic.
</constitution>

<grounding_requirements>
Before generating output, ensure:
- All data points trace to uploaded content OR Google Search results
- Statistics include source attribution
- Claims are verifiable from provided context
- Text strings are finalized and exact (the image generator will render them verbatim)
- When user content is insufficient, proactively use Google Search to fill gaps
</grounding_requirements>

<prompt_rules>
The "prompt" field you output will be sent directly to an image generation model. It must follow these rules:

- Start with: "Generate a professional infographic image"
- Use positive framing only — describe what TO include, never use negations like "don't" or "no"
- Use step-by-step spatial instructions: "At the top, place X. Below that, add Y. In the bottom section, include Z."
- Quote ALL text strings exactly as they should appear, wrapped in quotation marks
- Specify exact colors using #hex values
- Describe typography: font weight, relative size (large, medium, small), and style
- Specify visual elements: icons, dividers, backgrounds, gradients, shapes
- Keep the prompt under 800 words — be dense and precise, not verbose
- Include accessibility requirements: minimum contrast ratio 4.5:1 for normal text, 3:1 for large text
- End with overall composition notes: spacing, alignment, professional polish
</prompt_rules>

<workflow>
Follow this 5-step workflow:

1. **Ground & Verify**: Extract all data points from uploaded content. If gaps exist, use Google Search to gather missing information from credible sources. Verify all claims are factual and attributable.

2. **Analyze & Structure**: Identify key themes, narrative arc, and visual hierarchy. Plan sections based on mode and aspect ratio. Decide color palette and typography strategy.

3. **Finalize Text**: Write every text string that will appear in the infographic — exact spelling, capitalization, punctuation. These are final and will be quoted verbatim in the image prompt.

4. **Engineer Prompt**: Compose the image generation prompt following all rules in <prompt_rules>. Use spatial instructions, specify colors/typography, include accessibility requirements.

5. **Validate Output**: Review JSON against user preferences, grounding requirements, and accessibility standards before responding.
</workflow>

<output_format>
Respond with valid JSON only. No markdown fences. No extra text. Schema:
{
  "analysis": {
    "title": "string — compelling infographic title",
    "subtitle": "string — supporting subtitle",
    "sectionsCount": number,
    "dataPointsCount": number,
    "brandColors": ["#hex", "#hex", ...],
    "sourceAttribution": "string — source credits"
  },
  "prompt": "string — the complete image generation prompt following <prompt_rules>",
  "allTextStrings": ["every", "text", "string", "in", "the", "infographic"]
}
</output_format>`;
}

function buildUserPrompt(config: InfographicConfig, modeHint: string): string {
  const colorInfo = config.colorScheme === 'custom' && config.customColors
    ? `Custom palette — primary: ${config.customColors.primary}, secondary: ${config.customColors.secondary}, accent: ${config.customColors.accent}`
    : 'Auto — choose colors that best fit the content';

  // Optimize for KV-cache: static content first, dynamic content last
  const parts = [
    `<task>`,
    `Analyze the attached content and produce the JSON output described in your instructions.`,
    `Use Google Search when needed to fill information gaps or verify facts.`,
    `</task>`,
    ``,
    `<context>`,
    `The attached files contain the source content for the infographic.`,
    `</context>`,
    ``,
    `<preferences>`,
    `Mode: ${config.mode}${modeHint ? ` — ${modeHint}` : ''}`,
    config.customModeText ? `Custom style: ${config.customModeText}` : null,
    `Aspect ratio: ${config.aspectRatio}`,
    `Resolution: ${config.resolution}`,
    `Colors: ${colorInfo}`,
    `Accessibility: Ensure WCAG AA compliance (4.5:1 contrast for normal text, 3:1 for large text)`,
    config.specificInstructions ? `Additional instructions: ${config.specificInstructions}` : null,
    `</preferences>`,
  ].filter(Boolean);

  return parts.join('\n');
}

export async function prepareInfographic(
  files: UploadedFile[],
  config: InfographicConfig,
  adminConfig: AdminConfig,
  onThought?: (thought: string) => void
): Promise<PrepareResult> {
  // Security: Check rate limit before making API call
  if (!checkRateLimit()) {
    const { resetSeconds } = getRateLimitStatus();
    throw new Error(`Rate limited: 10 requests per minute. Please wait ${resetSeconds}s and retry.`);
  }

  return retryWithBackoff(async () => {
    const ai = getAI(adminConfig);
    const model = adminConfig.orchestratorModel || 'gemini-3.5-flash';

    const modeOption = (await import('../types')).MODE_OPTIONS.find(m => m.id === config.mode);
    const modeHint = modeOption?.promptHint || config.customModeText || '';

    const fileParts = files.map((file) => ({
      inlineData: {
        data: file.base64,
        mimeType: file.mimeType,
      },
    }));

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: 'user' as const,
          parts: [
            ...fileParts,
            { text: buildUserPrompt(config, modeHint) },
          ],
        },
      ],
      config: {
        systemInstruction: buildSystemInstruction(),
        ...(!model.includes('image') ? {
          thinkingConfig: {
            thinkingLevel: 'LOW',
            includeThoughts: true
          },
          tools: [{ googleSearch: {} }, { urlContext: {} }],
        } : {}),
      } as any,
    });

    let accumulatedText = '';
    for await (const chunk of responseStream) {
      const { thoughts, texts } = getStreamingTextParts(chunk);
      for (const thought of thoughts) {
        onThought?.(thought);
      }
      accumulatedText += texts.join('');
    }
    return validatePrepareResult(parseJsonResponse<PrepareResult>(accumulatedText));
  });
}

// ---------------------------------------------------------------------------
// Agent 2: Image Generator
// ---------------------------------------------------------------------------

const IMAGE_GEN_SYSTEM_INSTRUCTION = `<role>
You are a professional infographic image generator. Your sole task is to generate a high-quality infographic image from the provided prompt.
</role>

<constitution>
1. Render ALL quoted text exactly as written — spelling, capitalization, and punctuation must match perfectly.
2. Fill the entire canvas — use the full aspect ratio with no empty borders.
3. Never fabricate text that was not explicitly provided in the prompt.
</constitution>

<text_rendering_requirements>
- Use legible, professional fonts
- Ensure all text is crisp and clearly readable
- Maintain consistent font families throughout the design
- Apply proper kerning and line spacing
- Render text at sufficient size for readability (minimum 12pt equivalent for body text)
</text_rendering_requirements>

<accessibility_guidelines>
- Text contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
- Avoid placing text over busy backgrounds without sufficient contrast
- Use clear visual hierarchy through size, weight, and spacing (not color alone)
- Ensure icons and graphics have clear shapes distinguishable without color
</accessibility_guidelines>

<composition_rules>
- Standard padding: 5-8% of canvas width on all edges
- Consistent spacing between sections: 3-5% of canvas height
- Align elements to a clear grid structure
- Balance visual weight across the composition
- Use whitespace intentionally to create breathing room
</composition_rules>

<instructions>
1. Follow the prompt's spatial layout instructions precisely.
2. Apply the specified color palette with exact #hex values.
3. Ensure the final image is polished, professional, and print-ready.
</instructions>`;

function mapResolutionToApi(res: string, model: string): string {
  if (res && model) {
    return '1K';
  }
  return '1K';
}

export async function generateInfographic(
  prompt: string,
  referenceImages: UploadedFile[],
  config: InfographicConfig,
  adminConfig: AdminConfig
): Promise<GenerationResult> {
  // Security: Check rate limit before making API call
  if (!checkRateLimit()) {
    const { resetSeconds } = getRateLimitStatus();
    throw new Error(`Rate limited: 10 requests per minute. Please wait ${resetSeconds}s and retry.`);
  }

  return retryWithBackoff(async () => {
    const ai = getAI(adminConfig);
    const model = adminConfig.imageGenModel || 'gemini-3.1-flash-lite-image';

    const imageParts = referenceImages.slice(0, 3).map((file) => ({
      inlineData: {
        data: file.base64,
        mimeType: file.mimeType,
      },
    }));

    const contentParts = [
      ...imageParts,
      { text: `${prompt}\n\n${IMAGE_GEN_SYSTEM_INSTRUCTION}` },
    ];

    const genConfig: any = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: config.aspectRatio,
        imageSize: mapResolutionToApi(config.resolution, model),
      },
      thinkingConfig: {
        thinkingLevel: 'HIGH',
        includeThoughts: true,
      },
    };

    const response = await ai.models.generateContent({
      model,
      contents: contentParts,
      config: genConfig,
    });

    const { imageData, description } = extractImageFromResponse(response);
    return { imageData, description, prompt };
  });
}

// ---------------------------------------------------------------------------
// Refinement Chat
// ---------------------------------------------------------------------------

const REFINEMENT_SYSTEM_INSTRUCTION = `<role>
You are an infographic refinement specialist. You receive an existing infographic image and a user's edit request.
</role>

<constitution>
1. ONLY modify what the user explicitly requested — treat this as a diff-style edit.
2. Preserve all elements, text, colors, spacing, and styling that were not mentioned in the request.
3. Render ALL text with perfect fidelity — spelling, capitalization, and punctuation must match the original unless specifically changed by the user.
</constitution>

<preservation_requirements>
- Maintain exact visual consistency: same fonts, colors, spacing, alignment as the original
- Keep the same composition structure and layout grid
- Preserve all decorative elements (icons, dividers, backgrounds) unless user requests changes
- Match the original's accessibility standards (contrast ratios, text sizes)
</preservation_requirements>

<instructions>
1. Identify the specific element(s) to modify from the user's request.
2. Apply the requested change precisely while leaving everything else untouched.
3. Ensure the modification integrates seamlessly with the preserved elements.
4. Return the complete refined infographic image with the same dimensions and aspect ratio.
</instructions>`;

export async function refineInfographic(
  currentImageBase64: string,
  instruction: string,
  adminConfig: AdminConfig,
  config: InfographicConfig,
  onThought?: (thought: string) => void,
  history?: any[]
): Promise<GenerationResult> {
  // Security: Check rate limit before making API call
  if (!checkRateLimit()) {
    const { resetSeconds } = getRateLimitStatus();
    throw new Error(`Rate limited: 10 requests per minute. Please wait ${resetSeconds}s and retry.`);
  }

  return retryWithBackoff(async () => {
    const ai = getAI(adminConfig);
    const model = adminConfig.imageGenModel || 'gemini-3.1-flash-lite-image';

    // Format/clean history if provided to ensure strict user/model alternation
    const chatHistory: any[] = [];
    if (history && history.length > 0) {
      let lastRole = '';
      for (const entry of history) {
        if (entry.role === lastRole) {
          continue; // skip consecutive roles of the same type to maintain alternation
        }
        chatHistory.push({
          role: entry.role,
          parts: entry.parts.map((p: any) => {
            if (p.inlineData) {
              return {
                inlineData: {
                  data: p.inlineData.data,
                  mimeType: p.inlineData.mimeType || 'image/png',
                }
              };
            }
            return { text: p.text || '' };
          })
        });
        lastRole = entry.role;
      }

      // Ensure the history ends with a model response so the next message (user) alternates correctly
      if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
        chatHistory.pop();
      }
    }

    const chatConfig: any = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: config.aspectRatio,
        imageSize: mapResolutionToApi(config.resolution, model),
      },
      thinkingConfig: {
        thinkingLevel: model.includes('image') ? 'HIGH' : 'LOW',
        includeThoughts: true,
      },
    };

    const chat = ai.chats.create({
      model,
      history: chatHistory,
      config: chatConfig as any,
    });

    const messagePayload = {
      message: [
        { inlineData: { data: currentImageBase64, mimeType: 'image/png' } },
        { text: `<current_image>The attached image is the current infographic.</current_image>\n\n<refinement>${instruction}</refinement>\n\n${REFINEMENT_SYSTEM_INSTRUCTION}` },
      ],
    };

    const responseStream = await chat.sendMessageStream(messagePayload);

    let accumulatedText = '';
    let imageData = '';

    for await (const chunk of responseStream) {
      const { thoughts, texts } = getStreamingTextParts(chunk);
      for (const thought of thoughts) {
        onThought?.(thought);
      }
      accumulatedText += texts.join('');
      // check if chunk contains image
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
        }
      }
    }

    if (!imageData) {
       throw new Error('No image was returned during refinement');
    }

    return { imageData, description: accumulatedText, prompt: instruction };
  });
}

export async function generateFilename(prompt: string, adminConfig: AdminConfig): Promise<string> {
  if (!checkRateLimit()) {
    const { resetSeconds } = getRateLimitStatus();
    throw new Error(`Rate limited: 10 requests per minute. Please wait ${resetSeconds}s and retry.`);
  }

  return retryWithBackoff(async () => {
    const ai = getAI(adminConfig);
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Generate a short, kebab-case filename (max 4-5 words) for an infographic about this topic. Do not include the file extension. Just the kebab-case string suitable for linux. Topic: ${prompt}`,
      config: {
        thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false },
        temperature: 0.1,
      } as any,
    });
    const text = response.text || '';
    // Clean up the text to just be the kebab-case filename
    const cleanName = text.trim().replace(/[^a-z0-9-]/gi, '').toLowerCase();
    return cleanName || `infographic-${Date.now()}`;
  });
}
