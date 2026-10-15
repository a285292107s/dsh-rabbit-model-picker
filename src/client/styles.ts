/**
 * The plugin's stylesheet, injected once per activation.
 *
 * An out-of-repo plugin has no build-time CSS-module pipeline, so the sheet is
 * a single owned `<style>` element created in `apply` and removed by its
 * disposer. Every class name is `dmp-`-prefixed and global; the static
 * selfcheck cross-checks the sheet and the TSX against each other so a dead
 * rule or a typo'd class cannot ship silently.
 *
 * Colors come only from host semantic tokens (`--dsw-*`); the two
 * `--dsh-composer-model-*` display variables are the composer's narrow-row
 * contract and are consumed exactly as the incumbent seat consumes them.
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
     and settles, shared by every hover, press and entrance below. The portaled
     cards are NOT descendants of this element, so .dmp-menu states it too. */
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
}

/* The seat's only control. §5.26 folded the provider INTO this label
   (provider/model), so the chip that used to sit beside it is gone: the provider
   is a fact about the model in use, and the trigger is what names the model. The
   settings gear shares the hover/focus/disabled contract by its own rules below,
   but not this block: it is icon-only at every width, so it has no text to
   collapse. */
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
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease), transform 90ms var(--dmp-ease);
}

.dmp-trigger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* Press: the control yields by one notch and returns on release. A transform,
   so the composer's layout never reflows under the pointer. */
.dmp-trigger:active:not(:disabled) {
  transform: scale(0.97);
}

.dmp-trigger:focus-visible:not([data-selection-focus]) {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); /* taste-skill-ignore: focus indicator on the keyboard path, not elevation */
}

.dmp-trigger:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* The composer measures expanded row demand and owns this display variable;
   this seat only consumes it. Outside a composer the trigger keeps its text,
   and the icon stays hidden.
   The trigger labels the model as provider/model (§5.26 — the provider is a
   prefix of the model's identity, not a separate control beside it) and the
   effort in force after it (the stock picker's "name · level"). The identity is
   the primary half and the effort is the secondary half, so the width fight is
   settled by role: the identity keeps its shrink and ellipsizes first, the effort
   holds one short word. */
.dmp-trigger-label {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The effort in force, shown beside the name. It is TEXT, not an icon, so it
   carries the same readable ink as the name rather than the chevron's caption
   grey (the contrast gate holds every painted word to AA). The separator is a
   CSS ::before so it adds no DOM node and no accessible-name text: the trigger's
   aria-label already spells the effort out through trigger.ariaEffort, and a
   screen reader must not hear the middot as content. Under the composer's
   narrow-row switch the whole text half collapses together, so the effort
   answers the same display variable the name does.

   It is set one step down from the name (11px against the name's 13px, with
   tabular figures) so the chip states a MODEL at a level rather than one long
   string: at 13px/400 in the same ink as the name, "DeepSeek V4.1 Flash · Max"
   read as a single label and the level competed with the thing being named. */
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
  color: var(--dsw-alias-label-caption);
  transition: transform 140ms var(--dmp-ease);
}

.dmp-chevron-open {
  transform: rotate(180deg);
}

/* While the model card is up, the control that owns it reads as held down, the
   same way the gear does. Without it the chevron rotated but the chrome stayed
   cold, and the seat's shared contract had a hole in it. */
.dmp-trigger-open {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* The parameter gear: the trigger's right-hand companion. Icon-only by
   design (it carries no model text), so the composer's narrow-row variables do
   not apply to it and a 28px square is all the width it ever asks for. */
.dmp-settings-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-caption);
  cursor: pointer;
  transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease), transform 90ms var(--dmp-ease);
}

.dmp-settings-button:active:not(:disabled) {
  transform: scale(0.97);
}

.dmp-settings-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}

.dmp-settings-button:focus-visible:not([data-selection-focus]) {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); /* taste-skill-ignore: focus indicator on the keyboard path, not elevation */
}

.dmp-settings-button:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* A route with a record tones the gear up; the open state is spelled by its own
   class so the two do not have to be told apart by specificity. */
.dmp-settings-button[data-edited] {
  color: var(--dsw-alias-label-secondary);
}

