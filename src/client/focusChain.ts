/**
 * The card's `Tab` chain: which controls the keyboard walks, in what order.
 *
 * WHY THIS IS ITS OWN MODULE. The chain used to be assembled inside the component
 * from refs — the rail's stop, the search box, then each row — and a list written
 * by hand has to be kept in step with the JSX by hand. Three controls that exist
 * in only one state had drifted out of it: the search field's clear button, the
 * "show all providers" button, and the retry button on a read that failed. The
 * card cancels `Tab` and walks its own chain, so the browser cannot reach them
 * either: all three were pointer-only, and "reload the group that failed to load"
 * had no other way in at all. That is a WCAG 2.1.1 failure, not an inconvenience.
 * `SettingsMenu` lost its two switches to the same mistake and was fixed the same
 * way (DESIGN §5.10, caveat 2).
 *
 * Reading the DOM fixes the class of bug rather than the instance, and moving the
 * reading here means the rules can be driven directly by the unit gate instead of
 * only being pattern-matched in the source.
 *
 * @module dsh-rabbit-model-picker/client/focusChain
 */

/**
 * Everything the card could put focus on.
 *
 * `[tabindex]` is in the query on purpose: a model row is a `div` at `tabIndex=-1`
 * rather than a button, so the platform's tabbable set alone would miss every row
 * of the list. Whether a candidate belongs in the chain is decided by
 * {@link isChainMember}, not by whether the browser would have tabbed to it
 * unaided.
 */
export const CHAIN_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]'

/**
 * Whether the platform considers a control unusable, which is exactly when it is
 * not a tab stop.
 *
 * Asked of the `disabled` property rather than of `instanceof HTMLButtonElement`,
 * so the rule covers every element that carries one and can be exercised without
 * a browser.
 * @param element - a candidate chain member.
 * @returns true when `disabled` would keep the browser from focusing it.
 */
function isDisabled(element: HTMLElement): boolean {
  return (element as { disabled?: unknown }).disabled === true
}

/**
 * Whether one focusable element is a member of the card's chain.
 *
 * Two rules, each about a control the browser would treat differently than the
 * card does:
 *
 * 1. A `disabled` control is not a tab stop. The rail's rows are all disabled
 *    while a selection is in flight, and a chain that kept one would swallow the
 *    keypress that lands on it (`.focus()` on a disabled button does nothing), so
 *    `Shift+Tab` off the search box would look dead for the length of the write.
 *    The model rows carry `aria-disabled` instead precisely so the keyboard is NOT
 *    dropped during a selection — which is why this asks about `disabled` and not
 *    about `aria-disabled`.
 * 2. A listbox is ONE tab stop, not one per row: its arrows move within it, and
 *    `ProviderRail` keeps exactly one row at `tabIndex=0` for that reason. Every
 *    other row of it sits at `-1`, the same value a model row uses to mean "in the
 *    chain", so `tabIndex` alone cannot tell the two apart and the role has to.
 * @param element - a candidate found by {@link CHAIN_SELECTOR}.
 * @returns true when the card's chain should include it.
 */
export function isChainMember(element: HTMLElement): boolean {
  if (isDisabled(element)) return false
  if (element.getAttribute('role') === 'option') return element.tabIndex === 0
  return true
}

/**
 * The card's chain, in the order the card renders it.
 *
 * `querySelectorAll` answers in document order, which is the render order — the
 * rail first (it is the card's first pane, and on a narrow card the same DOM lays
 * out above the list), then the search box and its own buttons, then the rows.
 * @param root - the card's root element.
 * @returns its chain members, in order.
 */
export function cardChainOf(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CHAIN_SELECTOR)).filter(isChainMember)
}

/** What one `Tab` press does. */
export type ChainStep =
  | { readonly kind: 'focus'; readonly element: HTMLElement }
  /** Stepped back off the chain's first member: the seat closes, as `Escape` does. */
  | { readonly kind: 'close' }
  /** Nothing to move to. */
  | { readonly kind: 'none' }

/**
 * Where one `Tab` press lands.
 *
 * The ends behave differently on purpose. Stepping forward off the last member
 * wraps to the first — traversal never leaves the card — while stepping BACK off
 * the first member closes the seat, which is how the keyboard leaves it at all
 * (`Shift+Tab` from the rail is the documented way out, and it hands focus to the
 * trigger). Focus that is not on the chain at all — the card itself, or a control
 * that vanished under it — enters at the end the press is heading away from.
 * @param chain - the chain, in render order.
 * @param active - the element that currently holds focus, if any.
 * @param delta - +1 forward, -1 backward.
 * @returns what the caller should do.
 */
export function stepChain(chain: readonly HTMLElement[], active: Element | null, delta: number): ChainStep {
  if (chain.length === 0) return { kind: 'none' }
  const index = active === null ? -1 : chain.indexOf(active as HTMLElement)
  const next = index === -1 ? (delta > 0 ? 0 : chain.length - 1) : index + delta
  if (next < 0) return { kind: 'close' }
  const element = chain[next % chain.length]
  return element === undefined ? { kind: 'none' } : { kind: 'focus', element }
}
