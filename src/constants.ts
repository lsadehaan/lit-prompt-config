import type { PromptConfig, SectionId, ProviderMeta, Labels } from './types.js';

/**
 * Default configuration object with sensible defaults.
 */
export const DEFAULT_CONFIG: PromptConfig = {
  id: '',
  name: '',
  description: '',
  provider: '',
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

/**
 * Default English labels for the UI.
 * Override via the `labels` property for i18n.
 */
export const DEFAULT_LABELS: Labels = {
  // Headers
  promptConfiguration: 'Prompt Configuration',
  advancedConfiguration: 'Advanced Configuration',
  advancedSettings: 'Advanced Settings',

  // Buttons
  import: 'Import',
  export: 'Export',
  save: 'Save',
  testPrompt: 'Test Prompt',
  testing: 'Testing...',
  copy: 'Copy',
  copied: 'Copied!',

  // Field labels
  name: 'Name',
  description: 'Description',
  provider: 'Provider',
  model: 'Model',
  configId: 'Config ID',
  systemPrompt: 'System Prompt',
  userPromptTemplate: 'User Prompt Template',
  sampleInputs: 'Sample Inputs (for testing)',
  temperature: 'Temperature',
  maxTokens: 'Max Tokens',
  topP: 'Top P',
  topK: 'Top K',
  minP: 'Min P',
  frequencyPenalty: 'Frequency Penalty',
  presencePenalty: 'Presence Penalty',
  repetitionPenalty: 'Repetition Penalty',
  stopSequences: 'Stop Sequences',
  format: 'Format',
  jsonSchema: 'JSON Schema',
  toolDefinitions: 'Tool Definitions',
  toolChoice: 'Tool Choice',
  reasoningEffort: 'Reasoning Effort',

  // Subsection titles
  parameters: 'Parameters',
  responseFormat: 'Response Format',
  tools: 'Tools',
  reasoning: 'Reasoning',

  // Placeholders
  placeholderName: 'Prompt name',
  placeholderDescription: 'What does this prompt do?',
  placeholderSelectProvider: 'Select provider',
  placeholderSelectModel: 'Select model',
  placeholderSelectProviderFirst: 'Select provider first',
  placeholderLoading: 'Loading...',
  placeholderSystemPrompt: 'You are a helpful assistant that...',
  placeholderUserPrompt: 'Summarize this article:\n\n{{article_text}}',
  placeholderSampleValue: 'Sample value...',
  placeholderStopSequences: 'Enter stop sequences, one per line',
  placeholderJsonSchema: '{"name": "my_schema", "strict": true, "schema": { "type": "object", "properties": { ... } } }',
  placeholderToolDefinitions: '[{ "type": "function", "function": { "name": "get_weather", ... } }]',

  // Hints
  hintTemplateVars: 'Use {{variable}} for placeholders',
  hintOnePerLine: 'one per line',
  hintOpenAISchema: 'OpenAI-compatible schema object',
  hintOpenAITools: 'OpenAI-compatible tools array',

  // Status messages
  statusSelectModel: 'Select a model first',
  statusAddPrompt: 'Add a prompt first',
  statusTemplateVarsEmpty: 'Warning: Some template variables are empty',

  // Response format options
  formatText: 'Text (default)',
  formatJsonObject: 'JSON Object',
  formatJsonSchema: 'JSON Schema (structured output)',

  // Tool choice options
  toolChoiceAuto: 'Auto',
  toolChoiceNone: 'None',
  toolChoiceRequired: 'Required',

  // Reasoning options
  reasoningLow: 'Low',
  reasoningMedium: 'Medium',
  reasoningHigh: 'High',
  enableReasoning: 'Enable extended thinking / reasoning',

  // Model info
  context: 'Context',
  maxOutput: 'Max Output',
  modality: 'Modality',
  pricing: 'Pricing (in/out)',
  supportedParameters: 'Supported parameters',

  // Test results
  response: 'Response',
  error: 'Error',
};
