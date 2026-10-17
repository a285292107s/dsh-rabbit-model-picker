/**
 * 「模型配置」页的样式表，每次挂载注入一次。
 *
 * WHY A THIRD SHEET, AND THE THIRD PREFIX. `styles.ts` owns the composer seat
 * (`dmp-`); this sheet owns the 模型配置 settings section and the drawer beside it
 * (`dmc-`) and shares a rule with neither, so it keeps the domains independently
 * checkable: the `dmc-` dead-class gate never has to know which TSX file a rule
 * belongs to. A fourth sheet used to own the retry CARD in the shipped Models
 * section; that card is deleted and its editor now opens inside this page's own
 * row wells, so this sheet absorbed the job (see the retry block near the end).
 *
 * THE UI LANGUAGE: A ROUTE LEDGER, NOT A CONTROL TABLE (2026-10-17, §5.35).
 * The page is a ledger of provider ROUTES, and a ledger is read by scanning one
 * line per entry. So a row states its three facts on ONE line — who it is
 * (name + route), what it holds (its own model count), and its answer (one word) —
 * and every control that changes it lives in the row's SETTINGS WELL, which opens
 * under the line from the row's one door. The previous sheet put five controls on
 * a second line of fixed tracks; at the settings panel's real 484px content column
 * the credential cell could not hold its own two words, wrapped to a second line,
 * and left the protocol select floating at a vertical centre of its own — the
 * measured row was 108px tall with four different text baselines in it.
 *
 * WHAT THE LANGUAGE FIXES, item by item:
 *   - one line, one route: the scan line is 44px at rest and holds no form control;
 *   - the well is a FORM: three labelled fields (凭据 / API 协议 / 自动重试) on one
 *     label column, so a value and its name can never drift apart;
 *   - alignment is shared, not per-row: name, model cell, answer word and door sit
 *     on the same four tracks in every row, and the answer word and door are
 *     right-aligned, so their right edges coincide across the list;
 *   - the destructive entry is behind the door, on the well's last line, away from
 *     the credential words it used to sit beside.
 *
 * THE STATE LADDER (unchanged from the §5.32 direction, and still the only colour
 * event in the list):
 *   - `ready`: nothing. No fill, no rail, and the answer word stays quiet.
 *   - `missing-key`: the rail + the word 缺密钥 in the primary ink. NO row fill.
 *   - `unreachable`: the rail + the word 不可用 + the row's only allowed fill.
 *   - a diagnostic: `data-error="true"` beside whatever answer the row states. It
 *     paints nothing on the row; its sentence is the first line of the row's well.
 *
 * WHAT THIS SHEET REFUSES TO DO, each a measured fact rather than a preference:
 *   - No hardcoded colour. Every paint is a host `--dsw-*` token, so the surface
 *     follows the host skin in both themes.
 *   - No `--dsw-alias-state-error-primary` / `-business-primary` as a TEXT colour:
 *     on the light theme they measure 4.4976:1 and 4.2349:1 against the ground,
 *     both under the 4.5:1 body bar. They are used as GRAPHICS only (the rail, the
 *     alert's 4px bar, the focus ring, the add entry's 4px bar).
 *   - No host layer-N background token as a separator: in the light theme all three
 *     resolve to the same white, so a divider built on them exists only in the dark
 *     theme. Row rhythm comes from the ledger's own line spacing.
 *   - No fading or blending, and no halo: quietness is the secondary ink, never a
 *     faded primary one (also a static gate).
 *   - `border-radius: 0` everywhere. Nothing on this page floats.
 *   - The page keeps exactly TWO 1px lines, and both are real form controls: the
 *     protocol select and the retry editor's number fields. The credential field is
 *     a text action that becomes a field when asked, and its open state is a well
 *     value rather than a bordered box.
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
  color: var(--dsw-alias-label-primary);
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
.dmc-retry-input {
  box-sizing: border-box;
}

.dmc-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* THE LEDGER'S BALANCE LINE, and the page's only large thing.
   It counts the rows below it, so the sentence and the list can never disagree —
   both are computed from the same reading of the store (see readingOf in
   ModelConfigPage.tsx). It is INDENTED TO THE NAME COLUMN (16px = the 4px rail
   plus the 12px gap), so the balance shares a left edge with the entries it
   counts instead of hanging at the panel's edge.
   Two decided properties: tabular-nums, so a recount does not reflow the line; and
   a 160ms TRANSFORM-only landing, replayed by keying the node on its own sentence.
   Nothing here fades (a static gate forbids opacity in this sheet). */
