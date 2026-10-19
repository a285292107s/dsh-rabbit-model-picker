import {
  IconWarningOutlineRegular, Input, MenuSurface, Switch, useAnchoredPosition,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  rowKey, type CapabilityFace, type CapabilitySnapshot, type DirectoryStore, type ModelRoute,
  type ModelSelection, type ParamsFace, type ParamsSnapshot, type RouteAddress, type RouteCapability,
  type SettingsOp, type Translate,
} from './contract.ts'
import { effortChoicesOf } from './effort.ts'
import { formatWindow } from './format.ts'
import {
  capacityAction, contextFactOf, contextFieldOf, FACT_SOURCE_KEYS, inputSourceOf, modalityLabel,
  noticeOf, shownInputOf, showsContextField, showsInputSection,
} from './panelCopy.ts'
import { formatContext, PANEL_MODALITIES, parseContext, resolveRoute } from './params.ts'

const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

const CONTEXT_PRESETS = [
  { value: 128_000, label: '128K' },
  { value: 256_000, label: '256K' },
  { value: 512_000, label: '512K' },
  { value: 1_000_000, label: '1M' },
] as const

export interface SettingsMenuProps {
  readonly anchorRef: RefObject<HTMLElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  readonly idPrefix: string
  readonly side: 'top' | 'bottom'
  readonly directory: DirectoryStore
  readonly params: ParamsFace
  readonly capabilities: CapabilityFace
  readonly busy: boolean
  readonly maxHeight?: number | undefined
  readonly t: Translate
  readonly onSelect: (selection: ModelSelection) => void
  readonly onClose: (restoreToGear: boolean) => void
}

function modelOf(store: DirectoryStore, route: ModelRoute) {
  const group = store.getSnapshot().groups.find(candidate => candidate.id === route.provider)
  return group?.models.find(candidate => candidate.id === route.model) ?? null
}

function providerNameOf(store: DirectoryStore, providerId: string, t: Translate): string {
  if (providerId === 'deepseek-account') return t('provider.account')
  const group = store.getSnapshot().groups.find(candidate => candidate.id === providerId)
  return group?.name ?? providerId
}

