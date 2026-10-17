/**
 * 重试编辑器：「模型配置」页里某个提供商行内展开的那一块。
 *
 * WHERE THIS RENDERS, AND WHY HERE. It used to be a card registered into the
 * shipped Models section's `settings.models.provider-card` seat, which could only
 * name ONE adapter family (a keyed seat dispatches by `settingsNs`) and which put
 * the plugin's retry policy inside someone else's page. It now belongs to the
 * 模型配置 tab (ADR 0003's parallel section), where every provider already has a
 * row: the row's control line grows a 自动重试 word and the editor opens under
 * that row, so a policy stays attached to the provider it belongs to and the
 * closed page keeps its one-column quiet (docs/design-model-config-tab.md).
 *
 * THE CHART IS GONE, AND THE SCHEDULE IS STILL STATED. The card drew one bar per
 * retry because "10 retries / 60s cap" reads like ten one-minute waits and means
 * 0.5s, 1s, 2s … 60s, 60s. Dropping the chart must not drop that fact, so the
 * same truth is carried in words and two numbers instead of pixels: the doubling
 * rule as a sentence, and 首次等待 / 最长合计 as the two ends of the schedule.
 * {@link retryWaitCurve} is still the single place the schedule is derived — the
 * editor renders no number the tests do not pin.
 *
 * 最长合计 IS THE HIGH BOUND, NOT THE NOMINAL SUM. Jitter is ±`jitterRatio` per
 * wait, so the nominal total is a number the executor never actually takes; the
 * label promises the longest the whole budget can run, so the editor states
 * `waitRange(...).high`. (The card it replaces printed the nominal total under
 * this same label.)
 *
 * EVERY FACT COMES FROM THE STORE, AND EVERY WRITE GOES BACK THROUGH IT. The
 * namespace view is the page's own (`ModelConfigStore.namespace`), so this editor
 * cannot show a revision the drawer or the official tab has moved past, and
 * `store.write` carries the conflict retry (`settings/conflict` → re-read →
 * re-apply once) and the reload that makes the row's next render the Host's
 * answer rather than this component's optimism.
 *
 * TYPE, COLOUR AND SPACE ARE THE PAGE'S. The sheet is the page's own
 * (`modelConfigStyles.ts`, `dmc-` prefix) and this component reuses the page's
 * de-chromed action (`.dmc-key-action`) and its notice line (`.dmc-notice`)
 * rather than inventing a second design system inside the section. The two
 * numeric fields keep a real 1px edge and are the ONLY new bordered control:
 * a form field is told apart from a label by its edge, and the retry card's own
 * history recorded the regression that removing it caused.
 *
 * @module dsh-rabbit-model-picker/client/RetryEditor
 */

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

/** Props the page passes for one provider row. */
export interface RetryEditorProps {
  /** The row this editor belongs to (its settings address is the write target). */
  readonly row: ModelConfigRow
  /**
   * The row's namespace view, already read by the page's own store.
   *
   * Never undefined here: the page only renders this editor after
   * `retryCapable` answered true, which requires a namespace view to read.
   */
  readonly namespace: SettingsNamespaceView
  /** The page's shared store; the write goes through it, never through a local copy. */
  readonly store: ModelConfigStore
  /** The translator bound to this plugin's namespace. */
  readonly t: Translate
  /** Whether the settings document accepts writes at all. */
  readonly writable: boolean
}

/**
 * One labelled number field.
 *
 * The field is a real control: an edge, a text cursor, and a focus that selects
 * its number so the first keystroke replaces rather than appends.
 * @param props - the field's identity, copy, value and handlers.
 * @returns the field.
 */
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
              // The settings section closes itself on Escape. An open editor with
              // a focused field is the innermost thing the key can mean, so it
              // abandons the draft instead of the whole panel.
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

