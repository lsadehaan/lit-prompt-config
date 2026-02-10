import { css } from 'lit';

export const promptConfigStyles = css`
  :host {
    /* Neutral professional palette */
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
    --pc-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
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
    :host([theme='auto']) {
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

  :host([theme='dark']) {
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

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* Header */
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
  .header-title svg {
    opacity: 0.5;
  }
  .header-actions {
    display: flex;
    gap: 4px;
  }

  /* Buttons */
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
  button:active {
    transform: scale(0.98);
  }

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
  button.icon-btn:hover {
    background: var(--pc-bg-hover);
  }

  /* Sections / Accordion */
  .section {
    border-bottom: 1px solid var(--pc-border);
  }
  .section:last-child {
    border-bottom: none;
  }

  .section-header {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    cursor: pointer;
    user-select: none;
    transition: background var(--pc-transition);
    gap: 8px;
  }
  .section-header:hover {
    background: var(--pc-bg-hover);
  }

  .section-chevron {
    width: 16px;
    height: 16px;
    transition: transform var(--pc-transition);
    opacity: 0.4;
    flex-shrink: 0;
  }
  .section-chevron.open {
    transform: rotate(90deg);
  }

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

  /* Form elements */
  .field {
    margin-bottom: 14px;
  }
  .field:last-child {
    margin-bottom: 0;
  }

  .field-row {
    display: flex;
    gap: 12px;
  }
  .field-row > .field {
    flex: 1;
    min-width: 0;
  }

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
  .label-row label {
    margin-bottom: 0;
  }
  .label-hint {
    font-size: 11px;
    color: var(--pc-text-muted);
    font-family: var(--pc-font-mono);
  }

  input[type='text'],
  input[type='number'],
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
  input:focus,
  select:focus,
  textarea:focus {
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
  .slider-row input[type='range'] {
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

  /* Model selector */
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
  .model-list::-webkit-scrollbar {
    width: 6px;
  }
  .model-list::-webkit-scrollbar-track {
    background: transparent;
  }
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
  .model-item:last-child {
    border-bottom: none;
  }
  .model-item:hover {
    background: var(--pc-bg-hover);
  }
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
  .msi-label {
    color: var(--pc-text-muted);
  }
  .msi-value {
    font-family: var(--pc-font-mono);
    font-weight: 500;
  }

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

  /* Variables editor */
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

  /* Test area */
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
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Toggle switch */
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

  /* Param not supported hint */
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

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 30px 16px;
    color: var(--pc-text-muted);
  }
  .empty-state p {
    margin: 4px 0;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .field-row {
      flex-direction: column;
      gap: 0;
    }
    .model-search-row {
      flex-direction: column;
    }
    .model-search-row select {
      width: 100%;
    }
  }
`;
