const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-catalog-styles'

const CSS = `
.dmc-catalog-panel,
.dmc-catalog-head,
.dmc-catalog-foot,
.dmc-model-row,
.dmc-model-well,
.dmc-btn,
.dmc-model-input,
.dmc-reasoning-value,
.dmc-reasoning-level,
.dmc-discover-search,
.dmc-discover-check,
.dmc-model-add {
  box-sizing: border-box;
}

.dmc-catalog-panel {
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  margin: 0 0 14px;
  padding: 12px 16px 12px 14px;
  border-left: 1px solid var(--zmd-line-strong);
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
}

.dmc-catalog-panel > * {
  position: relative;
  z-index: 1;
}

.dmc-catalog-head {
  min-width: 0;
}

.dmc-catalog-title {
  margin: 0;
  flex: 0 0 auto;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--zmd-ink);
}

.dmc-catalog-status {
  flex: 0 0 auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
}

.dmc-roster-count {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dmc-btn {
  height: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out, color 120ms ease-out, transform 80ms linear;
}

.dmc-btn:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-btn:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.dmc-catalog-close {
  flex: none;
}

.dmc-catalog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.dmc-catalog-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 10px;
}

.dmc-catalog-foot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.dmc-catalog-guard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--zmd-danger);
}

.dmc-catalog-guard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dmc-catalog-section {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-catalog-notice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-catalog-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

.dmc-catalog-note {
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink);
}

.dmc-model-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dmc-model-row {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  column-gap: 10px;
  row-gap: 1px;
  align-items: center;
  min-height: 44px;
  padding: 8px 0;
  color: var(--zmd-ink);
  transition: background-color 120ms ease-out;
}

.dmc-model-row:hover,
.dmc-model-row:focus-within {
  background: var(--zmd-hover);
}

.dmc-model-row[data-well='true'] {
  background: transparent;
}

.dmc-model-row[data-invalid='true']::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: var(--zmd-danger);
}

.dmc-model-index {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  color: var(--zmd-ink-mute);
}

.dmc-model-ref {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--zmd-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmc-model-sub {
  grid-column: 2 / -1;
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-model-alias {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--zmd-ink-secondary);
}

.dmc-model-facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 12px;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.dmc-model-fact {
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dmc-model-edit {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  height: 26px;
  padding: 0 8px;
}

.dmc-model-well {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  margin: 6px 0 2px;
  padding: 12px 12px 12px 10px;
  border-left: 1px solid var(--zmd-line-strong);
  background: transparent;
}

.dmc-model-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px 12px;
}

.dmc-model-id,
.dmc-model-name,
.dmc-model-window,
.dmc-model-tokens {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dmc-model-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
}

.dmc-model-input,
.dmc-reasoning-value,
.dmc-reasoning-level,
.dmc-discover-search {
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
}

.dmc-model-input:focus,
.dmc-model-input:focus-visible,
.dmc-reasoning-value:focus,
.dmc-reasoning-value:focus-visible,
.dmc-reasoning-level:focus,
.dmc-reasoning-level:focus-visible,
.dmc-discover-search:focus,
.dmc-discover-search:focus-visible {
  border-bottom-color: var(--zmd-accent);
  outline: 0;
}

.dmc-reasoning-level {
  padding-right: 22px;
}

.dmc-model-input::placeholder,
.dmc-reasoning-value::placeholder,
.dmc-discover-search::placeholder {
  color: var(--zmd-ink-mute);
}

.dmc-model-input[data-invalid='true'] {
  border-bottom-color: var(--zmd-danger);
}

.dmc-model-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

.dmc-model-danger {
  align-self: flex-start;
  height: 26px;
  padding: 0 6px;
  font-size: 12px;
}

.dmc-model-add {
  align-self: flex-start;
  height: 32px;
  padding: 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out;
}

.dmc-model-add:hover:not(:disabled) {
  text-decoration-color: var(--zmd-accent);
}

.dmc-reasoning {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmc-reasoning-head,
.dmc-reasoning-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}

.dmc-reasoning-head {
  align-items: center;
}

.dmc-reasoning-remove {
  align-self: center;
  justify-self: end;
  height: 26px;
  font-size: 12px;
  font-weight: 500;
}

.dmc-reasoning-add,
.dmc-reasoning-remove {
  flex: none;
}

.dmc-reasoning-add {
  align-self: flex-start;
}

.dmc-reasoning-help {
  margin: 0;
  max-width: 62ch;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-discover-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dmc-discover,
.dmc-discover-adopt,
.dmc-discover-tool {
  flex: none;
}

.dmc-discover-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--zmd-line);
}

.dmc-discover-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dmc-discover-list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.dmc-discover-group {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dmc-discover-candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0;
  color: var(--zmd-ink);
}

.dmc-discover-candidate[data-present='true'] {
  color: var(--zmd-ink-mute);
}

.dmc-discover-label {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dmc-discover-check {
  flex: none;
  display: inline-grid;
  place-content: center;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.dmc-discover-check::after {
  content: '';
  display: none;
  width: 4px;
  height: 7px;
  transform: translateY(-1px) rotate(45deg);
}

.dmc-discover-check:checked {
  border-color: var(--zmd-ink);
  background: var(--zmd-ink);
}

.dmc-discover-check:checked::after {
  display: block;
  border-right: 2px solid var(--zmd-on-ink);
  border-bottom: 2px solid var(--zmd-on-ink);
  animation: dmc-check-in 160ms var(--zmd-ease) both;
}

.dmc-discover-check:disabled {
  border-color: var(--zmd-line);
  background: transparent;
  cursor: default;
}

.dmc-discover-check:disabled::after {
  display: none;
}

.dmc-discover-id {
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.dmc-discover-name {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  color: var(--zmd-ink-mute);
  overflow-wrap: anywhere;
}

.dmc-btn:focus-visible,
.dmc-model-edit:focus-visible,
.dmc-model-danger:focus-visible,
.dmc-model-add:focus-visible,
.dmc-discover-check:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 2px;
}

@container (max-width: 484px) {
  .dmc-catalog-head {
    flex-wrap: wrap;
  }
}

@container (max-width: 360px) {
  .dmc-catalog-panel {
    grid-column: 1 / -1;
    gap: 12px;
    padding: 10px 12px;
  }

  .dmc-catalog-head {
    flex-wrap: wrap;
  }

  .dmc-roster-count {
    display: none;
  }

  .dmc-btn,
  .dmc-model-add,
  .dmc-model-edit {
    height: 40px;
    min-height: 40px;
  }

  .zmd-btn-primary,
  .dmc-model-input,
  .dmc-reasoning-value,
  .dmc-reasoning-level,
  .dmc-discover-search {
    height: 40px;
  }

  .dmc-model-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .dmc-model-index {
    display: none;
  }

  .dmc-model-ref {
    grid-column: 1;
    grid-row: 1;
  }

  .dmc-model-edit {
    grid-column: 2;
    grid-row: 1;
  }

  .dmc-model-sub {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .dmc-model-fields,
  .dmc-reasoning-head,
  .dmc-reasoning-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .dmc-discover-candidate {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zmd-btn-primary,
  .dmc-btn,
  .dmc-model-add {
    transition: none;
  }

  .zmd-btn-primary:active:not(:disabled),
  .dmc-btn:active:not(:disabled),
  .dmc-model-edit:active,
  .dmc-model-danger:active:not(:disabled) {
    transform: none;
  }

  .dmc-discover-check:checked::after {
    animation: none;
  }
}

@keyframes dmc-check-in {
  from { transform: translateY(-1px) rotate(45deg) scale(0.6); }
}
`

export function injectCatalogStyles(): () => void {
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

export const CATALOG_STYLESHEET = CSS
