/**
 * The plugin's stylesheet, injected once per activation.
 *
 * An out-of-repo plugin has no build-time CSS-module pipeline, so the sheet is
 * a single owned `<style>` element created in `apply` and removed by its
 * disposer. Every class name is `dmp-`-prefixed and global; the static
 * selfcheck cross-checks the sheet and the TSX against each other so a dead
 * rule or a typo'd class cannot ship silently.
 *
 * MATERIAL. The three surfaces wear the ink language from
 * `docs/ink-design-language.md`: neutral paper/ink panels, one hairline weight,
 * a local wash + grain so a floating surface reads as material, right-angled
 * corners, and ONE accent — the host's own information blue — reserved for
 * "you are here / click here" (the session bar, the checked mark, the focus
 * ring, the edited route). Everything else is ink: `--zmd-panel` /
 * `--zmd-panel-deep` / `--zmd-hover` for surfaces, `--zmd-line*` for structure,
 * `--zmd-ink*` for words. There is no display face, no field code, no corner
 * cut, no sweep and no yellow.
 *
 * TOKENS. Own values come from `designSystem.ts` (`--zmd-*`); host semantic
 * values stay `--dsw-*` where a host primitive paints the text (the Tag value,
 * the Input's own field material, the scrollbar aliases). The two
 * `--dsh-composer-model-*` display variables are the composer's narrow-row
 * contract and are consumed exactly as the incumbent seat consumes them.
 *
 * MOTION. One decelerating curve (`--dmp-ease`): hover fills 120ms, press
 * translateY(1px) 80ms, the selection mark settles with a 160ms scale. Nothing
 * fades, nothing sweeps in; every motion is turned off under
 * `prefers-reduced-motion`.
 *
 * @module dsh-rabbit-model-picker/client/styles
 */

/** Id of the owned style element (stable, so re-activation replaces it). */
const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-styles'

