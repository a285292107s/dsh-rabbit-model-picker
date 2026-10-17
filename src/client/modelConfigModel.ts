/**
 * 模型配置页的纯逻辑：目录如何 join、密钥引用如何推导、一行是否可用、
 * 以及一次编辑该写成哪些 path op。
 *
 * WHY THIS IS A SEPARATE, PURE MODULE. Every function here mirrors a decision the
 * official Models page already made (see `docs/official-models-page-notes.md` and
 * `docs/settings-models-tab-feasibility.md` §7 for the evidence), and each one is
 * the kind of decision a machine can settle on its own: does a dormant provider
 * get a row, which reference a typed key stores under, whether a row can serve
 * requests, and which ops a two-field edit produces. None of it needs React or
 * the wire, so all of it is driven by `scripts/test-model-config.mjs` instead of
 * being discovered by clicking around a settings panel.
 *
 * THE OFFICIAL IMPLEMENTATION IS NOT IMPORTABLE (`dsh-client-ui-settings-models`
 * exports no `./lib/*`), so these are independent re-derivations. Where the
 * arithmetic matters — the key reference, the op diff — the test gate pins it
 * against samples taken from the official source, so a drift shows up there
 * rather than on the user's next write.
 *
 * @module dsh-rabbit-model-picker/client/modelConfigModel
 */

import type {
  ConfigurableProvider, LlmProviderInfo, ModelCatalogEntry, ModelConfigRow,
  ProviderDirectoryEntry, SettingsNamespaceView, SettingsOp,
} from './contract.ts'

/** The two route ids the official page sorts to the top of the directory. */
export const ACCOUNT_ROUTE = 'deepseek-account'
const OFFICIAL_ROUTE = 'deepseek-official'

/* The `'\u0000probe'` sentinel route this reader used to carry is GONE. It existed
   only to walk `providers.<some key>.api` through `nodeAtPath`; the envelope walk
   now reaches the profile shape directly through the dict's `inner`, so no route
   key is needed at all. Keeping it would have been a constant that no longer
   explains anything. */

/**
 * Whether a value is a plain record (not an array, not null).
 * @param value - the value to test.
 * @returns whether it can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Join declared configurable providers with the currently registered routes.
 *
 * EVERY configurable provider gets a row, whether or not its route is live: a
 * provider that exists in an adapter's catalog but is registered by nobody is
 * the dormant state, and it still needs a row so the user can add it. This is
 * why "休眠提供商" is not the same as "no row" (`CONTEXT.md`).
 *
 * Routes that are live but absent from the configurable directory are appended
 * with no settings address: a deployment can serve a route it does not offer for
 * configuration, and dropping it would make the page disagree with the picker.
 *
 * The parameter is the DIRECTORY shape, which is why it carries no `active`: the
 * configurable directory declares which routes CAN be configured, and liveness is
 * the other input. Supplying it here is exactly what this function adds.
 * @param registered - live provider routes, in registration order.
 * @param directory - declared configurable providers, in declaration order.
 * @returns account first, then official, then everything else in input order.
 */
export function joinProviderDirectory(
  registered: readonly LlmProviderInfo[],
  directory: readonly ConfigurableProvider[],
): readonly ProviderDirectoryEntry[] {
  const active = new Set(registered.map(provider => provider.id))
  const declared = new Set(directory.map(entry => entry.provider))

  const rows: ProviderDirectoryEntry[] = directory.map(entry => ({
    provider: entry.provider,
    displayName: entry.displayName,
    settingsNs: entry.settingsNs,
    settingsPath: [...entry.settingsPath],
    active: active.has(entry.provider),
    ...entry.declared === undefined ? {} : { declared: entry.declared },
    ...entry.defaultBaseURL === undefined ? {} : { defaultBaseURL: entry.defaultBaseURL },
    ...entry.baseURLEnv === undefined ? {} : { baseURLEnv: entry.baseURLEnv },
    ...entry.error === undefined ? {} : { error: entry.error },
  }))

  for (const provider of registered) {
    if (declared.has(provider.id)) continue
    rows.push({
      provider: provider.id,
      displayName: provider.name,
      settingsNs: '',
      settingsPath: [],
      active: true,
    })
  }

  /** The official sort rank: the two first-party routes lead, everything else follows. */
  const rank = (provider: string): number =>
    provider === ACCOUNT_ROUTE ? 0 : provider === OFFICIAL_ROUTE ? 1 : 2

  return [...rows].sort((left, right) => rank(left.provider) - rank(right.provider))
}

