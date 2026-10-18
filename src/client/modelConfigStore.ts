import type {
  ConfigurableProvider, CredentialInfo, DiscoveredModel, LlmProviderInfo, ModelConfigRow,
  ModelConfigSnapshot, ModelDiscoveryRequest, ProviderDirectoryEntry, RemoteCredentialsFace,
  RemoteLlmFace, RemoteSessionFace, RemoteSettingsFace, SettingsNamespaceView,
  SettingsOp, WriteOutcome,
} from './contract.ts'
import {
  ACCOUNT_ROUTE, apiKeyEnvOf, credentialRefFor, isAdded, isRemovable, joinProviderDirectory,
} from './modelConfigModel.ts'

export interface ModelConfigFaces {
  readonly settings: RemoteSettingsFace
  readonly llm: RemoteLlmFace
  readonly credentials?: RemoteCredentialsFace | undefined
  readonly session?: RemoteSessionFace | undefined
  readonly on?: ((event: string, listener: () => void) => () => void) | undefined
}

const INVALIDATING_EVENTS = [
  'settings/document-updated',
  'credentials/record-updated',
  'credentials/reference-updated',
  'llm/adapters-updated',
  'connection/reset',
] as const

const EMPTY: ModelConfigSnapshot = {
  status: 'idle',
  error: null,
  credentialError: null,
  writable: false,
  rows: [],
  namespaces: new Map(),
}

const CREDENTIAL_BATCH = 64

export class ModelConfigStore {
  private snapshot: ModelConfigSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private pending: Promise<void> = Promise.resolve()

  constructor(private readonly faces: () => ModelConfigFaces | null) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  start(): () => void {
    const on = this.faces()?.on
    if (on === undefined) return () => {}
    const disposers = INVALIDATING_EVENTS.map(event => on(event, () => { void this.load() }))
    return () => { for (const dispose of disposers) dispose() }
  }

  getSnapshot = (): ModelConfigSnapshot => this.snapshot

  private publish(next: ModelConfigSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

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

  private async read(faces: ModelConfigFaces, generation: number): Promise<void> {
    let described
    let registered: readonly LlmProviderInfo[]
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
      }
    }

    const draft = entries.map(entry => this.rowFor(entry, namespaces.get(entry.settingsNs), accountAvailable))

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
      added: isAdded(configured, entry.settingsPath),
      removable: isRemovable(namespace, entry.settingsPath),
      apiKeyEnv: entry.provider === ACCOUNT_ROUTE ? undefined : apiKeyEnvOf(value, entry.settingsPath),
      credential: undefined,
      ...entry.provider === ACCOUNT_ROUTE && accountAvailable !== undefined
        ? { accountAvailable }
        : {},
    }
  }

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

  namespace(ns: string): SettingsNamespaceView | undefined {
    return this.snapshot.namespaces.get(ns)
  }
}

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
