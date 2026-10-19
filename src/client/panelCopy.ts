import { PANEL_MODALITIES, formatContext } from './params.ts'
import type { ParamsSnapshot, RouteAddress, RouteCapability, Translate } from './contract.ts'

export interface CopyLine {
  readonly key: string
  readonly params?: Record<string, string>
}

export interface PanelCopyState {
  readonly address: RouteAddress | null
  readonly capability: RouteCapability | null
  readonly snapshot: Pick<ParamsSnapshot, 'status' | 'error' | 'writable'>
  readonly capacityError: boolean
}

export type FactSource = 'declared' | 'catalog' | 'default' | 'none'

export const FACT_SOURCE_KEYS: Readonly<Record<FactSource, string>> = {
  declared: 'settings.source.declared',
  catalog: 'settings.source.catalog',
  default: 'settings.source.default',
  none: 'settings.source.none',
}

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

function publishedInputOf(capability: RouteCapability | null): readonly string[] | undefined {
  const published = capability?.inputModalities
  return published === undefined || published.length === 0 ? undefined : published
}

export function noticeOf(state: PanelCopyState): CopyLine | null {
  const line = noticeKeyOf(state)
  if (line === null) return null
  return line.key === 'settings.loadFailed'
    ? { key: line.key, params: { message: state.snapshot.error ?? '' } }
    : line
}

export function noticeKeyOf(state: PanelCopyState): CopyLine | null {
  if (state.snapshot.status === 'loading' || state.snapshot.status === 'idle') {
    return { key: 'settings.loading' }
  }
  if (state.snapshot.status === 'unavailable') return { key: 'settings.unavailable' }
  if (state.snapshot.status === 'error') return { key: 'settings.loadFailed' }
  if (state.address === null) return { key: 'settings.unaddressable' }
  if (!state.snapshot.writable) return { key: 'settings.readonly' }
  return null
}

export function inputSourceOf(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): FactSource {
  if (address !== null && address.input.length > 0) return 'declared'
  if (publishedInputOf(capability) !== undefined) return 'catalog'
  if (address !== null && address.defaultInput.length > 0) return 'default'
  return 'none'
}

export function contextFactOf(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): { readonly value: number | undefined; readonly source: FactSource } {
  if (address !== null && address.contextWindow !== undefined) {
    return { value: address.contextWindow, source: 'declared' }
  }
  if (capability?.contextWindow !== undefined) {
    return { value: capability.contextWindow, source: 'catalog' }
  }
  if (address !== null && address.defaultContextWindow !== undefined) {
    return { value: address.defaultContextWindow, source: 'default' }
  }
  return { value: undefined, source: 'none' }
}

export function contextFieldOf(address: RouteAddress | null): { readonly value: string } {
  const declared = address?.contextWindow
  return { value: declared === undefined ? '' : formatContext(declared) }
}

export function shownInputOf(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): readonly string[] {
  if (address !== null && address.input.length > 0) return address.input
  const published = publishedInputOf(capability)
  if (published !== undefined) return published
  if (address !== null && address.defaultInput.length > 0) return address.defaultInput
  return address === null ? [] : PANEL_MODALITIES
}

export function showsInputSection(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): boolean {
  return address !== null || publishedInputOf(capability) !== undefined
}

export function showsContextField(
  address: RouteAddress | null, capability: RouteCapability | null = null,
): boolean {
  return address !== null || capability?.contextWindow !== undefined
}

export type CapacityAction =
  | { readonly kind: 'skip' }
  | { readonly kind: 'reject' }
  | { readonly kind: 'unset' }
  | { readonly kind: 'set', readonly value: number }
  | { readonly kind: 'normalize', readonly text: string }

export function capacityAction(
  draft: string | null,
  committed: string,
  declaredTokens: number | undefined,
  parse: (text: string) => number | null,
): CapacityAction {
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