.dmc-readout {
  margin: 0 0 0 16px;
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  text-wrap: pretty;
  animation: dmc-readout-landing 160ms ease-out;
}

/* The first-run hint is the page's only guidance when nothing can serve, so it
   carries the primary ink. It is a sentence: no banner, no capsule, no fill. */
.dmc-empty {
  margin: 0;
  max-width: 62ch;
  color: var(--dsw-alias-label-primary);
}

.dmc-notice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.dmc-notice-action {
  margin-left: 8px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

/* The read-only alert borrows the page's own motif instead of inventing a second
   fill rung: a 4px bar in the state colour (a graphic, where the bar clears 3:1)
   beside a sentence in the primary ink. */
.dmc-alert {
  margin: 0;
  padding: 2px 0 2px 12px;
  border-left: 4px solid var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-label-primary);
}

.dmc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

/* The ledger's add entry, and the page's one accent.
   NOT a filled button: the theme has no "ink on accent" role, and the white a
   primary button pairs with the accent fill measures 4.2349:1 light / 2.3278:1
   dark — both under the 4.5:1 bar. The accent therefore carries the EDGE: a 4px
   left bar (a solid shape clears the 3:1 graphical bar at 4.2349:1 light /
   7.8343:1 dark) while the label keeps the primary ink at 17-19:1.
   The bar is the page's own bar language (the row rail is 4px too), and the two
   are deliberately different colours for different roles: red marks a state, blue
   marks the action. Padding-left 12 + the 4px bar puts the label at 16px, the same
   left edge every row's name sits on. */
.dmc-add {
  height: 40px;
  padding: 0 10px 0 12px;
  border: none;
  border-left: 4px solid var(--dsw-alias-state-business-primary);
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-wrap: pretty;
  cursor: pointer;
  transition: transform 80ms linear, background-color 120ms ease-out;
}