/**
 * Derive the conventional credential reference for a provider route.
 *
 * The page never asks for an environment-variable name: a typed key stores under
 * this derived reference and the profile records it as `apiKeyEnv`. Mirrors the
 * official rule exactly — uppercase, then every run of non-alphanumerics
 * becomes one underscore.
 * @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
 * @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
 */
export function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/**
 * The credential reference a resolved profile names, when it names one.
 *
 * A profile with no usable `apiKeyEnv` is the case the derived reference exists
 * for, so this returning undefined is normal rather than an error.
 * @param value - the namespace's effective value.
 * @param settingsPath - path of this provider's profile inside that value.
 * @returns the named reference, or undefined.
 */
export function apiKeyEnvOf(value: unknown, settingsPath: readonly string[]): string | undefined {
  const profile = readPath(value, settingsPath)
  if (!isRecord(profile)) return undefined
  const ref = profile.apiKeyEnv
  return typeof ref === 'string' && ref.length > 0 ? ref : undefined
}

/**
 * The reference this row's key would be stored under, named or derived.
 * @param row - one joined row.
 * @returns the reference name.
 */
export function keyRefOf(row: ModelConfigRow): string {
  return row.apiKeyEnv ?? deriveKeyRef(row.entry.provider)
}

/**
 * Whether this row can already serve model requests.
 *
 * THREE WAYS TO OWE NOTHING, and each one is a real deployment: a route that is
 * not registered cannot serve anything; the account route authenticates through
 * the user's session rather than a key; and a profile naming NO reference
 * authenticates through the provider's own path (a gateway needing nothing), so
 * it owes no key even though it has no credential. Only a profile that names a
 * reference is judged by that reference's state.
 * @param row - one joined row.
 * @returns whether the user already has this provider to talk to.
 */
export function providerUsable(row: ModelConfigRow): boolean {
  if (!row.entry.active) return false
  if (row.entry.provider === ACCOUNT_ROUTE) return row.accountAvailable === true
  if (row.apiKeyEnv === undefined) return true
  return row.credential?.configured === true
}

/**
 * Whether this row's credential is confirmed present.
 *
 * When the profile names a reference, that reference decides; otherwise the page
 * derives one, which is what keeps a dormant row's badge consistent with what
 * the editor would write.
 * @param row - one joined row.
 * @returns whether a key is stored.
 */
export function keyConfigured(row: ModelConfigRow): boolean {
  return row.apiKeyEnv !== undefined
    ? row.credential?.configured === true
    : row.derivedCredential?.configured === true
}

/**
 * Whether this row's credential is writable by the active provider.
 *
 * A read-only deployment can still SHOW that a key exists while refusing to
 * change it, so the two facts are separate and the row needs both: the badge
 * reads configured, and the controls read disabled.
 * @param row - one joined row.
 * @returns whether a replace would be accepted.
 */
export function keyWritable(row: ModelConfigRow): boolean {
  const info = row.apiKeyEnv !== undefined ? row.credential : row.derivedCredential
  return info?.writable === true
}

/**
 * Whether this row's profile lives only in the user layer.
 *
 * Removal restores the base, so a profile the user did not author is not theirs
 * to delete — the official page draws the same line (`removable`).
 *
 * An EMPTY path is refused outright: it addresses the namespace root rather than
 * one provider's profile, so "removing" it would unset the entire namespace,
 * which is not a provider operation at all. The official page carries the same
 * guard (`entry.settingsPath.length > 0`).
 * @param namespace - the namespace view carrying the base and user layers.
 * @param settingsPath - path of this provider's profile.
 * @returns whether the user layer alone carries it.
 */
export function isRemovable(
  namespace: SettingsNamespaceView | undefined,
  settingsPath: readonly string[],
): boolean {
  if (namespace === undefined) return false
  if (settingsPath.length === 0) return false
  const inUser = hasPath(namespace.user, settingsPath)
  const inBase = hasPath(namespace.base, settingsPath)
  return inUser && !inBase
}

