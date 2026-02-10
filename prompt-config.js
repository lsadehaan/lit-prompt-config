/**
 * <prompt-config> — A Lit web component for LLM prompt management.
 *
 * Fetches models from OpenRouter's public API, manages all prompt/model settings
 * as a single JSON config object, and emits events for testing and persistence.
 *
 * @element prompt-config
 *
 * @property {Object} value - The prompt configuration object (two-way via events)
 * @property {Array<string>} enabledSections - Which UI sections to show
 * @property {Array<string>} providerFilter - Filter models to specific providers
 * @property {Object} sampleInputs - Default sample inputs for template variables
 * @property {String} theme - 'light' | 'dark' | 'auto'
 *
 * @fires prompt-change - When any config value changes. detail = full config object
 * @fires prompt-test - When user clicks Test. detail = { config, resolvedMessages }
 * @fires prompt-save - When user clicks Save. detail = full config object
 *
 * @method setTestResult(result) - Display test result in the component
 * @method setTestError(error) - Display test error in the component
 * @method setTestLoading(loading) - Set loading state for test button
 *
 * Usage:
 *   <prompt-config
 *     .value=${{ model: 'anthropic/claude-sonnet-4-5', systemPrompt: '...' }}
 *     .providerFilter=${['anthropic', 'openai', 'google', 'x-ai', 'meta-llama']}
 *     @prompt-change=${(e) => saveToDb(e.detail)}
 *     @prompt-test=${async (e) => {
 *       const el = e.target;
 *       el.setTestLoading(true);
 *       try {
 *         const res = await fetch('/api/test-prompt', {
 *           method: 'POST', body: JSON.stringify(e.detail)
 *         });
 *         el.setTestResult(await res.json());
 *       } catch(err) { el.setTestError(err.message); }
 *     }}
 *   ></prompt-config>
 */

import { LitElement, html, css, nothing } from 'https://cdn.jsdelivr.net/gh/nicolo-ribaudo/lit@nicolo-ribaudo/esm-build/core/lit-core.min.js';

// ─── Default config shape ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  id: '',
  name: '',
  model: '',
  systemPrompt: '',
  userPromptTemplate: '',
  temperature: 1.0,
  maxTokens: 4096,
  topP: 1.0,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  repetitionPenalty: 1.0,
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
};

// ─── All possible sections ───────────────────────────────────────────────────
const ALL_SECTIONS = [
  'identity',      // id + name
  'model',         // provider + model selector
  'prompts',       // system prompt + user template + variables
  'parameters',    // temperature, tokens, etc.
  'response',      // response format, json schema
  'tools',         // tool definitions, tool_choice
  'reasoning',     // reasoning/thinking toggle + effort
  'test',          // test button + result display
];

