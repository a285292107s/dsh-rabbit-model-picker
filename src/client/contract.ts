
export interface ModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}
export interface ModelReasoningEffort {
  readonly id: string
  readonly name: string
}

export interface ModelReasoning {
  readonly efforts: readonly ModelReasoningEffort[]
  readonly defaultEffort?: string
}

export interface CatalogModel {
  readonly id: string
  readonly name: string
  readonly reasoning?: ModelReasoning
}

export interface ProviderGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly CatalogModel[]
}

export interface CatalogFailure {
  readonly id: string
  readonly name: string
  readonly message: string
}

// The opaque row identity every cross-surface lookup keys off, so the `provider/model`
// spelling is a contract rather than a formatting choice.
export function rowKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

export type DirectoryStatus = 'idle' | 'loading' | 'ready' | 'selecting' | 'error'

export interface DirectoryState {
  readonly current: ModelSelection | null
  readonly retainedEffort?: string
  readonly groups: readonly ProviderGroup[]
  readonly failures: readonly CatalogFailure[]
  readonly status: DirectoryStatus
  readonly pending: ModelSelection | null
  readonly error: string | null
}

export interface DirectoryStore {
  getSnapshot(): DirectoryState
  subscribe(listener: () => void): () => void
}

export interface RemoteFailure {
  readonly code: string
  readonly message: string
}

export type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RemoteFailure }

export interface SettingsOp {
  readonly op: 'set' | 'unset'
  readonly path: readonly string[]
  readonly value?: unknown
}

export interface SettingsNamespaceView {
  readonly ns: string
  readonly revision: number
  // `value` is the effective config (all layers merged, schema defaults applied); `user`
  // is the profile patch this plugin edits; `base` is the composition layer, and a path
  // in `user` but not `base` is the user's own change — that is what `removable` reports.
  readonly value: unknown
  readonly user?: unknown
  readonly base?: unknown
  readonly schema?: unknown
}

export interface SettingsDescribe {
  readonly writable: boolean
  readonly namespaces: readonly SettingsNamespaceView[]
}

export interface LlmProviderInfo {
  readonly id: string
  readonly name: string
}

export interface ProviderDirectoryEntry {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly settingsPath: readonly string[]
  // Whether this route's adapter is registered right now — a fact the configurable
  // directory itself cannot answer; llm/listProviders is the other source.
  readonly active: boolean
  readonly declared?: boolean
  readonly defaultBaseURL?: string
  readonly baseURLEnv?: readonly string[]
  readonly error?: string
}

// Source and writability of one credential reference; deliberately no value field, since
// the read crosses the Remote wire — a key can be replaced or unset, never read back.
export interface CredentialInfo {
  readonly configured: boolean
  readonly source?: string
  readonly writable: boolean
}

export interface ModelConfigRow {
  readonly entry: ProviderDirectoryEntry
  // `configured` = some layer carries this provider's profile; `added` = the page lists
  // it, which a live route with no settings address is even when no layer configures it.
  readonly configured: boolean
  readonly added: boolean
  readonly removable: boolean
  readonly apiKeyEnv: string | undefined
  readonly credential: CredentialInfo | undefined
  readonly derivedCredential?: CredentialInfo
  readonly accountAvailable?: boolean
}

export type ModelConfigStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ModelConfigSnapshot {
  readonly status: ModelConfigStatus
  readonly error: string | null
  readonly credentialError: string | null
  readonly writable: boolean
  readonly rows: readonly ModelConfigRow[]
  readonly namespaces: ReadonlyMap<string, SettingsNamespaceView>
}

export type SettingsPathOp = SettingsOp

export interface SessionCatalogGroup {
  readonly id: string
  readonly models: readonly unknown[]
}

export interface RemoteSessionFace {
  modelCatalog(): Promise<RemoteResult<{ readonly groups: readonly SessionCatalogGroup[] }>>
}

export interface RemoteCredentialsFace {
  describe(refs: readonly string[]): Promise<RemoteResult<Record<string, CredentialInfo>>>
  set(ref: string, value: string): Promise<RemoteResult<void>>
  unset(ref: string): Promise<RemoteResult<void>>
}

export interface ModelCatalogEntry {
  readonly id: string
  readonly name?: string
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly input?: readonly string[]
}

export type ModelCatalog = readonly ModelCatalogEntry[]

export interface ConfigurableProvider {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly settingsPath: readonly string[]
  // The adapter's own admission that it serves this route from configuration alone —
  // the one value that may block llm/discoverModels (see capabilities.ts).
  readonly declared?: boolean
  readonly error?: string
  readonly defaultBaseURL?: string
  readonly baseURLEnv?: readonly string[]
}

export type RetryPolicyMode = 'normal' | 'always'

export interface RetryBackoff {
  readonly initialDelayMs: number
  readonly maxDelayMs: number
  readonly jitterRatio: number
}

