/**
 * Model parameters that really reach the Host, and the address they live at.
 *
 * WHY THIS REPLACED THE LOCAL RECORD. An earlier revision of this plugin kept
 * the parameters of a route in its own `localStorage`, because the composer
 * seat's catalog (`session/modelCatalog`) publishes only `{ provider, model,
 * reasoning }`. That catalog is still that narrow — but it is not the only way
 * in. The Host exposes the *configuration* surfaces over two Remote namespaces,
 * and both LLM adapters declare the model parameters as VOLATILE config fields,
 * which are exactly the fields the settings service accepts live edits for:
 *
 *   - `llm/listConfigurableProviders` maps a provider route to the settings
 *     namespace and path that declare it (`llm-pi-ai` →
 *     `providers.<provider>`, `llm-deepseek` → the namespace root).
 *   - `settings/describe` answers with the effective value, the user layer (the
 *     profile patch) and the revision of every namespace.
 *   - `settings/mutate` applies path-addressed edits, rejecting anything
 *     outside a volatile branch (`settings/rejected`) or written against a
 *     stale revision (`settings/conflict`).
 *
 * So a `contextWindow` / `input` (`inputModalities` on the official adapter)
 * edit is a REAL edit: the adapter re-resolves its catalog and the new value is
 * what the Host sends. Reasoning effort is live a third way — through the
 * shared session selection, which is the seat's own `select()`.
 *
 * WHAT IS STILL NOT POSSIBLE. A route that the adapter serves straight from its
 * installed catalog has no declaration entry to edit, and `modelOverrides`
 * (the pi-ai escape hatch for those routes) is rejected beside a `models` list,
 * so such a route can only be read here. {@link resolveRoute} returns null for
 * it and the panel says so instead of pretending.
 *
 * @module dsh-rabbit-model-picker/client/params
 */

import type {
  ConfigurableProvider, ModelRoute, ParamsFace, ParamsSnapshot, RemoteFace, RemoteResult, RouteAddress,
  SettingsNamespaceView, SettingsOp, WriteOutcome,
} from './contract.ts'

/** Smallest accepted context window (a smaller "window" is never meaningful). */
export const MIN_CONTEXT = 1_024

/** Largest accepted context window — a typo guard, not a model claim. */
export const MAX_CONTEXT = 10_485_760

/** The capacity the field suggests while the route declares none. */
export const CONTEXT_PLACEHOLDER = '128K'

/** The modalities the panel exposes, in display order. */
export const PANEL_MODALITIES = ['text', 'image'] as const

/**
 * The schema field each known adapter declares its input modalities in. The
 * value actually present on the entry wins over this table (see
 * {@link inputFieldOf}), so a renamed field degrades to a read-only panel
 * instead of writing into a name the adapter ignores.
 */
const INPUT_FIELD_BY_NS: Record<string, string> = {
  'llm-pi-ai': 'input',
  'llm-deepseek': 'inputModalities',
}

/** Field names probed on the entry itself, in order. */
const INPUT_FIELD_CANDIDATES = ['input', 'inputModalities'] as const

/** The snapshot before the first read: nothing known, nothing claimed. */
const INITIAL_SNAPSHOT: ParamsSnapshot = {
  status: 'idle',
  error: null,
  writable: false,
  providers: [],
  namespaces: {},
}

/**
 * Parse a human capacity into tokens: a bare integer or a `K`/`M` suffix
 * (`128K`, `1M`). Deliberately narrow — no arithmetic, no compound units.
 * @param raw - the typed text.
 * @returns the token count, or null when the text is not a valid capacity.
 */
export function parseContext(raw: string): number | null {
  const text = raw.trim().replace(/[\s_]/g, '').toUpperCase()
  const match = /^(\d+(?:\.\d+)?)([KM])?$/.exec(text)
  if (match === null) return null
  const scale = match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1
  const tokens = Math.round(Number(match[1]) * scale)
  if (!Number.isFinite(tokens) || tokens < MIN_CONTEXT || tokens > MAX_CONTEXT) return null
  return tokens
}

/**
 * Render a token count the way {@link parseContext} reads it back.
 * @param tokens - the stored token count.
 * @returns the display text (`256K`, `1M`, or the plain number).
 */
export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 100_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

/**
 * Whether a value is a plain record (not an array, not null).
 * @param value - the value to test.
 * @returns whether it can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read one path out of an unknown settings value.
 * @param value - the root value.
 * @param path - keys to walk; array indices are numeric keys, as the settings
 *   service itself addresses them.
 * @returns the value at the path, or undefined when any step is missing.
 */
