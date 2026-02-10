# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`lit-prompt-config` is an embeddable Lit web component (`<prompt-config>`) for configuring LLM prompts. It outputs a single JSON config object that can be stored anywhere. Models are fetched live from OpenRouter's public API (no key required). Testing uses an event-based pattern—the component never handles API keys.

**Current state:** Working prototype in `prompt-config.js` (~1430 lines) with `demo.html`. Not yet packaged for npm.

## Running the Demo

The demo requires HTTP serving (file:// won't work due to CORS):
```bash
npx serve .
# then open http://localhost:3000/demo.html
```

## Architecture

### Core Component (`prompt-config.js`)

A single-file Lit web component that:
- Fetches models from `https://openrouter.ai/api/v1/models` (public, CORS-friendly)
- Manages config as a flat JSON object (see `DEFAULT_CONFIG` constant)
- Emits events: `prompt-change`, `prompt-test`, `prompt-save`
- Auto-detects `{{variable}}` placeholders in prompts and shows sample input fields
- Dims/disables parameter controls based on model's `supported_parameters`

### Key Exports
- `PromptConfig` - The web component class
- `DEFAULT_CONFIG` - Default config shape
- `ALL_SECTIONS` - Array of section IDs: `['identity', 'model', 'prompts', 'parameters', 'response', 'tools', 'reasoning', 'test']`

### Config JSON Shape

```typescript
interface PromptConfig {
  id: string;
  name: string;
  model: string;                    // OpenRouter model ID (e.g., "anthropic/claude-sonnet-4-5")
  systemPrompt: string;
  userPromptTemplate: string;       // Uses {{variable}} placeholders
  temperature: number;              // 0-2
  maxTokens: number;
  topP: number;                     // 0-1
  topK: number;                     // 0-500
  frequencyPenalty: number;         // -2 to 2
  presencePenalty: number;          // -2 to 2
  repetitionPenalty: number;        // 0-2
  minP: number;                     // 0-1
  stopSequences: string[];
  responseFormat: 'text' | 'json_object' | 'json_schema';
  jsonSchema: object | null;
  tools: ToolDefinition[];          // OpenAI-compatible
  toolChoice: 'auto' | 'none' | 'required';
  reasoning: boolean;
  reasoningEffort: 'low' | 'medium' | 'high';
  sampleInputs: Record<string, string>;
  metadata: Record<string, any>;
}
```

### Component API

Properties:
- `value` (Object) - The config object
- `enabledSections` (string[]) - Which sections to show
- `providerFilter` (string[]) - Limit to specific providers
- `theme` ('light' | 'dark' | 'auto')

Methods for test results:
- `setTestResult(result)` - Show success response
- `setTestError(error)` - Show error
- `setTestLoading(loading)` - Toggle loading state

Events:
- `prompt-change` - detail: config object (debounced 250ms)
- `prompt-save` - detail: config object
- `prompt-test` - detail: `{ config, payload, resolvedMessages }` where `payload` is OpenRouter-ready

## Known Issues

1. **Lit import uses unreliable CDN** - Currently imports from a personal fork at jsdelivr. Needs to bundle Lit or use official source.
2. **Demo shows "Loading" forever on file://** - Must serve over HTTP.
3. **No npm build pipeline** - Raw ES module, needs Vite bundling for proper distribution.

## Planned Project Structure (for npm)

```
src/
├── index.ts
├── prompt-config.ts
├── styles.ts
├── types.ts
├── constants.ts
├── models.ts
└── utils.ts
helpers/
├── langchain.py
├── langchain.ts
└── openrouter.ts
```

Build outputs:
- `dist/lit-prompt-config.js` - ES module (Lit as peer dep)
- `dist/lit-prompt-config.bundled.js` - IIFE with Lit included (for CDN)
