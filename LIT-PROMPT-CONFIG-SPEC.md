# lit-prompt-config

## Project Specification

A lightweight, embeddable Lit web component for managing LLM prompt configurations. Drop it into any web app — no backend required, no platform to deploy, no vendor lock-in. Just a `<script>` tag and a JSON object.

**npm package:** `lit-prompt-config`
**GitHub:** `lit-prompt-config`
**Tag line:** "The missing UI for LLM prompt management"

---

## What This Is

An embeddable `<prompt-config>` web component that provides a complete UI for configuring LLM prompts, model selection, parameters, tools, response format, and testing — outputting a single JSON config object that can be stored anywhere (Postgres jsonb, SQLite, Redis, flat file, localStorage).

Models are fetched live from OpenRouter's public `/api/v1/models` endpoint (no API key needed). Testing uses an event/callback pattern — the component never touches API keys.

## What This Is NOT

This is not an LLMOps platform (Langfuse, Agenta, Latitude). It's not a prompt engineering framework (LangChain). It's a **UI component** — the frontend piece that those tools' prompt editors provide, extracted as a standalone, framework-agnostic widget anyone can embed.

---

## Current State

A working prototype exists in `prompt-config.js` (~1430 lines) with a `demo.html`. It has:
- Full model fetching from OpenRouter
- All sections (identity, model, prompts, parameters, response format, tools, reasoning, test)
- Event-based architecture (prompt-change, prompt-test, prompt-save)
- Light/dark theme support
- Import/export JSON
- Template variable detection and sample input editor

### Known Issues to Fix

1. **Lit CDN import is unreliable for local file:// usage.** The current import uses `https://cdn.jsdelivr.net/gh/nicolo-ribaudo/lit@nicolo-ribaudo/esm-build/core/lit-core.min.js` which is a personal fork. Must switch to an official/reliable source, or bundle Lit.
2. **Demo shows "Loading" forever on file://.** The OpenRouter fetch works fine over HTTP but browsers block cross-origin fetches from file://. The demo needs to be served (even `npx serve` works). Document this clearly and consider a fallback/error message.
3. **No npm build pipeline.** Currently a raw ES module. Needs proper package structure with bundling.

---

## Project Structure

```
lit-prompt-config/
├── README.md                    # Documentation + usage examples
├── package.json
├── tsconfig.json                # TypeScript (Lit recommends TS)
├── vite.config.ts               # Build config (Vite for lib mode)
├── LICENSE                      # MIT
│
├── src/
│   ├── index.ts                 # Main export
│   ├── prompt-config.ts         # The web component
│   ├── styles.ts                # CSS (Lit css tagged template)
│   ├── types.ts                 # TypeScript interfaces for config shape
│   ├── constants.ts             # Default config, section list, provider meta
│   ├── models.ts                # OpenRouter model fetching + caching
│   └── utils.ts                 # Template resolution, formatting helpers
│
├── helpers/                     # Optional integration helpers
│   ├── langchain.py             # Python: config JSON → LangChain objects
│   ├── langchain.ts             # JS: config JSON → LangChain.js objects
│   └── openrouter.ts            # JS: config JSON → OpenRouter API payload
│
├── demo/
│   ├── index.html               # Interactive demo page
│   └── demo.js                  # Demo logic (event handlers, simulated test)
│
└── test/
    └── prompt-config.test.ts    # Basic tests
```

---

## Build & Distribution

### Package Outputs
- **ES module** (`dist/lit-prompt-config.js`) — for bundler-based projects
- **UMD/IIFE bundle** (`dist/lit-prompt-config.bundled.js`) — includes Lit, for CDN/script tag usage
- **Type declarations** (`dist/types/`)

### package.json key fields
```json
{
  "name": "lit-prompt-config",
  "type": "module",
  "main": "dist/lit-prompt-config.js",
  "module": "dist/lit-prompt-config.js",
  "types": "dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/lit-prompt-config.js",
      "types": "./dist/types/index.d.ts"
    },
    "./bundled": "./dist/lit-prompt-config.bundled.js",
    "./helpers/openrouter": "./dist/helpers/openrouter.js",
    "./helpers/langchain": "./dist/helpers/langchain.js"
  },
  "files": ["dist/", "helpers/langchain.py"],
  "peerDependencies": {
    "lit": "^3.0.0"
  }
}
```

