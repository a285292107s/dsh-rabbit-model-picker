/**
 * 「模型配置」页主体：一行一个提供商，就地改凭据、协议、模型目录、重试策略与生命周期。
 *
 * WHAT THIS SURFACE IS. The parallel settings tab ADR 0003 adds (the official
 * Models page keeps its own id and stays untouched). This file owns the PAGE half:
 * a provider row per directory entry, edited in place — no popover, no second
 * page. The model catalog is the row's own expanded region (`ModelCatalog.tsx`),
 * so the settings dialog remains the only modal the task has: the page never opens
 * a second overlay, and the catalog's rows are a disclosure of the provider row
 * above them.
 *
 * EVERY FACT COMES FROM `ModelConfigStore`, and every write goes back through it.
 * The page keeps no copy of the directory, the profile or the credential state:
 * local state here is only what the page itself is doing (a half-typed key, a
 * pending write, an open settings well, an open catalog, an open add picker).
 * That is what keeps this tab and the official Models tab from disagreeing — the
 * failure the two-surface design exists to avoid.
 *
 * THE PAGE LISTS WHAT THE USER HAS, NOT THE CATALOG. The directory hands a row to
 * every provider an adapter COULD serve (48 of them on the reference deployment,
 * 38 of which nobody ever added), so the list renders `row.added` only. The rest
 * are reachable through the section's one add action, which discloses the
 * not-added entries and writes a profile for the chosen one through the same
 * `store.write` + `pathOps` path every other edit uses. The row then appears by
 * itself — `added` comes from the store's next snapshot, so nothing here keeps a
 * second list in step.
 *
 * THE PURE LAYER IS NOT RE-DERIVED. `providerUsable`, `keyConfigured`,
 * `keyWritable`, `keyRefOf`, `credentialRefFor`, `deriveKeyRef`, `pathOps`,
 * `readPath`, `isRemovable`, `modelsOf` and `protocolChoices` all come from
 * `modelConfigModel.ts`; this file decides layout and gestures, never rules.
 *
 * THE COPY IS DATA. Every user-visible string is a `KEYS.*` lookup, so no key is
 * ever spelled inline.
 *
 * THE PAGE STATES ONE ANSWER PER ROW, AND COUNTS THEM. {@link readingOf} turns a
 * joined row into the same three things at once — the word the row says, the
 * marker its rail draws, and the row of the count the page's readout prints — so
 * the statement at the top can never disagree with the rows underneath it. All
 * three come from the pure layer (`providerUsable`, `keyConfigured`,
 * `credentialRefFor`); this file decides layout and gestures, never rules.
 *
 * @module dsh-rabbit-model-picker/client/ModelConfigPage
 */

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

/**
 * The protocol id -> the host's own word for it.
 *
 * The CHOICES are never read from here — they come from the owning namespace's
 * schema (`protocolChoices`), so a release that adds a protocol reaches the page
 * by itself. This table only names the ids the host dictionary happens to have a
 * word for; an id it does not know is shown as itself rather than dropped.
 */
const PROTOCOL_LABELS: Readonly<Record<string, ConfigKey>> = {
  'anthropic-messages': KEYS['config.api.anthropicMessages'],
  'openai-completions': KEYS['config.api.openaiCompletions'],
  'openai-responses': KEYS['config.api.openaiResponses'],
}

/** Props the slot owner passes; the signature is frozen for the wiring task. */
export interface ModelConfigPageProps {
  /** Leave this settings section (the owner decides what that means). */
  readonly close: () => void
  /** The shared fact store; the page subscribes and never caches its answer. */
  readonly store: ModelConfigStore
  /** The translator bound to this plugin's namespace. */
  readonly t: Translate
}