export function SettingsMenu({
  anchorRef, panelRef, idPrefix, side, directory, params, capabilities, busy, maxHeight, t, onSelect, onClose,
}: SettingsMenuProps) {
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null)
  const [capacityError, setCapacityError] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const capacityRef = useRef<HTMLInputElement | null>(null)
  const skipCapacityCommit = useRef(false)
  const focusCustom = useRef(false)

  const current = useSyncExternalStore(
    subscribe => directory.subscribe(subscribe),
    () => directory.getSnapshot().current,
  )
  const snapshot: ParamsSnapshot = useSyncExternalStore(
    subscribe => params.subscribe(subscribe),
    () => params.getSnapshot(),
  )
  const catalog: CapabilitySnapshot = useSyncExternalStore(
    subscribe => capabilities.subscribe(subscribe),
    () => capabilities.getSnapshot(),
  )
  const position = useAnchoredPosition({ open: true, anchorRef, panelRef, side, align: 'end', gap: 8, margin: 12 })

  useEffect(() => { void params.refresh() }, [params])

  const route: ModelRoute | null = current === null ? null : { provider: current.provider, model: current.model }
  const address: RouteAddress | null = useMemo(
    () => resolveRoute(snapshot, route),
    [snapshot, route?.provider, route?.model],
  )
  const capability: RouteCapability | null = route === null
    ? null
    : catalog.routes[rowKey(route.provider, route.model)] ?? null
  useEffect(() => {
    if (route !== null) capabilities.ensure([route.provider])
  }, [capabilities, route?.provider])
  const model = route === null ? null : modelOf(directory, route)
  const reasoning = model?.reasoning
  const choices = useMemo(
    () => reasoning === undefined ? [] : effortChoicesOf(reasoning, t),
    [reasoning, t],
  )
  const activeEffort = current?.reasoningEffort ?? reasoning?.defaultEffort
  const modelLabel = model?.name ?? (route === null ? '' : `${route.provider}/${route.model}`)
  const providerName = route === null ? '' : providerNameOf(directory, route.provider, t)
  const inputLabelId = `${idPrefix}-settings-input-label`
  const contextLabelId = `${idPrefix}-settings-context-label`
  const effortLabelId = `${idPrefix}-settings-effort-label`

  const copyState = { address, capability, snapshot, capacityError } as const
  const noticeLine = noticeOf(copyState)
  const sectionNotice = noticeLine === null ? null : t(noticeLine.key, noticeLine.params)

  const shownInput = shownInputOf(address, capability)
  const inputSource = inputSourceOf(address, capability)
  const inputExtras = shownInput.filter(modality => !(PANEL_MODALITIES as readonly string[]).includes(modality))
  const inputValue = inputExtras.length === 0 ? null : modalityLabel(shownInput, t)
  const contextFact = contextFactOf(address, capability)
  const declaredContext = address?.contextWindow
  const contextPreset = declaredContext === undefined
    ? undefined
    : CONTEXT_PRESETS.find(preset => preset.value === declaredContext)
  const customMode = customOpen || (declaredContext !== undefined && contextPreset === undefined)
  const contextValue = declaredContext !== undefined
    ? null
    : contextFact.value === undefined
      ? t('settings.value.notSet')
      : formatWindow(contextFact.value)
  const contextPlaceholder = declaredContext !== undefined
    ? t('settings.context.placeholderDeclared')
    : contextFact.value === undefined
      ? t('settings.context.placeholderExample')
      : t('settings.context.placeholderInherited')
  const contextField = contextFieldOf(address)
  const editable = address !== null && snapshot.writable && !writing
  const capacity = capacityDraft ?? contextField.value

  const chain = (): HTMLElement[] => {
    const panel = panelRef.current
    if (panel === null) return []
    return [
      ...panel.querySelectorAll<HTMLElement>('[role="switch"]'),
      ...panel.querySelectorAll<HTMLElement>('.dmp-context-preset'),
      panel.querySelector<HTMLElement>('.dmp-settings-field input'),
      ...panel.querySelectorAll<HTMLElement>('.dmp-effort-item'),
      panel.querySelector<HTMLElement>('.dmp-settings-foot .zmd-btn-ghost'),
    ].filter((item): item is HTMLElement => item !== null && !item.hasAttribute('disabled'))
  }

  const tookFocus = useRef(false)

  useLayoutEffect(() => {
    if (position === null || tookFocus.current) return
    tookFocus.current = true
    panelRef.current?.focus()
  }, [position])

  const addressId = address === null ? '' : `${address.ns}#${address.entryPath.join('.')}`
  useEffect(() => {
    setCustomOpen(false)
    setCapacityDraft(null)
    setCapacityError(false)
    setWriteError(null)
  }, [addressId, contextField.value])

  useEffect(() => {
    if (!customMode || !focusCustom.current) return
    focusCustom.current = false
    capacityRef.current?.focus()
  }, [customMode])

  const move = (delta: number): void => {
    const items = chain()
    if (items.length === 0) return
    const active = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1
    const next = active === -1 ? (delta > 0 ? 0 : items.length - 1) : (active + delta + items.length) % items.length
    items[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'Escape':
      case 'ArrowLeft':
        event.preventDefault()
        event.stopPropagation()
        onClose(true)
        return
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        move(event.shiftKey ? -1 : 1)
        return
      default:
    }
  }

  const write = (ops: readonly SettingsOp[], done?: () => void, failed?: () => void): void => {
    if (address === null) return
    setWriting(true)
    setWriteError(null)
    void params.write(address.ns, ops, address.revision).then((outcome) => {
      setWriting(false)
      if (!outcome.ok) {
        failed?.()
        setWriteError(outcome.message)
        return
      }
      done?.()
    })
  }

  const presetPointerDown = (): void => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.closest('.dmp-settings-field') !== null) {
      skipCapacityCommit.current = true
    }
  }

  const choosePreset = (value: number): void => {
    if (address === null || !editable) return
    setCustomOpen(false)
    setCapacityDraft(null)
    setCapacityError(false)
    if (address.contextWindow === value) return
    write([{ op: 'set', path: [...address.entryPath, 'contextWindow'], value }])
  }

  const toggleCustom = (): void => {
    if (address === null || !editable) return
    if (!customMode) {
      focusCustom.current = true
      setCustomOpen(true)
      return
    }
    if (declaredContext !== undefined && contextPreset === undefined) {
      capacityRef.current?.focus()
      return
    }
    if (capacityDraft !== null && capacityDraft !== contextField.value) {
      capacityRef.current?.focus()
      return
    }
    setCustomOpen(false)
    setCapacityDraft(null)
    setCapacityError(false)
  }

  const commitCapacity = (): void => {
    if (skipCapacityCommit.current) {
      skipCapacityCommit.current = false
      return
    }
    if (address === null || !editable) return
    const action = capacityAction(capacityDraft, contextField.value, address.contextWindow, parseContext)
    switch (action.kind) {
      case 'skip':
        return
      case 'reject':
        setCapacityError(true)
        return
      case 'normalize':
        setCapacityError(false)
        setCapacityDraft(action.text)
        return
      case 'unset':
        setCapacityError(false)
        write(
          [{ op: 'unset', path: [...address.entryPath, 'contextWindow'] }],
          () => { setCapacityDraft(null) },
          () => { setCapacityDraft(null) },
        )
        return
      case 'set':
        setCapacityError(false)
        write(
          [{ op: 'set', path: [...address.entryPath, 'contextWindow'], value: action.value }],
          () => { setCapacityDraft(formatContext(action.value)) },
          () => { setCapacityDraft(null) },
        )
    }
  }

  const toggleModality = (modality: string, on: boolean): void => {
    if (address === null || !editable) return
    const next = new Set(shownInput)
    if (on) next.add(modality)
    else next.delete(modality)
    const known = PANEL_MODALITIES.filter(candidate => next.has(candidate))
    const extras = shownInput.filter(candidate => !(PANEL_MODALITIES as readonly string[]).includes(candidate))
    const list = [...known, ...extras.filter(candidate => candidate !== modality)]
    if (list.length === 0) {
      setWriteError(t('settings.input.needOne'))
      return
    }
    write([{ op: 'set', path: [...address.entryPath, address.inputField], value: list }])
  }

  const restoreDefaults = (): void => {
    if (address === null || !editable) return
    const ops: SettingsOp[] = []
    if (address.contextWindow !== undefined) {
      ops.push({ op: 'unset', path: [...address.entryPath, 'contextWindow'] })
    }
    if (address.input.length > 0) {
      ops.push({ op: 'unset', path: [...address.entryPath, address.inputField] })
    }
    if (ops.length === 0) return
    write(ops)
  }

  const pickEffort = (effort: string | undefined): void => {
    if (route === null || reasoning === undefined || busy) return
    if ((activeEffort ?? undefined) === effort) return
    onSelect({
      provider: route.provider,
      model: route.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    })
  }

  if (route === null) return null

  const notice: ReactNode = writeError !== null
    ? (
        <div className="dmp-settings-alert" role="alert">
          <IconWarningOutlineRegular className="dmp-settings-alert-icon" />
          <span>{t('settings.writeFailed', { message: writeError })}</span>
        </div>
      )
    : sectionNotice === null
      ? null
      : <div className="dmp-settings-notice">{sectionNotice}</div>

  return createPortal(
    <MenuSurface
      ref={panelRef}
      id={`${idPrefix}-settings`}
      className="dmp-menu dmp-settings"
      style={position === null ? MEASURE_STYLE : { ...position, maxHeight }}
      role="dialog"
      aria-label={t('settings.aria', { model: modelLabel })}
      aria-busy={writing || busy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="dmp-settings-head">
        <p className="dmp-settings-title" title={modelLabel}>{model?.name ?? route.model}</p>
        <p className="dmp-settings-provider" title={providerName}>{providerName}</p>
      </div>
      {notice}

      <div className="dmp-settings-body">
        {showsInputSection(address, capability) && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-readout" data-no-value={inputValue === null ? '' : undefined}>
              <span className="zmd-label" id={inputLabelId}>{t('settings.input.title')}</span>
              {inputValue !== null && <span className="dmp-settings-value" title={inputValue}>{inputValue}</span>}
              <span className="dmp-settings-source">{t(FACT_SOURCE_KEYS[inputSource])}</span>
            </div>
            <div className="dmp-settings-toggles" role="group" aria-labelledby={inputLabelId}>
              <span className="dmp-settings-toggle">
                <span className="dmp-settings-toggle-name">{t('settings.input.text')}</span>
                <Switch
                  className="dmp-settings-switch"
                  checked={shownInput.includes('text')}
                  label={t('settings.input.text')}
                  disabled={!editable}
                  onChange={(next) => { toggleModality('text', next) }}
                />
              </span>
              <span className="dmp-settings-toggle">
                <span className="dmp-settings-toggle-name">{t('settings.input.image')}</span>
                <Switch
                  className="dmp-settings-switch"
                  checked={shownInput.includes('image')}
                  label={t('settings.input.image')}
                  disabled={!editable}
                  onChange={(next) => { toggleModality('image', next) }}
                />
              </span>
            </div>
          </div>
        )}

        {showsContextField(address, capability) && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-readout" data-no-value={contextValue === null ? '' : undefined}>
              <span className="zmd-label" id={contextLabelId}>{t('settings.context.title')}</span>
              {contextValue !== null && (
                <span
                  className="dmp-settings-value zmd-num"
                  data-empty={contextFact.value === undefined ? '' : undefined}
                  title={contextFact.value === undefined ? undefined : formatContext(contextFact.value)}
                >
                  {contextValue}
                </span>
              )}
              <span className="dmp-settings-source">{t(FACT_SOURCE_KEYS[contextFact.source])}</span>
            </div>
            <div className="dmp-context-presets" role="group" aria-label={t('settings.context.presets')}>
              {CONTEXT_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className="dmp-context-preset"
                  aria-pressed={!customMode && declaredContext === preset.value}
                  disabled={!editable}
                  onMouseDown={presetPointerDown}
                  onClick={() => { choosePreset(preset.value) }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className="dmp-context-preset"
                aria-pressed={customMode}
                disabled={!editable}
                onMouseDown={presetPointerDown}
                onClick={toggleCustom}
              >
                {t('settings.context.custom')}
              </button>
            </div>
            {customMode && (
              <>
                <div className="dmp-settings-field">
                  <Input
                    ref={capacityRef}
                    type="text"
                    inputMode="numeric"
                    disabled={!editable}
                    aria-label={t('settings.context.title')}
                    aria-labelledby={contextLabelId}
                    aria-invalid={capacityError || undefined}
                    aria-describedby={capacityError ? `${idPrefix}-settings-context-error` : undefined}
                    placeholder={contextPlaceholder}
                    value={capacity}
                    onChange={(event) => {
                      setCapacityDraft(event.target.value)
                      setCapacityError(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      event.stopPropagation()
                      commitCapacity()
                    }}
                    onBlur={() => { commitCapacity() }}
                  />
                </div>
                {capacityError && (
                  <p className="dmp-settings-error" id={`${idPrefix}-settings-context-error`} role="alert">
                    {t('settings.context.invalid')}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {reasoning !== undefined && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-readout" data-no-value="">
              <span className="zmd-label" id={effortLabelId}>{t('settings.effort.title')}</span>
              <span className="dmp-settings-source">{t('settings.source.session')}</span>
            </div>
            <div className="dmp-effort-list" role="radiogroup" aria-labelledby={effortLabelId}>
              {choices.map(choice => (
                <button
                  key={choice.key}
                  type="button"
                  role="radio"
                  aria-checked={choice.effort === activeEffort}
                  className="dmp-effort-item"
                  aria-disabled={busy || undefined}
                  onClick={() => { pickEffort(choice.effort) }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dmp-settings-foot">
        <span
          className="dmp-settings-hint"
          title={address === null ? undefined : t('settings.target', { ns: address.ns, path: address.entryPath.join('.') })}
        >
          {t('settings.scope')}
        </span>
        {address !== null && address.declared && snapshot.writable && (
          <button
            type="button"
            className="zmd-btn-ghost"
            aria-label={t('settings.resetAria', { model: modelLabel })}
            disabled={!editable}
            onClick={restoreDefaults}
          >
            {t('settings.reset')}
          </button>
        )}
      </div>
    </MenuSurface>,
    document.body,
  )
}
