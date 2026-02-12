/**
 * Extract template variable names from a string with {{variable}} placeholders.
 */
export function extractTemplateVars(template: string | undefined): string[] {
  const matches = template?.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Resolve template variables in a string.
 * Variables not found in vars remain as {{variable}}.
 */
export function resolveTemplate(
  template: string | undefined,
  vars: Record<string, string>
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Format context length for display (e.g., 128000 -> "128k", 1000000 -> "1M").
 */
export function formatContextLength(len: number | undefined): string {
  if (!len) return '?';
  if (len >= 1000000) {
    return `${(len / 1000000).toFixed(len % 1000000 === 0 ? 0 : 1)}M`;
  }
  return `${Math.round(len / 1000)}k`;
}

/**
 * Format price string for display (per 1M tokens).
 */
export function formatPrice(priceStr: string | undefined): string {
  if (!priceStr || priceStr === '0') return 'free';
  const p = parseFloat(priceStr) * 1_000_000;
  if (p < 0.01) return '<$0.01/M';
  return `$${p.toFixed(2)}/M`;
}

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Convert OpenRouter price string (per token) to cost per million tokens.
 * Returns null if price is invalid or zero.
 */
export function priceToCostPerMillion(priceStr: string | undefined): number | null {
  if (!priceStr || priceStr === '0') return null;
  const perToken = parseFloat(priceStr);
  if (isNaN(perToken) || perToken === 0) return null;
  return perToken * 1_000_000;
}

/**
 * Estimate cost for a single API call based on token counts and pricing.
 * Returns formatted string like "$0.0012" or null if pricing unavailable.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMillion: number | null,
  outputCostPerMillion: number | null
): string | null {
  if (inputCostPerMillion === null && outputCostPerMillion === null) {
    return null;
  }
  const inputCost = inputCostPerMillion ? (inputTokens / 1_000_000) * inputCostPerMillion : 0;
  const outputCost = outputCostPerMillion ? (outputTokens / 1_000_000) * outputCostPerMillion : 0;
  const total = inputCost + outputCost;
  if (total < 0.0001) return '<$0.0001';
  if (total < 0.01) return `$${total.toFixed(4)}`;
  return `$${total.toFixed(4)}`;
}
