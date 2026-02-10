import type { OpenRouterModel } from './types.js';
import { OPENROUTER_MODELS_URL } from './constants.js';

export interface ModelFetchResult {
  models: OpenRouterModel[];
  error: string | null;
}

/**
 * Fetch the list of available models from OpenRouter's public API.
 * No authentication required.
 */
export async function fetchOpenRouterModels(): Promise<ModelFetchResult> {
  try {
    const res = await fetch(OPENROUTER_MODELS_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const models = ((data.data as OpenRouterModel[]) || []).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    return { models, error: null };
  } catch (e) {
    return { models: [], error: (e as Error).message };
  }
}
