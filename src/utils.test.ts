import { describe, it, expect } from 'vitest';
import {
  extractTemplateVars,
  resolveTemplate,
  formatContextLength,
  formatPrice,
  priceToCostPerMillion,
  estimateCost,
} from './utils.js';

describe('extractTemplateVars', () => {
  it('extracts variable names from template', () => {
    expect(extractTemplateVars('Hello {{name}}, your order {{orderId}} is ready'))
      .toEqual(['name', 'orderId']);
  });

  it('returns unique variables', () => {
    expect(extractTemplateVars('{{name}} said hello to {{name}}'))
      .toEqual(['name']);
  });

  it('returns empty array for no variables', () => {
    expect(extractTemplateVars('Hello world')).toEqual([]);
  });

  it('handles undefined input', () => {
    expect(extractTemplateVars(undefined)).toEqual([]);
  });

  it('handles empty string', () => {
    expect(extractTemplateVars('')).toEqual([]);
  });

  it('ignores malformed placeholders', () => {
    expect(extractTemplateVars('Hello {name} and {{ spaced }}')).toEqual([]);
  });
});

describe('resolveTemplate', () => {
  it('replaces variables with values', () => {
    expect(resolveTemplate('Hello {{name}}!', { name: 'World' }))
      .toBe('Hello World!');
  });

  it('replaces multiple variables', () => {
    expect(resolveTemplate('{{greeting}} {{name}}!', { greeting: 'Hi', name: 'Alice' }))
      .toBe('Hi Alice!');
  });

  it('leaves unmatched variables as-is', () => {
    expect(resolveTemplate('Hello {{name}}!', {}))
      .toBe('Hello {{name}}!');
  });

  it('handles undefined template', () => {
    expect(resolveTemplate(undefined, { name: 'World' })).toBe('');
  });

  it('handles empty template', () => {
    expect(resolveTemplate('', { name: 'World' })).toBe('');
  });

  it('handles partial matches', () => {
    expect(resolveTemplate('{{a}} {{b}} {{c}}', { a: '1', c: '3' }))
      .toBe('1 {{b}} 3');
  });
});

describe('formatContextLength', () => {
  it('formats thousands as k', () => {
    expect(formatContextLength(128000)).toBe('128k');
    expect(formatContextLength(32000)).toBe('32k');
    expect(formatContextLength(4096)).toBe('4k');
  });

  it('formats millions as M', () => {
    expect(formatContextLength(1000000)).toBe('1M');
    expect(formatContextLength(2000000)).toBe('2M');
  });

  it('formats fractional millions', () => {
    expect(formatContextLength(1500000)).toBe('1.5M');
  });

  it('handles undefined', () => {
    expect(formatContextLength(undefined)).toBe('?');
  });

  it('handles zero', () => {
    expect(formatContextLength(0)).toBe('?');
  });
});

describe('formatPrice', () => {
  it('formats free models', () => {
    expect(formatPrice('0')).toBe('free');
    expect(formatPrice(undefined)).toBe('free');
  });

  it('formats normal prices per million tokens', () => {
    // Price is per token, we multiply by 1M for display
    expect(formatPrice('0.000003')).toBe('$3.00/M');
    expect(formatPrice('0.000015')).toBe('$15.00/M');
  });

  it('formats very small prices', () => {
    expect(formatPrice('0.000000001')).toBe('<$0.01/M');
  });
});

describe('priceToCostPerMillion', () => {
  it('converts price string to cost per million', () => {
    expect(priceToCostPerMillion('0.000003')).toBe(3);
    expect(priceToCostPerMillion('0.000015')).toBe(15);
  });

  it('returns null for free/zero price', () => {
    expect(priceToCostPerMillion('0')).toBeNull();
    expect(priceToCostPerMillion(undefined)).toBeNull();
  });

  it('returns null for invalid price', () => {
    expect(priceToCostPerMillion('invalid')).toBeNull();
  });
});

describe('estimateCost', () => {
  it('calculates cost based on token counts and pricing', () => {
    // 1000 input tokens at $3/M + 500 output tokens at $15/M
    // = (1000/1M * 3) + (500/1M * 15) = 0.003 + 0.0075 = 0.0105
    const result = estimateCost(1000, 500, 3, 15);
    expect(result).toBe('$0.0105');
  });

  it('returns null when no pricing available', () => {
    expect(estimateCost(1000, 500, null, null)).toBeNull();
  });

  it('handles partial pricing (input only)', () => {
    // 1000 input tokens at $3/M = 0.003
    const result = estimateCost(1000, 500, 3, null);
    expect(result).toBe('$0.0030');
  });

  it('handles partial pricing (output only)', () => {
    // 500 output tokens at $15/M = 0.0075
    const result = estimateCost(1000, 500, null, 15);
    expect(result).toBe('$0.0075');
  });

  it('formats very small costs', () => {
    const result = estimateCost(10, 10, 0.1, 0.1);
    expect(result).toBe('<$0.0001');
  });
});
