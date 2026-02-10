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
