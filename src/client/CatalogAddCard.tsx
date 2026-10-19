import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  apiKeyProblem, baseUrlProblemOf, catalogAddProfile, deriveKeyRef, providerFamilyOf,
} from './modelConfigModel.ts'

export interface CatalogAddCardProps {
  readonly row: ModelConfigRow
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly writable: boolean
  readonly onDone: () => void
  readonly onCancel: () => void
}

export function CatalogAddCard(props: CatalogAddCardProps): ReactElement {
  const { row, store, t } = props
  const [key, setKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [openedAt] = useState<number | undefined>(() => store.namespace(row.entry.settingsNs)?.revision)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const nativeAuth = row.entry.nativeAuth
  const family = providerFamilyOf(row.entry.settingsNs)
  const unsupported = family === 'unknown'
  const keyless = nativeAuth !== undefined && nativeAuth.env.length === 0 && nativeAuth.oauth === true
  const keyProblem = apiKeyProblem(key)
  const urlProblem = baseUrlProblemOf(baseURL)
  const editable = props.writable && !busy
  const ready = !unsupported && keyProblem === undefined && urlProblem !== 'invalid'

  const placeholder = row.entry.defaultBaseURL !== undefined && row.entry.defaultBaseURL !== ''
    ? row.entry.defaultBaseURL
    : t(KEYS['config.baseUrl.default'])

  const submit = async (): Promise<void> => {
    if (!ready || !editable || unsupported) return
    const provider = row.entry.provider
    const keyValue = key.trim()
    setBusy(true)
    setFailure(null)
    const outcome = await store.write(
      row.entry.settingsNs,
      [{
        op: 'set',
        path: [...row.entry.settingsPath],
        value: catalogAddProfile(provider, {
          baseURL,
          bindKey: family === 'pi-ai' && keyValue !== '',
        }),
      }],
      openedAt,
    )
    if (!outcome.ok) {
      if (mounted.current) {
        setBusy(false)
        setFailure(outcome.message)
      }
      return
    }
    if (keyValue !== '') {
      const keyFailure = await store.storeCredential(deriveKeyRef(provider), keyValue)
      if (keyFailure !== undefined) {
        if (mounted.current) {
          setBusy(false)
          setFailure(keyFailure)
        }
        return
      }
    }
    if (mounted.current) setBusy(false)
    props.onDone()
  }

  const fields = unsupported
    ? <p className="dmc-notice">{t(KEYS['config.provider.unknown'])}</p>
    : (
      <div className="dmc-custom-fields">
        {keyless
          ? (
            <p className="dmc-notice dmc-field-span">{t(KEYS['config.key.keyless'])}</p>
          )
          : (
            <label className="dmc-field">
              <span className="zmd-label">{t(KEYS['config.key.input'])}</span>
              <input
                className="zmd-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                disabled={!editable}
                placeholder={t(KEYS['config.key.placeholder'])}
                aria-invalid={keyProblem === 'illegal' ? true : undefined}
                onChange={(event) => { setKey(event.target.value); setFailure(null) }}
              />
              {keyProblem === 'illegal'
                ? <span className="dmc-custom-error">{t(KEYS['config.key.illegal'])}</span>
                : null}
            </label>
          )}

        <label className="dmc-field dmc-field-span">
          <span className="zmd-label">{t(KEYS['config.baseUrl.label'])}</span>
          <input
            className="zmd-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={baseURL}
            disabled={!editable}
            placeholder={placeholder}
            aria-invalid={urlProblem === 'invalid' ? true : undefined}
            onChange={(event) => { setBaseURL(event.target.value); setFailure(null) }}
          />
          {urlProblem === 'invalid'
            ? <span className="dmc-custom-error">{t(KEYS['config.baseUrl.invalid'])}</span>
            : null}
        </label>
      </div>
    )

  return (
    <div className="dmc-custom zmd-card">
      <div className="dmc-custom-head">
        <h2 className="zmd-title">{row.entry.displayName}</h2>
        <p className="dmc-route">{row.entry.provider}</p>
      </div>

      {unsupported
        ? null
        : <p className="dmc-notice">{t(KEYS['config.catalogAdd.hint'])}</p>}

      {fields}

      {failure === null ? null : <p className="dmc-custom-error">{failure}</p>}

      <div className="dmc-custom-foot">
        <button
          type="button"
          className="zmd-btn-ghost"
          disabled={busy}
          onClick={props.onCancel}
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