/**
 * How a row ANSWERS the page's one question: can this provider serve a request?
 *
 * The three answers are the whole vocabulary the list states, and they are the
 * frozen state table (brief §2). `missing-key` is the narrowest criterion and is
 * tested FIRST: a row that owes a key it does not have is "not finished yet", and
 * the strength discipline is explicit that such a row must not be painted as
 * broken (the audit measured the old boolean painting 38 of 48 rows, i.e.
 * distinguishing nothing). The criterion is the credential cell's own condition —
 * a reference the page would actually offer to fill — rather than a second
 * derivation of "has a reference".
 */
type RowAnswer = 'ready' | 'missing-key' | 'unreachable'

/**
 * One row's reading: the answer it states and the word it prints.
 *
 * A DIAGNOSTIC IS NOT AN ANSWER, and brief §14 R2 makes that visible: it travels
 * beside the state as `data-error` (never as a fourth `data-state`, and never as a
 * rail of its own). A failed write does not turn a usable provider into something
 * else, so the row keeps its word and the `!` entry is the only thing that
 * changes. The reviewed page read "answer says 可用, rail says something is wrong"
 * as a contradiction; the rail now carries exactly one meaning.
 *
 * THE WORD MAY BE MORE SPECIFIC THAN THE STATE (brief §15.2). The session route
 * states 已登录 where every other ready row states 可用, because it is the only row
 * with no credential cell — and "why is there no key field here" is a question only
 * that word answers. Its `data-state` is still `ready`: the state is unchanged,
 * only the vocabulary is sharper. (`config.account.signedOut` is deliberately NOT
 * used here: the store filters an unauthenticated account row out of the list
 * entirely, modelConfigStore.ts:262, so the page can never meet that state.)
 */
interface RowReading {
  /** The row's state: what `data-state` carries and what the readout counts. */
  readonly answer: RowAnswer
  /** The copy key of the row's one word, as specific as the row allows. */
  readonly word: ConfigKey
  /** The diagnostic this row can disclose, if any. */
  readonly diagnostic: string | undefined
}

/**
 * Read one row.
 *
 * Every criterion here is a call into the pure layer, so the word, the rail and
 * the page's count cannot drift from each other or from the data layer.
 * @param row - one joined row.
 * @param failure - this session's failure for this row, if any.
 * @returns the reading.
 */
function readingOf(row: ModelConfigRow, failure: string | undefined): RowReading {
  const diagnostic = failure ?? row.entry.error
  const session = isSessionRoute(row)
  // The credential cell's own condition, reused rather than re-derived: a row
  // states 缺密钥 only where the page actually offers the key it is missing.
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

/** Whether a value is a plain record (not an array, not null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A copy of one record, or an empty one when the value is not a record. */
function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {}
}

/** The same record without one key (a fresh object, so React re-renders). */
function without(record: Readonly<Record<string, string>>, key: string): Record<string, string> {
  const next: Record<string, string> = { ...record }
  delete next[key]
  return next
}

/**
 * Whether this row authenticates through the session rather than a key.
 *
 * `accountAvailable` is documented as "undefined for every other route", so a
 * value there settles it. The fallback covers the snapshot that has not been told
 * (the field is the deciding input of the pure layer's own account branch, and
 * `providerUsable` returning false for an active route that names no reference is
 * exactly that shape) — without it the page would offer a key field for the one
 * route whose key nobody stores.
 * @param row - one joined row.
 * @returns whether the row owes no credential this page may edit.
 */
function isSessionRoute(row: ModelConfigRow): boolean {
  if (row.accountAvailable !== undefined) return true
  return row.entry.active && row.apiKeyEnv === undefined && !providerUsable(row)
}

/** The host's word for one protocol id, or the id itself when it has none. */
function protocolLabel(t: Translate, protocol: string): string {
  const key = PROTOCOL_LABELS[protocol]
  return key === undefined ? protocol : t(key)
}

