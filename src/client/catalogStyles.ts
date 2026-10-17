/**
 * 模型目录区的样式表，每次激活注入一次。
 *
 * THE DIRECTION IS MONOCHROME INK (docs/ink-design-language.md §6.4). The region
 * used to be a right-side drawer; it has been the provider row's inline disclosure
 * since the earlier pass, and the ink direction keeps that shape: a block in the
 * page's content column, sharing the page's scroll, with no fixed position, no
 * scrim, no second modal. What changed with the direction is the material: the
 * panel is a locally washed surface with a faint paper grain (both from the shared
 * primitives) behind its content, bounded by ONE 1px line; every control is a word;
 * the only colour is the host's own information blue, used as a graphic (the
 * checked box's fill, the focus ring, hover underlines) and never as text.
 *
 * WHAT THIS SHEET KEEPS: the roster grammar (one line per model, the editor in the
 * well under it), the discovery three-step flow, the collapse guard, the ARIA
 * hooks and the focus chain, the width budgets, and the narrow branches asked of
 * the page's @container (560 / 484 / <=360).
 *
 * WHAT IT DELETED with the direction: field codes, the big count, the signal bars,
 * the corner cuts, the wash-less flat panel, and the yellow box. Selection is a
 * fill; structure is a hairline; the accent appears only where the pointer or the
 * state actually is.
 *
 * @module dsh-rabbit-model-picker/client/catalogStyles
 */

/** Id of the owned style element (stable, so re-activation replaces it). */
const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-catalog-styles'

