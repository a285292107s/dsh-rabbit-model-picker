import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ModelConfigRow, SettingsNamespaceView, SettingsOp, Translate } from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import { KEYS } from './modelConfigCopy.ts'
import {
  MAX_MAX_DELAY_MS, MAX_RETRIES, formatDuration, formatMaxDelaySeconds,
  parseMaxDelaySeconds, parseRetries, resolveRetryPolicy, retryPolicyDocument,
  retryWaitCurve, waitRange,
} from './retryPolicy.ts'

export interface RetryEditorProps {
  readonly row: ModelConfigRow
  readonly namespace: SettingsNamespaceView
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly writable: boolean
}

function RetryField(props: {
  readonly id: string
  readonly label: string
  readonly unit: string
  readonly value: string
  readonly invalid: boolean
  readonly disabled: boolean
  readonly onChange: (next: string) => void
  readonly onCommit: () => void
  readonly onCancel: () => void
}): ReactElement {
  return (
    <div className="dmc-retry-field">
      <label className="dmc-retry-label" htmlFor={props.id}>{props.label}</label>
      <div className="dmc-retry-row">
        <input
          id={props.id}
          className="dmc-retry-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={props.value}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onChange={(event) => { props.onChange(event.target.value) }}
          onFocus={(event) => { event.currentTarget.select() }}
          onBlur={props.onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              props.onCommit()
            }
            if (event.key === 'Escape') {
              event.stopPropagation()
              props.onCancel()
            }
          }}
        />
        <span className="dmc-retry-unit">{props.unit}</span>
      </div>
    </div>
  )
}