// ─── Provider display info ───────────────────────────────────────────────────
const PROVIDER_META = {
  'anthropic':    { label: 'Anthropic',   color: '#d97757' },
  'openai':       { label: 'OpenAI',      color: '#10a37f' },
  'google':       { label: 'Google',      color: '#4285f4' },
  'x-ai':         { label: 'xAI (Grok)',  color: '#1d9bf0' },
  'meta-llama':   { label: 'Meta Llama',  color: '#0668E1' },
  'mistralai':    { label: 'Mistral',     color: '#ff7000' },
  'deepseek':     { label: 'DeepSeek',    color: '#5b6ee1' },
  'qwen':         { label: 'Qwen',        color: '#6c3baa' },
  'cohere':       { label: 'Cohere',      color: '#39594d' },
  'perplexity':   { label: 'Perplexity',  color: '#20808d' },
  'openrouter':   { label: 'OpenRouter',  color: '#9370db' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractTemplateVars(template) {
  const matches = template?.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function resolveTemplate(template, vars) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function formatContextLength(len) {
  if (!len) return '?';
  if (len >= 1000000) return `${(len / 1000000).toFixed(len % 1000000 === 0 ? 0 : 1)}M`;
  return `${Math.round(len / 1000)}k`;
}

function formatPrice(priceStr) {
  if (!priceStr || priceStr === '0') return 'free';
  const p = parseFloat(priceStr) * 1_000_000;
  if (p < 0.01) return '<$0.01/M';
  if (p < 1) return `$${p.toFixed(2)}/M`;
  return `$${p.toFixed(2)}/M`;
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}


// ─── Component ───────────────────────────────────────────────────────────────
class PromptConfig extends LitElement {

  static properties = {
    value:            { type: Object },
    enabledSections:  { type: Array, attribute: 'enabled-sections' },
    providerFilter:   { type: Array, attribute: 'provider-filter' },
    theme:            { type: String },

    // internal
    _models:          { state: true },
    _modelsLoading:   { state: true },
    _modelsError:     { state: true },
    _modelSearch:     { state: true },
    _selectedProvider:{ state: true },
    _expandedSections:{ state: true },
    _testResult:      { state: true },
    _testError:       { state: true },
    _testLoading:     { state: true },
    _toolsText:       { state: true },
    _schemaText:      { state: true },
    _stopSeqText:     { state: true },
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    super();
    this.value = { ...DEFAULT_CONFIG };
    this.enabledSections = [...ALL_SECTIONS];
    this.providerFilter = [];
    this.theme = 'auto';

    this._models = [];
    this._modelsLoading = false;
    this._modelsError = null;
    this._modelSearch = '';
    this._selectedProvider = '__all__';
    this._expandedSections = new Set(['model', 'prompts']);
    this._testResult = null;
    this._testError = null;
    this._testLoading = false;
    this._toolsText = '';
    this._schemaText = '';
    this._stopSeqText = '';

    this._debouncedChange = debounce(() => this._emitChange(), 250);
  }

  connectedCallback() {
    super.connectedCallback();
    this._fetchModels();
    // Sync text editors from initial value
    this._toolsText = this.value.tools?.length ? JSON.stringify(this.value.tools, null, 2) : '';
    this._schemaText = this.value.jsonSchema ? JSON.stringify(this.value.jsonSchema, null, 2) : '';
    this._stopSeqText = (this.value.stopSequences || []).join('\n');
  }

  updated(changed) {
    if (changed.has('value') && !this._internalUpdate) {
      // External value set — sync text editors
      const v = this.value || {};
      this._toolsText = v.tools?.length ? JSON.stringify(v.tools, null, 2) : '';
      this._schemaText = v.jsonSchema ? JSON.stringify(v.jsonSchema, null, 2) : '';
      this._stopSeqText = (v.stopSequences || []).join('\n');
    }
  }


  // ── Model fetching ─────────────────────────────────────────────────────────

  async _fetchModels() {
    this._modelsLoading = true;
    this._modelsError = null;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._models = (data.data || []).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      this._modelsError = e.message;
    } finally {
      this._modelsLoading = false;
    }
  }

  get _filteredModels() {
    let models = this._models;

    // Provider filter (from property or UI selection)
    const providerFilters = this.providerFilter?.length
      ? this.providerFilter
      : (this._selectedProvider !== '__all__' ? [this._selectedProvider] : []);

    if (providerFilters.length) {
      models = models.filter(m => {
        const prefix = m.id.split('/')[0];
        return providerFilters.includes(prefix);
      });
    }

    // Text search
    if (this._modelSearch.trim()) {
      const q = this._modelSearch.toLowerCase();
      models = models.filter(m =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
      );
    }

    return models;
  }

  get _availableProviders() {
    const seen = new Map();
    for (const m of this._models) {
      const prefix = m.id.split('/')[0];
      if (!seen.has(prefix)) seen.set(prefix, 0);
      seen.set(prefix, seen.get(prefix) + 1);
    }
    // If providerFilter is set, only show those
    const entries = [...seen.entries()]
      .filter(([p]) => !this.providerFilter?.length || this.providerFilter.includes(p))
      .sort((a, b) => b[1] - a[1]);
    return entries;
  }

  get _selectedModel() {
    return this._models.find(m => m.id === this.value?.model);
  }

  get _supportedParams() {
    return this._selectedModel?.supported_parameters || [];
  }

  get _templateVars() {
    return extractTemplateVars(this.value?.userPromptTemplate);
  }


  // ── Config mutation ────────────────────────────────────────────────────────

  _updateConfig(patch) {
    this._internalUpdate = true;
    this.value = { ...this.value, ...patch };
    this._internalUpdate = false;
    this._debouncedChange();
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('prompt-change', {
      detail: { ...this.value },
      bubbles: true, composed: true
    }));
  }


  // ── Public API for test results ────────────────────────────────────────────

  setTestResult(result) {
    this._testLoading = false;
    this._testError = null;
    this._testResult = result;
  }

  setTestError(error) {
    this._testLoading = false;
    this._testResult = null;
    this._testError = typeof error === 'string' ? error : error?.message || String(error);
  }

  setTestLoading(loading) {
    this._testLoading = loading;
    if (loading) {
      this._testResult = null;
      this._testError = null;
    }
  }


  // ── Section toggling ───────────────────────────────────────────────────────

  _toggleSection(name) {
    const s = new Set(this._expandedSections);
    s.has(name) ? s.delete(name) : s.add(name);
    this._expandedSections = s;
  }

  _isSectionEnabled(name) {
    return this.enabledSections.includes(name);
  }

  _isSectionOpen(name) {
    return this._expandedSections.has(name);
  }


  // ── Events ─────────────────────────────────────────────────────────────────

  _onTest() {
    const sampleInputs = this.value.sampleInputs || {};
    const resolvedUserPrompt = resolveTemplate(this.value.userPromptTemplate, sampleInputs);
    const messages = [];
    if (this.value.systemPrompt) {
      messages.push({ role: 'system', content: this.value.systemPrompt });
    }
    if (resolvedUserPrompt) {
      messages.push({ role: 'user', content: resolvedUserPrompt });
    }

    // Build the request payload matching OpenRouter's API format
    const payload = {
      model: this.value.model,
      messages,
    };
    if (this.value.temperature != null) payload.temperature = this.value.temperature;
    if (this.value.maxTokens) payload.max_tokens = this.value.maxTokens;
    if (this.value.topP != null && this.value.topP !== 1) payload.top_p = this.value.topP;
    if (this.value.topK) payload.top_k = this.value.topK;
    if (this.value.frequencyPenalty) payload.frequency_penalty = this.value.frequencyPenalty;
    if (this.value.presencePenalty) payload.presence_penalty = this.value.presencePenalty;
    if (this.value.repetitionPenalty && this.value.repetitionPenalty !== 1) payload.repetition_penalty = this.value.repetitionPenalty;
    if (this.value.minP) payload.min_p = this.value.minP;
    if (this.value.stopSequences?.length) payload.stop = this.value.stopSequences;
    if (this.value.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    } else if (this.value.responseFormat === 'json_schema' && this.value.jsonSchema) {
      payload.response_format = { type: 'json_schema', json_schema: this.value.jsonSchema };
    }
    if (this.value.tools?.length) {
      payload.tools = this.value.tools;
      if (this.value.toolChoice !== 'auto') payload.tool_choice = this.value.toolChoice;
    }
    if (this.value.reasoning) {
      payload.reasoning = { effort: this.value.reasoningEffort || 'medium' };
    }

    this.dispatchEvent(new CustomEvent('prompt-test', {
      detail: { config: { ...this.value }, payload, resolvedMessages: messages },
      bubbles: true, composed: true
    }));
  }

  _onSave() {
    this.dispatchEvent(new CustomEvent('prompt-save', {
      detail: { ...this.value },
      bubbles: true, composed: true
    }));
  }

  _onExport() {
    const json = JSON.stringify(this.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.value.id || this.value.name || 'prompt-config'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _onImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        this.value = { ...DEFAULT_CONFIG, ...parsed };
        this._emitChange();
      } catch (err) {
        console.error('Invalid JSON file', err);
      }
    };
    input.click();
  }


  // ── Styles ─────────────────────────────────────────────────────────────────

  static styles = css`
    :host {
      /* Neutral professional palette — utilitarian with warmth */
      --pc-bg: #fafaf9;
      --pc-bg-section: #ffffff;
      --pc-bg-input: #f5f5f4;
      --pc-bg-hover: #e7e5e4;
      --pc-border: #d6d3d1;
      --pc-border-focus: #78716c;
      --pc-text: #1c1917;
      --pc-text-secondary: #57534e;
      --pc-text-muted: #a8a29e;
      --pc-accent: #d97706;
      --pc-accent-hover: #b45309;
      --pc-accent-bg: #fffbeb;
      --pc-danger: #dc2626;
      --pc-danger-bg: #fef2f2;
      --pc-success: #16a34a;
      --pc-success-bg: #f0fdf4;
      --pc-radius: 6px;
      --pc-font: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --pc-font-mono: 'IBM Plex Mono', 'SF Mono', 'Consolas', monospace;
      --pc-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --pc-transition: 150ms ease;

      display: block;
      font-family: var(--pc-font);
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--pc-text);
      background: var(--pc-bg);
      border-radius: var(--pc-radius);
      border: 1px solid var(--pc-border);
      overflow: hidden;
    }

    @media (prefers-color-scheme: dark) {
      :host([theme="auto"]) {
        --pc-bg: #1c1917;
        --pc-bg-section: #292524;
        --pc-bg-input: #1c1917;
        --pc-bg-hover: #44403c;
        --pc-border: #44403c;
        --pc-border-focus: #a8a29e;
        --pc-text: #fafaf9;
        --pc-text-secondary: #d6d3d1;
        --pc-text-muted: #78716c;
        --pc-accent: #f59e0b;
        --pc-accent-hover: #fbbf24;
        --pc-accent-bg: #451a0310;
        --pc-danger-bg: #450a0a;
        --pc-success-bg: #052e16;
      }
    }

    :host([theme="dark"]) {
      --pc-bg: #1c1917;
      --pc-bg-section: #292524;
      --pc-bg-input: #1c1917;
      --pc-bg-hover: #44403c;
      --pc-border: #44403c;
      --pc-border-focus: #a8a29e;
      --pc-text: #fafaf9;
      --pc-text-secondary: #d6d3d1;
      --pc-text-muted: #78716c;
      --pc-accent: #f59e0b;
      --pc-accent-hover: #fbbf24;
      --pc-accent-bg: #451a0310;
      --pc-danger-bg: #450a0a;
      --pc-success-bg: #052e16;
    }

    *, *::before, *::after { box-sizing: border-box; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--pc-border);
      background: var(--pc-bg-section);
    }
    .header-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-title svg { opacity: 0.5; }
    .header-actions {
      display: flex;
      gap: 4px;
    }

    /* ── Buttons ─────────────────────────────────────────────────────────── */
    button {
      font-family: var(--pc-font);
      font-size: 12.5px;
      cursor: pointer;
      border: 1px solid var(--pc-border);
      border-radius: var(--pc-radius);
      background: var(--pc-bg-section);
      color: var(--pc-text-secondary);
      padding: 5px 10px;
      transition: all var(--pc-transition);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    button:hover {
      background: var(--pc-bg-hover);
      color: var(--pc-text);
      border-color: var(--pc-border-focus);
    }
    button:active { transform: scale(0.98); }

    button.primary {
      background: var(--pc-accent);
      color: white;
      border-color: var(--pc-accent);
      font-weight: 500;
    }
    button.primary:hover {
      background: var(--pc-accent-hover);
      border-color: var(--pc-accent-hover);
      color: white;
    }
    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button.sm {
      padding: 3px 8px;
      font-size: 11.5px;
    }

    button.icon-btn {
      padding: 5px;
      border: none;
      background: transparent;
    }
    button.icon-btn:hover { background: var(--pc-bg-hover); }

    /* ── Sections / Accordion ────────────────────────────────────────────── */
    .section {
      border-bottom: 1px solid var(--pc-border);
    }
    .section:last-child { border-bottom: none; }

    .section-header {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      cursor: pointer;
      user-select: none;
      transition: background var(--pc-transition);
      gap: 8px;
    }
    .section-header:hover { background: var(--pc-bg-hover); }

    .section-chevron {
      width: 16px;
      height: 16px;
      transition: transform var(--pc-transition);
      opacity: 0.4;
      flex-shrink: 0;
    }
    .section-chevron.open { transform: rotate(90deg); }

    .section-label {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pc-text-secondary);
      flex: 1;
    }

    .section-badge {
      font-size: 10.5px;
      padding: 1px 7px;
      border-radius: 99px;
      background: var(--pc-bg-input);
      color: var(--pc-text-muted);
      font-weight: 500;
    }

    .section-body {
      padding: 0 16px 16px;
    }

    /* ── Form elements ───────────────────────────────────────────────────── */
    .field {
      margin-bottom: 14px;
    }
    .field:last-child { margin-bottom: 0; }

    .field-row {
      display: flex;
      gap: 12px;
    }
    .field-row > .field { flex: 1; min-width: 0; }

    label {
      display: block;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--pc-text-secondary);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .label-row label { margin-bottom: 0; }
    .label-hint {
      font-size: 11px;
      color: var(--pc-text-muted);
      font-family: var(--pc-font-mono);
    }

    input[type="text"],
    input[type="number"],
    select {
      width: 100%;
      padding: 7px 10px;
      font-size: 13px;
      font-family: var(--pc-font);
      background: var(--pc-bg-input);
      border: 1px solid var(--pc-border);
      border-radius: var(--pc-radius);
      color: var(--pc-text);
      transition: border-color var(--pc-transition);
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--pc-border-focus);
    }

    textarea {
      width: 100%;
      padding: 8px 10px;
      font-size: 13px;
      font-family: var(--pc-font-mono);
      background: var(--pc-bg-input);
      border: 1px solid var(--pc-border);
      border-radius: var(--pc-radius);
      color: var(--pc-text);
      resize: vertical;
      outline: none;
      min-height: 80px;
      line-height: 1.6;
      transition: border-color var(--pc-transition);
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .slider-row input[type="range"] {
      flex: 1;
      accent-color: var(--pc-accent);
      height: 4px;
    }
    .slider-val {
      font-family: var(--pc-font-mono);
      font-size: 12px;
      color: var(--pc-text-muted);
      min-width: 44px;
      text-align: right;
    }

    /* ── Model selector ──────────────────────────────────────────────────── */
    .model-search-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .model-search-row input {
      flex: 1;
    }
    .model-search-row select {
      width: auto;
      min-width: 140px;
    }

    .model-list {
      max-height: 260px;
      overflow-y: auto;
      border: 1px solid var(--pc-border);
      border-radius: var(--pc-radius);
      background: var(--pc-bg-input);
    }
    .model-list::-webkit-scrollbar { width: 6px; }
    .model-list::-webkit-scrollbar-track { background: transparent; }
    .model-list::-webkit-scrollbar-thumb {
      background: var(--pc-border);
      border-radius: 3px;
    }

    .model-item {
      display: flex;
      align-items: center;
      padding: 7px 10px;
      cursor: pointer;
      transition: background var(--pc-transition);
      gap: 8px;
      border-bottom: 1px solid var(--pc-border);
    }
    .model-item:last-child { border-bottom: none; }
    .model-item:hover { background: var(--pc-bg-hover); }
    .model-item.selected {
      background: var(--pc-accent-bg);
      border-left: 3px solid var(--pc-accent);
      padding-left: 7px;
    }

    .model-provider-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .model-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12.5px;
    }
    .model-meta {
      display: flex;
      gap: 8px;
      font-size: 10.5px;
      color: var(--pc-text-muted);
      font-family: var(--pc-font-mono);
      flex-shrink: 0;
    }

    .model-selected-info {
      margin-top: 10px;
      padding: 10px 12px;
      background: var(--pc-bg-input);
      border-radius: var(--pc-radius);
      border: 1px solid var(--pc-border);
      font-size: 12px;
    }
    .model-selected-info .msi-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .msi-label { color: var(--pc-text-muted); }
    .msi-value { font-family: var(--pc-font-mono); font-weight: 500; }

    .supported-params {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .param-tag {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--pc-bg-hover);
      color: var(--pc-text-muted);
      font-family: var(--pc-font-mono);
    }
    .param-tag.active {
      background: var(--pc-accent-bg);
      color: var(--pc-accent);
    }

    /* ── Variables editor ─────────────────────────────────────────────────── */
    .var-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 10px;
      align-items: center;
    }
    .var-label {
      font-family: var(--pc-font-mono);
      font-size: 12px;
      color: var(--pc-accent);
      font-weight: 500;
    }
    .var-grid input {
      padding: 5px 8px;
      font-size: 12.5px;
    }

    /* ── Test area ────────────────────────────────────────────────────────── */
    .test-bar {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .test-result {
      margin-top: 12px;
      border-radius: var(--pc-radius);
      border: 1px solid var(--pc-border);
      overflow: hidden;
    }
    .test-result-header {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--pc-bg-hover);
      color: var(--pc-text-secondary);
    }
    .test-result-body {
      padding: 10px 12px;
      font-family: var(--pc-font-mono);
      font-size: 12.5px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
      line-height: 1.6;
      background: var(--pc-bg-input);
    }
    .test-result.error .test-result-header {
      background: var(--pc-danger-bg);
      color: var(--pc-danger);
    }
    .test-result.success .test-result-header {
      background: var(--pc-success-bg);
      color: var(--pc-success);
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Toggle switch ────────────────────────────────────────────────────── */
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .toggle-track {
      position: absolute;
      inset: 0;
      border-radius: 10px;
      background: var(--pc-border);
      transition: background var(--pc-transition);
      cursor: pointer;
    }
    .toggle-track::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      transition: transform var(--pc-transition);
    }
    .toggle input:checked + .toggle-track {
      background: var(--pc-accent);
    }
    .toggle input:checked + .toggle-track::after {
      transform: translateX(16px);
    }

    /* ── Param not supported hint ─────────────────────────────────────────── */
    .not-supported {
      opacity: 0.45;
      pointer-events: none;
      position: relative;
    }
    .ns-badge {
      position: absolute;
      top: -2px;
      right: 0;
      font-size: 9px;
      color: var(--pc-text-muted);
      background: var(--pc-bg-hover);
      padding: 0 5px;
      border-radius: 3px;
    }

    /* ── Empty state ──────────────────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 30px 16px;
      color: var(--pc-text-muted);
    }
    .empty-state p { margin: 4px 0; }

    /* ── Responsive ───────────────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .field-row { flex-direction: column; gap: 0; }
      .model-search-row { flex-direction: column; }
      .model-search-row select { width: 100%; }
    }
  `;


  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const v = this.value || {};
    return html`
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">

      ${this._renderHeader()}

      ${this._isSectionEnabled('identity') ? this._renderSection('identity', 'Identity', this._renderIdentity(v)) : nothing}
      ${this._isSectionEnabled('model') ? this._renderSection('model', 'Model', this._renderModelSelector(v), this.value?.model ? this._selectedModel?.name : 'none') : nothing}
      ${this._isSectionEnabled('prompts') ? this._renderSection('prompts', 'Prompts', this._renderPrompts(v)) : nothing}
      ${this._isSectionEnabled('parameters') ? this._renderSection('parameters', 'Parameters', this._renderParameters(v)) : nothing}
      ${this._isSectionEnabled('response') ? this._renderSection('response', 'Response Format', this._renderResponse(v)) : nothing}
      ${this._isSectionEnabled('tools') ? this._renderSection('tools', 'Tools', this._renderTools(v), v.tools?.length ? `${v.tools.length}` : null) : nothing}
      ${this._isSectionEnabled('reasoning') ? this._renderSection('reasoning', 'Reasoning', this._renderReasoning(v)) : nothing}
      ${this._isSectionEnabled('test') ? this._renderSection('test', 'Test Prompt', this._renderTest(v)) : nothing}
    `;
  }

  _renderHeader() {
    return html`
      <div class="header">
        <div class="header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3l1.912 5.813h6.112l-4.968 3.612 1.912 5.813L12 14.625l-4.968 3.613 1.912-5.813-4.968-3.612h6.112z"/>
          </svg>
          Prompt Configuration
        </div>
        <div class="header-actions">
          <button class="sm" @click=${this._onImport} title="Import JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Import
          </button>
          <button class="sm" @click=${this._onExport} title="Export JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
          <button class="sm primary" @click=${this._onSave}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save
          </button>
        </div>
      </div>
    `;
  }

  _renderSection(id, label, content, badge = null) {
    const open = this._isSectionOpen(id);
    return html`
      <div class="section">
        <div class="section-header" @click=${() => this._toggleSection(id)}>
          <svg class="section-chevron ${open ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="section-label">${label}</span>
          ${badge ? html`<span class="section-badge">${badge}</span>` : nothing}
        </div>
        ${open ? html`<div class="section-body">${content}</div>` : nothing}
      </div>
    `;
  }


  // ── Section: Identity ──────────────────────────────────────────────────────

  _renderIdentity(v) {
    return html`
      <div class="field-row">
        <div class="field">
          <label>Config ID</label>
          <input type="text" .value=${v.id || ''} placeholder="e.g. summarize-article"
            @input=${(e) => this._updateConfig({ id: e.target.value })} />
        </div>
        <div class="field">
          <label>Display Name</label>
          <input type="text" .value=${v.name || ''} placeholder="e.g. Article Summarizer"
            @input=${(e) => this._updateConfig({ name: e.target.value })} />
        </div>
      </div>
    `;
  }


  // ── Section: Model ─────────────────────────────────────────────────────────

  _renderModelSelector(v) {
    if (this._modelsLoading) {
      return html`<div class="empty-state"><span class="spinner"></span><p>Loading models from OpenRouter…</p></div>`;
    }
    if (this._modelsError) {
      return html`
        <div class="empty-state">
          <p>Failed to load models: ${this._modelsError}</p>
          <button class="sm" @click=${() => this._fetchModels()}>Retry</button>
        </div>
      `;
    }

    const filtered = this._filteredModels;
    const selected = this._selectedModel;

    return html`
      <div class="model-search-row">
        <input type="text" placeholder="Search models…"
          .value=${this._modelSearch}
          @input=${(e) => this._modelSearch = e.target.value} />
        ${!this.providerFilter?.length ? html`
          <select .value=${this._selectedProvider}
            @change=${(e) => this._selectedProvider = e.target.value}>
            <option value="__all__">All providers (${this._models.length})</option>
            ${this._availableProviders.map(([p, count]) => html`
              <option value=${p}>${PROVIDER_META[p]?.label || p} (${count})</option>
            `)}
          </select>
        ` : nothing}
      </div>

      <div class="model-list">
        ${filtered.length === 0
          ? html`<div class="empty-state"><p>No models match your filter.</p></div>`
          : filtered.slice(0, 100).map(m => this._renderModelItem(m, v.model))
        }
        ${filtered.length > 100 ? html`
          <div style="padding: 8px 10px; text-align:center; color: var(--pc-text-muted); font-size: 11px;">
            Showing 100 of ${filtered.length} — refine your search
          </div>
        ` : nothing}
      </div>

      ${selected ? this._renderSelectedModelInfo(selected) : nothing}
    `;
  }

  _renderModelItem(m, selectedId) {
    const provider = m.id.split('/')[0];
    const color = PROVIDER_META[provider]?.color || '#888';
    const pricing = m.pricing || {};
    const ctx = m.context_length;
    return html`
      <div class="model-item ${m.id === selectedId ? 'selected' : ''}"
           @click=${() => this._updateConfig({ model: m.id })}>
        <span class="model-provider-dot" style="background:${color}"></span>
        <span class="model-name" title=${m.id}>${m.name}</span>
        <span class="model-meta">
          <span title="Context window">${formatContextLength(ctx)}</span>
          <span title="Input price per 1M tokens">${formatPrice(pricing.prompt)}</span>
        </span>
      </div>
    `;
  }

  _renderSelectedModelInfo(m) {
    const sp = m.supported_parameters || [];
    const pricing = m.pricing || {};
    const arch = m.architecture || {};
    return html`
      <div class="model-selected-info">
        <div class="msi-row">
          <span class="msi-label">Model ID</span>
          <span class="msi-value">${m.id}</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">Context</span>
          <span class="msi-value">${m.context_length?.toLocaleString()} tokens</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">Max Output</span>
          <span class="msi-value">${m.top_provider?.max_completion_tokens?.toLocaleString() || '—'} tokens</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">Modality</span>
          <span class="msi-value">${arch.modality || '—'}</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">Pricing (in/out)</span>
          <span class="msi-value">${formatPrice(pricing.prompt)} / ${formatPrice(pricing.completion)}</span>
        </div>
        ${sp.length ? html`
          <div style="margin-top: 6px;">
            <span class="msi-label" style="font-size: 10.5px;">Supported parameters</span>
            <div class="supported-params">
              ${sp.map(p => html`<span class="param-tag">${p}</span>`)}
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }


  // ── Section: Prompts ───────────────────────────────────────────────────────

  _renderPrompts(v) {
    const vars = this._templateVars;
    return html`
      <div class="field">
        <label>System Prompt</label>
        <textarea rows="4" .value=${v.systemPrompt || ''} placeholder="You are a helpful assistant that…"
          @input=${(e) => this._updateConfig({ systemPrompt: e.target.value })}></textarea>
      </div>
      <div class="field">
        <div class="label-row">
          <label>User Prompt Template</label>
          <span class="label-hint">Use {{variable}} for placeholders</span>
        </div>
        <textarea rows="3" .value=${v.userPromptTemplate || ''} placeholder="Summarize this article:\n\n{{article_text}}"
          @input=${(e) => this._updateConfig({ userPromptTemplate: e.target.value })}></textarea>
      </div>
      ${vars.length ? html`
        <div class="field">
          <label>Sample Inputs (for testing)</label>
          <div class="var-grid">
            ${vars.map(varName => html`
              <span class="var-label">{{${varName}}}</span>
              <input type="text" .value=${v.sampleInputs?.[varName] || ''}
                placeholder="Sample value…"
                @input=${(e) => this._updateConfig({
                  sampleInputs: { ...v.sampleInputs, [varName]: e.target.value }
                })} />
            `)}
          </div>
        </div>
      ` : nothing}
    `;
  }


  // ── Section: Parameters ────────────────────────────────────────────────────

  _renderParameters(v) {
    const sp = this._supportedParams;
    const has = (p) => !sp.length || sp.includes(p); // if no model selected, show all

    return html`
      <div class="${has('temperature') ? '' : 'not-supported'}">
        <div class="field">
          <div class="label-row">
            <label>Temperature</label>
            <span class="label-hint">${v.temperature}</span>
          </div>
          <div class="slider-row">
            <input type="range" min="0" max="2" step="0.05" .value=${String(v.temperature)}
              @input=${(e) => this._updateConfig({ temperature: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>

      <div class="field-row">
        <div class="field ${has('max_tokens') ? '' : 'not-supported'}">
          <label>Max Tokens</label>
          <input type="number" min="1" max="1000000" .value=${String(v.maxTokens || '')}
            @input=${(e) => this._updateConfig({ maxTokens: parseInt(e.target.value) || 0 })} />
        </div>
        <div class="field ${has('top_p') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Top P</label>
            <span class="label-hint">${v.topP}</span>
          </div>
          <div class="slider-row">
            <input type="range" min="0" max="1" step="0.05" .value=${String(v.topP)}
              @input=${(e) => this._updateConfig({ topP: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>

      <div class="field-row">
        <div class="field ${has('top_k') ? '' : 'not-supported'}">
          <label>Top K</label>
          <input type="number" min="0" max="500" .value=${String(v.topK || '')}
            @input=${(e) => this._updateConfig({ topK: parseInt(e.target.value) || 0 })} />
        </div>
        <div class="field ${has('min_p') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Min P</label>
            <span class="label-hint">${v.minP}</span>
          </div>
          <div class="slider-row">
            <input type="range" min="0" max="1" step="0.05" .value=${String(v.minP)}
              @input=${(e) => this._updateConfig({ minP: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>

      <div class="field-row">
        <div class="field ${has('frequency_penalty') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Frequency Penalty</label>
            <span class="label-hint">${v.frequencyPenalty}</span>
          </div>
          <div class="slider-row">
            <input type="range" min="-2" max="2" step="0.1" .value=${String(v.frequencyPenalty)}
              @input=${(e) => this._updateConfig({ frequencyPenalty: parseFloat(e.target.value) })} />
          </div>
        </div>
        <div class="field ${has('presence_penalty') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Presence Penalty</label>
            <span class="label-hint">${v.presencePenalty}</span>
          </div>
          <div class="slider-row">
            <input type="range" min="-2" max="2" step="0.1" .value=${String(v.presencePenalty)}
              @input=${(e) => this._updateConfig({ presencePenalty: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>

      <div class="field ${has('repetition_penalty') ? '' : 'not-supported'}">
        <div class="label-row">
          <label>Repetition Penalty</label>
          <span class="label-hint">${v.repetitionPenalty}</span>
        </div>
        <div class="slider-row">
          <input type="range" min="0" max="2" step="0.05" .value=${String(v.repetitionPenalty)}
            @input=${(e) => this._updateConfig({ repetitionPenalty: parseFloat(e.target.value) })} />
        </div>
      </div>

      <div class="field ${has('stop') ? '' : 'not-supported'}">
        <div class="label-row">
          <label>Stop Sequences</label>
          <span class="label-hint">one per line</span>
        </div>
        <textarea rows="2" .value=${this._stopSeqText}
          placeholder="Enter stop sequences, one per line"
          @input=${(e) => {
            this._stopSeqText = e.target.value;
            const seqs = e.target.value.split('\n').filter(s => s.length > 0);
            this._updateConfig({ stopSequences: seqs });
          }}></textarea>
      </div>
    `;
  }


  // ── Section: Response Format ───────────────────────────────────────────────

  _renderResponse(v) {
    const sp = this._supportedParams;
    const hasStructured = !sp.length || sp.includes('structured_outputs') || sp.includes('response_format');

    return html`
      <div class="field ${hasStructured ? '' : 'not-supported'}">
        <label>Response Format</label>
        <select .value=${v.responseFormat || 'text'}
          @change=${(e) => this._updateConfig({ responseFormat: e.target.value })}>
          <option value="text">Text (default)</option>
          <option value="json_object">JSON Object</option>
          <option value="json_schema">JSON Schema (structured output)</option>
        </select>
      </div>
      ${v.responseFormat === 'json_schema' ? html`
        <div class="field">
          <div class="label-row">
            <label>JSON Schema</label>
            <span class="label-hint">OpenAI-compatible schema object</span>
          </div>
          <textarea rows="8" .value=${this._schemaText}
            placeholder='{"name": "my_schema", "strict": true, "schema": { "type": "object", "properties": { ... } } }'
            @input=${(e) => {
              this._schemaText = e.target.value;
              try {
                const parsed = JSON.parse(e.target.value);
                this._updateConfig({ jsonSchema: parsed });
              } catch { /* let them keep typing */ }
            }}></textarea>
        </div>
      ` : nothing}
    `;
  }


  // ── Section: Tools ─────────────────────────────────────────────────────────

  _renderTools(v) {
    const sp = this._supportedParams;
    const hasTools = !sp.length || sp.includes('tools');

    return html`
      <div class="${hasTools ? '' : 'not-supported'}">
        <div class="field">
          <div class="label-row">
            <label>Tool Definitions</label>
            <span class="label-hint">OpenAI-compatible tools array</span>
          </div>
          <textarea rows="10" .value=${this._toolsText}
            placeholder='[{ "type": "function", "function": { "name": "get_weather", "description": "...", "parameters": { ... } } }]'
            @input=${(e) => {
              this._toolsText = e.target.value;
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  this._updateConfig({ tools: parsed });
                }
              } catch { /* let them keep typing */ }
            }}></textarea>
        </div>
        <div class="field">
          <label>Tool Choice</label>
          <select .value=${v.toolChoice || 'auto'}
            @change=${(e) => this._updateConfig({ toolChoice: e.target.value })}>
            <option value="auto">Auto</option>
            <option value="none">None</option>
            <option value="required">Required</option>
          </select>
        </div>
      </div>
    `;
  }


  // ── Section: Reasoning ─────────────────────────────────────────────────────

  _renderReasoning(v) {
    const sp = this._supportedParams;
    const hasReasoning = !sp.length || sp.includes('reasoning');

    return html`
      <div class="${hasReasoning ? '' : 'not-supported'}">
        <div class="field">
          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" .checked=${!!v.reasoning}
                @change=${(e) => this._updateConfig({ reasoning: e.target.checked })} />
              <span class="toggle-track"></span>
            </label>
            <span>Enable extended thinking / reasoning</span>
          </div>
        </div>
        ${v.reasoning ? html`
          <div class="field">
            <label>Reasoning Effort</label>
            <select .value=${v.reasoningEffort || 'medium'}
              @change=${(e) => this._updateConfig({ reasoningEffort: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        ` : nothing}
      </div>
    `;
  }


  // ── Section: Test ──────────────────────────────────────────────────────────

  _renderTest(v) {
    const vars = this._templateVars;
    const hasUnfilled = vars.some(vn => !v.sampleInputs?.[vn]);
    const noModel = !v.model;
    const noPrompt = !v.systemPrompt && !v.userPromptTemplate;
    const disabled = noModel || noPrompt || this._testLoading;

    return html`
      <div class="test-bar">
        <button class="primary" ?disabled=${disabled} @click=${this._onTest}>
          ${this._testLoading ? html`<span class="spinner"></span> Testing…` : html`
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Test Prompt
          `}
        </button>
        ${noModel ? html`<span style="font-size:11px; color:var(--pc-text-muted)">Select a model first</span>` : nothing}
        ${!noModel && noPrompt ? html`<span style="font-size:11px; color:var(--pc-text-muted)">Add a prompt first</span>` : nothing}
        ${!noModel && !noPrompt && hasUnfilled ? html`<span style="font-size:11px; color:var(--pc-accent)">⚠ Some template variables are empty</span>` : nothing}
      </div>

      ${this._testResult ? html`
        <div class="test-result success">
          <div class="test-result-header">Response</div>
          <div class="test-result-body">${typeof this._testResult === 'string'
            ? this._testResult
            : JSON.stringify(this._testResult, null, 2)}</div>
        </div>
      ` : nothing}

      ${this._testError ? html`
        <div class="test-result error">
          <div class="test-result-header">Error</div>
          <div class="test-result-body">${this._testError}</div>
        </div>
      ` : nothing}
    `;
  }
}

customElements.define('prompt-config', PromptConfig);

export { PromptConfig, DEFAULT_CONFIG, ALL_SECTIONS };