/** The stylesheet. */
const CSS = `
.dmp-root {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  /* One motion voice for the whole seat: a decelerating curve that starts fast
     and settles, shared by every hover and press below. The portaled cards are
     NOT descendants of this element, so .dmp-menu states it too. */
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
}

/* --- the seat's controls ---------------------------------------------------
   The trigger names the identity (provider/model · effort) in the embedded
   Latin face at 13/400 — the width contract in front of it is unchanged. The
   ink language gives it no mark of its own: state is a surface tone (hover) and
   an open surface (panel-deep) plus the chevron's turn. */
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
  color: var(--dsw-alias-label-secondary);
  font-family: var(--zmd-font-latin);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease), transform 80ms var(--dmp-ease);
}

.dmp-trigger:hover:not(:disabled) {
  background: var(--zmd-hover);
}

/* Press: the control yields by one notch and returns on release. A transform,
   so the composer's layout never reflows under the pointer. */
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

/* The composer measures expanded row demand and owns this display variable;
   this seat only consumes it. Outside a composer the trigger keeps its text,
   and the icon stays hidden. */
.dmp-trigger-label {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The effort in force, shown beside the name as its own segment. It is TEXT, so
   it carries readable ink rather than the chevron's caption grey; the middot is
   a CSS ::before so it adds no DOM node and no accessible-name text. */
.dmp-trigger-effort {
  display: var(--dsh-composer-model-text-display, inline);
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
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

/* While the model card is up, the control that owns it reads as held down. */
.dmp-trigger-open {
  background: var(--zmd-panel-deep);
}

/* The parameter gear: the trigger's right-hand companion. It is an icon-only
   control, so the composer's narrow-row variables do not apply to it. A route
   with a record turns its 1px edge to the one accent — a graphic change, which
   is the accent's only job. */
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

.dmp-settings-button[data-edited] {
  border-color: var(--zmd-accent);
}

.dmp-settings-open {
  border-color: var(--zmd-line-strong);
  background: var(--zmd-panel-deep);
  color: var(--zmd-ink);
}

/* The gear's own mark: it must never shrink in a cramped composer row. */
.dmp-settings-icon {
  flex: 0 0 auto;
}

/* --- the card material ----------------------------------------------------
   Portaled to body and placed from the trigger rect, so the sidebar and the
   columns' overflow clips cannot crop the card. border-box keeps the OUTER
   width inside the design budget (padding included).

   This is the shared MATERIAL of the two portaled surfaces. The ink surface
   carries .zmd-wash .zmd-grain (the local tonal wash + the paper grain); the
   host MenuSurface's own translucent film and blur would sit on top of that
   material, so they are neutralized here: the wash is the surface. The 1px
   boundary is drawn INSIDE the card so the constrained width budgets are not
   spent on a border. */
.dmp-menu {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(320px, calc(100vw - 32px));
  max-height: min(420px, calc(100vh - 96px));
  overflow: hidden;
  padding: 4px;
  border: 0;
  border-radius: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--zmd-font-latin);
  /* Elevated surface: the scrollbar thumb takes the l2 elevation tokens. */
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
  /* THE FACT GRID. The row's four facts are four fixed tracks, in BADGE_FACTS
     order, on every row whether or not the fact exists: one source for the
     widths, so the columns line up across rows and a missing fact shows as an
     empty track instead of shifting its neighbours.
        strip = icon + gap + icon + gap + icon + gap + window
              = 14 + 8 + 14 + 8 + 14 + 8 + 47 = 113px */
  --dmp-col-icon: 14px;
  --dmp-col-window: 47px;
  --dmp-col-gap: 8px;
  --dmp-row-pad-x: 7px;
}

/* The host's material layer is a translucent film with a blur. The ink surface
   paints its own wash, so the film is made transparent and unblurred rather
   than composited over it. */
.dmp-menu [class*='material'] {
  background: transparent;
  border-radius: 0;
  backdrop-filter: none;
}

/* The grain (.zmd-grain::after) must sit above the wash and below the words.
   MenuSurface inserts its own material child, so the content is lifted instead
   of the grain being pushed down: every child that is not that film takes the
   text layer. */
.dmp-menu.zmd-grain > :not([class*='material']) {
  position: relative;
  z-index: 1;
}

/* The one boundary: a 1px strong-line frame drawn inside the surface. */
.dmp-menu::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  border: 1px solid var(--zmd-line-strong);
  pointer-events: none;
}

/* THE TWO PANES: the provider rail on the left, the model list on the right.
   520px is the smallest width at which both panes can do their jobs — the model
   column must stay at least the 320px the four-track fact grid was budgeted
   against, and the rail's box needs 181px. Measured on the live GUI at that
   width: the model pane is 331px and the name column is 175px on every row. */
.dmp-card {
  flex-direction: row;
  align-items: stretch;
  width: min(520px, calc(100vw - 32px));
}

/* The rail is the left pane: every scope this catalog offers, the unfiltered one
   first. It scrolls on its own and it is separated from the list by 1px. */
.dmp-rail {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 0 0 176px;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 4px 2px 0;
  border-right: 1px solid var(--zmd-line);
}

/* One scope. It is a button because it is picked (click and keyboard), but a
   listbox OPTION in role: the selection it reports is a scope, not an action.
   The two facts a row carries ride on two different channels:
     - the SCOPE (aria-selected) = sunken fill + a 1px inset ring in the strong
       line ink. An inset ring rather than a border, so it costs no width; it
       does NOT reuse the model rows' check, because "the filter" and "the model
       in use" are different claims;
     - the SESSION (aria-current) = the 2px host-blue bar at the row's leading
       edge plus the heavier name. */
.dmp-rail-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 30px;
  padding: 0 4px;
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--dmp-ease);
}

/* The two-digit ordinal: quiet ink, tabular, decoration only. */
.dmp-rail-index {
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.dmp-rail-row:hover:not(:disabled),
.dmp-rail-row:focus-visible {
  background: var(--zmd-hover);
}

.dmp-rail-row[aria-selected='true'],
.dmp-rail-row[aria-selected='true']:hover:not(:disabled) {
  background: var(--zmd-panel-deep);
  /* The scope's one mark: a 1px inset ring in the strong line ink. Inset, so it
     costs no width and cannot shift the row's name column. */
  box-shadow: inset 0 0 0 1px var(--zmd-line-strong);
}

.dmp-rail-row[aria-current='true']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 0;
  border-left: 2px solid var(--zmd-accent);
}

.dmp-rail-row:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* The provider this conversation actually runs on. The rail has no room for the
   words 「当前会话」 beside a name and a count — and the fact is already spelled out
   beside the card by the seat's trigger — so the marker is a weight up plus the
   accent bar, with aria-current as its machine-readable half. */
.dmp-rail-row[aria-current='true'] .dmp-rail-name {
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
  font-size: 13px;
  line-height: 18px;
  font-weight: 400;
}

/* Trailing model count on a rail row. The count is the reason to pick one
   provider over another, so it reads in the same ink as the row. */
.dmp-provider-count {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

/* The "加载失败" mark on a rail row — the only thing on that row explaining why
   its models cannot be listed. The words take readable ink; the state is carried
   by a trailing red dot, which is decoration and owes no text ratio. */
.dmp-provider-failed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.dmp-provider-failed-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--zmd-danger);
}

/* The model pane: search, fact key, state lines and the list, stacked in the
   column beside the rail. min-width: 0 keeps a long model name from widening the
   card instead of ellipsizing inside its own column. */
.dmp-models {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding-left: 4px;
}

/* Status and empty copy are sentences a user is meant to read, not chrome. */
.dmp-status,
.dmp-empty {
  padding: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

/* The loading line carries the host's live dot in front of the sentence, so a
   slow catalog reads as "working" rather than as a dead label. */
.dmp-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* An empty result is a state, not a rendering accident: a quiet glyph over one
   sentence, centered, with air. */
.dmp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 8px;
  text-align: center;
}

.dmp-empty-icon {
  color: var(--zmd-ink-mute);
}

/* A load failure and a partial failure. The failure signal is the danger bar at
   the callout's leading edge plus the icon; the sentence keeps readable ink. */
.dmp-error,
.dmp-warning {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
  padding: 6px 7px;
  border-left: 4px solid var(--zmd-danger);
  border-radius: 0;
  background: var(--zmd-panel-deep);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
}

.dmp-error-icon {
  flex: 0 0 14px;
  margin-top: 1px;
  color: var(--zmd-danger);
}

.dmp-retry {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

/* --- THE SEARCH LINE ------------------------------------------------------
   A bottom-ruled field, not a box: the host Input still owns the text cell and
   its focus behaviour; the ink surface supplies the 1px control line, which
   turns accent-blue on focus with the 2px focus ring. */
.dmp-search-row {
  position: relative;
  flex-shrink: 0;
  margin: 4px 0 6px;
}

.dmp-search-row .dmp-search {
  display: flex;
  height: 30px;
  padding: 0 30px 0 8px;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  transition: border-color 120ms var(--dmp-ease);
}

.dmp-search-row .dmp-search:focus-within {
  border-bottom-color: var(--zmd-accent);
  outline: 2px solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-search-row .dmp-search-with-query {
  padding-right: 30px;
}

/* 13px, the row name's own size: the field that filters the list must not be the
   quietest line on the card. */
.dmp-search-row .dmp-search input {
  padding: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--zmd-font-latin);
  font-size: 13px;
  line-height: 18px;
}

/* The placeholder is the ONLY instruction the list gives, so it takes body ink. */
.dmp-search-row .dmp-search input::placeholder {
  color: var(--dsw-alias-label-secondary);
}

/* The clear button: a right-angled mark that only exists while there is a query
   to clear. It sits inside the field's own right padding. */
.dmp-search-clear {
  position: absolute;
  top: 50%;
  right: 2px;
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
  color: var(--zmd-ink-secondary);
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

/* THE FACT KEY. The four glyphs mean nothing to a first-time user, so the card
   names its columns once above the table. It is copy, not chrome, so it is not
   aria-hidden; the words are the columns' names in the order they are drawn. */
.dmp-legend {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 8px;
  border-top: 1px solid var(--zmd-line);
  border-bottom: 1px solid var(--zmd-line);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* The glyph's own box, the way .dmp-badge-fact holds it in a row, so the key's
   marks and the row's marks are the same thing at the same size. */
.dmp-legend-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

.dmp-legend-word {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
}

.dmp-groups {
  min-height: 0;
  overflow-y: auto;
  /* The pinned group heading is 24px tall and the viewport knows nothing about
     it: scroll-padding insets the scrollport so the browser keeps the row it is
     revealing clear of the band. */
  scroll-padding-top: 26px;
}

/* Groups are separated by air, not by the heading band alone. */
.dmp-groups > [data-menu-group] + [data-menu-group] {
  margin-top: 8px;
}

/* The pinned group heading: the list's ONLY landmark. Opaque --zmd-panel (not
   the host's translucent stuck fill) so rows passing under it cannot draw
   through it, with readable secondary ink and a 1px line under the band. */
.dmp-groups [data-menu-group-heading] {
  background: var(--zmd-panel);
  color: var(--dsw-alias-label-secondary);
  border-bottom: 1px solid var(--zmd-line);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  padding: 6px var(--dmp-row-pad-x) 2px;
}

/* The model row states facts instead of offering controls, and it keeps them on
   ONE line: the name shrinks with an ellipsis while the badge strip keeps its
   own width. Rows are separated by 1px; the selected row takes a sunken fill, a
   2px accent bar at its leading edge and the accent-checked mark. */
.dmp-row {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 100%;
  min-height: 38px;
  padding: 5px var(--dmp-row-pad-x);
  border: none;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease);
}

.dmp-row + .dmp-row {
  border-top: 1px solid var(--zmd-line);
}

/* The rows carry aria-disabled (the provider rows in the other card are real
   buttons and carry disabled); both spellings mean the same thing here. */
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

/* Name first, facts behind it, both on the row's single line: the name is the
   flexible half, the strip is the fixed half. Typographically the name is the
   row's TITLE (14/20 · 600). */
.dmp-row-copy {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.dmp-row-name {
  flex: 1 1 auto;
  /* The name is the row's elastic half: it takes whatever the four tracks do
     not need, and it is what ellipsizes when the composer is narrow. The 48px
     floor is the point below which a name stops identifying a model at all. */
  min-width: 48px;
  overflow: hidden;
  color: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The fact strip: one badge per fact, four fixed tracks. Nothing in here is a
   control — no hover, no focus ring, no cursor. */
.dmp-badges {
  display: grid;
  grid-template-columns:
    var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
  flex: 0 0 auto;
  align-items: center;
  gap: var(--dmp-col-gap);
}

/* An empty track. A fact this model does not state leaves its own column empty
   rather than pulling its neighbours left, so the columns agree row to row. */
.dmp-badge-slot {
  min-width: 0;
}

/* The badge is two cells on one baseline: the icon cell and the value. The
   primitive's own capsule frame is cleared — the glyph and the value ARE the
   badge, and the frame would be chrome around a fact. */
.dmp-badges .dmp-badge {
  gap: 3px;
  min-height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  font-weight: 400;
}

/* The icon cell: it states WHICH fact, and it is exactly the glyph's box. */
.dmp-badge-fact {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

/* The square technical glyph, in ink only: no colour carries a fact. */
.dmp-badge-icon {
  display: block;
  flex: 0 0 auto;
  color: var(--zmd-ink-mute);
}

/* A capacity is a value, so it reads in tabular figures. The cap keeps a long
   adapter level name from growing the strip until the window track is clipped. */
.dmp-badge-value {
  max-width: 64px;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--zmd-font-latin);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

/* The check's own 14px cell. position: relative anchors the accent square a
   selected mark paints behind the glyph; the glyph sits above it. */
.dmp-check {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-label-primary);
}

/* The check arrives only when a row becomes the checked one, so its entrance is
   the selection's own event: a small settle on the shared curve. */
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

/* THE SELECTION MARK: the accent square with the on-accent check sitting in it.
   The rail deliberately does not take it: its selected scope is a fill + inset
   ring (see .dmp-rail-row), because "the scope" and "the model in use" are two
   different claims. The mark is keyed on the check's own data-on hook rather
   than on the row's state, so it reads as a 14px mark rather than a row fill.
   The fill and its ink are stated together: every accent fill carries the
   on-accent ink, which is the only ink that may sit on the host blue. */
.dmp-check[data-on],
.dmp-effort-check[data-on] {
  background: var(--zmd-accent);
  color: var(--zmd-on-accent);
}

.dmp-check[data-on] svg,
.dmp-effort-check[data-on] svg {
  width: 9px;
  height: 9px;
}

/* "N more matches in other providers" strip: it explains why the list is short
   and carries the way back to every provider. */
.dmp-filter-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dmp-filter-clear {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

.dmp-filter-clear:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  text-decoration: underline;
  /* The one accent that may appear on a word without painting the word itself:
     the underline is a graphic, not the glyph ink (§5.1). */
  text-decoration-color: var(--zmd-accent);
  text-underline-offset: 4px;
}

/* --- the parameter panel --------------------------------------------------
   Same material as the model card, narrower (it carries labelled controls, not a
   list). The surface itself must NOT scroll: MenuSurface paints its own layer,
   so a scrolling surface would drag the fill up with the content. The scroll
   role belongs to the inner body below. */
.dmp-settings {
  width: min(280px, calc(100vw - 32px));
  max-height: min(460px, calc(100vh - 96px));
  overflow: hidden;
}

/* The card holds initial focus when it opens, so it needs a ring of its own. */
.dmp-settings:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: -2px;
}

/* The panel's scroll viewport: the head and the state line stay put, everything
   below them scrolls inside the card. min-height: 0 is what lets the flex item
   shrink below its content and actually become scrollable. Sections are
   separated by AIR (12px), not by rules. */
.dmp-settings-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 12px;
  min-height: 0;
  padding: 2px 0 6px;
  overflow-y: auto;
}

/* The panel's head: the model the whole panel is about, and the restore action. */
.dmp-settings-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 6px 10px;
  border-bottom: 1px solid var(--zmd-line);
}

.dmp-settings-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmp-settings-reset {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: color 120ms var(--dmp-ease);
}

.dmp-settings-reset:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  text-decoration: underline;
  /* Accent underline = the same "click here" graphic as the filtered-scope
     action; the word itself stays in ink. */
  text-decoration-color: var(--zmd-accent);
  text-underline-offset: 4px;
}

.dmp-settings-reset:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.dmp-settings-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 8px;
}

/* A section's title: its Chinese word and the hairline that closes the row. */
.dmp-settings-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.dmp-settings-label > .zmd-rule {
  flex: 1 1 auto;
}

.dmp-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
}

.dmp-settings-name {
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
}

.dmp-settings-hint {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

/* The panel's state line: why the controls above it are inert. It is rendered
   above the controls it qualifies, so the reason is read before the control. */
.dmp-settings-notice {
  padding: 6px 8px 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

/* What the settings service refused. The failure is carried by the danger bar,
   the warning icon and a sentence that says so; the sentence keeps readable
   secondary ink (the error red is under AA at this size). */
.dmp-settings-alert {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 8px 0;
  padding: 6px 7px;
  border-left: 4px solid var(--zmd-danger);
  border-radius: 0;
  background: var(--zmd-panel-deep);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

.dmp-settings-alert-icon {
  flex: 0 0 12px;
  margin-top: 2px;
  color: var(--zmd-danger);
}

/* The declaration this panel writes, so a reviewer can check the edit landed;
   the full namespace + path stays available in the title attribute. */
.dmp-settings-target {
  overflow: hidden;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The switch is the host's own control; only its skin is ours: a square track
   that is a 1px frame when off and a solid accent block when on, with a square
   block. Off = frame, on = host blue with the on-accent block. */
.dmp-settings .dmp-settings-switch {
  box-sizing: border-box;
  flex: 0 0 auto;
  align-self: center;
  width: 32px;
  height: 18px;
  padding: 2px;
  border: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink-mute);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] {
  border-color: var(--zmd-accent);
  background: var(--zmd-accent);
  color: var(--zmd-on-accent);
}

.dmp-settings .dmp-settings-switch > span {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 0;
  background: currentColor;
  transition: transform 120ms var(--dmp-ease), background-color 120ms var(--dmp-ease);
}

.dmp-settings .dmp-settings-switch[aria-checked='true'] > span {
  transform: translate(14px);
}

/* The capacity field: the underline IS the field. Focus turns the line to the
   accent and draws the 2px ring; an unreadable value turns it to the danger red. */
.dmp-settings-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 4px;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  transition: border-color 120ms var(--dmp-ease);
}

.dmp-settings-input:focus-within {
  border-bottom-color: var(--zmd-accent);
  outline: 2px solid var(--zmd-focus);
  outline-offset: 1px;
}

.dmp-settings-input input {
  width: 100%;
  padding: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.dmp-settings-input input::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.dmp-settings-input-bad {
  border-bottom-color: var(--zmd-danger);
}

/* What the panel writes and where the edits land — the one paragraph in the card
   with no control of its own. */
.dmp-settings-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

.dmp-settings-note-icon {
  flex: 0 0 12px;
  margin-top: 2px;
}

/* The effort choices: one 1px line per row. The chosen level takes the sunken
   fill, the 2px accent bar at its leading edge and the accent-checked mark. */
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
  min-height: 30px;
  padding: 4px 8px 4px 10px;
  border: none;
  border-bottom: 1px solid var(--zmd-line);
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 18px;
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
  color: var(--dsw-alias-label-primary);
}

.dmp-effort-check svg {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  animation: dmp-check-in 160ms var(--dmp-ease);
}

/* The two-pane card collapses into ONE column when the viewport can no longer
   hold both panes at their floors: the rail's 176px plus the 320px the model
   column needs, plus the card's own 4px of padding either side, means the panes
   stop fitting below a 505px card — and the card is 100vw - 32px below a 552px
   viewport, so 536px is where that happens.
   The rail becomes a horizontal strip ABOVE the list rather than disappearing:
   the scope stays visible and changeable at every width. Same DOM, same roles,
   same keys — only the card's flex direction changes. */
@media (max-width: 536px) {
  .dmp-card {
    flex-direction: column;
  }

  .dmp-rail {
    flex: 0 0 auto;
    flex-direction: row;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0 4px;
    border-right: none;
    border-bottom: 1px solid var(--zmd-line);
  }

  /* A row becomes a chip: it sizes to its own content instead of filling the
     pane, and the name stops being the elastic half. */
  .dmp-rail-row {
    width: auto;
    flex: 0 0 auto;
    padding: 0 8px;
  }

  .dmp-rail-copy {
    flex: 0 0 auto;
  }

  .dmp-rail-name {
    flex: 0 0 auto;
    max-width: 132px;
  }

  .dmp-models {
    padding-left: 0;
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

/* Keyboard cycling scrolls the highlight into view; smooth only when the user
   has not asked the system to calm down. */
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

/**
 * Create (or replace) this plugin's style element.
 * @returns the disposer removing exactly the element this call created.
 */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  // A hot-reloaded activation leaves the previous element behind; replacing it
  // keeps exactly one sheet per module revision.
  document.getElementById(STYLE_ELEMENT_ID)?.remove()
  const element = document.createElement('style')
  element.id = STYLE_ELEMENT_ID
  element.textContent = CSS
  document.head.append(element)
  return () => {
    if (element.isConnected) element.remove()
  }
}

/** The stylesheet text, exported for the static selfcheck. */
export const STYLESHEET = CSS
