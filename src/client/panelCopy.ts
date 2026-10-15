/**
 * What the parameter panel SAYS in each state, as data.
 *
 * The panel has one job that is easy to get wrong and impossible to see in a
 * screenshot: naming, per state, which line explains why a control is inert and
 * which line states where a value comes from. Those are two different jobs and
 * they were once done by the same sentence, three times over — the notice and
 * both section hints each said "you cannot edit this" for an unaddressable
 * route, and the effort list greying itself out after the user's own click had
 * no sentence at all.
 *
 * So the selection is a pure function here, next to the panel but not inside it:
 * `scripts/test-params.mjs` bundles this module with the real dictionary and
 * asserts the exact keys each state produces, and `SettingsMenu.tsx` only
 * renders the result. A rule like "the notice is the only place an unusable
 * state is explained" is then a fact the unit gate owns, not a convention the
 * next edit has to remember.
 *
 * @module dsh-rabbit-model-picker/client/panelCopy
 */

import { CONTEXT_PLACEHOLDER, PANEL_MODALITIES, formatContext } from './params.ts'
import type { ParamsSnapshot, RouteAddress, RouteCapability, Translate } from './contract.ts'

/** One line of panel copy: a key plus the values it interpolates. */
export interface CopyLine {
  /** The dictionary key. */
  readonly key: string
  /** The interpolation values, or undefined when the line takes none. */
  readonly params?: Record<string, string>
}

/** Everything the panel's copy depends on. */
export interface PanelCopyState {
  /** The resolved route address, or null when this route has no declaration. */
  readonly address: RouteAddress | null
  /** What the adapter published about this route, or null when it published nothing readable. */
  readonly capability: RouteCapability | null
  /** The Host settings snapshot: its status and whether it accepts form edits. */
  readonly snapshot: Pick<ParamsSnapshot, 'status' | 'error' | 'writable'>
  /** A selection is in flight, so every control of this panel is inert. */
  readonly busy: boolean
  /** The capacity field's current text could not be read as a capacity. */
  readonly capacityError: boolean
}

/** The panel's copy for one state, already resolved through `t`. */
export interface PanelCopy {
  /** The single line explaining an unusable state, or null when all is well. */
  readonly notice: string | null
  /** What the switches show, and where those values come from. */
  readonly inputHint: string
  /** What the capacity field shows, and whether it is declared. */
  readonly contextHint: string | null
}

/**
 * Render one modality list as copy.
 *
 * The five tokens are the ones an adapter catalog may name (`models.dev`'s own
 * vocabulary); an unknown token is printed as it arrived rather than dropped, so
 * a catalog that grows a modality is still readable instead of silently short.
 * @param modalities - modality ids.
 * @param t - the translator.
 * @returns the localized list ('文字、图片'), or '' when empty.
 */
export function modalityLabel(modalities: readonly string[], t: Translate): string {
  return modalities
    .map(modality => modality === 'text'
      ? t('settings.input.text')
      : modality === 'image'
        ? t('settings.input.image')
        : modality === 'audio'
          ? t('settings.input.audio')
          : modality === 'video'
            ? t('settings.input.video')
            : modality === 'pdf' ? t('settings.input.pdf') : modality)
    .join(t('settings.listJoin'))
}

/**
 * The input types the ADAPTER published for this route, when it published any.
 * @param capability - the route's adapter-published facts, or null.
 * @returns the published list, or undefined when the adapter published none.
 */
function publishedInputOf(capability: RouteCapability | null): readonly string[] | undefined {
  const published = capability?.inputModalities
  return published === undefined || published.length === 0 ? undefined : published
}

/**
 * The line explaining why nothing can be edited, or null when everything can.
 *
 * `busy` is checked FIRST even though it is the most transient state: choosing
 * an effort level submits through the shared session selection, which disables
 * this very panel while the Host applies it. A user whose own click greys the
 * card out is owed that reason on screen — `aria-busy` only tells a screen
 * reader. A write failure outranks all of these and is handled by the caller.
 * @param state - the panel state.
 * @returns the notice's copy line, or null.
 */
export function noticeOf(state: PanelCopyState): CopyLine | null {
  const line = noticeKeyOf(state)
  if (line === null) return null
  return line.key === 'settings.loadFailed'
    ? { key: line.key, params: { message: state.snapshot.error ?? '' } }
    : line
}

/**
 * Whether there is a notice at all, without needing a translator.
 *
 * The notice's own KEY decides it, so an internal caller (and the unit gate) can
 * ask "is this state explained?" without minting a throwaway `t`.
 * @param state - the panel state.
 * @returns the notice's copy line without its interpolation values, or null.
 */