### Usage modes
```html
<!-- CDN (zero install, Lit included) -->
<script type="module" src="https://unpkg.com/lit-prompt-config/dist/lit-prompt-config.bundled.js"></script>

<!-- npm (Lit as peer dep) -->
import 'lit-prompt-config';
```

---

## Config JSON Shape (TypeScript)

This is THE core data structure. Everything revolves around it.

```typescript
interface PromptConfig {
  // Identity
  id: string;                          // Unique ID for storage (e.g. "summarize-article")
  name: string;                        // Human-readable display name

  // Model
  model: string;                       // OpenRouter model ID (e.g. "anthropic/claude-sonnet-4-5")

  // Prompts
  systemPrompt: string;                // System message
  userPromptTemplate: string;          // User message with {{variable}} placeholders

  // Parameters
  temperature: number;                 // 0-2, default 1.0
  maxTokens: number;                   // Max response tokens
  topP: number;                        // 0-1, default 1.0
  topK: number;                        // 0-500, default 0 (disabled)
  frequencyPenalty: number;            // -2 to 2, default 0
  presencePenalty: number;             // -2 to 2, default 0
  repetitionPenalty: number;           // 0-2, default 1.0
  minP: number;                        // 0-1, default 0
  stopSequences: string[];             // Stop sequences

  // Response format
  responseFormat: 'text' | 'json_object' | 'json_schema';
  jsonSchema: object | null;           // JSON schema for structured output

  // Tools
  tools: ToolDefinition[];             // OpenAI-compatible tool definitions
  toolChoice: 'auto' | 'none' | 'required';

  // Reasoning
  reasoning: boolean;                  // Enable extended thinking
  reasoningEffort: 'low' | 'medium' | 'high';

  // Testing
  sampleInputs: Record<string, string>; // Values for template variables

  // Custom
  metadata: Record<string, any>;       // User-defined metadata (tags, version, etc.)
}
```

### Design decision: Why flat JSON?

- Trivially storable: `INSERT INTO prompts (id, config) VALUES ($1, $2::jsonb)`
- Framework agnostic: works with any backend language
- No ORM mapping needed
- Easy to version (just store snapshots)
- Easy to diff (standard JSON diff)

---

## Component API

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | `PromptConfig` | `DEFAULT_CONFIG` | The config object (two-way via events) |
| `enabledSections` | `string[]` | all sections | Which UI sections to show |
| `providerFilter` | `string[]` | `[]` (all) | Filter models to specific providers |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |

### Events

| Event | detail | When |
|-------|--------|------|
| `prompt-change` | `PromptConfig` | Any config value changes (debounced 250ms) |
| `prompt-save` | `PromptConfig` | User clicks Save button |
| `prompt-test` | `{ config, payload, resolvedMessages }` | User clicks Test button |

**`prompt-test` detail structure:**
```typescript
{
  config: PromptConfig,           // Full config snapshot
  payload: OpenRouterPayload,     // Ready-to-forward API request body
  resolvedMessages: Message[],    // Template variables resolved with sampleInputs
}
```

The `payload` is a complete OpenRouter-compatible request body. The consuming app just needs to add the Authorization header and forward it.

### Methods

| Method | Description |
|--------|-------------|
| `setTestResult(result: string \| object)` | Display successful test response |
| `setTestError(error: string)` | Display test error |
| `setTestLoading(loading: boolean)` | Set loading spinner on test button |

### CSS Custom Properties (Theming)

All visual aspects are controllable via CSS custom properties:

```css
prompt-config {
  --pc-bg: #fafaf9;
  --pc-bg-section: #ffffff;
  --pc-bg-input: #f5f5f4;
  --pc-border: #d6d3d1;
  --pc-text: #1c1917;
  --pc-text-secondary: #57534e;
  --pc-accent: #d97706;
  --pc-radius: 6px;
  --pc-font: 'IBM Plex Sans', sans-serif;
  --pc-font-mono: 'IBM Plex Mono', monospace;
  /* ... etc */
}
```

---

## UI Sections

All sections are collapsible (accordion). Each can be enabled/disabled via `enabledSections`.

### 1. Identity
- Config ID (text input)
- Display name (text input)

### 2. Model
- Provider filter dropdown (populated from OpenRouter data, grouped by `id.split('/')[0]`)
- Search input (filters by model id and name)
- Scrollable model list showing: provider color dot, model name, context window size, input price
- Selected model info panel: model ID, context length, max output tokens, modality, pricing, supported parameters (as tags)
- **Key feature:** The `supported_parameters` array from OpenRouter is used to dim/disable settings that the selected model doesn't support

