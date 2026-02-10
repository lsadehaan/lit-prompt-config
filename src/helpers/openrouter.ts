/**
 * Helper to convert a PromptConfig to an OpenRouter-compatible API payload.
 */

import type {
  PromptConfig,
  OpenRouterPayload,
  Message,
} from '../types.js';

/**
 * Resolve template variables in a string.
 * Variables not found remain as {{variable}}.
 */
function resolveTemplate(
  template: string | undefined,
  vars: Record<string, string>
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Convert a PromptConfig to an OpenRouter API payload.
 *
 * @param config - The prompt configuration
 * @param variables - Optional variables to override sampleInputs
 * @returns OpenRouter-compatible request body (add Authorization header before sending)
 *
 * @example
 * ```ts
 * import { toOpenRouterPayload } from 'lit-prompt-config/helpers/openrouter';
 *
 * const payload = toOpenRouterPayload(config, { article_text: "..." });
 *
 * const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
 *   },
 *   body: JSON.stringify(payload),
 * });
 * ```
 */
export function toOpenRouterPayload(
  config: PromptConfig,
  variables: Record<string, string> = {}
): OpenRouterPayload {
  const mergedVars = { ...config.sampleInputs, ...variables };
  const resolvedUserPrompt = resolveTemplate(config.userPromptTemplate, mergedVars);

  const messages: Message[] = [];
  if (config.systemPrompt) {
    messages.push({ role: 'system', content: config.systemPrompt });
  }
  if (resolvedUserPrompt) {
    messages.push({ role: 'user', content: resolvedUserPrompt });
  }

  const payload: OpenRouterPayload = {
    model: config.model,
    messages,
  };

  // Add optional parameters
  if (config.temperature != null) {
    payload.temperature = config.temperature;
  }
  if (config.maxTokens) {
    payload.max_tokens = config.maxTokens;
  }
  if (config.topP != null && config.topP !== 1) {
    payload.top_p = config.topP;
  }
  if (config.topK) {
    payload.top_k = config.topK;
  }
  if (config.frequencyPenalty) {
    payload.frequency_penalty = config.frequencyPenalty;
  }
  if (config.presencePenalty) {
    payload.presence_penalty = config.presencePenalty;
  }
  if (config.repetitionPenalty && config.repetitionPenalty !== 1) {
    payload.repetition_penalty = config.repetitionPenalty;
  }
  if (config.minP) {
    payload.min_p = config.minP;
  }
  if (config.stopSequences?.length) {
    payload.stop = config.stopSequences;
  }

  // Response format
  if (config.responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  } else if (config.responseFormat === 'json_schema' && config.jsonSchema) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: config.jsonSchema,
    };
  }

  // Tools
  if (config.tools?.length) {
    payload.tools = config.tools;
    if (config.toolChoice !== 'auto') {
      payload.tool_choice = config.toolChoice;
    }
  }

  // Reasoning
  if (config.reasoning) {
    payload.reasoning = { effort: config.reasoningEffort || 'medium' };
  }

  return payload;
}
