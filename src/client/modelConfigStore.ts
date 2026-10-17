/**
 * 模型配置页的快照与写入：把目录、设置命名空间与凭据 join 成一份页面状态，
 * 并把一次编辑安全地写回宿主。
 *
 * WHY A STORE RATHER THAN STATE IN THE COMPONENT. The page's facts come from
 * three different Host reads (the provider directory, the settings describe, the
 * credential describe) that must be joined into ONE consistent picture: a row
 * whose profile says it names `FOO_API_KEY` while the credential read is from an
 * earlier moment would render a badge that is simply wrong. Joining them in one
 * place also gives the page one generation counter, so a slow read can never
 * overwrite a newer one.
 *
 * WRITES GO THROUGH THE WIRE, NEVER THROUGH LOCAL STATE. Every mutation is a
 * `settings/mutate` (or a credential set/unset), and the page re-renders from the
 * next describe. Caching the write would make the page and the official Models
 * tab disagree, which is exactly the failure the two-surfaces design has to
 * avoid (ADR 0003).
 *
 * @module dsh-rabbit-model-picker/client/modelConfigStore
 */

import type {
  ConfigurableProvider, CredentialInfo, DiscoveredModel, LlmProviderInfo, ModelConfigRow,
  ModelConfigSnapshot, ModelDiscoveryRequest, ProviderDirectoryEntry, RemoteCredentialsFace,
  RemoteLlmFace, RemoteSessionFace, RemoteSettingsFace, SettingsNamespaceView,
  SettingsOp, WriteOutcome,
} from './contract.ts'
import {
  ACCOUNT_ROUTE, apiKeyEnvOf, credentialRefFor, isAdded, isRemovable, joinProviderDirectory,
} from './modelConfigModel.ts'

/** The face set the store needs; each is absent on a trimmed deployment. */
export interface ModelConfigFaces {
  readonly settings: RemoteSettingsFace
  readonly llm: RemoteLlmFace
  readonly credentials?: RemoteCredentialsFace | undefined
  /**
   * The session read the ACCOUNT route needs; absent on a deployment that mounts
   * no session face, in which case that route's availability stays unknown rather
   * than being asserted false.
   */
  readonly session?: RemoteSessionFace | undefined
  /**
   * Subscribe to one Host event; returns the unsubscribe.
   *
   * Absent on a deployment that mounts no bare `remote`, in which case the page
   * simply never learns about other writers' changes. That degradation is
   * deliberate rather than fatal: a missing event bus costs freshness, while
   * refusing to render would cost the whole page.
   */
  readonly on?: ((event: string, listener: () => void) => () => void) | undefined
}

/**
 * The Host events that invalidate this page's facts.
 *
 * Five, and each one is a different way the page can be wrong without it: the
 * settings document moved (this page or the official tab wrote), one credential's
 * VALUE changed, a credential REFERENCE was rebound, an adapter re-registered its
 * routes (which is what makes a provider live or dormant), and the connection was
 * reset (so every held view is suspect). The official page subscribes to exactly
 * these.
 */
const INVALIDATING_EVENTS = [
  'settings/document-updated',
  'credentials/record-updated',
  'credentials/reference-updated',
  'llm/adapters-updated',
  'connection/reset',
] as const

/** The empty snapshot the page renders before its first read. */
const EMPTY: ModelConfigSnapshot = {
  status: 'idle',
  error: null,
  credentialError: null,
  writable: false,
  rows: [],
  namespaces: new Map(),
}

/** How many credential references one describe call carries. */
const CREDENTIAL_BATCH = 64

/**
 * The page's fact store.
 *
 * Deliberately NOT a React hook: the same instance is read by the page and by
 * the drawer, so opening the drawer cannot kick off a second read of the same
 * directory and the two cannot show different revisions.
 */
export class ModelConfigStore {
  private snapshot: ModelConfigSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  /**
   * Latest read wins. A superseded read publishes nothing, which is what keeps a
   * slow first load from overwriting a fast second one — without this, opening
   * settings twice in quick succession can leave the page showing the older
   * directory.
   */
  private generation = 0
  private pending: Promise<void> = Promise.resolve()

  /**
   * @param faces - the Host faces, resolved per call: the Remote namespaces mount
   * asynchronously, so a capture at construction can legitimately be "not yet".
   */
  constructor(private readonly faces: () => ModelConfigFaces | null) {}