.dmp-settings-open {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* Portaled to body and placed from the trigger rect, so the sidebar and the
   columns' overflow clips cannot crop the card. border-box keeps the OUTER
   width inside the design budget (padding included).

   This is the shared MATERIAL, and the three cards' shared metrics: the model
   card, the parameter panel and the settings surfaces all wear this class. So it
   stays a COLUMN — the two-pane layout belongs to the model card alone and lives
   on .dmp-card, because the parameter panel wears both classes and a row here
   would lay its head and its body out side by side. */
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
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent); /* taste-skill-ignore: the card IS the overlay this rule allows */
  color: var(--dsw-alias-label-primary);
  /* Elevated surface: the scrollbar thumb takes the l2 elevation tokens. */
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
  /* THE FACT GRID. The row's four facts are four fixed tracks, in BADGE_FACTS
     order, on every row whether or not the fact exists: one source for the
     widths, so the columns of a 520px card full of 60 models line up and a
     missing fact shows as an empty track instead of shifting its neighbours.
     The window track is the only one with a value (the window in force, right
     aligned so its unit letter lands in one column); a boolean fact is just its
     14px glyph. Everything that draws the grid — the row strip and the key under
     the search field — reads these three, so they cannot drift apart:
       strip = icon + gap + icon + gap + icon + gap + window
             = 14 + 8 + 14 + 8 + 14 + 8 + 47 = 113px
     Against the shipped strip (~107px for the common three-fact row, ~129px for
     a four-fact one) the worst case NARROWS and the common case costs nothing on
     the four-fact rows it was worst on, while the name column becomes the same
     ~187px on every row rather than a different width per row (§5.25 moved the
     card off the single-column 320px that budgeted ~160px here). */
  --dmp-col-icon: 14px;
  --dmp-col-window: 47px;
  --dmp-col-gap: 8px;
  --dmp-row-pad-x: 7px;
}

/* Entry. The card settles from 97% into place over 150ms with its origin at the
   anchored corner, so it grows OUT of the control that opened it — the same
   gesture every native menu of this class makes, and one the host's own
   surfaces do not make (they snap). Transform only: an opacity fade would dim
   the card's text mid-flight, which the contrast contract does not permit any
   more permanently than it does transiently, and a settle reads cleaner than a
   fade at this speed anyway. The animation is gated on the class that arrives
   with the measured position, so it plays from the placed rect, never from the
   off-screen measuring origin. */
@keyframes dmp-card-in {
  from { transform: scale(0.97); }
  to { transform: none; }
}

.dmp-menu-in {
  animation: dmp-card-in 150ms var(--dmp-ease);
}

/* The anchored corner, per the side the card opened on: everything here is
   align-end, so the horizontal origin is always the right edge. */
.dmp-from-top {
  transform-origin: 100% 100%;
}

.dmp-from-bottom {
  transform-origin: 100% 0;
}

/* THE TWO PANES (§5.25), and only on the MODEL card: the provider rail on the
   left, the model list on the right. 520px is the smallest width at which both
   panes can do their jobs — the model column must stay at least the 320px the
   four-track fact grid was budgeted against (a narrower column would either drop
   badges, losing the row-to-row column alignment §5.24 exists for, or wrap them,
   making the row height jump), and the rail's box needs 181px (176 of flex basis
   plus its own padding and hairline) to hold a real provider name beside a
   two-digit model count and the selection check. Measured on the live GUI at that
   width: the model pane is 331px and the name column is 175px on every row,
   against ~160px in the single-column card. */
.dmp-card {
  flex-direction: row;
  align-items: stretch;
  width: min(520px, calc(100vw - 32px));
}

/* The rail is the left pane: every scope this catalog offers, the unfiltered one
   first. It scrolls on its own (a deployment with fifteen providers must not push
   the model list off the card) and it is separated from the list by the host's l1
   hairline rather than by a fill, so the two panes still read as one surface.
   The name column it must not truncate is the longest provider label a real
   catalog carries (measured: "Magpie · Anthropic", 132px of room, no ellipsis). */
.dmp-rail {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 0 0 176px;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 4px 2px 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
}

/* One scope. It is a button because it is picked (click and keyboard), but a
   listbox OPTION in role: the selection it reports is a scope, not an action.
   The check beside it is the same mark the model rows use for their own
   selection, so "what is picked" reads the same way in both panes. */
