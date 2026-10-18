import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, SettingsNamespaceView, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import type { ConfigKey } from './modelConfigCopy.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  credentialRefFor, customProviderHost, deriveKeyRef, isRemovable, keyConfigured, keyRefOf,
  keyWritable, modelsOf, pathOps, protocolChoices, providerUsable, readPath, retryCapable,
} from './modelConfigModel.ts'
import { AddProviderCard } from './AddProviderCard.tsx'
import { ModelCatalog } from './ModelCatalog.tsx'
import { RetryEditor } from './RetryEditor.tsx'
import { injectModelConfigStyles } from './modelConfigStyles.ts'

const PROTOCOL_LABELS: Readonly<Record<string, ConfigKey>> = {
  'anthropic-messages': KEYS['config.api.anthropicMessages'],
  'openai-completions': KEYS['config.api.openaiCompletions'],
  'openai-responses': KEYS['config.api.openaiResponses'],
}

export interface ModelConfigPageProps {
  readonly close: () => void
  readonly store: ModelConfigStore
  readonly t: Translate
}

type RowAnswer = 'ready' | 'missing-key' | 'unreachable'

interface RowReading {
  readonly answer: RowAnswer
  readonly word: ConfigKey
  readonly diagnostic: string | undefined
}

function readingOf(row: ModelConfigRow, failure: string | undefined): RowReading {
  const diagnostic = failure ?? row.entry.error
  const session = isSessionRoute(row)
  const credential = !session && credentialRefFor(row) !== undefined
  const answer: RowAnswer = credential && !keyConfigured(row)
    ? 'missing-key'
    : providerUsable(row) ? 'ready' : 'unreachable'
  const word: ConfigKey = session && answer === 'ready'
    ? KEYS['config.account.signedIn']
    : answer === 'missing-key'
      ? KEYS['config.verdict.missingKey']
      : answer === 'unreachable' ? KEYS['config.verdict.unavailable'] : KEYS['config.verdict.ready']
  return { answer, word, diagnostic }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {}
}

function without(record: Readonly<Record<string, string>>, key: string): Record<string, string> {
  const next: Record<string, string> = { ...record }
  delete next[key]
  return next
}

function isSessionRoute(row: ModelConfigRow): boolean {
  if (row.accountAvailable !== undefined) return true
  return row.entry.active && row.apiKeyEnv === undefined && !providerUsable(row)
}

function protocolLabel(t: Translate, protocol: string): string {
  const key = PROTOCOL_LABELS[protocol]
  return key === undefined ? protocol : t(key)
}

interface ProviderRowProps {
  readonly row: ModelConfigRow
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly writable: boolean
  readonly pending: string | undefined
  readonly failure: string | undefined
  readonly catalogOpen: boolean
  readonly catalogConfirming: boolean
  readonly onOpenCatalog: () => void
  readonly onRequestCloseCatalog: () => void
  readonly onKeepEditingCatalog: () => void
  readonly onDiscardCatalog: () => void
  readonly onCatalogDirty: (dirty: boolean) => void
  readonly onSaveKey: (value: string) => void
  readonly onClearKey: () => void
  readonly onProtocol: (protocol: string) => void
  readonly onLifecycle: () => void
}

