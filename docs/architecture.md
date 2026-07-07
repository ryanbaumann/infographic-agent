# Architecture Deep Dive

This document is a technical deep dive into the 2-agent pipeline architecture that powers professional infographic generation. It covers system design, agent roles, grounding strategies, and best practices for production use.

For contributor-facing setup instructions and repo conventions, see [AGENTS.md](../AGENTS.md) at the repo root.

---

## 1. Pipeline Overview

The infographic generation process is structured in three primary stages to optimize latency and ensure maximum quality:

```
                  [User Input / Files / URLs]
                              │
                              ▼
                  ┌───────────────────────────────┐
                  │   Agent 1: Prepare            │
                  │   Model: gemini-3.5-flash     │
                  │   - Parse & analyze content   │
                  │   - Ground facts (Google      │
                  │     Search + URL context)     │
                  │   - Design layout hierarchy   │
                  │   - Engineer image prompt     │
                  └───────────┬───────────────────┘
                              │
                    [Structured Layout Plan]
                    [Verbatim Text Quotes]
                    [Engineered Prompt]
                              │
                              ▼
                  ┌───────────────────────────────┐
                  │   Agent 2: Generate           │
                  │   Model: gemini-3.1-flash-    │
                  │           lite-image          │
                  │   - Render infographic image  │
                  │   - Apply layout constraints  │
                  │   - Set colors & typography   │
                  └───────────┬───────────────────┘
                              │
                      [Infographic PNG]
                              │
                              ▼
                  ┌───────────────────────────────┐
                  │   Refinement Chat             │
                  │   Model: gemini-3.1-flash-    │
                  │           lite-image          │
                  │   - Multi-turn edits          │
                  │   - Preserve unchanged areas  │
                  │   - User feedback loop        │
                  └───────────────────────────────┘
```

---

## 2. Agent 1: Prepare (Content Analysis & Layout Planning)

### Role & Responsibility

Agent 1 is the **orchestrator** of the pipeline. It transforms unstructured user input (files, text, URLs) into a structured, ready-to-render layout plan and engineering prompt for the image generator.

### Model Configuration

```typescript
const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 180000 } } as any);

const response = await client.models.generateContent('gemini-3.5-flash', {
  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  systemInstruction: systemPrompt,
  generationConfig: {
    temperature: 1,
    topP: 0.95,
    topK: 40,
  },
  tools: [
    { googleSearch: {} },      // Real-time fact verification
    { urlContext: {} },         // Fetch and analyze remote docs
  ],
  thinkingConfig: {
    thinkingLevel: 'HIGH',      // Enable detailed reasoning
    includeThoughts: true,
  },
} as any);
```

### Key Capabilities

1. **Content Parsing**
   - Extracts structured data from PDFs, CSVs, images, and plain text
   - Identifies key metrics, statistics, and data points
   - Preserves exact text for high-fidelity infographic rendering

2. **Fact Grounding**
   - Uses `googleSearch` tool to verify statistics and claims
   - Uses `urlContext` tool to fetch and summarize remote documents (up to 34MB per URL)
   - Provides inline citations for external data

3. **Layout Planning**
   - Designs visual hierarchy (primary message → supporting details)
   - Plans section-by-section composition
   - Specifies spatial constraints (top-to-bottom, left-to-right)
   - Defines chart types, color codes, and typography weights

4. **Prompt Engineering**
   - Generates step-by-step instructions for the image generator
   - Uses positive framing ("include", "emphasize") rather than negation ("don't")
   - Embeds verbatim text quotes to prevent the image model from inventing wording
   - Explicitly requests "Generate a professional infographic image" to ensure image output

### Output Schema

Agent 1 produces a JSON response:

```typescript
{
  "layoutPlan": {
    "sections": [
      {
        "position": "top",
        "title": "Section Title (Verbatim)",
        "content": "Key points and data...",
        "chartType": "bar|pie|line|text",
        "colorScheme": ["#4285F4", "#34A853", "#FBBC04"]
      },
      // ... more sections
    ],
    "typography": {
      "headingFont": "sans-serif",
      "bodyFont": "sans-serif",
      "headingWeight": "bold",
      "bodyWeight": "normal"
    }
  },
  "groundedFacts": [
    {
      "claim": "Verified statistic",
      "source": "Google Search | URL Context",
      "confidence": "high"
    }
  ],
  "imagePrompt": "Generate a professional infographic image showing... [step-by-step layout instructions] ... Use hex colors: #4285F4 (primary), #34A853 (success)... [verbatim text quotes]..."
}
```

### Grounding Strategy

