/**
 * Structural contract of everything this plugin touches outside its own files.
 *
 * An out-of-repo client plugin cannot value-import Host packages, so the
 * seat face, the shared directory store, the slot registry and the locale face
 * are re-declared here as the minimal shapes this plugin actually reads. Every
 * field below was checked against the shipping implementation
 * (`ui-model-selection/src/client/{slots,directory}.ts`,
 * `ui-slots/src/index.ts`, `ui-conversation/.../contract/slots.ts`); the
 * `scripts/selfcheck-static.mjs` seat assertions guard the two values that the
 * shadowing depends on (`name` and `priority`).
 *
 * @module dsh-rabbit-model-picker/client/contract
 */

/** A complete model selection: provider + provider-owned model id + optional adapter effort. */
export interface ModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}/** One adapter-owned reasoning level for an exact model route. */
export interface ModelReasoningEffort {
  readonly id: string
  readonly name: string
}

/** Adapter-owned reasoning metadata of one model route. */
export interface ModelReasoning {
  readonly efforts: readonly ModelReasoningEffort[]
  readonly defaultEffort?: string
}

/** One model inside its provider group. */
export interface CatalogModel {
  readonly id: string
  readonly name: string
  readonly reasoning?: ModelReasoning
}

/** One successfully loaded provider and its models. */
export interface ProviderGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly CatalogModel[]
}

/** One provider whose catalog lookup failed. */
export interface CatalogFailure {
  readonly id: string
  readonly name: string
  readonly message: string
}

/**
 * Compose the opaque row identity used across this plugin.
 * @param provider - provider group id.
 * @param model - model id within that provider.
 * @returns the combined key.
 */
export function rowKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Lifecycle of the directory's latest operation. */
export type DirectoryStatus = 'idle' | 'loading' | 'ready' | 'selecting' | 'error'

/** The per-session directory snapshot both selection entries render from. */
export interface DirectoryState {
  readonly current: ModelSelection | null
  readonly retainedEffort?: string
  readonly groups: readonly ProviderGroup[]
  readonly failures: readonly CatalogFailure[]
  readonly status: DirectoryStatus
  readonly pending: ModelSelection | null
  readonly error: string | null
}

/** The shared snapshot store (`@deepseek-ai/dsh-client-store`), read-only from here. */
export interface DirectoryStore {
  getSnapshot(): DirectoryState
  subscribe(listener: () => void): () => void
}

/** One remote failure as the Host reports it. */
export interface RemoteFailure {
  readonly code: string
  readonly message: string
}

/** The Host outcome of one selection request. */
export type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RemoteFailure }

/** One path-addressed edit, in the shape `settings/mutate` applies. */
export interface SettingsOp {
  readonly op: 'set' | 'unset'
  readonly path: readonly string[]
  readonly value?: unknown
}

/** One settings namespace as the Host describes it (secrets already redacted). */
export interface SettingsNamespaceView {
  readonly ns: string
  readonly revision: number
  /** The effective value: every layer merged and schema defaults applied. */
  readonly value: unknown
  /** The profile patch (the layer this plugin's clear button empties). */
  readonly user?: unknown
}

/** The whole settings surface: writability plus one view per namespace. */
export interface SettingsDescribe {
  readonly writable: boolean
  readonly namespaces: readonly SettingsNamespaceView[]
}

/**
 * One provider route the Host can address in the settings document.
 *
 * `settingsNs` + `settingsPath` are the authoritative mapping from a catalog
 * provider id to the namespace and the path that declare it — the same join the
 * shipped Models settings page renders from.
 */
export interface ConfigurableProvider {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly settingsPath: readonly string[]
  readonly declared?: boolean
  readonly error?: string
}

/** The generated `ctx.remote.settings` namespace this plugin reads and writes. */
export interface RemoteSettingsFace {
  describe(): Promise<RemoteResult<SettingsDescribe>>
  mutate(
    ns: string,
    ops: readonly SettingsOp[],
    expectedRevision?: number,
  ): Promise<RemoteResult<SettingsNamespaceView>>
}

/** One draft-endpoint interrogation, in the shape `llm/discoverModels` accepts. */
export interface ModelDiscoveryRequest {
  /** Route the draft edits, when it edits one; an adapter that knows the route answers from its own registry. */
  readonly provider?: string
  readonly baseURL?: string
  readonly api?: string
  readonly apiKey?: string
}

