import {
  IconCheckOutlineRegular, IconInfoOutlineRegular, IconWarningOutlineRegular, Input, MenuSurface, Switch,
  useAnchoredPosition,
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
import {
  capacityAction, contextFieldOf, contextHintOf, inputHintOf, noticeOf, restoreIsEmpty, shownInputOf,
  showsContextField, showsInputSection,
} from './panelCopy.ts'
import { formatContext, PANEL_MODALITIES, parseContext, resolveRoute } from './params.ts'

const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

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

export function SettingsMenu({
  anchorRef, panelRef, idPrefix, side, directory, params, capabilities, busy, maxHeight, t, onSelect, onClose,
}: SettingsMenuProps) {
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null)
  const [capacityError, setCapacityError] = useState(false)
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)

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

  const copyState = { address, capability, snapshot, busy, capacityError } as const
  const noticeLine = noticeOf(copyState)
  const sectionNotice = noticeLine === null ? null : t(noticeLine.key, noticeLine.params)
  const inputHintLine = inputHintOf(copyState, t)
  const inputHint = inputHintLine === null
    ? null
    : [
        t(inputHintLine.key, inputHintLine.params),
        restoreIsEmpty(copyState) ? t('settings.resetNothing') : null,
      ].filter(part => part !== null).join(' ')
  const contextHintLine = contextHintOf(copyState)
  const contextHint = contextHintLine === null ? null : t(contextHintLine.key, contextHintLine.params)

  const shownInput = shownInputOf(address, capability)
  const contextField = contextFieldOf(address, capability)
  const editable = address !== null && snapshot.writable && !busy && !writing
  const capacity = capacityDraft ?? contextField.value

  const chain = (): HTMLElement[] => {
    const panel = panelRef.current
    if (panel === null) return []
    return [
      ...panel.querySelectorAll<HTMLElement>('[role="switch"]'),
      panel.querySelector<HTMLElement>('.dmp-settings-input input'),
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
    setCapacityDraft(null)
    setCapacityError(false)
    setWriteError(null)
  }, [addressId, contextField.value])

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

  const commitCapacity = (): void => {
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
    if (route === null || reasoning === undefined) return
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
      role="group"
      aria-label={t('settings.aria', { model: modelLabel })}
      aria-busy={writing || busy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="dmp-settings-head">
        <p className="dmp-settings-title">{modelLabel}</p>
      </div>
      {notice}

      <div className="dmp-settings-body">
        {showsInputSection(address, capability) && (
          <div className="dmp-settings-section">
            <span className="zmd-label">{t('settings.input.title')}</span>
            <div className="dmp-settings-row">
              <span className="dmp-settings-name">{t('settings.input.text')}</span>
              <Switch
                className="dmp-settings-switch"
                checked={shownInput.includes('text')}
                label={t('settings.input.text')}
                disabled={!editable}
                onChange={(next) => { toggleModality('text', next) }}
              />
            </div>
            <div className="dmp-settings-row">
              <span className="dmp-settings-name">{t('settings.input.image')}</span>
              <Switch
                className="dmp-settings-switch"
                checked={shownInput.includes('image')}
                label={t('settings.input.image')}
                disabled={!editable}
                onChange={(next) => { toggleModality('image', next) }}
              />
            </div>
            {inputHint !== null && <div className="dmp-settings-hint">{inputHint}</div>}
          </div>
        )}

        {showsContextField(address, capability) && (
          <div className="dmp-settings-section">
            <span className="zmd-label">{t('settings.context.title')}</span>
            <div className="dmp-settings-row">
              <Input
                className={capacityError ? 'dmp-settings-input dmp-settings-input-bad' : 'dmp-settings-input'}
                type="text"
                inputMode="numeric"
                disabled={!editable}
                aria-label={t('settings.context.title')}
                aria-invalid={capacityError || undefined}
                placeholder={contextField.placeholder}
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
            {contextHint !== null && <div className="dmp-settings-hint">{contextHint}</div>}
          </div>
        )}

        {reasoning !== undefined && (
          <div className="dmp-settings-section">
            <span className="zmd-label">{t('settings.effort.title')}</span>
            <div className="dmp-effort-list" role="radiogroup" aria-label={t('settings.effort.title')}>
              {choices.map(choice => (
                <button
                  key={choice.key}
                  type="button"
                  role="radio"
                  aria-checked={choice.effort === activeEffort}
                  className="dmp-effort-item"
                  disabled={busy}
                  onClick={() => { pickEffort(choice.effort) }}
                >
                  <span className="dmp-effort-name">{choice.label}</span>
                  <span
                    className="dmp-effort-check"
                    data-on={choice.effort === activeEffort ? '' : undefined}
                  >
                    {choice.effort === activeEffort ? <IconCheckOutlineRegular /> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {address !== null && (
          <div className="dmp-settings-target">
            <span className="dmp-settings-target-label">{t('settings.targetLabel')}</span>
            <span className="dmp-settings-target-value">
              {t('settings.target', { ns: address.ns, path: address.entryPath.join('.') })}
            </span>
          </div>
        )}

        <div className="dmp-settings-note">
          <IconInfoOutlineRegular className="dmp-settings-note-icon" />
          <span>{t('settings.note')}</span>
        </div>
      </div>

      <div className="dmp-settings-foot">
        <span className="dmp-settings-hint">{t('settings.scope')}</span>
        <button
          type="button"
          className="zmd-btn-ghost"
          aria-label={t('settings.resetAria', { model: modelLabel })}
          disabled={!editable || address === null || !address.declared}
          onClick={restoreDefaults}
        >
          {t('settings.reset')}
        </button>
      </div>
    </MenuSurface>,
    document.body,
  )
}
