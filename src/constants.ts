import type { PromptConfig, SectionId, ProviderMeta } from './types.js';

/**
 * Default configuration object with sensible defaults.
 */
export const DEFAULT_CONFIG: PromptConfig = {
  id: '',
  name: '',
  model: '',
  systemPrompt: '',
  userPromptTemplate: '',
  temperature: 1.0,
  maxTokens: 4096,
  topP: 1.0,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  repetitionPenalty: 1.0,
  minP: 0,
  stopSequences: [],
  responseFormat: 'text',
  jsonSchema: null,
  tools: [],
  toolChoice: 'auto',
  reasoning: false,
  reasoningEffort: 'medium',
  sampleInputs: {},
  metadata: {},
};

/**
 * All available UI sections.
 */
export const ALL_SECTIONS: SectionId[] = [
  'identity',
  'model',
  'prompts',
  'parameters',
  'response',
  'tools',
  'reasoning',
  'test',
];

/**
 * Provider display metadata (label and brand color).
 */
export const PROVIDER_META: Record<string, ProviderMeta> = {
  'anthropic': { label: 'Anthropic', color: '#d97757' },
  'openai': { label: 'OpenAI', color: '#10a37f' },
  'google': { label: 'Google', color: '#4285f4' },
  'x-ai': { label: 'xAI (Grok)', color: '#1d9bf0' },
  'meta-llama': { label: 'Meta Llama', color: '#0668E1' },
  'mistralai': { label: 'Mistral', color: '#ff7000' },
  'deepseek': { label: 'DeepSeek', color: '#5b6ee1' },
  'qwen': { label: 'Qwen', color: '#6c3baa' },
  'cohere': { label: 'Cohere', color: '#39594d' },
  'perplexity': { label: 'Perplexity', color: '#20808d' },
  'openrouter': { label: 'OpenRouter', color: '#9370db' },
};

/**
 * OpenRouter models API endpoint.
 */
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
