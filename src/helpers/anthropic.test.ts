import { describe, it, expect } from 'vitest';
import { toAnthropicPayload } from './anthropic.js';
import type { PromptConfig } from '../types.js';

const baseConfig: PromptConfig = {
  id: 'test',
  name: 'Test',
  description: '',
  provider: 'anthropic',
  model: 'anthropic/claude-sonnet-4-5',
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

describe('toAnthropicPayload', () => {
  it('strips provider prefix from model', () => {
    const config: PromptConfig = { ...baseConfig, model: 'anthropic/claude-sonnet-4-5' };
    const payload = toAnthropicPayload(config);
    expect(payload.model).toBe('claude-sonnet-4-5');
  });

  it('handles model without prefix', () => {
    const config: PromptConfig = { ...baseConfig, model: 'claude-sonnet-4-5' };
    const payload = toAnthropicPayload(config);
    expect(payload.model).toBe('claude-sonnet-4-5');
  });

  it('puts system prompt at top level (not in messages)', () => {
    const config: PromptConfig = {
      ...baseConfig,
      systemPrompt: 'You are helpful.',
      userPromptTemplate: 'Hello!',
    };
    const payload = toAnthropicPayload(config);

    expect(payload.system).toBe('You are helpful.');
    expect(payload.messages).toEqual([{ role: 'user', content: 'Hello!' }]);
  });

  it('always includes max_tokens (required by Anthropic)', () => {
    const config: PromptConfig = { ...baseConfig, maxTokens: 0 };
    const payload = toAnthropicPayload(config);
    expect(payload.max_tokens).toBe(4096); // Default fallback
  });

  it('uses specified maxTokens', () => {
    const config: PromptConfig = { ...baseConfig, maxTokens: 2048 };
    const payload = toAnthropicPayload(config);
    expect(payload.max_tokens).toBe(2048);
  });

  it('resolves template variables', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: 'Analyze: {{content}}',
    };
    const payload = toAnthropicPayload(config, { content: 'test data' });
    expect(payload.messages[0].content).toBe('Analyze: test data');
  });

  it('uses stop_sequences (Anthropic naming)', () => {
    const config: PromptConfig = { ...baseConfig, stopSequences: ['END'] };
    const payload = toAnthropicPayload(config);
    expect(payload.stop_sequences).toEqual(['END']);
  });

  it('converts OpenAI tools to Anthropic format', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        },
      ],
    };
    const payload = toAnthropicPayload(config);

    expect(payload.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get current weather',
        input_schema: { type: 'object', properties: { city: { type: 'string' } } },
      },
    ]);
  });

  it('converts toolChoice "required" to "any"', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [{ type: 'function', function: { name: 'test', description: '', parameters: {} } }],
      toolChoice: 'required',
    };
    const payload = toAnthropicPayload(config);
    expect(payload.tool_choice).toEqual({ type: 'any' });
  });

  it('converts toolChoice "none" correctly', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [{ type: 'function', function: { name: 'test', description: '', parameters: {} } }],
      toolChoice: 'none',
    };
    const payload = toAnthropicPayload(config);
    expect(payload.tool_choice).toEqual({ type: 'none' });
  });

  it('omits toolChoice when "auto" (Anthropic default)', () => {
    const config: PromptConfig = {
      ...baseConfig,
      tools: [{ type: 'function', function: { name: 'test', description: '', parameters: {} } }],
      toolChoice: 'auto',
    };
    const payload = toAnthropicPayload(config);
    expect(payload.tool_choice).toBeUndefined();
  });

  it('excludes topP when set to 1', () => {
    const config: PromptConfig = { ...baseConfig, topP: 1 };
    const payload = toAnthropicPayload(config);
    expect(payload.top_p).toBeUndefined();
  });

  it('includes topP when not 1', () => {
    const config: PromptConfig = { ...baseConfig, topP: 0.95 };
    const payload = toAnthropicPayload(config);
    expect(payload.top_p).toBe(0.95);
  });

  it('includes topK when set', () => {
    const config: PromptConfig = { ...baseConfig, topK: 40 };
    const payload = toAnthropicPayload(config);
    expect(payload.top_k).toBe(40);
  });

  it('excludes system when empty', () => {
    const config: PromptConfig = { ...baseConfig, systemPrompt: '' };
    const payload = toAnthropicPayload(config);
    expect(payload.system).toBeUndefined();
  });
});
