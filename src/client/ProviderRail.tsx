/**
 * The provider rail: the model card's LEFT pane.
 *
 * It answers one question — which providers exist, and which one the list beside
 * it is scoped to — and it is the only place that scope is chosen. It replaced a
 * separate provider popover (§5.25): the narrowing used to live in its own
 * anchored card whose only exit was a strip inside the model card, so being
 * scoped was a mode the user had to notice and remember. A visible rail makes
 * the scope, its full extent ("全部") and the way out of it one and the same
 * row of pixels.
 *
 * The rail is a listbox with roving focus: exactly one option is tabbable, the
 * arrows move real focus between the rest. It owns and stops the keys it
 * consumes, because the seat's own handler is listening on the ancestor for
 * arrows that walk the model list.
 *
 * Two facts ride on a row, and they must not be confused with each other — and
 * each has its own channel, so the two can never be mistaken for one another:
 *   - the SCOPE (aria-selected) is the row this list is narrowed to, drawn as
 *     the sunken fill plus a 1px inset ring in the strong line ink (an inset
 *     ring, not a border, so the row's width budget is untouched);
 *   - the SESSION's provider (aria-current) is the one this conversation
 *     actually runs on, drawn as a 2px host-blue bar at the row's leading edge
 *     plus a name one weight heavier. It carries no words: at rail width the words
 *     would push the provider name into an ellipsis, which is the one job this
 *     pane cannot fail at — and the fact is already spelled out beside the card,
 *     where the seat's trigger names the selected model's provider.
 *
 * A check mark is deliberately NOT used here: the model rows already spend that
 * mark on "the model in use", and re-using it for a SCOPE would say the rail's
 * pick is the same claim as the list's pick. The fill+ring reads as "this is the
 * filter", the bar as "this is where you are".
 *
 * @module dsh-rabbit-model-picker/client/ProviderRail
 */

import type { KeyboardEvent, MutableRefObject } from 'react'
import type { Translate } from './contract.ts'

/**
 * The two-digit ordinal the rail paints beside a scope.
 *
 * It is DECORATION, not a scope's identity: the name is the fact, and the number
 * only turns the pane into a numbered list. Kept as a plain function so the
 * render site stays one brace expression (no copy call, no string literal) — the
 * decoration gate reads exactly that shape.
 * @param index - zero-based option index.
 * @returns the ordinal padded to two digits (01, 02, …).
 */
const ordinalOf = (index: number): string => `${index + 1}`.padStart(2, '0')

/**
 * One row of the rail. `id: null` is the "all providers" scope.
 *
 * It is a scope list, so the unfiltered row is a real member rather than a
 * pseudo-provider: without it there is no way back to every provider once the
 * list is scoped, which is the trap §5.21 shipped and §5.25 removes.
 */
export interface ProviderOption {
  /** Provider id, or null for the unfiltered row. */
  readonly id: string | null
  /** Display label (account provider already localized by the caller). */
  readonly label: string
  /** Models this provider currently offers (the whole catalog for the null row). */
  readonly count: number
  /** The provider's catalog lookup failed: listed for visibility, never selectable. */
  readonly failed: boolean
  /** This conversation currently runs on this provider (marked on the row). */
  readonly session: boolean
}

/** Props of the provider rail. */
export interface ProviderRailProps {
  /** Every scope, the unfiltered one first, then providers, then failures. */
  readonly options: readonly ProviderOption[]
  /** The active scope; null when the list is not narrowed. */
  readonly current: string | null
  /**
   * Index of the row that holds the rail's single tab stop. It is never a
   * disabled row: a failed provider cannot take focus, so parking the stop there
   * would make the whole pane unreachable by `Tab`.
   */
  readonly stopIndex: number
  /** A selection is in flight: every row is inert. */
  readonly busy: boolean
  /** Translator for the plugin namespace. */
  readonly t: Translate
  /** The parent's row refs, so its `Tab` chain can start at the rail's stop. */
  readonly refs: MutableRefObject<(HTMLButtonElement | null)[]>
  /** Commit a scope, or null for every provider. */
  readonly onPick: (id: string | null) => void
  /** Hand the keyboard to the model list beside this pane. */
  readonly onEnterList: () => void
}

