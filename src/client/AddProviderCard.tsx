import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { DiscoveredModel, ModelConfigRow, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import { KEYS } from './modelConfigCopy.ts'
import { injectCatalogStyles } from './catalogStyles.ts'
import {
  apiKeyProblem, baseUrlProblemOf, customProviderOps, deriveKeyRef, modelIdsOf, routeProblemOf,
} from './modelConfigModel.ts'

type Discovery =
  | { readonly kind: 'idle' }
  | { readonly kind: 'fetching' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string }
  | {
    readonly kind: 'ready'
    readonly candidates: readonly DiscoveredModel[]
    readonly selected: ReadonlySet<string>
    readonly query: string
  }

export interface AddProviderCardProps {
  readonly rows: readonly ModelConfigRow[]
  readonly namespaces: ReadonlyMap<string, { readonly revision: number }>
  readonly host: { readonly ns: string; readonly protocols: readonly string[] }
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly writable: boolean
  readonly onDone: (provider?: string) => void
}

export function AddProviderCard(props: AddProviderCardProps): ReactElement {
  const { store, t, host } = props
  const [route, setRoute] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [api, setApi] = useState(host.protocols[0] ?? '')
  const [key, setKey] = useState('')
  const [modelsText, setModelsText] = useState('')
  const [discovered, setDiscovered] = useState<ReadonlyMap<string, DiscoveredModel>>(() => new Map())
  const [discovery, setDiscovery] = useState<Discovery>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [openedAt] = useState<number | undefined>(() => props.namespaces.get(host.ns)?.revision)
  const mounted = useRef(true)

  useEffect(() => injectCatalogStyles(), [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const taken = useMemo(
    () => props.rows.map(row => row.entry.provider),
    [props.rows],
  )
  const problem = routeProblemOf(route, taken)
  const urlProblem = baseUrlProblemOf(baseURL)
  const keyProblem = apiKeyProblem(key)
  const models = modelIdsOf(modelsText)
  const editable = props.writable && !busy
  const ready = problem === undefined
    && urlProblem === undefined
    && keyProblem === undefined
    && models.length > 0
    && api !== ''

  const presentIds = new Set(models)
  const query = discovery.kind === 'ready' ? discovery.query.trim().toLowerCase() : ''
  const visible = discovery.kind === 'ready'
    ? discovery.candidates.filter(candidate => query === ''
      || candidate.id.toLowerCase().includes(query)
      || (candidate.name ?? '').toLowerCase().includes(query))
    : []
  const addable = visible.filter(candidate => !presentIds.has(candidate.id))
  const selectedAddable = discovery.kind === 'ready'
    ? addable.filter(candidate => discovery.selected.has(candidate.id))
    : []
  const allSelected = addable.length > 0 && selectedAddable.length === addable.length
  const listedInCatalog = visible.length - addable.length

  const fetchModels = async (): Promise<void> => {
    if (!editable || urlProblem !== undefined || api === '' || discovery.kind === 'fetching') return
    setDiscovery({ kind: 'fetching' })
    const answer = await store.discover(host.ns, {
      baseURL: baseURL.trim(),
      api,
      ...key.trim() === '' ? {} : { apiKey: key.trim() },
    })
    if (!mounted.current) return
    if (!answer.ok) {
      setDiscovery({ kind: 'error', message: answer.message })
      return
    }
    const seen = new Set<string>()
    const candidates = answer.models.filter((candidate) => {
      if (candidate.id === '' || seen.has(candidate.id)) return false
      seen.add(candidate.id)
      return true
    })
    if (candidates.length === 0) {
      setDiscovery({ kind: 'empty' })
      return
    }
    setDiscovery({ kind: 'ready', candidates, selected: new Set<string>(), query: '' })
  }

  const toggleCandidate = (id: string, checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    if (checked) selected.add(id)
    else selected.delete(id)
    setDiscovery({ ...discovery, selected })
  }

  const selectVisible = (checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    for (const candidate of addable) {
      if (checked) selected.add(candidate.id)
      else selected.delete(candidate.id)
    }
    setDiscovery({ ...discovery, selected })
  }

  const adopt = (): void => {
    if (discovery.kind !== 'ready' || !editable) return
    const existing = new Set(models)
    const additions: string[] = []
    for (const candidate of discovery.candidates) {
      if (!discovery.selected.has(candidate.id) || existing.has(candidate.id)) continue
      existing.add(candidate.id)
      additions.push(candidate.id)
    }
    if (additions.length === 0) return
    const next = new Map(discovered)
    for (const candidate of discovery.candidates) {
      if (discovery.selected.has(candidate.id)) next.set(candidate.id, candidate)
    }
    setDiscovered(next)
    setModelsText([...models, ...additions].join('\n'))
    setDiscovery({ kind: 'idle' })
  }

  const modelDrafts = models.map(id => {
    const candidate = discovered.get(id)
    if (candidate === undefined) return { id }
    return {
      id,
      ...candidate.name === undefined ? {} : { name: candidate.name },
      ...candidate.contextWindow === undefined ? {} : { contextWindow: candidate.contextWindow },
      ...candidate.maxTokens === undefined ? {} : { maxTokens: candidate.maxTokens },
      ...candidate.inputModalities === undefined ? {} : { input: candidate.inputModalities },
    }
  })

  const submit = useCallback(async (): Promise<void> => {
    if (!ready) return
    const keyRef = key.trim() === '' ? undefined : deriveKeyRef(route.trim())
    setBusy(true)
    setFailure(null)
    const outcome = await store.write(
      host.ns,
      customProviderOps(route.trim(), {
        displayName,
        baseURL,
        api,
        keyRef,
        models: modelDrafts,
      }),
      openedAt,
    )
    if (!outcome.ok) {
      if (mounted.current) {
        setBusy(false)
        setFailure(outcome.message)
      }
      return
    }
    if (keyRef !== undefined) {
      const keyFailure = await store.storeCredential(keyRef, key.trim())
      if (keyFailure !== undefined) {
        if (mounted.current) {
          setBusy(false)
          setFailure(keyFailure)
        }
        return
      }
    }
    if (mounted.current) setBusy(false)
    props.onDone(route.trim())
  }, [api, baseURL, discovered, displayName, host.ns, key, models, openedAt, props, ready, route, store])

  const hint = problem === 'empty'
    ? t(KEYS['config.custom.routeRequired'])
    : problem === 'invalid'
      ? t(KEYS['config.route.invalid'])
      : problem === 'taken'
        ? t(KEYS['config.route.taken'])
        : urlProblem === 'empty'
          ? t(KEYS['config.baseUrl.required'])
          : urlProblem === 'invalid'
            ? t(KEYS['config.baseUrl.invalid'])
            : models.length === 0
              ? t(KEYS['config.route.needsModels'])
              : null

  return (
    <div className="dmc-custom zmd-card" id="dmc-custom-provider">
      <div className="dmc-custom-head">
        <h2 className="zmd-title">{t(KEYS['config.add.custom'])}</h2>
        <p className="zmd-lede">{t(KEYS['config.add.customHint'])}</p>
      </div>

      <div className="dmc-custom-fields">
        <label className="dmc-field">
          <span className="zmd-label">{t(KEYS['config.route.label'])}</span>
          <input
            className="zmd-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={route}
            disabled={!editable}
            placeholder={t(KEYS['config.custom.routePlaceholder'])}
            aria-invalid={problem === undefined ? undefined : true}
            onChange={(event) => { setRoute(event.target.value); setFailure(null) }}
          />
        </label>

        <label className="dmc-field">
          <span className="zmd-label">{t(KEYS['config.route.displayName'])}</span>
          <input
            className="zmd-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={displayName}
            disabled={!editable}
            placeholder={t(KEYS['config.custom.displayNamePlaceholder'])}
            onChange={(event) => { setDisplayName(event.target.value) }}
          />
        </label>

        <label className="dmc-field dmc-field-span">
          <span className="zmd-label">{t(KEYS['config.baseUrl.label'])}</span>
          <input
            className="zmd-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={baseURL}
            disabled={!editable}
            placeholder={t(KEYS['config.baseUrl.placeholderGateway'])}
            aria-invalid={urlProblem === 'invalid' ? true : undefined}
            onChange={(event) => { setBaseURL(event.target.value) }}
          />
        </label>

        <label className="dmc-field">
          <span className="zmd-label">{t(KEYS['config.api.label'])}</span>
          <select
            className="zmd-select"
            value={api}
            disabled={!editable}
            onChange={(event) => { setApi(event.target.value) }}
          >
            {host.protocols.map(protocol => (
              <option key={protocol} value={protocol}>{protocol}</option>
            ))}
          </select>
        </label>

        <label className="dmc-field">
          <span className="zmd-label">{t(KEYS['config.key.input'])}</span>
          <input
            className="zmd-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            disabled={!editable}
            placeholder={t(KEYS['config.custom.keyPlaceholder'])}
            aria-invalid={keyProblem === 'illegal' ? true : undefined}
            onChange={(event) => { setKey(event.target.value) }}
          />
          {keyProblem === 'illegal'
            ? <span className="dmc-custom-error">{t(KEYS['config.key.illegal'])}</span>
            : null}
        </label>

        <div className="dmc-field dmc-field-span">
          <div className="dmc-catalog-tools">
            <span className="zmd-label">{t(KEYS['config.models.label'])}</span>
            <button
              type="button"
              className="zmd-btn-ghost dmc-discover"
              disabled={!editable || urlProblem !== undefined || api === '' || discovery.kind === 'fetching'}
              onClick={() => { void fetchModels() }}
            >
              {t(KEYS['config.fetch.action'])}
            </button>
            {discovery.kind === 'fetching'
              ? <span className="dmc-catalog-status">{t(KEYS['config.fetch.fetching'])}</span>
              : null}
          </div>
          <textarea
            className="zmd-input dmc-custom-models"
            rows={4}
            autoComplete="off"
            spellCheck={false}
            aria-label={t(KEYS['config.models.label'])}
            value={modelsText}
            disabled={!editable}
            placeholder={t(KEYS['config.custom.modelsPlaceholder'])}
            onChange={(event) => { setModelsText(event.target.value) }}
          />
          <span className="dmc-custom-count">
            {t(KEYS['config.custom.modelsCount'], { count: String(models.length) })}
          </span>

          {discovery.kind === 'empty'
            ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.empty'])}</p>
            : null}
          {discovery.kind === 'error'
            ? <p className="dmc-catalog-error">{discovery.message}</p>
            : null}

          {discovery.kind === 'ready'
            ? (
              <div className="dmc-discover-panel">
                <h3 className="dmc-catalog-section">{t(KEYS['config.fetch.title'])}</h3>
                <p className="dmc-catalog-notice">{t(KEYS['config.fetch.description'])}</p>
                <input
                  className="zmd-input dmc-discover-search"
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={t(KEYS['config.fetch.search'])}
                  placeholder={t(KEYS['config.fetch.search'])}
                  value={discovery.query}
                  onChange={(event) => { setDiscovery({ ...discovery, query: event.target.value }) }}
                />
                <div className="dmc-discover-tools">
                  <span className="dmc-catalog-status">
                    {t(KEYS['config.fetch.count'], {
                      count: String(visible.length),
                      inCatalog: String(listedInCatalog),
                    })}
                  </span>
                  <button
                    type="button"
                    className="zmd-btn-ghost"
                    disabled={!editable || addable.length === 0 || allSelected}
                    onClick={() => { selectVisible(true) }}
                  >
                    {t(KEYS['config.fetch.selectAll'])}
                  </button>
                  <button
                    type="button"
                    className="zmd-btn-ghost"
                    disabled={!editable || selectedAddable.length === 0}
                    onClick={() => { selectVisible(false) }}
                  >
                    {t(KEYS['config.fetch.deselectAll'])}
                  </button>
                </div>
                {visible.length === 0
                  ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.noMatches'])}</p>
                  : (
                    <ul className="dmc-discover-list">
                      {visible.map((candidate) => {
                        const present = presentIds.has(candidate.id)
                        return (
                          <li
                            key={candidate.id}
                            className="dmc-discover-candidate"
                            data-present={present ? 'true' : undefined}
                          >
                            <label className="dmc-discover-label">
                              <input
                                className="dmc-discover-check"
                                type="checkbox"
                                checked={!present && discovery.selected.has(candidate.id)}
                                disabled={present || !editable}
                                onChange={(event) => { toggleCandidate(candidate.id, event.target.checked) }}
                              />
                              <span className="dmc-discover-id">{candidate.id}</span>
                            </label>
                            {candidate.name === undefined || candidate.name === candidate.id
                              ? null
                              : <span className="dmc-discover-name">{candidate.name}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                <div className="dmc-catalog-tools">
                  <button
                    type="button"
                    className="zmd-btn-primary"
                    disabled={!editable || selectedAddable.length === 0}
                    onClick={adopt}
                  >
                    {t(KEYS['config.fetch.adopt'])}
                  </button>
                </div>
              </div>
            )
            : null}
        </div>
      </div>

      {failure === null ? null : <p className="dmc-custom-error">{failure}</p>}

      <div className="dmc-custom-foot">
        {hint === null ? null : <span className="dmc-custom-hint">{hint}</span>}
        <button
          type="button"
          className="zmd-btn-ghost"
          disabled={busy}
          onClick={() => { props.onDone() }}
        >
          {t(KEYS['config.custom.cancel'])}
        </button>
        <button
          type="button"
          className="zmd-btn-primary"
          disabled={!editable || !ready}
          onClick={() => { void submit() }}
        >
          {busy ? t(KEYS['config.applying']) : t(KEYS['config.route.create'])}
        </button>
      </div>
    </div>
  )
}
