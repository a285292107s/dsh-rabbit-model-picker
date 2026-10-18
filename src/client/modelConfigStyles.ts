export const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-model-config-styles'

const CSS = `
.dmc-page {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 560px;
  padding-bottom: 8px;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
}

.dmc-page > * {
  position: relative;
  z-index: 1;
}

.dmc-page,
.dmc-row,
.dmc-add,
.dmc-picker-item,
.dmc-key-action,
.dmc-key-clear,
.dmc-protocol,
.dmc-catalog,
.dmc-manage,
.dmc-danger,
.dmc-retry-action,
.dmc-retry-input,
.dmc-well,
.dmc-backoff-cell {
  box-sizing: border-box;
}

.dmc-head {
  padding: 20px 16px 14px;
  border-bottom: 1px solid var(--zmd-line);
}

.dmc-readout {
  margin: 0;
}

.dmc-meta {
  color: var(--zmd-ink-secondary);
}

.dmc-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  max-width: 52ch;
  padding: 16px;
}

.dmc-empty-lead {
  margin: 0;
  color: var(--zmd-ink);
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.dmc-empty-copy {
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 14px;
  line-height: 22px;
  text-wrap: pretty;
}

.dmc-notice {
  margin: 0;
  padding: 0 16px 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-notice-action {
  margin-left: 8px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, text-decoration-color 120ms ease-out;
}

.dmc-notice-action:hover {
  background: var(--zmd-hover);
  text-decoration-color: var(--zmd-accent);
}

.dmc-alert {
  margin: 0 16px 8px;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--zmd-danger);
  color: var(--zmd-ink);
}

.dmc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 16px 0;
}

.dmc-actions .dmc-add {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--zmd-line-control);
  color: var(--zmd-ink);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.dmc-actions .dmc-add:hover:not(:disabled) {
  border-color: var(--zmd-ink-mute);
  background: var(--zmd-hover);
  text-decoration: none;
}

.dmc-actions .dmc-add:disabled {
  border-color: var(--zmd-line);
  color: var(--zmd-ink-mute);
}

.dmc-add[data-emphasis='primary'] {
  height: 32px;
  padding: 0 16px;
  border: 0;
  background: var(--zmd-ink);
  color: var(--zmd-on-ink);
}

.dmc-add[data-emphasis='primary']:hover:not(:disabled) {
  background: var(--zmd-ink-secondary);
  text-decoration: none;
}

.dmc-add[data-emphasis='primary']:disabled {
  background: var(--zmd-hover);
  color: var(--zmd-ink-mute);
}

.dmc-add {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  text-wrap: pretty;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out, transform 80ms linear;
}

.dmc-add:hover:not(:disabled) {
  text-decoration-color: var(--zmd-accent);
}

.dmc-add:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-add:disabled {
  color: var(--zmd-ink-mute);
  text-decoration-color: transparent;
  cursor: default;
}

.dmc-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px 0;
}

.dmc-picker-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.dmc-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 0 8px 0 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out;
}

.dmc-picker-item:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-picker-item:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.dmc-listhead {
  display: grid;
  grid-template-columns: 26px minmax(120px, 1fr) max-content 92px 56px;
  column-gap: 12px;
  align-items: center;
  min-height: 26px;
  padding: 0 16px;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dmc-listhead-name {
  grid-column: 1 / span 2;
}

.dmc-listhead-col {
  justify-self: end;
  white-space: nowrap;
}

.dmc-listhead-col:nth-of-type(2) {
  grid-column: 3;
}

.dmc-listhead-col:nth-of-type(3) {
  grid-column: 4;
}

.dmc-listhead-col:nth-of-type(4) {
  grid-column: 5;
}

.dmc-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dmc-list:empty {
  display: none;
  border: 0;
}

.dmc-row {
  display: grid;
  grid-template-columns: 26px minmax(120px, 1fr) max-content 92px 56px;
  column-gap: 12px;
  align-items: center;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--zmd-line);
  color: var(--zmd-ink);
  transition: background-color 120ms ease-out;
}

.dmc-row:hover,
.dmc-row:focus-within {
  background: var(--zmd-hover);
}

.dmc-row[data-catalog='true'],
.dmc-row[data-well='true'] {
  background: transparent;
}

.dmc-name {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  min-width: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

.dmc-route {
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dmc-catalog {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  padding: 0 4px;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  height: 26px;
  font-variant-numeric: tabular-nums;
}

.dmc-catalog:hover:not(:disabled) {
  color: var(--zmd-ink);
}

.dmc-catalog:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.dmc-state {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dmc-mark {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  background: var(--zmd-ink-mute);
}

.dmc-mark[data-state='missing-key'],
.dmc-mark[data-state='unreachable'] {
  background: var(--zmd-danger);
}

.dmc-state[data-state='missing-key'],
.dmc-state[data-state='unreachable'] {
  color: var(--zmd-ink);
}

.dmc-manage {
  grid-column: 5;
  grid-row: 1;
  justify-self: end;
  padding: 0 8px;
  height: 26px;
}

.dmc-pending {
  grid-column: 2 / -1;
  grid-row: 2;
  padding-bottom: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-well {
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 14px;
  padding: 12px 16px 12px 14px;
  border-left: 1px solid var(--zmd-line-strong);
  background: transparent;
}

.dmc-well-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-width: 0;
}

.dmc-well-name {
  margin: 0;
  min-width: 0;
  color: var(--zmd-ink);
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dmc-well-route {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dmc-danger {
  flex: 0 0 auto;
  margin-left: auto;
  min-width: 0;
  max-width: 100%;
  padding: 0 6px;
  white-space: normal;
  text-align: right;
}

.dmc-well-foot {
  display: flex;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--zmd-line);
}

.dmc-well-foot > .dmc-danger {
  margin-left: 0;
  padding-left: 0;
  color: var(--zmd-ink-secondary);
}

.dmc-diagnostic {
  margin: 0;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

.dmc-fields {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 6px;
  align-items: center;
  margin: 0;
}

.dmc-field-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
  margin: 0;
}

.dmc-field-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--zmd-ink);
}

.dmc-quiet {
  color: var(--zmd-ink-secondary);
}

.dmc-key-action {
  min-width: 0;
  padding: 0 6px;
}

input.dmc-key-action {
  flex: 1 1 100%;
  width: 100%;
  height: 32px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
}

input.dmc-key-action::placeholder {
  color: var(--zmd-ink-mute);
}

input.dmc-key-action:focus,
input.dmc-key-action:focus-visible {
  border-bottom-color: var(--zmd-accent);
  outline: 0;
}

.dmc-key-clear {
  padding: 0 6px;
}

.dmc-protocol {
  min-width: 0;
  max-width: 100%;
  height: 32px;
  padding: 0 22px 0 2px;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
}

.dmc-protocol:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

.dmc-protocol option {
  background: var(--zmd-panel);
  color: var(--zmd-ink);
}

.dmc-retry-action {
  padding: 0 6px;
}

.dmc-retry {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
  padding-top: 12px;
  border-top: 1px solid var(--zmd-line);
}

.dmc-retry-state {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink-mute);
}

.dmc-retry .dmc-notice {
  padding: 0;
}

.dmc-retry-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 20px;
  min-width: 0;
}

.dmc-retry-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dmc-retry-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-retry-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dmc-retry-input {
  width: 64px;
  min-width: 0;
  height: 32px;
  padding: 0 2px;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}

.dmc-retry-input[aria-invalid='true'] {
  border-bottom-color: var(--zmd-danger);
}

.dmc-retry-input:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.dmc-retry-unit {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-retry-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.dmc-retry-tally {
  font-size: 16px;
  line-height: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--zmd-ink);
}

.dmc-retry-tally-unit {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-retry-detail {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-backoff {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
}

.dmc-backoff-cell {
  width: 6px;
  background: var(--zmd-ink-mute);
  transform-origin: 50% 100%;
  animation: dmc-backoff-rise 160ms var(--zmd-ease) both;
}

.dmc-backoff-cell[data-level='0'] {
  height: 2px;
  background: var(--zmd-line-strong);
  animation: none;
}

.dmc-backoff-cell[data-level='1'] {
  height: 6px;
}

.dmc-backoff-cell[data-level='2'] {
  height: 10px;
}

.dmc-backoff-cell[data-level='3'] {
  height: 14px;
}

.dmc-backoff-cell[data-level='4'] {
  height: 18px;
}

.dmc-retry-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

@keyframes dmc-backoff-rise {
  from { transform: scaleY(0.35); }
}

.dmc-page .zmd-btn-door:focus-visible,
.dmc-page .zmd-btn-quiet:focus-visible,
.dmc-page .zmd-btn-danger:focus-visible,
.dmc-page .zmd-btn-primary:focus-visible,
.dmc-page .dmc-add:focus-visible,
.dmc-page .dmc-notice-action:focus-visible,
.dmc-page .dmc-protocol:focus-visible,
.dmc-page .dmc-retry-input:focus-visible,
.dmc-page .dmc-picker-item:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 2px;
}

@container (max-width: 484px) {
  .dmc-row {
    grid-template-columns: 26px minmax(0, 1fr) max-content 76px 52px;
    column-gap: 10px;
  }

  .dmc-listhead {
    grid-template-columns: 26px minmax(0, 1fr) max-content 76px 52px;
    column-gap: 10px;
  }

  .dmc-fields {
    grid-template-columns: 64px minmax(0, 1fr);
    column-gap: 10px;
  }
}

@container (max-width: 360px) {
  .dmc-listhead {
    display: none;
  }

  .dmc-row {
    grid-template-columns: 22px minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto auto;
    row-gap: 2px;
    padding: 6px 12px 6px 0;
  }

  .dmc-head {
    padding: 12px 12px 10px;
  }

  .dmc-name {
    grid-column: 2;
    grid-row: 1;
    font-size: 14px;
    line-height: 20px;
    text-wrap: pretty;
  }

  .dmc-ordinal {
    width: 22px;
  }

  .dmc-catalog {
    grid-column: 1 / span 2;
    grid-row: 2;
    justify-self: start;
  }

  .dmc-state {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }

  .dmc-manage {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
  }

  .dmc-pending {
    grid-column: 2 / -1;
    grid-row: 3;
  }

  .dmc-well {
    grid-column: 1 / -1;
    grid-row: 4;
    margin: 4px 0 10px;
    padding: 10px 12px;
  }

  .dmc-well-head {
    gap: 2px 8px;
  }

  .dmc-danger {
    margin-left: 0;
    text-align: left;
  }

  .dmc-fields {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 2px;
  }

  .dmc-field-label {
    margin-top: 6px;
  }

  .dmc-protocol {
    width: 100%;
    min-width: 0;
    padding: 0 18px 0 0;
    text-overflow: ellipsis;
  }

  .dmc-retry-field {
    flex: 1 1 100%;
  }

  .dmc-retry-input {
    width: 100%;
  }

  .dmc-page .zmd-btn-door,
  .dmc-page .zmd-btn-quiet,
  .dmc-page .zmd-btn-danger,
  .dmc-page .dmc-add,
  .dmc-page .dmc-catalog,
  .dmc-page .dmc-manage,
  .dmc-page .dmc-notice-action {
    min-height: 40px;
  }

  .dmc-protocol,
  .dmc-retry-input {
    height: 40px;
  }
}

@container (max-width: 240px) {
  .dmc-row {
    grid-template-columns: 16px minmax(0, 1fr);
    grid-template-rows: auto;
    row-gap: 3px;
    column-gap: 6px;
    padding: 8px 4px 8px 0;
  }

  .dmc-head {
    padding: 10px 4px;
  }

  .dmc-readout {
    line-height: 28px;
    letter-spacing: -0.04em;
    word-break: keep-all;
  }

  .dmc-meta {
    flex-direction: column;
    gap: 1px;
  }

  .dmc-meta > [aria-hidden='true'] {
    display: none;
  }

  .dmc-ordinal {
    grid-column: 1;
    grid-row: 1;
    width: 16px;
    padding-top: 5px;
  }

  .dmc-catalog {
    grid-column: 2;
    grid-row: 3;
    justify-self: start;
    padding-left: 0;
    height: auto;
    min-height: 26px;
    white-space: normal;
    text-align: left;
  }

  .dmc-name {
    grid-column: 2;
    grid-row: 1;
    font-size: 14px;
    line-height: 20px;
    overflow-wrap: anywhere;
  }

  .dmc-state {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .dmc-catalog {
    grid-column: 2;
    grid-row: 3;
    justify-self: start;
    padding-left: 0;
  }

  .dmc-manage {
    grid-column: 2;
    grid-row: 4;
    justify-self: start;
  }

  .dmc-pending {
    grid-column: 2;
    grid-row: 5;
  }

  .dmc-well {
    grid-column: 1 / -1;
    grid-row: 6;
    padding: 10px;
  }

  .dmc-well-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .dmc-well-route {
    display: none;
  }

  .dmc-danger {
    margin-left: 0;
    padding-left: 0;
    text-align: left;
    white-space: normal;
  }

  .dmc-well-head > .dmc-danger {
    flex: 1 1 100%;
    white-space: normal;
  }

  .dmc-well-foot {
    justify-content: flex-start;
  }

  .dmc-fields {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 2px;
  }

  .dmc-field-label {
    margin-top: 6px;
  }

  .dmc-protocol {
    width: 100%;
    min-width: 0;
    padding: 0 18px 0 0;
    text-overflow: ellipsis;
  }

  .dmc-protocol option {
    max-width: 100%;
  }

  .dmc-actions,
  .dmc-empty,
  .dmc-notice {
    padding-left: 8px;
    padding-right: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zmd-btn-primary,
  .dmc-add,
  .dmc-key-action,
  .dmc-key-clear,
  .dmc-catalog,
  .dmc-manage,
  .dmc-danger,
  .dmc-picker-item,
  .dmc-retry-action,
  .dmc-backoff-cell {
    transition: none;
    animation: none;
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