export function noticeKeyOf(state: PanelCopyState): CopyLine | null {
  if (state.busy) return { key: 'settings.busy' }
  if (state.snapshot.status === 'loading' || state.snapshot.status === 'idle') {
    return { key: 'settings.loading' }
  }
  if (state.snapshot.status === 'unavailable') return { key: 'settings.unavailable' }
  if (state.snapshot.status === 'error') return { key: 'settings.loadFailed' }
  if (state.address === null) return { key: 'settings.unaddressable' }
  if (!state.snapshot.writable) return { key: 'settings.readonly' }
  return null
}

/**
 * The input section's hint: the SOURCE of the two switches — the list this route
 * declares, the adapter default it inherits while it declares none, or the fact
 * that the adapter states none — or **null when the notice above already
 * explains that nothing here can be edited**.
 *
 * Returning null rather than a second sentence is the whole point: an
 * unaddressable route is the state where the user can do nothing, and the panel
 * used to explain that three times (the notice plus both section hints) nine
 * lines apart. The disabled switches still show what the model accepts, so
 * nothing is lost by staying quiet about why.
 *
 * When the route declares NOTHING at all, this hint is also where the head's
 * "restore defaults" button gets its reason: it is disabled in that state, and it
 * used to say so only in a `title`, which a disabled button cannot be focused to
 * reveal. An explanation that exists is not the same as a state that is
 * explained.
 *
 * A fact the ADAPTER published is the one line allowed to survive the notice: it
 * states where the value on screen came from, not why a control is inert, and
 * the notice never covers that. Its position in the ladder is the adapters' own
 * precedence (`declared ?? installed catalog ?? configured default`), so the
 * sentence matches the switches above it.
 * @param state - the panel state.
 * @param t - the translator.
 * @returns the hint's copy line, or null when the notice is the explanation.
 */
export function inputHintOf(state: PanelCopyState, t: Translate): CopyLine | null {
  const address = state.address
  const published = publishedInputOf(state.capability)
  if (address !== null && address.input.length > 0) {
    return noticeOf(state) === null
      ? { key: 'settings.input.declared', params: { list: modalityLabel(address.input, t) } }
      : null
  }
  // From here down the hint states a fact the DECLARATION does not supply, so
  // the notice cannot suppress it: the notice answers "why can I not edit this",
  // the hint answers "where did the value on screen come from", and only the
  // second question is unanswered in these states.
  if (published !== undefined) {
    return { key: 'settings.input.capability', params: { list: modalityLabel(published, t) } }
  }
  if (noticeOf(state) !== null) return null
  if (address === null) return null
  if (address.defaultInput.length > 0) {
    return { key: 'settings.input.default', params: { list: modalityLabel(address.defaultInput, t) } }
  }
  return { key: 'settings.input.defaultUnknown' }
}

/**
 * The capacity section's hint, or null when the section has nothing to say.
 *
 * The field holds what this route DECLARES; while it declares nothing the hint
 * has to say so, otherwise the placeholder (which is where the adapter's stated
 * fallback is shown) reads as if the window were declared.
 *
 * Null in two cases: the section is not rendered at all (no address and nothing
 * published), or the notice above already carries the reason the field is inert.
 * `capacityError` outranks both, because a rejected value is the user's own
 * immediate problem. A value the ADAPTER published survives the notice, for the
 * same reason the input hint does: it names a source, not a reason.
 * @param state - the panel state.
 * @returns the hint's copy line, or null.
 */
export function contextHintOf(state: PanelCopyState): CopyLine | null {
  if (state.capacityError) return { key: 'settings.context.invalid' }
  const address = state.address
  const published = state.capability?.contextWindow
  if (address !== null && address.contextWindow !== undefined) {
    return noticeOf(state) === null ? { key: 'settings.context.declared' } : null
  }
  // Same split as the input hint: a published number is the one thing the notice
  // does not already say, so it stays on screen beside it.
  if (published !== undefined) {
    return { key: 'settings.context.capability', params: { value: formatContext(published) } }
  }
  if (noticeOf(state) !== null) return null
  if (address === null) return null
  if (address.defaultContextWindow !== undefined) {
    return { key: 'settings.context.default', params: { value: formatContext(address.defaultContextWindow) } }
  }
  return { key: 'settings.context.unset' }
}

/**
 * The capacity a route's field shows, and the placeholder when it shows none.
 *
 * The placeholder is "the number in force while nothing is declared", so a value
 * the adapter published belongs there and never in `value`: `value` is the
 * declaration, and a declaration this route does not have must not look like one.
 * @param address - the resolved route address, or null.
 * @param capability - what the adapter published about the route, or null.
 * @returns the text for the field and its placeholder.
 */
export function contextFieldOf(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): { value: string, placeholder: string } {
  const declared = address?.contextWindow
  const fallback = capability?.contextWindow ?? address?.defaultContextWindow
  return {
    value: declared === undefined ? '' : formatContext(declared),
    placeholder: declared === undefined
      ? fallback === undefined ? CONTEXT_PLACEHOLDER : formatContext(fallback)
      : formatContext(declared),
  }
}