/**
 * Whether a provider has actually been ADDED, which is what the page lists.
 *
 * NOT the same question as "is it configured", and the difference is the whole
 * reason this is its own function. The directory hands every provider an adapter
 * could serve a row, so `configured: false` covers both "the user has not added
 * this yet" and "this is a live route that needs no profile at all". The page
 * lists what the user HAS: a route with no settings address owes no profile and
 * is already theirs (the account route, and any live route the configurable
 * directory does not declare), while a catalog entry with an address and no
 * profile is offered through the add entry instead of being listed.
 * @param configured - whether the profile resolves in any layer.
 * @param settingsPath - path of this provider's profile; empty means "no address to configure".
 * @returns whether the page should list this provider.
 */
export function isAdded(configured: boolean, settingsPath: readonly string[]): boolean {
  return configured || settingsPath.length === 0
}

/**
 * Read a nested value by a string-key or array-index path.
 *
 * A missing or mistyped step is an ordinary state — a provider that declares
 * nothing, a namespace still loading — never an error: every caller wants
 * undefined there, not a throw.
 * @param value - the value to traverse.
 * @param path - object keys or array indices.
 * @returns the resolved value, or undefined when the path is absent.
 */
export function readPath(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value
  for (const step of path) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(step, 10)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
      continue
    }
    if (!isRecord(current)) return undefined
    if (!(step in current)) return undefined
    current = current[step]
  }
  return current
}

/**
 * Whether the final path key exists, independently of its value.
 *
 * Distinct from {@link readPath} for the case an explicitly-null field creates:
 * the key EXISTS (so "the user set this" is true) while its value reads as
 * `null`. For "is this the user's to remove" that difference decides whether a
 * control appears, which is why presence is asked as its own question rather
 * than by testing the read value.
 * @param value - the value to traverse.
 * @param path - object keys or array indices.
 * @returns whether the path exists.
 */
export function hasPath(value: unknown, path: readonly string[]): boolean {
  if (path.length === 0) return value !== undefined
  const parent = readPath(value, path.slice(0, -1))
  const last = path[path.length - 1]
  if (last === undefined) return false
  if (Array.isArray(parent)) {
    const index = Number.parseInt(last, 10)
    return Number.isInteger(index) && index >= 0 && index < parent.length
  }
  if (!isRecord(parent)) return false
  return last in parent
}

/**
 * The path ops one committed edit produces.
 *
 * ONLY THE FIELDS THAT MOVED, for two reasons that both bite if ignored: a
 * wholesale replace rebuilt from a redacted view would delete fields this page
 * cannot see, and a no-op write would still bump the revision and so manufacture
 * the very conflicts the fence exists to catch.
 *
 * A field whose value is unchanged produces no op. Comparison is by JSON shape,
 * which is the official rule: it is the same test the wire's own round trip
 * satisfies, and it is deliberately not reference identity, so a rebuilt draft
 * with equal contents writes nothing.
 * @param base - path of the edited subtree inside the user section.
 * @param before - the subtree as loaded, or undefined when it is new.
 * @param after - the subtree as edited.
 * @returns ordered set/unset ops; empty when nothing changed.
 */
export function pathOps(
  base: readonly string[],
  before: unknown,
  after: Record<string, unknown>,
): readonly SettingsOp[] {
  const previous = isRecord(before) ? before : {}
  const ops: SettingsOp[] = []

  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue
    ops.push({ op: 'set', path: [...base, key], value })
  }
  for (const key of Object.keys(previous)) {
    if (!(key in after)) ops.push({ op: 'unset', path: [...base, key] })
  }
  return ops
}

/**
 * The wire protocols a hand-declared route may name.
 *
 * READ OUT OF THE OWNING NAMESPACE'S SCHEMA, never hardcoded: the choices the
 * page offers and the values the adapter accepts then come from the same
 * declaration, so they cannot drift apart in a release that adds a protocol.
 * @param namespace - the namespace view whose schema declares the profile shape.
 * @returns the protocol identifiers, or an empty list when the schema has none.
 */
