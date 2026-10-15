/**
 * The facts an adapter PUBLISHED about its own routes, for the routes the
 * settings document cannot address.
 *
 * WHY THIS EXISTS. The panel and the row can only tell two kinds of truth: what
 * the profile declares, and what the adapter will do with no declaration. A
 * route the adapter serves straight out of its installed catalog has neither —
 * `llm/listConfigurableProviders` does not even name it, so `resolveRoute`
 * returns null and the row used to draw no modality badge and no window while
 * the panel drew BOTH modality switches as off, which is a claim about the model
 * that nothing had verified. The adapter, however, does know: it ships a
 * per-model catalog and, for the third-party adapters, publishes it over a
 * Remote of its own.
 *
 * TWO WAYS IN, IN THIS ORDER.
 *
 *   1. An adapter-owned catalog Remote ({@link CapabilitySource}), registered
 *      here by whichever deployment mounts that namespace. This is the only way
 *      to some routes at all: `dsh-opencode-go` never registers a configurable
 *      provider, so it appears in no settings directory and only its own
 *      `opencodeGoModels/read` answers.
 *   2. `llm/discoverModels`, but ONLY for a route its own adapter ships
 *      something about (`declared !== true`). A route the adapter admits it
 *      knows only from configuration makes that call reach for the ENDPOINT
 *      itself — a network request and a credential use summoned by opening the
 *      model menu, which is not a cost a picker may impose silently. Such a
 *      route therefore stays unread, and the row states no fact rather than a
 *      guessed one.
 *
 * WHAT A READ COSTS. One Remote call per ANSWERED provider per page load:
 * {@link CapabilityStore} never refetches a provider it holds an answer for,
 * and joins concurrent asks. An ask that never reached an answer — the LLM face
 * was not mounted yet, a transport failure — is released for the next open to
 * try again; that race is real because the Remote namespaces mount
 * asynchronously. There is deliberately no polling and no push subscription —
 * an adapter catalog changes when its owner refreshes it, and the next page load
 * sees that.
 *
 * @module dsh-rabbit-model-picker/client/capabilities
 */

import {
  rowKey, type CapabilityFace, type CapabilitySnapshot, type CapabilitySource, type ConfigurableProvider,
  type DiscoveredModel, type RemoteLlmFace, type RouteCapability,
} from './contract.ts'
import { sameSnapshot } from './snapshotEq.ts'

/**
 * The snapshot before the first read: nothing asked, nothing claimed.
 *
 * `routes` starts as one frozen shared object rather than a fresh `{}`, so the
 * "nothing has changed" comparison in {@link CapabilityStore.publish} can hold
 * onto the same identity while the store is still empty.
 */
const INITIAL_SNAPSHOT: CapabilitySnapshot = { routes: {} }

/**
 * Keep only a token count that can be a real capacity.
 * @param value - the published value.
 * @returns the number, or undefined when it is not a positive integer.
 */
function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * Detach the facts one published model carries.
 *
 * A model the adapter published nothing about yields null rather than an empty
 * record, so "the adapter said nothing" stays distinguishable from "the adapter
 * said the model takes nothing".
 * @param model - one model from an adapter's catalog or discovery answer.
 * @returns the capabilities worth keeping, or null when there are none.
 */
