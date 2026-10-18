const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-catalog-styles'

const CSS = `
.dmc-catalog-panel,
.dmc-catalog-head,
.dmc-catalog-foot,
.dmc-model-row,
.dmc-model-well,
.dmc-model-input,
.dmc-discover-search,
.dmc-discover-check {
  box-sizing: border-box;
}

.dmc-catalog-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0 0 14px;
  padding: 14px 16px;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 22px;
}

.dmc-catalog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dmc-catalog-title {
  margin: 0;
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.dmc-catalog-status {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.dmc-catalog-count {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dmc-catalog-close {
  flex: none;
}

.dmc-catalog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.dmc-catalog-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
}

.dmc-catalog-foot-note {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
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
  gap: 8px;
  padding: 12px;
  border: 0.5px solid var(--zmd-line-control);
  border-radius: var(--zmd-radius-well);
}

.dmc-catalog-guard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dmc-catalog-section {
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}

.dmc-catalog-notice {
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmc-catalog-error {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.dmc-catalog-note {
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmc-model-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dmc-model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 10px;
  row-gap: 2px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 0.5px solid var(--zmd-line);
  color: var(--zmd-ink);
}

.dmc-model-row:last-child {
  border-bottom: 0;
}

.dmc-model-row[data-well='true'] {
  border-bottom-color: transparent;
}

.dmc-model-ref {
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmc-model-actions {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 2px;
  min-width: 0;
}

.dmc-model-edit,
.dmc-model-delete {
  flex: 0 0 auto;
}

.dmc-model-sub {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-model-alias {
  min-width: 0;
  color: var(--zmd-ink-secondary);
  overflow-wrap: anywhere;
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

.dmc-model-well {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 8px 0 2px;
  padding: 12px;
  border: 0.5px solid var(--zmd-line-control);
  border-radius: var(--zmd-radius-well);
}



.dmc-model-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.dmc-model-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.dmc-model-input,
.dmc-discover-search {
  min-width: 0;
}

.dmc-model-input::placeholder,
.dmc-discover-search::placeholder {
  color: var(--zmd-ink-dim);
}

.dmc-model-input[data-invalid='true'] {
  border-color: var(--zmd-danger);
}

.dmc-model-error {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.dmc-reasoning {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
}

.dmc-reasoning-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  min-width: 0;
}

.dmc-reasoning .dmc-reasoning-switch {
  box-sizing: border-box;
  flex: 0 0 auto;
  align-self: center;
  width: 36px;
  height: 20px;
  margin-left: auto;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--zmd-line-strong);
  color: var(--zmd-ink-caption);
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmc-reasoning .dmc-reasoning-switch[aria-checked='true'] {
  background: var(--zmd-fill-primary);
  color: var(--zmd-on-primary);
}

.dmc-reasoning .dmc-reasoning-switch > span {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--dsw-alias-switch-thumb);
  transition: transform var(--zmd-fast) var(--zmd-ease);
}

.dmc-reasoning .dmc-reasoning-switch[aria-checked='true'] > span {
  transform: translateX(16px);
}

.dmc-reasoning .dmc-reasoning-switch:disabled {
  opacity: 0.5;
  cursor: default;
}

.dmc-reasoning .dmc-reasoning-switch:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

.dmc-reasoning-columns,
.dmc-reasoning-row {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.dmc-reasoning-columns {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmc-reasoning-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.dmc-reasoning-select,
.dmc-reasoning-value {
  min-width: 0;
}

.dmc-reasoning-value::placeholder {
  color: var(--zmd-ink-dim);
}

.dmc-reasoning-remove {
  justify-self: end;
}

.dmc-reasoning-add {
  align-self: flex-start;
}

.dmc-reasoning-help {
  margin: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmc-model-add {
  flex: 0 0 auto;
}

.dmc-catalog-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}







.dmc-discover {
  flex: none;
}



.dmc-discover-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 0.5px solid var(--zmd-line-strong);
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
  max-height: 300px;
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
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
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
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--zmd-fill-primary);
  cursor: pointer;
}

.dmc-discover-check:disabled {
  cursor: default;
}

.dmc-discover-id {
  min-width: 0;
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.dmc-discover-name {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  overflow-wrap: anywhere;
}

.dmc-catalog-panel .zmd-btn-ghost:focus-visible,
.dmc-catalog-panel .zmd-btn-secondary:focus-visible,
.dmc-catalog-panel .zmd-btn-primary:focus-visible,
.dmc-catalog-panel .zmd-btn-danger:focus-visible,
.dmc-catalog-panel .dmc-model-input:focus-visible,
.dmc-catalog-panel .dmc-reasoning-select:focus-visible,
.dmc-catalog-panel .dmc-reasoning-value:focus-visible,
.dmc-catalog-panel .dmc-discover-search:focus-visible,
.dmc-catalog-panel .dmc-discover-check:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

@container (max-width: 484px) {
  .dmc-catalog-head {
    flex-wrap: wrap;
  }

  .dmc-model-fields {
    gap: 10px;
  }

  .dmc-reasoning-columns,
  .dmc-reasoning-row {
    grid-template-columns: 96px minmax(0, 1fr) auto;
  }
}

@container (max-width: 400px) {
  .dmc-catalog-panel {
    padding: 12px;
  }

  .dmc-model-fields,


  .dmc-catalog-foot-actions {
    margin-left: 0;
  }
}

@container (max-width: 300px) {
  .dmc-catalog-panel {
    padding: 10px;
    gap: 10px;
  }

  .dmc-catalog-count {
    display: none;
  }

  .dmc-reasoning-columns {
    display: none;
  }

  .dmc-reasoning-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  .dmc-reasoning-select {
    grid-column: 1;
    grid-row: 1;
  }

  .dmc-reasoning-remove {
    grid-column: 2;
    grid-row: 1;
  }

  .dmc-reasoning-value {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .dmc-discover-candidate {
    min-height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dmc-model-row {
    transition: none;
  }
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