/**
 * Render the provider rail.
 * @param props - see {@link ProviderRailProps}.
 * @returns the rail element.
 */
export function ProviderRail({
  options, current, stopIndex, busy, t, refs, onPick, onEnterList,
}: ProviderRailProps) {
  /** The rows the keyboard may land on: a failed provider is not one of them. */
  const usableOf = (): { option: ProviderOption; index: number }[] =>
    options.map((option, index) => ({ option, index })).filter(({ option }) => !option.failed)

  /**
   * Move real focus along the usable rows, wrapping at both ends.
   * @param delta - +1 forward, -1 backward.
   */
  const move = (delta: number): void => {
    if (busy) return
    const usable = usableOf()
    if (usable.length === 0) return
    const active = usable.findIndex(({ index }) => refs.current[index] === document.activeElement)
    const next = active === -1
      ? (delta > 0 ? 0 : usable.length - 1)
      : (active + delta + usable.length) % usable.length
    const target = usable[next]
    if (target !== undefined) refs.current[target.index]?.focus()
  }

  /**
   * Jump to an end of the usable rows.
   * @param first - the first usable row, else the last.
   */
  const jump = (first: boolean): void => {
    if (busy) return
    const usable = usableOf()
    const target = usable[first ? 0 : usable.length - 1]
    if (target !== undefined) refs.current[target.index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // The rail owns the arrows in BOTH layouts: it is a listbox, and the
        // ancestor's handler would otherwise walk the model list while the user
        // is standing in the provider pane.
        event.preventDefault()
        event.stopPropagation()
        move(event.key === 'ArrowDown' ? 1 : -1)
        return
      case 'Home':
      case 'End':
        event.preventDefault()
        event.stopPropagation()
        jump(event.key === 'Home')
        return
      case 'ArrowRight':
        // One meaning in either layout: step into the list this pane scopes.
        event.preventDefault()
        event.stopPropagation()
        onEnterList()
        return
      case 'Enter':
      case ' ': {
        const index = refs.current.findIndex(element => element === document.activeElement)
        const option = index === -1 ? undefined : options[index]
        if (option === undefined || option.failed || busy) return
        event.preventDefault()
        event.stopPropagation()
        onPick(option.id)
        return
      }
      default:
        // `Tab` and `Escape` stay unhandled on purpose: traversal and leaving the
        // card are the seat's own contract, not this level's.
    }
  }

  // Assigned by the render below, in `options` order, so an index in `refs`
  // always names the same row as the same index in `options`.
  refs.current = []

  return (
    <div
      className="dmp-rail"
      role="listbox"
      aria-label={t('provider.group')}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.id ?? 'all'}
          ref={(element) => { refs.current[index] = element }}
          type="button"
          role="option"
          aria-selected={option.id === current}
          // The provider this conversation runs on. `aria-current` is the
          // machine-readable half, the heavier name is the visible one; the words
          // are on the seat's chip, which stays on screen beside this card.
          aria-current={option.session ? 'true' : undefined}
          className="dmp-rail-row"
          tabIndex={index === stopIndex ? 0 : -1}
          disabled={busy || option.failed}
          title={option.label}
          onClick={() => { onPick(option.id) }}
        >
          {/* The two-digit ordinal of the scope list — a quiet index, not a
              label. It is decoration (the row's name is the fact), so it is
              aria-hidden; the mute-ink numeral uses tabular figures. */}
          <span className="dmp-rail-index" aria-hidden="true">{ordinalOf(index)}</span>
          <span className="dmp-rail-copy">
            <span className="dmp-rail-name">{option.label}</span>
          </span>
          {/* The count is the reason to pick one provider over another, and it is
              the same list the pick below it opens. A failed provider trades it
              for the only thing that can explain an empty pane. */}
          {option.failed
            ? (
                <span className="dmp-provider-failed">
                  <span className="dmp-provider-failed-dot" aria-hidden="true" />
                  {t('provider.failed')}
                </span>
              )
            : <span className="dmp-provider-count">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
