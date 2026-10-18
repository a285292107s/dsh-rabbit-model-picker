import {
  rowKey, type CapabilityFace, type CapabilitySnapshot, type CapabilitySource, type ConfigurableProvider,
  type DiscoveredModel, type RemoteLlmFace, type RouteCapability,
} from './contract.ts'
import { sameSnapshot } from './snapshotEq.ts'

const INITIAL_SNAPSHOT: CapabilitySnapshot = { routes: {} }

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

export function routeCapabilityOf(model: DiscoveredModel): RouteCapability | null {
  const declared = Array.isArray(model.inputModalities)
    ? model.inputModalities.filter((modality): modality is string => typeof modality === 'string')
    : []
  const inputModalities = declared.length === 0 ? undefined : declared
  const contextWindow = positiveInteger(model.contextWindow)
  const maxTokens = positiveInteger(model.maxTokens)
  if (inputModalities === undefined && contextWindow === undefined && maxTokens === undefined) return null
  return {
    ...inputModalities === undefined ? {} : { inputModalities },
    ...contextWindow === undefined ? {} : { contextWindow },
    ...maxTokens === undefined ? {} : { maxTokens },
  }
}

export class CapabilityStore implements CapabilityFace {
  private readonly listeners = new Set<() => void>()
  private readonly sources: CapabilitySource[] = []
  private readonly asked = new Set<string>()
  private readonly inflight = new Set<string>()
  private readonly unanswered = new Set<string>()
  private readonly requeue = new Set<string>()
  private readonly routes: Record<string, RouteCapability> = {}
  private snapshot: CapabilitySnapshot = INITIAL_SNAPSHOT
  private directory: readonly ConfigurableProvider[] | null = null

  constructor(private readonly llm: () => RemoteLlmFace | null) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot(): CapabilitySnapshot {
    return this.snapshot
  }

  ensure(providers: readonly string[]): void {
    for (const provider of providers) {
      if (provider.length === 0) continue
      if (this.asked.has(provider) && !this.unanswered.has(provider)) continue
      this.asked.add(provider)
      this.unanswered.delete(provider)
      void this.read(provider)
    }
  }

  addSource(source: CapabilitySource): void {
    this.sources.push(source)
    for (const provider of source.providers) {
      if (this.inflight.has(provider)) {
        this.requeue.add(provider)
        continue
      }
      if (!this.asked.has(provider) && !this.unanswered.has(provider)) continue
      this.asked.delete(provider)
      this.unanswered.delete(provider)
      this.ensure([provider])
    }
  }

  private async read(provider: string): Promise<void> {
    if (this.inflight.has(provider)) return
    this.inflight.add(provider)
    let models: readonly DiscoveredModel[] | null = null
    try {
      models = await this.fetch(provider)
    } catch {
      this.unanswered.add(provider)
    }
    this.inflight.delete(provider)
    if (models !== null && Array.isArray(models)) {
      for (const model of models) {
        if (typeof model?.id !== 'string' || model.id.length === 0) continue
        const capability = routeCapabilityOf(model)
        if (capability !== null) this.routes[rowKey(provider, model.id)] = capability
      }
    }
    this.publish()
    this.requeueRacingReader(provider)
  }

  private requeueRacingReader(provider: string): void {
    if (!this.requeue.delete(provider)) return
    this.asked.delete(provider)
    this.unanswered.delete(provider)
    this.ensure([provider])
  }

  private async fetch(provider: string): Promise<readonly DiscoveredModel[]> {
    const source = this.sources.find(candidate => candidate.providers.includes(provider))
    if (source !== undefined) return await source.read()
    const llm = this.llm()
    const discover = llm?.discoverModels
    if (llm === null || llm === undefined || discover === undefined) {
      throw new Error('the llm remote is not mounted')
    }
    const directory = await this.providers(llm)
    const entry = directory.find(candidate => candidate.provider === provider)
    if (entry === undefined || entry.declared === true) return []
    const result = await discover.call(llm, entry.settingsNs, { provider })
    return result.ok ? result.value : []
  }

  private async providers(llm: RemoteLlmFace): Promise<readonly ConfigurableProvider[]> {
    if (this.directory !== null) return this.directory
    const result = await llm.listConfigurableProviders()
    if (!result.ok) throw new Error(result.error.message)
    this.directory = result.value
    return result.value
  }

  private publish(): void {
    const next: CapabilitySnapshot = { routes: { ...this.routes } }
    if (sameSnapshot(this.snapshot, next)) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}
