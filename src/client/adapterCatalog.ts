import type { ClientContext, DiscoveredModel, RemoteCatalogFace } from './contract.ts'

export interface AdapterCatalog {
  readonly providers: readonly string[]
  readonly namespace: string
}

export const ADAPTER_CATALOGS: readonly AdapterCatalog[] = [
  { providers: ['dsh-opencode-go'], namespace: 'opencodeGoModels' },
]

export async function readCatalog(
  ctx: Pick<ClientContext, 'get'>, namespace: string,
): Promise<readonly DiscoveredModel[]> {
  const face = ctx.get(`remote.${namespace}`) as RemoteCatalogFace | undefined
  if (typeof face?.read !== 'function') {
    throw new Error(`the ${namespace} remote is not mounted`)
  }
  const result = await face.read()
  if (!result.ok) return []
  const models = result.value?.models
  return Array.isArray(models) ? models : []
}
