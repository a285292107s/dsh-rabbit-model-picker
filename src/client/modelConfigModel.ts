import type {
  ConfigurableProvider, LlmProviderInfo, ModelCatalogEntry, ModelConfigRow,
  ProviderDirectoryEntry, SettingsNamespaceView, SettingsOp,
} from './contract.ts'

export const ACCOUNT_ROUTE = 'deepseek-account'
const OFFICIAL_ROUTE = 'deepseek-official'

export type ProviderFamily = 'pi-ai' | 'deepseek' | 'unknown'

export function providerFamilyOf(settingsNs: string): ProviderFamily {
  if (settingsNs.startsWith('llm-deepseek')) return 'deepseek'
  if (settingsNs.startsWith('llm-pi-ai')) return 'pi-ai'
  return 'unknown'
}

export function inputFieldOf(family: ProviderFamily): 'input' | 'inputModalities' | undefined {
  if (family === 'pi-ai') return 'input'
  if (family === 'deepseek') return 'inputModalities'
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
    ...entry.nativeAuth === undefined ? {} : { nativeAuth: entry.nativeAuth },
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

  const rank = (provider: string): number =>
    provider === ACCOUNT_ROUTE ? 0 : provider === OFFICIAL_ROUTE ? 1 : 2

  return [...rows].sort((left, right) => rank(left.provider) - rank(right.provider))
}

export function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

export function apiKeyEnvOf(value: unknown, settingsPath: readonly string[]): string | undefined {
  const profile = readPath(value, settingsPath)
  if (!isRecord(profile)) return undefined
  const ref = profile.apiKeyEnv
  return typeof ref === 'string' && ref.length > 0 ? ref : undefined
}

export function keyRefOf(row: ModelConfigRow): string {
  return row.apiKeyEnv ?? deriveKeyRef(row.entry.provider)
}

export function providerUsable(row: ModelConfigRow): boolean {
  if (!row.entry.active) return false
  if (row.entry.provider === ACCOUNT_ROUTE) return row.accountAvailable === true
  if (row.apiKeyEnv === undefined) return true
  return row.credential?.configured === true
}

export function keyConfigured(row: ModelConfigRow): boolean {
  return row.apiKeyEnv !== undefined
    ? row.credential?.configured === true
    : row.derivedCredential?.configured === true
}

export function keyWritable(row: ModelConfigRow): boolean {
  const info = row.apiKeyEnv !== undefined ? row.credential : row.derivedCredential
  return info?.writable === true
}

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

export function isAdded(configured: boolean, settingsPath: readonly string[]): boolean {
  return configured || settingsPath.length === 0
}

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

export function reasoningLevelChoices(
  namespace: SettingsNamespaceView | undefined,
): readonly string[] {
  const refs = schemaRefsOf(namespace)
  if (refs === undefined) return []
  const profile = profileNodeOf(refs, namespace)
  if (profile === undefined) return []
  const models = stepDict(refs, profile, 'models')
  if (models === undefined) return []
  const modelShape = valueShapeOf(refs, models)
  if (modelShape === undefined) return []
  const efforts = stepDict(refs, modelShape, 'reasoningEfforts')
  const levelMap = unionMembers(refs, efforts).find(member => member.type === 'dict')
  if (levelMap === undefined) return []
  return unionMembers(refs, deref(refs, levelMap.sKey))
    .map(member => member.value)
    .filter((value): value is string => typeof value === 'string')
}

export interface CustomProviderHost {
  readonly ns: string
  readonly protocols: readonly string[]
}

export function customProviderHost(
  namespaces: ReadonlyMap<string, SettingsNamespaceView>,
): CustomProviderHost | undefined {
  for (const [ns, view] of namespaces) {
    const protocols = protocolChoices(view)
    if (protocols.length > 0) return { ns, protocols }
  }
  return undefined
}

export interface CustomModelDraft {
  readonly id: string
  readonly name?: string
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly input?: readonly string[]
}

export function customProviderOps(
  route: string,
  draft: {
    readonly displayName: string
    readonly baseURL: string
    readonly api: string
    readonly keyRef: string | undefined
    readonly models: readonly CustomModelDraft[]
  },
): readonly SettingsOp[] {
  const id = route.trim()
  const name = draft.displayName.trim()
  const base = draft.baseURL.trim()
  const profile: Record<string, unknown> = {
    ...name === '' ? {} : { displayName: name },
    ...draft.keyRef === undefined ? {} : { apiKeyEnv: draft.keyRef },
    api: draft.api,
    ...base === '' ? {} : { baseURL: base },
    models: draft.models.map(model => ({
      id: model.id,
      ...model.name === undefined || model.name === '' ? {} : { name: model.name },
      ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
      ...model.input === undefined || model.input.length === 0 ? {} : { input: [...model.input] },
    })),
  }
  return [{ op: 'set', path: ['providers', id], value: profile }]
}