function ProviderRow(props: ProviderRowProps): ReactElement {
  const { row, store, t } = props
  const provider = row.entry.provider
  const displayName = isSessionRoute(row) ? t(KEYS['config.account.name']) : row.entry.displayName
  const reading = readingOf(row, props.failure)
  const session = isSessionRoute(row)
  const busy = props.pending !== undefined
  const editable = props.writable && !busy

  const namespace = row.entry.settingsNs === '' ? undefined : store.namespace(row.entry.settingsNs)
  const choices = namespace === undefined ? [] : protocolChoices(namespace)
  const profile = readPath(namespace?.user, row.entry.settingsPath)
  const storedApi = isRecord(profile) && typeof profile.api === 'string' ? profile.api : undefined
  const protocols = storedApi !== undefined && !choices.includes(storedApi)
    ? [storedApi, ...choices]
    : choices
  const inheritedProtocol = inheritedProtocolOf(namespace, row)

  const keyRef = credentialRefFor(row)
  const keyPresent = keyConfigured(row)
  const models = namespace === undefined ? 0 : modelsOf(namespace.value, row.entry.settingsPath).length
  const removable = row.entry.settingsPath.length > 0
    && namespace !== undefined
    && isRemovable(namespace, row.entry.settingsPath)
  const retryable = retryCapable(namespace, row.entry.settingsPath)
  const clearsKey = keyPresent && keyWritable(row) && keyRefOf(row) === deriveKeyRef(provider)

  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [wellOpen, setWellOpen] = useState(false)
  const shown = reading.diagnostic

  useEffect(() => {
    if (!props.catalogOpen) return
    setDraft('')
    setWellOpen(false)
  }, [props.catalogOpen])

  const commit = useCallback((explicit: boolean): void => {
    const value = draft
    setDraft('')
    if (!explicit && value.length === 0) return
    props.onSaveKey(value)
  }, [draft, props])

  const lifecycleHint = row.configured
    ? t(
      clearsKey ? KEYS['config.delete.descriptionWithCredential'] : KEYS['config.delete.description'],
      { provider: displayName },
    )
    : t(KEYS['config.add.catalogHint'])

  return (
    <li
      className="dmc-row"
      data-open={props.catalogOpen || wellOpen ? 'true' : undefined}
    >
      <div className="dmc-rowhead">
        <span className="dmc-name" title={t(reading.word)}>
          <span
            className="zmd-dot dmc-name-dot"
            data-tone={reading.answer === 'ready' ? 'ok' : 'bad'}
            role="img"
            aria-label={t(reading.word)}
          />
          <span className="dmc-name-text">{displayName}</span>
          <span className="dmc-route">{provider}</span>
        </span>

        <button
          type="button"
          className="dmc-models"
          id={`dmc-catalog-btn-${provider}`}
          aria-expanded={props.catalogOpen}
          aria-controls={`dmc-catalog-${provider}`}
          aria-label={t(KEYS['config.models.openAria'], {
            provider: displayName,
            count: models > 0
              ? t(KEYS['config.models.count'], { count: String(models) })
              : t(KEYS['config.models.default']),
          })}
          title={models === 0 ? t(KEYS['config.models.inherited']) : undefined}
          onClick={props.onOpenCatalog}
        >
          <span className="dmc-models-value">
            {models > 0
              ? t(KEYS['config.models.count'], { count: String(models) })
              : t(KEYS['config.models.default'])}
          </span>
          <svg
            className={props.catalogOpen ? 'dmc-chevron dmc-chevron-open' : 'dmc-chevron'}
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>

        <button
          type="button"
          className="dmc-manage zmd-btn-secondary"
          aria-expanded={wellOpen}
          aria-controls={`dmc-well-${provider}`}
          aria-label={t(KEYS['config.manageAria'], { provider: displayName })}
          onClick={() => {
            if (wellOpen) setDraft('')
            setWellOpen(!wellOpen)
          }}
        >
          {t(KEYS['config.manage'])}
        </button>
      </div>

      {busy ? <span className="dmc-pending">{props.pending}</span> : null}

      {wellOpen
        ? (
          <div className="dmc-well zmd-well" id={`dmc-well-${provider}`}>
            {shown === undefined ? null : <p className="dmc-diagnostic">{shown}</p>}

            <dl className="dmc-fields">
              {session
                ? (
                  <div className="dmc-field">
                    <dt className="dmc-field-label zmd-label">{t(KEYS['config.credential.label'])}</dt>
                    <dd className="dmc-field-value">
                      <span className="dmc-quiet">{t(KEYS['config.credential.session'])}</span>
                    </dd>
                  </div>
                )
                : keyRef === undefined
                  ? null
                  : (
                    <div className="dmc-field">
                      <dt className="dmc-field-label zmd-label">{t(KEYS['config.credential.label'])}</dt>
                      <dd className="dmc-field-value">
                        <div className="dmc-key-input">
                          <input
                            className="zmd-input"
                            type={revealed ? 'text' : 'password'}
                            autoComplete="new-password"
                            spellCheck={false}
                            value={draft}
                            disabled={!editable}
                            aria-label={t(KEYS['config.key.input'])}
                            placeholder={keyPresent
                              ? t(KEYS['config.key.placeholderSaved'])
                              : t(KEYS['config.key.placeholderFallback'], { hint: keyRef })}
                            onChange={(event) => {
                              setRevealed(false)
                              setDraft(event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                commit(true)
                              }
                              if (event.key === 'Escape') {
                                event.stopPropagation()
                                setDraft('')
                              }
                            }}
                          />
                          {draft.length === 0
                            ? null
                            : (
                              <button
                                type="button"
                                className="dmc-key-reveal"
                                aria-label={t(revealed ? KEYS['config.key.hide'] : KEYS['config.key.reveal'])}
                                aria-pressed={revealed}
                                disabled={!editable}
                                onClick={() => { setRevealed(current => !current) }}
                              >
                                <svg
                                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                                  stroke="currentColor" strokeWidth="1.3"
                                  strokeLinecap="round" strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z" />
                                  {revealed
                                    ? <path d="M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z" />
                                    : <path d="M2.5 2.5L13.5 13.5" />}
                                </svg>
                              </button>
                            )}
                        </div>
                        <div className="dmc-field-foot">
                          <p className="dmc-field-fact">
                            {keyPresent
                              ? t(KEYS['config.key.stateSaved'])
                              : t(KEYS['config.key.stateFallback'], { hint: keyRef })}
                          </p>
                          {keyPresent
                            ? (
                              <button
                                type="button"
                                className="zmd-btn-ghost"
                                disabled={!editable || !keyWritable(row)}
                                onClick={props.onClearKey}
                              >
                                {t(KEYS['config.key.clear'])}
                              </button>
                            )
                            : null}
                        </div>
                      </dd>
                    </div>
                  )}

              {protocols.length === 0
                ? null
                : (
                  <div className="dmc-field">
                    <dt className="dmc-field-label zmd-label">{t(KEYS['config.api.label'])}</dt>
                    <dd className="dmc-field-value">
                      {storedApi === undefined
                        ? (
                          <>
                            <span className="dmc-locked" aria-label={t(KEYS['config.api.lockedAria'])}>
                              <svg
                                width="14" height="14" viewBox="0 0 16 16" fill="none"
                                stroke="currentColor" strokeWidth="1.4"
                                strokeLinecap="round" strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
                                <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" />
                              </svg>
                              <span>
                                {inheritedProtocol === undefined
                                  ? t(KEYS['config.api.followingDefault'])
                                  : protocolLabel(t, inheritedProtocol)}
                              </span>
                            </span>
                            <div className="dmc-field-foot">
                              <p className="dmc-field-fact">{t(KEYS['config.api.inheritedNote'])}</p>
                              <button
                                type="button"
                                className="zmd-btn-ghost dmc-api-override"
                                disabled={!editable}
                                onClick={() => { props.onProtocol(protocols[0] ?? '') }}
                              >
                                {t(KEYS['config.api.override'])}
                              </button>
                            </div>
                          </>
                        )
                        : (
                          <>
                            <select
                              className="zmd-select"
                              value={storedApi}
                              disabled={!editable}
                              aria-label={t(KEYS['config.api.label'])}
                              onChange={(event) => { props.onProtocol(event.target.value) }}
                            >
                              {protocols.map(protocol => (
                                <option key={protocol} value={protocol}>{protocolLabel(t, protocol)}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="zmd-btn-ghost dmc-api-override"
                              disabled={!editable}
                              onClick={() => { props.onProtocol('') }}
                            >
                              {t(KEYS['config.api.inheritReset'])}
                            </button>
                          </>
                        )}
                    </dd>
                  </div>
                )}

            </dl>

            {retryable && namespace !== undefined
              ? (
                <RetryEditor
                  row={row}
                  namespace={namespace}
                  store={store}
                  t={t}
                  writable={props.writable}
                />
              )
              : null}

            {row.entry.settingsPath.length === 0
              ? null
              : (
                <div className="dmc-well-foot">
                  <span className="dmc-well-foot-hint">{lifecycleHint}</span>
                  <button
                    type="button"
                    className="dmc-danger zmd-btn-danger"
                    disabled={!editable || (row.configured && !removable)}
                    aria-label={row.configured
                      ? t(KEYS['config.removeProvider'], { provider: displayName })
                      : t(KEYS['config.add'])}
                    onClick={props.onLifecycle}
                  >
                    {t(row.configured
                      ? KEYS['config.removeProvider']
                      : KEYS['config.add'], { provider: displayName })}
                  </button>
                </div>
              )}
          </div>
        )
        : null}
      {props.catalogOpen
        ? (
          <ModelCatalog
            row={row}
            store={store}
            t={t}
            onDirtyChange={props.onCatalogDirty}
            onRequestClose={props.onRequestCloseCatalog}
            confirming={props.catalogConfirming}
            onKeepEditing={props.onKeepEditingCatalog}
            onDiscard={props.onDiscardCatalog}
          />
        )
        : null}
    </li>
  )
}

export function ModelConfigPage(props: ModelConfigPageProps): ReactElement {
  const { close, store, t } = props
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const mounted = useRef(true)
  const [pending, setPending] = useState<Readonly<Record<string, string>>>({})
  const [failures, setFailures] = useState<Readonly<Record<string, string>>>({})
  const [catalog, setCatalog] = useState<string | null>(null)
  const [catalogDirty, setCatalogDirty] = useState(false)
  const [catalogGuard, setCatalogGuard] = useState<
    { readonly kind: 'close' } | { readonly kind: 'switch'; readonly provider: string } | null
  >(null)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog')

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => injectModelConfigStyles(), [])

  useEffect(() => { void store.load() }, [store])

  const focusCatalogTrigger = useCallback((provider: string): void => {
    if (typeof document === 'undefined') return
    document.getElementById(`dmc-catalog-btn-${provider}`)?.focus()
  }, [])

  const collapseCatalog = useCallback((): void => {
    const provider = catalog
    setCatalog(null)
    setCatalogDirty(false)
    setCatalogGuard(null)
    if (provider !== null) focusCatalogTrigger(provider)
  }, [catalog, focusCatalogTrigger])

  const requestCloseCatalog = useCallback((): void => {
    if (catalog === null) return
    if (catalogDirty) {
      setCatalogGuard({ kind: 'close' })
      return
    }
    collapseCatalog()
  }, [catalog, catalogDirty, collapseCatalog])

  const openCatalog = useCallback((provider: string): void => {
    if (catalog === provider) {
      requestCloseCatalog()
      return
    }
    if (catalog !== null && catalogDirty) {
      setCatalogGuard({ kind: 'switch', provider })
      return
    }
    setCatalog(provider)
    setCatalogDirty(false)
    setCatalogGuard(null)
  }, [catalog, catalogDirty, requestCloseCatalog])

  const discardCatalogDraft = useCallback((): void => {
    const pendingAction = catalogGuard
    setCatalogDirty(false)
    setCatalogGuard(null)
    if (pendingAction === null) return
    if (pendingAction.kind === 'switch') {
      focusCatalogTrigger(pendingAction.provider)
      setCatalog(pendingAction.provider)
      return
    }
    collapseCatalog()
  }, [catalogGuard, collapseCatalog, focusCatalogTrigger])

  const keepEditingCatalog = useCallback((): void => { setCatalogGuard(null) }, [])

  useEffect(() => {
    if (catalog === null) return
    if (snapshot.rows.some(row => row.added && row.entry.provider === catalog)) return
    setCatalog(null)
    setCatalogDirty(false)
    setCatalogGuard(null)
  }, [catalog, snapshot.rows])

  const run = useCallback(async (
    provider: string,
    word: string,
    action: () => Promise<string | undefined>,
  ): Promise<void> => {
    setPending(current => ({ ...current, [provider]: word }))
    setFailures(current => without(current, provider))
    const failure = await action()
    if (!mounted.current) return
    setPending(current => without(current, provider))
    if (failure !== undefined) setFailures(current => ({ ...current, [provider]: failure }))
  }, [])

  const saveKey = useCallback((row: ModelConfigRow, value: string): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    if (value.length === 0) {
      const provider = row.entry.provider
      const blank = t(keyConfigured(row) ? KEYS['config.key.blank'] : KEYS['config.key.blankNew'])
      setFailures(current => ({ ...current, [provider]: blank }))
      return
    }
    void run(row.entry.provider, t(KEYS['config.applying']), () => store.storeCredential(ref, value))
  }, [run, store, t])

  const clearKey = useCallback((row: ModelConfigRow): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    void run(row.entry.provider, t(KEYS['config.applying']), () => store.removeCredential(ref))
  }, [run, store, t])

  const setProtocol = useCallback((row: ModelConfigRow, protocol: string): void => {
    const ns = row.entry.settingsNs
    const view = store.namespace(ns)
    if (view === undefined) {
      setFailures(current => ({ ...current, [row.entry.provider]: t(KEYS['config.loadFailed']) }))
      return
    }
    const before = readPath(view.user, row.entry.settingsPath)
    const ops = pathOps(row.entry.settingsPath, before, { ...recordOf(before), api: protocol })
    void run(row.entry.provider, t(KEYS['config.applying']), async () => {
      const outcome = await store.write(ns, ops, view.revision)
      return outcome.ok ? undefined : outcome.message
    })
  }, [run, store, t])

  const lifecycle = useCallback((row: ModelConfigRow): void => {
    const ns = row.entry.settingsNs
    const provider = row.entry.provider
    const view = store.namespace(ns)
    if (view === undefined) {
      setFailures(current => ({ ...current, [provider]: t(KEYS['config.loadFailed']) }))
      return
    }

    if (!row.configured) {
      const first = protocolsOf(store, ns)[0]
      const next: Record<string, unknown> = { apiKeyEnv: keyRefOf(row) }
      if (first !== undefined) next.api = first
      const ops = pathOps(row.entry.settingsPath, readPath(view.user, row.entry.settingsPath), next)
      void run(provider, t(KEYS['config.applying']), async () => {
        const outcome = await store.write(ns, ops, view.revision)
        return outcome.ok ? undefined : outcome.message
      })
      return
    }

    const ref = keyRefOf(row)
    const clearsKey = keyConfigured(row) && keyWritable(row) && ref === deriveKeyRef(provider)
    void run(provider, t(KEYS['config.deleting'], { provider: row.entry.displayName }), async () => {
      if (clearsKey) {
        const failure = await store.removeCredential(ref)
        if (failure !== undefined) return failure
      }
      const outcome = await store.write(
        ns, [{ op: 'unset', path: [...row.entry.settingsPath] }], undefined,
      )
      return outcome.ok ? undefined : outcome.message
    })
  }, [run, store, t])

  const listed = snapshot.rows.filter(row => row.added)
  const candidates = snapshot.rows.filter(row => !row.added)
  const pickerFailures = candidates.flatMap(row => {
    const message = failures[row.entry.provider]
    return message === undefined ? [] : [{ row, message }]
  })
  const readOnly = !snapshot.writable
  const customHost = customProviderHost(snapshot.namespaces)

  const readings = listed.map(row => readingOf(row, failures[row.entry.provider]))
  const readyCount = readings.filter(reading => reading.answer === 'ready').length
  const issues = listed.length - readyCount
  const summary = listed.length === 0
    ? t(KEYS['config.summary.none'])
    : issues === 0
      ? t(KEYS['config.summary.ready'], { count: String(readyCount) })
      : t(KEYS['config.summary.attention'], { count: String(readyCount), issues: String(issues) })

  const empty = snapshot.status === 'ready'
    && (listed.length === 0 || listed.every(row => !providerUsable(row)))

  return (
    <section
      className="dmc-page"
      aria-label={t(KEYS['config.title'])}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        if (catalogGuard !== null) {
          setCatalogGuard(null)
          return
        }
        if (catalog !== null) {
          requestCloseCatalog()
          return
        }
        if (adding) {
          setAdding(false)
          return
        }
        close()
      }}
    >
      <header className="dmc-head">
        <h1 className="zmd-title">{t(KEYS['config.title'])}</h1>
        <p className="zmd-lede">{summary}</p>
      </header>

      <div className="dmc-toolbar">
        <button
          type="button"
          className="dmc-add-top"
          aria-expanded={adding}
          aria-controls="dmc-add-panel"
          disabled={readOnly || snapshot.status !== 'ready'}
          onClick={() => { setAdding(current => !current) }}
        >
          {adding ? t(KEYS['config.add.close']) : t(KEYS['config.add'])}
        </button>
        {adding
          ? (
            <div className="dmc-add-choices">
              <button
                type="button"
                className="dmc-add-choice"
                data-active={mode === 'catalog' ? 'true' : undefined}
                disabled={candidates.length === 0}
                title={candidates.length === 0 ? t(KEYS['config.add.catalogExhausted']) : undefined}
                onClick={() => { setMode('catalog') }}
              >
                {t(KEYS['config.add.fromCatalog'])}
              </button>
              <button
                type="button"
                className="dmc-add-choice"
                data-active={mode === 'custom' ? 'true' : undefined}
                disabled={customHost === undefined}
                title={customHost === undefined ? t(KEYS['config.add.customUnavailable']) : undefined}
                onClick={() => { setMode('custom') }}
              >
                {t(KEYS['config.add.custom'])}
              </button>
            </div>
          )
          : null}
      </div>

      {adding && snapshot.status === 'ready'
        ? (
          <div className="dmc-add-panel" id="dmc-add-panel">
            {mode === 'catalog'
              ? (
                <div className="dmc-picker zmd-card">
                  <p className="dmc-notice">{t(KEYS['config.add.catalogHint'])}</p>
                  <ul className="dmc-picker-list">
                    {candidates.map(row => (
                      <li key={row.entry.provider}>
                        <button
                          type="button"
                          className="dmc-picker-item"
                          disabled={readOnly || pending[row.entry.provider] !== undefined}
                          onClick={() => { lifecycle(row) }}
                        >
                          <span className="dmc-name">
                            <span className="dmc-name-text">{row.entry.displayName}</span>
                            <span className="dmc-route">{row.entry.provider}</span>
                          </span>
                          {pending[row.entry.provider] === undefined
                            ? null
                            : <span className="dmc-pending">{pending[row.entry.provider]}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {pickerFailures.map(({ row, message }) => (
                    <p className="dmc-notice" key={row.entry.provider}>
                      {row.entry.displayName}：{message}
                    </p>
                  ))}
                </div>
              )
              : null}

            {mode === 'custom' && customHost !== undefined
              ? (
                <AddProviderCard
                  rows={snapshot.rows}
                  namespaces={snapshot.namespaces}
                  host={customHost}
                  store={store}
                  t={t}
                  writable={snapshot.writable}
                  onDone={() => { setAdding(false) }}
                />
              )
              : null}
          </div>
        )
        : null}

      {snapshot.error === null
        ? null
        : (
          <p className="dmc-notice">
            {t(KEYS['config.loadFailed'])}：{snapshot.error}
            <button
              type="button"
              className="dmc-notice-action"
              onClick={() => { void store.load() }}
            >
              {t(KEYS['config.retry'])}
            </button>
          </p>
        )}

      {snapshot.credentialError === null
        ? null
        : <p className="dmc-notice">{snapshot.credentialError}</p>}

      {readOnly ? <p className="dmc-alert">{t(KEYS['config.readOnly'])}</p> : null}

      {empty
        ? (
          <div className="dmc-empty">
            <p className="zmd-lede">{t(KEYS['config.empty.description'])}</p>
          </div>
        )
        : null}

      {listed.length === 0
        ? null
        : (
          <ul className="dmc-ledger zmd-card">
            <li className="dmc-listhead" aria-hidden="true">
              <span>{t(KEYS['config.provider.label'])}</span>
              <span className="dmc-listhead-models">{t(KEYS['config.listheadModels'])}</span>
              <span className="dmc-listhead-action">{t(KEYS['config.listheadAction'])}</span>
            </li>
            {listed.map(row => (
              <ProviderRow
                key={row.entry.provider}
                row={row}
                store={store}
                t={t}
                writable={snapshot.writable}
                pending={pending[row.entry.provider]}
                failure={failures[row.entry.provider]}
                catalogOpen={catalog === row.entry.provider}
                catalogConfirming={catalogGuard !== null && catalog === row.entry.provider}
                onOpenCatalog={() => { openCatalog(row.entry.provider) }}
                onRequestCloseCatalog={requestCloseCatalog}
                onKeepEditingCatalog={keepEditingCatalog}
                onDiscardCatalog={discardCatalogDraft}
                onCatalogDirty={setCatalogDirty}
                onSaveKey={(value) => { saveKey(row, value) }}
                onClearKey={() => { clearKey(row) }}
                onProtocol={(protocol) => { setProtocol(row, protocol) }}
                onLifecycle={() => { lifecycle(row) }}
              />
            ))}
          </ul>
        )}

      <div className="dmc-actions">
        {candidates.length === 0
          ? <span className="dmc-notice">{t(KEYS['config.add.catalogExhausted'])}</span>
          : null}
      </div>
    </section>
  )
}

function protocolsOf(store: ModelConfigStore, ns: string): readonly string[] {
  const view = store.namespace(ns)
  if (view === undefined) return []
  return protocolChoices(view)
}

function inheritedProtocolOf(
  namespace: SettingsNamespaceView | undefined,
  row: ModelConfigRow,
): string | undefined {
  const base = readPath(namespace?.base, row.entry.settingsPath)
  if (!isRecord(base)) return undefined
  const api = base.api
  return typeof api === 'string' && api !== '' ? api : undefined
}
