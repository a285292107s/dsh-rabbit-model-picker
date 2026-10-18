
const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-styles'

const CSS = `
.dmp-root {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
  --dmp-margin: 26px;
  --dmp-col-icon: 14px;
  --dmp-col-window: 47px;
  --dmp-col-gap: 8px;
  --dmp-row-pad-x: 6px;
  --dmp-badge-budget: 113px;
  --dmp-name-budget: 175px;
}

.dmp-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 220px;
  max-width: min(360px, 45cqw);
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease), transform 80ms var(--dmp-ease);
}

.dmp-trigger:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-trigger:active:not(:disabled) {
  transform: translateY(1px);
}

.dmp-trigger:focus-visible:not([data-selection-focus]) {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-trigger:disabled {
  color: var(--dsw-alias-label-dimmed);
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
  font-size: 12px;
  line-height: 18px;
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
  transition: transform 140ms var(--dmp-ease);
}

.dmp-chevron-open {
  transform: rotate(180deg);
}

.dmp-trigger-open {
  background: var(--zmd-panel-deep);
  color: var(--zmd-ink);
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
  border: 1px solid var(--zmd-line);
  border-radius: 0;
  outline: none;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font-latin);
  cursor: pointer;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease), border-color 120ms var(--dmp-ease), transform 80ms var(--dmp-ease);
}

.dmp-settings-button:active:not(:disabled) {
  transform: translateY(1px);
}

.dmp-settings-button:hover:not(:disabled) {
  border-color: var(--zmd-line-strong);
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmp-settings-button:focus-visible:not([data-selection-focus]) {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-settings-button:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-settings-open {
  border-color: var(--zmd-line-strong);
  background: var(--zmd-panel-deep);
  color: var(--zmd-ink);
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
  border-radius: 0;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
  --dmp-col-icon: 14px;
  --dmp-col-window: 47px;
  --dmp-col-gap: 8px;
  --dmp-row-pad-x: 6px;
}

.dmp-menu [class*='material'] {
  background: transparent;
  border-radius: 0;
  backdrop-filter: none;
}

.dmp-menu > :not([class*='material']) {
  position: relative;
  z-index: 1;
}

.dmp-menu::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  border: 1px solid var(--zmd-line-strong);
  pointer-events: none;
}

/* The card is a FIXED panel, not a balloon. Its height is set once and stays put, so
   switching provider (4 models vs 13) does not resize the surface under the pointer, and
   the footer never moves. Overflow is the panes' job: the rail scrolls in its own column and
   the model list scrolls inside the payload. */
.dmp-card {
  width: min(520px, calc(100vw - 32px));
  height: min(420px, calc(100vh - 96px));
  max-height: min(420px, calc(100vh - 96px));
}

.dmp-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
  padding: 14px 14px 11px;
  border-bottom: 1px solid var(--zmd-line);
}

.dmp-card-identity {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.dmp-card-name {
  margin: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 24px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-card-sub {
  overflow: hidden;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-card-count {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The PAYLOAD sizes the card, the index scrolls inside it. As two flex siblings each pane
   contributed its own content height, so a ten-row provider rail made the card ~100px taller
   than the model list it frames — and that surplus showed up as undrawn pane under the last
   row, above the footer. Taking the rail out of flow makes the model list the only thing that
   can make the card taller; the rail keeps its own scrollbar. */
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
  gap: 1px;
  width: 176px;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
  scroll-snap-type: y proximity;
  scroll-padding-block: 6px;
  border-right: 1px solid var(--zmd-line);
  /* The rail scrolls inside a card the model list sizes, so it is routinely cut off. A short
     fade at its foot states "there is more" where a half-drawn row would read as a defect. */
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 18px), transparent 100%);
}

.dmp-rail-row {
  position: relative;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 30px;
  padding: 0 10px 0 14px;
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-family: var(--zmd-font-latin);
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--dmp-ease);
}

.dmp-rail-index {
  flex: 0 0 var(--dmp-margin);
  color: var(--zmd-ink-mute);
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.dmp-rail-row:hover:not(:disabled),
.dmp-rail-row:focus-visible {
  background: var(--zmd-hover);
}

.dmp-rail-row[aria-selected='true'],
.dmp-rail-row[aria-selected='true']:hover:not(:disabled) {
  background: var(--zmd-panel-deep);
}

.dmp-rail-row[aria-current='true']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  width: 0;
  border-left: 2px solid var(--zmd-accent);
}

.dmp-rail-row[aria-selected='true']:not([aria-current='true']) {
  box-shadow: inset 0 0 0 1px var(--zmd-line-strong);
}

.dmp-rail-row[aria-selected='true'] .dmp-rail-index {
  color: var(--zmd-ink-secondary);
}

.dmp-rail-row:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-rail-row[aria-current='true'] .dmp-rail-name,
.dmp-rail-row[aria-selected='true'] .dmp-rail-name {
  font-weight: 500;
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
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
}

.dmp-provider-count {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.dmp-provider-failed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.dmp-provider-failed-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  background: var(--zmd-danger);
}

.dmp-models {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin-left: 176px;
  padding: 8px 12px 0;
}

.dmp-status,
.dmp-empty {
  padding: 8px 0;
  color: var(--zmd-ink-secondary);
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
  padding: 6px 0 6px 10px;
  border-left: 2px solid var(--zmd-danger);
  border-radius: 0;
  background: transparent;
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
  padding: 0;
  border: none;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

.dmp-retry:hover {
  text-decoration: underline;
  text-decoration-color: var(--zmd-accent);
  text-underline-offset: 4px;
}

.dmp-search-row {
  position: relative;
  flex-shrink: 0;
  margin: 0 0 8px;
}

.dmp-search-row .dmp-search {
  display: flex;
  height: 32px;
  padding: 0 30px 0 0;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  transition: border-color 120ms var(--dmp-ease);
}

.dmp-search-row .dmp-search:focus-within {
  border-bottom-color: var(--zmd-accent);
  outline: 0;
}

.dmp-search-row .dmp-search-with-query {
  padding-right: 30px;
}

.dmp-search-row .dmp-search input {
  padding: 0;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 20px;
}

.dmp-search-row .dmp-search input::placeholder {
  color: var(--zmd-ink-mute);
}

.dmp-search-clear {
  position: absolute;
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms var(--dmp-ease);
}

.dmp-search-clear:hover,
.dmp-search-clear:focus-visible {
  outline: none;
  background: var(--zmd-hover);
}

.dmp-card-key {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 12px;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmp-card-key-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.dmp-card-key-icon {
  display: block;
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  color: var(--zmd-ink-mute);
}

.dmp-groups {
  min-height: 0;
  overflow-y: auto;
  scroll-padding-top: 26px;
}

.dmp-groups > [data-menu-group] + [data-menu-group] {
  margin-top: 6px;
}

.dmp-groups [data-menu-group-heading] {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 14px 0 4px;
}

.dmp-groups [data-menu-group-heading]::after {
  content: '';
  flex: 1 1 auto;
  min-width: 8px;
  height: 1px;
  background: var(--zmd-line);
}

.dmp-row {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 100%;
  min-height: 38px;
  padding: 5px var(--dmp-row-pad-x) 5px calc(var(--dmp-row-pad-x) + 2px);
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: var(--zmd-font-latin);
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease);
}

.dmp-row:hover:not([aria-disabled='true']):not(:disabled),
.dmp-row:focus-visible,
.dmp-row[data-active]:not([aria-disabled='true']) {
  background: var(--zmd-hover);
}

.dmp-row[aria-checked='true'] {
  background: var(--zmd-panel-deep);
}

.dmp-row[aria-checked='true']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 0;
  border-left: 2px solid var(--zmd-accent);
}

.dmp-row[aria-disabled='true'],
.dmp-row:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-row-copy {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.dmp-row-name {
  flex: 1 1 auto;
  min-width: 48px;
  overflow: hidden;
  color: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-row[aria-checked='true'] .dmp-row-name {
  font-weight: 500;
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
  gap: 3px;
  min-height: 22px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
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
  color: var(--zmd-ink-mute);
}

.dmp-badge-value {
  max-width: 64px;
  overflow: hidden;
  color: var(--zmd-ink-secondary);
  font-family: var(--zmd-font-latin);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.dmp-check {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--zmd-ink);
}

@keyframes dmp-check-in {
  from { transform: scale(0.6); }
  to { transform: none; }
}

.dmp-check svg {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  animation: dmp-check-in 160ms var(--dmp-ease);
}

.dmp-check[data-on],
.dmp-effort-check[data-on] {
  background: var(--zmd-ink);
  color: var(--zmd-on-ink);
}

.dmp-check[data-on] svg,
.dmp-effort-check[data-on] svg {
  width: 9px;
  height: 9px;
}

.dmp-filter-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0 2px;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-filter-clear {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

.dmp-filter-clear:hover:not(:disabled) {
  text-decoration: underline;
  text-decoration-color: var(--zmd-accent);
  text-underline-offset: 4px;
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
  border-top: 1px solid var(--zmd-line);
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
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
  padding-left: 10px;
  border-left: 1px solid var(--zmd-line);
  white-space: nowrap;
}

.dmp-card-foot-providers:empty {
  display: none;
}

.dmp-card-foot-keys {
  flex: 0 0 auto;
  padding-left: 10px;
  border-left: 1px solid var(--zmd-line);
  color: var(--zmd-ink-mute);
  white-space: nowrap;
}

.dmp-settings {
  width: min(280px, calc(100vw - 32px));
  max-height: min(460px, calc(100vh - 96px));
  overflow: hidden;
}

.dmp-settings:focus-visible {
  outline: none;
}

.dmp-settings-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex: 0 0 auto;
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--zmd-line);
}

.dmp-settings-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 24px;
  line-height: 30px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-reset {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

.dmp-settings-reset:hover:not(:disabled) {
  text-decoration: underline;
  text-decoration-color: var(--zmd-accent);
  text-underline-offset: 4px;
}

.dmp-settings-reset:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-settings-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex: 0 0 auto;
  padding: 8px 12px;
  border-top: 1px solid var(--zmd-line);
}

.dmp-settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 12px 12px;
  overflow-y: auto;
}

.dmp-settings-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dmp-settings-label {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dmp-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
}

.dmp-settings-name {
  min-width: 0;
  color: var(--zmd-ink);
  font-size: 14px;
  line-height: 22px;
}

.dmp-settings-hint {
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-notice {
  padding: 0 12px;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 12px 0;
  padding: 6px 0 6px 10px;
  border-left: 2px solid var(--zmd-danger);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-alert-icon {
  flex: 0 0 12px;
  margin-top: 2px;
  color: var(--zmd-danger);
}

.dmp-settings-target {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 2px;
  border-top: 1px solid var(--zmd-line);
}

.dmp-settings-target-label {
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-target-value {
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.dmp-settings .dmp-settings-switch {
  box-sizing: border-box;
  flex: 0 0 auto;
  align-self: center;
  width: 34px;
  height: 20px;
  padding: 3px;
  border: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink-mute);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] {
  border-color: var(--zmd-ink);
  background: transparent;
  color: var(--zmd-ink);
}

.dmp-settings .dmp-settings-switch > span {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 0;
  background: currentColor;
  transition: transform 120ms var(--dmp-ease), background-color 120ms var(--dmp-ease), margin-left 120ms var(--dmp-ease);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] > span {
  margin-left: 14px;
}

.dmp-settings-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  transition: border-color 120ms var(--dmp-ease);
}

.dmp-settings-input:focus-within {
  border-bottom-color: var(--zmd-accent);
  outline: 0;
}

.dmp-settings-input input {
  width: 100%;
  padding: 0;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

.dmp-settings-input input::placeholder {
  color: var(--zmd-ink-mute);
}

.dmp-settings-input-bad {
  border-bottom-color: var(--zmd-danger);
}

.dmp-settings-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--zmd-line);
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-settings-note-icon {
  flex: 0 0 12px;
  margin-top: 3px;
  color: var(--zmd-ink-mute);
}

.dmp-effort-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.dmp-effort-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  padding: 4px 4px 4px 8px;
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease);
}

.dmp-effort-item:hover:not(:disabled),
.dmp-effort-item:focus-visible {
  background: var(--zmd-hover);
}

.dmp-effort-item[aria-checked='true'] {
  background: var(--zmd-panel-deep);
}

.dmp-effort-item[aria-checked='true']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 0;
  border-left: 2px solid var(--zmd-accent);
}

.dmp-effort-item:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-effort-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-effort-check {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--zmd-ink);
}

.dmp-effort-check svg {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  animation: dmp-check-in 160ms var(--dmp-ease);
}

@media (max-width: 536px) {
  /* Narrow: the panes are stacked, so a fixed height leaves a void under a short list.
     The card instead fits its content up to a ceiling — the head, the rail strip, the
     payload and the foot — and the payload scrolls once the ceiling is reached. */
  .dmp-card {
    height: auto;
    max-height: min(560px, calc(100vh - 96px));
  }

  .dmp-card-body {
    flex-direction: column;
    min-height: 0;
  }

  /* Below the two-pane breakpoint the rail is a horizontal strip ABOVE the payload again, so
     it returns to flow: the absolute placement exists only to let the list size the card. */
  .dmp-rail {
    position: static;
    flex: 0 0 auto;
    flex-direction: row;
    width: auto;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px 0;
    border-right: none;
    border-bottom: 1px solid var(--zmd-line);
  }

  .dmp-models {
    margin-left: 0;
  }

  .dmp-rail-row {
    width: auto;
    flex: 0 0 auto;
    padding: 0 10px 0 8px;
  }

  .dmp-rail-index {
    flex: 0 0 auto;
    width: auto;
  }

  .dmp-rail-copy {
    flex: 0 0 auto;
  }

  .dmp-rail-name {
    flex: 0 0 auto;
    max-width: 132px;
  }

  .dmp-models {
    padding: 10px 12px 0;
  }

  /* A keyboard hint has no meaning on a touch-width card, and it was taking the line the
     count needed: at 390 the footer note was ellipsized. The binding stays live; the note goes. */
  .dmp-card-foot-keys {
    display: none;
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
  .dmp-search-clear,
  .dmp-retry,
  .dmp-filter-clear,
  .dmp-settings-reset,
  .dmp-search-row .dmp-search,
  .dmp-settings-input,
  .dmp-settings .dmp-settings-switch > span {
    transition: none;
  }

  .dmp-trigger:active:not(:disabled),
  .dmp-settings-button:active:not(:disabled) {
    transform: none;
  }

  .dmp-chevron {
    transition: none;
  }

  .dmp-check svg,
  .dmp-effort-check svg {
    animation: none;
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