export function routeCapabilityOf(model: DiscoveredModel): RouteCapability | null {
  const declared = Array.isArray(model.inputModalities)
    ? model.inputModalities.filter((modality): modality is string => typeof modality === 'string')
    : []
  // An empty list is "published nothing", not "published the empty set": the
  // difference is what keeps a route unstated instead of claiming it takes no
  // input at all.
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

/**
 * Every adapter-published fact this plugin has read, kept as one immutable
 * snapshot for `useSyncExternalStore`.
 *
 * One instance is created per plugin activation and shared by every seat, so two
 * composer instances read one catalog answer instead of racing two.
 */
export class CapabilityStore implements CapabilityFace {
  private readonly listeners = new Set<() => void>()
  private readonly sources: CapabilitySource[] = []
  /** Providers a read has been dispatched for. */
  private readonly asked = new Set<string>()
  /** Providers whose read is still in flight. */
  private readonly inflight = new Set<string>()
  /** Asked, but the read never reached an answer: the next open tries again. */
  private readonly unanswered = new Set<string>()
  /** Providers whose in-flight read predates a reader registered for them. */
  private readonly requeue = new Set<string>()
  private readonly routes: Record<string, RouteCapability> = {}
  private snapshot: CapabilitySnapshot = INITIAL_SNAPSHOT
  private directory: readonly ConfigurableProvider[] | null = null

  /**
   * @param llm - resolves the LLM Remote face, or null when this deployment
   *   mounts none. A RESOLVER rather than the face itself because the Remote
   *   namespaces mount asynchronously: reading it when a route is asked for is
   *   what keeps the wiring independent of activation order.
   */
  constructor(private readonly llm: () => RemoteLlmFace | null) {}

  /** Subscribe to snapshot changes. @param listener - called after any change. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * The current snapshot, stable until something changes.
   * @returns the snapshot handed to React.
   */
  getSnapshot(): CapabilitySnapshot {
    return this.snapshot
  }

  /**
   * Read these providers' routes.
   *
   * Called from a render path (the menu opening, the panel mounting), so it only
   * schedules work: a provider already answered costs nothing, and a failure
   * leaves the facts absent rather than surfacing an error — these facts are
   * decoration on a surface that already works without them. A provider whose
   * earlier ask never reached an answer is asked again.
   * @param providers - provider route ids whose models are on screen.
   */
  ensure(providers: readonly string[]): void {
    for (const provider of providers) {
      if (provider.length === 0) continue
      if (this.asked.has(provider) && !this.unanswered.has(provider)) continue
      this.asked.add(provider)
      this.unanswered.delete(provider)
      void this.read(provider)
    }
  }

  /**
   * Add an adapter-owned catalog reader.
   *
   * Registered by the wiring, which may land AFTER the picker has already asked
   * for the routes this reader answers for (the picker's first ask races plugin
   * activation); those asks are re-run here, which is what keeps mount order
   * irrelevant. A reader whose adapter is not installed simply never answers.
   * @param source - the reader and the routes it claims.
   */
  addSource(source: CapabilitySource): void {
    this.sources.push(source)
    for (const provider of source.providers) {
      // Still in flight: the running read went out before this reader existed,
      // so it cannot carry its facts. `asked` still holds the provider, which
      // is what keeps this re-ask alive past the inflight guard — the settled
      // read re-runs it (see `read`).
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

  /**
   * Interrogate one provider, once.
   *
   * Both outcomes — an answer and a failure — settle the ask the same way, so the
   * settle is written once at the end rather than per branch. That is not
   * tidiness: the requeue below is a decision about the ASK, and it is exactly as
   * true of an ask that failed as of one that answered (see
   * {@link requeueRacingReader}).
   * @param provider - provider route id.
   */
  private async read(provider: string): Promise<void> {
    if (this.inflight.has(provider)) return
    this.inflight.add(provider)
    let models: readonly DiscoveredModel[] | null = null
    try {
      models = await this.fetch(provider)
    } catch {
      // The ask never reached an answer — the LLM face was not mounted yet, the
      // provider directory read failed, the transport rejected. Mark the ask
      // retryable instead of consuming it: paying that race once and stating
      // nothing for the rest of the page is the exact failure an asynchronously
      // mounted Remote makes possible. An ANSWERED provider — "published none"
      // included — is still asked exactly once (see `fetch`).
      this.unanswered.add(provider)
    }
    this.inflight.delete(provider)
    // `models !== null` is the "the fetch answered" half; `Array.isArray` is the
    // trust boundary. Each field of every model is already probed, but the LIST
    // itself arrives from an adapter's own Remote, and `fetch`'s discovery arm
    // hands back `result.value` exactly as the adapter typed it. One adapter
    // answering `undefined` where the contract promises an array would otherwise
    // throw out of a released ask and take the whole seat's render with it.
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

  /**
   * Re-run an ask that a reader registered while it was in flight could not see.
   *
   * THE RACE THIS CLOSES. A reader is registered by the wiring, which may land
   * after the picker has already asked for the routes that reader answers for —
   * `addSource` documents that as the ordinary case, not an edge one. The running
   * read cannot carry the reader's facts, so it is parked and re-run once it
   * settles.
   *
   * It is called on BOTH settle paths, and that is the whole point. Hanging it off
   * the success path alone left two defects in one place: a reader that arrived
   * during an ask that FAILED — which is precisely the async-mount race this
   * store exists to absorb, an unmounted LLM face or a dead transport — was never
   * re-run, so the mount order the store promises to be independent of decided
   * whether the facts ever arrived; and the parked entry stayed in the requeue set
   * forever, so it later forced a SECOND read of a provider that had already been
   * answered, breaking the one-call-per-provider-per-page-load budget below.
   *
   * `asked` and `unanswered` are both cleared before the re-ask so it is a real
   * fresh ask: `ensure` skips a provider it believes it has already asked, and the
   * re-run must not inherit either verdict from the read that went out without
   * this reader.
   * @param provider - the provider whose ask just settled.
   */
  private requeueRacingReader(provider: string): void {
    if (!this.requeue.delete(provider)) return
    this.asked.delete(provider)
    this.unanswered.delete(provider)
    this.ensure([provider])
  }

  /**
   * Read one provider's published models through whichever way in applies.
   * @param provider - provider route id.
   * @returns its models; an EMPTY list is an answer ("published none"), and an
   *   answered provider is never asked again.
   * @throws when no answer arrived at all — the LLM face is not mounted yet,
   *   the provider directory read failed, the transport rejected. `read` marks
   *   the ask retryable instead of consuming it.
   */
  private async fetch(provider: string): Promise<readonly DiscoveredModel[]> {
    const source = this.sources.find(candidate => candidate.providers.includes(provider))
    if (source !== undefined) return await source.read()
    const llm = this.llm()
    const discover = llm?.discoverModels
    if (llm === null || llm === undefined || discover === undefined) {
      // Remote namespaces mount asynchronously: absent here can mean "not yet"
      // rather than "never", so this is no answer, not an empty one.
      throw new Error('the llm remote is not mounted')
    }
    const directory = await this.providers(llm)
    const entry = directory.find(candidate => candidate.provider === provider)
    // `declared` is the adapter's own admission that it ships nothing about this
    // route, which is precisely when its discovery leaves the process and talks
    // to the endpoint. Refusing that call is the point, not an oversight.
    if (entry === undefined || entry.declared === true) return []
    const result = await discover.call(llm, entry.settingsNs, { provider })
    // A refusal the adapter itself answered with is an answer: the route stays
    // unstated and the ask is consumed, exactly as before.
    return result.ok ? result.value : []
  }

  /**
   * The provider directory, read once and shared by every later lookup.
   * @param llm - the LLM face to read it from.
   * @returns the directory.
   * @throws when the directory read fails — a failed read must not be cached as
   *   an empty answer (see `read`).
   */
  private async providers(llm: RemoteLlmFace): Promise<readonly ConfigurableProvider[]> {
    if (this.directory !== null) return this.directory
    const result = await llm.listConfigurableProviders()
    if (!result.ok) throw new Error(result.error.message)
    this.directory = result.value
    return result.value
  }

  /**
   * Replace the snapshot and wake every subscriber — but only when the answer
   * actually differs from the one in hand.
   *
   * WHY THE GUARD. `useSyncExternalStore` re-renders a component when the
   * snapshot it reads stops being `Object.is`-equal to the last one it saw, and
   * this store's snapshot is built here, so comparing references can never help:
   * every publish would hand React a new object. Comparing the CONTENT is
   * therefore the only way to avoid the re-render, and it is worth avoiding —
   * a read that answers "this provider published nothing" lands here with an
   * unchanged payload, and the model list would otherwise re-render for it.
   *
   * `routes` is copied only when something is published, so a no-op publish keeps
   * handing back the very same snapshot object.
   */
  private publish(): void {
    const next: CapabilitySnapshot = { routes: { ...this.routes } }
    if (sameSnapshot(this.snapshot, next)) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}