export function RetryEditor(props: RetryEditorProps): ReactElement {
  const { row, namespace, store, t, writable } = props
  const provider = row.entry.provider
  const ns = row.entry.settingsNs
  const scope = row.entry.settingsPath

  const [retriesDraft, setRetriesDraft] = useState<string | null>(null)
  const [capDraft, setCapDraft] = useState<string | null>(null)
  const [retriesInvalid, setRetriesInvalid] = useState(false)
  const [capInvalid, setCapInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const view = resolveRetryPolicy(namespace.value, scope, namespace.user)

  const retriesText = retriesDraft ?? String(view.maxRetries)
  const capText = capDraft ?? formatMaxDelaySeconds(view.maxDelayMs)

  const parsedRetries = parseRetries(retriesText)
  const parsedCap = parseMaxDelaySeconds(capText)

  const preview = useMemo(() => {
    const retries = parsedRetries ?? view.maxRetries
    const capMs = parsedCap ?? view.maxDelayMs
    const backoff = {
      initialDelayMs: Math.min(view.initialDelayMs, capMs),
      maxDelayMs: capMs,
      jitterRatio: view.jitterRatio,
    }
    const waits = retryWaitCurve(backoff, retries)
    return { retries, first: backoff.initialDelayMs, longest: waitRange(waits, view.jitterRatio).high, waits }
  }, [parsedCap, parsedRetries, view.initialDelayMs, view.jitterRatio, view.maxDelayMs, view.maxRetries])

  const backoffTicks = useMemo(() => {
    const shown = preview.waits.slice(0, 5)
    if (shown.length === 0) return []
    const peak = Math.max(...shown, 1)
    return shown.map(wait => Math.min(4, Math.max(1, Math.ceil((wait / peak) * 4))))
  }, [preview.waits])

  const settle = useCallback((message: string | null): void => {
    setRetriesDraft(null)
    setCapDraft(null)
    setNote(message)
  }, [])

  const commit = useCallback(async (): Promise<void> => {
    const retries = parseRetries(retriesText)
    const capMs = parseMaxDelaySeconds(capText)
    setRetriesInvalid(retries === null)
    setCapInvalid(capMs === null)
    if (retries === null || capMs === null) return
    if (retries === view.maxRetries && capMs === view.maxDelayMs) {
      settle(null)
      return
    }
    setBusy(true)
    setNote(null)
    const ops: SettingsOp[] = [{
      op: 'set',
      path: [...scope, 'retryPolicy'],
      value: retryPolicyDocument(view, retries, capMs),
    }]
    const outcome = await store.write(ns, ops, namespace.revision)
    if (!mounted.current) return
    setBusy(false)
    if (!outcome.ok) {
      setNote(outcome.message)
      return
    }
    settle(t(KEYS['config.retryPolicy.saved']))
  }, [capText, ns, namespace.revision, retriesText, scope, settle, store, t, view])

  const reset = useCallback(async (): Promise<void> => {
    setBusy(true)
    setNote(null)
    const outcome = await store.write(
      ns, [{ op: 'unset', path: [...scope, 'retryPolicy'] }], namespace.revision,
    )
    if (!mounted.current) return
    setBusy(false)
    if (!outcome.ok) {
      setNote(outcome.message)
      return
    }
    settle(t(KEYS['config.retryPolicy.saved']))
  }, [ns, namespace.revision, scope, settle, store, t])

  const editable = writable && !busy
  const always = view.mode === 'always'
  const dirty = retriesText !== String(view.maxRetries)
    || capText !== formatMaxDelaySeconds(view.maxDelayMs)
  const firstWait = t(KEYS['config.retryPolicy.first'], { count: formatDuration(preview.first) })
  const longestTotal = t(KEYS['config.retryPolicy.total'], { count: formatDuration(preview.longest) })

  return (
    <div className="dmc-retry" id={`dmc-retry-${provider}`}>
      <p className="dmc-retry-state zmd-runhead">
        {t(view.declared ? KEYS['config.retryPolicy.declared'] : KEYS['config.retryPolicy.inherits'])}
        <span className="zmd-rule" aria-hidden="true" />
      </p>

      <div className="dmc-retry-fields">
        <RetryField
          id={`retry-count-${provider}`}
          label={t(KEYS['config.retryPolicy.retries'])}
          unit={t(KEYS['config.retryPolicy.retriesUnit'])}
          value={retriesText}
          invalid={retriesInvalid}
          disabled={!editable}
          onChange={(next) => { setRetriesDraft(next); setRetriesInvalid(false); setNote(null) }}
          onCommit={() => { void commit() }}
          onCancel={() => { settle(null) }}
        />
        <RetryField
          id={`retry-cap-${provider}`}
          label={t(KEYS['config.retryPolicy.cap'])}
          unit={t(KEYS['config.retryPolicy.capUnit'])}
          value={capText}
          invalid={capInvalid}
          disabled={!editable}
          onChange={(next) => { setCapDraft(next); setCapInvalid(false); setNote(null) }}
          onCommit={() => { void commit() }}
          onCancel={() => { settle(null) }}
        />
      </div>

      <p className="dmc-notice">{t(KEYS['config.retryPolicy.doubling'])}</p>

      <p className="dmc-notice">{t(KEYS['config.retryPolicy.recovery'])}</p>

      <p className="dmc-retry-summary">
        <span className="dmc-retry-tally">{preview.retries}</span>
        <span className="dmc-retry-tally-unit">{t(KEYS['config.retryPolicy.retriesUnit'])}</span>
        <span className="dmc-retry-detail">{firstWait} · {longestTotal}</span>
      </p>

      <span className="dmc-backoff" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const level = backoffTicks[index]
          return (
            <span
              className="dmc-backoff-cell"
              data-level={level === undefined ? '0' : String(level)}
              key={String(index)}
            />
          )
        })}
      </span>

      <div className="dmc-retry-actions">
        <button
          type="button"
          className="zmd-btn-door zmd-btn-commit"
          disabled={!editable || !dirty}
          onClick={() => { void commit() }}
        >
          {busy ? t(KEYS['config.applying']) : t(KEYS['config.apply'])}
        </button>
        <button
          type="button"
          className="zmd-btn-quiet"
          disabled={!editable || !view.declared}
          onClick={() => { void reset() }}
        >
          {t(KEYS['config.retryPolicy.reset'])}
        </button>
        {note === null ? null : <span className="dmc-notice">{note}</span>}
      </div>

      {retriesInvalid
        ? <p className="dmc-notice">{t(KEYS['config.retryPolicy.badRetries'], { count: String(MAX_RETRIES) })}</p>
        : null}
      {capInvalid
        ? <p className="dmc-notice">{t(KEYS['config.retryPolicy.badCap'], { count: String(MAX_MAX_DELAY_MS / 1000) })}</p>
        : null}
      {always ? <p className="dmc-notice">{t(KEYS['config.retryPolicy.always'])}</p> : null}
      {writable ? null : <p className="dmc-notice">{t(KEYS['config.retryPolicy.unavailable'])}</p>}
    </div>
  )
}