.dmp-rail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 0 6px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 90ms var(--dmp-ease);
}

.dmp-rail-row:hover:not(:disabled),
.dmp-rail-row:focus-visible,
.dmp-rail-row[aria-selected='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmp-rail-row:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* The provider this conversation actually runs on. The rail has no room for the
   words 「当前会话」 beside a name, a count and the check — and the fact is already
   spelled out beside the card by the seat's chip — so the marker is one weight
   up, with aria-current as its machine-readable half. It is deliberately NOT the
   selected row's fill: the scope and the session are two different claims, and
   this pane is where confusing them would be invisible. */
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

/* The model pane: search, key, state lines and the list, stacked in the column
   beside the rail. min-width: 0 keeps a long model name from widening the card
   instead of ellipsizing inside its own column. */
.dmp-models {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding-left: 4px;
}

/* Status and empty copy are sentences a user is meant to read ("正在刷新模型列表…",
   "没有匹配的模型。"), not chrome: the tertiary ink measured 3.61:1 on this card
   in the light theme, under AA for 12px text. Same ink as every other
   explanatory line. */
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

/* An empty result is a state, not a rendering accident, so it is composed the
   way one should be: a quiet glyph over one sentence, centered, with air —
   the same sentence either way, but a state that holds its shape reads as
   deliberate. The model card's three empty reasons all take it. */
.dmp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 8px;
  text-align: center;
}

.dmp-empty-icon {
  color: var(--dsw-alias-label-tertiary);
}

/* A load failure and a partial failure. The failure signal is the host's danger
   fill plus the icon, NOT the ink: the host's error token measures 4.38:1 light
   and 3.61:1 dark on this card, which is under AA for any of these sizes, and
   the only size at which that red becomes compliant is 24px — absurd for a
   one-line callout. So the sentence takes ordinary readable ink and the state is
   carried by the fill, the icon and the words themselves (the message says the
   load failed). An error that is red but unreadable is worse than one that is
   neutral but legible. */
.dmp-error,
.dmp-warning {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
  padding: 6px 7px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
}

.dmp-error-icon {
  flex: 0 0 14px;
  margin-top: 1px;
  color: var(--dsw-alias-state-error-primary);
}

.dmp-warning {
  background: var(--dsw-alias-bg-module-platform);
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
  transition: color 90ms var(--dmp-ease);
}

.dmp-search-row {
  position: relative;
  flex-shrink: 0;
  margin: 2px 0 3px;
}

.dmp-search-row .dmp-search {
  display: flex;
  height: 30px;
  padding: 0 8px;
  /* The host's OWN field material, kept rather than flattened away: this is a
     real Input (the same primitive the settings pages use), and a control that
     renders as bare placeholder text is a label, not a field — the first thing
     on the card has to look like the thing you type into. Its border is the
     host's 0.5px l4 hairline, which is a form field's own line, not a rule. */
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}

.dmp-search-row .dmp-search-with-query {
  padding-right: 34px;
}

/* 13px, the row name's own size: the field used to be set a step SMALLER than
   the list it filters, which made the card's first line its quietest. */
.dmp-search-row .dmp-search input {
  padding: 0;
  font-size: 13px;
  line-height: 18px;
}

/* The search field's placeholder is the ONLY instruction the list gives
   ("搜索模型…"), so it is held to the same ink as body copy: the caption token
   measures 2.08:1 on the card in the light theme, which is not readable, and a
   placeholder a user cannot read is not a hint. */
.dmp-search-row .dmp-search input::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.dmp-search-clear {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  corner-shape: round;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  /* The clear button only exists while there is a query to clear, so its
     arrival is an event: it pops in on the shared curve. It animates the
     standalone scale property, not transform, because the rule's own
     translateY centering must survive the animation untouched. */
  animation: dmp-clear-in 120ms var(--dmp-ease);
  transition: background-color 90ms var(--dmp-ease);
}

@keyframes dmp-clear-in {
  from { scale: 0.6; }
  to { scale: 1; }
}

.dmp-search-clear:hover,
.dmp-search-clear:focus-visible {
  outline: none;
  background: var(--dsw-alias-interactive-bg-hover);
}

