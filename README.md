# lit-prompt-config

[![npm version](https://img.shields.io/npm/v/lit-prompt-config.svg)](https://www.npmjs.com/package/lit-prompt-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The missing UI for LLM prompt management.**

A lightweight, embeddable Lit web component for managing LLM prompt configurations. Drop it into any web app — no backend required, no platform to deploy, no vendor lock-in. Just a `<script>` tag and a JSON object.

## Features

- **Complete prompt management UI** — model selection, system/user prompts, parameters, tools, response format, reasoning settings
- **Live model discovery** — fetches models from OpenRouter's public API (200+ models, no API key needed)
- **Framework agnostic** — works with React, Vue, Svelte, Angular, or vanilla HTML
- **Event-based testing** — never touches API keys; emits ready-to-forward payloads
- **Themeable** — light/dark mode with CSS custom properties
- **Tiny footprint** — ~16KB gzipped (bundled version with Lit included)

## Quick Start (CDN)

```html
<script type="module" src="https://unpkg.com/lit-prompt-config/dist/lit-prompt-config.bundled.js"></script>

<prompt-config id="pc"></prompt-config>

<script>
  const pc = document.getElementById('pc');

  // Listen for changes
  pc.addEventListener('prompt-change', (e) => {
    console.log('Config updated:', e.detail);
  });

  // Handle test requests
  pc.addEventListener('prompt-test', async (e) => {
    pc.setTestLoading(true);
    try {
      const response = await fetch('/api/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.detail.payload)
      });
      pc.setTestResult(await response.json());
    } catch (err) {
      pc.setTestError(err.message);
    }
  });
</script>
```

## Installation (npm)

```bash
npm install lit-prompt-config lit
```

```typescript
import 'lit-prompt-config';

// The <prompt-config> element is now available
```

## Usage Examples

### Basic Usage

```html
<prompt-config
  .value=${{ model: 'anthropic/claude-sonnet-4-5', systemPrompt: 'You are helpful.' }}
  @prompt-change=${(e) => saveConfig(e.detail)}
></prompt-config>
```

### With Provider Filtering

```html
<prompt-config
  .providerFilter=${['anthropic', 'openai', 'google']}
></prompt-config>
```

### Handling Test Events

The component emits `prompt-test` with a ready-to-forward OpenRouter payload:

```javascript
pc.addEventListener('prompt-test', async (e) => {
  const { config, payload, resolvedMessages } = e.detail;

  pc.setTestLoading(true);

  // Forward to your backend (which adds the API key)
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  pc.setTestResult(await response.json());
});
```

### Storing Configs

The config is a plain JSON object — store it anywhere:

```javascript
// PostgreSQL (jsonb)
await db.query('INSERT INTO prompts (id, config) VALUES ($1, $2)', [config.id, config]);

// SQLite
db.run('INSERT INTO prompts VALUES (?, ?)', [config.id, JSON.stringify(config)]);

// localStorage
localStorage.setItem(`prompt:${config.id}`, JSON.stringify(config));
```

## API Reference

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | `PromptConfig` | `DEFAULT_CONFIG` | The configuration object |
| `variant` | `'card' \| 'full'` | `'full'` | Display variant: compact card or full configuration |
| `enabledSections` | `string[]` | all sections | Which UI sections to show |
| `providerFilter` | `string[]` | `[]` (all) | Filter models to specific providers |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `labels` | `Partial<Labels>` | `{}` | Override UI labels for i18n |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `prompt-change` | `PromptConfig` | Fired when any config value changes (debounced 250ms) |
| `prompt-save` | `PromptConfig` | Fired when user clicks Save button |
| `prompt-test` | `{ config, payload, resolvedMessages }` | Fired when user clicks Test button |

### Methods

| Method | Description |
|--------|-------------|
| `setTestResult(result)` | Display successful test response |
| `setTestError(error)` | Display test error |
| `setTestLoading(loading)` | Set loading state for test button |
| `expand()` | Expand card variant to show full configuration |
| `collapse()` | Collapse back to card view |

## Config Schema

```typescript
interface PromptConfig {
  id: string;                          // Unique ID for storage
  name: string;                        // Human-readable display name
  description: string;                 // What this prompt does
  provider: string;                    // Model provider (e.g., 'anthropic', 'openai')
  model: string;                       // OpenRouter model ID
  systemPrompt: string;                // System message
  userPromptTemplate: string;          // User message with {{variable}} placeholders
  temperature: number;                 // 0-2
  maxTokens: number;                   // Max response tokens
  topP: number;                        // 0-1
  topK: number;                        // 0-500
  frequencyPenalty: number;            // -2 to 2
  presencePenalty: number;             // -2 to 2
  repetitionPenalty: number;           // 0-2
  minP: number;                        // 0-1
  stopSequences: string[];             // Stop sequences
  responseFormat: 'text' | 'json_object' | 'json_schema';
  jsonSchema: object | null;           // JSON schema for structured output
  tools: ToolDefinition[];             // OpenAI-compatible tool definitions
  toolChoice: 'auto' | 'none' | 'required';
  reasoning: boolean;                  // Enable extended thinking
  reasoningEffort: 'low' | 'medium' | 'high';
  sampleInputs: Record<string, string>; // Values for template variables
  metadata: Record<string, any>;       // User-defined metadata
}
```

## Integration Helpers

The component saves configs in a **provider-agnostic format**. Use these helpers to convert to provider-specific API payloads.

### TypeScript / JavaScript

#### OpenAI / OpenRouter

```typescript
import { toOpenRouterPayload } from 'lit-prompt-config/helpers/openrouter';

const payload = toOpenRouterPayload(config, { article_text: '...' });

// Works with OpenRouter, OpenAI, Azure OpenAI, Ollama, LMStudio, etc.
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  },
  body: JSON.stringify(payload),
});
```

#### Anthropic

```typescript
import { toAnthropicPayload } from 'lit-prompt-config/helpers/anthropic';
import Anthropic from '@anthropic-ai/sdk';

const payload = toAnthropicPayload(config, { article_text: '...' });

const anthropic = new Anthropic();
const response = await anthropic.messages.create(payload);
```

#### LangChain.js

```typescript
import { toPromptTemplate, getModelConfig } from 'lit-prompt-config/helpers/langchain';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

const templateConfig = toPromptTemplate(config);
const modelConfig = getModelConfig(config);

const prompt = ChatPromptTemplate.fromMessages([
  ['system', templateConfig.systemTemplate],
  ['user', templateConfig.userTemplate],
]);

const llm = new ChatOpenAI({
  ...modelConfig,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});
```

### Python

#### OpenAI / OpenRouter

```python
from helpers.payloads import to_openai_payload
import requests

payload = to_openai_payload(config, {"article_text": "..."})

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
    json=payload
)
```

#### Anthropic

```python
from helpers.payloads import to_anthropic_payload
import anthropic

payload = to_anthropic_payload(config, {"article_text": "..."})

client = anthropic.Anthropic()
response = client.messages.create(**payload)
```

#### LangChain

```python
from helpers.langchain import from_config

config = load_config_from_db()
prompt, llm = from_config(config, api_key="sk-...")

chain = prompt | llm
result = chain.invoke({"article_text": "..."})
```

## Internationalization (i18n)

Override any UI label via the `labels` property. Pass only the labels you want to change—defaults are used for the rest.

```html
<prompt-config
  .labels=${{
    testPrompt: 'Tester le prompt',
    save: 'Enregistrer',
    temperature: 'Température',
    maxTokens: 'Tokens max',
    systemPrompt: 'Prompt système',
    userPromptTemplate: 'Template utilisateur',
    advancedSettings: 'Paramètres avancés',
  }}
></prompt-config>
```

### Available Labels

All ~60 labels can be overridden. See the full list:

```typescript
import { DEFAULT_LABELS } from 'lit-prompt-config';
console.log(Object.keys(DEFAULT_LABELS));
```

**Categories:**
- **Headers:** `promptConfiguration`, `advancedConfiguration`, `advancedSettings`
- **Buttons:** `import`, `export`, `save`, `testPrompt`, `testing`
- **Field labels:** `name`, `description`, `provider`, `model`, `temperature`, `maxTokens`, etc.
- **Placeholders:** `placeholderName`, `placeholderDescription`, `placeholderSystemPrompt`, etc.
- **Status messages:** `statusSelectModel`, `statusAddPrompt`, `statusTemplateVarsEmpty`
- **Dropdown options:** `formatText`, `formatJsonObject`, `toolChoiceAuto`, `reasoningLow`, etc.

### With i18n Libraries

Works with any i18n solution:

```typescript
// react-i18next
<prompt-config .labels=${t('promptConfig', { returnObjects: true })} />

// vue-i18n
<prompt-config :labels="$tm('promptConfig')" />

// Plain JSON
import labelsEs from './locales/es.json';
<prompt-config .labels=${labelsEs} />
```

## Theming

### Theme Modes

The component supports three theme modes via the `theme` attribute:

```html
<!-- Auto: follows system preference (default) -->
<prompt-config theme="auto"></prompt-config>

<!-- Force light mode -->
<prompt-config theme="light"></prompt-config>

<!-- Force dark mode -->
<prompt-config theme="dark"></prompt-config>
```

### Custom Themes

Override CSS custom properties to create custom themes:

```css
/* Custom brand colors */
prompt-config {
  --pc-accent: #0ea5e9;        /* Sky blue accent */
  --pc-accent-hover: #0284c7;
  --pc-accent-bg: #f0f9ff;
  --pc-radius: 12px;           /* Rounder corners */
}

/* Custom fonts */
prompt-config {
  --pc-font: 'Inter', -apple-system, sans-serif;
  --pc-font-mono: 'Fira Code', 'JetBrains Mono', monospace;
}

/* Full dark theme override */
prompt-config.my-dark-theme {
  --pc-bg: #0f172a;
  --pc-bg-section: #1e293b;
  --pc-bg-input: #0f172a;
  --pc-bg-hover: #334155;
  --pc-border: #334155;
  --pc-text: #f8fafc;
  --pc-text-secondary: #cbd5e1;
  --pc-text-muted: #64748b;
}
```

### Available CSS Custom Properties

| Variable | Description | Light Default | Dark Default |
|----------|-------------|---------------|--------------|
| `--pc-bg` | Main background | `#fafaf9` | `#1c1917` |
| `--pc-bg-section` | Section/card background | `#ffffff` | `#292524` |
| `--pc-bg-input` | Input/textarea background | `#f5f5f4` | `#1c1917` |
| `--pc-bg-hover` | Hover state background | `#e7e5e4` | `#44403c` |
| `--pc-border` | Border color | `#d6d3d1` | `#44403c` |
| `--pc-border-focus` | Focused input border | `#78716c` | `#a8a29e` |
| `--pc-text` | Primary text color | `#1c1917` | `#fafaf9` |
| `--pc-text-secondary` | Secondary text color | `#57534e` | `#d6d3d1` |
| `--pc-text-muted` | Muted/hint text color | `#a8a29e` | `#78716c` |
| `--pc-accent` | Primary accent color | `#d97706` | `#f59e0b` |
| `--pc-accent-hover` | Accent hover state | `#b45309` | `#fbbf24` |
| `--pc-accent-bg` | Accent background | `#fffbeb` | `rgba(69,26,3,0.2)` |
| `--pc-danger` | Error/danger color | `#dc2626` | `#ef4444` |
| `--pc-danger-bg` | Error background | `#fef2f2` | `#450a0a` |
| `--pc-success` | Success color | `#16a34a` | `#22c55e` |
| `--pc-success-bg` | Success background | `#f0fdf4` | `#052e16` |
| `--pc-radius` | Border radius | `6px` | `6px` |
| `--pc-shadow` | Box shadow | subtle | subtle |
| `--pc-transition` | Transition timing | `150ms ease` | `150ms ease` |
| `--pc-font` | Sans-serif font stack | IBM Plex Sans | IBM Plex Sans |
| `--pc-font-mono` | Monospace font stack | IBM Plex Mono | IBM Plex Mono |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build
```

## License

MIT
