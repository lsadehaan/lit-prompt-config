/**
 * Core configuration interface for LLM prompts.
 * This is the main data structure stored and managed by the component.
 */
export interface PromptConfig {
  /** Unique ID for storage (e.g., "summarize-article") */
  id: string;
  /** Human-readable display name */
  name: string;
  /** OpenRouter model ID (e.g., "anthropic/claude-sonnet-4-5") */
  model: string;
  /** System message */
  systemPrompt: string;
  /** User message with {{variable}} placeholders */
  userPromptTemplate: string;
  /** Temperature: 0-2, default 1.0 */
  temperature: number;
  /** Max response tokens */
  maxTokens: number;
  /** Top P: 0-1, default 1.0 */
  topP: number;
  /** Top K: 0-500, default 0 (disabled) */
  topK: number;
  /** Frequency penalty: -2 to 2, default 0 */
  frequencyPenalty: number;
  /** Presence penalty: -2 to 2, default 0 */
  presencePenalty: number;
  /** Repetition penalty: 0-2, default 1.0 */
  repetitionPenalty: number;
  /** Min P: 0-1, default 0 */
  minP: number;
  /** Stop sequences */
  stopSequences: string[];
  /** Response format type */
  responseFormat: ResponseFormat;
  /** JSON schema for structured output */
  jsonSchema: JsonSchema | null;
  /** OpenAI-compatible tool definitions */
  tools: ToolDefinition[];
  /** Tool choice mode */
  toolChoice: ToolChoice;
  /** Enable extended thinking/reasoning */
  reasoning: boolean;
  /** Reasoning effort level */
  reasoningEffort: ReasoningEffort;
  /** Values for template variables (for testing) */
  sampleInputs: Record<string, string>;
  /** User-defined metadata */
  metadata: Record<string, unknown>;
}

export type ResponseFormat = 'text' | 'json_object' | 'json_schema';
export type ToolChoice = 'auto' | 'none' | 'required';
export type ReasoningEffort = 'low' | 'medium' | 'high';
export type ThemeMode = 'light' | 'dark' | 'auto';

export type SectionId =
  | 'identity'
  | 'model'
  | 'prompts'
  | 'parameters'
  | 'response'
  | 'tools'
  | 'reasoning'
  | 'test';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  supported_parameters?: string[];
}

export interface ProviderMeta {
  label: string;
  color: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterPayload {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  stop?: string[];
  response_format?: { type: string; json_schema?: JsonSchema };
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  reasoning?: { effort: ReasoningEffort };
}

/**
 * Detail object emitted with the prompt-test event.
 */
export interface PromptTestDetail {
  /** Full config snapshot */
  config: PromptConfig;
  /** Ready-to-forward OpenRouter API request body */
  payload: OpenRouterPayload;
  /** Template variables resolved with sampleInputs */
  resolvedMessages: Message[];
}