/**
 * One model an adapter's model discovery answered with.
 *
 * Every field but the id is optional because a listing may disclose an id and
 * nothing else. `inputModalities` is documented as "absent means unknown"
 * rather than "none", which is exactly what lets the row refuse to draw an
 * unsupported badge instead of guessing one.
 */
export interface DiscoveredModel {
  readonly id: string
  readonly name?: string
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly inputModalities?: readonly string[]
}

/** The generated `ctx.remote.llm` namespace: the provider directory behind the panel. */
export interface RemoteLlmFace {
  listConfigurableProviders(): Promise<RemoteResult<readonly ConfigurableProvider[]>>
  /**
   * Model discovery, present only where the deployment mounts it.
   *
   * An OPTIONAL method rather than a separate face, because the directory read
   * is what the panel cannot work without: a deployment that answers the
   * directory but mounts no discovery must still get a working panel, just
   * without the adapter-published facts.
   */
  discoverModels?(
    settingsNs: string,
    request: ModelDiscoveryRequest,
  ): Promise<RemoteResult<readonly DiscoveredModel[]>>
}

/**
 * One adapter's own model-catalog Remote (e.g. `remote.opencodeGoModels`).
 *
 * The second, and for some adapters the only, way to the facts: this plugin may
 * read a catalog the adapter publishes as its own namespace. Extra fields on the
 * answer are ignored — the structural shape here is the whole contract.
 */
export interface RemoteCatalogFace {
  read(): Promise<RemoteResult<{ readonly models: readonly DiscoveredModel[] }>>
}

/** The two Remote faces the parameter panel needs, when the deployment mounts them. */
export interface RemoteFace {
  readonly settings: RemoteSettingsFace
  readonly llm: RemoteLlmFace
}

/** Lifecycle of the settings read behind the parameter panel. */
export type ParamsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

/** The immutable snapshot every surface of this plugin reads parameters from. */
export interface ParamsSnapshot {
  readonly status: ParamsStatus
  /** Read failure text; a successful read clears it. */
  readonly error: string | null
  /** Whether the active profile accepts form edits at all. */
  readonly writable: boolean
  /** Provider routes the Host can address in the settings document. */
  readonly providers: readonly ConfigurableProvider[]
  /** Namespace views by namespace id. */
  readonly namespaces: Readonly<Record<string, SettingsNamespaceView>>
}

/** Where one route's parameters are declared, and what that declaration says. */
export interface RouteAddress {
  /** The settings namespace (profile entry id) that owns this route. */
  readonly ns: string
  /** Path to the model entry inside that namespace's stored section. */
  readonly entryPath: readonly string[]
  /** Schema field carrying the declared modalities ('input' / 'inputModalities'). */
  readonly inputField: string
  /** Revision the Host expects back on the next write. */
  readonly revision: number
  /** Modalities declared for this route; empty when the entry declares none. */
  readonly input: readonly string[]
  /** Context window declared for this route, when it declares one. */
  readonly contextWindow?: number
  /** The adapter default that applies while the route declares no window. */
  readonly defaultContextWindow?: number
  /** Max output tokens declared for this route, when it declares one. */
  readonly maxTokens?: number
  /** The adapter default modalities that apply while the route declares none. */
  readonly defaultInput: readonly string[]
  /** Whether the profile patch itself carries one of the panel's fields. */
  readonly declared: boolean
}

/**
 * What one adapter PUBLISHED about one exact route, as opposed to what the
 * settings document declares.
 *
 * The distinction is the whole point of the type: a route served straight from
 * an adapter's installed catalog has no declaration to address, but the adapter
 * still knows the model. These facts are read-only by construction — there is no
 * entry to write them into.
 */
export interface RouteCapability {
  /** Input types the adapter published; absent means it published none. */
  readonly inputModalities?: readonly string[]
  /** Context window the adapter published for this exact route. */
  readonly contextWindow?: number
  /** Output cap the adapter published. Carried for parity with the settings facts; no surface states it yet. */
  readonly maxTokens?: number
}

/** Lifecycle of the adapter-catalog read behind the read-only facts. */
export type CapabilityStatus = 'idle' | 'loading' | 'ready'