export function protocolChoices(
  namespace: SettingsNamespaceView | undefined,
): readonly string[] {
  const refs = schemaRefsOf(namespace)
  if (refs === undefined) return []
  const profile = profileNodeOf(refs, namespace)
  if (profile === undefined) return []
  const api = stepDict(refs, profile, 'api')
  return unionMembers(refs, api)
    .map(member => member.value)
    .filter((value): value is string => typeof value === 'string')
}

/**
 * The reasoning levels a hand-declared route's models may declare.
 *
 * Same reasoning as {@link protocolChoices}, and the same walk: the levels the
 * page offers and the keys the adapter accepts in `reasoningEfforts` must come
 * from one declaration.
 * @param namespace - the namespace view whose schema declares the profile shape.
 * @returns the levels in the schema's escalation order, or an empty list.
 */
export function reasoningLevelChoices(
  namespace: SettingsNamespaceView | undefined,
): readonly string[] {
  const refs = schemaRefsOf(namespace)
  if (refs === undefined) return []
  const profile = profileNodeOf(refs, namespace)
  if (profile === undefined) return []
  const models = stepDict(refs, profile, 'models')
  if (models === undefined) return []
  // An ARRAY's value shape is also under `inner` — here it is the element shape,
  // which is the model object carrying `reasoningEfforts`.
  const modelShape = valueShapeOf(refs, models)
  if (modelShape === undefined) return []
  const efforts = stepDict(refs, modelShape, 'reasoningEfforts')
  // `reasoningEfforts` is a UNION whose non-off branch is the dict of levels, so
  // the dict must be found among the dereferenced members — matching on the raw
  // list is the trap this reader fell into twice.
  const levels = unionMembers(refs, efforts).find(member => member.type === 'dict')
  if (levels === undefined) return []
  const keyShape = deref(refs, levels.sKey)
  if (keyShape === undefined) return []
  const list = keyShape.list
  if (!Array.isArray(list)) return []
  return list
    .flatMap(id => {
      const member = deref(refs, id)
      return member === undefined ? [] : [member.value]
    })
    .filter((value): value is string => typeof value === 'string')
}

/**
 * Whether one provider's profile schema declares a retry policy.
 *
 * THE COVERAGE RULE FOR THE RETRY EDITOR, and it is a SCHEMA question rather than
 * a list of adapter names: `retryPolicy` is a per-provider configuration field
 * (`dsh-llm-pi-ai/lib/index.js:1080` inside the `providers` dict's value shape,
 * `dsh-llm-deepseek/lib/index.js:341` at that namespace's root), so a provider
 * that declares it can be edited and one that does not must not be offered a
 * control whose write the schema would reject. The old retry card could only name
 * one adapter family (`settings.models.provider-card` is a keyed seat), which left
 * the official DeepSeek route with no editor even though its schema has the field.
 *
 * FAIL CLOSED, like {@link protocolChoices} returning an empty list: a schema that
 * cannot be read, or a path that does not resolve, means "cannot tell" and is
 * reported as false. The cost of guessing wrong here is a write the Host refuses.
 *
 * The path is the row's own `settingsPath`, which is what makes both shapes work
 * with one function: `['providers', <route>]` walks the pi-ai dict down to the
 * profile, and `[]` (the official route, whose namespace root IS its profile)
 * walks nowhere at all.
 * @param namespace - the namespace view carrying the serialized schema.
 * @param settingsPath - this provider's path inside that namespace value.
 * @returns whether the profile shape declares `retryPolicy`.
 */
export function retryCapable(
  namespace: SettingsNamespaceView | undefined,
  settingsPath: readonly string[],
): boolean {
  const refs = schemaRefsOf(namespace)
  if (refs === undefined) return false
  const profile = schemaNodeAt(refs, namespace, settingsPath)
  if (profile === undefined) return false
  return stepDict(refs, profile, 'retryPolicy') !== undefined
}