export function getPath(value: unknown, path: readonly string[]): unknown {
  let node: unknown = value
  for (const key of path) {
    if (Array.isArray(node)) {
      if (!/^\d+$/.test(key)) return undefined
      node = node[Number(key)]
      continue
    }
    if (!isRecord(node)) return undefined
    node = node[key]
  }
  return node
}

/**
 * Coerce a stored value into a list of modality ids.
 * @param value - the field's value.
 * @returns its strings, or an empty list when it is not a string array.
 */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Coerce a stored value into a positive integer.
 * @param value - the field's value.
 * @returns the number, or undefined when it is not a finite positive integer.
 */
function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * Which field one route's declared modalities live in.
 * @param entry - the effective declaration entry.
 * @param ns - the settings namespace that owns it.
 * @returns the field name, preferring a field the entry actually carries.
 */
function inputFieldOf(entry: Record<string, unknown>, ns: string): string {
  for (const candidate of INPUT_FIELD_CANDIDATES) {
    if (entry[candidate] !== undefined) return candidate
  }
  return INPUT_FIELD_BY_NS[ns] ?? INPUT_FIELD_CANDIDATES[0]
}

/**
 * Locate one route's declaration entry.
 *
 * Two shapes exist in the wild and both are addressed the same way: a `models`
 * list under the provider's settings path (both adapters) and a `modelOverrides`
 * dict keyed by model id (pi-ai, only valid while no `models` list is declared).
 * @param value - the namespace's effective value.
 * @param scope - the provider's settings path inside that namespace.
 * @param model - the model id.
 * @returns the path to the entry, or null when the route declares none.
 */
function entryPathOf(value: unknown, scope: readonly string[], model: string): string[] | null {
  const models = getPath(value, [...scope, 'models'])
  if (Array.isArray(models)) {
    const index = models.findIndex(entry => isRecord(entry) && entry.id === model)
    if (index >= 0) return [...scope, 'models', String(index)]
  }
  const overrides = getPath(value, [...scope, 'modelOverrides'])
  if (isRecord(overrides) && isRecord(overrides[model])) return [...scope, 'modelOverrides', model]
  return null
}

/**
 * Resolve the settings address and every declared fact for one route.
 *
 * Pure over a {@link ParamsSnapshot}: the panel and the gear both call it, and
 * neither keeps a copy of what it returns.
 * @param snapshot - the last settings read.
 * @param route - the selected provider + model, or null before a selection.
 * @returns the address and its declaration, or null when the route cannot be
 *   addressed (unknown provider, no namespace, or no declaration entry).
 */
export function resolveRoute(snapshot: ParamsSnapshot, route: ModelRoute | null): RouteAddress | null {
  if (route === null) return null
  const provider: ConfigurableProvider | undefined =
    snapshot.providers.find(candidate => candidate.provider === route.provider)
  if (provider === undefined) return null
  const view: SettingsNamespaceView | undefined = snapshot.namespaces[provider.settingsNs]
  if (view === undefined) return null
  const scope = [...provider.settingsPath]
  const entryPath = entryPathOf(view.value, scope, route.model)
  if (entryPath === null) return null
  const entry = getPath(view.value, entryPath)
  if (!isRecord(entry)) return null

  const inputField = inputFieldOf(entry, provider.settingsNs)
  const input = stringList(entry[inputField])
  const contextWindow = numberOrUndefined(entry.contextWindow)
  const maxTokens = numberOrUndefined(entry.maxTokens)
  const defaultContextWindow = numberOrUndefined(getPath(view.value, [...scope, 'defaultContextWindow']))
  const defaultInput = stringList(getPath(view.value, [...scope, 'defaultInput']))
  // The user layer is what this panel may clear: a value inherited from the
  // deployment profile is not this route's own recorded choice.
  const userEntry = getPath(view.user, entryPath)
  const declared = isRecord(userEntry)
    && (userEntry.contextWindow !== undefined || userEntry[inputField] !== undefined)

  return {
    ns: provider.settingsNs,
    entryPath,
    inputField,
    revision: view.revision,
    input,
    defaultInput,
    declared,
    ...contextWindow === undefined ? {} : { contextWindow },
    ...defaultContextWindow === undefined ? {} : { defaultContextWindow },
    ...maxTokens === undefined ? {} : { maxTokens },
  }
}

