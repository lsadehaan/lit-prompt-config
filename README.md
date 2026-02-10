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
| `enabledSections` | `string[]` | all sections | Which UI sections to show |
| `providerFilter` | `string[]` | `[]` (all) | Filter models to specific providers |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |

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

## Config Schema

```typescript
interface PromptConfig {
  id: string;                          // Unique ID for storage
  name: string;                        // Human-readable display name
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

### OpenRouter Payload

```typescript
import { toOpenRouterPayload } from 'lit-prompt-config/helpers/openrouter';

const payload = toOpenRouterPayload(config, { article_text: '...' });

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  },
  body: JSON.stringify(payload),
});
```

### LangChain (Python)

```python
from helpers.langchain import from_config

config = load_config_from_db()
prompt, llm = from_config(config, api_key="sk-...")

chain = prompt | llm
result = chain.invoke({"article_text": "..."})
```

### LangChain.js

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

## Theming

Customize with CSS custom properties:

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
  --pc-font: 'Inter', sans-serif;
  --pc-font-mono: 'Fira Code', monospace;
}
```

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
