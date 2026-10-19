import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, SettingsNamespaceView, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import type { ConfigKey } from './modelConfigCopy.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  apiKeyProblem, baseUrlProblemOf, credentialRefFor, customProviderHost, deriveKeyRef,
  displayNameEditable, isRemovable, keyConfigured, keyRefOf, keyWritable, modelsOf, pathOps,
  protocolChoices, providerFamilyOf, providerUsable, readPath, retryCapable,
} from './modelConfigModel.ts'
import { AddProviderCard } from './AddProviderCard.tsx'
import { CatalogAddCard } from './CatalogAddCard.tsx'
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
  const credential = !session
    && !keylessAuthOf(row)
    && !nativeCredentialPresent(row)
    && credentialRefFor(row) !== undefined
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

function keylessAuthOf(row: ModelConfigRow): boolean {
  const native = row.apiKeyEnv === undefined ? row.entry.nativeAuth : undefined
  return native !== undefined && native.env.length === 0 && native.oauth === true
}

function nativeCredentialPresent(row: ModelConfigRow): boolean {
  if (row.apiKeyEnv !== undefined) return false
  const checks = row.credentialChecks
  if (checks === undefined) return false
  const endpointEnv = row.entry.baseURLEnv ?? []
  return (row.entry.nativeAuth?.env ?? [])
    .filter(ref => !endpointEnv.includes(ref))
    .some(ref => checks[ref]?.configured === true)
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
  readonly onDisplayName: (value: string) => void
  readonly onBaseUrl: (value: string) => void
  readonly onProtocol: (protocol: string) => void
  readonly onLifecycle: () => void
}