- **Primary Fact Source**: User-provided files (PDFs, CSVs, images)
- **Secondary Fact Source**: Google Search (when `tools: [{ googleSearch: {} }]` is enabled)
- **Tertiary Source**: URL Context (for fetching external documents, e.g., company reports, research papers)
- **Confidence Levels**: High (verified from multiple sources) → Medium (single source) → Low (model inference)

### System Prompt Philosophy

Agent 1's system prompt is structured in three tiers:

1. **Static Constraints** (first in KV-cache)
   - Role definition: "You are a professional infographic designer"
   - Core rules: "Text-first rule", "Data accuracy rule", etc.

2. **Structured Instructions** (XML tags for clear parsing)
   - `<role>`: What the agent does
   - `<constitution>`: Core principles (e.g., "never invent data")
   - `<instructions>`: Step-by-step workflow
   - `<examples>`: 1-2 reference layouts

3. **Dynamic Parameters** (last in KV-cache)
   - User content type (PDF, CSV, image, URLs)
   - Desired infographic style (data-driven, narrative, comparison, process)
   - Aspect ratio, resolution, color preferences

---

## 3. Agent 2: Generate (Visual Rendering)

### Role & Responsibility

Agent 2 is the **renderer**. It consumes the engineered prompt and layout plan from Agent 1 and generates a high-fidelity infographic image.

### Model Configuration

```typescript
const response = await client.models.generateContent('gemini-3.1-flash-lite-image', {
  contents: [{ role: 'user', parts: [{ text: engineeredPrompt }] }],
  generationConfig: {
    temperature: 0.8,
    topP: 0.95,
    topK: 40,
    responseModalities: ['TEXT', 'IMAGE'],  // Force image output
  },
  imageConfig: {
    aspectRatio: '16:9',
    resolution: '1024x576',  // Configurable: 1K-4K
  },
  thinkingConfig: {
    thinkingLevel: 'HIGH',      // For debugging
    includeThoughts: false,     // Don't return thoughts
  },
} as any);
```

### Model Selection

- **Primary**: `gemini-3.1-flash-lite-image` (default, 3-5 seconds, good balance)
- **Alternative**: `gemini-3.1-flash-image` (higher quality, slower, 8-12 seconds)
- **Performance**: Flash Lite produces quality output 40% faster than Flash

### Key Capabilities

1. **Native Image Generation**
   - Renders PNG images at specified aspect ratios and resolutions
   - Supports 1K (1024x576), 2K (2048x1152), and 4K (4096x2304) resolutions

2. **Layout Enforcement**
   - Follows step-by-step spatial instructions from Agent 1
   - Maps section positions accurately (top, middle, bottom, left, right)
   - Respects chart type constraints (bar charts, pie charts, line graphs)

3. **Color & Typography**
   - Applies exact hex color codes from the layout plan
   - Renders text with specified font weights and styles
   - Maintains readable contrast ratios

4. **Text Accuracy**
   - Uses verbatim text quotes from Agent 1 to prevent errors
   - Renders text at high fidelity (no misspellings or hallucinations)

### Output

A PNG image (base64-encoded) ready for download, storage, or further refinement.

---

## 4. Refinement Chat (Iterative Editing)

### Role & Responsibility

Refinement Chat enables multi-turn editing where users can request changes to the generated infographic without regenerating from scratch.

### Model Configuration

```typescript
const chat = client.chats.create('gemini-3.1-flash-lite-image', {
  systemInstruction: refinementSystemPrompt,
} as any);

const response = await chat.sendMessage({
  contents: [
    {
      role: 'user',
      parts: [
        { text: '<current_image>...' },
        { image: { inlineData: { mimeType: 'image/png', data: base64Image } } },
        { text: '</current_image>' },
        { text: '<refinement>Change the color scheme to blue and green</refinement>' },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.8,
    responseModalities: ['TEXT', 'IMAGE'],
  },
  imageConfig: {
    aspectRatio: '16:9',
  },
} as any);
```

### Refinement System Prompt

The refinement prompt emphasizes **preservation**:

> "You are a professional infographic editor. Your job is to apply user feedback to the current infographic while preserving all elements the user did NOT ask to change. Never redesign the entire layout unless explicitly requested. Make surgical, targeted edits."

### Supported Refinement Types

1. **Color Scheme**: "Change to cool tones (blues, purples)"
2. **Typography**: "Make headings larger and bolder"
3. **Layout Edits**: "Move the chart to the right side"
4. **Content Updates**: "Update the title to X and add Y statistic"
5. **Style Adjustments**: "Add a shadow effect to the boxes"

### Best Practices

