/**
 * Helper to convert a PromptConfig to LangChain.js compatible objects.
 */

import type { PromptConfig } from '../types.js';

/**
 * Prompt template configuration for LangChain.
 */
export interface LangChainPromptConfig {
  /** System message template */
  systemTemplate: string;
  /** User message template (with {variable} format) */
  userTemplate: string;
  /** List of input variable names */
  inputVariables: string[];
}

/**
 * Model configuration for LangChain.
 */
export interface LangChainModelConfig {
  /** Model name/ID */
  modelName: string;
  /** Temperature setting */
  temperature: number;
  /** Max output tokens */
  maxTokens: number;
  /** Top P sampling */
  topP?: number;
  /** Top K sampling */
  topK?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Stop sequences */
  stop?: string[];
}

/**
 * Extract input variable names from a template string.
 * Converts {{variable}} format to LangChain's {variable} format.
 */
function extractVariables(template: string | undefined): string[] {
  const matches = template?.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Convert {{variable}} placeholders to LangChain's {variable} format.
 */
function convertTemplate(template: string | undefined): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, '{$1}');
}

/**
 * Convert a PromptConfig to LangChain prompt template configuration.
 *
 * @example
 * ```ts
 * import { toPromptTemplate } from 'lit-prompt-config/helpers/langchain';
 * import { ChatPromptTemplate } from '@langchain/core/prompts';
 *
 * const templateConfig = toPromptTemplate(config);
 *
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ['system', templateConfig.systemTemplate],
 *   ['user', templateConfig.userTemplate],
 * ]);
 * ```
 */
export function toPromptTemplate(config: PromptConfig): LangChainPromptConfig {
  const userVars = extractVariables(config.userPromptTemplate);

  return {
    systemTemplate: config.systemPrompt || '',
    userTemplate: convertTemplate(config.userPromptTemplate),
    inputVariables: userVars,
  };
}

/**
 * Convert a PromptConfig to LangChain model configuration.
 *
 * @example
 * ```ts
 * import { getModelConfig } from 'lit-prompt-config/helpers/langchain';
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const modelConfig = getModelConfig(config);
 *
 * // For OpenRouter, use with base URL
 * const llm = new ChatOpenAI({
 *   ...modelConfig,
 *   configuration: {
 *     baseURL: 'https://openrouter.ai/api/v1',
 *   },
 * });
 * ```
 */
export function getModelConfig(config: PromptConfig): LangChainModelConfig {
  const result: LangChainModelConfig = {
    modelName: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };

  if (config.topP != null && config.topP !== 1) {
    result.topP = config.topP;
  }
  if (config.topK) {
    result.topK = config.topK;
  }
  if (config.frequencyPenalty) {
    result.frequencyPenalty = config.frequencyPenalty;
  }
  if (config.presencePenalty) {
    result.presencePenalty = config.presencePenalty;
  }
  if (config.stopSequences?.length) {
    result.stop = config.stopSequences;
  }

  return result;
}

/**
 * Get the provider name from an OpenRouter model ID.
 *
 * @example
 * ```ts
 * getProvider('anthropic/claude-sonnet-4-5') // 'anthropic'
 * getProvider('openai/gpt-4o') // 'openai'
 * ```
 */
export function getProvider(modelId: string): string {
  return modelId.split('/')[0] || 'unknown';
}
