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

export const inject = ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'] as const

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
      read: () => readCatalog(ctx, catalog.namespace),
    })
  }
}

const MODEL_CONFIG_SECTION_ID = 'rabbit-model-config'

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
  const allDictionaries: Record<string, Record<string, string>> = {
    zh: { ...dictionaries.zh, ...modelConfigDictionaries.zh },
    en: { ...dictionaries.en, ...modelConfigDictionaries.en },
  }
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, allDictionaries), 'dsh-rabbit-model-picker: dictionaries')
  }
  ctx.effect(() => injectDesignSystem(), 'dsh-rabbit-model-picker: design system')
  ctx.effect(() => injectStyles(), 'dsh-rabbit-model-picker: styles')

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
            if (available) directory.load().catch(() => {})
          },
          select: (selection: Parameters<typeof directory.select>[0]) => available
            ? directory.select(selection)
            : Promise.resolve(undefined),
        }
      },
    }, Picker))
  })

  const modelConfig = new ModelConfigStore(() => modelConfigFacesOf(ctx))
  const configT = configTranslate(locale === undefined ? undefined : translate)

  ctx.effect(() => modelConfig.start(), 'dsh-rabbit-model-picker: model config invalidation')

  ctx.inject(['slots'], (scope) => {
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section',
      id: MODEL_CONFIG_SECTION_ID,
      order: 11,
      label: () => configT(MODEL_CONFIG_KEYS['config.nav']),
      inject: () => ({ store: modelConfig, t: configT }),
    }, ModelConfigPage))
  })
}