- Keep refinements **single-purpose** (one change per request)
- Provide **specific feedback** ("Change to blue" vs. "Make it look better")
- Use **before/after comparison** to verify the change worked
- **Preserve the image** in the refinement UI for context

---

## 5. The 4 Hard Rules (Pitfall Prevention)

The pipeline enforces these rules to ensure consistent, high-quality output:

### 1. Text-First Rule

**All text must be finalized and verified before image generation.**

- Agent 1 extracts exact text from source files or generates copy in plain JSON
- All text is quoted verbatim in the prompt passed to Agent 2
- The image model never invents text; it renders what Agent 1 provides
- This prevents misspellings, hallucinated numbers, and out-of-brand copy

### 2. Data Accuracy Rule

**Never let the image model invent data points.**

- Agent 1 extracts exact metrics from source files or Google Search
- Unverified claims are marked with confidence levels
- The prompt passed to Agent 2 includes citations and sources
- Users approve grounded facts before image generation

### 3. Layout Complexity Rule

**Describe layouts sequentially, not holistically.**

Instead of: "Create a modern dashboard with charts and icons"

Do this:
```
Top section: Title + subtitle in left-aligned white text
Middle-left: Vertical bar chart with 5 data points
Middle-right: Key metrics in 3x2 grid, each with icon and number
Bottom: Timeline showing Q1-Q4 progression
```

This prevents overlap, ensures correct positioning, and allows the model to render each section independently.

### 4. Explicit Modality Rule

**Every image generation request must explicitly ask for an image.**

Correct:
```
"Generate a professional infographic image showing..."
```

With config:
```typescript
{
  responseModalities: ['TEXT', 'IMAGE'],
  imageConfig: { aspectRatio: '16:9' },
}
```

Incorrect:
```
"Create a nice visualization..." // Model might return text-only response
```

---

## 6. Error Handling & Retry Logic

### Common Failures

1. **Rate Limits** (429 status)
   - Exponential backoff: 1s → 2s → 4s → 8s → 16s
   - Max 3 retries per request

2. **Timeout** (>180 seconds)
   - Occurs when the prompt is too complex or the model is overloaded
   - Retry with a simpler prompt or break into multiple infographics

3. **Invalid Image Output** (empty or corrupted base64)
   - Regenerate with clearer layout instructions
   - Check that `responseModalities: ['TEXT', 'IMAGE']` is set

4. **Token Limit Exceeded**
   - Reduce the number of chart data points
   - Summarize lengthy content
   - Use shorter filenames and URLs

### Retry Strategy

```typescript
async function generateWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateContent(prompt);
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;  // Non-retryable error
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 7. Best Practices for Production

### For Developers Integrating the Pipeline

1. **Initialize the Client Once**
   - Reuse the `GoogleGenAI` instance across requests
   - Don't create a new instance per request (expensive)

2. **Set Appropriate Timeouts**
   - 180 seconds for Prepare (may include web search)
   - 120 seconds for Generate (image rendering)
   - 60 seconds for Refinement (quick edits)

3. **Validate Grounding Before Rendering**
   - Review Agent 1's output (layout plan, grounded facts) before passing to Agent 2
   - Allow users to approve or correct facts

4. **Provide User Feedback**
   - Stream Agent 1's thinking and intermediate outputs
   - Show progress: "Analyzing content..." → "Planning layout..." → "Rendering image..."
   - Display grounded facts and citations

5. **Cache Aggressively**
   - Cache Agent 1's output for repeated styles (same user, same settings)
   - Use IndexedDB for infographic history
   - Reduce API calls by 40-60%

6. **Monitor API Usage**
   - Log all API calls (model, tokens, latency, cost)
   - Set up alerts for unusual usage patterns
   - Track per-user quotas if applicable

### For Content Creators

1. **Upload High-Quality Source Material**
   - Clean CSVs with clear headers
   - Structured PDFs (not scanned images)
   - Relevant URLs for fact-checking

2. **Use Descriptive Prompts**
   - "Create a year-over-year comparison of mobile traffic trends"
   - Better than: "Make an infographic"

3. **Verify Generated Output**
   - Check that numbers match your source data
   - Ensure colors match brand guidelines
   - Review text for accuracy before download

4. **Iterate Thoughtfully**
   - Make one change per refinement request
   - Use specific language ("darker blue", "move to top")
   - Save intermediate versions

---

## 8. Related Documentation

- **Engineering & Architectural Learnings**: See [docs/learnings.md](docs/learnings.md) for detailed analysis on performance bottlenecks, model capabilities, storage optimization, and mobile patterns.
- **Security & Deployment**: See [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options, API key security, and production hardening.
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version history and migration notes.