/**
 * Walk a namespace schema down one settings path, to the node that shapes it.
 *
 * A STEP IS INTERPRETED BY THE NODE IT LANDS ON, which is the whole subtlety: a
 * `dict` (or array) node consumes its step as a KEY and continues in its value
 * shape (`inner`), while an object node consumes it as a FIELD (`dict[step]`).
 * `providers` is a dict, so `['providers', 'naizi']` reads as "the dict's value
 * shape" and then "the key `naizi`" — never as two object fields, which is the
 * misreading that returns `undefined` with no error anywhere.
 * @param refs - the envelope's node table.
 * @param namespace - the namespace view whose schema is walked.
 * @param path - the settings path to walk.
 * @returns the node shaping that path, or undefined when any step is absent.
 */
function schemaNodeAt(
  refs: unknown,
  namespace: SettingsNamespaceView | undefined,
  path: readonly string[],
): Record<string, unknown> | undefined {
  const schema = namespace?.schema
  if (!isRecord(schema)) return undefined
  let node = deref(refs, schema.uid)
  for (const step of path) {
    if (node === undefined) return undefined
    if (node.type === 'dict' || node.type === 'array') {
      node = valueShapeOf(refs, node)
      continue
    }
    node = stepDict(refs, node, step)
  }
  return node
}

/**
 * Dereference one ref id against an envelope's node table.
 *
 * Schemastery serializes a schema as `{ uid, refs }` — a table of nodes addressed
 * by NUMBER — and every structural field (`dict` values, `inner`, `sKey`, `list`
 * members) stores one of those numbers rather than a nested object. So a reader
 * that expects nested nodes finds `undefined` at every step and returns an empty
 * list with no error anywhere.
 *
 * THIS REPLACES A `rehydrate` + `nodeAtPath` ROUTE THAT NEVER WORKED HERE. That
 * route produced a union whose members were lazy callables carrying `type` on the
 * function object, so `.value` read as undefined for every member — and the guard
 * added to swallow a throwing callable turned a hard failure into exactly the
 * silent empty the investigation was chasing. Walking the envelope has neither
 * problem: it is plain data traversal with no callables and no throwing path.
 * @param refs - the envelope's node table.
 * @param id - the ref id to resolve.
 * @returns the node, or undefined when the id is absent or mistyped.
 */
function deref(refs: unknown, id: unknown): Record<string, unknown> | undefined {
  if (!isRecord(refs) && !Array.isArray(refs)) return undefined
  if (typeof id !== 'number' && typeof id !== 'string') return undefined
  const node = (refs as Record<string | number, unknown>)[id]
  return isRecord(node) ? node : undefined
}

/**
 * The node table of a namespace's serialized schema.
 * @param namespace - the namespace view.
 * @returns the `refs` table, or undefined when the envelope is absent or mistyped.
 */
function schemaRefsOf(namespace: SettingsNamespaceView | undefined): unknown {
  const schema = namespace?.schema
  return isRecord(schema) ? schema.refs : undefined
}

/**
 * One provider's profile shape inside a namespace schema.
 *
 * `providers` is a DICT, and a dict's VALUE shape lives under `inner` (its `sKey`
 * is the key shape) — so the profile is `refs[providers.inner]`. That single step
 * is why no route key is needed at all: the shape is reached directly rather than
 * through the official page's `'\0probe'` sentinel.
 * @param refs - the envelope's node table.
 * @param namespace - the namespace view whose schema is walked.
 * @returns the profile shape node, or undefined.
 */
function profileNodeOf(
  refs: unknown,
  namespace: SettingsNamespaceView | undefined,
): Record<string, unknown> | undefined {
  const schema = namespace?.schema
  if (!isRecord(schema)) return undefined
  const root = deref(refs, schema.uid)
  if (root === undefined) return undefined
  const providers = stepDict(refs, root, 'providers')
  if (providers === undefined) return undefined
  return valueShapeOf(refs, providers)
}

/**
 * Step through an object node's `dict` map by key, dereferencing the result.
 * @param refs - the envelope's node table.
 * @param node - the object node.
 * @param key - the schema field name.
 * @returns the field's node, or undefined.
 */
function stepDict(
  refs: unknown,
  node: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const dict = node.dict
  if (!isRecord(dict)) return undefined
  return deref(refs, dict[key])
}

/**
 * The value shape of a dict or array node.
 * @param refs - the envelope's node table.
 * @param node - the dict or array node.
 * @returns its `inner` node, or undefined.
 */