function ProviderRow(props: ProviderRowProps): ReactElement {
  const { row, store, t } = props
  const provider = row.entry.provider
  const displayName = isSessionRoute(row) ? t(KEYS['config.account.name']) : row.entry.displayName
  const reading = readingOf(row, props.failure)
  const session = isSessionRoute(row)
  const family = providerFamilyOf(row.entry.settingsNs)
  const unknownAdapter = !session && family === 'unknown'
  const busy = props.pending !== undefined
  const editable = props.writable && !busy

  const namespace = row.entry.settingsNs === '' ? undefined : store.namespace(row.entry.settingsNs)
  const choices = namespace === undefined ? [] : protocolChoices(namespace)
  const profile = readPath(namespace?.user, row.entry.settingsPath)
  const storedApi = apiOf(profile)
  const inheritedApi = apiOf(readPath(namespace?.base, row.entry.settingsPath))
  const effectiveApi = storedApi ?? inheritedApi
  const protocols = effectiveApi !== undefined && !choices.includes(effectiveApi)
    ? [effectiveApi, ...choices]
    : choices
  const protocolEditable = family === 'pi-ai' && row.entry.declared === true
  const showProtocol = protocolEditable && protocols.length > 0

  const storedDisplayName = isRecord(profile)
    && typeof profile.displayName === 'string'
    && profile.displayName.trim() !== ''
    ? profile.displayName
    : ''
  const displayNameFallback = inheritedDisplayNameOf(namespace, row) ?? provider
  const renamable = namespace !== undefined && displayNameEditable(namespace, row.entry.settingsPath)

  const storedBaseUrl = isRecord(profile)
    && typeof profile.baseURL === 'string'
    && profile.baseURL.trim() !== ''
    ? profile.baseURL
    : ''
  const effectiveProfile = readPath(namespace?.value, row.entry.settingsPath)
  const effectiveBaseUrl = isRecord(effectiveProfile)
    && typeof effectiveProfile.baseURL === 'string'
    && effectiveProfile.baseURL.trim() !== ''
    ? effectiveProfile.baseURL
    : undefined
  const defaultBaseUrl = row.entry.defaultBaseURL !== undefined && row.entry.defaultBaseURL.trim() !== ''
    ? row.entry.defaultBaseURL
    : undefined
  const baseUrlFallback = effectiveBaseUrl ?? defaultBaseUrl
  const baseUrlEnv = row.entry.baseURLEnv ?? []
  const deepSeekFamily = family === 'deepseek'
  const baseUrlPlaceholder = deepSeekFamily
    ? t(KEYS['config.baseUrl.deepseekPlaceholder'])
    : baseUrlFallback !== undefined
      ? t(KEYS['config.baseUrl.placeholder'], { url: baseUrlFallback })
      : baseUrlEnv.length > 0
        ? t(KEYS['config.baseUrl.configured'])
        : t(KEYS['config.baseUrl.default'])
  const baseUrlHint = deepSeekFamily
    ? t(KEYS['config.baseUrl.deepseekHint'])
    : baseUrlFallback === undefined && baseUrlEnv.length > 0
      ? t(KEYS['config.baseUrl.environment'], { env: baseUrlEnv.join(', ') })
      : undefined

  const keyRef = credentialRefFor(row)
  const keyPresent = keyConfigured(row)
  const models = namespace === undefined ? 0 : modelsOf(namespace.value, row.entry.settingsPath).length
  const removable = row.entry.settingsPath.length > 0
    && namespace !== undefined
    && isRemovable(namespace, row.entry.settingsPath)
  const retryable = retryCapable(namespace, row.entry.settingsPath)
  const clearsKey = keyPresent
    && keyWritable(row)
    && row.apiKeyEnv === deriveKeyRef(provider)

  const nativeAuth = row.apiKeyEnv === undefined ? row.entry.nativeAuth : undefined
  const nativeEnv = (nativeAuth?.env ?? []).filter(ref => !baseUrlEnv.includes(ref))
  const keyless = keylessAuthOf(row)
  const visibleNativeRefs = nativeEnv.filter(ref => !ref.toLowerCase().includes('oauth'))
  const hiddenNativeRefs = nativeEnv.filter(ref => ref.toLowerCase().includes('oauth'))
  const checks = row.credentialChecks
  const detectedVisibleRef = visibleNativeRefs.find(ref => checks?.[ref]?.configured === true)
  const detectedHiddenRef = hiddenNativeRefs.find(ref => checks?.[ref]?.configured === true)
  const keyHintRef = visibleNativeRefs[0] ?? keyRef
  const nativeHint = nativeEnv.length === 0
    ? undefined
    : detectedVisibleRef !== undefined
      ? t(KEYS['config.key.nativeDetected'], { hint: detectedVisibleRef })
      : detectedHiddenRef !== undefined
        ? t(KEYS['config.key.nativeDetectedHidden'])
        : visibleNativeRefs.length > 0
          && visibleNativeRefs.every(ref => checks?.[ref]?.configured === false)
          ? t(KEYS['config.key.nativeMissing'], { hint: visibleNativeRefs[0] ?? provider })
          : t(KEYS['config.key.nativeUnchecked'])
  const keyFact = nativeHint ?? (keyPresent
    ? t(KEYS['config.key.stateSaved'])
    : t(KEYS['config.key.stateFallback'], { hint: keyHintRef ?? provider }))

  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [wellOpen, setWellOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [nameDraft, setNameDraft] = useState(storedDisplayName)
  const [baseUrlDraft, setBaseUrlDraft] = useState(storedBaseUrl)
  const [baseUrlError, setBaseUrlError] = useState<string | undefined>(undefined)
  const baseUrlHintId = `dmc-baseurl-hint-${provider}`
  const baseUrlErrorId = `dmc-baseurl-error-${provider}`
  const baseUrlDescribedBy = [
    ...(baseUrlHint === undefined ? [] : [baseUrlHintId]),
    ...(baseUrlError === undefined ? [] : [baseUrlErrorId]),
  ].join(' ') || undefined

  useEffect(() => {
    if (!props.catalogOpen) return
    setDraft('')
    setWellOpen(false)
    setConfirmingDelete(false)
    setNameDraft(storedDisplayName)
    setBaseUrlDraft(storedBaseUrl)
    setBaseUrlError(undefined)
  }, [props.catalogOpen, storedDisplayName, storedBaseUrl])

  useEffect(() => {
    setNameDraft(storedDisplayName)
    setBaseUrlDraft(storedBaseUrl)
    setBaseUrlError(undefined)
  }, [storedDisplayName, storedBaseUrl])

  const commit = useCallback((explicit: boolean): void => {
    const value = draft
    setDraft('')
    if (!explicit && value.length === 0) return
    props.onSaveKey(value)
  }, [draft, props])

  const commitBaseUrl = useCallback((): void => {
    const value = baseUrlDraft.trim()
    if (value === storedBaseUrl.trim()) {
      setBaseUrlDraft(value)
      setBaseUrlError(undefined)
      return
    }
    if (value !== '' && baseUrlProblemOf(value) !== undefined) {
      setBaseUrlError(t(KEYS['config.baseUrl.invalid']))
      return
    }
    setBaseUrlError(undefined)
    props.onBaseUrl(value)
  }, [baseUrlDraft, storedBaseUrl, props, t])

  const commitDisplayName = useCallback((): void => {
    const value = nameDraft.trim()
    if (value === storedDisplayName.trim()) {
      setNameDraft(value)
      return
    }
    props.onDisplayName(value)
  }, [nameDraft, storedDisplayName, props])

  const deleteHint = t(
    clearsKey ? KEYS['config.delete.descriptionWithCredential'] : KEYS['config.delete.description'],
    { provider: displayName },
  )

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

        {session || unknownAdapter
          ? null
          : (
            <button
              type="button"
              className="dmc-models zmd-btn-secondary"
              id={`dmc-catalog-btn-${provider}`}
              aria-expanded={props.catalogOpen}
              aria-controls={`dmc-catalog-${provider}`}
              data-active={props.catalogOpen ? 'true' : undefined}
              aria-label={t(KEYS['config.models.openAria'], {
                provider: displayName,
                count: models > 0
                  ? t(KEYS['config.models.count'], { count: String(models) })
                  : t(KEYS['config.models.default']),
              })}
              title={models === 0 ? t(KEYS['config.models.inherited']) : undefined}
              onClick={props.onOpenCatalog}
            >
              {t(KEYS['config.models.manage'])}
            </button>
          )}

        {session
          ? null
          : (
            <button
              type="button"
              className="dmc-manage zmd-btn-secondary"
              aria-expanded={wellOpen}
              aria-controls={`dmc-well-${provider}`}
              data-active={wellOpen ? 'true' : undefined}
              aria-label={t(KEYS['config.manageAria'], { provider: displayName })}
              onClick={() => {
                if (wellOpen) {
                  setDraft('')
                  setConfirmingDelete(false)
                }
                setWellOpen(!wellOpen)
              }}
            >
              {t(KEYS['config.manage'])}
            </button>
          )}
      </div>

      {busy ? <span className="dmc-pending">{props.pending}</span> : null}

      {reading.diagnostic === undefined
        ? null
        : <p className="dmc-diagnostic" role="alert">{reading.diagnostic}</p>}

      {wellOpen
        ? (
          <div className="dmc-well zmd-well" id={`dmc-well-${provider}`}>
            {unknownAdapter
              ? <p className="dmc-notice">{t(KEYS['config.provider.unknown'])}</p>
              : (
                <>
                  <dl className="dmc-fields">
                    {keyless
                      ? (
                        <div className="dmc-field">
                          <dt className="dmc-field-label zmd-label">{t(KEYS['config.credential.label'])}</dt>
                          <dd className="dmc-field-value">
                            <span className="dmc-quiet">{t(KEYS['config.key.keyless'])}</span>
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
                                    : t(KEYS['config.key.placeholderFallback'], { hint: keyHintRef ?? keyRef })}
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
                                <p className="dmc-field-fact">{keyFact}</p>
                                {keyPresent
                                  ? (
                                    <button
                                      type="button"
                                      className="zmd-btn-danger"
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

                    {namespace === undefined
                      ? null
                      : (
                        <div className="dmc-field">
                          <dt className="dmc-field-label zmd-label">{t(KEYS['config.baseUrl.label'])}</dt>
                          <dd className="dmc-field-value">
                            <input
                              className="zmd-input"
                              type="text"
                              autoComplete="off"
                              spellCheck={false}
                              value={baseUrlDraft}
                              disabled={!editable}
                              aria-label={t(KEYS['config.baseUrl.label'])}
                              aria-invalid={baseUrlError === undefined ? undefined : true}
                              aria-describedby={baseUrlDescribedBy}
                              placeholder={baseUrlPlaceholder}
                              onChange={(event) => {
                                setBaseUrlError(undefined)
                                setBaseUrlDraft(event.target.value)
                              }}
                              onBlur={commitBaseUrl}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                                if (event.key === 'Escape') {
                                  event.stopPropagation()
                                  setBaseUrlDraft(storedBaseUrl)
                                  setBaseUrlError(undefined)
                                }
                              }}
                            />
                            {baseUrlHint === undefined
                              ? null
                              : (
                                <div className="dmc-field-foot">
                                  <p className="dmc-field-fact" id={baseUrlHintId}>
                                    {baseUrlHint}
                                  </p>
                                </div>
                              )}
                            {baseUrlError === undefined
                              ? null
                              : <p className="dmc-field-error" id={baseUrlErrorId}>{baseUrlError}</p>}
                          </dd>
                        </div>
                      )}

                    {showProtocol
                      ? (
                        <div className="dmc-field">
                          <dt className="dmc-field-label zmd-label">{t(KEYS['config.api.label'])}</dt>
                          <dd className="dmc-field-value">
                            <select
                              className="zmd-select dmc-protocol-select"
                              value={effectiveApi ?? ''}
                              disabled={!editable}
                              aria-label={t(KEYS['config.api.label'])}
                              onChange={(event) => { props.onProtocol(event.target.value) }}
                            >
                              {effectiveApi === undefined
                                ? <option value="">{t(KEYS['config.api.unset'])}</option>
                                : null}
                              {protocols.map(protocol => (
                                <option key={protocol} value={protocol}>{protocolLabel(t, protocol)}</option>
                              ))}
                            </select>
                            {storedApi === undefined
                              ? null
                              : (
                                <button
                                  type="button"
                                  className="zmd-btn-ghost dmc-api-override"
                                  disabled={!editable}
                                  onClick={() => { props.onProtocol('') }}
                                >
                                  {t(KEYS['config.api.inheritReset'])}
                                </button>
                              )}
                          </dd>
                        </div>
                      )
                      : null}

                    {renamable
                      ? (
                        <div className="dmc-field">
                          <dt className="dmc-field-label zmd-label">{t(KEYS['config.route.displayName'])}</dt>
                          <dd className="dmc-field-value">
                            <input
                              className="zmd-input"
                              type="text"
                              autoComplete="off"
                              spellCheck={false}
                              value={nameDraft}
                              disabled={!editable}
                              aria-label={t(KEYS['config.route.displayName'])}
                              placeholder={displayNameFallback}
                              onChange={(event) => { setNameDraft(event.target.value) }}
                              onBlur={commitDisplayName}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                                if (event.key === 'Escape') {
                                  event.stopPropagation()
                                  setNameDraft(storedDisplayName)
                                }
                              }}
                            />
                          </dd>
                        </div>
                      )
                      : null}
                  </dl>

                  <p className="dmc-well-note">{t(KEYS['config.well.instant'])}</p>

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
                </>
              )}

            {!row.configured || row.entry.settingsPath.length === 0
              ? null
              : (
                <div className="dmc-well-foot">
                  <span className="dmc-well-foot-hint">{deleteHint}</span>
                  {confirmingDelete
                    ? (
                      <button
                        type="button"
                        className="zmd-btn-ghost"
                        disabled={!editable}
                        onClick={() => { setConfirmingDelete(false) }}
                      >
                        {t(KEYS['config.cancel'])}
                      </button>
                    )
                    : null}
                  <button
                    type="button"
                    className="dmc-danger zmd-btn-danger"
                    disabled={!editable || !removable}
                    aria-label={t(KEYS['config.removeProvider'], { provider: displayName })}
                    onClick={() => {
                      if (!confirmingDelete) {
                        setConfirmingDelete(true)
                        return
                      }
                      setConfirmingDelete(false)
                      props.onLifecycle()
                    }}
                  >
                    {t(
                      confirmingDelete ? KEYS['config.delete.confirm'] : KEYS['config.removeProvider'],
                      { provider: displayName },
                    )}
                  </button>
                </div>
              )}
          </div>
        )
        : null}
      {props.catalogOpen && !session && !unknownAdapter
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
  const [addingProvider, setAddingProvider] = useState<string | null>(null)
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog')
  const [savedProvider, setSavedProvider] = useState<string | null>(null)

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
    announce = true,
  ): Promise<void> => {
    setSavedProvider(null)
    setPending(current => ({ ...current, [provider]: word }))
    setFailures(current => without(current, provider))
    const failure = await action()
    if (!mounted.current) return
    setPending(current => without(current, provider))
    if (failure !== undefined) {
      setFailures(current => ({ ...current, [provider]: failure }))
      return
    }
    if (announce) setSavedProvider(provider)
  }, [])

  const saveKey = useCallback((row: ModelConfigRow, value: string): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    const problem = apiKeyProblem(value)
    if (value.length === 0 || problem === 'blank') {
      const provider = row.entry.provider
      const blank = t(keyConfigured(row) ? KEYS['config.key.blank'] : KEYS['config.key.blankNew'])
      setFailures(current => ({ ...current, [provider]: blank }))
      return
    }
    if (problem === 'illegal') {
      setFailures(current => ({ ...current, [row.entry.provider]: t(KEYS['config.key.illegal']) }))
      return
    }
    const keyValue = value.trim()
    const ns = row.entry.settingsNs
    const bindsApiKeyEnv = providerFamilyOf(ns) === 'pi-ai'
      && row.apiKeyEnv === undefined
      && row.entry.settingsPath.length > 0
    void run(row.entry.provider, t(KEYS['config.applying']), async () => {
      if (bindsApiKeyEnv) {
        const view = store.namespace(ns)
        if (view === undefined) return t(KEYS['config.loadFailed'])
        const before = readPath(view.user, row.entry.settingsPath)
        const ops = pathOps(row.entry.settingsPath, before, { ...recordOf(before), apiKeyEnv: ref })
        const outcome = await store.write(ns, ops, view.revision)
        if (!outcome.ok) return outcome.message
      }
      return store.storeCredential(ref, keyValue)
    })
  }, [run, store, t])

  const clearKey = useCallback((row: ModelConfigRow): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    void run(row.entry.provider, t(KEYS['config.applying']), () => store.removeCredential(ref))
  }, [run, store, t])

  const setBaseUrl = useCallback((row: ModelConfigRow, baseURL: string): void => {
    const ns = row.entry.settingsNs
    const view = store.namespace(ns)
    if (view === undefined) {
      setFailures(current => ({ ...current, [row.entry.provider]: t(KEYS['config.loadFailed']) }))
      return
    }
    const before = readPath(view.user, row.entry.settingsPath)
    const after: Record<string, unknown> = { ...recordOf(before) }
    if (baseURL === '') delete after.baseURL
    else after.baseURL = baseURL
    const ops = pathOps(row.entry.settingsPath, before, after)
    void run(row.entry.provider, t(KEYS['config.applying']), async () => {
      const outcome = await store.write(ns, ops, view.revision)
      return outcome.ok ? undefined : outcome.message
    })
  }, [run, store, t])

  const setDisplayName = useCallback((row: ModelConfigRow, displayName: string): void => {
    const ns = row.entry.settingsNs
    const view = store.namespace(ns)
    if (view === undefined) {
      setFailures(current => ({ ...current, [row.entry.provider]: t(KEYS['config.loadFailed']) }))
      return
    }
    const before = readPath(view.user, row.entry.settingsPath)
    const after: Record<string, unknown> = { ...recordOf(before) }
    if (displayName === '') delete after.displayName
    else after.displayName = displayName
    const ops = pathOps(row.entry.settingsPath, before, after)
    void run(row.entry.provider, t(KEYS['config.applying']), async () => {
      const outcome = await store.write(ns, ops, view.revision)
      return outcome.ok ? undefined : outcome.message
    })
  }, [run, store, t])

  const setProtocol = useCallback((row: ModelConfigRow, protocol: string): void => {
    const ns = row.entry.settingsNs
    const view = store.namespace(ns)
    if (view === undefined) {
      setFailures(current => ({ ...current, [row.entry.provider]: t(KEYS['config.loadFailed']) }))
      return
    }
    const before = readPath(view.user, row.entry.settingsPath)
    const after: Record<string, unknown> = { ...recordOf(before) }
    if (protocol === '') delete after.api
    else after.api = protocol
    const ops = pathOps(row.entry.settingsPath, before, after)
    void run(row.entry.provider, t(KEYS['config.applying']), async () => {
      const outcome = await store.write(ns, ops, view.revision)
      return outcome.ok ? undefined : outcome.message
    })
  }, [run, store, t])

  const lifecycle = useCallback((row: ModelConfigRow): void => {
    const ns = row.entry.settingsNs
    const provider = row.entry.provider
    const ref = keyRefOf(row)
    const clearsKey = keyConfigured(row)
      && keyWritable(row)
      && row.apiKeyEnv === deriveKeyRef(provider)
    void run(provider, t(KEYS['config.deleting'], { provider: row.entry.displayName }), async () => {
      if (clearsKey) {
        const failure = await store.removeCredential(ref)
        if (failure !== undefined) return failure
      }
      const outcome = await store.write(
        ns, [{ op: 'unset', path: [...row.entry.settingsPath] }], undefined,
      )
      return outcome.ok ? undefined : outcome.message
    }, false)
  }, [run, store, t])

  const listed = snapshot.rows.filter(row => row.added)
  const candidates = snapshot.rows.filter(row => !row.added)
  const readOnly = !snapshot.writable
  const customHost = customProviderHost(snapshot.namespaces)
  const savedName = savedProvider === null
    ? null
    : snapshot.rows.find(row => row.entry.provider === savedProvider)?.entry.displayName ?? savedProvider

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
        if (addingProvider !== null) {
          setAddingProvider(null)
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

      {savedName === null
        ? null
        : (
          <p className="dmc-saved" role="status" aria-live="polite">
            {t(KEYS['config.savedProvider'], { provider: savedName })}
          </p>
        )}

      <div className="dmc-toolbar">
        <button
          type="button"
          className="dmc-add-top"
          aria-expanded={adding}
          aria-controls="dmc-add-panel"
          disabled={readOnly || snapshot.status !== 'ready'}
          onClick={() => {
            setAddingProvider(null)
            setAdding(current => !current)
          }}
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
                onClick={() => {
                  setAddingProvider(null)
                  setMode('custom')
                }}
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
                    {candidates.map(row => {
                      const open = addingProvider === row.entry.provider
                      return (
                        <li key={row.entry.provider}>
                          <button
                            type="button"
                            className="dmc-picker-item"
                            disabled={readOnly}
                            aria-expanded={open}
                            onClick={() => {
                              setAddingProvider(open ? null : row.entry.provider)
                            }}
                          >
                            <span className="dmc-name">
                              <span className="dmc-name-text">{row.entry.displayName}</span>
                              <span className="dmc-route">{row.entry.provider}</span>
                            </span>
                          </button>
                          {open
                            ? (
                              <CatalogAddCard
                                row={row}
                                store={store}
                                t={t}
                                writable={snapshot.writable}
                                onDone={() => {
                                  setAddingProvider(null)
                                  setAdding(false)
                                  setSavedProvider(row.entry.provider)
                                }}
                                onCancel={() => { setAddingProvider(null) }}
                              />
                            )
                            : null}
                        </li>
                      )
                    })}
                  </ul>
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
                  onDone={(provider) => {
                    setAdding(false)
                    if (provider !== undefined) setSavedProvider(provider)
                  }}
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
                onDisplayName={(value) => { setDisplayName(row, value) }}
                onBaseUrl={(value) => { setBaseUrl(row, value) }}
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

function inheritedDisplayNameOf(
  namespace: SettingsNamespaceView | undefined,
  row: ModelConfigRow,
): string | undefined {
  const base = readPath(namespace?.base, row.entry.settingsPath)
  if (!isRecord(base)) return undefined
  const name = base.displayName
  return typeof name === 'string' && name.trim() !== '' ? name : undefined
}

function apiOf(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const api = value.api
  return typeof api === 'string' && api !== '' ? api : undefined
}
