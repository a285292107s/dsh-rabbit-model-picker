const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-design'

const TOKENS = `body {
  --zmd-font: var(--dsw-font-family);
  --zmd-ease: var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
  --zmd-fast: var(--ds-transition-duration-fast, 0.1s);
  --zmd-base: var(--ds-transition-duration, 0.2s);

  --zmd-surface: var(--dsw-alias-settings-card-fill);
  --zmd-stroke: var(--dsw-alias-settings-card-stroke);
  --zmd-line: var(--dsw-alias-border-l2);
  --zmd-line-strong: var(--dsw-alias-border-l3);
  --zmd-line-control: var(--dsw-alias-border-l4);

  --zmd-ink: var(--dsw-alias-label-primary);
  --zmd-ink-secondary: var(--dsw-alias-label-secondary);
  --zmd-ink-mute: var(--dsw-alias-label-tertiary);
  --zmd-ink-dim: var(--dsw-alias-label-dimmed);
  --zmd-ink-caption: var(--dsw-alias-label-caption);

  --zmd-hover: var(--dsw-alias-interactive-bg-hover);
  --zmd-active: var(--dsw-alias-interactive-bg-active);
  --zmd-hover-danger: var(--dsw-alias-interactive-bg-hover-danger);

  --zmd-accent: var(--dsw-alias-state-business-primary);
  --zmd-danger: var(--dsw-alias-state-error-primary);
  --zmd-ok: var(--dsw-alias-state-success-primary);
  --zmd-idle: var(--dsw-alias-state-idle-primary);

  --zmd-fill-primary: var(--dsw-alias-button-primary-fill);
  --zmd-fill-primary-hover: var(--dsw-alias-button-primary-hover);
  --zmd-on-primary: var(--dsw-alias-label-primary-foreground);

  --zmd-nested: var(--dsw-alias-bg-module-platform);
  --zmd-field: var(--dsw-alias-bg-layer-1);
  --zmd-menu: var(--dsw-alias-bg-layer-2);
  --zmd-elevation: var(--dsw-elevation-prominent);

  --zmd-radius-card: var(--dsw-radius-xl);
  --zmd-radius-well: var(--dsw-radius-lg);
  --zmd-radius-control: var(--dsw-radius-md);
  --zmd-radius-compact: var(--dsw-radius-sm);

  --zmd-focus: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  --zmd-focus-width: var(--dsw-focus-ring-width, 2px);

  --zmd-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

body[data-ds-dark-theme] {
  --zmd-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23ADB2B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}`

const PRIMITIVES = `
.zmd-num {
  font-variant-numeric: tabular-nums;
}

.zmd-title {
  margin: 0;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
}

.zmd-lede {
  margin: 0;
  color: var(--zmd-ink-mute);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
  text-wrap: pretty;
}

.zmd-label {
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}


.zmd-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--zmd-idle);
}

.zmd-dot[data-tone='ok'] {
  background: var(--zmd-ok);
}

.zmd-dot[data-tone='bad'] {
  background: var(--zmd-danger);
}


.zmd-card {
  border: 0.5px solid var(--zmd-stroke);
  border-radius: var(--zmd-radius-card);
  background: var(--zmd-surface);
}

.zmd-well {
  border-radius: var(--zmd-radius-well);
  background: var(--zmd-nested);
}

.zmd-input,
.zmd-select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--zmd-line-control);
  border-radius: var(--zmd-radius-control);
  background: var(--zmd-field);
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
  transition: border-color var(--zmd-fast) var(--zmd-ease);
}

.zmd-input::placeholder {
  color: var(--zmd-ink-dim);
}

.zmd-input:focus,
.zmd-input:focus-visible,
.zmd-select:focus,
.zmd-select:focus-visible {
  border-color: var(--zmd-accent);
  outline: 0;
}

.zmd-input:disabled,
.zmd-select:disabled {
  opacity: 0.6;
  cursor: default;
}

.zmd-input[aria-invalid='true'] {
  border-color: var(--zmd-danger);
}

.zmd-select {
  max-width: 100%;
  padding-right: 32px;
  appearance: none;
  background-image: var(--zmd-chevron);
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 12px 12px;
  cursor: pointer;
}

.zmd-select option {
  background: var(--zmd-field);
  color: var(--zmd-ink);
}

.zmd-btn-primary,
.zmd-btn-secondary,
.zmd-btn-ghost,
.zmd-btn-danger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: var(--zmd-radius-control);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--zmd-fast) var(--zmd-ease),
    border-color var(--zmd-fast) var(--zmd-ease),
    color var(--zmd-fast) var(--zmd-ease);
}

.zmd-btn-primary {
  height: 36px;
  padding: 0 14px;
  background: var(--zmd-fill-primary);
  color: var(--zmd-on-primary);
  font-weight: 500;
}

.zmd-btn-primary:hover:not(:disabled) {
  background: var(--zmd-fill-primary-hover);
}

.zmd-btn-secondary {
  height: 36px;
  padding: 0 14px;
  border: 0.5px solid var(--zmd-line-strong);
  background: transparent;
  color: var(--zmd-ink);
  font-weight: 500;
}

.zmd-btn-secondary:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.zmd-btn-secondary:active:not(:disabled) {
  background: var(--zmd-active);
}

.zmd-btn-ghost,
.zmd-btn-danger {
  height: 28px;
  padding: 0 10px;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}

.zmd-btn-ghost {
  color: var(--zmd-ink-secondary);
}

.zmd-btn-danger {
  color: var(--zmd-danger);
}

.zmd-btn-ghost:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.zmd-btn-ghost:active:not(:disabled) {
  background: var(--zmd-active);
}

.zmd-btn-danger:hover:not(:disabled) {
  background: var(--zmd-hover-danger);
}

.zmd-btn-primary:disabled,
.zmd-btn-secondary:disabled,
.zmd-btn-ghost:disabled,
.zmd-btn-danger:disabled {
  color: var(--zmd-ink-dim);
  cursor: not-allowed;
}

.zmd-btn-primary:disabled {
  background: transparent;
  border: 0.5px solid var(--zmd-line-strong);
  color: var(--zmd-ink-dim);
}

.zmd-btn-primary:focus-visible,
.zmd-btn-secondary:focus-visible,
.zmd-btn-ghost:focus-visible,
.zmd-btn-danger:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .zmd-input,
  .zmd-select,
  .zmd-btn-primary,
  .zmd-btn-secondary,
  .zmd-btn-ghost,
  .zmd-btn-danger {
    transition: none;
  }
}
`

const CSS = `${TOKENS}

${PRIMITIVES}`

export function injectDesignSystem(): () => void {
  if (typeof document === 'undefined') return () => {}
  document.getElementById(STYLE_ELEMENT_ID)?.remove()
  const element = document.createElement('style')
  element.id = STYLE_ELEMENT_ID
  element.textContent = CSS
  document.head.append(element)
  return () => {
    if (element.isConnected) element.remove()
  }
}

export const DESIGN_SYSTEM_STYLESHEET = CSS