/** The facts every adapter-catalog read has produced so far. */
export interface CapabilitySnapshot {
  readonly status: CapabilityStatus
  /** Facts by the plugin's row key (`provider/model`). A route the adapter published nothing about is absent. */
  readonly routes: Readonly<Record<string, RouteCapability>>
}

/** One adapter-owned catalog this plugin can read capability facts from. */
export interface CapabilitySource {
  /** Provider routes this reader answers for. */
  readonly providers: readonly string[]
  /** Read that adapter's published models; an empty list means it published none. */
  read(): Promise<readonly DiscoveredModel[]>
}

/** The adapter-catalog face the seat hands to the row and the panel. */
export interface CapabilityFace {
  subscribe(listener: () => void): () => void
  getSnapshot(): CapabilitySnapshot
  /** Read these providers' routes; each provider is interrogated at most once. */
  ensure(providers: readonly string[]): void
}

/** Outcome of one settings write. */
export type WriteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly conflict: boolean; readonly message: string }

/** The parameter face the seat hands to the settings panel. */
export interface ParamsFace {
  subscribe(listener: () => void): () => void
  getSnapshot(): ParamsSnapshot
  ensure(): void
  refresh(): Promise<void>
  write(
    ns: string,
    ops: readonly SettingsOp[],
    expectedRevision: number | undefined,
  ): Promise<WriteOutcome>
}

/** Translation function bound to this plugin's namespace. */
export type Translate = (key: string, params?: Record<string, string>) => string

/** The framework-synthesized seat injected into the registered component. */
export interface SeatInjected {
  /** Whether this session supports Agent-bound model inspection and selection. */
  readonly available: boolean
  /** The session this seat instance belongs to (the settings panel is session-scoped). */
  readonly sessionId: string
  /** The session's shared directory store (same instance the /model popup reads). */
  readonly directory: DirectoryStore
  /** Ensure the shared advisory catalog is loaded (errors land on the store). */
  readonly load: () => void
  /** Submit a complete provider/model/effort selection. */
  readonly select: (selection: ModelSelection) => Promise<RemoteResult<void> | undefined>
  /** The Host settings behind the parameter panel, shared by every seat. */
  readonly params: ParamsFace
  /** The adapter-published facts behind the read-only branches, shared by every seat. */
  readonly capabilities: CapabilityFace
}

/** The route a settings surface is about. */
export interface ModelRoute {
  readonly provider: string
  readonly model: string
}

/** The locale service face this plugin uses for copy. */
export interface LocaleFace {
  register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(ns: string): Translate
}

/** The session wire face: addressed subagents own no model selection entry. */
export interface SessionFace {
  subagentAddress(sessionId: string): unknown
}

/** One session's shared directory controller. */
export interface DirectoryFace {
  readonly store: DirectoryStore
  load(): Promise<unknown>
  select(selection: ModelSelection): Promise<RemoteResult<void>>
}

/** The `ctx.modelDirectories` service owned by ui-model-selection. */
export interface ModelDirectories {
  directoryFor(sessionId: string): DirectoryFace
}

/** The seat registration options this plugin passes. */
export interface SlotRegisterOptions {
  name: string
  priority?: number
  locale?: string
  inject?: (sessionId: string) => Record<string, unknown>
}

/** The slot registry face (`ctx.slots`). */
export interface SlotsFace {
  inject(name: string, callback: () => unknown): void
  register(options: SlotRegisterOptions, component: unknown): () => void
}

/** The minimal Cordis client context this plugin's apply reads. */
export interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
  get(name: 'locale'): LocaleFace | undefined
  get(name: string): unknown
  inject(names: readonly string[], callback: (scope: ClientContext) => void): void
  readonly slots: SlotsFace
  readonly sessions: SessionFace
  readonly modelDirectories: ModelDirectories
}

/** Props the framework composes onto the registered seat component. */
export type PickerProps = SeatInjected & {
  /** Owner share: the seat is inert while the composer is locked. */
  readonly locked: boolean
  /** Locale seat, present because the registration declares `locale`. */
  readonly t?: Translate
  /** Local translator carried on the inject face: always present, used when `t` is not. */
  readonly translate: Translate
}