  /** Subscribe to snapshot changes; the return value unsubscribes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Subscribe to the Host events that invalidate this page's facts.
   *
   * THE SUBSCRIPTION *IS* THE "未打开的页面不后台拉取" RULE. It exists only while
   * the page is mounted, so a closed settings panel holds no listener and cannot
   * be woken into a fetch — the property the official page has to get from an
   * explicit `refreshIfLoaded` flag, because its store outlives its component
   * while this one does not.
   *
   * A burst of events issues one read each; that is intentional and cheap, since
   * the generation counter means only the newest read publishes. Coalescing them
   * would delay the page's response to the user's own write, which is the case
   * that has to feel immediate.
   * @returns the disposer that unsubscribes every event.
   */
  start(): () => void {
    const on = this.faces()?.on
    if (on === undefined) return () => { /* nothing was subscribed */ }
    const disposers = INVALIDATING_EVENTS.map(event => on(event, () => { void this.load() }))
    return () => { for (const dispose of disposers) dispose() }
  }

  /** The current snapshot. Stable between publishes, so it is safe for `useSyncExternalStore`. */
  getSnapshot = (): ModelConfigSnapshot => this.snapshot

  /** Publish one snapshot to every listener. */
  private publish(next: ModelConfigSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  /**
   * Read the whole page: directory and settings in parallel, then one batched
   * credential describe over every reference the rows actually use.
   *
   * The credential read is batched because the alternative — one call per row —
   * makes a deployment with a dozen providers issue a dozen round trips on every
   * refresh, including each one triggered by a push event.
   * @returns resolution after this read's snapshot is published.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    const faces = this.faces()
    if (faces === null) {
      this.publish({ ...EMPTY, status: 'ready' })
      return
    }

    this.publish({ ...this.snapshot, status: this.snapshot.status === 'idle' ? 'loading' : this.snapshot.status })

    this.pending = this.read(faces, generation)
    await this.pending
  }

  /**
   * One read, publishing only while it still owns the newest generation.
   * @param faces - the resolved Host faces.
   * @param generation - the generation this read was issued under.
   */
  private async read(faces: ModelConfigFaces, generation: number): Promise<void> {
    let described
    let registered: readonly LlmProviderInfo[]
    // The DIRECTORY shape, not the joined one: `active` is what this function
    // computes from `registered`, so it cannot also be an input.
    let directory: readonly ConfigurableProvider[]
    try {
      const [settingsAnswer, registeredAnswer, directoryAnswer] = await Promise.all([
        faces.settings.describe(),
        faces.llm.listProviders?.() ?? Promise.resolve({ ok: true as const, value: [] }),
        faces.llm.listConfigurableProviders(),
      ])
      if (generation !== this.generation) return
      if (!settingsAnswer.ok) {
        this.publish({ ...this.snapshot, status: 'error', error: settingsAnswer.error.message })
        return
      }
      described = settingsAnswer.value
      registered = registeredAnswer.ok ? registeredAnswer.value : []
      directory = directoryAnswer.ok ? directoryAnswer.value : []
    } catch (error: unknown) {
      if (generation !== this.generation) return
      this.publish({
        ...this.snapshot,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    const namespaces = new Map<string, SettingsNamespaceView>()
    for (const view of described.namespaces) namespaces.set(view.ns, view)

    const entries = joinProviderDirectory(registered, directory)

    // The account route's availability is a SESSION fact, not a credential one: it
    // authenticates through the signed-in session, so no `apiKeyEnv` describes it
    // and the session's own model catalog is the only read that can answer. The
    // read is issued ONLY when such a row exists, so a deployment without the
    // account adapter does not pay for it on every refresh.
    let accountAvailable: boolean | undefined
    if (entries.some(entry => entry.provider === ACCOUNT_ROUTE) && faces.session !== undefined) {
      try {
        const catalog = await faces.session.modelCatalog()
        if (generation !== this.generation) return
        if (catalog.ok) {
          accountAvailable = catalog.value.groups.some(
            group => group.id === ACCOUNT_ROUTE && group.models.length > 0,
          )
        }
      } catch {
        // A failed read leaves the flag UNKNOWN rather than false: the row is then
        // treated as "cannot tell" instead of being accused of being unusable.
      }
    }

    const draft = entries.map(entry => this.rowFor(entry, namespaces.get(entry.settingsNs), accountAvailable))

    // Every reference the rows read, deduplicated: two rows can legitimately
    // share one reference (the derived name is per-route, but a hand-written
    // profile may point two routes at one variable).
    const refs = [...new Set(draft.map(credentialRefFor).filter((ref): ref is string => ref !== undefined))]

    let credentials: Record<string, CredentialInfo> = {}
    let credentialError: string | null = null
    if (faces.credentials !== undefined && refs.length > 0) {
      try {
        for (let index = 0; index < refs.length; index += CREDENTIAL_BATCH) {
          const answer = await faces.credentials.describe(refs.slice(index, index + CREDENTIAL_BATCH))
          if (generation !== this.generation) return
          if (answer.ok) credentials = { ...credentials, ...answer.value }
          else credentialError = answer.error.message
        }
      } catch (error: unknown) {
        if (generation !== this.generation) return
        credentialError = error instanceof Error ? error.message : String(error)
      }
    }

    if (generation !== this.generation) return

    const rows = entries
      .map(entry => this.withCredential(entry, namespaces.get(entry.settingsNs), credentials, accountAvailable))
      // The account row appears only while it can serve. An account the session
      // cannot use has NOTHING to configure — no key, no protocol — so a row for
      // it would be pure noise. Every other route's row is unconditional, because
      // a dormant provider is exactly what the add action exists for.
      .filter(row => row.entry.provider !== ACCOUNT_ROUTE || row.accountAvailable === true)
    this.publish({
      status: 'ready',
      error: null,
      credentialError,
      writable: described.writable,
      rows,
      namespaces,
    })
  }

  /**
   * One row before its credential state is known.
   * @param entry - the joined directory entry.
   * @param namespace - its settings namespace view, when one exists.
   * @param accountAvailable - the account route's session-derived usability, when it could be read.
   * @returns the row.
   */
  private rowFor(
    entry: ProviderDirectoryEntry,
    namespace: SettingsNamespaceView | undefined,
    accountAvailable: boolean | undefined,
  ): ModelConfigRow {
    const value = namespace?.value
    const configured = namespace !== undefined && hasProfile(namespace, entry.settingsPath)
    return {
      entry,
      configured,
      // "Added" is the page's LISTING question, and it is not the same as
      // `configured`. A route the adapter registers with no settings address owes
      // no profile and is already the user's (the account route, and any live
      // route the configurable directory does not declare); a catalog entry that
      // HAS an address and no profile is one the user has not added yet, and the
      // page hides those behind a single add entry rather than listing dozens of
      // things that are not configured. The rule itself lives in the pure module
      // so the unit gate can pin it.
      added: isAdded(configured, entry.settingsPath),
      removable: isRemovable(namespace, entry.settingsPath),
      // The account route NEVER reads a credential: it has no `apiKeyEnv` to name,
      // so deriving one would describe `<ROUTE>_API_KEY` — a reference no adapter
      // consults — and report a key state that cannot affect anything.
      apiKeyEnv: entry.provider === ACCOUNT_ROUTE ? undefined : apiKeyEnvOf(value, entry.settingsPath),
      credential: undefined,
      // ONLY the account route carries this fact. `accountAvailable` answers
      // "can the SESSION serve that one route", so writing it onto every row
      // tells the page that every provider IS the account route — which is
      // precisely what it did: all 48 rows rendered as 「DeepSeek 账号」, the
      // replace-key entry vanished from every one of them, and 43 protocol
      // selects came up disabled. The contract says this field is undefined for
      // every other route, and this is the line that enforces it.
      ...entry.provider === ACCOUNT_ROUTE && accountAvailable !== undefined
        ? { accountAvailable }
        : {},
    }
  }

  /**
   * Attach the described credential to one row.
   *
   * A row whose profile names a reference stores it under `credential`; a row
   * that names none stores it under `derivedCredential`, because the two are read
   * by different questions ("is the key the profile reads present?" versus
   * "would the key the user is about to type be found?") and collapsing them
   * would let a row report a key its provider never looks at.
   * @param entry - the joined directory entry.
   * @param namespace - its settings namespace view, when one exists.
   * @param credentials - the described credential states, by reference.
   * @param accountAvailable - the account route's session-derived usability, when it could be read.
   * @returns the row.
   */
  private withCredential(
    entry: ProviderDirectoryEntry,
    namespace: SettingsNamespaceView | undefined,
    credentials: Readonly<Record<string, CredentialInfo>>,
    accountAvailable: boolean | undefined,
  ): ModelConfigRow {
    const base = this.rowFor(entry, namespace, accountAvailable)
    const ref = credentialRefFor(base)
    const info = ref === undefined ? undefined : credentials[ref]
    return base.apiKeyEnv !== undefined
      ? { ...base, credential: info }
      : {
          ...base,
          credential: undefined,
          ...info === undefined ? {} : { derivedCredential: info },
        }
  }

  /**
   * Write path operations to one namespace, retrying once against a fresh
   * revision when the fence rejects them.
   *
   * The retry is not optimism: this page writes at most a handful of fields, so
   * re-applying them over a document that moved underneath is what the user
   * asked for, and reporting a conflict instead would make the page unusable
   * whenever the official Models tab happens to be open. A SECOND conflict is
   * reported as-is, because by then the other writer is actively racing and the
   * user should decide.
   * @param ns - the settings namespace.
   * @param ops - the path operations.
   * @param expectedRevision - the revision the draft was read at.
   * @returns whether the write landed, and its failure text when it did not.
   */
  async write(ns: string, ops: readonly SettingsOp[], expectedRevision: number | undefined): Promise<WriteOutcome> {
    const faces = this.faces()
    if (faces === null) return { ok: false, conflict: false, message: '设置服务不可用。' }
    if (ops.length === 0) return { ok: true }

    try {
      let answer = await faces.settings.mutate(ns, ops, expectedRevision)
      if (!answer.ok && answer.error.code === 'settings/conflict') {
        const described = await faces.settings.describe()
        const fresh = described.ok
          ? described.value.namespaces.find(candidate => candidate.ns === ns)
          : undefined
        if (fresh !== undefined) answer = await faces.settings.mutate(ns, ops, fresh.revision)
      }
      if (!answer.ok) {
        return {
          ok: false,
          conflict: answer.error.code === 'settings/conflict',
          message: answer.error.message,
        }
      }
      await this.load()
      return { ok: true }
    } catch (error: unknown) {
      return { ok: false, conflict: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Store one credential literal.
   * @param ref - the reference to write.
   * @param value - the literal.
   * @returns the failure text, or undefined once stored.
   */
  async storeCredential(ref: string, value: string): Promise<string | undefined> {
    const faces = this.faces()
    if (faces?.credentials === undefined) return '此部署未挂载凭据服务。'
    try {
      const answer = await faces.credentials.set(ref, value)
      if (!answer.ok) return answer.error.message
      await this.load()
      return undefined
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Remove one credential reference (idempotent).
   * @param ref - the reference to clear.
   * @returns the failure text, or undefined once removed.
   */
  async removeCredential(ref: string): Promise<string | undefined> {
    const faces = this.faces()
    if (faces?.credentials === undefined) return '此部署未挂载凭据服务。'
    try {
      const answer = await faces.credentials.unset(ref)
      if (!answer.ok) return answer.error.message
      await this.load()
      return undefined
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Ask a provider endpoint what models it serves.
   *
   * A PURE READ, and that is the load-bearing fact for the drawer's three-step
   * flow: the Host's own contract says discovery "reads or writes nothing" — it
   * describes a DRAFT, not a stored route — so the candidates this returns are
   * metadata the user may adopt, never a write. Merging them into the profile is
   * a separate `write` the user has to confirm, which is why nothing here touches
   * the store's snapshot.
   * @param settingsNs - the namespace whose adapter family answers.
   * @param request - the endpoint facts the form currently shows.
   * @returns the candidates, or the Host's own refusal diagnostic.
   */
  async discover(
    settingsNs: string,
    request: ModelDiscoveryRequest,
  ): Promise<{ readonly ok: true; readonly models: readonly DiscoveredModel[] } | { readonly ok: false; readonly message: string }> {
    const faces = this.faces()
    if (faces === null) return { ok: false, message: '设置服务不可用。' }
    if (typeof faces.llm.discoverModels !== 'function') {
      return { ok: false, message: '此部署未挂载模型发现。' }
    }
    try {
      const answer = await faces.llm.discoverModels(settingsNs, request)
      if (!answer.ok) return { ok: false, message: answer.error.message }
      return { ok: true, models: answer.value }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Read this namespace's view as the page currently holds it.
   * @param ns - the namespace id.
   * @returns the view, or undefined.
   */
  namespace(ns: string): SettingsNamespaceView | undefined {
    return this.snapshot.namespaces.get(ns)
  }
}

/**
 * Whether any layer configures this provider's profile.
 *
 * Reads the EFFECTIVE value, not the user layer: a profile supplied by the
 * deployment's base layer is configured, and reporting it as absent would make
 * the page offer to add a provider that is already there.
 * @param namespace - the namespace view.
 * @param settingsPath - path of this provider's profile.
 * @returns whether the profile resolves.
 */
function hasProfile(namespace: SettingsNamespaceView, settingsPath: readonly string[]): boolean {
  if (settingsPath.length === 0) {
    return namespace.value !== undefined && namespace.value !== null
  }
  let current: unknown = namespace.value
  for (const step of settingsPath) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return false
    if (!(step in (current as Record<string, unknown>))) return false
    current = (current as Record<string, unknown>)[step]
  }
  return current !== undefined
}
