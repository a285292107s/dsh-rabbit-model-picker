
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import type { ConfigKey } from './modelConfigCopy.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  credentialRefFor, deriveKeyRef, isRemovable, keyConfigured, keyRefOf, keyWritable, modelsOf,
  pathOps, protocolChoices, providerUsable, readPath, retryCapable,
} from './modelConfigModel.ts'
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

// `accountAvailable` is undefined on every route that does not sign in through the
// session, so a value settles it; the fallback covers a snapshot that has not been
// told yet — without it this route would be offered a key field nobody stores.
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
  readonly index: number
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
  const manifestIndex = String(props.index).padStart(2, '0')

  const namespace = row.entry.settingsNs === '' ? undefined : store.namespace(row.entry.settingsNs)
  const choices = namespace === undefined ? [] : protocolChoices(namespace)
  const profile = readPath(namespace?.user, row.entry.settingsPath)
  const storedApi = isRecord(profile) && typeof profile.api === 'string' ? profile.api : undefined
  const protocols = storedApi !== undefined && !choices.includes(storedApi)
    ? [storedApi, ...choices]
    : choices

  const keyRef = credentialRefFor(row)
  const keyPresent = keyConfigured(row)
  const models = namespace === undefined ? 0 : modelsOf(namespace.value, row.entry.settingsPath).length
  const removable = row.entry.settingsPath.length > 0
    && namespace !== undefined
    && isRemovable(namespace, row.entry.settingsPath)
  const retryable = retryCapable(namespace, row.entry.settingsPath)
  const clearsKey = keyPresent && keyWritable(row) && keyRefOf(row) === deriveKeyRef(provider)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [retryOpen, setRetryOpen] = useState(false)
  const [wellOpen, setWellOpen] = useState(false)
  const shown = reading.diagnostic

  useEffect(() => {
    if (!props.catalogOpen) return
    setEditing(false)
    setDraft('')
    setRetryOpen(false)
    setWellOpen(false)
  }, [props.catalogOpen])

  const commit = useCallback((explicit: boolean): void => {
    const value = draft
    setEditing(false)
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
      data-state={reading.answer}
      data-error={reading.diagnostic === undefined ? undefined : 'true'}
      data-usable={reading.answer === 'unreachable' ? 'false' : 'true'}
      data-catalog={props.catalogOpen ? 'true' : undefined}
      data-well={wellOpen ? 'true' : undefined}
    >
      <span className="dmc-ordinal zmd-ordinal" aria-hidden="true">{manifestIndex}</span>

      <span className="dmc-name">
        {displayName}
        <span className="dmc-route">{provider}</span>
      </span>

      <button
        type="button"
        className="dmc-catalog zmd-btn-quiet"
        id={`dmc-catalog-btn-${provider}`}
        aria-expanded={props.catalogOpen}
        aria-controls={`dmc-catalog-${provider}`}
        title={models === 0 ? t(KEYS['config.models.inherited']) : undefined}
        onClick={props.onOpenCatalog}
      >
        {models > 0
          ? t(KEYS['config.models.count'], { count: String(models) })
          : t(KEYS['config.models.default'])}
      </button>

      <span className="dmc-state" data-state={reading.answer} key={reading.answer}>
        <span className="dmc-mark" data-state={reading.answer} aria-hidden="true" />
        {t(reading.word)}
      </span>

      <button
        type="button"
        className="dmc-manage zmd-btn-door"
        aria-expanded={wellOpen}
        aria-controls={`dmc-well-${provider}`}
        onClick={() => {
          if (wellOpen) {
            setEditing(false)
            setDraft('')
          }
          setWellOpen(!wellOpen)
        }}
      >
        {t(KEYS['config.manage'])}
      </button>

      {busy ? <span className="dmc-pending">{props.pending}</span> : null}

      {wellOpen
        ? (
          <div className="dmc-well" id={`dmc-well-${provider}`}>
            <div className="dmc-well-head">
              <h2 className="dmc-well-name">{t(KEYS['config.well.title'])}</h2>
              <span className="dmc-well-route">{provider}</span>
            </div>

            {shown === undefined ? null : <p className="dmc-diagnostic">{shown}</p>}

            <dl className="dmc-fields">
              {session
                ? (
                  <>
                    <dt className="dmc-field-label">{t(KEYS['config.credential.label'])}</dt>
                    <dd className="dmc-field-value">
                      <span className="dmc-quiet">{t(KEYS['config.credential.session'])}</span>
                    </dd>
                  </>
                )
                : keyRef === undefined
                  ? null
                  : (
                    <>
                      <dt className="dmc-field-label">{t(KEYS['config.credential.label'])}</dt>
                      <dd className="dmc-field-value">
                        {editing
                          ? (
                            <input
                              className="dmc-key-action"
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              autoFocus
                              value={draft}
                              disabled={!editable}
                              aria-label={t(KEYS['config.key.input'])}
                              placeholder={keyPresent
                                ? t(KEYS['config.key.placeholderSaved'])
                                : t(KEYS['config.key.placeholderFallback'], { hint: keyRef })}
                              onChange={(event) => { setDraft(event.target.value) }}
                              onBlur={() => { commit(false) }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  commit(true)
                                }
                                if (event.key === 'Escape') {
                                  event.stopPropagation()
                                  setEditing(false)
                                  setDraft('')
                                }
                              }}
                            />
                          )
                          : (
                            <>
                              <span className="dmc-quiet">
                                {t(keyPresent
                                  ? KEYS['config.credential.configuredShort']
                                  : KEYS['config.credential.missingShort'])}
                              </span>
                              <button
                                type="button"
                                className="dmc-key-action zmd-btn-quiet"
                                disabled={!editable}
                                onClick={() => { setEditing(true); setDraft('') }}
                              >
                                {t(keyPresent ? KEYS['config.key.replaceShort'] : KEYS['config.key.add'])}
                              </button>
                              {keyPresent
                                ? (
                                  <button
                                    type="button"
                                    className="dmc-key-clear zmd-btn-quiet"
                                    disabled={!editable || !keyWritable(row)}
                                    aria-label={t(KEYS['config.removeProvider'], { provider: t(KEYS['config.key.input']) })}
                                    onClick={props.onClearKey}
                                  >
                                    {t(KEYS['config.key.clearShort'])}
                                  </button>
                                )
                                : null}
                            </>
                          )}
                      </dd>
                    </>
                  )}

              {protocols.length === 0
                ? null
                : (
                  <>
                    <dt className="dmc-field-label">{t(KEYS['config.api.label'])}</dt>
                    <dd className="dmc-field-value">
                      <select
                        className="dmc-protocol"
                        value={storedApi ?? ''}
                        disabled={!editable}
                        aria-label={t(KEYS['config.api.label'])}
                        onChange={(event) => { props.onProtocol(event.target.value) }}
                      >
                        {storedApi === undefined || protocols.length === 0
                          ? <option value="">{t(KEYS['config.api.unset'])}</option>
                          : null}
                        {protocols.map(protocol => (
                          <option key={protocol} value={protocol}>{protocolLabel(t, protocol)}</option>
                        ))}
                      </select>
                    </dd>
                  </>
                )}

              {retryable
                ? (
                  <>
                    <dt className="dmc-field-label">{t(KEYS['config.retryPolicy.trigger'])}</dt>
                    <dd className="dmc-field-value">
                      <button
                        type="button"
                        className="dmc-retry-action zmd-btn-quiet"
                        aria-expanded={retryOpen}
                        aria-controls={`dmc-retry-${provider}`}
                        onClick={() => { setRetryOpen(current => !current) }}
                      >
                        {t(KEYS['config.retryPolicy.edit'])}
                      </button>
                    </dd>
                  </>
                )
                : null}
            </dl>

            {retryable && retryOpen && namespace !== undefined
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
                  <button
                    type="button"
                    className="dmc-danger zmd-btn-danger"
                    disabled={!editable || (row.configured && !removable)}
                    aria-label={row.configured
                      ? t(KEYS['config.removeProvider'], { provider: displayName })
                      : t(KEYS['config.add'])}
                    title={lifecycleHint}
                    onClick={props.onLifecycle}
                  >
                    {t(row.configured
                      ? KEYS['config.removeProvider']
                      : KEYS['config.add'])}
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
  const [picker, setPicker] = useState(false)

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

  // A blank field only gets here as an explicit store (Enter): the host cannot read
  // a stored secret back, so a field left empty on the way out means "cancel", and
  // the row says why nothing was written instead of writing an empty value.
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

  // No adapter's profile schema has an enable flag, so the profile's existence is the
  // lever. Delete unsets the credential first — a failure aborts before the profile,
  // so the row survives — and only where the profile reads the derived key reference.
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
      className="dmc-page zmd-plate zmd-grain"
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
        if (picker) {
          setPicker(false)
          return
        }
        close()
      }}
    >
      <header className="dmc-head">
        <div className="dmc-masthead zmd-masthead">
          <h1 className="dmc-readout zmd-masthead-name">{t(KEYS['config.title'])}</h1>
          <div className="dmc-meta zmd-masthead-meta">
            <span>{summary}</span>
          </div>
        </div>
      </header>

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
            <p className="dmc-empty-copy">{t(KEYS['config.empty.description'])}</p>
          </div>
        )
        : null}

      {listed.length === 0
        ? null
        : (
          <div className="dmc-listhead" aria-hidden="true">
            <span className="dmc-listhead-name">{t(KEYS['config.provider.label'])}</span>
            <span className="dmc-listhead-col">{t(KEYS['config.models.label'])}</span>
            <span className="dmc-listhead-col">{t(KEYS['config.listheadState'])}</span>
            <span className="dmc-listhead-col">{t(KEYS['config.listheadAction'])}</span>
          </div>
        )}

      <ul className="dmc-list">
        {listed.map((row, index) => (
          <ProviderRow
            key={row.entry.provider}
            row={row}
            index={index + 1}
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

      <div className="dmc-actions zmd-footing">
        <span className="zmd-footing-note">
          {listed.length === 0
            ? t(KEYS['config.footCount'], { count: '0' })
            : candidates.length === 0
              ? t(KEYS['config.add.catalogExhausted'])
              : t(KEYS['config.footCount'], { count: String(listed.length) })}
        </span>
        <button
          type="button"
          className="dmc-add"
          data-emphasis={empty ? 'primary' : undefined}
          aria-expanded={picker && candidates.length > 0}
          disabled={readOnly || candidates.length === 0}
          onClick={() => { setPicker(current => !current) }}
        >
          {t(KEYS['config.add'])}
        </button>
      </div>
      {picker && candidates.length > 0
        ? (
          <div className="dmc-picker">
            <p className="dmc-notice">{t(KEYS['config.add.catalogHint'])}</p>
            <ul className="dmc-picker-list">
              {candidates.map(row => (
                <li key={row.entry.provider}>
                  <button
                    type="button"
                    className="dmc-picker-item"
                    data-state="dormant"
                    disabled={readOnly || pending[row.entry.provider] !== undefined}
                    onClick={() => { lifecycle(row) }}
                  >
                    <span className="dmc-name">
                      {row.entry.displayName}
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
    </section>
  )
}

function protocolsOf(store: ModelConfigStore, ns: string): readonly string[] {
  const view = store.namespace(ns)
  if (view === undefined) return []
  return protocolChoices(view)
}
