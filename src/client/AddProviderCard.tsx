import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  baseUrlProblemOf, customProviderOps, deriveKeyRef, modelIdsOf, routeProblemOf,
} from './modelConfigModel.ts'

export interface AddProviderCardProps {
  readonly rows: readonly ModelConfigRow[]
  readonly namespaces: ReadonlyMap<string, { readonly revision: number }>
  readonly host: { readonly ns: string; readonly protocols: readonly string[] }
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly writable: boolean
  readonly onDone: () => void
}

export function AddProviderCard(props: AddProviderCardProps): ReactElement {
  const { store, t, host } = props
  const [route, setRoute] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [api, setApi] = useState(host.protocols[0] ?? '')
  const [key, setKey] = useState('')
  const [modelsText, setModelsText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const mounted = useRef(true)

  const taken = useMemo(
    () => props.rows.map(row => row.entry.provider),
    [props.rows],
  )
  const problem = routeProblemOf(route, taken)
  const urlProblem = baseUrlProblemOf(baseURL)
  const models = modelIdsOf(modelsText)
  const editable = props.writable && !busy
  const ready = problem === undefined
    && urlProblem === undefined
    && models.length > 0
    && api !== ''

  const submit = useCallback(async (): Promise<void> => {
    if (!ready) return
    const revision = props.namespaces.get(host.ns)?.revision
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
        models,
      }),
      revision,
    )
    if (!mounted.current) return
    if (!outcome.ok) {
      setBusy(false)
      setFailure(outcome.message)
      return
    }
    if (keyRef !== undefined) {
      const keyFailure = await store.storeCredential(keyRef, key.trim())
      if (!mounted.current) return
      if (keyFailure !== undefined) {
        setBusy(false)
        setFailure(keyFailure)
        return
      }
    }
    setBusy(false)
    props.onDone()
  }, [api, baseURL, displayName, host.ns, key, models, props, ready, route, store])

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
            onChange={(event) => { setKey(event.target.value) }}
          />
        </label>

        <label className="dmc-field dmc-field-span">
          <span className="zmd-label">{t(KEYS['config.models.label'])}</span>
          <textarea
            className="zmd-input dmc-custom-models"
            rows={4}
            autoComplete="off"
            spellCheck={false}
            value={modelsText}
            disabled={!editable}
            placeholder={t(KEYS['config.custom.modelsPlaceholder'])}
            onChange={(event) => { setModelsText(event.target.value) }}
          />
          <span className="dmc-custom-count">
            {t(KEYS['config.custom.modelsCount'], { count: String(models.length) })}
          </span>
        </label>
      </div>

      {failure === null ? null : <p className="dmc-custom-error">{failure}</p>}

      <div className="dmc-custom-foot">
        {hint === null ? null : <span className="dmc-custom-hint">{hint}</span>}
        <button
          type="button"
          className="zmd-btn-ghost"
          disabled={busy}
          onClick={props.onDone}
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
