/**
 * The adapter-owned catalogs this plugin reads, and how one of them is read.
 *
 * WHY THIS IS ITS OWN MODULE. It is the second — and for some adapters the only
 * — way to the facts a row states, and it is the one part of the wiring with a
 * decision in it that a machine can settle: what an adapter that has not
 * finished mounting is allowed to look like. Kept beside the seat registration
 * it could only be asserted by reading the source; on its own it is bundled by
 * `scripts/test-params.mjs` and driven against a fake client context.
 *
 * `dsh-opencode-go` is the reason the table exists rather than a generic sweep
 * of `llm/discoverModels`: it never registers a configurable provider (verified
 * in its `lib/index.js`, which calls no `registerConfigurableProviders`), so its
 * route is absent from every settings directory, `resolveRoute` can never
 * address it, and its own `opencodeGoModels/read` — the catalog it publishes
 * over Remote — is the only way to the facts. The route id is the adapter's own
 * `PROVIDER_ID` (`lib/provider-identity.ts`), pinned here because an out-of-repo
 * client plugin cannot value-import the package it is naming.
 *
 * @module dsh-rabbit-model-picker/client/adapterCatalog
 */

import type { ClientContext, DiscoveredModel, RemoteCatalogFace } from './contract.ts'

/** One adapter-owned catalog, and the provider routes it answers for. */
export interface AdapterCatalog {
  readonly providers: readonly string[]
  readonly namespace: string
}

/** The adapter-owned catalogs this plugin reads. */
export const ADAPTER_CATALOGS: readonly AdapterCatalog[] = [
  { providers: ['dsh-opencode-go'], namespace: 'opencodeGoModels' },
]

/**
 * Read one adapter-owned catalog, or report that it published nothing.
 *
 * The namespace is looked up on every read rather than captured at activation:
 * the Remote namespaces mount asynchronously, so a capture at activation would
 * depend on plugin activation order.
 *
 * NOT MOUNTED YET IS NOT "PUBLISHED NOTHING". Those are two different answers
 * and the capability store consumes them differently: an empty list is an ANSWER
 * that is never asked again, while a THROW is released for a later open to
 * retry. Returning `[]` for an absent namespace collapsed the two, so an adapter
 * whose Remote was still mounting when the card first opened had its one ask
 * consumed — no facts for the rest of the page, out of a race the store, the
 * README and DESIGN §5.19 all promise is absorbed. An adapter that is genuinely
 * not installed lands in the same branch and pays one retried ask per open for a
 * route it will never answer, which is the cheap half of the trade: the retry is
 * a property lookup, and the store stops asking the moment it gets an answer.
 * @param ctx - client root context.
 * @param namespace - the adapter's Remote namespace name.
 * @returns the models that adapter published, or an empty list when it published
 *   none.
 * @throws when the namespace is not mounted yet, so the ask stays retryable.
 */
export async function readCatalog(
  ctx: Pick<ClientContext, 'get'>, namespace: string,
): Promise<readonly DiscoveredModel[]> {
  const face = ctx.get(`remote.${namespace}`) as RemoteCatalogFace | undefined
  if (typeof face?.read !== 'function') {
    throw new Error(`the ${namespace} remote is not mounted`)
  }
  const result = await face.read()
  // A refusal the adapter itself answered with IS an answer: this catalog is
  // unreadable for this page, and re-asking would only repeat the refusal.
  if (!result.ok) return []
  const models = result.value?.models
  return Array.isArray(models) ? models : []
}