/** The stylesheet. */
const CSS = `
/* THE BOX MODEL IS STATED, NOT ASSUMED: the host gives this plugin no global
   border-box, and controls written with a height and a padding are one number. */
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

/* THE REGION IS A BLOCK (§6.4), not an overlay. A direct child of the provider
   row's grid, so it starts at the name's spine and shares the page's content
   column and scroll. The element carries .zmd-wash + .zmd-grain: the surface has a
   local tonal wash and a faint paper grain, and its content sits on its own layer
   above the grain. No fixed position, no scrim, no shadow, no radius. */
.dmc-catalog-panel {
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  margin: 2px 0 14px;
  padding: 12px 14px 14px;
  border: 1px solid var(--zmd-line);
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 13px;
  line-height: 20px;
}

.dmc-catalog-panel > * {
  position: relative;
  z-index: 1;
}

/* The head: the region's name, its state and a normal count, with the one folding
   action at the end. A 1px line under it makes the head a masthead rather than a
   first row. No field code, no display numeral. */
.dmc-catalog-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
}

.dmc-catalog-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.dmc-catalog-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--zmd-ink);
  white-space: nowrap;
}

.dmc-catalog-status {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
}

/* A normal count, not a display numeral: 12px tabular in the secondary ink, on the
   head's baseline. */
.dmc-roster-count {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
}

/* --- controls -------------------------------------------------------------
   Every action is a WORD, not a box: no border, no fill at rest, no radius, no
   shadow. It is told apart from static text by its cursor, its hover ground and
   its focus ring. FULL INK WHILE IT CAN ACT, QUIET INK WHEN IT CANNOT. */
.dmc-btn {
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-btn:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-btn:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* The commit words ("保存" / "添加所选"): told apart by WEIGHT, not by a fill. */
.dmc-btn-commit {
  font-weight: 600;
  color: var(--zmd-ink);
}

.dmc-catalog-close {
  flex: none;
}

.dmc-catalog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.dmc-catalog-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
}

/* The collapse guard: a LINE in the region, not a dialog. A 4px danger bar (a
   graphic) beside a sentence in the primary ink; the two answers are words. */
.dmc-catalog-guard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0 2px 12px;
  border-left: 4px solid var(--zmd-danger);
}

.dmc-catalog-guard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* --- prose ---------------------------------------------------------------- */

.dmc-catalog-section {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--zmd-ink);
}

.dmc-catalog-notice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* The Host's own diagnostic, printed verbatim. Emphatic by weight, not by colour:
   the error colour is a mark here, never an ink. */
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

/* --- the catalog: a roster, one line per model ---------------------------- */

/* THE ROSTER (§6.4). A model is a RECORD: line one is the position mark, the id
   and its one door; line two is the display name and the two capacity facts
   (right-aligned, tabular); everything editable lives in the well the door opens.
   The 1px rules between rows are the page's ledger grammar one level down. */
.dmc-model-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  list-style: none;
}

.dmc-model-row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  min-height: 44px;
  padding: 10px 0;
  border-top: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  color: var(--zmd-ink);
}

/* Positional and momentary, never a persistent fact. */
.dmc-model-row:hover,
.dmc-model-row:focus-within,
.dmc-model-row[data-well='true'] {
  background: var(--zmd-hover);
}

/* A row whose draft cannot be written carries the page's 4px danger rail. */
.dmc-model-row[data-invalid='true']::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: var(--zmd-danger);
}

/* The roster position mark: decoration over the draft array's real order. */
.dmc-model-index {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
}

/* The id is the record's identity, in the technical face: one line, ellipsis for a
   long id, the title attribute keeps the whole string reachable. */
.dmc-model-ref {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--zmd-font-latin);
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--zmd-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The facts line: display name on the left, capacity facts on the right edge — a
   column of tabular numbers down the roster. */
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
  color: var(--zmd-ink-secondary);
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
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The row's one door, parked against the region's right edge. */
.dmc-model-edit {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out, transform 80ms linear;
}

.dmc-model-edit:hover {
  background: var(--zmd-hover);
  text-decoration-color: var(--zmd-accent);
}

.dmc-model-edit:active {
  transform: translateY(1px);
}

/* THE WELL, one level down: an inner --zmd-panel-deep bay inside the roster. */
.dmc-model-well {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  margin: 4px 0 2px;
  padding: 10px 12px 12px;
  background: var(--zmd-panel-deep);
  border: 1px solid var(--zmd-line);
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
  gap: 4px;
  min-width: 0;
}

.dmc-model-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--zmd-ink-secondary);
}

/* Fields keep a real edge, in the token layer's control colour: a control is told
   apart from a label by its edge (the house rules exempt form fields). */
.dmc-model-input,
.dmc-reasoning-value,
.dmc-reasoning-level,
.dmc-discover-search {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: var(--dsw-specific-input-major);
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
}

.dmc-model-input::placeholder,
.dmc-reasoning-value::placeholder,
.dmc-discover-search::placeholder {
  color: var(--zmd-ink-secondary);
}

.dmc-model-input[data-invalid='true'] {
  border-color: var(--zmd-danger);
}

.dmc-model-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

/* The remove entry: the well's last line, away from the fields. */
.dmc-model-danger {
  align-self: flex-start;
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-model-danger:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-model-danger:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-model-danger:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* The roster's add entry: one text action under the last model. No bar, no mark. */
.dmc-model-add {
  align-self: stretch;
  height: 40px;
  padding: 0 6px;
  border-radius: 0;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out;
}

.dmc-model-add:hover:not(:disabled) {
  background: var(--zmd-hover);
  text-decoration-color: var(--zmd-accent);
}

/* --- reasoning levels ----------------------------------------------------- */

.dmc-reasoning {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.dmc-reasoning-add,
.dmc-reasoning-remove {
  flex: none;
}

.dmc-reasoning-add {
  align-self: flex-start;
}

.dmc-reasoning-help {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* --- discovery: the three-step flow --------------------------------------- */

.dmc-discover-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* The fetch entry, the adopt entry and the checklist tools keep their own width;
   the status sentence beside them is the only flexible thing on the line. */
.dmc-discover,
.dmc-discover-adopt,
.dmc-discover-tool {
  flex: none;
}

.dmc-discover-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* The checklist's own control row: the count leads it, because the count is what
   the reader is choosing from. It does not pin; the page is the scrolling surface. */
.dmc-discover-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* The one bounded scroll region in the region. */
.dmc-discover-list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

/* A group heading in the checklist: quieter than the ids beneath it, tabular, no
   rule — the separation is rhythm. */
.dmc-discover-group {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dmc-discover-candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 2px;
  border-top: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  color: var(--zmd-ink);
}

/* A candidate whose id the catalog already declares cannot be adopted: the
   existing entry wins by contract, so the row falls back to the secondary ink. */
.dmc-discover-candidate[data-present='true'] {
  color: var(--zmd-ink-secondary);
}

/* The box and the id are one label, so the id is the control's accessible name. */
.dmc-discover-label {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* THE SQUARE CHECKBOX. A native checkbox brings a rounded, platform-scaled glyph
   into a sheet whose grammar is right angles. Unchecked is a 1px control edge;
   checked is the host's blue as a FILL with the check in --zmd-on-accent (the
   only pairing allowed on the accent); the disabled/present state is the line
   colour with no mark. The tick settles with a 160ms scale, off under reduced
   motion. */
.dmc-discover-check {
  flex: none;
  display: inline-grid;
  place-content: center;
  width: 16px;
  height: 16px;
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
  height: 8px;
  transform: translateY(-1px) rotate(45deg);
}

.dmc-discover-check:checked {
  border-color: var(--zmd-accent);
  background: var(--zmd-accent);
}

.dmc-discover-check:checked::after {
  display: block;
  border-right: 2px solid var(--zmd-on-accent);
  border-bottom: 2px solid var(--zmd-on-accent);
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

/* The id renders in whatever ink its row states, so one rule can quiet the whole
   row (the data-present hook) without a second selector reaching into it. */
.dmc-discover-id {
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.dmc-discover-name {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  color: var(--zmd-ink-secondary);
  overflow-wrap: anywhere;
}

/* --- focus and motion ----------------------------------------------------- */

/* Every focusable control, one ring, in the host's blue. */
.dmc-btn:focus-visible,
.dmc-model-edit:focus-visible,
.dmc-model-danger:focus-visible,
.dmc-discover-check:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 2px;
}

.dmc-model-input:focus-visible,
.dmc-reasoning-value:focus-visible,
.dmc-reasoning-level:focus-visible,
.dmc-discover-search:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: -1px;
}

/* --- narrow and reduced motion -------------------------------------------- */

/* The page is the query container, and this region lives inside it, so the narrow
   branches ask the same container the page's rows do. */
@container (max-width: 560px) {
  .dmc-catalog-panel {
    gap: 12px;
    padding: 10px 12px 12px;
  }

  .dmc-model-row {
    column-gap: 8px;
  }
}

@container (max-width: 484px) {
  .dmc-catalog-head {
    flex-wrap: wrap;
  }
}

/* At the phone column the field and level grids stack, every target grows to a
   thumb's size, and the roster's position marks stand down with the page's own. */
@container (max-width: 360px) {
  .dmc-catalog-panel {
    grid-column: 2;
    gap: 10px;
    padding: 10px;
  }

  .dmc-catalog-head {
    flex-wrap: wrap;
  }

  .dmc-roster-count {
    display: none;
  }

  .dmc-btn {
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

  .dmc-model-well {
    padding: 8px 10px 10px;
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

/* With motion reduced, the check does not scale in and controls do not settle. */
@media (prefers-reduced-motion: reduce) {
  .dmc-btn {
    transition: none;
  }

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

/**
 * Create (or replace) the catalog region's style element.
 * @returns the disposer removing exactly the element this call created.
 */
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

/** The stylesheet text, exported for the static selfcheck. */
export const CATALOG_STYLESHEET = CSS
