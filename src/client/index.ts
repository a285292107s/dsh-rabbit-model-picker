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
  ClientContext, DiscoveredModel, RemoteCatalogFace, RemoteFace, RemoteLlmFace, RemoteSettingsFace,
} from './contract.ts'
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
 * @param scope - the injected client scope.
 * @returns both faces, or null when either is not mounted.
 */
function settingsFaceOf(scope: ClientContext): RemoteFace | null {
  const settings = scope.get('remote.settings') as RemoteSettingsFace | undefined
  const llm = scope.get('remote.llm') as RemoteLlmFace | undefined
  if (typeof settings?.describe !== 'function' || typeof settings.mutate !== 'function') return null
  if (typeof llm?.listConfigurableProviders !== 'function') return null
  return { settings, llm }
}

/**
 * Adapter-owned catalogs this plugin reads, and the route each one serves.
 *
 * `dsh-opencode-go` is the reason this table exists rather than a generic sweep
 * of `llm/discoverModels`: it never registers a configurable provider (verified
 * in its `lib/index.js`, which calls no `registerConfigurableProviders`), so its
 * route is absent from every settings directory, `resolveRoute` can never
 * address it, and its own `opencodeGoModels/read` — the catalog it publishes
 * over Remote — is the only way to the facts. The route id is the adapter's own
 * `PROVIDER_ID` (`lib/provider-identity.ts`), pinned here because an out-of-repo
 * client plugin cannot value-import the package it is naming.
 */
const ADAPTER_CATALOGS: readonly { readonly providers: readonly string[], readonly namespace: string }[] = [
  { providers: ['dsh-opencode-go'], namespace: 'opencodeGoModels' },
]

/**
 * Read one adapter-owned catalog, or report that it published nothing.
 *
 * The namespace is looked up on every read rather than captured at activation:
 * the Remote namespaces mount asynchronously, so a capture at activation would
 * depend on plugin activation order. A namespace that is not mounted at all —
 * the adapter is not installed — yields an empty list, which is exactly "nothing
 * published" and leaves every route unstated.
 * @param ctx - client root context.
 * @param namespace - the adapter's Remote namespace name.
 * @returns the models that adapter published, or an empty list.
 */
async function readCatalog(ctx: ClientContext, namespace: string): Promise<readonly DiscoveredModel[]> {
  const face = ctx.get(`remote.${namespace}`) as RemoteCatalogFace | undefined
  if (typeof face?.read !== 'function') return []
  const result = await face.read()
  if (!result.ok) return []
  const models = result.value?.models
  return Array.isArray(models) ? models : []
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
  for (const catalog of ADAPTER_CATALOGS) {
    capabilities.addSource({
      providers: catalog.providers,
      read: () => readCatalog(ctx, catalog.namespace),
    })
  }

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
