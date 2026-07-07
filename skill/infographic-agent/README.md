# Infographic Agent Skill

A standalone, agent-agnostic **skill** package for generating professional infographics, visual summaries, and data visualizations directly from text or topic descriptions with Gemini.

This skill is designed to run in both local terminal environments and within AI coding agents (such as Claude Code, Cursor, Copilot, etc.) that support the Vercel agent skills ecosystem.

## 🚀 Installation & Setup

You can install this skill directly into your AI coding agent environment:

```bash
npx skills add ryanbaumann/infographic-agent
```

Alternatively, you can run the CLI tool directly without installation:

```bash
# First run: installs the small Python dependencies (google-genai and pillow)
npx infographic-agent --install

# Generate an infographic
npx infographic-agent "Top 5 programming languages in 2026"
```

## 📋 Prerequisites

- **Python 3.8+**
- **Gemini API Key**: Get a free key at [Google AI Studio](https://aistudio.google.com/apikey). Set it as:
  ```bash
  export GEMINI_API_KEY="your-key"
  ```
  *(If no key is configured in the environment, the CLI onboarding will guide you through getting one and saving it locally).*
- **Vertex AI (Optional)**: If you prefer enterprise Vertex AI, configure Google Cloud Project details:
  ```bash
  export GOOGLE_CLOUD_PROJECT="your-project-id"
  ```

## ⚙️ How It Works

The skill runs a fast, browser-less two-agent pipeline powered by Gemini:

1. **Research & Plan (`gemini-3.5-flash`)**: Grounds the topic with Google Search and engineers a precise, text-accurate prompt.
2. **Render (`gemini-3.1-flash-lite-image`)**: Renders the prompt directly into a high-quality, text-accurate infographic PNG.

## 🛠️ CLI Flags & Options

All flags are fully compatible between the Python script and the `npx` execution:

| Flag / Option | Short | Description | Default / Choices |
| :--- | :--- | :--- | :--- |
| `topic` | *None* | The topic, prompt, or content you want to visualize. | *None* |
| `--output` | `-o` | File path where the output PNG will be saved. | `infographic.png` |
| `--mode` | `-m` | Preset layout and style theme. | `data-story`<br>Choices: `classroom`, `custom`, `data-story`, `executive-summary`, `quick-slide`, `technical-deep-dive` |
| `--aspect` | `-a` | Aspect ratio of the generated infographic image. | `9:16`<br>Choices: `1:1`, `1:4`, `3:4`, `4:3`, `9:16`, `16:9` |
| `--instructions` | `-i` | Custom layout, design, or brand color rules. | `""` |
| `--no-research` | *None* | Skip the research agent and generate directly (faster, no web search). | *Flag* |
| `--yes` | `-y` | Non-interactive execution (no refine loop, best for CI/agents). | *Flag* |
| `--setup` | *None* | Launch the interactive key onboarding walkthrough, then exit. | *Flag* |

For full documentation and examples, visit the main repository at [github.com/ryanbaumann/infographic-agent](https://github.com/ryanbaumann/infographic-agent).