/* THE KEY TO THE STRIP. Four glyphs per row state four facts; the glyphs are
   the seat's whole invention and they mean nothing to a user who has not hovered
   a row, so the card says which column is which exactly once, above the table:
   the four marks with their words, in the order the columns are drawn, at the
   same 14px cell and the same readable ink the badges use. It is copy, not
   chrome — the a11y gate forbids hiding copy behind aria-hidden — and it is set
   in the secondary ink for the same reason every other explanatory line is: the
   caption token is 2.08:1 on this card in the light theme. */
.dmp-legend {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 12px;
  padding: 2px 8px 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
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
}

.dmp-groups {
  min-height: 0;
  overflow-y: auto;
  /* The pinned group heading is 24px tall and the viewport knows nothing about
     it: scrollIntoView({ block: 'nearest' }) parked the newly highlighted first
     hit UNDER the band (measured in the query state — the top result of "deep
     seek" sat half behind its own heading). scroll-padding insets the scrollport
     for scroll-into-view and keyboard scrolling, so the browser keeps the row it
     is revealing clear of the band. */
  scroll-padding-top: 26px;
}

/* Groups are separated by air, not by the heading band alone: with 8px between
   sections the list stops reading as one continuous stripe of bands and rows. */
.dmp-groups > [data-menu-group] + [data-menu-group] {
  margin-top: 8px;
}

/* The pinned group heading: the list's ONLY landmark — it names the provider
   whose models follow — and it shipped as the least legible text on the card,
   because MenuGroup's own rule paints the label-tertiary token at 11px.
   That token is 2.08:1 on this card in the light theme (measured by this repo's
   own contrast gate, which is the reason every other explanatory line here was
   moved off it), so the landmark takes the readable ink and 12px — one step over
   the badge values, one step under the row names. The fill stays: see §5.8 —
   without it, rows slide under the label and both texts draw through each other
   in any tab whose rendering pipeline is parked. */
.dmp-groups [data-menu-group-heading] {
  background: var(--dsw-alias-menu-group-header-fill);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  padding: 6px var(--dmp-row-pad-x) 2px;
}

/* The model row states facts instead of offering controls, and it keeps them on
   ONE line: the name shrinks with an ellipsis while the badge strip keeps its
   own width, so a long catalog name never pushes the facts out of the row. It is
   a div rather than a button so a row can hold block content while aria-disabled
   keeps it focusable during a selection (a disabled button would drop the
   keyboard back to the trigger).

   The row is 38px tall: a 22px badge capsule plus 8px of air above and below is
   what makes the strip read as a fact line rather than as text that happens to
   have a background. The strip is kept on ONE line (flex-wrap: nowrap): a badge
   broken across two lines was the row at 46px, and a row that changes height
   because its facts wrapped is a list that jumps as the eye scans it. */
.dmp-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 100%;
  min-height: 38px;
  padding: 5px var(--dmp-row-pad-x);
  border: none;
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  /* Menu rows are actions, not copy: rapid clicking must never drag a
     selection halo across the list. */
  user-select: none;
  transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease);
}

/* The rows carry aria-disabled (the provider rows in the other card are real
   buttons and carry disabled); both spellings mean the same thing here. */
.dmp-row:hover:not([aria-disabled='true']):not(:disabled),
.dmp-row:focus-visible,
.dmp-row[data-active]:not([aria-disabled='true']) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dmp-row[aria-disabled='true'],
.dmp-row:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* Trailing model count on a rail row. The count is the reason to pick one
   provider over another, so it reads in the same ink as the row rather than in
   the caption token (2.08:1 on this card in the light theme). */
.dmp-provider-count {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

/* The "加载失败" mark on a rail row — the only thing on that row explaining
   why its models cannot be listed. The host's warn amber measures 2.72:1 here in
   the light theme (4.26:1 in dark) and no amber token in this palette clears AA
   on this card, so the words take readable ink and the state is carried by a
   trailing red dot, which is decoration and owes no text ratio. */
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
  background: var(--dsw-alias-state-error-primary);
}

/* "N more matches in other providers" strip at the top of the model list. The
   rail states the scope itself, so this is not a scope label: it appears only
   when a query has hits the scope is hiding, and it carries the one-click way
   back to every provider. */
