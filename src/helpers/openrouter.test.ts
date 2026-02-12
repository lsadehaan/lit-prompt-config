import { describe, it, expect } from 'vitest';
import { toOpenRouterPayload } from './openrouter.js';
import type { PromptConfig } from '../types.js';

const baseConfig: PromptConfig = {
  id: 'test',
  name: 'Test',
  description: '',
  provider: 'openai',
  model: 'openai/gpt-4o',
  systemPrompt: '',
  userPromptTemplate: '',
  temperature: 1,
  maxTokens: 4096,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  repetitionPenalty: 1,
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
  inputCostPerMillion: null,
  outputCostPerMillion: null,
};

describe('toOpenRouterPayload', () => {
  it('creates basic payload with model and messages', () => {
    const config: PromptConfig = {
      ...baseConfig,
      systemPrompt: 'You are helpful.',
      userPromptTemplate: 'Hello!',
    };

    const payload = toOpenRouterPayload(config);

    expect(payload.model).toBe('openai/gpt-4o');
    expect(payload.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello!' },
    ]);
  });

  it('resolves template variables', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: 'Summarize: {{text}}',
      sampleInputs: { text: 'default text' },
    };

    const payload = toOpenRouterPayload(config, { text: 'override text' });

    expect(payload.messages[0].content).toBe('Summarize: override text');
  });

  it('uses sampleInputs when no override provided', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: 'Summarize: {{text}}',
      sampleInputs: { text: 'sample text' },
    };

    const payload = toOpenRouterPayload(config);

    expect(payload.messages[0].content).toBe('Summarize: sample text');
  });

  it('includes temperature', () => {
    const config: PromptConfig = { ...baseConfig, temperature: 0.7 };
    const payload = toOpenRouterPayload(config);
    expect(payload.temperature).toBe(0.7);
  });

  it('includes maxTokens as max_tokens', () => {
    const config: PromptConfig = { ...baseConfig, maxTokens: 2048 };
    const payload = toOpenRouterPayload(config);
    expect(payload.max_tokens).toBe(2048);
  });

  it('excludes topP when set to 1 (default)', () => {
    const config: PromptConfig = { ...baseConfig, topP: 1 };
    const payload = toOpenRouterPayload(config);
    expect(payload.top_p).toBeUndefined();
  });

  it('includes topP when not 1', () => {
    const config: PromptConfig = { ...baseConfig, topP: 0.9 };
    const payload = toOpenRouterPayload(config);
    expect(payload.top_p).toBe(0.9);
  });

  it('includes stop sequences', () => {
    const config: PromptConfig = { ...baseConfig, stopSequences: ['END', 'STOP'] };
    const payload = toOpenRouterPayload(config);
    expect(payload.stop).toEqual(['END', 'STOP']);
  });

  it('sets json_object response format', () => {
    const config: PromptConfig = { ...baseConfig, responseFormat: 'json_object' };
    const payload = toOpenRouterPayload(config);
    expect(payload.response_format).toEqual({ type: 'json_object' });
  });

  it('sets json_schema response format with schema', () => {
    const schema = { name: 'test', schema: { type: 'object' } };
    const config: PromptConfig = {
      ...baseConfig,
      responseFormat: 'json_schema',
      jsonSchema: schema,
    };
    const payload = toOpenRouterPayload(config);
    expect(payload.response_format).toEqual({
      type: 'json_schema',
      json_schema: schema,
    });
  });

  it('includes tools', () => {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
    const config: PromptConfig = { ...baseConfig, tools };
    const payload = toOpenRouterPayload(config);
    expect(payload.tools).toEqual(tools);
  });

  it('includes toolChoice when not auto', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [{ type: 'function', function: { name: 'test', description: '', parameters: {} } }],
      toolChoice: 'required',
    };
    const payload = toOpenRouterPayload(config);
    expect(payload.tool_choice).toBe('required');
  });

  it('excludes toolChoice when auto', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [{ type: 'function', function: { name: 'test', description: '', parameters: {} } }],
      toolChoice: 'auto',
    };
    const payload = toOpenRouterPayload(config);
    expect(payload.tool_choice).toBeUndefined();
  });

  it('includes reasoning when enabled', () => {
    const config: PromptConfig = { ...baseConfig, reasoning: true, reasoningEffort: 'high' };
    const payload = toOpenRouterPayload(config);
    expect(payload.reasoning).toEqual({ effort: 'high' });
  });

  it('excludes reasoning when disabled', () => {
    const config: PromptConfig = { ...baseConfig, reasoning: false };
    const payload = toOpenRouterPayload(config);
    expect(payload.reasoning).toBeUndefined();
  });

  it('omits empty system prompt', () => {
    const config: PromptConfig = {
      ...baseConfig,
      systemPrompt: '',
      userPromptTemplate: 'Hello',
    };
    const payload = toOpenRouterPayload(config);
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].role).toBe('user');
  });
});