/** What one row is allowed to do; every entry point is the page's, not the row's. */
interface ProviderRowProps {
  readonly row: ModelConfigRow
  /**
   * This row's position in the ledger, 1-based.
   *
   * The ledger's two-digit number (01, 02 …) is decoration over real order, so it
   * is `aria-hidden`; it exists to make eleven rows read as a manifest rather than
   * as eleven unrelated cards. It is computed from the same `listed` array the
   * readout counts, never from a stored counter.
   */
  readonly index: number
  readonly store: ModelConfigStore
  readonly t: Translate
  /** Whether the settings document accepts writes at all. */
  readonly writable: boolean
  /** The word shown while this row has a write in flight. */
  readonly pending: string | undefined
  /** This session's failure for this row, if any. */
  readonly failure: string | undefined
  /** Whether this row's catalog region is expanded below it. */
  readonly catalogOpen: boolean
  /** Whether the page is holding a discard confirmation for this catalog open. */
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

/**
 * One provider row: one ledger line, plus the settings well it opens.
 *
 * THE LINE holds the row's three facts on four shared tracks — identity on the
 * left (name + route id), the model cell (a fact that is also the region's door),
 * the answer word, and the row's one door (管理). The answer word and the door are
 * right-aligned, so their right edges coincide down the whole list; that shared
 * right edge is what makes eleven rows read as one ledger rather than eleven cards.
 *
 * THE WELL is where every control lives: a two-column form (label / value) with the
 * credential, the protocol, the retry policy, and — on the last line, away from the
 * credential words — the provider's lifecycle entry. It is a direct child of the
 * row, under both segments, so opening it never re-flows the line above. See
 * docs/ui-language.md §4 for the anatomy and why the old six-track control line was
 * retired (§5.35 measured its row at 108px with four baselines in it).
 * @param props - the row and the page's callbacks.
 * @returns the row.
 */
function ProviderRow(props: ProviderRowProps): ReactElement {
  const { row, store, t } = props
  const provider = row.entry.provider
  const displayName = isSessionRoute(row) ? t(KEYS['config.account.name']) : row.entry.displayName
  const reading = readingOf(row, props.failure)
  const session = isSessionRoute(row)
  const busy = props.pending !== undefined
  const editable = props.writable && !busy
  /** The ledger's two-digit position (decoration; the order itself is the data). */
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
  /**
   * Whether this provider's schema declares a retry policy, which is the whole
   * gate on the 自动重试 entry: the write below is refused by a schema that does
   * not have the field, so the entry exists only where it can land.
   */
  const retryable = retryCapable(namespace, row.entry.settingsPath)
  /** Whether deleting this profile also removes the key it reads (B3's narrow rule). */
  const clearsKey = keyPresent && keyWritable(row) && keyRefOf(row) === deriveKeyRef(provider)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [retryOpen, setRetryOpen] = useState(false)
  /** Whether this row's settings well is open. One row at a time is not required
      (a user may compare two), so each row owns its own flag. */
  const [wellOpen, setWellOpen] = useState(false)
  const shown = reading.diagnostic

  // Opening the catalog closes this row's settings well. The well's closing
  // gesture already means "cancel the half-typed key" (see the manage button), so
  // this is the same rule applied by the other door — and it keeps the two
  // expanded regions from stacking. The reverse is deliberately NOT done: opening
  // the well leaves the catalog open, because collapsing the catalog would throw
  // away a model draft that the user never asked to discard.
  useEffect(() => {
    if (!props.catalogOpen) return
    setEditing(false)
    setDraft('')
    setRetryOpen(false)
    setWellOpen(false)
  }, [props.catalogOpen])

  /**
   * Commit the typed key.
   *
   * An empty field is only reported when the user SAID to store it (Enter): the
   * host cannot read the stored value back, so a field left blank on the way out
   * means "I changed my mind", and the page says why nothing was written only
   * when the gesture asked for a write.
   * @param explicit - whether the gesture was an explicit store (Enter).
   */
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
      <span
        className="dmc-rail"
        data-state={reading.answer}
        data-usable={reading.answer === 'unreachable' ? 'false' : 'true'}
        aria-hidden="true"
      />

      {/* Segment one, left end: identity. The route id rides inside the name's own
          track, so the two can never be separated by a grid gap. The two-digit
          number is the ledger's position mark: decoration over the real order of
          `listed`, so it is aria-hidden and spends no information of its own. */}
      <span className="dmc-name">
        <span className="dmc-index" aria-hidden="true">{manifestIndex}</span>
        {displayName}
        <span className="dmc-route">{provider}</span>
      </span>

      {/* Segment one, middle: the model cell is a FACT (how many models this
          provider's own catalog holds) and the door to the catalog region that
          curates it — a DISCLOSURE, not a popup. A provider with no catalog of its
          own says 默认 and the title carries the long sentence the cell cannot
          hold. */}
      <button
        type="button"
        className="dmc-catalog"
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

      {/* Segment one, right end: the row's answer, as ONE word. The key is the
          answer itself, so a changed answer remounts the node and replays the
          160ms landing (the sheet's only motion on a row). */}
      <span className="dmc-verdict" data-state={reading.answer} key={reading.answer}>
        {t(reading.word)}
      </span>

      {/* The row's one door. It opens the settings well under the line, which is
          where every per-provider control lives (§5.35) — the scan line above
          never holds a second control besides the model cell's own door. */}
      <button
        type="button"
        className="dmc-manage"
        aria-expanded={wellOpen}
        aria-controls={`dmc-well-${provider}`}
        onClick={() => {
          // Closing the well is the gesture that ends any half-typed key: the field
          // unmounts with the well, so a draft would otherwise survive invisibly and
          // come back the next time the row is opened. Explicitly closing = cancel.
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
            {/* A diagnostic is a fact about the row, not a state of it, so it sits
                at the top of the well in the primary ink: the rail and the answer
                word still carry the state, and the sentence explains whichever
                write failed. */}
            {shown === undefined ? null : <p className="dmc-diagnostic">{shown}</p>}

            {session
              ? (
                <>
                  <span className="dmc-field-label">{t(KEYS['config.credential.label'])}</span>
                  <span className="dmc-field-value">
                    <span className="dmc-quiet">{t(KEYS['config.credential.session'])}</span>
                  </span>
                </>
              )
              : keyRef === undefined
                ? null
                : (
                  <>
                    <span className="dmc-field-label">{t(KEYS['config.credential.label'])}</span>
                    <span className="dmc-field-value">
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
                              className="dmc-key-action"
                              disabled={!editable}
                              onClick={() => { setEditing(true); setDraft('') }}
                            >
                              {t(keyPresent ? KEYS['config.key.replaceShort'] : KEYS['config.key.add'])}
                            </button>
                            {keyPresent
                              ? (
                                <button
                                  type="button"
                                  className="dmc-key-clear"
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
                    </span>
                  </>
                )}

            {protocols.length === 0
              ? null
              : (
                <>
                  <span className="dmc-field-label">{t(KEYS['config.api.label'])}</span>
                  <span className="dmc-field-value">
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
                  </span>
                </>
              )}

            {retryable
              ? (
                <>
                  <span className="dmc-field-label">{t(KEYS['config.retryPolicy.trigger'])}</span>
                  <span className="dmc-field-value">
                    <button
                      type="button"
                      className="dmc-retry-action"
                      aria-expanded={retryOpen}
                      aria-controls={`dmc-retry-${provider}`}
                      onClick={() => { setRetryOpen(current => !current) }}
                    >
                      {t(KEYS['config.retryPolicy.edit'])}
                    </button>
                  </span>
                </>
              )
              : null}

            {/* The editor is a sibling of the field line, spanning the well under
                both columns, so opening it never re-flows the controls above. */}
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

            {/* The lifecycle entry. It is the well's LAST line and carries no field
                label, because it is not a value of this provider — it is the
                provider's own existence. */}
            {row.entry.settingsPath.length === 0
              ? null
              : (
                <>
                  {/* The lifecycle entry is not a provider VALUE, so the destructive
                      line is separated from the three fields above it by one
                      structural rule. The field code names the block; it carries no
                      Chinese label because the action below already names itself. */}
                  <span className="dmc-well-rule" aria-hidden="true" />
                  <span className="dmc-field-label" aria-hidden="true" />
                  <span className="dmc-field-value">
                    <button
                      type="button"
                      className="dmc-danger"
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
                  </span>
                </>
              )}
          </div>
        )
        : null}

      {/* The catalog region. It is the row's own disclosure: it lives inside this
          <li>, after the settings well, and shares the row's positional fill. The
          page owns the collapse guard, so the region reports its draft state and
          asks the page before it unmounts. */}
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

/**
 * The 「模型配置」 section.
 * @param props - the slot owner's props.
 * @returns the section.
 */
export function ModelConfigPage(props: ModelConfigPageProps): ReactElement {
  const { close, store, t } = props
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const mounted = useRef(true)
  const [pending, setPending] = useState<Readonly<Record<string, string>>>({})
  const [failures, setFailures] = useState<Readonly<Record<string, string>>>({})
  const [catalog, setCatalog] = useState<string | null>(null)
  const [catalogDirty, setCatalogDirty] = useState(false)
  /**
   * A collapse the user has asked for while the catalog holds an unsaved draft.
   * `close` is the catalog's own collapse; `switch` is another provider's model
   * cell asking for the region while this draft is still open. The draft is never
   * discarded silently — the region prints the question and waits.
   */
  const [catalogGuard, setCatalogGuard] = useState<
    { readonly kind: 'close' } | { readonly kind: 'switch'; readonly provider: string } | null
  >(null)
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // The sheet is injected here rather than by the wiring task so the page works
  // wherever it is mounted; the element id makes a second injection a replacement.
  useEffect(() => injectModelConfigStyles(), [])

  // The store publishes only while it has subscribers, so the read is bound to
  // this mount: a closed panel holds no listener and is never woken to re-read.
  useEffect(() => { void store.load() }, [store])

  /** Put focus back on the model cell that opened a catalog. */
  const focusCatalogTrigger = useCallback((provider: string): void => {
    if (typeof document === 'undefined') return
    document.getElementById(`dmc-catalog-btn-${provider}`)?.focus()
  }, [])

  /** Collapse the catalog now; the caller has already settled the draft. */
  const collapseCatalog = useCallback((): void => {
    const provider = catalog
    setCatalog(null)
    setCatalogDirty(false)
    setCatalogGuard(null)
    if (provider !== null) focusCatalogTrigger(provider)
  }, [catalog, focusCatalogTrigger])

  /** Ask to collapse: a dirty draft is confirmed first. */
  const requestCloseCatalog = useCallback((): void => {
    if (catalog === null) return
    if (catalogDirty) {
      setCatalogGuard({ kind: 'close' })
      return
    }
    collapseCatalog()
  }, [catalog, catalogDirty, collapseCatalog])

  /** Open one provider's catalog; another provider's dirty draft is confirmed first. */
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

  /** Answer the guard: the draft is abandoned and the pending action proceeds. */
  const discardCatalogDraft = useCallback((): void => {
    const pendingAction = catalogGuard
    setCatalogDirty(false)
    setCatalogGuard(null)
    if (pendingAction === null) return
    if (pendingAction.kind === 'switch') {
      // Focus the cell that asked for the switch: the clicked cell is still there,
      // and the discard button that was just pressed is not.
      focusCatalogTrigger(pendingAction.provider)
      setCatalog(pendingAction.provider)
      return
    }
    collapseCatalog()
  }, [catalogGuard, collapseCatalog, focusCatalogTrigger])

  /** Keep editing: the guard line goes away and the draft stays. */
  const keepEditingCatalog = useCallback((): void => { setCatalogGuard(null) }, [])

  // A provider can disappear under an open region (the row was removed in another
  // tab, or the store re-read a document that no longer has it). The region is
  // rendered by the row, so a missing row unmounts it; this only clears the
  // page's own pointer so the next Escape does not address a row that is gone.
  useEffect(() => {
    if (catalog === null) return
    if (snapshot.rows.some(row => row.added && row.entry.provider === catalog)) return
    setCatalog(null)
    setCatalogDirty(false)
    setCatalogGuard(null)
  }, [catalog, snapshot.rows])

  /**
   * Run one row's write, marking the row and landing any failure on it.
   * @param provider - the row's route id.
   * @param word - the in-flight word the row shows.
   * @param action - the write; its message (or undefined) is the outcome.
   */
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

  /** Store one typed credential literal. */
  const saveKey = useCallback((row: ModelConfigRow, value: string): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    // An empty field is not a write: the host cannot read the stored value back,
    // so "blank" means "keep what is there" and the page says so on the row.
    if (value.length === 0) {
      const provider = row.entry.provider
      const blank = t(keyConfigured(row) ? KEYS['config.key.blank'] : KEYS['config.key.blankNew'])
      setFailures(current => ({ ...current, [provider]: blank }))
      return
    }
    void run(row.entry.provider, t(KEYS['config.applying']), () => store.storeCredential(ref, value))
  }, [run, store, t])

  /** Clear the reference this row reads. */
  const clearKey = useCallback((row: ModelConfigRow): void => {
    const ref = credentialRefFor(row)
    if (ref === undefined) return
    void run(row.entry.provider, t(KEYS['config.applying']), () => store.removeCredential(ref))
  }, [run, store, t])

  /** Write one protocol choice into the row's profile. */
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

  /**
   * Add or remove this provider's profile.
   *
   * ADD: there is no enable/disable field in any adapter's profile schema, so the
   * profile's EXISTENCE is the lever; adopting a dormant provider writes the
   * profile, naming the reference the key editor would use (`keyRefOf`) and the
   * first protocol the schema offers.
   *
   * DELETE: credential first, profile second — a credential removal that fails
   * aborts before the profile is touched, so the row survives and the same
   * gesture retries it (parity list B3). The key goes only when the profile reads
   * the DERIVED reference: a hand-named reference may be shared, and deleting this
   * row is not a reason to remove it.
   * @param row - the row to change.
   */
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

  /**
   * The rows this page owns, and the catalog entries it only offers.
   *
   * `added` is the store's answer (see `isAdded`), not a second derivation:
   * a route with no settings address is the user's by virtue of being live, while
   * a catalog entry with an address and no profile is not theirs yet.
   */
  const listed = snapshot.rows.filter(row => row.added)
  const candidates = snapshot.rows.filter(row => !row.added)
  /** The add failures worth showing inside the picker, where they happen. */
  const pickerFailures = candidates.flatMap(row => {
    const message = failures[row.entry.provider]
    return message === undefined ? [] : [{ row, message }]
  })
  const readOnly = !snapshot.writable

  /**
   * The page's one large statement, and the live thing on it.
   *
   * EVERY NUMBER IS A COUNT OF THE ROWS LOWER DOWN, taken from the same
   * `readingOf` the rows render from: the statement cannot disagree with the list
   * under it, because there is only one reading, and the two numbers a reader can
   * verify by counting rows are the counts of `data-state` itself — ready, and
   * everything else.
   *
   * A DIAGNOSTIC DOES NOT MOVE THE COUNT, for the same reason it does not move the
   * word or draw a rail: it is not an answer. Such a row keeps its answer and
   * grows a `!` entry, and on the reference deployment there is no such row at all
   * — the audit measured zero diagnostics, and these counts are the ones that
   * reconcile with the `data-state` hooks either way.
   *
   * Three postures, and the all-clear one is a sentence rather than a statistic:
   * this is the page saying whether anything here needs the reader.
   */
  const readings = listed.map(row => readingOf(row, failures[row.entry.provider]))
  const readyCount = readings.filter(reading => reading.answer === 'ready').length
  const issues = listed.length - readyCount
  const readout = listed.length === 0
    ? t(KEYS['config.summary.none'])
    : issues === 0
      ? t(KEYS['config.summary.ready'], { count: String(readyCount) })
      : t(KEYS['config.summary.attention'], { count: String(readyCount), issues: String(issues) })

  // The first-run posture: nothing is listed at all, or nothing that is listed can
  // serve. The add entry stays visible either way — that is what replaces the
  // official page's onboarding card (Q13).
  const empty = snapshot.status === 'ready'
    && (listed.length === 0 || listed.every(row => !providerUsable(row)))

  return (
    <section
      className="dmc-page"
      aria-label={t(KEYS['config.title'])}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Innermost first: the discard question, then the catalog, then the add
        // picker, then the section. The catalog's own layers (an open model well,
        // the discovery checklist) consume Escape inside the region and never
        // reach this handler.
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
      <div className="dmc-head zmd-wash zmd-grain">
        {/* THE HEAD IS ONE SENTENCE ON A WASHED BAND (docs/ink-design-language.md
            §6.4). The wash and the grain are material only; the sentence is the
            page's live thing and keeps its own key-remount landing. No numeral, no
            field code, no top bar: the surface is software, not a console.
            NO VISIBLE SECTION TITLE: the settings rail already names this tab in its
            own selected item; the section's aria-label still carries
            `config.title`. */}
        <p className="dmc-readout" key={readout}>{readout}</p>
      </div>

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
          <p className="dmc-empty">
            <strong>{t(KEYS['config.empty.title'])}</strong>{' '}
            {t(KEYS['config.empty.description'])}
          </p>
        )
        : null}

      {/* No column key: the row states its two facts at its own two ends (who, and
          can it serve me), so the tracks no longer need naming. The old four-cell
          head named a five-column control table that the rows below no longer are
          — that head is a deliberate deletion (brief §3.1). */}

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

      <div className="dmc-actions">
        <button
          type="button"
          className="dmc-add"
          aria-expanded={picker && candidates.length > 0}
          disabled={readOnly || candidates.length === 0}
          onClick={() => { setPicker(current => !current) }}
        >
          {t(KEYS['config.add'])}
        </button>
        {candidates.length === 0
          ? <span className="dmc-notice">{t(KEYS['config.add.catalogExhausted'])}</span>
          : null}
      </div>

      {/* The catalog entries the user has not added. Choosing one writes its
          profile through the same path every other edit takes; the row then
          arrives through `added`, so the picker itself stays a plain filter over
          the store's snapshot and holds no list of its own. */}
      {picker && candidates.length > 0
        ? (
          <div className="dmc-picker">
            <p className="dmc-notice">{t(KEYS['config.add.catalogHint'])}</p>
            <ul className="dmc-picker-list">
              {candidates.map(row => (
                <li key={row.entry.provider}>
                  {/* `dormant` is the state hook for "not added yet": being
                      addable is not a fault, so this draws NOTHING for its state
                      (the sheet paints only the hover fill) — the attribute is
                      there for assistive tech and for the state gate. */}
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

/**
 * The protocol choices one namespace's schema declares.
 * @param store - the shared store (its schema face is the one the catalog region reads too).
 * @param ns - the settings namespace id.
 * @returns the protocol identifiers, or an empty list.
 */
function protocolsOf(store: ModelConfigStore, ns: string): readonly string[] {
  const view = store.namespace(ns)
  if (view === undefined) return []
  return protocolChoices(view)
}
