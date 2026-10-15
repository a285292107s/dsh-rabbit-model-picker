/**
 * The read-only facts a model row states: whether it takes text, whether it
 * takes images, whether it can reason, and the context window.
 *
 * WHAT THIS REPLACES. The row used to carry an interactive effort pill: clicking
 * it opened a small anchored menu that submitted a whole
 * `{ provider, model, reasoningEffort }` selection. Effort is edited in the model
 * parameters panel now, so the row states facts instead of offering a control —
 * and this module is the single place that decides *which* facts are known.
 *
 * WHERE THE FACTS COME FROM. The composer catalog publishes only
 * `{ provider, model, reasoning }`, so the ability to reason is read from the
 * catalog entry (its `reasoning` metadata is present or not) while modalities
 * and capacity are read from the settings snapshot the panel
 * uses (`resolveRoute` over `describe`) and, where the settings document cannot
 * answer, from what the adapter PUBLISHED about its own route
 * (`capabilities.ts`). Modalities follow one rule with one exception: a fact
 * neither source can answer is left out rather than rendered as "unsupported"
 * — the same rule the panel follows when it refuses to offer a switch that
 * would do nothing — EXCEPT text. Text is the floor capability of every
 * conversational model, so an unanswered modality list still states "supports
 * text"; leaving it out made the strip fall silent on models whose modalities
 * the adapter had not published yet. `off` therefore means "an explicit
 * declaration, adapter default, or published catalog really omits this" for
 * every fact but text, and for text it means only an explicit non-text list.
 *
 * THE PRECEDENCE IS THE ADAPTERS' OWN, not this plugin's taste. Both adapters
 * resolve a route as `declared field ?? installed catalog ?? configured default`
 * (verified in `llm-pi-ai`'s `resolveEntry` and `dsh-opencode-go`'s
 * `modelInfo`), so the strip reads the same ladder: what the profile declares,
 * then what the adapter publishes per model, then the adapter's provider-wide
 * default. Reading them in any other order would state a window the adapter is
 * not actually using.
 *
 * ONE FACT = ONE BADGE. The four facts used to be four differently shaped
 * chips: the two boolean ones were icon-only capsules and the two valued ones
 * were icon + text, so a row stated the same kind of thing in two weights and
 * the strip read as a bag of parts. Every fact is now the same capsule — one
 * square icon cell plus a text cell — which is what lets `.dmp-badges` line the
 * four up on one baseline and what makes "a badge is a fact" true by shape
 * rather than by convention. Three of the four facts are true/false and state
 * whose truth (`text`, `image`, `effort` — the last means the model CAN reason,
 * not how hard it is set), and only the one that names a value prints it
 * (`1M`). The effort in force is a setting, so it lives on the trigger and in
 * the panel, never in the row.
 *
 * THE WINDOW VALUE IS ROUNDED FOR READING, NEVER FOR WRITING: the row prints
 * `1M` / `128K`, while `parseContext` (the parameter panel's own reader) keeps
 * accepting exactly what it always did and the stored token count is untouched.
 *
 * @module dsh-rabbit-model-picker/client/badges
 */

import type { ModelReasoning, RouteAddress, RouteCapability, Translate } from './contract.ts'
import type { BadgeFact } from './facts.ts'
import { formatWindow } from './format.ts'

export type { BadgeFact }

/**
 * Canonical reading order of the four facts. The row renders them in this order
 * and the offline gates publish it, so the order is stated once.
 */
export const BADGE_FACTS: readonly BadgeFact[] = ['text', 'image', 'effort', 'context']

/** One badge to render, and the copy that explains it. */
export interface BadgeSpec {
  /** Which fact this badge states (also the icon's identity). */
  readonly fact: BadgeFact
  /** The fact is absent: the row drops it (see `Picker`'s `!off` filter). */
  readonly off: boolean
  /** Text after the icon; '' renders the icon alone (nothing to name). */
  readonly value: string
  /** One localized sentence: the badge's tooltip and its share of the row's name. */
  readonly sentence: string
}

