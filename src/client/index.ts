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
  ClientContext, RemoteCredentialsFace, RemoteFace, RemoteLlmFace, RemoteSessionFace,
  RemoteSettingsFace,
} from './contract.ts'
import { ADAPTER_CATALOGS, readCatalog } from './adapterCatalog.ts'
import { CapabilityStore } from './capabilities.ts'
import { dictionaries, localTranslate, NS } from './dictionary.ts'
import { ModelConfigPage } from './ModelConfigPage.tsx'
import {
  configTranslate, dictionaries as modelConfigDictionaries, KEYS as MODEL_CONFIG_KEYS,
} from './modelConfigCopy.ts'
import { ModelConfigStore, type ModelConfigFaces } from './modelConfigStore.ts'
import { ParamsStore } from './params.ts'
import { Picker } from './Picker.tsx'
import { retireStoredScope } from './retiredScope.ts'
import { injectDesignSystem } from './designSystem.ts'
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
 * The settings section id this plugin owns.
 *
 * Deliberately NOT `models`. `settings.section` is a `list` slot whose cells are
 * keyed BY ID, so a new id is additive and two sections coexist by construction;
 * reusing `models` with a lower priority would SHADOW the shipped page instead.
 * ADR 0003 settled that question in favour of coexistence, so this constant is
 * the one value that decision rests on — and `scripts/selfcheck-static.mjs`
 * asserts it never becomes `models`.
 */
const MODEL_CONFIG_SECTION_ID = 'rabbit-model-config'

/**
 * Resolve the Host faces the 模型配置 page reads, per call.
 *
 * Resolved per call rather than captured, because the Remote namespaces mount
 * asynchronously and a capture at activation can legitimately be "not yet" — the
 * same ordering hazard the composer seat documents. Only the two reads the page
 * cannot work without make it unavailable; a deployment that mounts no
 * credentials or no session still gets a working page.
 * @param ctx - the client scope the section is registered on.
 * @returns the faces, or null when the page could not function at all.
 */
function modelConfigFacesOf(ctx: ClientContext): ModelConfigFaces | null {
  const settings = ctx.get('remote.settings') as RemoteSettingsFace | undefined
  const llm = ctx.get('remote.llm') as RemoteLlmFace | undefined
  if (typeof settings?.describe !== 'function' || typeof settings.mutate !== 'function') return null
  if (typeof llm?.listConfigurableProviders !== 'function') return null
  const credentials = ctx.get('remote.credentials') as RemoteCredentialsFace | undefined
  const session = ctx.get('remote.session') as RemoteSessionFace | undefined
  const remote = ctx.get('remote') as
    | { $on?: (event: string, listener: () => void) => () => void }
    | undefined
  return {
    settings,
    llm,
    ...credentials === undefined ? {} : { credentials },
    ...session === undefined ? {} : { session },
    ...typeof remote?.$on !== 'function'
      ? {}
      : { on: (event: string, listener: () => void) => remote.$on!(event, listener) },
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
  // One registration carrying BOTH dictionaries. `dictionary.ts` and
  // `modelConfigCopy.ts` share this namespace by design (one plugin, one
  // namespace), and registering twice would make the second call's dictionary the
  // only visible one on a locale service that replaces rather than merges. Their
  // key sets are disjoint by prefix (`config.` vs the seat's own), so folding
  // them here is safe and keeps the outcome independent of that service's
  // semantics.
  const allDictionaries: Record<string, Record<string, string>> = {
    zh: { ...dictionaries.zh, ...modelConfigDictionaries.zh },
    en: { ...dictionaries.en, ...modelConfigDictionaries.en },
  }
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, allDictionaries), 'dsh-rabbit-model-picker: dictionaries')
  }
  // The design language's token layer and embedded Latin face go first: every
  // sheet below reads `var(--zmd-*)`, and the face must be registered before the
  // first paint of a seat (a late @font-face would flash the host font).
  ctx.effect(() => injectDesignSystem(), 'dsh-rabbit-model-picker: design system')
  ctx.effect(() => injectStyles(), 'dsh-rabbit-model-picker: styles')
  // The retry policy used to be a card registered into the shipped Models
  // section's `settings.models.provider-card` seat. It moved INTO this plugin's
  // own 模型配置 tab (the section registered at the bottom of this file), where
  // every provider already has a row: a keyed seat could only ever name one
  // adapter family, and the policy was being edited inside someone else's page.
  // Nothing registers that seat any more, so the official page renders exactly as
  // it did before this plugin was installed.

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

  // --- the 模型配置 tab -------------------------------------------------------
  // A second settings surface alongside the shipped Models page, and one that
  // NEVER shadows it (ADR 0003). A new section id makes the two different `list`
  // cells, so they coexist by construction; and there is deliberately NO
  // `priority`, because priority IS the shadowing rank — declaring one would be
  // the single change that turns this page into a replacement of the shipped one.
  // Removing this plugin's row therefore restores the shipped page untouched.
  //
  // NO SCHEMA SERVICE IS CONSUMED HERE, and that is a deliberate simplification
  // rather than an omission. Reaching the host's `settingsSchema` cost a scoped
  // `inject` plus a service binding, and the route it bought never produced the
  // choices: it yielded a union whose members were lazy callables, so both readers
  // came up empty with no error. The namespace view this plugin already receives
  // carries the serialized schema in full, so the choices are walked straight out
  // of it — one less service to resolve, and one less silent failure mode.
  const modelConfig = new ModelConfigStore(() => modelConfigFacesOf(ctx))
  const configT = configTranslate(locale === undefined ? undefined : translate)

  // Live only while the page is mounted: `start`'s disposer is what keeps a CLOSED
  // settings panel from being woken into a background fetch by another writer.
  ctx.effect(() => modelConfig.start(), 'dsh-rabbit-model-picker: model config invalidation')

  ctx.inject(['slots'], (scope) => {
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section',
      id: MODEL_CONFIG_SECTION_ID,
      // Immediately after the shipped 模型 page, which registers at order 10.
      order: 11,
      // A thunk, not a string: the shell re-reads it on every locale revision, so
      // the nav row follows a language change without re-registering.
      label: () => configT(MODEL_CONFIG_KEYS['config.nav']),
      inject: () => ({ store: modelConfig, t: configT }),
    }, ModelConfigPage))
  })
}