function valueShapeOf(
  refs: unknown,
  node: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return deref(refs, node.inner)
}

/**
 * The dereferenced members of a union node.
 * @param refs - the envelope's node table.
 * @param node - the union node, when one was reached.
 * @returns its member nodes, in declaration order; absent or mistyped ids drop out.
 */
function unionMembers(
  refs: unknown,
  node: Record<string, unknown> | undefined,
): readonly Record<string, unknown>[] {
  if (node === undefined || node.type !== 'union') return []
  const list = node.list
  if (!Array.isArray(list)) return []
  return list.flatMap(id => {
    const member = deref(refs, id)
    return member === undefined ? [] : [member]
  })
}

/**
 * The models array one provider profile carries, read defensively.
 *
 * A profile that declares no models inherits the adapter's catalog, which is a
 * real and common state — so an absent or mistyped `models` reads as an empty
 * list rather than as an error, and the page shows the inherited truth.
 * @param value - the namespace's effective value.
 * @param settingsPath - path of this provider's profile.
 * @returns the declared models, in stored order.
 */
export function modelsOf(value: unknown, settingsPath: readonly string[]): readonly ModelCatalogEntry[] {
  const profile = readPath(value, settingsPath)
  if (!isRecord(profile)) return []
  const models = profile.models
  if (!Array.isArray(models)) return []
  const entries: ModelCatalogEntry[] = []
  for (const raw of models) {
    if (!isRecord(raw)) continue
    const id = raw.id
    if (typeof id !== 'string' || id.length === 0) continue
    entries.push({
      id,
      ...typeof raw.name === 'string' ? { name: raw.name } : {},
      ...typeof raw.contextWindow === 'number' ? { contextWindow: raw.contextWindow } : {},
      ...typeof raw.maxTokens === 'number' ? { maxTokens: raw.maxTokens } : {},
      ...Array.isArray(raw.input)
        ? { input: raw.input.filter((item): item is string => typeof item === 'string') }
        : {},
    })
  }
  return entries
}

/**
 * Validate a models catalog before it is written.
 *
 * The one rule that is genuinely structural: ids must be present and unique.
 * Duplicates are reachable by hand-editing (two rows can be filled in with the
 * same id) and would silently collapse in the picker, so they are refused at the
 * point of writing rather than deduplicated behind the user's back.
 *
 * TRIMMED BEFORE BOTH TESTS, which is the official rule
 * (`dsh-client-ui-settings-models/lib/client.js:633-643`) and not a nicety: a
 * pasted id carrying a trailing space is the same model as its trimmed form, so
 * judging the raw string accepts a whitespace-only id and misses the duplicate a
 * paste just created. Either way the adapter then rejects it, or two rows fold
 * into one — after the user was told the draft was fine.
 * @param models - the draft catalog.
 * @returns the first failure as `{ index, reason }`, or undefined when valid.
 */
export function validateModels(
  models: readonly ModelCatalogEntry[],
): { readonly index: number; readonly reason: 'idEmpty' | 'idDuplicate' } | undefined {
  const seen = new Set<string>()
  for (const [index, model] of models.entries()) {
    const id = model.id.trim()
    if (id.length === 0) return { index, reason: 'idEmpty' }
    if (seen.has(id)) return { index, reason: 'idDuplicate' }
    seen.add(id)
  }
  return undefined
}

/**
 * The credential reference this row needs described, or undefined for none.
 *
 * A row is described through EXACTLY ONE reference, and which one is the whole
 * question: a profile that names `apiKeyEnv` has told the page which reference it
 * reads, so the derived name must NOT also be consulted — that would report a
 * key the provider never looks at. Only a row whose profile names none falls
 * back to `<ROUTE>_API_KEY`, which is also the reference the editor would write
 * on the user's first typed key. A route with no settings address owes neither.
 * @param row - one row.
 * @returns the reference to describe, or undefined.
 */
export function credentialRefFor(row: ModelConfigRow): string | undefined {
  if (row.apiKeyEnv !== undefined) return row.apiKeyEnv
  if (row.entry.settingsNs === '' && row.entry.settingsPath.length === 0) return undefined
  return deriveKeyRef(row.entry.provider)
}