/**
 * Which modalities the two switches show as on, in the adapters' own precedence.
 * @param address - the resolved route address, or null.
 * @param capability - what the adapter published about the route, or null.
 * @returns the modality ids to show as enabled.
 */
export function shownInputOf(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): readonly string[] {
  if (address !== null && address.input.length > 0) return address.input
  const published = publishedInputOf(capability)
  if (published !== undefined) return published
  if (address !== null && address.defaultInput.length > 0) return address.defaultInput
  // A route with an address but no declared and no published list keeps the old
  // optimistic default; a route with NO address and nothing published gets an
  // empty list, and {@link showsInputSection} keeps that state off screen
  // entirely rather than drawing two switches as "unsupported".
  return address === null ? [] : PANEL_MODALITIES
}

/**
 * Whether the input section is rendered at all.
 *
 * It is the read-only sibling of {@link showsContextField}: a route with no
 * declaration and nothing published has no input truth to state, and the
 * switches that used to be drawn for it claimed the model takes neither text nor
 * images — a claim about the model that nothing had verified. The notice above
 * already explains that the route is view-only.
 * @param address - the resolved route address, or null.
 * @param capability - what the adapter published about the route, or null.
 * @returns whether the section belongs on screen.
 */
export function showsInputSection(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): boolean {
  return address !== null || publishedInputOf(capability) !== undefined
}

/**
 * Whether this route declares nothing at all — the one state where the head's
 * "restore defaults" button is disabled for a reason no notice states. Such a
 * route has no declaration to clear, so the button would be a no-op anyway; the
 * caller turns this into a sentence next to the sections rather than a `title` on
 * a control that cannot be focused to reveal it.
 * @param state - the panel state.
 * @returns whether the button needs its own explanation on screen.
 */
export function restoreIsEmpty(state: PanelCopyState): boolean {
  const address = state.address
  if (address === null) return false
  if (noticeKeyOf(state) !== null) return false
  return address.input.length === 0 && address.contextWindow === undefined
}

/**
 * Whether the capacity section is rendered at all: a route with no declaration
 * has nothing to declare into, and a disabled empty box explains nothing that
 * the notice above it does not already say — UNLESS the adapter published a
 * window, which the disabled field then shows as its placeholder (see
 * {@link contextFieldOf}).
 * @param address - the resolved route address, or null.
 * @param capability - what the adapter published about the route, or null.
 * @returns whether the field belongs on screen.
 */
export function showsContextField(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): boolean {
  return address !== null || capability?.contextWindow !== undefined
}

/** What committing the capacity field should do. */
export type CapacityAction =
  /** The field was never touched, or holds what is already declared: write nothing. */
  | { readonly kind: 'skip' }
  /** The text could not be read as a capacity: flag the field and write nothing. */
  | { readonly kind: 'reject' }
  /** An empty field means "declare nothing". */
  | { readonly kind: 'unset' }
  /** Declare this token count. */
  | { readonly kind: 'set', readonly value: number }
  /** Already what is declared, but spelled differently: just normalize the field. */
  | { readonly kind: 'normalize', readonly text: string }

/**
 * Decide what committing the capacity field should do, from the draft, the
 * Host's value for the route, and a parser.
 *
 * This is a decision the component used to take inline, and inline it was wrong
 * in two ways that only an adversarial review caught:
 *
 *   1. an UNTOUCHED field committed anyway. `onBlur` fires on every dismissal —
 *      clicking the trigger, the page, another window — and the field shows the
 *      Host's own value, so committing it meant an unprompted `settings/mutate`
 *      round-trip and a revision bump every time the card closed;
 *   2. a REJECTED draft was cleared by looking away, so tabbing out of an
 *      unreadable value made the warning vanish over text that was still
 *      invalid. Here `reject` is returned every time the text still fails to
 *      parse, so the flag stays up until the text changes.
 * @param draft - what the user has typed, or null when the field is untouched.
 * @param committed - the value the Host declares for this route, as text.
 * @param declaredTokens - the route's declared token count, if any.
 * @param parse - the parser to use (injectable so the gate can drive it).
 * @returns the action to take.
 */
export function capacityAction(
  draft: string | null,
  committed: string,
  declaredTokens: number | undefined,
  parse: (text: string) => number | null,
): CapacityAction {
  // Nothing typed, or the draft already equals what is declared — a `set` here
  // would be a no-op write.
  if (draft === null || draft === committed) return { kind: 'skip' }
  const text = draft.trim()
  if (text === '') {
    return declaredTokens === undefined ? { kind: 'skip' } : { kind: 'unset' }
  }
  const tokens = parse(text)
  if (tokens === null) return { kind: 'reject' }
  if (tokens === declaredTokens) return { kind: 'normalize', text: formatContext(tokens) }
  return { kind: 'set', value: tokens }
}
