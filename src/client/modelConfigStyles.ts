/**
 * 「模型配置」页的样式表，每次挂载注入一次。
 *
 * THE DIRECTION IS MONOCHROME INK (docs/ink-design-language.md §6.4), NOT A HUD.
 * The first pass of this round was an Endfield-style console and the user rejected
 * it: this is a software surface, not a game HUD. What survives is the structure
 * the earlier pass proved — one ledger line per route, a settings well as a form,
 * a 48px scan line, two-digit ordinals, right-aligned answer words, one 1px rule
 * weight — expressed in ink and paper: a neutral near-black and paper ground, the
 * host's own information blue as the ONLY accent (graphics/focus/selection only,
 * never text), a local wash + grain on the page head, and no yellow, field codes,
 * display numerals, corner cuts or wipes.
 *
 * WHAT THIS SHEET KEEPS, unchanged: the interaction contract (one row = one route,
 * one door that opens the settings well, the catalog as the row's disclosure, one
 * modal — the host's), the ARIA hooks, the focus chain, and the width budgets
 * (560 / 484 / 106 content columns). Class names are unchanged except for the HUD
 * decorations that were deleted with the direction.
 *
 * THE STATE LADDER is still the only colour event in the list: nothing at ready;
 * the 4px danger rail for missing-key / unreachable; the answer word in the
 * primary ink for those two, the secondary ink otherwise. The accent never paints
 * text (3.91:1 on the light ground); error never paints text either.
 *
 * WHY THE HEAD IS A BAND. The page opens on one sentence — the live thing that
 * counts the rows below it and is re-keyed on its own text — on a locally washed
 * surface carrying a faint grain. The wash and grain are material, not
 * information: the sentence sits on its own layer and is measured against both
 * ends of the wash. A single 1px line closes the band; the ledger's own rules do
 * the rest.
 *
 * @module dsh-rabbit-model-picker/client/modelConfigStyles
 */

/** Id of the owned style element (stable, so re-activation replaces it). */
export const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-model-config-styles'

