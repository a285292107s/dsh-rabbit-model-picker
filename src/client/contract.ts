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
  /**
   * The composition base layer, read only to tell "the user set this" from "the
   * deployment set this": a profile whose ONLY layer is the base is not the
   * user's to remove, which is exactly what `removable` reports.
   */
  readonly base?: unknown
  /** The serialized schema envelope this page reads its protocol choices out of. */
  readonly schema?: unknown
}

/** The whole settings surface: writability plus one view per namespace. */
export interface SettingsDescribe {
  readonly writable: boolean
  readonly namespaces: readonly SettingsNamespaceView[]
}

/**
 * One provider route as `llm/listProviders` reports it.
 *
 * These are the routes whose adapter is CURRENTLY registered, which is the half
 * of the directory that decides `active`. The configurable directory
 * (`llm/listConfigurableProviders`) is the other half and is deliberately not
 * the same list: it carries routes that exist in an adapter's catalog while
 * being registered by nobody (the dormant half — see `CONTEXT.md`).
 */
export interface LlmProviderInfo {
  readonly id: string
  readonly name: string
}

/**
 * One joined provider row: the directory entry plus whether its route is live.
 *
 * `active` is the only field here that cannot be read off the configurable
 * directory alone, and it is what makes "this provider exists in the catalog"
 * distinguishable from "this provider is registered right now".
 */
export interface ProviderDirectoryEntry {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly settingsPath: readonly string[]
  readonly active: boolean
  readonly declared?: boolean
  readonly defaultBaseURL?: string
  readonly baseURLEnv?: readonly string[]
  readonly error?: string
  /*
   * DELIBERATELY ABSENT: `nativeAuth`.
   *
   * The official join carries it (`dsh-client-ui-settings-models/lib/client.js:1208`)
   * and uses it for native-auth refs and hints (`:1379`, `:2004-2005`). This page
   * reads no native-auth fact, and the rule for this boundary is to declare only
   * what is consumed — carrying a field nothing reads is how `firstRun` became
   * dead state that had to be deleted later. It is recorded here rather than
   * silently omitted so the first surface that needs it knows the source is the
   * directory entry (pi-ai fills it at `dsh-llm-pi-ai/lib/index.js:2841-2857`)
   * and that adding it is a deliberate act, not a fix.
   */
}

/**
 * Source and writability facts for one credential reference.
 *
 * There is deliberately no field a value could ride in: the read half crosses
 * the Remote wire, so a view that could carry the secret would leak it. That is
 * why the page can offer "replace" but never "reveal".
 */
export interface CredentialInfo {
  /** Whether resolving the reference would currently return a value. */
  readonly configured: boolean
  /** The layer supplying the value; absent while unconfigured. */
  readonly source?: string
  /** Whether the active provider can write this reference. */
  readonly writable: boolean
}

/** One provider row the 模型配置 page renders. */
export interface ModelConfigRow {
  /** The joined directory entry (route id, display name, address, live state). */
  readonly entry: ProviderDirectoryEntry
  /** Whether any layer configures this provider (its profile resolves). */
  readonly configured: boolean
  /**
   * Whether this provider has actually been ADDED, which is what the page lists.
   *
   * Deliberately not the same question as {@link configured}. The directory gives
   * a row to EVERY provider an adapter could serve, so `configured: false` covers
   * two very different things: a provider the user has not added yet (dormant),
   * and one that is simply not registered. The page shows the providers the user
   * has, and offers the rest through a single add entry — so a row with no
   * settings address at all is "added" by virtue of being live (a route the
   * adapter registers without any configuration, like the account route), while
   * a catalog entry with an address and no profile is not.
   */
  readonly added: boolean
  /** Whether the user layer ALONE carries the profile (removal restores the base). */
  readonly removable: boolean
  /** The credential reference the resolved profile names, when one does. */
  readonly apiKeyEnv: string | undefined
  /** Credential state for {@link apiKeyEnv}, once described. */
  readonly credential: CredentialInfo | undefined
  /**
   * Credential state for the page's derived `<ROUTE>_API_KEY`, described only
   * while the profile names no reference — which is what keeps a dormant or
   * keyless row's badge consistent with the editor's own derivation rule.
   */
  readonly derivedCredential?: CredentialInfo
  /**
   * The account route's own usability, which is a session fact rather than a
   * credential one: `deepseek-account` authenticates through the signed-in
   * session, so no `apiKeyEnv` describes it and the page must ask the session
   * instead. Undefined for every other route.
   */
  readonly accountAvailable?: boolean
}

/** Lifecycle of the read behind the 模型配置 page. */
export type ModelConfigStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The immutable snapshot the page renders from. */
export interface ModelConfigSnapshot {
  readonly status: ModelConfigStatus
  /** Whole-load failure text; row-level write failures stay on the row. */
  readonly error: string | null
  /** Credential enrichment failure; the provider rows remain usable. */
  readonly credentialError: string | null
  /** Whether the settings document accepts writes at all. */
  readonly writable: boolean
  readonly rows: readonly ModelConfigRow[]
  /** Namespace views by namespace id. */
  readonly namespaces: ReadonlyMap<string, SettingsNamespaceView>
}

/** One path-addressed edit, as the wire takes it. Alias of {@link SettingsOp}. */
export type SettingsPathOp = SettingsOp

/**
 * One model group in the session's own catalog.
 *
 * The account route authenticates through the signed-in session rather than a
 * key, so its availability is a SESSION fact: this catalog listing is the only
 * read that can answer it, and a credential describe cannot.
 */
export interface SessionCatalogGroup {
  readonly id: string
  readonly models: readonly unknown[]
}

/**
 * The `remote.session` read this page needs.
 *
 * Declared as the single method actually consumed rather than the whole session
 * face: an out-of-repo plugin re-declares only what it reads, and naming more
 * would misrepresent how much of that contract a change here could break.
 */
