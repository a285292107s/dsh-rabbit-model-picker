/**
 * 模型目录区的样式表，每次激活注入一次。
 *
 * WHY THIS IS A SECOND dmc- SHEET, AND NOT PART OF THE PAGE'S. The page's own
 * sheet (`modelConfigStyles.ts`) owns the ledger; this one owns one provider's
 * expanded model region. Keeping them apart is the split the seat's `styles.ts`
 * already makes from this pair: independent rule sets, each checkable on its own.
 *
 * THE REGION IS CONTENT, NOT AN OVERLAY. This sheet used to describe a right-side
 * drawer: `position: fixed`, its own scrim, a shadow, a corner, a Tab trap and a
 * document-level Escape capture — a second viewport-level modal inside the host's
 * settings dialog. At a wide viewport it landed OUTSIDE that dialog, and at 1920 it
 * covered 460px of the page's 560px content column. It is now a plain child of the
 * provider row's grid, sharing the page's content column and the page's scroll.
 * Nothing here is fixed, nothing floats, and the narrow branch asks the page's
 * `@container` (the pane is the container), so one breakpoint language governs the
 * whole tab.
 *
 * THE DIRECTION IS THE PAGE'S (quiet-instrument). A narrow column of statements,
 * controls stripped down to words, one ink ladder — the primary ink for whatever
 * is being stated or can be acted on, the secondary ink for supporting facts and
 * for a control that cannot act. No object on this surface floats.
 *
 * WHAT IS NO LONGER A BOX. Every action used to be a 1px outlined rectangle: five
 * controls across ten model rows, plus the discovery tools. They are text actions
 * now — no border, no fill at rest, no radius, no lift — told apart from static
 * text by their cursor, their hover step and their focus ring. The one kind of
 * control that keeps an edge is the REAL FORM FIELD (an input, a select, a
 * checkbox): the house rules exempt those, and the retry card this plugin used to
 * ship already recorded the regression that removing a field's edge caused — the
 * numbers stopped reading as fields and started reading as static text.
 *
 * COLOUR AND TYPE ARE THE HOST'S. Every colour comes from a `--dsw-*` semantic
 * token and every size is a px literal, matching `modelConfigStyles.ts`; no font
 * family is set, so the region inherits the host's own. The two tokens that may
 * carry text here are `--dsw-alias-label-primary` and
 * `--dsw-alias-label-secondary`. The state colours measure under the 4.5:1
 * body-text floor in the light theme, so `--dsw-alias-state-error-primary` is used
 * only as a mark (the invalid rail and the guard bar) and
 * `--dsw-alias-state-business-primary` only as the focus ring. There is
 * deliberately no accent-filled control and no accent edge in this sheet: the page
 * spends its one accent on its one action, and an accent fill would also need the
 * palette's white as its label, which is a third ink this region does not
 * introduce. The commit words are therefore stated with weight instead.
 * Quietness is the secondary ink, never a faded primary one: no `opacity`,
 * `filter`, `text-shadow` or `mix-blend-mode` appears below.
 *
 * The one tone the region consumes beyond the label inks is
 * `--dsw-alias-interactive-bg-hover` for the hover step and
 * `--dsw-specific-input-major` for field fills: both are plain fills the host's
 * own panels and fields use, and neither is a row separator (the page's list
 * owns that ladder).
 *
 * @module dsh-rabbit-model-picker/client/catalogStyles
 */

/** Id of the owned style element (stable, so re-activation replaces it). */
const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-catalog-styles'

