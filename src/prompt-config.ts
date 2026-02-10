import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { promptConfigStyles } from './styles.js';
import { DEFAULT_CONFIG, ALL_SECTIONS, PROVIDER_META } from './constants.js';
import {
  extractTemplateVars,
  resolveTemplate,
  formatContextLength,
  formatPrice,
  debounce,
} from './utils.js';
import { fetchOpenRouterModels } from './models.js';
import type {
  PromptConfig,
  SectionId,
  OpenRouterModel,
  Message,
  OpenRouterPayload,
  ThemeMode,
} from './types.js';

/**
 * <prompt-config> - A Lit web component for LLM prompt management.
 *
 * @element prompt-config
 * @fires prompt-change - When any config value changes. detail = full config object
 * @fires prompt-test - When user clicks Test. detail = { config, payload, resolvedMessages }
 * @fires prompt-save - When user clicks Save. detail = full config object
 */
@customElement('prompt-config')
export class PromptConfigElement extends LitElement {
  static override styles = promptConfigStyles;

  /** The prompt configuration object */
  @property({ type: Object })
  value: PromptConfig = { ...DEFAULT_CONFIG };

  /** Which UI sections to show */
  @property({ type: Array, attribute: 'enabled-sections' })
  enabledSections: SectionId[] = [...ALL_SECTIONS];

  /** Filter models to specific providers */
  @property({ type: Array, attribute: 'provider-filter' })
  providerFilter: string[] = [];

  /** Color theme: 'light', 'dark', or 'auto' */
  @property({ type: String, reflect: true })
  theme: ThemeMode = 'auto';

  // Internal state
  @state() private _models: OpenRouterModel[] = [];
  @state() private _modelsLoading = false;
  @state() private _modelsError: string | null = null;
  @state() private _modelSearch = '';
  @state() private _selectedProvider = '__all__';
  @state() private _expandedSections: Set<SectionId> = new Set(['model', 'prompts']);
  @state() private _testResult: string | object | null = null;
  @state() private _testError: string | null = null;
  @state() private _testLoading = false;
  @state() private _toolsText = '';
  @state() private _schemaText = '';
  @state() private _stopSeqText = '';

  private _internalUpdate = false;
  private _debouncedChange: () => void;

