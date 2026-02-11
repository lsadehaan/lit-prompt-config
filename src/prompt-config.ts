import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { promptConfigStyles } from './styles.js';
import { DEFAULT_CONFIG, ALL_SECTIONS, PROVIDER_META, DEFAULT_LABELS } from './constants.js';
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
  Labels,
} from './types.js';

export type PromptConfigVariant = 'card' | 'full';

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

  /** Display variant: 'card' (compact) or 'full' (all settings) */
  @property({ type: String, reflect: true })
  variant: PromptConfigVariant = 'full';

  /** Which UI sections to show (only applies to full variant) */
  @property({ type: Array, attribute: 'enabled-sections' })
  enabledSections: SectionId[] = [...ALL_SECTIONS];

  /** Filter available providers to this list */
  @property({ type: Array, attribute: 'provider-filter' })
  providerFilter: string[] = [];

  /** Color theme: 'light', 'dark', or 'auto' */
  @property({ type: String, reflect: true })
  theme: ThemeMode = 'auto';

  /** Override UI labels for i18n */
  @property({ type: Object })
  labels: Partial<Labels> = {};

  /** Merged labels (user overrides + defaults) */
  private get _l(): Labels {
    return { ...DEFAULT_LABELS, ...this.labels };
  }

  // Internal state
  @state() private _models: OpenRouterModel[] = [];
  @state() private _modelsLoading = false;
  @state() private _modelsError: string | null = null;
  @state() private _modelSearch = '';
  @state() private _expanded = false; // For card variant expansion
  @state() private _advancedOpen = false; // For collapsible advanced settings
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

    // Filter by selected provider in config
    const provider = this.value?.provider;
    if (provider) {
      models = models.filter((m) => m.id.startsWith(provider + '/'));
    }

    // Text search (only in full variant with model list)
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
    let entries = [...seen.entries()];

    // Apply provider filter if set
    if (this.providerFilter?.length) {
      entries = entries.filter(([p]) => this.providerFilter.includes(p));
    }

    return entries.sort((a, b) => b[1] - a[1]);
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

  /** Expand the card to show full config (only in card variant) */
  expand(): void {
    this._expanded = true;
  }

  /** Collapse back to card view (only in card variant) */
  collapse(): void {
    this._expanded = false;
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

  private _onProviderChange(provider: string): void {
    // When provider changes, clear the model selection
    this._updateConfig({ provider, model: '' });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  override render() {
    // Card variant that's expanded shows full view
    if (this.variant === 'card' && !this._expanded) {
      return this._renderCard();
    }
    return this._renderFull();
  }

  // ── Card Variant ────────────────────────────────────────────────────────

  private _renderCard() {
    const v = this.value || {};
    const l = this._l;
    return html`
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div class="card">
        <div class="card-main">
          <div class="card-fields">
            <div class="field">
              <label>${l.name}</label>
              <input
                type="text"
                .value=${v.name || ''}
                placeholder=${l.placeholderName}
                @input=${(e: Event) =>
                  this._updateConfig({ name: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div class="field">
              <label>${l.description}</label>
              <input
                type="text"
                .value=${v.description || ''}
                placeholder=${l.placeholderDescription}
                @input=${(e: Event) =>
                  this._updateConfig({ description: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div class="field-row">
              <div class="field">
                <label>${l.provider}</label>
                ${this._renderProviderDropdown(v)}
              </div>
              <div class="field">
                <label>${l.model}</label>
                ${this._renderModelDropdown(v)}
              </div>
            </div>
          </div>
          <button
            class="icon-btn gear-btn"
            title=${l.advancedConfiguration}
            @click=${() => (this._expanded = true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private _renderProviderDropdown(v: PromptConfig) {
    const l = this._l;
    if (this._modelsLoading) {
      return html`<select disabled><option>${l.placeholderLoading}</option></select>`;
    }
    // Use ?selected on <option> instead of .value on <select> to avoid
    // Lit's PropertyPart caching issue with async-populated options
    return html`
      <select
        @change=${(e: Event) =>
          this._onProviderChange((e.target as HTMLSelectElement).value)}
      >
        <option value="" ?selected=${!v.provider}>${l.placeholderSelectProvider}</option>
        ${this._availableProviders.map(
          ([p, count]) => html`
            <option value=${p} ?selected=${p === v.provider}>
              ${PROVIDER_META[p]?.label || p} (${count})
            </option>
          `
        )}
      </select>
    `;
  }

  private _renderModelDropdown(v: PromptConfig) {
    const l = this._l;
    if (this._modelsLoading) {
      return html`<select disabled><option>${l.placeholderLoading}</option></select>`;
    }
    if (!v.provider) {
      return html`<select disabled><option>${l.placeholderSelectProviderFirst}</option></select>`;
    }
    const models = this._filteredModels;
    // Use ?selected on <option> instead of .value on <select> to avoid
    // Lit's PropertyPart caching issue with async-populated options
    return html`
      <select
        @change=${(e: Event) =>
          this._updateConfig({ model: (e.target as HTMLSelectElement).value })}
      >
        <option value="" ?selected=${!v.model}>${l.placeholderSelectModel}</option>
        ${models.map(
          (m) => html`
            <option value=${m.id} ?selected=${m.id === v.model}>${m.name}</option>
          `
        )}
      </select>
    `;
  }

  // ── Full Variant ────────────────────────────────────────────────────────

  private _renderFull() {
    const v = this.value || {};
    const isExpandedCard = this.variant === 'card' && this._expanded;

    return html`
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      ${this._renderHeader(isExpandedCard)}

      <!-- Test Section at Top -->
      ${this._renderTestSection(v)}

      <!-- Identity & Model Section -->
      ${this._renderIdentitySection(v)}

      <!-- Prompts Section -->
      ${this._renderPromptsSection(v)}

      <!-- Advanced Settings (Collapsible) -->
      ${this._renderAdvancedSection(v)}
    `;
  }

  private _renderHeader(isExpandedCard: boolean) {
    const l = this._l;
    return html`
      <div class="header">
        <div class="header-title">
          ${isExpandedCard
            ? html`
                <button
                  class="icon-btn"
                  @click=${() => (this._expanded = false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              `
            : html`
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                </svg>
              `}
          ${isExpandedCard ? l.advancedConfiguration : l.promptConfiguration}
        </div>
        <div class="header-actions">
          <button class="sm" @click=${this._onImport}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            ${l.import}
          </button>
          <button class="sm" @click=${this._onExport}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            ${l.export}
          </button>
          <button class="sm primary" @click=${this._onSave}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            ${l.save}
          </button>
        </div>
      </div>
    `;
  }

  private _renderTestSection(v: PromptConfig) {
    const l = this._l;
    const vars = this._templateVars;
    const hasUnfilled = vars.some((vn) => !v.sampleInputs?.[vn]);
    const noModel = !v.model;
    const noPrompt = !v.systemPrompt && !v.userPromptTemplate;
    const disabled = noModel || noPrompt || this._testLoading;

    return html`
      <div class="section test-section">
        <div class="section-body" style="padding-top: 16px;">
          <div class="test-bar">
            <button class="primary" ?disabled=${disabled} @click=${this._onTest}>
              ${this._testLoading
                ? html`<span class="spinner"></span> ${l.testing}`
                : html`
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    ${l.testPrompt}
                  `}
            </button>
            ${noModel
              ? html`<span style="font-size:11px; color:var(--pc-text-muted)">${l.statusSelectModel}</span>`
              : nothing}
            ${!noModel && noPrompt
              ? html`<span style="font-size:11px; color:var(--pc-text-muted)">${l.statusAddPrompt}</span>`
              : nothing}
            ${!noModel && !noPrompt && hasUnfilled
              ? html`<span style="font-size:11px; color:var(--pc-accent)">${l.statusTemplateVarsEmpty}</span>`
              : nothing}
          </div>

          ${this._testResult
            ? html`
                <div class="test-result success">
                  <div class="test-result-header">${l.response}</div>
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
                  <div class="test-result-header">${l.error}</div>
                  <div class="test-result-body">${this._testError}</div>
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  private _renderIdentitySection(v: PromptConfig) {
    const l = this._l;
    return html`
      <div class="section">
        <div class="section-body" style="padding-top: 16px;">
          <div class="field-row">
            <div class="field">
              <label>${l.name}</label>
              <input
                type="text"
                .value=${v.name || ''}
                placeholder=${l.placeholderName}
                @input=${(e: Event) =>
                  this._updateConfig({ name: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div class="field">
              <label>${l.configId}</label>
              <input
                type="text"
                .value=${v.id || ''}
                placeholder="e.g. summarize-article"
                @input=${(e: Event) =>
                  this._updateConfig({ id: (e.target as HTMLInputElement).value })}
              />
            </div>
          </div>
          <div class="field">
            <label>${l.description}</label>
            <input
              type="text"
              .value=${v.description || ''}
              placeholder=${l.placeholderDescription}
              @input=${(e: Event) =>
                this._updateConfig({ description: (e.target as HTMLInputElement).value })}
            />
          </div>
          <div class="field-row">
            <div class="field">
              <label>${l.provider}</label>
              ${this._renderProviderDropdown(v)}
            </div>
            <div class="field">
              <label>${l.model}</label>
              ${this._renderModelDropdown(v)}
            </div>
          </div>
          ${this._selectedModel ? this._renderSelectedModelInfo(this._selectedModel) : nothing}
        </div>
      </div>
    `;
  }

  private _renderSelectedModelInfo(m: OpenRouterModel) {
    const l = this._l;
    const sp = m.supported_parameters || [];
    const pricing = m.pricing || {};
    const arch = m.architecture || {};
    return html`
      <div class="model-selected-info">
        <div class="msi-row">
          <span class="msi-label">${l.context}</span>
          <span class="msi-value">${m.context_length?.toLocaleString()} tokens</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">${l.maxOutput}</span>
          <span class="msi-value">${m.top_provider?.max_completion_tokens?.toLocaleString() || '-'} tokens</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">${l.modality}</span>
          <span class="msi-value">${arch.modality || '-'}</span>
        </div>
        <div class="msi-row">
          <span class="msi-label">${l.pricing}</span>
          <span class="msi-value">${formatPrice(pricing.prompt)} / ${formatPrice(pricing.completion)}</span>
        </div>
        ${sp.length
          ? html`
              <div style="margin-top: 6px;">
                <span class="msi-label" style="font-size: 10.5px;">${l.supportedParameters}</span>
                <div class="supported-params">
                  ${sp.map((p) => html`<span class="param-tag">${p}</span>`)}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderPromptsSection(v: PromptConfig) {
    const l = this._l;
    const vars = this._templateVars;
    return html`
      <div class="section">
        <div class="section-body" style="padding-top: 16px;">
          <div class="field">
            <label>${l.systemPrompt}</label>
            <textarea
              rows="4"
              .value=${v.systemPrompt || ''}
              placeholder=${l.placeholderSystemPrompt}
              @input=${(e: Event) =>
                this._updateConfig({
                  systemPrompt: (e.target as HTMLTextAreaElement).value,
                })}
            ></textarea>
          </div>
          <div class="field">
            <div class="label-row">
              <label>${l.userPromptTemplate}</label>
              <span class="label-hint">${l.hintTemplateVars}</span>
            </div>
            <textarea
              rows="3"
              .value=${v.userPromptTemplate || ''}
              placeholder=${l.placeholderUserPrompt}
              @input=${(e: Event) =>
                this._updateConfig({
                  userPromptTemplate: (e.target as HTMLTextAreaElement).value,
                })}
            ></textarea>
          </div>
          ${vars.length
            ? html`
                <div class="field">
                  <label>${l.sampleInputs}</label>
                  <div class="var-grid">
                    ${vars.map(
                      (varName) => html`
                        <span class="var-label">{{${varName}}}</span>
                        <input
                          type="text"
                          .value=${v.sampleInputs?.[varName] || ''}
                          placeholder=${l.placeholderSampleValue}
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
        </div>
      </div>
    `;
  }

  private _renderAdvancedSection(v: PromptConfig) {
    const l = this._l;
    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() => (this._advancedOpen = !this._advancedOpen)}
        >
          <svg
            class="section-chevron ${this._advancedOpen ? 'open' : ''}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="section-label">${l.advancedSettings}</span>
        </div>
        ${this._advancedOpen
          ? html`
              <div class="section-body">
                ${this._renderParameters(v)}
                <hr class="divider" />
                ${this._renderResponse(v)}
                <hr class="divider" />
                ${this._renderTools(v)}
                <hr class="divider" />
                ${this._renderReasoning(v)}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Parameters ──────────────────────────────────────────────────────────

  private _renderParameters(v: PromptConfig) {
    const l = this._l;
    const sp = this._supportedParams;
    const has = (p: string) => !sp.length || sp.includes(p);

    return html`
      <div class="subsection">
        <div class="subsection-title">${l.parameters}</div>

        <div class="${has('temperature') ? '' : 'not-supported'}">
          <div class="field">
            <div class="label-row">
              <label>${l.temperature}</label>
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
                    temperature: parseFloat((e.target as HTMLInputElement).value),
                  })}
              />
            </div>
          </div>
        </div>

        <div class="field-row">
          <div class="field ${has('max_tokens') ? '' : 'not-supported'}">
            <label>${l.maxTokens}</label>
            <input
              type="number"
              min="1"
              max="1000000"
              .value=${String(v.maxTokens || '')}
              @input=${(e: Event) =>
                this._updateConfig({
                  maxTokens: parseInt((e.target as HTMLInputElement).value) || 0,
                })}
            />
          </div>
          <div class="field ${has('top_p') ? '' : 'not-supported'}">
            <div class="label-row">
              <label>${l.topP}</label>
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
            <label>${l.topK}</label>
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
              <label>${l.minP}</label>
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
              <label>${l.frequencyPenalty}</label>
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
                    frequencyPenalty: parseFloat((e.target as HTMLInputElement).value),
                  })}
              />
            </div>
          </div>
          <div class="field ${has('presence_penalty') ? '' : 'not-supported'}">
            <div class="label-row">
              <label>${l.presencePenalty}</label>
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
                    presencePenalty: parseFloat((e.target as HTMLInputElement).value),
                  })}
              />
            </div>
          </div>
        </div>

        <div class="field ${has('repetition_penalty') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>${l.repetitionPenalty}</label>
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
                  repetitionPenalty: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
          </div>
        </div>

        <div class="field ${has('stop') ? '' : 'not-supported'}">
          <div class="label-row">
            <label>${l.stopSequences}</label>
            <span class="label-hint">${l.hintOnePerLine}</span>
          </div>
          <textarea
            rows="2"
            .value=${this._stopSeqText}
            placeholder=${l.placeholderStopSequences}
            @input=${(e: Event) => {
              this._stopSeqText = (e.target as HTMLTextAreaElement).value;
              const seqs = this._stopSeqText.split('\n').filter((s) => s.length > 0);
              this._updateConfig({ stopSequences: seqs });
            }}
          ></textarea>
        </div>
      </div>
    `;
  }

  // ── Response Format ─────────────────────────────────────────────────────

  private _renderResponse(v: PromptConfig) {
    const l = this._l;
    const sp = this._supportedParams;
    const hasStructured =
      !sp.length ||
      sp.includes('structured_outputs') ||
      sp.includes('response_format');

    return html`
      <div class="subsection">
        <div class="subsection-title">${l.responseFormat}</div>

        <div class="field ${hasStructured ? '' : 'not-supported'}">
          <label>${l.format}</label>
          <select
            @change=${(e: Event) =>
              this._updateConfig({
                responseFormat: (e.target as HTMLSelectElement).value as PromptConfig['responseFormat'],
              })}
          >
            <option value="text" ?selected=${(v.responseFormat || 'text') === 'text'}>${l.formatText}</option>
            <option value="json_object" ?selected=${v.responseFormat === 'json_object'}>${l.formatJsonObject}</option>
            <option value="json_schema" ?selected=${v.responseFormat === 'json_schema'}>${l.formatJsonSchema}</option>
          </select>
        </div>
        ${v.responseFormat === 'json_schema'
          ? html`
              <div class="field">
                <div class="label-row">
                  <label>${l.jsonSchema}</label>
                  <span class="label-hint">${l.hintOpenAISchema}</span>
                </div>
                <textarea
                  rows="6"
                  .value=${this._schemaText}
                  placeholder=${l.placeholderJsonSchema}
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
      </div>
    `;
  }

  // ── Tools ───────────────────────────────────────────────────────────────

  private _renderTools(v: PromptConfig) {
    const l = this._l;
    const sp = this._supportedParams;
    const hasTools = !sp.length || sp.includes('tools');

    return html`
      <div class="subsection ${hasTools ? '' : 'not-supported'}">
        <div class="subsection-title">${l.tools}</div>

        <div class="field">
          <div class="label-row">
            <label>${l.toolDefinitions}</label>
            <span class="label-hint">${l.hintOpenAITools}</span>
          </div>
          <textarea
            rows="6"
            .value=${this._toolsText}
            placeholder=${l.placeholderToolDefinitions}
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
          <label>${l.toolChoice}</label>
          <select
            @change=${(e: Event) =>
              this._updateConfig({
                toolChoice: (e.target as HTMLSelectElement).value as PromptConfig['toolChoice'],
              })}
          >
            <option value="auto" ?selected=${(v.toolChoice || 'auto') === 'auto'}>${l.toolChoiceAuto}</option>
            <option value="none" ?selected=${v.toolChoice === 'none'}>${l.toolChoiceNone}</option>
            <option value="required" ?selected=${v.toolChoice === 'required'}>${l.toolChoiceRequired}</option>
          </select>
        </div>
      </div>
    `;
  }

  // ── Reasoning ───────────────────────────────────────────────────────────

  private _renderReasoning(v: PromptConfig) {
    const l = this._l;
    const sp = this._supportedParams;
    const hasReasoning = !sp.length || sp.includes('reasoning');

    return html`
      <div class="subsection ${hasReasoning ? '' : 'not-supported'}">
        <div class="subsection-title">${l.reasoning}</div>

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
            <span>${l.enableReasoning}</span>
          </div>
        </div>
        ${v.reasoning
          ? html`
              <div class="field">
                <label>${l.reasoningEffort}</label>
                <select
                  @change=${(e: Event) =>
                    this._updateConfig({
                      reasoningEffort: (e.target as HTMLSelectElement).value as PromptConfig['reasoningEffort'],
                    })}
                >
                  <option value="low" ?selected=${v.reasoningEffort === 'low'}>${l.reasoningLow}</option>
                  <option value="medium" ?selected=${(v.reasoningEffort || 'medium') === 'medium'}>${l.reasoningMedium}</option>
                  <option value="high" ?selected=${v.reasoningEffort === 'high'}>${l.reasoningHigh}</option>
                </select>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-config': PromptConfigElement;
  }
}
