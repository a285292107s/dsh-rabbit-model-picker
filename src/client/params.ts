import type {
  ConfigurableProvider, ModelRoute, ParamsFace, ParamsSnapshot, RemoteFace, RemoteResult, RouteAddress,
  SettingsNamespaceView, SettingsOp, WriteOutcome,
} from './contract.ts'
import { sameSnapshot } from './snapshotEq.ts'

export const MIN_CONTEXT = 1_024

export const MAX_CONTEXT = 10_485_760

export const CONTEXT_PLACEHOLDER = '128K'

export const PANEL_MODALITIES = ['text', 'image'] as const

const INPUT_FIELD_BY_NS: Record<string, string> = {
  'llm-pi-ai': 'input',
  'llm-deepseek': 'inputModalities',
}

const INPUT_FIELD_CANDIDATES = ['input', 'inputModalities'] as const

const INITIAL_SNAPSHOT: ParamsSnapshot = {
  status: 'idle',
  error: null,
  writable: false,
  providers: [],
  namespaces: {},
}

export function parseContext(raw: string): number | null {
  const text = raw.trim().replace(/[\s_]/g, '').toUpperCase()
  const match = /^(\d+(?:\.\d+)?)([KM])?$/.exec(text)
  if (match === null) return null
  const scale = match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1
  const tokens = Math.round(Number(match[1]) * scale)
  if (!Number.isFinite(tokens) || tokens < MIN_CONTEXT || tokens > MAX_CONTEXT) return null
  return tokens
}

export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 100_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function inputFieldOf(entry: Record<string, unknown>, ns: string): string {
  for (const candidate of INPUT_FIELD_CANDIDATES) {
    if (entry[candidate] !== undefined) return candidate
  }
  return INPUT_FIELD_BY_NS[ns] ?? INPUT_FIELD_CANDIDATES[0]
}

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

export class ParamsStore implements ParamsFace {
  private readonly listeners = new Set<() => void>()
  private snapshot: ParamsSnapshot = INITIAL_SNAPSHOT
  private inflight: Promise<void> | null = null

  constructor(private readonly face: () => RemoteFace | null) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot(): ParamsSnapshot {
    return this.snapshot
  }

  ensure(): void {
    if (this.snapshot.status === 'idle') void this.read()
  }

  refresh(): Promise<void> {
    return this.read()
  }

  async write(
    ns: string, ops: readonly SettingsOp[], expectedRevision: number | undefined,
  ): Promise<WriteOutcome> {
    const face = this.face()
    if (face === null) return { ok: false, conflict: false, message: 'settings are unavailable' }
    let response: RemoteResult<SettingsNamespaceView>
    try {
      response = await face.settings.mutate(ns, ops, expectedRevision)
      if (!response.ok && response.error.code === 'settings/conflict') {
        await this.read()
        response = await face.settings.mutate(ns, ops, this.snapshot.namespaces[ns]?.revision)
      }
    } catch (error: unknown) {
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

  private read(): Promise<void> {
    if (this.inflight !== null) return this.inflight
    const face = this.face()
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

  private publish(snapshot: ParamsSnapshot): void {
    if (sameSnapshot(this.snapshot, snapshot)) return
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