  constructor() {
    super();
    this._debouncedChange = debounce(() => this._emitChange(), 250);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._fetchModels();
    this._syncTextEditors();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('value') && !this._internalUpdate) {
      this._syncTextEditors();
    }
  }

  private _syncTextEditors(): void {
    const v = this.value || {};
    this._toolsText = v.tools?.length ? JSON.stringify(v.tools, null, 2) : '';
    this._schemaText = v.jsonSchema ? JSON.stringify(v.jsonSchema, null, 2) : '';
    this._stopSeqText = (v.stopSequences || []).join('\n');
  }

  // ── Model fetching ──────────────────────────────────────────────────────

  private async _fetchModels(): Promise<void> {
    this._modelsLoading = true;
    this._modelsError = null;
    const result = await fetchOpenRouterModels();
    this._models = result.models;
    this._modelsError = result.error;
    this._modelsLoading = false;
  }

  private get _filteredModels(): OpenRouterModel[] {
    let models = this._models;

    const providerFilters = this.providerFilter?.length
      ? this.providerFilter
      : this._selectedProvider !== '__all__'
        ? [this._selectedProvider]
        : [];

    if (providerFilters.length) {
      models = models.filter((m) => {
        const prefix = m.id.split('/')[0];
        return providerFilters.includes(prefix);
      });
    }

    if (this._modelSearch.trim()) {
      const q = this._modelSearch.toLowerCase();
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
    }

    return models;
  }

  private get _availableProviders(): [string, number][] {
    const seen = new Map<string, number>();
    for (const m of this._models) {
      const prefix = m.id.split('/')[0];
      seen.set(prefix, (seen.get(prefix) || 0) + 1);
    }
    const entries = [...seen.entries()]
      .filter(
        ([p]) => !this.providerFilter?.length || this.providerFilter.includes(p)
      )
      .sort((a, b) => b[1] - a[1]);
    return entries;
  }

  private get _selectedModel(): OpenRouterModel | undefined {
    return this._models.find((m) => m.id === this.value?.model);
  }

  private get _supportedParams(): string[] {
    return this._selectedModel?.supported_parameters || [];
  }

  private get _templateVars(): string[] {
    return extractTemplateVars(this.value?.userPromptTemplate);
  }

  // ── Config mutation ─────────────────────────────────────────────────────

  private _updateConfig(patch: Partial<PromptConfig>): void {
    this._internalUpdate = true;
    this.value = { ...this.value, ...patch };
    this._internalUpdate = false;
    this._debouncedChange();
  }

  private _emitChange(): void {
    this.dispatchEvent(
      new CustomEvent('prompt-change', {
        detail: { ...this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Public API for test results ─────────────────────────────────────────

  /** Display successful test response */
  setTestResult(result: string | object): void {
    this._testLoading = false;
    this._testError = null;
    this._testResult = result;
  }

  /** Display test error */
  setTestError(error: string | Error): void {
    this._testLoading = false;
    this._testResult = null;
    this._testError =
      typeof error === 'string' ? error : error?.message || String(error);
  }

  /** Set loading state for test button */
  setTestLoading(loading: boolean): void {
    this._testLoading = loading;
    if (loading) {
      this._testResult = null;
      this._testError = null;
    }
  }

  // ── Section toggling ────────────────────────────────────────────────────

  private _toggleSection(name: SectionId): void {
    const s = new Set(this._expandedSections);
    if (s.has(name)) {
      s.delete(name);
    } else {
      s.add(name);
    }
    this._expandedSections = s;
  }

  private _isSectionEnabled(name: SectionId): boolean {
    return this.enabledSections.includes(name);
  }

  private _isSectionOpen(name: SectionId): boolean {
    return this._expandedSections.has(name);
  }

  // ── Events ──────────────────────────────────────────────────────────────

  private _onTest(): void {
    const sampleInputs = this.value.sampleInputs || {};
    const resolvedUserPrompt = resolveTemplate(
      this.value.userPromptTemplate,
      sampleInputs
    );
    const messages: Message[] = [];
    if (this.value.systemPrompt) {
      messages.push({ role: 'system', content: this.value.systemPrompt });
    }
    if (resolvedUserPrompt) {
      messages.push({ role: 'user', content: resolvedUserPrompt });
    }

    const payload: OpenRouterPayload = {
      model: this.value.model,
      messages,
    };
    if (this.value.temperature != null)
      payload.temperature = this.value.temperature;
    if (this.value.maxTokens) payload.max_tokens = this.value.maxTokens;
    if (this.value.topP != null && this.value.topP !== 1)
      payload.top_p = this.value.topP;
    if (this.value.topK) payload.top_k = this.value.topK;
    if (this.value.frequencyPenalty)
      payload.frequency_penalty = this.value.frequencyPenalty;
    if (this.value.presencePenalty)
      payload.presence_penalty = this.value.presencePenalty;
    if (this.value.repetitionPenalty && this.value.repetitionPenalty !== 1)
      payload.repetition_penalty = this.value.repetitionPenalty;
    if (this.value.minP) payload.min_p = this.value.minP;
    if (this.value.stopSequences?.length)
      payload.stop = this.value.stopSequences;
    if (this.value.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    } else if (
      this.value.responseFormat === 'json_schema' &&
      this.value.jsonSchema
    ) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: this.value.jsonSchema,
      };
    }
    if (this.value.tools?.length) {
      payload.tools = this.value.tools;
      if (this.value.toolChoice !== 'auto')
        payload.tool_choice = this.value.toolChoice;
    }
    if (this.value.reasoning) {
      payload.reasoning = { effort: this.value.reasoningEffort || 'medium' };
    }

    this.dispatchEvent(
      new CustomEvent('prompt-test', {
        detail: {
          config: { ...this.value },
          payload,
          resolvedMessages: messages,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onSave(): void {
    this.dispatchEvent(
      new CustomEvent('prompt-save', {
        detail: { ...this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onExport(): void {
    const json = JSON.stringify(this.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.value.id || this.value.name || 'prompt-config'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _onImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
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

  // ── Render ──────────────────────────────────────────────────────────────

  override render() {
    const v = this.value || {};
    return html`
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      ${this._renderHeader()}
      ${this._isSectionEnabled('identity')
        ? this._renderSection('identity', 'Identity', this._renderIdentity(v))
        : nothing}
      ${this._isSectionEnabled('model')
        ? this._renderSection(
            'model',
            'Model',
            this._renderModelSelector(v),
            this.value?.model ? this._selectedModel?.name : 'none'
          )
        : nothing}
      ${this._isSectionEnabled('prompts')
        ? this._renderSection('prompts', 'Prompts', this._renderPrompts(v))
        : nothing}
      ${this._isSectionEnabled('parameters')
        ? this._renderSection(
            'parameters',
            'Parameters',
            this._renderParameters(v)
          )
        : nothing}
      ${this._isSectionEnabled('response')
        ? this._renderSection(
            'response',
            'Response Format',
            this._renderResponse(v)
          )
        : nothing}
      ${this._isSectionEnabled('tools')
        ? this._renderSection(
            'tools',
            'Tools',
            this._renderTools(v),
            v.tools?.length ? `${v.tools.length}` : null
          )
        : nothing}
      ${this._isSectionEnabled('reasoning')
        ? this._renderSection('reasoning', 'Reasoning', this._renderReasoning(v))
        : nothing}
      ${this._isSectionEnabled('test')
        ? this._renderSection('test', 'Test Prompt', this._renderTest(v))
        : nothing}
    `;
  }

  private _renderHeader() {
    return html`
      <div class="header">
        <div class="header-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 3l1.912 5.813h6.112l-4.968 3.612 1.912 5.813L12 14.625l-4.968 3.613 1.912-5.813-4.968-3.612h6.112z"
            />
          </svg>
          Prompt Configuration
        </div>
        <div class="header-actions">
          <button class="sm" @click=${this._onImport} title="Import JSON">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import
          </button>
          <button class="sm" @click=${this._onExport} title="Export JSON">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Export
          </button>
          <button class="sm primary" @click=${this._onSave}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
              />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save
          </button>
        </div>
      </div>
    `;
  }

  private _renderSection(
    id: SectionId,
    label: string,
    content: unknown,
    badge: string | null | undefined = null
  ) {
    const open = this._isSectionOpen(id);
    return html`
      <div class="section">
        <div class="section-header" @click=${() => this._toggleSection(id)}>
          <svg
            class="section-chevron ${open ? 'open' : ''}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="section-label">${label}</span>
          ${badge ? html`<span class="section-badge">${badge}</span>` : nothing}
        </div>
        ${open ? html`<div class="section-body">${content}</div>` : nothing}
      </div>
    `;
  }

  // ── Section: Identity ───────────────────────────────────────────────────

  private _renderIdentity(v: PromptConfig) {
    return html`
      <div class="field-row">
        <div class="field">
          <label>Config ID</label>
          <input
            type="text"
            .value=${v.id || ''}
            placeholder="e.g. summarize-article"
            @input=${(e: Event) =>
              this._updateConfig({ id: (e.target as HTMLInputElement).value })}
          />
        </div>
        <div class="field">
          <label>Display Name</label>
          <input
            type="text"
            .value=${v.name || ''}
            placeholder="e.g. Article Summarizer"
            @input=${(e: Event) =>
              this._updateConfig({ name: (e.target as HTMLInputElement).value })}
          />
        </div>
      </div>
    `;
  }

  // ── Section: Model ──────────────────────────────────────────────────────

  private _renderModelSelector(v: PromptConfig) {
    if (this._modelsLoading) {
      return html`<div class="empty-state">
        <span class="spinner"></span>
        <p>Loading models from OpenRouter...</p>
      </div>`;
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
        <input
          type="text"
          placeholder="Search models..."
          .value=${this._modelSearch}
          @input=${(e: Event) =>
            (this._modelSearch = (e.target as HTMLInputElement).value)}
        />
        ${!this.providerFilter?.length
          ? html`
              <select
                .value=${this._selectedProvider}
                @change=${(e: Event) =>
                  (this._selectedProvider = (e.target as HTMLSelectElement)
                    .value)}
              >
                <option value="__all__">
                  All providers (${this._models.length})
                </option>
                ${this._availableProviders.map(
                  ([p, count]) => html`
                    <option value=${p}>
                      ${PROVIDER_META[p]?.label || p} (${count})
                    </option>
                  `
                )}
              </select>
            `
          : nothing}
      </div>

      <div class="model-list">
        ${filtered.length === 0
          ? html`<div class="empty-state">
              <p>No models match your filter.</p>
            </div>`
          : filtered
              .slice(0, 100)
              .map((m) => this._renderModelItem(m, v.model))}
        ${filtered.length > 100
          ? html`
              <div
                style="padding: 8px 10px; text-align:center; color: var(--pc-text-muted); font-size: 11px;"
              >
                Showing 100 of ${filtered.length} - refine your search
              </div>
            `
          : nothing}
      </div>

      ${selected ? this._renderSelectedModelInfo(selected) : nothing}
    `;
  }

  private _renderModelItem(m: OpenRouterModel, selectedId: string) {
    const provider = m.id.split('/')[0];
    const color = PROVIDER_META[provider]?.color || '#888';
    const pricing = m.pricing || {};
    const ctx = m.context_length;
    return html`
      <div
        class="model-item ${m.id === selectedId ? 'selected' : ''}"
        @click=${() => this._updateConfig({ model: m.id })}
      >
        <span class="model-provider-dot" style="background:${color}"></span>
        <span class="model-name" title=${m.id}>${m.name}</span>
        <span class="model-meta">
          <span title="Context window">${formatContextLength(ctx)}</span>
          <span title="Input price per 1M tokens"
            >${formatPrice(pricing.prompt)}</span
          >
        </span>
      </div>
    `;
  }

  private _renderSelectedModelInfo(m: OpenRouterModel) {
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
          <span class="msi-value"
            >${m.context_length?.toLocaleString()} tokens</span
          >
        </div>
        <div class="msi-row">
          <span class="msi-label">Max Output</span>
          <span class="msi-value"
            >${m.top_provider?.max_completion_tokens?.toLocaleString() || '-'}
            tokens</span
          >
        </div>
        <div class="msi-row">
          <span class="msi-label">Modality</span>
          <span class="msi-value">${arch.modality || '-'}</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">Pricing (in/out)</span>
          <span class="msi-value"
            >${formatPrice(pricing.prompt)} /
            ${formatPrice(pricing.completion)}</span
          >
        </div>
        ${sp.length
          ? html`
              <div style="margin-top: 6px;">
                <span class="msi-label" style="font-size: 10.5px;"
                  >Supported parameters</span
                >
                <div class="supported-params">
                  ${sp.map((p) => html`<span class="param-tag">${p}</span>`)}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Section: Prompts ────────────────────────────────────────────────────

  private _renderPrompts(v: PromptConfig) {
    const vars = this._templateVars;
    return html`
      <div class="field">
        <label>System Prompt</label>
        <textarea
          rows="4"
          .value=${v.systemPrompt || ''}
          placeholder="You are a helpful assistant that..."
          @input=${(e: Event) =>
            this._updateConfig({
              systemPrompt: (e.target as HTMLTextAreaElement).value,
            })}
        ></textarea>
      </div>
      <div class="field">
        <div class="label-row">
          <label>User Prompt Template</label>
          <span class="label-hint">Use {{variable}} for placeholders</span>
        </div>
        <textarea
          rows="3"
          .value=${v.userPromptTemplate || ''}
          placeholder="Summarize this article:\n\n{{article_text}}"
          @input=${(e: Event) =>
            this._updateConfig({
              userPromptTemplate: (e.target as HTMLTextAreaElement).value,
            })}
        ></textarea>
      </div>
      ${vars.length
        ? html`
            <div class="field">
              <label>Sample Inputs (for testing)</label>
              <div class="var-grid">
                ${vars.map(
                  (varName) => html`
                    <span class="var-label">{{${varName}}}</span>
                    <input
                      type="text"
                      .value=${v.sampleInputs?.[varName] || ''}
                      placeholder="Sample value..."
                      @input=${(e: Event) =>
                        this._updateConfig({
                          sampleInputs: {
                            ...v.sampleInputs,
                            [varName]: (e.target as HTMLInputElement).value,
                          },
                        })}
                    />
                  `
                )}
              </div>
            </div>
          `
        : nothing}
    `;
  }

  // ── Section: Parameters ─────────────────────────────────────────────────

  private _renderParameters(v: PromptConfig) {
    const sp = this._supportedParams;
    const has = (p: string) => !sp.length || sp.includes(p);

    return html`
      <div class="${has('temperature') ? '' : 'not-supported'}">
        <div class="field">
          <div class="label-row">
            <label>Temperature</label>
            <span class="label-hint">${v.temperature}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              .value=${String(v.temperature)}
              @input=${(e: Event) =>
                this._updateConfig({
                  temperature: parseFloat(
                    (e.target as HTMLInputElement).value
                  ),
                })}
            />
          </div>
        </div>
      </div>

      <div class="field-row">
        <div class="field ${has('max_tokens') ? '' : 'not-supported'}">
          <label>Max Tokens</label>
          <input
            type="number"
            min="1"
            max="1000000"
            .value=${String(v.maxTokens || '')}
            @input=${(e: Event) =>
              this._updateConfig({
                maxTokens:
                  parseInt((e.target as HTMLInputElement).value) || 0,
              })}
          />
        </div>
        <div class="field ${has('top_p') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Top P</label>
            <span class="label-hint">${v.topP}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              .value=${String(v.topP)}
              @input=${(e: Event) =>
                this._updateConfig({
                  topP: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
          </div>
        </div>
      </div>

      <div class="field-row">
        <div class="field ${has('top_k') ? '' : 'not-supported'}">
          <label>Top K</label>
          <input
            type="number"
            min="0"
            max="500"
            .value=${String(v.topK || '')}
            @input=${(e: Event) =>
              this._updateConfig({
                topK: parseInt((e.target as HTMLInputElement).value) || 0,
              })}
          />
        </div>
        <div class="field ${has('min_p') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Min P</label>
            <span class="label-hint">${v.minP}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              .value=${String(v.minP)}
              @input=${(e: Event) =>
                this._updateConfig({
                  minP: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
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
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              .value=${String(v.frequencyPenalty)}
              @input=${(e: Event) =>
                this._updateConfig({
                  frequencyPenalty: parseFloat(
                    (e.target as HTMLInputElement).value
                  ),
                })}
            />
          </div>
        </div>
        <div class="field ${has('presence_penalty') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>Presence Penalty</label>
            <span class="label-hint">${v.presencePenalty}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              .value=${String(v.presencePenalty)}
              @input=${(e: Event) =>
                this._updateConfig({
                  presencePenalty: parseFloat(
                    (e.target as HTMLInputElement).value
                  ),
                })}
            />
          </div>
        </div>
      </div>

      <div class="field ${has('repetition_penalty') ? '' : 'not-supported'}">
        <div class="label-row">
          <label>Repetition Penalty</label>
          <span class="label-hint">${v.repetitionPenalty}</span>
        </div>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            .value=${String(v.repetitionPenalty)}
            @input=${(e: Event) =>
              this._updateConfig({
                repetitionPenalty: parseFloat(
                  (e.target as HTMLInputElement).value
                ),
              })}
          />
        </div>
      </div>

      <div class="field ${has('stop') ? '' : 'not-supported'}">
        <div class="label-row">
          <label>Stop Sequences</label>
          <span class="label-hint">one per line</span>
        </div>
        <textarea
          rows="2"
          .value=${this._stopSeqText}
          placeholder="Enter stop sequences, one per line"
          @input=${(e: Event) => {
            this._stopSeqText = (e.target as HTMLTextAreaElement).value;
            const seqs = this._stopSeqText
              .split('\n')
              .filter((s) => s.length > 0);
            this._updateConfig({ stopSequences: seqs });
          }}
        ></textarea>
      </div>
    `;
  }

  // ── Section: Response Format ────────────────────────────────────────────

  private _renderResponse(v: PromptConfig) {
    const sp = this._supportedParams;
    const hasStructured =
      !sp.length ||
      sp.includes('structured_outputs') ||
      sp.includes('response_format');

    return html`
      <div class="field ${hasStructured ? '' : 'not-supported'}">
        <label>Response Format</label>
        <select
          .value=${v.responseFormat || 'text'}
          @change=${(e: Event) =>
            this._updateConfig({
              responseFormat: (e.target as HTMLSelectElement)
                .value as PromptConfig['responseFormat'],
            })}
        >
          <option value="text">Text (default)</option>
          <option value="json_object">JSON Object</option>
          <option value="json_schema">JSON Schema (structured output)</option>
        </select>
      </div>
      ${v.responseFormat === 'json_schema'
        ? html`
            <div class="field">
              <div class="label-row">
                <label>JSON Schema</label>
                <span class="label-hint">OpenAI-compatible schema object</span>
              </div>
              <textarea
                rows="8"
                .value=${this._schemaText}
                placeholder='{"name": "my_schema", "strict": true, "schema": { "type": "object", "properties": { ... } } }'
                @input=${(e: Event) => {
                  this._schemaText = (e.target as HTMLTextAreaElement).value;
                  try {
                    const parsed = JSON.parse(this._schemaText);
                    this._updateConfig({ jsonSchema: parsed });
                  } catch {
                    /* let them keep typing */
                  }
                }}
              ></textarea>
            </div>
          `
        : nothing}
    `;
  }

  // ── Section: Tools ──────────────────────────────────────────────────────

  private _renderTools(v: PromptConfig) {
    const sp = this._supportedParams;
    const hasTools = !sp.length || sp.includes('tools');

    return html`
      <div class="${hasTools ? '' : 'not-supported'}">
        <div class="field">
          <div class="label-row">
            <label>Tool Definitions</label>
            <span class="label-hint">OpenAI-compatible tools array</span>
          </div>
          <textarea
            rows="10"
            .value=${this._toolsText}
            placeholder='[{ "type": "function", "function": { "name": "get_weather", "description": "...", "parameters": { ... } } }]'
            @input=${(e: Event) => {
              this._toolsText = (e.target as HTMLTextAreaElement).value;
              try {
                const parsed = JSON.parse(this._toolsText);
                if (Array.isArray(parsed)) {
                  this._updateConfig({ tools: parsed });
                }
              } catch {
                /* let them keep typing */
              }
            }}
          ></textarea>
        </div>
        <div class="field">
          <label>Tool Choice</label>
          <select
            .value=${v.toolChoice || 'auto'}
            @change=${(e: Event) =>
              this._updateConfig({
                toolChoice: (e.target as HTMLSelectElement)
                  .value as PromptConfig['toolChoice'],
              })}
          >
            <option value="auto">Auto</option>
            <option value="none">None</option>
            <option value="required">Required</option>
          </select>
        </div>
      </div>
    `;
  }

  // ── Section: Reasoning ──────────────────────────────────────────────────

  private _renderReasoning(v: PromptConfig) {
    const sp = this._supportedParams;
    const hasReasoning = !sp.length || sp.includes('reasoning');

    return html`
      <div class="${hasReasoning ? '' : 'not-supported'}">
        <div class="field">
          <div class="toggle-row">
            <label class="toggle">
              <input
                type="checkbox"
                .checked=${!!v.reasoning}
                @change=${(e: Event) =>
                  this._updateConfig({
                    reasoning: (e.target as HTMLInputElement).checked,
                  })}
              />
              <span class="toggle-track"></span>
            </label>
            <span>Enable extended thinking / reasoning</span>
          </div>
        </div>
        ${v.reasoning
          ? html`
              <div class="field">
                <label>Reasoning Effort</label>
                <select
                  .value=${v.reasoningEffort || 'medium'}
                  @change=${(e: Event) =>
                    this._updateConfig({
                      reasoningEffort: (e.target as HTMLSelectElement)
                        .value as PromptConfig['reasoningEffort'],
                    })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Section: Test ───────────────────────────────────────────────────────

  private _renderTest(v: PromptConfig) {
    const vars = this._templateVars;
    const hasUnfilled = vars.some((vn) => !v.sampleInputs?.[vn]);
    const noModel = !v.model;
    const noPrompt = !v.systemPrompt && !v.userPromptTemplate;
    const disabled = noModel || noPrompt || this._testLoading;

    return html`
      <div class="test-bar">
        <button class="primary" ?disabled=${disabled} @click=${this._onTest}>
          ${this._testLoading
            ? html`<span class="spinner"></span> Testing...`
            : html`
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Test Prompt
              `}
        </button>
        ${noModel
          ? html`<span
              style="font-size:11px; color:var(--pc-text-muted)"
              >Select a model first</span
            >`
          : nothing}
        ${!noModel && noPrompt
          ? html`<span
              style="font-size:11px; color:var(--pc-text-muted)"
              >Add a prompt first</span
            >`
          : nothing}
        ${!noModel && !noPrompt && hasUnfilled
          ? html`<span style="font-size:11px; color:var(--pc-accent)"
              >Warning: Some template variables are empty</span
            >`
          : nothing}
      </div>

      ${this._testResult
        ? html`
            <div class="test-result success">
              <div class="test-result-header">Response</div>
              <div class="test-result-body">
                ${typeof this._testResult === 'string'
                  ? this._testResult
                  : JSON.stringify(this._testResult, null, 2)}
              </div>
            </div>
          `
        : nothing}
      ${this._testError
        ? html`
            <div class="test-result error">
              <div class="test-result-header">Error</div>
              <div class="test-result-body">${this._testError}</div>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-config': PromptConfigElement;
  }
}
