const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-styles'

const CSS = `
.dmp-root,
.dmp-menu {
  --dmp-col-icon: 14px;
  --dmp-col-window: 47px;
  --dmp-col-gap: 8px;
  --dmp-row-pad-x: 8px;
}

.dmp-root {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.dmp-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: min(220px, 45cqw);
  height: 28px;
  padding: 0 4px 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--zmd-fast) var(--zmd-ease),
    color var(--zmd-fast) var(--zmd-ease);
}

.dmp-trigger:hover:not(:disabled),
.dmp-trigger-open {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-trigger:focus-visible:not([data-selection-focus]) {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-trigger:disabled {
  opacity: 0.5;
  cursor: default;
}

.dmp-trigger-label {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-trigger-effort {
  display: var(--dsh-composer-model-text-display, inline);
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.dmp-trigger-effort::before {
  content: '·';
  margin: 0 4px;
}

.dmp-trigger-icon {
  display: var(--dsh-composer-model-icon-display, none);
  flex: 0 0 auto;
}

.dmp-chevron {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  transition: transform var(--zmd-base) var(--zmd-ease);
}

.dmp-chevron-open {
  transform: rotate(180deg);
}

.dmp-settings-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  cursor: pointer;
  transition:
    background-color var(--zmd-fast) var(--zmd-ease),
    color var(--zmd-fast) var(--zmd-ease);
}

.dmp-settings-button:hover:not(:disabled),
.dmp-settings-open {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-settings-button:focus-visible:not([data-selection-focus]) {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-settings-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.dmp-settings-icon {
  flex: 0 0 auto;
}

.dmp-menu {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(320px, calc(100vw - 32px));
  max-height: min(420px, calc(100vh - 96px));
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: var(--zmd-radius-well);
  box-shadow: var(--zmd-elevation);
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

.dmp-menu [class*='material'] {
  background: var(--zmd-menu);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.dmp-menu > :not([class*='material']) {
  position: relative;
  z-index: 1;
}

.dmp-card {
  width: min(520px, calc(100vw - 32px));
  height: min(420px, calc(100vh - 96px));
  max-height: min(420px, calc(100vh - 96px));
}

.dmp-card-head {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: 0;
  padding: 6px 10px 6px 12px;
  border-bottom: 0.5px solid var(--zmd-line);
}

.dmp-card-body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  min-height: 0;
}

.dmp-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: 168px;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
  scroll-snap-type: y proximity;
  scroll-padding-block: 4px;
  border-right: 0.5px solid var(--zmd-line);
}

.dmp-rail-row {
  position: relative;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--zmd-radius-control);
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font: inherit;
  font-family: var(--zmd-font);
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-rail-row:hover:not(:disabled),
.dmp-rail-row:focus-visible {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-rail-row[aria-selected='true'],
.dmp-rail-row[aria-selected='true']:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-rail-row[aria-current='true']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--zmd-accent);
}

.dmp-rail-row[aria-selected='true'] .dmp-rail-name,
.dmp-rail-row[aria-current='true'] .dmp-rail-name {
  font-weight: 500;
  color: var(--zmd-ink);
}

.dmp-rail-row:disabled {
  opacity: 0.4;
  cursor: default;
}

.dmp-rail-copy {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1 1 auto;
  min-width: 0;
}

.dmp-rail-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-provider-count {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.dmp-provider-failed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.dmp-provider-failed-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--zmd-danger);
}

.dmp-models {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin-left: 168px;
  padding: 4px 12px 0;
}

.dmp-status,
.dmp-empty {
  padding: 8px 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmp-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dmp-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 20px 0;
  text-align: left;
}

.dmp-empty-icon {
  color: var(--zmd-ink-mute);
}

.dmp-error,
.dmp-warning {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0 2px;
  padding: 8px 10px;
  border: 0.5px solid var(--zmd-line-control);
  border-radius: var(--zmd-radius-control);
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-error-icon {
  flex: 0 0 14px;
  margin-top: 2px;
  color: var(--zmd-danger);
}

.dmp-retry {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-retry:hover {
  background: var(--zmd-hover);
}

.dmp-card-head .dmp-search {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 96px;
  height: 30px;
  padding: 0 28px 0 10px;
  border: 0.5px solid var(--zmd-line-control);
  border-radius: var(--zmd-radius-control);
  background: var(--zmd-field);
  transition: border-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-card-head .dmp-search:focus-within {
  border-color: var(--zmd-accent);
}

.dmp-card-head .dmp-search input {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 13px;
  line-height: 20px;
}

.dmp-card-head .dmp-search input::placeholder {
  color: var(--zmd-ink-dim);
}

.dmp-search-clear {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink-mute);
  font-family: var(--zmd-font);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-search-clear:hover,
.dmp-search-clear:focus-visible {
  outline: none;
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-legend {
  display: grid;
  grid-template-columns:
    var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
  flex: 0 0 auto;
  align-items: center;
  justify-content: end;
  gap: var(--dmp-col-gap);
  padding: 2px calc(var(--dmp-row-pad-x) + 20px) 6px 0;
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.dmp-legend span {
  text-align: center;
}

.dmp-groups {
  min-height: 0;
  overflow-y: auto;
  scroll-padding-top: 22px;
}

.dmp-groups > [data-menu-group] + [data-menu-group] {
  margin-top: 2px;
}

.dmp-groups [data-menu-group-heading] {
  display: block;
  padding: 4px 7px 2px;
  border: 0;
  background: transparent;
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.dmp-groups [data-menu-group-heading][data-stuck] {
  background: var(--dsw-alias-menu-group-header-fill);
  border-radius: var(--zmd-radius-control);
}

.dmp-row {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 100%;
  min-height: 34px;
  padding: 6px var(--dmp-row-pad-x);
  border: 0;
  border-radius: var(--zmd-radius-control);
  outline: none;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font);
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-row:hover:not([aria-disabled='true']):not(:disabled),
.dmp-row:focus-visible,
.dmp-row[data-active]:not([aria-disabled='true']) {
  background: var(--zmd-hover);
}

.dmp-row[aria-checked='true'] {
  background: var(--zmd-hover);
}

.dmp-row[aria-checked='true'] .dmp-row-name {
  font-weight: 500;
}

.dmp-row[aria-disabled='true'],
.dmp-row:disabled {
  opacity: 0.4;
  cursor: default;
}

.dmp-row-copy {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dmp-row-name {
  flex: 1 1 auto;
  min-width: 48px;
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-badges {
  display: grid;
  grid-template-columns:
    var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
  flex: 0 0 auto;
  align-items: center;
  gap: var(--dmp-col-gap);
}

.dmp-badge-slot {
  min-width: 0;
}

.dmp-badges .dmp-badge {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 3px;
  min-height: 16px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.dmp-badge-fact {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

.dmp-badge-icon {
  display: block;
  flex: 0 0 auto;
  color: var(--zmd-ink-caption);
}

.dmp-badge-value {
  max-width: 47px;
  overflow: hidden;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.dmp-check {
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--zmd-ink);
}

.dmp-check svg {
  width: 14px;
  height: 14px;
}

.dmp-filter-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0 2px;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmp-filter-clear {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-family: var(--zmd-font);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-filter-clear:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmp-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  flex: 0 0 auto;
  min-width: 0;
  padding: 8px 14px;
  border-top: 0.5px solid var(--zmd-line);
  color: var(--zmd-ink-mute);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.dmp-card-foot-note {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-card-foot-providers {
  flex: 0 0 auto;
  white-space: nowrap;
}

.dmp-card-foot-providers:empty {
  display: none;
}

.dmp-settings {
  width: min(300px, calc(100vw - 32px));
  max-height: min(460px, calc(100vh - 96px));
  overflow: hidden;
}

.dmp-settings:focus-visible {
  outline: none;
}

.dmp-settings-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  flex: 0 0 auto;
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--zmd-line);
  text-align: left;
}

.dmp-settings-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-provider {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 14px;
  overflow-y: auto;
}

.dmp-settings-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmp-settings-readout {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.dmp-settings-readout .zmd-label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-value {
  flex: 0 1 auto;
  margin-left: auto;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-value[data-empty] {
  color: var(--zmd-ink-secondary);
  font-weight: 400;
}

.dmp-settings-source {
  flex: 0 0 auto;
  min-width: 88px;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  white-space: nowrap;
}

.dmp-settings-readout[data-no-value] .dmp-settings-source {
  margin-left: auto;
}

.dmp-settings-toggles {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 28px;
}

.dmp-settings-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dmp-settings-toggle-name {
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
}

.dmp-settings-notice {
  padding: 10px 14px 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-alert-icon {
  flex: 0 0 12px;
  margin-top: 2px;
  color: var(--zmd-danger);
}

.dmp-settings-error {
  margin: 0;
  color: var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  text-wrap: pretty;
}

.dmp-settings .dmp-settings-switch {
  box-sizing: border-box;
  flex: 0 0 auto;
  align-self: center;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--zmd-line-strong);
  color: var(--zmd-ink-caption);
  cursor: pointer;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] {
  background: var(--zmd-fill-primary);
  color: var(--zmd-on-primary);
}

.dmp-settings .dmp-settings-switch > span {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--dsw-alias-switch-thumb);
  transition: transform var(--zmd-fast) var(--zmd-ease);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] > span {
  background: var(--zmd-on-primary);
  transform: translateX(16px);
}

.dmp-settings .dmp-settings-switch:disabled {
  opacity: 0.5;
  cursor: default;
}

.dmp-settings-field {
  display: flex;
  width: 100%;
  min-width: 0;
}

.dmp-settings-field > input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.dmp-settings-field > input[aria-invalid='true'] {
  border-color: var(--zmd-danger);
}

.dmp-settings-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  box-sizing: border-box;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 8px 14px;
  border-top: 0.5px solid var(--zmd-line);
}

.dmp-settings-hint {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-effort-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dmp-effort-scale,
.dmp-context-presets {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.dmp-effort-scale {
  row-gap: 4px;
}

.dmp-effort-default {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.dmp-effort-hint {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmp-effort-item,
.dmp-context-preset {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  width: auto;
  min-height: 28px;
  padding: 2px 10px;
  border: 0;
  border-radius: var(--zmd-radius-compact);
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font);
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background-color var(--zmd-fast) var(--zmd-ease);
}

.dmp-effort-item:hover:not(:disabled),
.dmp-effort-item:focus-visible,
.dmp-context-preset:hover:not(:disabled),
.dmp-context-preset:focus-visible {
  background: var(--zmd-hover);
}

.dmp-effort-item[aria-checked='true'],
.dmp-context-preset[aria-pressed='true'] {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
  font-weight: 500;
}

.dmp-effort-item:disabled,
.dmp-context-preset:disabled {
  opacity: 0.4;
  cursor: default;
}

.dmp-effort-item[aria-disabled='true'] {
  cursor: default;
}

.dmp-root .dmp-trigger:focus-visible,
.dmp-root .dmp-settings-button:focus-visible,
.dmp-menu .dmp-rail-row:focus-visible,
.dmp-menu .dmp-row:focus-visible,
.dmp-menu .dmp-effort-item:focus-visible,
.dmp-menu .dmp-context-preset:focus-visible,
.dmp-menu .dmp-search-clear:focus-visible,
.dmp-menu .dmp-retry:focus-visible,
.dmp-menu .dmp-filter-clear:focus-visible,
.dmp-menu .dmp-settings-switch:focus-visible {
  outline: var(--zmd-focus-width) solid var(--zmd-focus);
  outline-offset: 2px;
}

@media (max-width: 536px) {
  .dmp-card {
    height: auto;
    max-height: min(560px, calc(100vh - 96px));
  }

  .dmp-card-head .dmp-search {
    min-width: 72px;
    height: 28px;
    padding-right: 26px;
  }

  .dmp-card-body {
    flex-direction: column;
    min-height: 0;
  }

  .dmp-rail {
    position: static;
    flex: 0 0 auto;
    flex-direction: row;
    width: auto;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px;
    border-right: 0;
    border-bottom: 0.5px solid var(--zmd-line);
  }

  .dmp-models {
    margin-left: 0;
    padding: 6px 12px 0;
  }

  .dmp-rail-row {
    width: auto;
    flex: 0 0 auto;
    padding: 4px 10px;
  }

  .dmp-rail-copy {
    flex: 0 0 auto;
  }

  .dmp-rail-name {
    flex: 0 0 auto;
    max-width: 132px;
  }
}

@media (max-width: 480px) {
  .dmp-menu {
    width: calc(100vw - 24px);
  }

  .dmp-settings {
    width: calc(100vw - 24px);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .dmp-groups {
    scroll-behavior: smooth;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dmp-trigger,
  .dmp-settings-button,
  .dmp-row,
  .dmp-rail-row,
  .dmp-effort-item,
  .dmp-context-preset,
  .dmp-search-clear,
  .dmp-retry,
  .dmp-filter-clear,
  .dmp-settings-switch,
  .dmp-settings-switch > span,
  .dmp-card-head .dmp-search,
  .dmp-chevron {
    transition: none;
  }
}
`

export function injectStyles(): () => void {
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

export const STYLESHEET = CSS
