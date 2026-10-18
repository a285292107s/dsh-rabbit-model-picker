export const CHAIN_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]'

function isDisabled(element: HTMLElement): boolean {
  return (element as { disabled?: unknown }).disabled === true
}

export function isChainMember(element: HTMLElement): boolean {
  if (isDisabled(element)) return false
  if (element.getAttribute('role') === 'option') return element.tabIndex === 0
  return true
}

export function cardChainOf(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CHAIN_SELECTOR)).filter(isChainMember)
}

export type ChainStep =
  | { readonly kind: 'focus'; readonly element: HTMLElement }
  | { readonly kind: 'close' }
  | { readonly kind: 'none' }

export function stepChain(chain: readonly HTMLElement[], active: Element | null, delta: number): ChainStep {
  if (chain.length === 0) return { kind: 'none' }
  const index = active === null ? -1 : chain.indexOf(active as HTMLElement)
  const next = index === -1 ? (delta > 0 ? 0 : chain.length - 1) : index + delta
  if (next < 0) return { kind: 'close' }
  const element = chain[next % chain.length]
  return element === undefined ? { kind: 'none' } : { kind: 'focus', element }
}
