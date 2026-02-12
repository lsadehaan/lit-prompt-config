import { describe, it, expect } from 'vitest';
import { toPromptTemplate, getModelConfig, getProvider } from './langchain.js';
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

describe('toPromptTemplate', () => {
  it('converts {{var}} to {var} format', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: 'Summarize this: {{text}}',
    };
    const result = toPromptTemplate(config);
    expect(result.userTemplate).toBe('Summarize this: {text}');
  });

  it('extracts input variables', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: '{{greeting}} {{name}}, please {{action}}',
    };
    const result = toPromptTemplate(config);
    expect(result.inputVariables).toContain('greeting');
    expect(result.inputVariables).toContain('name');
    expect(result.inputVariables).toContain('action');
  });

  it('returns unique input variables', () => {
    const config: PromptConfig = {
      ...baseConfig,
      userPromptTemplate: '{{name}} said hi to {{name}}',
    };
    const result = toPromptTemplate(config);
    expect(result.inputVariables).toEqual(['name']);
  });

  it('preserves system template as-is', () => {
    const config: PromptConfig = {
      ...baseConfig,
      systemPrompt: 'You are a helpful assistant.',
    };
    const result = toPromptTemplate(config);
    expect(result.systemTemplate).toBe('You are a helpful assistant.');
  });

  it('handles empty templates', () => {
    const result = toPromptTemplate(baseConfig);
    expect(result.systemTemplate).toBe('');
    expect(result.userTemplate).toBe('');
    expect(result.inputVariables).toEqual([]);
  });
});

describe('getModelConfig', () => {
  it('includes basic model settings', () => {
    const config: PromptConfig = {
      ...baseConfig,
      model: 'openai/gpt-4o',
      temperature: 0.7,
      maxTokens: 2048,
    };
    const result = getModelConfig(config);

    expect(result.modelName).toBe('openai/gpt-4o');
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(2048);
  });

  it('excludes topP when 1 (default)', () => {
    const config: PromptConfig = { ...baseConfig, topP: 1 };
    const result = getModelConfig(config);
    expect(result.topP).toBeUndefined();
  });

  it('includes topP when not 1', () => {
    const config: PromptConfig = { ...baseConfig, topP: 0.9 };
    const result = getModelConfig(config);
    expect(result.topP).toBe(0.9);
  });

  it('includes topK when set', () => {
    const config: PromptConfig = { ...baseConfig, topK: 50 };
    const result = getModelConfig(config);
    expect(result.topK).toBe(50);
  });

  it('excludes topK when 0', () => {
    const config: PromptConfig = { ...baseConfig, topK: 0 };
    const result = getModelConfig(config);
    expect(result.topK).toBeUndefined();
  });

  it('includes frequencyPenalty when set', () => {
    const config: PromptConfig = { ...baseConfig, frequencyPenalty: 0.5 };
    const result = getModelConfig(config);
    expect(result.frequencyPenalty).toBe(0.5);
  });

  it('includes presencePenalty when set', () => {
    const config: PromptConfig = { ...baseConfig, presencePenalty: 0.3 };
    const result = getModelConfig(config);
    expect(result.presencePenalty).toBe(0.3);
  });

  it('includes stop sequences when set', () => {
    const config: PromptConfig = { ...baseConfig, stopSequences: ['END', 'DONE'] };
    const result = getModelConfig(config);
    expect(result.stop).toEqual(['END', 'DONE']);
  });

  it('excludes stop when empty', () => {
    const config: PromptConfig = { ...baseConfig, stopSequences: [] };
    const result = getModelConfig(config);
    expect(result.stop).toBeUndefined();
  });
});

describe('getProvider', () => {
  it('extracts provider from model ID', () => {
    expect(getProvider('anthropic/claude-sonnet-4-5')).toBe('anthropic');
    expect(getProvider('openai/gpt-4o')).toBe('openai');
    expect(getProvider('google/gemini-pro')).toBe('google');
  });

  it('returns model name when no slash (first segment)', () => {
    expect(getProvider('gpt-4o')).toBe('gpt-4o');
  });

  it('returns "unknown" for empty string', () => {
    expect(getProvider('')).toBe('unknown');
  });

  it('handles multiple slashes', () => {
    expect(getProvider('meta-llama/llama-3/70b')).toBe('meta-llama');
  });
});