.dmp-filter-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px 4px;
  /* This strip explains why the list is short and carries the way back to all
     providers, so it is copy rather than chrome: the tertiary ink measures
     3.61:1 on this card in the light theme, below AA for 12px text. */
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
  transition: color 90ms var(--dmp-ease);
}

.dmp-filter-clear:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
}

/* Name first, facts behind it, both on the row's single line: the name is the
   flexible half, the strip is the fixed half. */
.dmp-row-copy {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.dmp-row-name {
  flex: 1 1 auto;
  /* The name is the row's elastic half: it takes whatever the four capsules do
     not need, and it is what ellipsizes when the composer is narrow. The 48px
     floor is not a width budget — it is the point below which a name stops
     identifying a model at all. */
  min-width: 48px;
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  line-height: 18px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The fact strip: one badge per fact. Nothing in here is a control — that is the
   point of the strip, so it takes no hover, no focus ring and no cursor.

   The badges carry NO frame. The host's "neutral" tone paints the capsule's
   background, and that fill was the badge's whole outline: at 22px with 4px of
   side padding it read as a row of small bordered pills, which is a lot of
   chrome for four facts that are really just "T", a value and a window. Dropping
   the fill leaves the glyph and the value as the badge, so the strip reads as a
   fact LINE instead of a row of chips — and the two axes it frees are the two
   that were scarce (below). The paint is cleared here, on the badge itself,
   rather than by picking another tone: "quiet" also drops the icon's ink one
   step, and the facts are not second-class copy.

   WIDTH IS THE SCARCE RESOURCE, so the strip is built tight (see
   .dmp-badges .dmp-badge): the four common badges measure ~138px together, down
   from the ~152px the framed capsule cost, where the first version of this strip
   measured ~212px and left the model name 53px — barely two characters — in a
   320px card. The strip is the row's fixed half (it keeps its own width) and the
   name absorbs the deficit and ellipsizes, so those 14px went to the name. */
.dmp-badges {
  display: grid;
  grid-template-columns:
    var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
  flex: 0 0 auto;
  align-items: center;
  /* The gap is the only thing separating neighbouring glyphs now that the
     capsule's own 4px of side padding is gone: between two glyphs the framed row
     had 4 + 2 + 4 = 10px of optical distance, and 8px keeps that rhythm. */
  gap: var(--dmp-col-gap);
}

/* An empty track. A fact this model does not state — no image input, no declared
   reasoning, no readable window — leaves its own column empty rather than
   pulling its neighbours left, so the three facts a model HAS are always in
   their own columns and the four columns agree from row to row. Nothing is drawn
   in the gap on purpose: a slashed glyph was the quietest possible way to say
   "no", and a fixed position says it without a mark at all (see §5.24). */
.dmp-badge-slot {
  min-width: 0;
}

/* The badge is two cells on one baseline: the icon cell and the value.
   The primitive's own capsule is 1px 8px at 11px/17px, which both wastes 16px
   of width on a two-cell badge and leaves the icon floating in padding; these
   overrides make it a bare 22px-tall pair whose horizontal padding is gone
   entirely — with no fill and no border there is no capsule edge left to
   respect, so every pixel of padding here is width the model name needs. The
   min-height stays so the two-cell badges still agree on one baseline. The
   fill and border are cleared explicitly (not left to the tone): whatever
   stylesheet the shell injects first, the badge has no frame.
   Specificity beats the primitive's own .tag padding regardless of which
   stylesheet the shell injects first. */
.dmp-badges .dmp-badge {
  gap: 3px;
  min-height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  font-weight: 400;
}

/* The icon cell: it states WHICH fact, so it is never the value's leftover, and
   it is the same size in every badge of the row whether the badge behind it
   carries text or not. It is exactly the glyph's box — the artwork carries its
   own inset inside the viewBox — so the cell adds no width the icon does not
   use. */
.dmp-badge-fact {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

/* With the capsule fill gone, the glyph and this value ARE the badge, so the
   glyph is the one thing left that states WHICH fact this is. There is no
   second (dimmed) state to paint: a fact the model lacks is not drawn at all —
   the row keeps only the facts it HAS (see badges.ts on the off field, whose
   sentence still reaches the row's aria-label). */
.dmp-badge-icon {
  display: block;
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
}

/* A capacity or a level name is a value, so it reads in tabular figures and one
   step brighter than the badge's own ink. It sits 3px behind its own glyph — the
   badge stays ONE mark, exactly as it was — because the icon cell is what the
   four tracks align on; a value right-aligned inside the window track instead
   left "1M" stranded 16px from its glyph while "262K" touched it, and the badge
   stopped reading as a single fact. The cap keeps an adapter's unusually long
   level name (the effort name is free adapter text) from growing the strip until
   the context-window badge — the last one — is pushed off the card and clipped by
   .dmp-menu's overflow. Beyond it the value ellipsizes like the name does. */
.dmp-badge-value {
  max-width: 64px;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.dmp-check {
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  color: var(--dsw-alias-label-primary);
}

/* The check arrives only when a row becomes the checked one, so its entrance is
   the selection's own event: a small overshoot pop on the shared curve. It is
   an icon, not copy, so the pop never touches the contrast contract. */
@keyframes dmp-check-in {
  0% { transform: scale(0.5); }
  60% { transform: scale(1.12); }
  100% { transform: none; }
}

.dmp-check svg {
  width: 14px;
  height: 14px;
  animation: dmp-check-in 180ms var(--dmp-ease);
}

/* The parameter panel: same material as the model card, narrower than it (it
   carries labelled controls, not a list).
   The surface itself must NOT scroll. MenuSurface paints the card's fill as an
   absolutely positioned child (.material, inset: 0) anchored to this element's
   padding box, so a surface that scrolls drags that layer up with the content
   and the bottom of the card loses its fill — the page shows through the panel's
   own footer, and the layer's rounded bottom corners appear in the middle of the
   card. Measured on the real GUI: exactly that. The scroll role belongs to the
   inner body below; the model card already splits it the same way (.dmp-groups). */
.dmp-settings {
  width: min(280px, calc(100vw - 32px));
  max-height: min(460px, calc(100vh - 96px));
  overflow: hidden;
}

/* The card holds initial focus when it opens (§5.10), so it needs a ring of its
   own: without one the focus is invisible until the first Tab, and with the UA's
   default outline it reads as a selection border around a floating card. Same
   token the capacity field paints on focus-within, so the two never disagree
   about which thing is focused. Mouse users never see it — focus-visible only
   matches the keyboard path that opened the panel. */
.dmp-settings:focus-visible {
  outline: 1px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}

/* The panel's scroll viewport: the head and the state line stay put, everything
   below them scrolls inside the card. min-height: 0 is what lets the flex item
   shrink below its content and actually become scrollable.
   The sections are separated by AIR (12px), not by a rule: the sheet used to draw
   border-top 1px on all five blocks of this panel, which is the one thing a
   floating card should never do — five hairlines turn a small panel into a form
   from 2014 and draw more lines than the card has groups. Space plus a change of
   type size carries the grouping instead. */
.dmp-settings-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 12px;
  min-height: 0;
  padding: 2px 0 6px;
  overflow-y: auto;
}

.dmp-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 8px 6px;
}

.dmp-settings-title {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
  /* The panel's one landmark: it names the model every control below belongs to,
     so it takes the card's primary ink and the heavier of the two weights this
     seat allows (the other 600 is the restore action beside it, set two steps
     smaller). */
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
  transition: color 90ms var(--dmp-ease);
}

.dmp-settings-reset:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
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

/* The parameter panel's labels and every explanatory line below them. These are
   real copy, not decoration, so they take the secondary ink: the caption token
   measures 2.08:1 on this card in the light theme (3.82:1 in dark), which fails
   WCAG AA for text this size in both themes — "已声明：文字、图片" is information
   the user needs in order to decide what the switches do. Hierarchy is carried
   by size (12px section label against the 13px control text, 11px hints) instead
   of by an unreadable ink, and by the 12px of air the body puts between
   sections, which is now the only thing dividing them. */
.dmp-settings-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
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

/* The panel's state line: why the controls above it are inert (no declaration,
   read-only profile, unavailable settings service). It is rendered above the
   controls it qualifies, so the reason is read before the control — which is
   exactly why it must be legible: it is the ONLY explanation of a disabled
   panel. Same ink as the hints. */
.dmp-settings-notice {
  padding: 6px 8px 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

/* What the settings service refused, in its own words — the one line a user MUST
   read, and the only statement that their edit did not happen.
   It would be natural to paint this in the host's error red, and that is what
   this rule did at first. It cannot: the red measures 4.38:1 on this card in the
   light theme and 3.61:1 on the composer card in dark, both under AA for any
   body size, and the only size where that red becomes compliant is 24px — which
   turns one short refusal into a banner that dwarfs the 11-13px panel it lives
   in and pushes the controls down. So the failure is carried by things that do
   not have to be legible to be read: the host's danger fill, a warning icon in
   the error ink, and a sentence that says "被拒绝" in words. The copy becomes
   MORE legible than the red version (5.64:1 light / 7.86:1 dark), not less. */
.dmp-settings-alert {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 8px 0;
  padding: 6px 7px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

.dmp-settings-alert-icon {
  flex: 0 0 12px;
  margin-top: 2px;
  color: var(--dsw-alias-state-error-primary);
}

/* The declaration this panel writes, so a reviewer can check the edit landed;
   the full namespace + path stays available in the title attribute. It is the
   quietest line of the panel but it is still information ("which declaration
   does this edit?"), so it uses the same secondary ink as every other line
   rather than the dimmed token — dimmed measures 1.23:1 on this card in the
   light theme, which is invisible rather than quiet. */
.dmp-settings-target {
  overflow: hidden;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary);
  /* 10px was the smallest text in the whole seat, on the one line a reviewer has
     to read to check the edit landed. It takes the panel's hint size. */
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The primitive owns the switch's own chrome; only its place in the row is ours.
   align-self keeps it centered instead of stretching to the row's 30px. */
.dmp-settings-switch {
  flex: 0 0 auto;
  align-self: center;
}

/* The gear's own mark: it must never shrink in a cramped composer row. */
.dmp-settings-icon {
  flex: 0 0 auto;
}

/* The effort choices of the parameter panel: the panel is the one surface that
   lets effort be changed, so these are the only effort controls left in the
   seat. This wrapper stacks them and keeps the group tight against its label. */
.dmp-effort-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* The capacity field takes the row's remaining width; the primitive's wrapper
   and its native input are both stretched so the whole row is the target. */
.dmp-settings-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  /* The host's own Input material, the same field the settings pages draw: a
     form field may carry its own line, and this one should look like every other
     field in the product rather than like the last outlined box on the card. */
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}

.dmp-settings-input:focus-within {
  border-color: var(--dsw-alias-state-business-primary);
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
  border-color: var(--dsw-alias-state-error-primary);
}

/* What the panel writes and where the edits land. This is the one paragraph in
   the card with no control of its own, and it is the only place the panel says
   its edits are real rather than a local override — so it is held at the same
   secondary ink as every other explanatory line instead of the caption token
   (2.08:1 on this card in the light theme). */
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

.dmp-effort-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease);
}

.dmp-effort-item:hover:not(:disabled),
.dmp-effort-item:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
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
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  color: var(--dsw-alias-label-primary);
}