/** Everything the badges of one row are derived from. */
export interface BadgeInput {
  /** This route's declaration, or null when the route cannot be addressed at all. */
  readonly address: RouteAddress | null
  /** What the adapter published about this exact route, when it was read. */
  readonly capability?: RouteCapability | undefined
  /** The catalog entry's reasoning metadata, when the adapter declares any. */
  readonly reasoning: ModelReasoning | undefined
  /** Translator for the plugin namespace. */
  readonly t: Translate
}

/**
 * The modality list in force for one route, in the adapters' own precedence.
 * @param address - the route's declaration, or null when it has none.
 * @param capability - what the adapter published about the route, when read.
 * @returns the declared list, else the published one, else the adapter default;
 *   undefined when none of the three is readable.
 */
function modalitiesOf(
  address: RouteAddress | null, capability: RouteCapability | undefined,
): readonly string[] | undefined {
  if (address !== null && address.input.length > 0) return address.input
  if (capability?.inputModalities !== undefined && capability.inputModalities.length > 0) {
    return capability.inputModalities
  }
  if (address !== null && address.defaultInput.length > 0) return address.defaultInput
  return undefined
}

/**
 * The context window in force for one route, in the adapters' own precedence.
 * @param address - the route's declaration, or null when it has none.
 * @param capability - what the adapter published about the route, when read.
 * @returns the declared window, else the published one, else the adapter
 *   default; undefined when none of the three is readable.
 */
function capacityOf(
  address: RouteAddress | null, capability: RouteCapability | undefined,
): number | undefined {
  return address?.contextWindow ?? capability?.contextWindow ?? address?.defaultContextWindow
}

/**
 * Derive the facts of one model row, in {@link BADGE_FACTS} order.
 * @param input - see {@link BadgeInput}.
 * @returns 1–4 badges; the sections whose facts are not readable are omitted.
 */
export function badgeSpecsOf({ address, capability, reasoning, t }: BadgeInput): BadgeSpec[] {
  const specs: BadgeSpec[] = []

  const modalities = modalitiesOf(address, capability)

  // TEXT IS THE FLOOR, NOT A CLAIM THAT CAN BE UNKNOWN. A conversational model
  // takes text by definition, so a modality list no source can answer states
  // "supports text" — it never erases the one capability that is never absent.
  // (That is the deliberate exception to the "leave an unread fact out" rule
  // below: leaving text out made the strip fall silent on models the adapter
  // had simply not published modalities for yet, which read as "no text input".)
  // Only a list that explicitly omits text can mark it absent.
  const text = modalities === undefined || modalities.includes('text')
  specs.push({
    fact: 'text',
    off: !text,
    value: '',
    sentence: t(text ? 'badge.text.on' : 'badge.text.off'),
  })

  // IMAGES ARE A REAL, OPTIONAL CAPABILITY, SO UNKNOWN MEANS NO CLAIM. When no
  // source can answer whether the route takes them, the badge rides `off`, and
  // the row's `!off` filter drops it — the strip stays silent rather than
  // guessing either way. An explicit list that omits image reads the same way.
  const image = modalities !== undefined && modalities.includes('image')
  specs.push({
    fact: 'image',
    off: !image,
    value: '',
    sentence: t(image ? 'badge.image.on' : 'badge.image.off'),
  })

  if (reasoning === undefined) {
    // No levels are declared, so the model states no thinking ability at all.
    specs.push({ fact: 'effort', off: true, value: '', sentence: t('badge.effort.off') })
  } else {
    // A declared ladder of levels is the whole fact: the row says the model CAN
    // reason, not how hard it is currently set. The effort in force belongs to
    // the trigger (which names the model and its level) and the parameter panel
    // (which edits it), never to the row — a row is a fact, not a setting.
    specs.push({ fact: 'effort', off: false, value: '', sentence: t('badge.effort.on') })
  }

  const capacity = capacityOf(address, capability)
  if (capacity !== undefined) {
    const value = formatWindow(capacity)
    // A capacity the formatter cannot spell as a whole number is not stated at
    // all: an icon with no figure would read as "this model declares a window,
    // we just will not say how big", which is worse than the badge being absent.
    if (value !== '') {
      specs.push({ fact: 'context', off: false, value, sentence: t('badge.context', { value }) })
    }
  }

  return specs
}