export function routeProblemOf(
  route: string,
  taken: readonly string[],
): 'empty' | 'invalid' | 'taken' | undefined {
  const id = route.trim()
  if (id === '') return 'empty'
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) return 'invalid'
  return taken.includes(id) ? 'taken' : undefined
}

export function baseUrlProblemOf(baseURL: string): 'empty' | 'invalid' | undefined {
  const value = baseURL.trim()
  if (value === '') return 'empty'
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:' ? undefined : 'invalid'
  } catch {
    return 'invalid'
  }
}

export function modelIdsOf(text: string): readonly string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const line of text.split('\n')) {
    const id = line.trim()
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function retryCapable(
  namespace: SettingsNamespaceView | undefined,
  settingsPath: readonly string[],
): boolean {
  return profileDeclaresField(namespace, settingsPath, 'retryPolicy')
}

export function displayNameEditable(
  namespace: SettingsNamespaceView | undefined,
  settingsPath: readonly string[],
): boolean {
  return profileDeclaresField(namespace, settingsPath, 'displayName')
}

function profileDeclaresField(
  namespace: SettingsNamespaceView | undefined,
  settingsPath: readonly string[],
  field: string,
): boolean {
  const refs = schemaRefsOf(namespace)
  if (refs === undefined) return false
  const profile = schemaNodeAt(refs, namespace, settingsPath)
  if (profile === undefined) return false
  return stepDict(refs, profile, field) !== undefined
}

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

function deref(refs: unknown, id: unknown): Record<string, unknown> | undefined {
  if (!isRecord(refs) && !Array.isArray(refs)) return undefined
  if (typeof id !== 'number' && typeof id !== 'string') return undefined
  const node = (refs as Record<string | number, unknown>)[id]
  return isRecord(node) ? node : undefined
}

function schemaRefsOf(namespace: SettingsNamespaceView | undefined): unknown {
  const schema = namespace?.schema
  return isRecord(schema) ? schema.refs : undefined
}

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

function stepDict(
  refs: unknown,
  node: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const dict = node.dict
  if (!isRecord(dict)) return undefined
  return deref(refs, dict[key])
}

function valueShapeOf(
  refs: unknown,
  node: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return deref(refs, node.inner)
}

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

export function credentialRefFor(row: ModelConfigRow): string | undefined {
  if (row.apiKeyEnv !== undefined) return row.apiKeyEnv
  if (row.entry.settingsNs === '' && row.entry.settingsPath.length === 0) return undefined
  return deriveKeyRef(row.entry.provider)
}

export function credentialRefsOf(row: ModelConfigRow): readonly string[] {
  if (row.entry.provider === ACCOUNT_ROUTE) return []
  if (row.apiKeyEnv !== undefined) return [row.apiKeyEnv]
  const derived = row.entry.settingsNs === '' && row.entry.settingsPath.length === 0
    ? []
    : [deriveKeyRef(row.entry.provider)]
  return [...new Set([...derived, ...(row.entry.nativeAuth?.env ?? [])])]
}

const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/
const LEGAL_API_KEY = /^[\x21-\x7E]+$/

export function apiKeyProblem(value: string): 'blank' | 'illegal' | undefined {
  if (value.length === 0) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return 'blank'
  const first = trimmed[0]
  const quoted = (first === '"' || first === "'" || first === '`')
    && trimmed.length > 1
    && trimmed.endsWith(first)
  if (ENV_LINE.test(trimmed) || quoted || !LEGAL_API_KEY.test(trimmed)) return 'illegal'
  return undefined
}

const TOKEN_COUNT = /^(\d+(?:\.\d+)?)([KM])?$/

export function parseTokenCount(raw: string): number | null {
  const text = raw.trim().replace(/[\s_]/g, '').toUpperCase()
  const match = TOKEN_COUNT.exec(text)
  if (match === null) return null
  const scale = match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1
  const tokens = Math.round(Number(match[1]) * scale)
  return Number.isFinite(tokens) && tokens > 0 ? tokens : null
}

export function catalogAddProfile(
  provider: string,
  draft: { readonly baseURL: string; readonly bindKey: boolean },
): Record<string, unknown> {
  const base = draft.baseURL.trim()
  return {
    ...base === '' ? {} : { baseURL: base },
    ...draft.bindKey ? { apiKeyEnv: deriveKeyRef(provider) } : {},
  }
}
