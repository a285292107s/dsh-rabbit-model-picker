
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
    // Not mounted yet is NOT "published nothing": an empty list would be an answer the
    // caller never re-asks, while this throw releases the ask to be retried on the next
    // open — Remote namespaces mount asynchronously, so absent can mean "not yet".
    throw new Error(`the ${namespace} remote is not mounted`)
  }
  const result = await face.read()
  if (!result.ok) return []
  const models = result.value?.models
  return Array.isArray(models) ? models : []
}