/** The stylesheet. */
const CSS = `
/* The region: a direct child of the .dmc-row five-track grid, so it starts at the
   name's spine (column 2) and never re-flows the scan line above it. It has no
   fill, edge, radius or lift of its own: the row's positional fill (hover /
   focus-within / data-catalog) is its surface, which is why it must live inside
   the row. The region owns no scroll box — the page scrolls. */
.dmc-catalog-panel {
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 2px 0 16px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}

/* The head: identity at the start (模型目录) and the region's one action at the
   end (收起) — the page's own two-ends grammar. The catalog's state travels
   beside the title in the quieter ink, so the header is one line rather than a
   stacked card title. */
.dmc-catalog-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
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
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
}

/* --- controls -------------------------------------------------------------
   Every action is a WORD, not a box. At rest a control has no border, no fill,
   no radius and no shadow: it is told apart from static text by its cursor, its
   hover step and its focus ring, and from its neighbours by the row rhythm.
   Hover, focus and press are the three moments it is allowed to step up - and
   one press step is the whole of the motion a control owns.

   FULL INK WHILE IT CAN ACT, QUIET INK WHEN IT CANNOT. The lip of a control is
   stated in the primary ink, because a surface whose running words are soft grey
   reads as one that was never finished, and because in a read-only deployment
   (settings.writable === false) a row of quiet-grey actions looked clickable and
   then did nothing. The secondary ink is therefore spent on exactly one thing
   here: the control that is disabled, whose ink is the only signal left once the
   hover step is gone. Only two tokens may paint text in this sheet, so there is
   no third ink to reach for - and none is wanted. */

.dmc-btn {
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  /* Words, not capsules: a native button centres its label, which turned a
     full-width action ("添加档位") into a centred one. Every action in this sheet is
     a word starting at the panel's left spine. */
  text-align: left;
  cursor: pointer;
  transition: transform 80ms linear;
}

.dmc-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dmc-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-btn:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* The commit words ("保存" / "添加所选"). At rest they carry the same primary ink
   as every other action, so they are told apart by WEIGHT alone, never by a
   fill: the measured pairing of white on the accent fill is 4.2349:1 in the
   light theme and 2.3278:1 in the dark one, under the 4.5:1 floor, so accent
   stays an edge and a focus ring on this page. */
.dmc-btn-commit {
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
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
}

/* The collapse guard. It is a LINE in the region, not a dialog on top of it: the
   page removes a dirty draft only after this line has been answered. The 4px bar
   is the page's warning motif (a graphic, where the state colour clears 3:1); the
   sentence stays in the primary ink, and the two answers are words. */
.dmc-catalog-guard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0 2px 12px;
  border-left: 4px solid var(--dsw-alias-state-error-primary);
}

.dmc-catalog-guard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* --- prose ---------------------------------------------------------------- */

/* A section title, and - when the section has one - the sentence that states the
   section's own state at the far end of the same line, which is this page's
   grammar for every row: identity at the start, the answer at the end. */
.dmc-catalog-section {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}

.dmc-catalog-status {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.dmc-catalog-notice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

/* The Host's own diagnostic, printed verbatim. It is emphatic by weight, not by
   the error colour: that colour is a mark here, never an ink. */
.dmc-catalog-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

.dmc-catalog-note {
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

/* --- the catalog: a roster, one line per model ---------------------------- */

/* THE ROSTER (§5.36). The region's own copy of the page's grammar: a model is a
   RECORD, so the list states records rather than opening a four-field form per
   model. Line one is the id and its one door; line two is the display name and the
   two capacity facts in the quiet ink; everything editable lives in the well that
   the door opens. Before this, seven models meant twenty-eight always-open inputs
   before the reader had asked for anything. */
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
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  min-height: 44px;
  padding: 10px 0;
  color: var(--dsw-alias-label-primary);
}

/* Positional and momentary, never a persistent fact: the row that is hovered, holds
   focus or has its well open is the only one that carries a fill. */
.dmc-model-row:hover,
.dmc-model-row:focus-within,
.dmc-model-row[data-well='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* A row whose draft cannot be written carries the page's own mark: a 4px rail in
   the state colour. It is a graphic mark, so the 3:1 threshold applies, and the
   sentence beside it stays in the readable ink. */
.dmc-model-row[data-invalid='true']::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: var(--dsw-alias-state-error-primary);
}

/* The id is the record's identity: one line, cut with an ellipsis when the endpoint
   handed us a long id. The title attribute on the node keeps the whole string
   reachable, which is the only honest option inside the settings content column. */
.dmc-model-ref {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The facts line: display name and the capacity overrides, all in the quiet ink at
   the quiet end of the type ladder. */
.dmc-model-sub {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.dmc-model-alias {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}

.dmc-model-fact {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The row's one door, parked against the region's right edge with every other
   row's door. */
.dmc-model-edit {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-model-edit:hover {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

.dmc-model-edit:active {
  transform: translateY(1px);
}

/* THE WELL. A two-column address form (id / display name, then the two capacities),
   the reasoning-level editor, and the remove entry last. No fill and no edge of its
   own: the row's fill is its surface, which is why the well is a child of the row. */
.dmc-model-well {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 8px 0 4px;
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

/* A form label, not an eyebrow: the four field names state what each field
   holds, in the quieter ink, at the quiet end of the type ladder. No caps, no
   letter-spacing, no monospace. */
.dmc-model-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}

/* Fields keep a real edge: a control is told apart from a label by its edge, and
   the design record exempts form fields from the no-hairline rule for exactly
   this reason - the retry sheet measured what happens without it. */
.dmc-model-input,
.dmc-reasoning-value,
.dmc-reasoning-level,
.dmc-discover-search {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 0;
  background: var(--dsw-specific-input-major);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
}

.dmc-model-input::placeholder,
.dmc-reasoning-value::placeholder,
.dmc-discover-search::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.dmc-model-input[data-invalid='true'] {
  border-color: var(--dsw-alias-state-error-primary);
}

.dmc-model-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

/* The remove entry: the well's last line, away from the fields it must not be
   confused with. Its ink ladder is the sheet's (primary at rest, secondary when
   the deployment cannot write). */
.dmc-model-danger {
  align-self: flex-start;
  min-height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms ease-out, transform 80ms linear;
}

.dmc-model-danger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-danger);
}

.dmc-model-danger:active:not(:disabled) {
  transform: translateY(1px);
}

.dmc-model-danger:disabled {
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}

/* The roster's add entry: one ledger line under the last model. */
.dmc-model-add {
  align-self: stretch;
  height: 40px;
  padding: 0 6px;
  border-radius: 0;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}

.dmc-model-add:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
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
  color: var(--dsw-alias-label-secondary);
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

/* The checklist's own control row. The count leads it, because the count is what
   the reader is choosing from: the measured deployment lists 396 candidates,
   which is a set to filter and take from rather than a list to read top to
   bottom. It does NOT pin: the page is the one scrolling surface now, and a
   sticky strip inside a region that already lives in the page's scroll would
   travel over the ledger above it. The row simply leads the list. */
.dmc-discover-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* The checklist is the one bounded scroll region in the region: 396 candidates
   would otherwise push the save footer a screen and a half down. It is a list
   scroll, not a panel scroll — the page keeps its own scroll. */
.dmc-discover-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

/* A group heading in the checklist. 396 rows of equal weight is not a hierarchy,
   so the checklist is grouped by the id's own first segment - the vendor, in the
   endpoint's own spelling - and each heading states how many rows it introduces.
   An existing class could not serve: "dmc-catalog-section" is the region's
   SECTION title (13px, 600, primary ink) and twenty of those inside one
   checklist would turn a quiet panel into a stack of headings, while
   "dmc-catalog-notice" is documented as a sentence of explanation. The heading is
   therefore quieter than the ids beneath it - 12px secondary ink, tabular
   figures - and draws no rule: the separation is rhythm, which is how this page
   separates every group of things. */
.dmc-discover-group {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dmc-discover-candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  color: var(--dsw-alias-label-primary);
}

/* A candidate whose id the catalog already declares cannot be adopted: the
   existing entry wins by contract, so the row falls back to the secondary ink as
   a whole - the id included, because the id states no colour of its own and
   inherits this one - and its box is inert. */
.dmc-discover-candidate[data-present='true'] {
  color: var(--dsw-alias-label-secondary);
}

/* The box and the id are one label, so the id is the control's accessible name
   without an id built out of endpoint text. The label takes the free space, so a
   candidate reads as the page's own rows do: identity at the start, the row's
   other fact at the end. */
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
}

/* No colour of its own: the id renders in whatever ink its row states, which is
   how one rule can quiet the whole row (the data-present hook) without a second
   selector reaching into it. */
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
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}

/* --- focus and motion ----------------------------------------------------- */

/* Every focusable control, one ring. The host's own focus-ring token resolves to
   transparent in both themes, so the business colour is named directly instead
   of being reached through a fallback that would paint nothing. */
.dmc-btn:focus-visible,
.dmc-model-edit:focus-visible,
.dmc-model-danger:focus-visible,
.dmc-discover-check:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dmc-model-input:focus-visible,
.dmc-reasoning-value:focus-visible,
.dmc-reasoning-level:focus-visible,
.dmc-discover-search:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -1px;
}

/* --- narrow and reduced motion -------------------------------------------- */

/* The page is the query container, and this region lives inside it, so the narrow
   branch asks the same container the page's own rows do (the .dmc-page rule declares
   container-type: inline-size). At the phone column the host actually hands this
   section (about 106px) the field and level grids stack and every target grows to
   a thumb's size; the region keeps column 2 of the row's one surviving track. */
@container (max-width: 360px) {
  .dmc-catalog-panel {
    grid-column: 2;
  }

  .dmc-catalog-head {
    flex-wrap: wrap;
  }

  .dmc-btn {
    height: 40px;
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

/* With motion reduced, a control does not settle: the transition and the
   transform it would have animated are both off, and nothing else about the
   surface changes. */
@media (prefers-reduced-motion: reduce) {
  .dmc-btn {
    transition: none;
  }

  .dmc-btn:active:not(:disabled),
  .dmc-model-edit:active,
  .dmc-model-danger:active:not(:disabled) {
    transform: none;
  }
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
