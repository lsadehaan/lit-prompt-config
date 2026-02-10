/**
 * Helper to convert a PromptConfig to an Anthropic-compatible API payload.
 *
 * Note: Anthropic's API differs from OpenAI:
 * - system prompt is a top-level parameter, not in messages
 * - max_tokens is required
 * - some parameters have different names
 */

import type { PromptConfig, ToolDefinition } from '../types.js';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicPayload {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'none' } | { type: 'tool'; name: string };
}

/**
 * Resolve template variables in a string.
 */
function resolveTemplate(
  template: string | undefined,
  vars: Record<string, string>
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Convert OpenAI-style tool definitions to Anthropic format.
 */
function convertTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools
    .filter((t) => t.type === 'function' && t.function)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters || {},
    }));
}

/**
 * Convert a PromptConfig to an Anthropic API payload.
 *
 * @param config - The prompt configuration
 * @param variables - Optional variables to override sampleInputs
 * @returns Anthropic-compatible request body
 *
 * @example
 * ```ts
 * import { toAnthropicPayload } from 'lit-prompt-config/helpers/anthropic';
 * import Anthropic from '@anthropic-ai/sdk';
 *
 * const payload = toAnthropicPayload(config, { article_text: "..." });
 *
 * const anthropic = new Anthropic();
 * const response = await anthropic.messages.create(payload);
 * ```
 *
 * @example
 * ```ts
 * // Or with fetch
 * const response = await fetch('https://api.anthropic.com/v1/messages', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'x-api-key': ANTHROPIC_API_KEY,
 *     'anthropic-version': '2023-06-01',
 *   },
 *   body: JSON.stringify(payload),
 * });
 * ```
 */
export function toAnthropicPayload(
  config: PromptConfig,
  variables: Record<string, string> = {}
): AnthropicPayload {
  const mergedVars = { ...config.sampleInputs, ...variables };
  const resolvedUserPrompt = resolveTemplate(config.userPromptTemplate, mergedVars);

  // Build messages array (no system - it's separate in Anthropic)
  const messages: AnthropicMessage[] = [];
  if (resolvedUserPrompt) {
    messages.push({ role: 'user', content: resolvedUserPrompt });
  }

  // Extract model name (remove provider prefix if present)
  let model = config.model;
  if (model.includes('/')) {
    model = model.split('/').pop() || model;
  }

  const payload: AnthropicPayload = {
    model,
    messages,
    max_tokens: config.maxTokens || 4096, // Required for Anthropic
  };

  // System prompt is top-level in Anthropic
  if (config.systemPrompt) {
    payload.system = config.systemPrompt;
  }

  // Optional parameters
  if (config.temperature != null) {
    payload.temperature = config.temperature;
  }

  if (config.topP != null && config.topP !== 1) {
    payload.top_p = config.topP;
  }

  if (config.topK) {
    payload.top_k = config.topK;
  }

  if (config.stopSequences?.length) {
    payload.stop_sequences = config.stopSequences;
  }

  // Tools
  if (config.tools?.length) {
    payload.tools = convertTools(config.tools);

    if (config.toolChoice === 'required') {
      payload.tool_choice = { type: 'any' };
    } else if (config.toolChoice === 'none') {
      payload.tool_choice = { type: 'none' };
    }
    // 'auto' is default, no need to specify
  }

  return payload;
}
