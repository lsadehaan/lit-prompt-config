# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`lit-prompt-config` is an embeddable Lit web component (`<prompt-config>`) for configuring LLM prompts. It outputs a single JSON config object that can be stored anywhere. Models are fetched live from OpenRouter's public API (no key required). Testing uses an event-based pattern—the component never handles API keys.

## Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build (ES module + bundled IIFE + type declarations)
npm run build

# Individual build steps
npm run build:types    # TypeScript declarations
npm run build:es       # ES module (Lit as peer dep)
npm run build:bundle   # IIFE bundle (Lit included)
npm run build:helpers  # Helper modules
```

## Project Structure

```
src/
├── index.ts           # Main exports
├── prompt-config.ts   # The web component
├── types.ts           # TypeScript interfaces
├── constants.ts       # DEFAULT_CONFIG, ALL_SECTIONS, PROVIDER_META
├── utils.ts           # Template resolution, formatting helpers
├── styles.ts          # CSS as Lit css template
├── models.ts          # OpenRouter model fetching
└── helpers/
    ├── openrouter.ts  # Config → OpenRouter API payload
    └── langchain.ts   # Config → LangChain.js objects

helpers/
└── langchain.py       # Config → LangChain Python

demo/
└── index.html         # Interactive demo

dist/                  # Build outputs
├── lit-prompt-config.js           # ES module
├── lit-prompt-config.bundled.js   # IIFE with Lit included
├── index.d.ts                     # Type declarations
└── helpers/                       # Helper modules
```

## Build Outputs

| File | Size | Usage |
|------|------|-------|
| `dist/lit-prompt-config.js` | ~47KB | ES module, requires `lit` as peer dependency |
| `dist/lit-prompt-config.bundled.js` | ~59KB | IIFE bundle with Lit included, for CDN/script tag |

## Architecture

### Core Component (`src/prompt-config.ts`)

A Lit 3 web component using decorators:
- `@customElement('prompt-config')` - registers the element
- `@property()` - reactive public properties
- `@state()` - internal reactive state

### Events

| Event | Detail | When |
|-------|--------|------|
| `prompt-change` | `PromptConfig` | Any config value changes (debounced 250ms) |
| `prompt-save` | `PromptConfig` | User clicks Save button |
| `prompt-test` | `{ config, payload, resolvedMessages }` | User clicks Test button |

The `payload` in `prompt-test` is OpenRouter-ready—just add Authorization header and forward.

### Config JSON Shape

See `src/types.ts` for full TypeScript interfaces. Key fields:
- `model` - OpenRouter model ID (e.g., "anthropic/claude-sonnet-4-5")
- `systemPrompt` / `userPromptTemplate` - prompts with `{{variable}}` placeholders
- `temperature`, `maxTokens`, `topP`, etc. - model parameters
- `tools` - OpenAI-compatible tool definitions
- `responseFormat` - text, json_object, or json_schema
- `reasoning` / `reasoningEffort` - extended thinking settings

### Model Fetching

Fetches from `https://openrouter.ai/api/v1/models` (public, no auth). Uses the `supported_parameters` field to dim/disable unsupported settings per model.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on push/PR to main, tests on Node 18/20/22
- **Release** (`.github/workflows/release.yml`): Publishes to npm on tag `v*.*.*`

To release:
1. Update version in `package.json`
2. Commit and push
3. Create and push tag: `git tag v0.1.0 && git push --tags`
4. GitHub Actions will build, test, publish to npm, and create a release

**Note:** First publish must be done manually (`npm publish`) to create the package on npm before CI can publish.