/** The stylesheet. */
const CSS = `
/* THE PAGE IS THE QUERY CONTAINER. This section is rendered inside the host
   settings panel, which hands it about 484-560px at any desktop viewport and only
   106px at a 390px viewport — so a viewport media query can never see the width the
   layout actually has. Every narrow branch below asks THIS element through
   @container. */
.dmc-page {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* One narrow column, left-aligned: this section lives in someone else's settings
     panel, so it aligns with that panel rather than centring itself. */
  max-width: 560px;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 13px;
  line-height: 20px;
}

/* THE BOX MODEL IS STATED, NOT ASSUMED: the host gives this plugin no global
   border-box, and a control's height and padding are written as one number. */
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

/* THE HEAD: one sentence on a washed band, closed by one hairline.
   The wash and the grain arrive from the shared primitives (the element carries
   .zmd-wash and .zmd-grain); this rule owns the band's geometry only, and lifts
   the sentence above the grain overlay so the texture never sits on the text. */
.dmc-head {
  position: relative;
  padding: 18px 16px 16px;
  border-bottom: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
}

.dmc-head > * {
  position: relative;
  z-index: 1;
}

/* THE LIVE SENTENCE, and the page's only loud line: 20px/500, the host's language
   for a heading that is a sentence. It counts the rows below it (same readingOf),
   keeps tabular figures so a recount does not reflow, and lands with a 160ms
   transform-only step replayed by keying the node on its own text. No fade. */
.dmc-readout {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
  color: var(--zmd-ink);
  font-variant-numeric: tabular-nums;
  text-wrap: pretty;
  animation: dmc-readout-landing 160ms ease-out;
}

/* The first-run hint is the page's only guidance when nothing can serve, so it
   carries the primary ink. It is a sentence: no banner, no capsule, no fill. */
.dmc-empty {
  margin: 0;
  max-width: 62ch;
  color: var(--zmd-ink);
}

.dmc-notice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* A text action inside a notice: the underline is the affordance, and the accent
   (host blue) is allowed as a GRAPHIC — the blue never becomes the word's ink. */
.dmc-notice-action {
  margin-left: 8px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: text-decoration-color 120ms ease-out;
}

.dmc-notice-action:hover {
  text-decoration-color: var(--zmd-accent);
}

/* The read-only alert: a 4px danger bar (a graphic, where the state colour clears
   3:1) beside a sentence in the primary ink. */
.dmc-alert {
  margin: 0;
  padding: 2px 0 2px 12px;
  border-left: 4px solid var(--zmd-danger);
  color: var(--zmd-ink);
}

.dmc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

/* THE ADD ENTRY: a plain text action at the page's foot. No bar, no mark, no fill
   at rest; the pointer gets the quiet hover ground and the accent underline. */
.dmc-add {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
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
  background: var(--zmd-hover);
  text-decoration-color: var(--zmd-accent);
}

.dmc-add:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-add:disabled {
  color: var(--zmd-ink-secondary);
  text-decoration-color: transparent;
  cursor: default;
}

/* The add picker: the catalog entries the page does NOT list, disclosed by the
   one add entry. An inline disclosure, never a floating layer. */
.dmc-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dmc-picker-list {
  display: flex;
  flex-direction: column;
  /* The measured deployment offers 38 entries; the list scrolls rather than
     pushing the section's one action a screen and a half down. */
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
  padding: 0 12px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out;
}

.dmc-picker-item:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-picker-item:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* THE LEDGER: one 1px rule between entries and one under the last, so the routes
   read as one table. The expanded region of a row lives inside that row's li, so
   it stays inside its own line. */
.dmc-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  list-style: none;
}

/* THE LEDGER LINE. One row is one route, on one 48px line:
     rail | ordinal · name + route | model count | answer word | door
   The tracks are shared by every row and the two right-hand cells are right
   aligned, so their edges coincide down the list. No fill at rest; the only fills
   are positional (hover / focus / the row whose catalog or well is open). */
.dmc-row {
  display: grid;
  grid-template-columns: 4px minmax(120px, 1fr) max-content max-content 44px;
  column-gap: 12px;
  align-items: center;
  min-height: 48px;
  padding: 0;
  border-top: 1px solid var(--zmd-line); /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  color: var(--zmd-ink);
}

.dmc-row:hover,
.dmc-row:focus-within,
.dmc-row[data-catalog='true'],
.dmc-row[data-well='true'] {
  background: var(--zmd-hover);
}

/* The rail: 4px, the list's one state channel. It is drawn only for the ONE fact
   it means — this provider cannot serve a request — and left empty everywhere
   else. The error colour is a bar, never a word. */
.dmc-rail {
  grid-column: 1;
  grid-row: 1 / -1;
  align-self: stretch;
  width: 4px;
  background: transparent;
}

.dmc-rail[data-state='missing-key'],
.dmc-rail[data-state='unreachable'] {
  background: var(--zmd-danger);
}

/* Left end: the ordinal and the identity share one flex line inside the name's
   own grid track, so the mark can never be separated from the name by a gap. */
.dmc-name {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

/* The two-digit ordinal of a countable list: 10px mute ink, tabular, aligned on
   the name's baseline. It is decoration over the real order, so it is aria-hidden
   in the markup. */
.dmc-index {
  flex: none;
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  color: var(--zmd-ink-mute);
  font-variant-numeric: tabular-nums;
}

.dmc-route {
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

/* The model cell: a FACT and the door to the catalog region that curates it. A
   text action — no box, no fill at rest — told apart by its pointer, hover ground
   and accent underline. */
.dmc-catalog {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  height: 28px;
  padding: 0 4px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, text-decoration-color 120ms ease-out, transform 80ms linear;
}

.dmc-catalog:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
  text-decoration-color: var(--zmd-accent);
}

.dmc-catalog:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-catalog:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* The row's answer, as ONE word, right-aligned on its own track. The ink carries
   the loudness: a ready row states its word quietly, the two states that need the
   reader state it in the primary ink. The rail is the redundant channel. */
.dmc-verdict {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
  /* The 12px left padding keeps the answer from reading as the tail of the model
     cell beside it (默认 已登录); right-alignment is unaffected. */
  padding-left: 12px;
  font-size: 13px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  color: var(--zmd-ink-secondary);
  text-wrap: pretty;
  transition: color 160ms ease-out;
  animation: dmc-verdict-landing 160ms ease-out;
}

.dmc-verdict[data-state='missing-key'],
.dmc-verdict[data-state='unreachable'] {
  color: var(--zmd-ink);
}

/* The row's one door: a word, not a chevron. Hover gives it the quiet ground and
   the accent underline; the accent never becomes the word's ink. */
.dmc-manage {
  grid-column: 5;
  grid-row: 1;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: pointer;
  transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out, transform 80ms linear;
}

.dmc-manage:hover {
  background: var(--zmd-hover);
  text-decoration-color: var(--zmd-accent);
}

.dmc-manage:active {
  transform: translateY(1px);
}

.dmc-manage:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* The in-flight word under the scan line: a write can be in flight ON a row whose
   well is also open (the well's controls are merely disabled), so it takes a line
   of its own instead of overlaying a control. */
.dmc-pending {
  grid-column: 2 / -1;
  grid-row: 2;
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* THE SETTINGS WELL: the row's controls as a FORM.
   Three labelled fields on one label column (凭据 / API 协议 / 自动重试), a
   structural line, then the lifecycle entry. It is a DIRECT CHILD of the row, so
   opening it never re-flows the line above. The fill is one step below the panel
   ground; the 1px edge is structure, not a control border. Labels are single-line
   Chinese — the ink direction has no field codes. */
.dmc-well {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 8px;
  align-items: center;
  margin: 2px 0 14px;
  padding: 12px 14px 14px;
  background: var(--zmd-panel-deep);
  border: 1px solid var(--zmd-line);
}

/* The diagnostic sentence. Primary ink with a 4px danger bar (the bar is a graphic,
   where the state colour clears 3:1); the sentence itself is never painted in the
   error colour. It sits at the top of the well, where the write happened. */
.dmc-diagnostic {
  grid-column: 1 / -1;
  margin: 0;
  padding: 2px 0 4px 10px;
  border-left: 4px solid var(--zmd-danger);
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink);
  overflow-wrap: anywhere;
}

.dmc-field-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-field-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--zmd-ink);
}

/* A value that is stated, not acted on (已配置 / 使用默认值 / 由账号提供). */
.dmc-quiet {
  color: var(--zmd-ink-secondary);
}

/* The structural rule above the lifecycle entry: one 1px line across the well. */
.dmc-well-rule {
  grid-column: 1 / -1;
  height: 1px; /* taste-skill-ignore: 1px structural line; docs/ink-design-language.md section 4 makes the hairline the only structural tool, and these are table/form rules */
  margin: 4px 0 0;
  background: var(--zmd-line);
}

/* THE ROW'S TASK ENTRIES. A text action's word is its affordance: primary ink at
   rest, the pointer's quiet ground on hover, the secondary ink only when the
   deployment cannot write. */
.dmc-key-action {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

/* The open credential field is a real form field: it keeps the control-colour
   1px edge and the host's own input fill. */
input.dmc-key-action {
  flex: 1 1 160px;
  width: 100%;
  padding: 0 8px;
  border: 1px solid var(--zmd-line-control);
  background: var(--dsw-specific-input-major);
  color: var(--zmd-ink);
}

.dmc-key-action::placeholder {
  color: var(--zmd-ink-secondary);
}

.dmc-key-action:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-key-action:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-key-action:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

.dmc-key-clear {
  flex: none;
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

.dmc-key-clear:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-ink);
}

.dmc-key-clear:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-key-clear:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* A real form field keeps its edge: without it the choice reads as static text,
   and the retry sheet already recorded the regression that removing it caused. */
.dmc-protocol {
  min-width: 176px;
  max-width: 100%;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--zmd-line-control); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt */
  border-radius: 0;
  background: var(--dsw-specific-input-major);
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
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

/* The retry field's action: 修改, not 自动重试 (the field is already named). */
.dmc-retry-action {
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-retry-action:hover {
  background: var(--zmd-hover);
}

.dmc-retry-action:active {
  transform: translateY(1px);
}

/* The lifecycle entry: destructive, not a provider value, so it sits under the
   well's structural line without a field label. Its ink ladder is the page's. */
.dmc-danger {
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-danger:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.dmc-danger:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-danger:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

/* THE INLINE AUTO-RETRY EDITOR: a stack of short lines under the field line that
   opened it. The schedule is stated as words and two numbers (the doubling rule,
   the first wait, the longest total); the 5-slot tick bar below restates the same
   real curve as a grey scale — filled slots in mute ink, unfilled slots as
   baseline marks in the structure line. No chart, no hue. */
.dmc-retry {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 2px 0 4px;
}

.dmc-retry-state {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--zmd-ink);
}

/* The two fields sit side by side and wrap only when the container is brutal. */
.dmc-retry-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 16px;
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
  line-height: 16px;
  color: var(--zmd-ink-secondary);
}

.dmc-retry-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* THE PAGE'S SECOND REAL FORM CONTROL: the same control-colour 1px edge as the
   protocol field, the host's own input fill, tabular figures. */
.dmc-retry-input {
  width: 64px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--zmd-line-control); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt */
  border-radius: 0;
  background: var(--dsw-specific-input-major);
  color: var(--zmd-ink);
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* A rejected draft marks the FIELD, not only the sentence under it — a graphic-only
   use of the danger colour. No text is painted in it. */
.dmc-retry-input[aria-invalid='true'] {
  border-color: var(--zmd-danger);
}

.dmc-retry-input:disabled {
  color: var(--zmd-ink-secondary);
  cursor: default;
}

.dmc-retry-unit {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* The schedule in one line: the count as an 18px numeral, its unit beside it, then
   the two ends of the schedule. Tabular so a digit change never reflows. */
.dmc-retry-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  margin: 0;
  color: var(--zmd-ink-secondary);
  font-variant-numeric: tabular-nums;
}

.dmc-retry-tally {
  font-family: var(--zmd-font-latin);
  font-size: 18px;
  line-height: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--zmd-ink);
}

.dmc-retry-tally-unit {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

.dmc-retry-detail {
  font-size: 12px;
  line-height: 18px;
  color: var(--zmd-ink-secondary);
}

/* THE BACKOFF SCALE: five slots. The first five waits the policy spends fill the
   slots in curve order (four height tiers by the waits' own proportions); slots the
   policy does not spend stay as a 2px baseline mark in the structure line. Every
   filled cell is a real wait from retryWaitCurve; the scale is aria-hidden because
   the summary beside it states the same schedule in words. Grey only. */
.dmc-backoff {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 20px;
}

.dmc-backoff-cell {
  width: 8px;
  background: var(--zmd-ink-mute);
  transform-origin: 50% 100%;
  animation: dmc-backoff-rise 160ms var(--zmd-ease) both;
}

.dmc-backoff-cell[data-level='0'] {
  height: 2px;
  background: var(--zmd-line);
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

/* The landing voices and the scale's rise: transform-only, replayed by remounting
   (React keys the node on the value it states), never by a scroll trigger. */
@keyframes dmc-verdict-landing {
  from { transform: translateY(2px); }
}

@keyframes dmc-readout-landing {
  from { transform: translateY(2px); }
}

@keyframes dmc-backoff-rise {
  from { transform: scaleY(0.35); }
}

/* Every focusable control, one ring, in the host's blue. */
.dmc-add:focus-visible,
.dmc-notice-action:focus-visible,
.dmc-key-action:focus-visible,
.dmc-key-clear:focus-visible,
.dmc-protocol:focus-visible,
.dmc-catalog:focus-visible,
.dmc-manage:focus-visible,
.dmc-danger:focus-visible,
.dmc-retry-action:focus-visible,
.dmc-retry-input:focus-visible,
.dmc-picker-item:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 2px;
}

/* NARROW CONTAINER, asked of the CONTAINER and not of the window (see .dmc-page).
   The breakpoint semantics are the frozen 560 / 484 / <=360; this direction adds no
   decoration that needs to stand down, so 484 only tightens, and 360 is the phone
   column (ordered, no overflow, 40px targets) with the ordinals dropped. */
@container (max-width: 560px) {
  .dmc-row {
    column-gap: 8px;
  }

  .dmc-head {
    padding: 16px 12px 14px;
  }

  .dmc-well {
    column-gap: 10px;
  }

  /* The select keeps its CONTENT width rather than stretching: a form field that
     spans the whole well reads as the page's main control. It may still shrink. */
  .dmc-protocol {
    width: auto;
    max-width: 100%;
  }

  .dmc-picker-item {
    min-height: 44px;
  }
}

@container (max-width: 484px) {
  .dmc-well {
    grid-template-columns: 56px minmax(0, 1fr);
    column-gap: 8px;
  }
}

/* The phone column the host hands this section (measured: 106px at a 390px
   viewport). Everything stacks into the one surviving track, so nothing can be
   pushed out of the container; the rail still spans the row, the ordinals stand
   down, and every clickable target stays at least 40px. */
@container (max-width: 360px) {
  .dmc-row {
    grid-template-columns: 4px minmax(0, 1fr);
    grid-template-rows: auto auto auto auto auto auto;
    row-gap: 2px;
  }

  .dmc-index {
    display: none;
  }

  .dmc-head {
    padding: 12px 10px 10px;
  }

  .dmc-name {
    grid-column: 2;
    grid-row: 1;
    text-wrap: pretty;
  }

  .dmc-verdict {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .dmc-catalog {
    grid-column: 2;
    grid-row: 3;
    justify-self: start;
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
    grid-column: 2;
    grid-row: 6;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 2px;
    padding: 10px 12px 12px;
  }

  .dmc-diagnostic,
  .dmc-retry {
    grid-column: 1;
  }

  .dmc-protocol {
    width: 100%;
    min-width: 0;
  }

  /* The two number fields take the surviving column instead of their 64px shape. */
  .dmc-retry-field {
    flex: 1 1 100%;
  }

  .dmc-retry-input {
    width: 100%;
  }

  .dmc-backoff {
    gap: 3px;
    height: 18px;
  }

  /* THE THUMB BRANCH: every control may grow to 40px without costing density. */
  .dmc-key-action,
  .dmc-key-clear,
  .dmc-catalog,
  .dmc-manage,
  .dmc-danger,
  .dmc-retry-action,
  .dmc-notice-action {
    min-height: 40px;
  }

  .dmc-protocol,
  .dmc-retry-input {
    height: 40px;
  }

  .dmc-readout {
    text-wrap: pretty;
  }

  .dmc-add {
    flex: none;
    max-width: 100%;
    text-wrap: pretty;
  }
}

/* With motion reduced every transition and animation is off; the content stays. */
@media (prefers-reduced-motion: reduce) {
  .dmc-add,
  .dmc-key-action,
  .dmc-key-clear,
  .dmc-catalog,
  .dmc-manage,
  .dmc-danger,
  .dmc-picker-item,
  .dmc-verdict,
  .dmc-readout,
  .dmc-retry-action,
  .dmc-backoff-cell {
    transition: none;
    animation: none;
  }

  .dmc-add:active:not(:disabled),
  .dmc-key-action:active:not(:disabled),
  .dmc-key-clear:active:not(:disabled),
  .dmc-catalog:active:not(:disabled),
  .dmc-manage:active,
  .dmc-danger:active:not(:disabled),
  .dmc-retry-action:active {
    transform: none;
  }
}
`

/**
 * Create (or replace) the model configuration page's style element.
 * @returns the disposer removing exactly the element this call created.
 */
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

/** The stylesheet text, exported for the static selfcheck. */
export const MODEL_CONFIG_STYLESHEET = CSS
