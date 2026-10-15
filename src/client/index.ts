/**
 * dsh-rabbit-model-picker, browser half.
 *
 * One job: occupy the composer's `conversation.input.model` seat with a card whose
 * two panes are the provider scope and the model list, and read the SAME
 * per-session directory `ui-model-selection`
 * gives the `/model` popup — that shared instance is what makes the two entries
 * one state, with no synchronization code here.
 *
 * Shadowing, not replacing: the seat is registered at `priority: -10`, and the
 * slot registry renders the lowest priority. The shipped seat (`priority` 0)
 * keeps its registration and its `/model` contribution; deleting this plugin's
 * row restores it with no further change.
 *
 * @module dsh-rabbit-model-picker/client
 */

import type {
  ClientContext, RemoteFace, RemoteLlmFace, RemoteSettingsFace,
} from './contract.ts'
import { ADAPTER_CATALOGS, readCatalog } from './adapterCatalog.ts'
import { CapabilityStore } from './capabilities.ts'
import { dictionaries, localTranslate, NS } from './dictionary.ts'
import { ParamsStore } from './params.ts'
import { Picker } from './Picker.tsx'
import { retireStoredScope } from './retiredScope.ts'
import { injectStyles } from './styles.ts'

/**
 * Required client services.
 *
 * `modelDirectories` is the shared directory owner (ui-model-selection), which
 * itself waits for `locale` — so by the time this plugin activates, a locale
 * face is installed too.
 *
 * `remote` / `remote.session` are NOT decoration: `ModelDirectoryResolver`
 * methods run behind Cordis's caller-context tracker, so
 * `directoryFor()` internally reads `this.ctx.remote.session` against the
 * CALLER's fiber. A plugin that omits them gets
 * `cannot get property "remote.session" without inject` thrown out of the
 * slot's inject face — the entry abdicates and the shipped seat silently
 * resumes. The shipped occupant declares exactly these two for the same reason.
 */
export const inject = ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'] as const

/**
 * Read the two settings faces this plugin writes model parameters through.
 *
 * They are read with `ctx.get`, deliberately NOT added to {@link inject}: the
 * seat must keep claiming the composer on a deployment that mounts no settings
 * controller (an older or trimmed profile), and a missing injectable would make
 * the whole entry abdicate to the shipped seat instead. A deployment without
 * them still gets the picker — its parameter panel just reports that the Host
 * settings are unavailable.
 *
 * A FUNCTION returning the faces, not the faces: `ParamsStore` calls it per read,
 * because the Remote namespaces are mounted by their owners when those owners
 * activate (DESIGN §2.2) and so may legitimately be "not yet" at this plugin's
 * own activation. Asked once and kept, that ordering would be reported to the
 * user as "this deployment mounts no settings service" for the rest of the page.
 * @param scope - the injected client scope.
 * @returns the resolver `ParamsStore` reads on every read.
 */
function settingsFaceOf(scope: Pick<ClientContext, 'get'>): () => RemoteFace | null {
  return () => {
    const settings = scope.get('remote.settings') as RemoteSettingsFace | undefined
    const llm = scope.get('remote.llm') as RemoteLlmFace | undefined
    if (typeof settings?.describe !== 'function' || typeof settings.mutate !== 'function') return null
    if (typeof llm?.listConfigurableProviders !== 'function') return null
    return { settings, llm }
  }
}

/**
 * Register every adapter-owned catalog this plugin reads.
 *
 * The READ itself lives in `adapterCatalog.ts` — it is the one part of this
 * wiring with a decision in it that a machine can settle (what an adapter that
 * has not finished mounting is allowed to look like), and the unit gate drives it
 * there. This only joins that reader to the store, once per activation.
 * @param ctx - client root context.
 * @param capabilities - the store every seat shares.
 */
function registerAdapterCatalogs(ctx: ClientContext, capabilities: CapabilityStore): void {
  for (const catalog of ADAPTER_CATALOGS) {
    capabilities.addSource({
      providers: catalog.providers,
      // The namespace is resolved per READ, not captured here: the Remote
      // namespaces mount asynchronously, so a capture at activation would make
      // the facts depend on plugin activation order.
      read: () => readCatalog(ctx, catalog.namespace),
    })
  }
}

/**
 * Client plugin body: register copy and styles, then claim the model seat over
 * the shared directory.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const locale = ctx.get('locale')
  const translate = locale === undefined ? localTranslate() : locale.bind(NS)
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, dictionaries), 'dsh-rabbit-model-picker: dictionaries')
  }
  ctx.effect(() => injectStyles(), 'dsh-rabbit-model-picker: styles')
  // The provider scope is no longer remembered (§5.26); the keys older builds
  // wrote would otherwise sit in the store forever, unread and unexplained. The
  // sweep belongs to ACTIVATION rather than to a seat's mount: it is a data
  // migration, it is idempotent, and a session that never opens the card should
  // still not carry the dead entries.
  ctx.effect(() => retireStoredScope(), 'dsh-rabbit-model-picker: retired scope record')

  // One adapter-catalog reader for the whole plugin, shared by every seat. The
  // LLM face is resolved lazily (see `CapabilityStore`) while each adapter's own
  // catalog is looked up per read, so neither depends on activation order.
  const capabilities = new CapabilityStore(
    () => (ctx.get('remote.llm') as RemoteLlmFace | undefined) ?? null,
  )
  registerAdapterCatalogs(ctx, capabilities)

  ctx.inject(['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'], (scope) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions
    // One settings reader for the whole plugin: every seat renders from the same
    // snapshots, and a write made in one composer is what the other one shows.
    const params = new ParamsStore(settingsFaceOf(scope))
    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      // Ascending rank, lowest renders: -10 shadows the shipped seat at 0.
      priority: -10,
      // Declaring the namespace puts the framework `t` seat on the component;
      // without a locale face the inject face carries the local translator.
      ...(locale === undefined ? {} : { locale: NS }),
      inject: (sessionId: string) => {
        const directory = models.directoryFor(sessionId)
        const available = sessions.subagentAddress(sessionId) === undefined
        return {
          available,
          sessionId,
          directory: directory.store,
          params,
          capabilities,
          translate,
          load: () => {
            if (available) directory.load().catch(() => { /* surfaced on the store */ })
          },
          select: (selection: Parameters<typeof directory.select>[0]) => available
            ? directory.select(selection)
            : Promise.resolve(undefined),
        }
      },
    }, Picker))
  })
}