export interface RetryPolicyView {
  readonly mode: RetryPolicyMode
  readonly declared: boolean
  readonly maxRetries: number
  readonly maxDelayMs: number
  readonly initialDelayMs: number
  readonly jitterRatio: number
  readonly policy?: Record<string, unknown>
}

export interface RetryPolicyValue {
  readonly mode: RetryPolicyMode
  readonly maxRetries: number
  readonly retryableCodes?: readonly string[]
  readonly backoff: RetryBackoff
}

export interface RemoteSettingsFace {
  describe(): Promise<RemoteResult<SettingsDescribe>>
  // Only volatile paths are accepted; a write against a stale `expectedRevision` answers
  // `settings/conflict`, which every caller here retries once after re-reading.
  mutate(
    ns: string,
    ops: readonly SettingsOp[],
    expectedRevision?: number,
  ): Promise<RemoteResult<SettingsNamespaceView>>
}

export interface ModelDiscoveryRequest {
  readonly provider?: string
  readonly baseURL?: string
  readonly api?: string
  readonly apiKey?: string
}

export interface DiscoveredModel {
  readonly id: string
  readonly name?: string
  // Token counts. Every field but `id` is optional because a listing may disclose an id
  // and nothing else; absent (or empty) `inputModalities` means unknown, not "none".
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly inputModalities?: readonly string[]
}

export interface RemoteLlmFace {
  // Routes whose adapter is registered right now — deliberately not the same list as
  // listConfigurableProviders, which also carries routes that nobody registers.
  listProviders?(): Promise<RemoteResult<readonly LlmProviderInfo[]>>
  listConfigurableProviders(): Promise<RemoteResult<readonly ConfigurableProvider[]>>
  discoverModels?(
    settingsNs: string,
    request: ModelDiscoveryRequest,
  ): Promise<RemoteResult<readonly DiscoveredModel[]>>
}

export interface RemoteCatalogFace {
  read(): Promise<RemoteResult<{ readonly models: readonly DiscoveredModel[] }>>
}

export interface RemoteFace {
  readonly settings: RemoteSettingsFace
  readonly llm: RemoteLlmFace
}

export type ParamsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

export interface ParamsSnapshot {
  readonly status: ParamsStatus
  readonly error: string | null
  readonly writable: boolean
  readonly providers: readonly ConfigurableProvider[]
  readonly namespaces: Readonly<Record<string, SettingsNamespaceView>>
}

export interface RouteAddress {
  readonly ns: string
  readonly entryPath: readonly string[]
  readonly inputField: string
  readonly revision: number
  readonly input: readonly string[]
  readonly contextWindow?: number
  readonly defaultContextWindow?: number
  readonly maxTokens?: number
  readonly defaultInput: readonly string[]
  readonly declared: boolean
}

export interface RouteCapability {
  readonly inputModalities?: readonly string[]
  readonly contextWindow?: number
  readonly maxTokens?: number
}

export interface CapabilitySnapshot {
  readonly routes: Readonly<Record<string, RouteCapability>>
}

export interface CapabilitySource {
  readonly providers: readonly string[]
  read(): Promise<readonly DiscoveredModel[]>
}

export interface CapabilityFace {
  subscribe(listener: () => void): () => void
  getSnapshot(): CapabilitySnapshot
  ensure(providers: readonly string[]): void
}

export type WriteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly conflict: boolean; readonly message: string }

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

export type Translate = (key: string, params?: Record<string, string>) => string

export interface SeatInjected {
  readonly available: boolean
  readonly sessionId: string
  readonly directory: DirectoryStore
  readonly load: () => void
  readonly select: (selection: ModelSelection) => Promise<RemoteResult<void> | undefined>
  readonly params: ParamsFace
  readonly capabilities: CapabilityFace
}

export interface ModelRoute {
  readonly provider: string
  readonly model: string
}

export interface LocaleFace {
  register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(ns: string): Translate
}

export interface SessionFace {
  subagentAddress(sessionId: string): unknown
}

export interface DirectoryFace {
  readonly store: DirectoryStore
  load(): Promise<unknown>
  select(selection: ModelSelection): Promise<RemoteResult<void>>
}

export interface ModelDirectories {
  directoryFor(sessionId: string): DirectoryFace
}

export interface SlotRegisterOptions {
  name: string
  priority?: number
  locale?: string
  inject?: (sessionId: string) => Record<string, unknown>
}

export interface SectionRegisterOptions {
  name: string
  id: string
  order: number
  label: () => string
  locale?: string
  inject?: () => Record<string, unknown>
}

export interface SlotsFace {
  inject(name: string, callback: () => unknown): void
  register(options: SlotRegisterOptions | SectionRegisterOptions, component: unknown): () => void
}

export interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
  get(name: 'locale'): LocaleFace | undefined
  get(name: string): unknown
  inject(names: readonly string[], callback: (scope: ClientContext) => void): void
  readonly slots: SlotsFace
  readonly sessions: SessionFace
  readonly modelDirectories: ModelDirectories
}

export type PickerProps = SeatInjected & {
  readonly locked: boolean
  readonly t?: Translate
  readonly translate: Translate
}
