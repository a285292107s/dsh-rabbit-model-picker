
import { CONTEXT_PLACEHOLDER, PANEL_MODALITIES, formatContext } from './params.ts'
import type { ParamsSnapshot, RouteAddress, RouteCapability, Translate } from './contract.ts'

export interface CopyLine {
  readonly key: string
  readonly params?: Record<string, string>
}

export interface PanelCopyState {
  readonly address: RouteAddress | null
  readonly capability: RouteCapability | null
  readonly snapshot: Pick<ParamsSnapshot, 'status' | 'error' | 'writable'>
  readonly busy: boolean
  readonly capacityError: boolean
}

export interface PanelCopy {
  readonly notice: string | null
  readonly inputHint: string
  readonly contextHint: string | null
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

export function inputHintOf(state: PanelCopyState, t: Translate): CopyLine | null {
  const address = state.address
  const published = publishedInputOf(state.capability)
  if (address !== null && address.input.length > 0) {
    return noticeOf(state) === null
      ? { key: 'settings.input.declared', params: { list: modalityLabel(address.input, t) } }
      : null
  }
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

export function contextHintOf(state: PanelCopyState): CopyLine | null {
  if (state.capacityError) return { key: 'settings.context.invalid' }
  const address = state.address
  const published = state.capability?.contextWindow
  if (address !== null && address.contextWindow !== undefined) {
    return noticeOf(state) === null ? { key: 'settings.context.declared' } : null
  }
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

export function restoreIsEmpty(state: PanelCopyState): boolean {
  const address = state.address
  if (address === null) return false
  if (noticeKeyOf(state) !== null) return false
  return address.input.length === 0 && address.contextWindow === undefined
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