export interface RemoteSessionFace {
  modelCatalog(): Promise<RemoteResult<{ readonly groups: readonly SessionCatalogGroup[] }>>
}

/** The generated `ctx.remote.credentials` namespace. */
export interface RemoteCredentialsFace {  /** Source and writability facts for these references; never their values. */
  describe(refs: readonly string[]): Promise<RemoteResult<Record<string, CredentialInfo>>>
  /** Store one credential literal under its reference. */
  set(ref: string, value: string): Promise<RemoteResult<void>>
  /** Remove one credential reference (idempotent). */
  unset(ref: string): Promise<RemoteResult<void>>
}

/** One model as the page edits it in a provider's catalog. */
export interface ModelCatalogEntry {
  readonly id: string
  readonly name?: string
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly input?: readonly string[]
}

/** The models array one provider profile carries, as stored. */
export type ModelCatalog = readonly ModelCatalogEntry[]

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
  /**
   * The endpoint the adapter would use while the profile names none.
   *
   * Read so the row can show what "leave it empty" actually resolves to, which is
   * the difference between an empty base-URL field reading as "unconfigured" and
   * reading as "uses the adapter default".
   */
  readonly defaultBaseURL?: string
  /**
   * The environment variables that may supply the endpoint, in precedence order.
   *
   * This is the half of the env-fallback story the credential channel cannot
   * answer: a credential read says whether a KEY resolves, never which variable
   * backs a URL, so the row needs this list to name the fallback honestly.
   */
  readonly baseURLEnv?: readonly string[]
}

/**
 * How the executor spends a provider's retry budget.
 *
 * Copied from `@deepseek-ai/dsh-llm`'s `RetryPolicySchema` through the pi-ai
 * adapter's Config schema, which is where these fields were confirmed to be
 * declared (`providers: z.dict(profile).default({}).volatile()`, so every
 * provider profile — and therefore every retry field — is live-editable).
 * `normal` spends a finite `maxRetries` budget; `always` retries without limit
 * and is READ here but never written: an unbounded budget is not something this
 * card should offer by accident.
 */
export type RetryPolicyMode = 'normal' | 'always'

/** The bounded exponential backoff the executor applies between retries. */
export interface RetryBackoff {
  /** The first wait; every later wait doubles it until the cap applies. */
  readonly initialDelayMs: number
  /** The cap on one wait. */
  readonly maxDelayMs: number
  /** Symmetric fraction each wait is randomly varied by. */
  readonly jitterRatio: number
}

/**
 * One provider's retry configuration as the card shows and edits it.
 *
 * `maxRetries` and `maxDelayMs` are the two EDITED numbers; the rest is carried
 * so a write can state the whole `retryPolicy` object without resetting fields
 * the card does not expose.
 */
export interface RetryPolicyView {
  readonly mode: RetryPolicyMode
  /** Whether the provider's own layer states a policy, or it inherits one. */
  readonly declared: boolean
  readonly maxRetries: number
  readonly maxDelayMs: number
  readonly initialDelayMs: number
  readonly jitterRatio: number
  /** The raw stored policy object, when the provider has one. */
  readonly policy?: Record<string, unknown>
}

/** The `retryPolicy` document written back to one provider. */
export interface RetryPolicyValue {
  readonly mode: RetryPolicyMode
  readonly maxRetries: number
  readonly retryableCodes?: readonly string[]
  readonly backoff: RetryBackoff
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
  /**
   * The routes whose adapter is registered right now.
   *
   * A separate read from {@link listConfigurableProviders}, and the difference is
   * the whole dormant/live distinction: this list decides `active`, while the
   * configurable directory decides which rows exist at all. Optional for the same
   * reason discovery is — a deployment can answer one and not the other, and this
   * page treats a missing answer as "no routes registered" rather than refusing
   * to render.
   */
  listProviders?(): Promise<RemoteResult<readonly LlmProviderInfo[]>>
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

/**
 * The facts every adapter-catalog read has produced so far.
 *
 * There is deliberately NO lifecycle field here. An earlier revision carried
 * `status: 'idle' | 'loading' | 'ready'` and published it, but no surface ever
 * read it — checked across `src/` — so it only ever made the snapshot differ from
 * itself: opening the menu on the reference catalog woke every subscriber 16
 * times for 8 real answers, and half of those re-rendered the whole model list to
 * report a status nothing displays. What a row needs to know is what the adapter
 * published; "a read is still in flight" is the directory's own `status`, which
 * the card already renders.
 */
export interface CapabilitySnapshot {
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

/**
 * The registration options a settings SECTION passes.
 *
 * A deliberately different shape from {@link SlotRegisterOptions}, which belongs
 * to the composer seat. A section carries the NAV IDENTITY the shell projects
 * (`id`, `order`, `label`), while the seat carries `priority` — its shadowing
 * rank. Naming both instead of widening one loose type is what keeps a section
 * registration from silently acquiring a `priority` and shadowing the shipped
 * Models page, which ADR 0003 forbids.
 */
export interface SectionRegisterOptions {
  name: string
  /** Section key; the shell's `only` filter and the nav row's identity. */
  id: string
  /** Nav position; ascending. */
  order: number
  /** Registrant-localized display text, evaluated on every read. */
  label: () => string
  /** Puts the framework `t` seat on the component when the registrant declares its namespace. */
  locale?: string
  /** The registrant's own inject face, merged with the owner props. */
  inject?: () => Record<string, unknown>
}

/** The slot registry face (`ctx.slots`). */
export interface SlotsFace {
  inject(name: string, callback: () => unknown): void
  register(options: SlotRegisterOptions | SectionRegisterOptions, component: unknown): () => void
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
