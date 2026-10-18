/**
 * Browser half. Occupies the composer's `conversation.input.model` seat and reads the
 * SAME per-session directory `ui-model-selection` gives the `/model` popup — that shared
 * instance is what makes the two entries one state, with no synchronisation here.
 *
 * Shadowing, not replacing: `priority: -10` renders below the shipped seat at 0, so the
 * shipped registration and its `/model` contribution survive untouched.
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
 * `remote` / `remote.session` are required, not decoration: `ModelDirectoryResolver`
 * methods run behind Cordis's caller-context tracker, so `directoryFor()` reads
 * `this.ctx.remote.session` against the CALLER's fiber. Omitting them throws out of the
 * slot's inject face, the entry abdicates, and the shipped seat silently resumes.
 */
export const inject = ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'] as const

/**
 * A FUNCTION returning the faces, not the faces: the Remote namespaces are mounted by
 * their owners when those owners activate, so they may legitimately be "not yet" here.
 * Asked once and kept, that ordering would be reported to the user as "this deployment
 * mounts no settings service" for the rest of the page. Read with `ctx.get` and
 * deliberately NOT added to {@link inject}: a missing injectable would make the whole
 * seat abdicate, while a deployment without settings still deserves the picker.
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

function registerAdapterCatalogs(ctx: ClientContext, capabilities: CapabilityStore): void {
  for (const catalog of ADAPTER_CATALOGS) {
    capabilities.addSource({
      providers: catalog.providers,
      // Resolved per READ, not captured: the Remote namespaces mount asynchronously, so
      // a capture at activation would make the facts depend on plugin activation order.
      read: () => readCatalog(ctx, catalog.namespace),
    })
  }
}

/**
 * Deliberately NOT `models`. `settings.section` cells are keyed BY ID, so a new id is
 * additive and the two pages coexist by construction; reusing `models` with a lower
 * priority would SHADOW the shipped page instead.
 */
const MODEL_CONFIG_SECTION_ID = 'rabbit-model-config'

/**
 * Resolved per call for the same ordering reason as {@link settingsFaceOf}. Only the two
 * reads the page cannot work without make it unavailable; a deployment that mounts no
 * credentials or no session still gets a working page.
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

export function apply(ctx: ClientContext): void {
  const locale = ctx.get('locale')
  const translate = locale === undefined ? localTranslate() : locale.bind(NS)
  // ONE registration carrying BOTH dictionaries: `dictionary.ts` and `modelConfigCopy.ts`
  // share this namespace by design (one plugin, one namespace), and the host locale service
  // THROWS on a second registration of the same (namespace, locale) pair — a namespace's
  // texts have a single owner. Their key sets are disjoint by prefix.
  const allDictionaries: Record<string, Record<string, string>> = {
    zh: { ...dictionaries.zh, ...modelConfigDictionaries.zh },
    en: { ...dictionaries.en, ...modelConfigDictionaries.en },
  }
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, allDictionaries), 'dsh-rabbit-model-picker: dictionaries')
  }
  ctx.effect(() => injectDesignSystem(), 'dsh-rabbit-model-picker: design system')
  ctx.effect(() => injectStyles(), 'dsh-rabbit-model-picker: styles')
  // Nothing registers the shipped `settings.models.provider-card` seat any more: a keyed
  // seat can only ever name one adapter family, and the retry policy is edited inside this
  // plugin's own tab, where every provider already has a row. The official page therefore
  // renders exactly as it did before this plugin was installed.

  // The provider scope is no longer persisted, so the keys older builds wrote would sit
  // in the store forever. The sweep belongs to ACTIVATION rather than to a seat's mount:
  // it is a data migration, it is idempotent, and a session that never opens the card
  // should still not carry the dead entries.
  ctx.effect(() => retireStoredScope(), 'dsh-rabbit-model-picker: retired scope record')

  const capabilities = new CapabilityStore(
    () => (ctx.get('remote.llm') as RemoteLlmFace | undefined) ?? null,
  )
  registerAdapterCatalogs(ctx, capabilities)

  ctx.inject(['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'], (scope) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions
    const params = new ParamsStore(settingsFaceOf(scope))
    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      // Ascending rank, lowest renders: -10 shadows the shipped seat at 0.
      priority: -10,
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
            // Swallowed here because the store surfaces the failure to the seat.
            if (available) directory.load().catch(() => {})
          },
          select: (selection: Parameters<typeof directory.select>[0]) => available
            ? directory.select(selection)
            : Promise.resolve(undefined),
        }
      },
    }, Picker))
  })

  // A settings surface alongside the shipped Models page that NEVER shadows it. There is
  // deliberately NO `priority` here: priority IS the shadowing rank, so declaring one
  // would be the single change that turns this page into a replacement.
  const modelConfig = new ModelConfigStore(() => modelConfigFacesOf(ctx))
  const configT = configTranslate(locale === undefined ? undefined : translate)

  // Registered here, at plugin activation, so these invalidation subscriptions live as long
  // as the plugin does: a settings or connection event re-reads even while the settings
  // panel is closed.
  ctx.effect(() => modelConfig.start(), 'dsh-rabbit-model-picker: model config invalidation')

  ctx.inject(['slots'], (scope) => {
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section',
      id: MODEL_CONFIG_SECTION_ID,
      // Immediately after the shipped 模型 page, which registers at order 10.
      order: 11,
      // A thunk, not a string: the shell re-reads it on every locale revision, so the nav
      // row follows a language change without re-registering.
      label: () => configT(MODEL_CONFIG_KEYS['config.nav']),
      inject: () => ({ store: modelConfig, t: configT }),
    }, ModelConfigPage))
  })
}