.dmc-add:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmc-add:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-add:disabled {
  /* The bar is kept at 4px and only recoloured: dropping it outright would shift
     the action the moment it became unavailable. */
  border-left-color: transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* The add picker: the catalog entries the page does NOT list, disclosed by the
   one add entry. It is an inline disclosure rather than a floating layer, because
   adding a provider is a step in this section's own task. */
.dmc-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dmc-picker-list {
  display: flex;
  flex-direction: column;
  /* The measured deployment offers 38 entries; the list scrolls rather than
     pushing the section's own action row a screen and a half down. */
  max-height: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

/* A dormant entry draws NOTHING for its state: being addable is not an error, so
   the only marker is the live fill under the pointer. The data-state hook stays
   for accessibility and for the state gate, not for paint. */
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
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out;
}

.dmc-picker-item:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmc-picker-item:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

.dmc-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* THE LEDGER LINE. One row is one route, on one line:
     rail | name + route | model count | answer word | door
   The four tracks are shared by every row, and the answer word and door are
   right-aligned, so their right edges coincide across the whole list. A row that
   omits the model cell (it never does) would still park its neighbours here.
   NO FILL AT REST — not even for a state that needs the reader. At eleven rows the
   WORD is the primary channel and the rail is the redundant second one; a third
   channel only made the page shout. The only fills are positional (hover / focus /
   the row whose drawer is open). */
.dmc-row {
  display: grid;
  grid-template-columns: 4px minmax(120px, 1fr) max-content max-content 44px;
  column-gap: 12px;
  align-items: center;
  min-height: 44px;
  padding: 10px 0;
  color: var(--dsw-alias-label-primary);
}

.dmc-row:hover,
.dmc-row:focus-within,
.dmc-row[data-open='true'],
.dmc-row[data-well='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* The rail: 4px, spanning the row's own lines. It is the list's scanning column,
   so it is drawn only for the ONE fact it means — this provider cannot serve a
   request — and left EMPTY everywhere else, including on a row that merely has a
   diagnostic. One rung, one meaning. */
.dmc-rail {
  grid-column: 1;
  grid-row: 1 / -1;
  align-self: stretch;
  width: 4px;
  background: transparent;
}

.dmc-rail[data-state='missing-key'],
.dmc-rail[data-state='unreachable'] {
  background: var(--dsw-alias-state-error-primary);
}

/* Left end: identity. The route id rides inside the name's own track, so the two
   can never be separated by a grid gap, and both wrap rather than push a neighbour
   out. */
.dmc-name {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

.dmc-route {
  margin-left: 8px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}

/* The model cell: a FACT and the door to the drawer that curates it. Right-aligned
   on its own track, so the counts form a column. Tabular figures keep a count
   change from reflowing the line; the noun is part of the value (a bare number in
   a settings list reads as a label waiting for its unit). */
.dmc-catalog {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  height: 28px;
  padding: 0 4px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

.dmc-catalog:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dmc-catalog:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-catalog:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* The row's answer, as ONE word, right-aligned. Its right edge is fixed by the
   grid, so the answers form a column down the list even though the words differ in
   width. The ink carries the loudness: a ready row states its word quietly, and
   the two states that need the reader state it in the primary ink. The rail is the
   redundant channel, never the first one. */
.dmc-verdict {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
  /* The 12px left padding is what keeps the answer from reading as the tail of the
     model cell beside it (默认 已登录): the grid gap alone put two quiet words in
     one breath. Right-alignment is unaffected — padding widens the column leftward. */
  padding-left: 12px;
  font-size: 13px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  text-wrap: pretty;
  transition: color 160ms ease-out;
  animation: dmc-verdict-landing 160ms ease-out;
}

.dmc-verdict[data-state='missing-key'],
.dmc-verdict[data-state='unreachable'] {
  color: var(--dsw-alias-label-primary);
}

/* The row's one door. A word, not a chevron: the page's whole control vocabulary
   is words, and a glyph would need a legend. It is the only control on the scan
   line besides the model cell's own door, and it opens the well under the line. */
.dmc-manage {
  grid-column: 5;
  grid-row: 1;
  justify-self: end;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

.dmc-manage:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmc-manage:active {
  transform: translateY(1px);
}

.dmc-manage:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* The in-flight word. It takes a line of its own under the scan line rather than a
   control's cell: a write can be in flight ON a row whose well is also open (the
   well's controls are merely disabled), and stacking it under the line keeps both
   readable instead of overlaying one on the other. */
.dmc-pending {
  grid-column: 2 / -1;
  grid-row: 2;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

/* THE SETTINGS WELL: the row's controls, as a FORM.
   Three labelled fields on one label column (凭据 / API 协议 / 自动重试) and the
   lifecycle entry last. It is a DIRECT CHILD of the row, under both segments of the
   scan line, so opening it never re-flows the line above. No fill, no edge and no
   radius of its own: the row's hover fill is its surface, which is why it must
   live inside .dmc-row.
   The label column is what makes this a form rather than a row of words: a value
   and its name can never drift apart, and the three values share one left edge. */
.dmc-well {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 8px;
  align-items: center;
  padding: 2px 0 12px;
}

/* The diagnostic sentence. Primary ink, never the red one: measured on the light
   theme the state colour is under the 4.5:1 body bar, while this pairing is
   17.39:1. It sits at the top of the well, where the write that produced it
   happened. */
.dmc-diagnostic {
  grid-column: 1 / -1;
  margin: 0;
  padding: 2px 0 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

.dmc-field-label {
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}

.dmc-field-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}

/* A value that is stated, not acted on (已配置 / 使用默认值 / 由账号提供). */
.dmc-quiet {
  color: var(--dsw-alias-label-secondary);
}

/* THE ROW'S TASK ENTRIES, and the ink ladder every de-chromed action shares: the
   word is the PRIMARY ink at rest, the live fill is the pointer's, and only a
   DISABLED action drops to the secondary ink. A deployment that cannot write
   (settings.writable === false) must not draw actions that look clickable; the de
   -chroming must not remove the only cue that distinguishes them.
   Both the button that opens the field and the field itself share this class, so
   the de-chroming is stated once. The open field is the only flexing member: it
   takes the rest of the value column so a key can be typed without the row growing
   a second line. */
.dmc-key-action {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

input.dmc-key-action {
  flex: 1 1 160px;
  width: 100%;
  padding: 0 8px;
  background: var(--dsw-specific-input-major);
}

.dmc-key-action::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.dmc-key-action:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dmc-key-action:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-key-action:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

.dmc-key-clear {
  flex: none;
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
}

.dmc-key-clear:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dmc-key-clear:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-key-clear:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* A real form field keeps its edge: without it the choice reads as static text,
   and the retry sheet already recorded the regression that removing it caused.
   The native option list is painted by the platform, so the two colours it needs
   are stated rather than inherited. */
.dmc-protocol {
  min-width: 176px;
  max-width: 100%;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l3); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt (the retry sheet recorded the regression that removing it caused) */
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.dmc-protocol:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

.dmc-protocol option {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

/* The retry field's action. It states 修改 rather than 自动重试 because the field is
   already named 自动重试 — an action that repeats its field's name makes the form
   read as two labels. */
.dmc-retry-action {
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-retry-action:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmc-retry-action:active {
  transform: translateY(1px);
}

/* The lifecycle entry. It is destructive and it is not one of the provider's
   values, so it carries no field label and sits on the well's last line. The ink
   ladder is the page's (primary at rest, secondary when the deployment cannot
   write); the destructive intent is carried by the word itself. */
.dmc-danger {
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-danger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-danger);
}

.dmc-danger:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-danger:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* THE INLINE AUTO-RETRY EDITOR: the deleted chart, restated as words.

   WHY THE BAR CHART IS GONE. The card this replaces drew every wait as a bar — a
   plot, one slot per retry, a cap mark, an axis. Measured against the reading it
   had to support ("how long will this provider make me wait, and how fast does the
   delay grow?"), those bars carried no exact value and their height meant nothing
   across rows: the chart was an illustration OF the two numbers beside it, not a
   second fact. The rhythm is now stated as words and figures:
     - the doubling rule as one sentence, which is the one thing the bar row showed
       only by eye;
     - the FIRST wait and the LONGEST TOTAL as tabular figures.
   The total is the HIGH bound of waitRange(waits, jitterRatio) and not the nominal
   sum: jitter moves every wait, so a line labelled 最长合计 must state the longest
   the schedule can run or the label is lying.

   THE FAMILY, top to bottom. The editor (.dmc-retry) is a stack of short lines, NOT
   a card: no fill, no edge, no radius. It is a direct child of .dmc-well and spans
   both of its columns, under the field line that opened it, so opening it never
   re-flows the controls above. Then: .dmc-retry-state says whether this provider
   has a policy of its own; .dmc-retry-fields holds one .dmc-retry-field per number
   (a .dmc-retry-label over a .dmc-retry-row of .dmc-retry-input + .dmc-retry-unit);
   .dmc-retry-summary is the one-line schedule; and .dmc-retry-actions reuses the
   page's own de-chromed action (.dmc-key-action) and notice line (.dmc-notice). No
   second button vocabulary is introduced. */
.dmc-retry {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 2px 0 4px;
}

/* The one fact the fields cannot state for themselves: whether editing them will
   write a new value or create one. It takes the primary ink because it answers the
   question the reader opened the editor with. */
.dmc-retry-state {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
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

/* A form label, not an eyebrow: it names the value under it, in the quieter ink,
   at the same 12px every other name on this page uses. */
.dmc-retry-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}

/* The value line: the number and its unit word, kept together so "5" can never
   read as a bare number without its noun. */
.dmc-retry-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* THE PAGE'S SECOND REAL FORM CONTROL — and the second, last 1px edge on it. It
   mirrors the drawer's catalog field: the same 1px --dsw-alias-border-l3 edge, the
   same --dsw-specific-input-major fill so the well reads as editable in both
   themes, the same 12px tabular figures. The width is fixed at about one three-
   digit number rather than elastic, because two fields of different sizes for the
   same kind of value would read as a layout accident. */
.dmc-retry-input {
  width: 64px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l3); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt (the deleted retry card recorded the regression that removing it caused) */
  border-radius: 0;
  background: var(--dsw-specific-input-major);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* A rejected draft marks the FIELD, not only the sentence under it — the same
   graphic-only use of the state colour as the drawer's invalid field. No text is
   painted in it, and the sentence still says what to type. */
.dmc-retry-input[aria-invalid='true'] {
  border-color: var(--dsw-alias-state-error-primary);
}

.dmc-retry-input:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

.dmc-retry-unit {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

/* The schedule in one line, tabular so a digit change never reflows it. */
.dmc-retry-summary {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.dmc-retry-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* The two landing voices: the row's answer word and the page's readout. Both are
   160ms and TRANSFORM-only — an opacity would be a fade, which this sheet's own
   static gate refuses — and both are replayed by remounting (React keys the node on
   the value it states), not by a scroll trigger. */
@keyframes dmc-verdict-landing {
  from { transform: translateY(2px); }
}

@keyframes dmc-readout-landing {
  from { transform: translateY(2px); }
}

/* Every focusable control, one ring. The host's own focus-ring token resolves to
   transparent in both themes, so the business colour is named directly instead of
   being reached through a fallback that would paint nothing. */
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
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

/* NARROW CONTAINER, asked of the CONTAINER and not of the window (see .dmc-page).

   The scan line keeps all four tracks and tightens only the gaps; the well narrows
   its column gap. NOTHING TALLER HAPPENS HERE: the panel's real narrow desktop width
   (484px at a 768px viewport) is still a mouse surface, and making every control
   40px tall there turned each row from 48px into 60px for no readability gain. The
   thumb-sized branch below is the one that is actually phone-shaped. */
@container (max-width: 520px) {
  .dmc-row {
    column-gap: 8px;
  }

  .dmc-well {
    grid-template-columns: 64px minmax(0, 1fr);
    column-gap: 8px;
  }

  /* The select keeps its CONTENT width rather than stretching: a form field that
     spans the whole well reads as the page's main control, and this one is a
     rarely-touched setting. It may still shrink to the container. */
  .dmc-protocol {
    width: auto;
    max-width: 100%;
  }

  .dmc-picker-item {
    min-height: 44px;
  }
}

/* The phone column the host actually hands this section (measured: 106px at a
   390px viewport). Everything stacks into the one surviving track, so nothing can
   be pushed out of the container, and the rail still spans the row.

   DEGRADING IN ORDER, not by accident. This width is an external constraint — an
   800px settings panel at a 390px viewport leaves the content column about 94px —
   so the goal here is not a pretty layout but an ORDERED one: nothing overflows, no
   line is left holding a single character, and every clickable target stays at
   least 40px. The four facts of the scan line become four lines in a deliberate
   order (identity, answer, model cell, door), and the well becomes one column with
   its labels above their values. */
@container (max-width: 360px) {
  .dmc-row {
    grid-template-columns: 4px minmax(0, 1fr);
    grid-template-rows: auto auto auto auto auto auto;
    row-gap: 2px;
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
  }

  .dmc-diagnostic,
  .dmc-retry {
    grid-column: 1;
  }

  .dmc-protocol {
    width: 100%;
    min-width: 0;
  }

  /* THE THUMB BRANCH. This is the phone column (the host hands the section about
     106px), where the scan line has already stacked, so every control may grow to
     40px without costing any density: the page is being read on a phone. */
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
    /* The add entry keeps its own width and wraps on natural break points, so it
       can never be squeezed into a column narrow enough to strand one glyph. */
    flex: none;
    max-width: 100%;
    text-wrap: pretty;
  }
}

/* The page's motion is control feedback and the two landing voices above, all of
   it transform or colour. With motion reduced every transition and animation is
   simply off: the content stays, it just stops moving. */
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
  .dmc-retry-action {
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