/**
 * One provider's retry policy, edited in place under its row.
 * @param props - the row, its namespace view, the store and the translator.
 * @returns the editor.
 */
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

  // The EFFECTIVE policy, so the fields show the numbers the executor will
  // actually spend; `declared` is read from the user layer, which is what tells a
  // provider that states its own policy apart from one inheriting the defaults.
  const view = resolveRetryPolicy(namespace.value, scope, namespace.user)

  // Drafts start empty and fall back to the stored value, so a re-render from an
  // unrelated update (the page reloads on every settings write) never overwrites
  // what the user is typing.
  const retriesText = retriesDraft ?? String(view.maxRetries)
  const capText = capDraft ?? formatMaxDelaySeconds(view.maxDelayMs)

  const parsedRetries = parseRetries(retriesText)
  const parsedCap = parseMaxDelaySeconds(capText)

  // The preview follows the DRAFT, so the two numbers answer "what would this do?"
  // while typing, before anything is written.
  const preview = useMemo(() => {
    const retries = parsedRetries ?? view.maxRetries
    const capMs = parsedCap ?? view.maxDelayMs
    const backoff = {
      initialDelayMs: Math.min(view.initialDelayMs, capMs),
      maxDelayMs: capMs,
      jitterRatio: view.jitterRatio,
    }
    const waits = retryWaitCurve(backoff, retries)
    return { retries, first: backoff.initialDelayMs, longest: waitRange(waits, view.jitterRatio).high }
  }, [parsedCap, parsedRetries, view.initialDelayMs, view.jitterRatio, view.maxDelayMs, view.maxRetries])

  /** Clear the drafts back to whatever the store now holds. */
  const settle = useCallback((message: string | null): void => {
    setRetriesDraft(null)
    setCapDraft(null)
    setNote(message)
  }, [])

  /** Write the two numbers, stating the whole policy so nothing else resets. */
  const commit = useCallback(async (): Promise<void> => {
    const retries = parseRetries(retriesText)
    const capMs = parseMaxDelaySeconds(capText)
    setRetriesInvalid(retries === null)
    setCapInvalid(capMs === null)
    if (retries === null || capMs === null) return
    // A write that changes nothing would still bump the revision and so
    // manufacture the very conflict the fence exists to catch. The button below
    // is gated on the same fact, so this branch is reached by a draft that only
    // LOOKS different (a padded or re-rounded spelling) and settles it back to
    // the canonical text.
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

  /** Clear this provider's own layer, back to the deployment defaults. */
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
  /**
   * Whether either field has left the value the store holds.
   *
   * The 保存 action is gated on this, the way the drawer's commit is (A9): a
   * button that is enabled but writes nothing invites a click that has to be
   * explained. Text comparison, not parsed comparison, because a draft that does
   * not parse yet is exactly when the reader wants to press it and be told what
   * is wrong.
   */
  const dirty = retriesText !== String(view.maxRetries)
    || capText !== formatMaxDelaySeconds(view.maxDelayMs)
  const summary = [
    `${preview.retries} ${t(KEYS['config.retryPolicy.retriesUnit'])}`,
    t(KEYS['config.retryPolicy.first'], { count: formatDuration(preview.first) }),
    t(KEYS['config.retryPolicy.total'], { count: formatDuration(preview.longest) }),
  ].join(' · ')

  return (
    <div className="dmc-retry" id={`dmc-retry-${provider}`}>
      {/* Where the value comes from is a fact about the whole editor, so it sits
          at its top rather than trailing the buttons. */}
      <p className="dmc-retry-state">
        {t(view.declared ? KEYS['config.retryPolicy.declared'] : KEYS['config.retryPolicy.inherits'])}
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

      {/* The chart's replacement, and it is the same fact: the second field is a
          CAP on a doubling schedule, not a fixed interval. */}
      <p className="dmc-notice">{t(KEYS['config.retryPolicy.doubling'])}</p>

      {/* One class of provider failure reaches the loop with a code no policy
          retries (see src/host/rateLimitRecovery.ts). Saying so here is what keeps
          this editor's claim true for that failure too: the Host promotes it, and
          the wait and the count it then spends are exactly these two numbers. */}
      <p className="dmc-notice">{t(KEYS['config.retryPolicy.recovery'])}</p>

      <p className="dmc-retry-summary">{summary}</p>

      <div className="dmc-retry-actions">
        <button
          type="button"
          className="dmc-key-action"
          disabled={!editable || !dirty}
          onClick={() => { void commit() }}
        >
          {busy ? t(KEYS['config.applying']) : t(KEYS['config.apply'])}
        </button>
        <button
          type="button"
          className="dmc-key-action"
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
