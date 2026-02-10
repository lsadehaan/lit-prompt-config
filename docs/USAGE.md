# Usage Guide

This guide explains how to integrate `<prompt-config>` into your application.

## Architecture Overview

The component is a **UI-only layer**. It does not make API calls to save, load, or test prompts. Your application handles all data operations via events.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR APPLICATION                               │
└─────────────────────────────────────────────────────────────────────────────┘
         │                           │                           │
         │ 1. Load config            │ 2. User edits             │ 3. LLM calls
         │    from your DB           │    & saves                │    at runtime
         ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│                 │      │                     │      │                     │
│  YOUR DATABASE  │      │  <prompt-config>    │      │   YOUR BACKEND      │
│                 │      │                     │      │                     │
│  Stores config  │◄────►│  UI-only component  │      │  Makes LLM API      │
│  as JSON        │      │  Emits events       │      │  calls with config  │
│                 │      │                     │      │                     │
└─────────────────┘      └─────────────────────┘      └─────────────────────┘
```

## What the Component Does

| Does | Does NOT |
|------|----------|
| Renders config UI | Save to database |
| Emits change/save/test events | Load from database |
| Fetches model list from OpenRouter | Make LLM API calls |
| Validates input fields | Handle authentication |

## Data Flow

### Step 1: Load Config into Component

You fetch the config from your database and set it on the component.

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │  fetch  │              │  .value │              │
│   Database   │────────►│  Your Code   │────────►│  Component   │
│              │         │              │    =    │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

```javascript
// Your code fetches and sets
const config = await fetch('/api/prompt-configs/summarizer').then(r => r.json());
document.querySelector('prompt-config').value = config;
```

### Step 2: User Edits Config

User makes changes in the UI. Component emits `prompt-change` events (debounced).

```
┌──────────────┐                    ┌──────────────┐
│              │  prompt-change     │              │
│  Component   │───────────────────►│  Your Code   │
│              │  (event.detail)    │  (optional)  │
└──────────────┘                    └──────────────┘
```

```javascript
// Optional: track unsaved changes
pc.addEventListener('prompt-change', (e) => {
  setHasUnsavedChanges(true);
  setCurrentConfig(e.detail);
});
```

### Step 3: User Clicks Save

Component emits `prompt-save` event. You save to your database.

```
┌──────────────┐                    ┌──────────────┐         ┌──────────────┐
│              │  prompt-save       │              │  PUT    │              │
│  Component   │───────────────────►│  Your Code   │────────►│   Database   │
│              │  (event.detail)    │              │         │              │
└──────────────┘                    └──────────────┘         └──────────────┘
```

```javascript
pc.addEventListener('prompt-save', async (e) => {
  const config = e.detail;

  await fetch(`/api/prompt-configs/${config.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  showToast('Saved!');
});
```

### Step 4: User Clicks Test

Component emits `prompt-test` event with ready-to-send payload. You proxy through your backend (which adds API keys).

```
┌──────────────┐                    ┌──────────────┐         ┌──────────────┐
│              │  prompt-test       │              │  POST   │              │
│  Component   │───────────────────►│  Your Code   │────────►│ Your Backend │
│              │                    │              │         │              │
│              │◄───────────────────│              │◄────────│  (adds key,  │
│              │  setTestResult()   │              │         │  calls LLM)  │
└──────────────┘                    └──────────────┘         └──────────────┘
```

```javascript
pc.addEventListener('prompt-test', async (e) => {
  const { payload } = e.detail;

  pc.setTestLoading(true);

  try {
    // Your backend adds the API key and forwards to LLM
    const response = await fetch('/api/llm/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    pc.setTestResult(data.choices?.[0]?.message?.content || data);
  } catch (err) {
    pc.setTestError(err.message);
  }
});
```

### Step 5: Using Config for LLM Calls (Runtime)

When your application needs to make an LLM call, load the config and convert to API format.

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │  load   │              │ convert │              │
│   Database   │────────►│ Your Backend │────────►│   LLM API    │
│              │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
                                │
                                │ toOpenRouterPayload(config, variables)
                                │ toAnthropicPayload(config, variables)
                                ▼
                         ┌──────────────┐
                         │ Ready-to-send│
                         │ API payload  │
                         └──────────────┘
```

```typescript
// Backend code (Node.js example)
import { toOpenRouterPayload } from 'lit-prompt-config/helpers/openrouter';

async function summarizeArticle(articleText: string) {
  // 1. Load config from database
  const config = await db.promptConfigs.findById('summarizer');

  // 2. Convert to API payload, injecting runtime variables
  const payload = toOpenRouterPayload(config, {
    article_text: articleText
  });

  // 3. Call LLM API
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}
```

## Complete React Example

```tsx
import { useEffect, useRef, useState } from 'react';
import 'lit-prompt-config';
import type { PromptConfig } from 'lit-prompt-config';

interface PromptConfigElement extends HTMLElement {
  value: PromptConfig;
  setTestLoading(loading: boolean): void;
  setTestResult(result: string | object): void;
  setTestError(error: string): void;
}

export function PromptConfigPage({ configId }: { configId: string }) {
  const ref = useRef<PromptConfigElement>(null);
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(() => {
    fetch(`/api/prompt-configs/${configId}`)
      .then(r => r.json())
      .then(config => {
        if (ref.current) {
          ref.current.value = config;
        }
        setLoading(false);
      });
  }, [configId]);

  // Set up event handlers
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleSave = async (e: CustomEvent<PromptConfig>) => {
      await fetch(`/api/prompt-configs/${e.detail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.detail),
      });
    };

    const handleTest = async (e: CustomEvent) => {
      el.setTestLoading(true);
      try {
        const res = await fetch('/api/llm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e.detail.payload),
        });
        const data = await res.json();
        el.setTestResult(data.choices?.[0]?.message?.content || data);
      } catch (err: any) {
        el.setTestError(err.message);
      }
    };

    el.addEventListener('prompt-save', handleSave as EventListener);
    el.addEventListener('prompt-test', handleTest as EventListener);

    return () => {
      el.removeEventListener('prompt-save', handleSave as EventListener);
      el.removeEventListener('prompt-test', handleTest as EventListener);
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return <prompt-config ref={ref} theme="auto" />;
}
```

## Database Schema

Store the config as JSON. Example for PostgreSQL:

```sql
CREATE TABLE prompt_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example insert
INSERT INTO prompt_configs (id, name, config) VALUES (
  'summarizer',
  'Article Summarizer',
  '{
    "id": "summarizer",
    "name": "Article Summarizer",
    "provider": "anthropic",
    "model": "anthropic/claude-sonnet-4-5",
    "systemPrompt": "You summarize articles concisely.",
    "userPromptTemplate": "Summarize this:\n\n{{article_text}}",
    "temperature": 0.7,
    "maxTokens": 1024
  }'::jsonb
);
```

## Backend Test Endpoint

Your `/api/llm/test` endpoint should add the API key and forward to the LLM:

```typescript
// Express.js example
app.post('/api/llm/test', async (req, res) => {
  const payload = req.body;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  res.json(data);
});
```

## Summary

| Action | Who Does It | How |
|--------|-------------|-----|
| Load config | Your code | `fetch()` → `component.value = config` |
| Display/edit | Component | Automatic |
| Save config | Your code | Listen to `prompt-save` → `fetch()` to your API |
| Test prompt | Your code | Listen to `prompt-test` → proxy through backend |
| Runtime LLM calls | Your backend | Load from DB → `toOpenRouterPayload()` → API call |

The component is stateless UI. You own the data.
