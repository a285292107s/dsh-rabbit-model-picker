export const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-model-config-styles'

const CSS = `
.dmc-page {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  padding: 4px 0 8px;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
}

.dmc-page,
.dmc-row,
.dmc-add-choice,
.dmc-picker-item,
.dmc-manage,
.dmc-danger,
.dmc-retry-input,
.dmc-well,
.dmc-ledger,
.dmc-picker {
  box-sizing: border-box;
}

.dmc-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dmc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dmc-add-top {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--zmd-line-strong);
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--zmd-fast) var(--zmd-ease),
    border-color var(--zmd-fast) var(--zmd-ease);
}

.dmc-add-top:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-add-top[aria-expanded='true'] {
  border-color: var(--zmd-ink);
}

.dmc-add-top:disabled {
  border-color: var(--zmd-line);
  color: var(--zmd-ink-dim);
  cursor: not-allowed;
}

.dmc-add-top:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

.dmc-add-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.dmc-add-choices {
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
  gap: 2px;
  padding: 3px;
  border-radius: var(--zmd-radius-control);
  background: var(--zmd-hover);
}

.dmc-add-choice {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease), color var(--zmd-fast) var(--zmd-ease);
}

.dmc-add-choice[data-active='true'] {
  background: var(--zmd-field);
  color: var(--zmd-ink);
  box-shadow: var(--dsw-shadow-lv1);
}

.dmc-add-choice:hover:not(:disabled):not([data-active='true']) {
  color: var(--zmd-ink);
}

.dmc-add-choice:disabled {
  color: var(--zmd-ink-dim);
  cursor: not-allowed;
}

.dmc-add-choice:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmc-custom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}

.dmc-custom-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dmc-custom-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px 16px;
}

.dmc-field-span {
  grid-column: 1 / -1;
}

.dmc-custom-models {
  height: auto;
  min-height: 84px;
  padding: 8px 10px;
  line-height: 20px;
  resize: vertical;
  font-family: var(--zmd-font);
}

.dmc-custom-count {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.dmc-custom-error {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
}

.dmc-custom-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
}

.dmc-custom-hint {
  flex: 1 1 200px;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-custom-foot .zmd-btn-ghost {
  margin-left: auto;
}

.dmc-notice {
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmc-notice-action {
  margin-left: 8px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.dmc-notice-action:hover {
  background: var(--zmd-hover);
}

.dmc-alert {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
}

.dmc-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmc-ledger {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}

.dmc-listhead,
.dmc-rowhead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  column-gap: 12px;
  align-items: center;
  min-width: 0;
}

.dmc-listhead {
  min-height: 34px;
  padding: 0 14px;
  border-bottom: 0.5px solid var(--zmd-line);
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}

.dmc-listhead-models,
.dmc-listhead-action {
  justify-self: end;
}

.dmc-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 14px;
  border-bottom: 0.5px solid var(--zmd-line);
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmc-row:last-child {
  border-bottom: 0;
}

.dmc-row:hover,
.dmc-row:focus-within,
.dmc-row[data-open='true'] {
  background: var(--zmd-hover);
}

.dmc-rowhead {
  min-height: 52px;
}

.dmc-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.dmc-name-dot {
  flex: 0 0 8px;
  align-self: center;
}

.dmc-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmc-route {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmc-models {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--zmd-fast) var(--zmd-ease),
    color var(--zmd-fast) var(--zmd-ease);
}

.dmc-models:hover {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-models[aria-expanded='true'] {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-models:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 1px;
}


.dmc-models-value {
  text-decoration: underline;
  text-decoration-color: var(--zmd-line-strong);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.dmc-models:hover .dmc-models-value,
.dmc-models[aria-expanded='true'] .dmc-models-value {
  text-decoration-color: var(--zmd-accent);
}

.dmc-chevron {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  transition: transform var(--zmd-base) var(--zmd-ease);
}

.dmc-chevron-open {
  transform: rotate(180deg);
}



.dmc-manage {
  justify-self: end;
}

.dmc-pending {
  padding-bottom: 8px;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-well {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 0 14px;
  padding: 14px 16px;
}

.dmc-diagnostic {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.dmc-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 12px 16px;
  margin: 0;
}

.dmc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
}


.dmc-field-label {
  margin: 0;
}

.dmc-field-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  min-height: 32px;
  margin: 0;
  font-size: 14px;
  line-height: 22px;
}

.dmc-locked {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0.5px dashed var(--zmd-line-control);
  border-radius: var(--zmd-radius-control);
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-size: 13px;
  line-height: 20px;
}

.dmc-locked > svg {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
}

.dmc-api-override {
  align-self: flex-start;
}

.dmc-field-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  flex: 1 1 100%;
  min-width: 0;
  margin-top: 2px;
}

.dmc-field-fact {
  flex: 1 1 96px;
  min-width: 0;
  margin: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmc-quiet {
  color: var(--zmd-ink-secondary);
}

.dmc-key-input {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.dmc-key-input .zmd-input {
  padding-right: 34px;
}

.dmc-key-reveal {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink-mute);
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease), color var(--zmd-fast) var(--zmd-ease);
}

.dmc-key-reveal:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-key-reveal:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmc-key-reveal:disabled {
  color: var(--zmd-ink-dim);
  cursor: default;
}

.dmc-well-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
}

.dmc-well-foot-hint {
  flex: 1 1 260px;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmc-retry {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
}

.dmc-retry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.dmc-retry-state {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-retry-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
}

.dmc-retry-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.dmc-retry-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dmc-retry-input {
  width: 76px;
}

.dmc-retry-unit {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-retry-line {
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-wrap: pretty;
}

.dmc-retry-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dmc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}


.dmc-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.dmc-picker-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dmc-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-control);
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmc-picker-item:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-picker-item:active:not(:disabled) {
  background: var(--zmd-active);
}

.dmc-picker-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dmc-picker-item:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: -2px;
}


.dmc-page .zmd-btn-ghost:focus-visible,
.dmc-page .zmd-btn-secondary:focus-visible,
.dmc-page .zmd-btn-primary:focus-visible,
.dmc-page .zmd-btn-danger:focus-visible,
.dmc-page .dmc-notice-action:focus-visible,
.dmc-page .dmc-picker-item:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

@container (max-width: 484px) {
  .dmc-listhead,
  .dmc-rowhead {
    grid-template-columns: minmax(0, 1fr) auto auto;
    column-gap: 10px;
  }

  .dmc-fields {
    gap: 12px;
  }
}

@container (max-width: 400px) {
  .dmc-listhead {
    display: none;
  }

  .dmc-rowhead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    padding: 10px 0;
  }

  .dmc-name {
    flex: 1 1 100%;
  }

  .dmc-models {
    order: 1;
  }


  .dmc-manage {
    order: 3;
    margin-left: auto;
  }

  .dmc-custom-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container (max-width: 300px) {
  .dmc-row {
    padding: 0 12px;
  }

  .dmc-well {
    padding: 12px;
  }

  .dmc-fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .dmc-field-value {
    min-height: 0;
  }

  .dmc-well-foot {
    align-items: flex-start;
    flex-direction: column;
  }

  .dmc-well-foot-hint {
    flex: 0 0 auto;
    margin-right: 0;
  }

  .dmc-add-top {
    align-self: flex-start;
  }

  .dmc-custom {
    padding: 12px;
  }

  .dmc-custom-foot .zmd-btn-ghost {
    margin-left: 0;
  }
}

@container (max-width: 240px) {
  .dmc-page {
    gap: 10px;
  }

  .dmc-row {
    padding: 0 10px;
  }

  .dmc-rowhead {
    padding: 10px 0;
    gap: 2px 6px;
  }

  .dmc-name {
    flex: 1 1 100%;
    flex-wrap: wrap;
    gap: 0 6px;
    font-size: 13px;
    line-height: 20px;
  }

  .dmc-name-text {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .dmc-route {
    flex: 1 1 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }


  .dmc-well {
    padding: 10px;
    gap: 10px;
  }

  .dmc-picker {
    padding: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dmc-row,
  .dmc-add-choice,
  .dmc-picker-item {
    transition: none;
  }
}
`

export function injectModelConfigStyles(): () => void {
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

export const MODEL_CONFIG_STYLESHEET = CSS