/**
 * The parameters of every route this plugin has read, kept as one immutable
 * snapshot for `useSyncExternalStore`.
 *
 * One instance is created per plugin activation and shared by every seat, so
 * two composer instances read one settings answer instead of racing two.
 */
export class ParamsStore implements ParamsFace {
  private readonly listeners = new Set<() => void>()
  private snapshot: ParamsSnapshot = INITIAL_SNAPSHOT
  private inflight: Promise<void> | null = null

  /**
   * @param face - the Host settings + provider directory faces, or null when
   *   this deployment mounts neither (the panel then stays read-only).
   */
  constructor(private readonly face: RemoteFace | null) {}

  /** Subscribe to snapshot changes. @param listener - called after any change. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * The current snapshot, stable until something changes.
   * @returns the snapshot handed to React.
   */
  getSnapshot(): ParamsSnapshot {
    return this.snapshot
  }

  /**
   * Read the Host once. Repeated calls while a read is in flight join it, and a
   * snapshot already in hand is never refetched by this method.
   */
  ensure(): void {
    if (this.snapshot.status === 'idle') void this.read()
  }

  /**
   * Re-read the Host, keeping the last good values while the answer is in
   * flight so an open panel does not blank out on a refresh.
   * @returns a promise settling when the snapshot has been updated.
   */
  refresh(): Promise<void> {
    return this.read()
  }

  /**
   * Apply one write and keep the snapshot in step with the Host's answer.
   *
   * A `settings/conflict` is retried once against a freshly read revision: the
   * panel's edit is a single field, so re-applying it over the newer document is
   * what the person asked for, while a second conflict is reported as-is.
   * @param ns - the settings namespace to write.
   * @param ops - the path-addressed edits.
   * @param expectedRevision - the revision the caller read.
   * @returns whether the Host accepted the write, and why not when it did not.
   */
  async write(
    ns: string, ops: readonly SettingsOp[], expectedRevision: number | undefined,
  ): Promise<WriteOutcome> {
    const face = this.face
    if (face === null) return { ok: false, conflict: false, message: 'settings are unavailable' }
    let response: RemoteResult<SettingsNamespaceView>
    try {
      response = await face.settings.mutate(ns, ops, expectedRevision)
      if (!response.ok && response.error.code === 'settings/conflict') {
        await this.read()
        response = await face.settings.mutate(ns, ops, this.snapshot.namespaces[ns]?.revision)
      }
    } catch (error: unknown) {
      // A transport failure REJECTS instead of answering { ok: false }, and an
      // unhandled rejection here would leave `writing` set forever: every
      // control of the panel stays disabled with no refusal message and no way
      // out. Fail the write through the same door a refused write takes.
      return {
        ok: false,
        conflict: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
    if (!response.ok) {
      return { ok: false, conflict: response.error.code === 'settings/conflict', message: response.error.message }
    }
    this.publish({
      ...this.snapshot,
      status: 'ready',
      error: null,
      namespaces: { ...this.snapshot.namespaces, [response.value.ns]: response.value },
    })
    return { ok: true }
  }

  /** Read the provider directory and every namespace, then publish one snapshot. */
  private read(): Promise<void> {
    if (this.inflight !== null) return this.inflight
    const face = this.face
    if (face === null) {
      this.publish({ ...this.snapshot, status: 'unavailable' })
      return Promise.resolve()
    }
    this.publish({ ...this.snapshot, status: this.snapshot.status === 'ready' ? 'ready' : 'loading' })
    this.inflight = (async () => {
      const [providers, describe] = await Promise.all([
        face.llm.listConfigurableProviders(),
        face.settings.describe(),
      ])
      this.inflight = null
      const failures: string[] = []
      if (!providers.ok) failures.push(providers.error.message)
      if (!describe.ok) failures.push(describe.error.message)
      const namespaces: Record<string, SettingsNamespaceView> = { ...this.snapshot.namespaces }
      if (describe.ok) {
        for (const view of describe.value.namespaces) namespaces[view.ns] = view
      }
      this.publish({
        status: failures.length === 0 ? 'ready' : 'error',
        error: failures.length === 0 ? null : failures.join(' · '),
        writable: describe.ok ? describe.value.writable : this.snapshot.writable,
        providers: providers.ok ? providers.value : this.snapshot.providers,
        namespaces,
      })
    })().catch((error: unknown) => {
      this.inflight = null
      this.publish({
        ...this.snapshot,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    })
    return this.inflight
  }

  /** Replace the snapshot and wake every subscriber. */
  private publish(snapshot: ParamsSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