.dmp-effort-check svg {
  width: 14px;
  height: 14px;
  animation: dmp-check-in 180ms var(--dmp-ease);
}

/* The two-pane card collapses into ONE column when the viewport can no longer
   hold both panes at their floors: the rail's 176px plus the 320px the model
   column needs, plus the card's own 4px of padding either side, means the panes
   stop fitting below a 505px card — and the card is 100vw - 32px below a 552px
   viewport, so 536px is where that happens.
   The rail becomes a horizontal strip ABOVE the list rather than disappearing:
   the scope stays visible and changeable at every width, which is the whole point
   of having put it in the card. Same DOM, same roles, same keys — only the
   flex direction changes, so nothing has to be tested twice. */
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
    border-bottom: 1px solid var(--dsw-alias-border-l1);
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
   has not asked the system to calm down. The media gate keeps the two motion
   preferences from disagreeing with each other. */
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
  .dmp-settings-reset {
    transition: none;
  }

  .dmp-trigger:active:not(:disabled),
  .dmp-settings-button:active:not(:disabled) {
    transform: none;
  }

  .dmp-chevron {
    transition: none;
  }

  .dmp-menu-in {
    animation: none;
  }

  .dmp-check svg,
  .dmp-effort-check svg,
  .dmp-search-clear {
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