### 3. Prompts
- System prompt (textarea)
- User prompt template (textarea, with `{{variable}}` hint)
- Auto-detected template variables with sample input fields for each

### 4. Parameters
- Temperature (slider, 0-2)
- Max tokens (number input)
- Top P (slider, 0-1)
- Top K (number input)
- Min P (slider, 0-1)
- Frequency penalty (slider, -2 to 2)
- Presence penalty (slider, -2 to 2)
- Repetition penalty (slider, 0-2)
- Stop sequences (textarea, one per line)
- Each parameter is dimmed if the selected model's `supported_parameters` doesn't include it

### 5. Response Format
- Dropdown: text / json_object / json_schema
- JSON schema editor (textarea, shown when json_schema selected)
- Validates JSON on input, only updates config when valid

### 6. Tools
- Tool definitions editor (textarea, expects OpenAI-compatible tools JSON array)
- Tool choice dropdown: auto / none / required

### 7. Reasoning
- Toggle switch: enable extended thinking
- Reasoning effort dropdown: low / medium / high (shown when enabled)

### 8. Test
- Test button (disabled until model + prompt are set)
- Warnings for unfilled template variables
- Result display area (success/error styling)
- Loading spinner during test

### Header Bar
- Component title
- Import JSON button (file picker)
- Export JSON button (downloads config as .json file)
- Save button (emits prompt-save event)

---

## OpenRouter Model Fetching

### Endpoint
`GET https://openrouter.ai/api/v1/models` — no authentication required, CORS-friendly.

### Response structure (per model)
```json
{
  "id": "anthropic/claude-opus-4.6",
  "name": "Anthropic: Claude Opus 4.6",
  "context_length": 1000000,
  "architecture": {
    "modality": "text+image->text",
    "input_modalities": ["text", "image"],
    "output_modalities": ["text"],
    "tokenizer": "Claude"
  },
  "pricing": {
    "prompt": "0.000005",
    "completion": "0.000025"
  },
  "top_provider": {
    "context_length": 1000000,
    "max_completion_tokens": 128000
  },
  "supported_parameters": [
    "max_tokens", "temperature", "top_p", "top_k",
    "tools", "tool_choice", "response_format", "stop",
    "reasoning", "structured_outputs"
  ]
}
```

### Caching strategy
- Cache the model list in memory for the component's lifecycle
- Show a refresh button to re-fetch
- Consider localStorage cache with a 1-hour TTL for faster subsequent loads
- The full model list is ~1-2MB; could pre-filter server-side but not necessary

### Provider list (derived from model IDs)
The component auto-discovers providers from the data. Top ones include:
`anthropic`, `openai`, `google`, `x-ai`, `meta-llama`, `mistralai`, `deepseek`, `qwen`, `cohere`, `perplexity`

We maintain a `PROVIDER_META` map with display labels and brand colors for known providers. Unknown providers fall back to gray + their raw ID as label.

---

## Integration Helpers

### Python: LangChain

`helpers/langchain.py` — a single-file utility, no dependencies beyond langchain-core.

```python
from lit_prompt_config import from_config

# Load your config JSON from wherever you stored it
config = db.get_prompt_config("summarize-article")

# Get LangChain objects
prompt, llm = from_config(config)

# Use in a chain
chain = prompt | llm
result = chain.invoke({"article_text": "..."})
```

Implementation maps:
- `systemPrompt` + `userPromptTemplate` → `ChatPromptTemplate.from_messages()`
- `{{var}}` → `{var}` (LangChain uses single braces)
- `model` → appropriate provider class (`ChatOpenAI`, `ChatAnthropic`, etc.) or `ChatOpenAI` with OpenRouter base URL
- `temperature`, `maxTokens`, etc. → model kwargs

### JavaScript: OpenRouter payload

`helpers/openrouter.ts` — converts config to a ready-to-send fetch body.

```typescript
import { toOpenRouterPayload } from 'lit-prompt-config/helpers/openrouter';

const payload = toOpenRouterPayload(config, { article_text: "..." });
// payload is ready for: fetch('https://openrouter.ai/api/v1/chat/completions', { body: JSON.stringify(payload) })
```

### JavaScript: LangChain.js

`helpers/langchain.ts` — similar to Python helper but for langchain JS.

---

## Testing Strategy

### Unit tests
- Config shape validation (default config has all fields)
- Template variable extraction (`{{var}}` parsing)
- Template resolution (variable substitution)
- OpenRouter payload generation
- Price/context formatting utilities

### Component tests
- Renders without errors
- Model list populates (mock fetch)
- Config changes emit events with correct shape
- Sections toggle correctly
- Disabled sections don't render
- Provider filter works
- Model search works
- Unsupported parameters are dimmed
- Test button disabled states work correctly

### Use `@open-wc/testing` + `@web/test-runner` (standard Lit testing stack)

---

## README Structure

1. **Hero** — one-liner + badges (npm, license, bundle size)
2. **Screenshot/GIF** — the component in action
3. **Quick Start** — CDN script tag, 5-line example
4. **Installation** — npm install + import
5. **Usage Examples**
   - Minimal (just model + prompt)
   - Full featured (all sections)
   - With testing callback
   - With provider filtering
   - Storing config (Postgres, SQLite, localStorage examples)
   - Framework integration (React, Vue, Svelte, vanilla)
6. **API Reference** — properties, events, methods, CSS custom properties
7. **Config Schema** — full TypeScript interface with descriptions
8. **Integration Helpers** — LangChain Python, LangChain.js, OpenRouter
9. **Theming** — CSS custom properties reference + dark mode
10. **Contributing**

---

## Competitive Positioning

| Feature | lit-prompt-config | Langfuse | Agenta | LangChain |
|---------|-------------------|----------|--------|-----------|
| Embeddable component | ✅ | ❌ (full platform) | ❌ (full platform) | ❌ (code library) |
| No backend required | ✅ | ❌ | ❌ | ✅ |
| Framework agnostic | ✅ (web component) | ❌ (React app) | ❌ (React app) | N/A |
| Live model discovery | ✅ (OpenRouter) | ❌ | ❌ | ❌ |
| JSON config output | ✅ | ❌ (proprietary) | ❌ (proprietary) | ❌ (Python objects) |
| Bundle size | ~50KB | N/A | N/A | N/A |
| Setup time | 1 minute | 30+ minutes | 30+ minutes | 10+ minutes |

---

## Implementation Priority

### Phase 1: Core (MVP for npm publish)
- [ ] Set up project structure (Vite lib mode, TypeScript, Lit 3)
- [ ] Port existing prototype to TypeScript
- [ ] Fix Lit import (use `lit` from npm, bundle for CDN build)
- [ ] Fix OpenRouter fetch error handling (retry, timeout, cached fallback)
- [ ] Ensure all sections work correctly
- [ ] Write types.ts with full exported interfaces
- [ ] Build pipeline: ES module + bundled IIFE
- [ ] Demo page that works when served via npx serve / npm run dev
- [ ] README with quick start + API docs
- [ ] Publish to npm

### Phase 2: Polish
- [ ] LocalStorage model cache (1h TTL) for faster loads
- [ ] Model list virtualization (only render visible items — currently caps at 100)
- [ ] Keyboard navigation in model list
- [ ] JSON editor validation indicators (red border on invalid JSON)
- [ ] Animated section transitions
- [ ] Python helper (langchain.py)
- [ ] JS helpers (openrouter.ts, langchain.ts)
- [ ] Basic test suite

### Phase 3: Advanced
- [ ] Multi-message prompt builder (not just system + user template, but arbitrary message sequences)
- [ ] Prompt versioning UI (version number, changelog note)
- [ ] Side-by-side config diff view
- [ ] Token count estimation for prompts
- [ ] Cost estimation based on selected model pricing
- [ ] Prompt library/presets (load from a curated set)
- [ ] A/B test configuration (multiple prompt variants)

---

## Development Notes

### Why Lit (not React)?
- Web components work everywhere: React, Vue, Svelte, Angular, vanilla HTML
- Shadow DOM encapsulation means no CSS conflicts
- Tiny runtime (~5KB for Lit)
- Already established pattern with lit-shell

### Why OpenRouter as the model source?
- Public API, no key required for model listing
- Covers all major providers (Anthropic, OpenAI, Google, xAI, Meta, Mistral, etc.)
- Rich metadata per model (pricing, context length, supported parameters, modality)
- The `supported_parameters` field is uniquely valuable — it tells the UI which settings to enable/disable per model
- OpenRouter model IDs serve as a universal model identifier

### Why event-based testing (not built-in API calls)?
- API keys should never be in the browser
- Every project has its own backend pattern
- The component emits a ready-to-forward payload — the consuming app adds auth and sends it
- This keeps the component pure UI with zero security concerns
