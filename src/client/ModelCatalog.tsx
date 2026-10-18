
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type {
  DiscoveredModel, ModelCatalogEntry, ModelConfigRow, ModelDiscoveryRequest, Translate,
} from './contract.ts'
import type { ModelConfigStore } from './modelConfigStore.ts'
import {
  hasPath, modelsOf, pathOps, readPath, reasoningLevelChoices, validateModels,
} from './modelConfigModel.ts'
import { KEYS, VALIDATION_KEYS } from './modelConfigCopy.ts'
import type { ConfigKey } from './modelConfigCopy.ts'
import { formatContext, parseContext } from './params.ts'
import { formatWindowStatement } from './format.ts'
import { injectCatalogStyles } from './catalogStyles.ts'

const OFF_LEVEL = 'off'

const EDITED_FIELDS: readonly string[] = ['id', 'name', 'contextWindow', 'maxTokens', 'reasoningEfforts']

const MODEL_ROW_SELECTOR = '.dmc-model-row'

let addedKeySeed = 0

function nextAddedKey(): string {
  addedKeySeed += 1
  return `a${addedKeySeed}`
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecordValue(value) ? value : undefined
}

interface DraftReasoning {
  readonly level: string
  readonly value: string
}

interface DraftModel {
  readonly key: string
  readonly id: string
  readonly name: string
  readonly contextWindow: string
  readonly maxTokens: string
  readonly storedWindow: number | undefined
  readonly storedTokens: number | undefined
  readonly reasoning: readonly DraftReasoning[]
  readonly extra: Readonly<Record<string, unknown>>
  readonly open: boolean
}

interface ModelEdit {
  readonly id?: string
  readonly name?: string
  readonly contextWindow?: string
  readonly maxTokens?: string
  readonly reasoning?: readonly DraftReasoning[]
  readonly open?: boolean
}

type Discovery =
  | { readonly kind: 'idle' }
  | { readonly kind: 'needsBaseUrl' }
  | { readonly kind: 'fetching' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready'
      readonly candidates: readonly DiscoveredModel[]
      readonly selected: ReadonlySet<string>
      readonly query: string
      readonly note: string | null
    }

function rawModelsOf(value: unknown, settingsPath: readonly string[]): readonly unknown[] {
  const list = readPath(value, [...settingsPath, 'models'])
  return Array.isArray(list) ? list : []
}

function reasoningRowsOf(value: unknown): readonly DraftReasoning[] {
  const record = asRecord(value)
  if (record === undefined) return []
  return Object.entries(record).map(([level, raw]) => ({
    level,
    value: typeof raw === 'string' ? raw : '',
  }))
}

function seedModel(raw: Record<string, unknown>, key: string): DraftModel {
  const extra: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(raw)) {
    if (EDITED_FIELDS.includes(field)) continue
    extra[field] = value
  }
  return {
    key,
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    contextWindow: typeof raw.contextWindow === 'number' ? formatContext(raw.contextWindow) : '',
    maxTokens: typeof raw.maxTokens === 'number' ? formatContext(raw.maxTokens) : '',
    storedWindow: typeof raw.contextWindow === 'number' ? raw.contextWindow : undefined,
    storedTokens: typeof raw.maxTokens === 'number' ? raw.maxTokens : undefined,
    reasoning: reasoningRowsOf(raw.reasoningEfforts),
    extra,
    open: false,
  }
}

function seedModels(raw: readonly unknown[]): readonly DraftModel[] {
  const models: DraftModel[] = []
  raw.forEach((item, index) => {
    if (!isRecordValue(item)) return
    models.push(seedModel(item, `m${index}`))
  })
  return models
}

function seedCandidate(candidate: DiscoveredModel): DraftModel {
  return {
    key: nextAddedKey(),
    id: candidate.id,
    name: candidate.name ?? '',
    contextWindow: candidate.contextWindow === undefined ? '' : formatContext(candidate.contextWindow),
    maxTokens: candidate.maxTokens === undefined ? '' : formatContext(candidate.maxTokens),
    storedWindow: candidate.contextWindow,
    storedTokens: candidate.maxTokens,
    reasoning: [],
    extra: {},
    open: false,
  }
}

interface CandidateGroup {
  readonly label: string
  readonly items: readonly DiscoveredModel[]
}

function groupByPrefix(candidates: readonly DiscoveredModel[]): readonly CandidateGroup[] {
  const groups: CandidateGroup[] = []
  const byLabel = new Map<string, { label: string; items: DiscoveredModel[] }>()
  for (const candidate of candidates) {
    const cut = candidate.id.indexOf('/')
    const label = cut > 0 ? candidate.id.slice(0, cut) : ''
    let group = byLabel.get(label)
    if (group === undefined) {
      group = { label, items: [] }
      byLabel.set(label, group)
      groups.push(group)
    }
    group.items.push(candidate)
  }
  return groups
}

// parseContext is not the only reader: a seeded capacity outside its range must
// survive an edit here, so text still equal to the seed keeps the number it came
// from instead of being refused (which would block every save in the region).
function capacityOf(text: string, stored: number | undefined): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const parsed = parseContext(trimmed)
  if (parsed !== null) return parsed
  if (stored !== undefined && trimmed === formatContext(stored)) return stored
  return null
}

function capacitiesOf(model: DraftModel): { readonly contextWindow: number | undefined; readonly maxTokens: number | undefined } {
  const contextWindow = capacityOf(model.contextWindow, model.storedWindow)
  const maxTokens = capacityOf(model.maxTokens, model.storedTokens)
  return {
    contextWindow: contextWindow === null ? undefined : contextWindow,
    maxTokens: maxTokens === null ? undefined : maxTokens,
  }
}

function reasoningValueOf(rows: readonly DraftReasoning[]): Record<string, string> | undefined {
  if (rows.length === 0) return undefined
  const table: Record<string, string> = {}
  for (const row of rows) table[row.level] = row.value
  return table
}

function entryOf(model: DraftModel): ModelCatalogEntry {
  const { contextWindow, maxTokens } = capacitiesOf(model)
  const name = model.name.trim()
  return {
    id: model.id,
    ...name === '' ? {} : { name },
    ...contextWindow === undefined ? {} : { contextWindow },
    ...maxTokens === undefined ? {} : { maxTokens },
  }
}

function storedValueOf(model: DraftModel): Record<string, unknown> {
  const { contextWindow, maxTokens } = capacitiesOf(model)
  const reasoning = reasoningValueOf(model.reasoning)
  const name = model.name.trim()
  return {
    ...model.extra,
    id: model.id,
    ...name === '' ? {} : { name },
    ...contextWindow === undefined ? {} : { contextWindow },
    ...maxTokens === undefined ? {} : { maxTokens },
    ...reasoning === undefined ? {} : { reasoningEfforts: reasoning },
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isRecordValue(value)) {
    const entries = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function reasoningProblemOf(rows: readonly DraftReasoning[]): ConfigKey | undefined {
  if (rows.length === 0) return undefined
  const decisive = rows.filter(row => row.level !== OFF_LEVEL)
  if (decisive.length === 0) return KEYS['config.reasoning.needsLevel']
  if (decisive.some(row => row.value.trim() === '')) return KEYS['config.reasoning.valueRequired']
  return undefined
}

function problemsOf(models: readonly DraftModel[], t: Translate): ReadonlyMap<string, string> {
  const messages = new Map<string, string>()
  const structural = validateModels(models.map(entryOf))
  if (structural !== undefined) {
    const offender = models[structural.index]
    if (offender !== undefined) messages.set(offender.key, t(VALIDATION_KEYS[structural.reason]))
  }
  for (const model of models) {
    if (messages.has(model.key)) continue
    const { contextWindow, maxTokens } = capacitiesOf(model)
    if (contextWindow === undefined && model.contextWindow.trim() !== '') {
      messages.set(model.key, t(KEYS['config.model.contextWindowInvalid']))
      continue
    }
    if (maxTokens === undefined && model.maxTokens.trim() !== '') {
      messages.set(model.key, t(KEYS['config.model.maxTokensInvalid']))
      continue
    }
    const reasoning = reasoningProblemOf(model.reasoning)
    if (reasoning !== undefined) messages.set(model.key, t(reasoning))
  }
  return messages
}

export interface ModelCatalogProps {
  readonly row: ModelConfigRow
  readonly store: ModelConfigStore
  readonly t: Translate
  readonly onDirtyChange: (dirty: boolean) => void
  readonly onRequestClose: () => void
  readonly confirming: boolean
  readonly onKeepEditing: () => void
  readonly onDiscard: () => void
}

export function ModelCatalog(props: ModelCatalogProps): ReactElement {
  const { row, store, t, onRequestClose } = props
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const settingsNs = row.entry.settingsNs
  const settingsPath = row.entry.settingsPath
  const modelsPath = useMemo(() => [...settingsPath, 'models'], [settingsPath])
  const namespace = snapshot.namespaces.get(settingsNs)
  const writable = snapshot.writable

  useEffect(() => injectCatalogStyles(), [])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const panelRef = useRef<HTMLDivElement | null>(null)

  const levelChoices = useMemo(
    () => reasoningLevelChoices(namespace),
    [namespace],
  )

  const raw = useMemo(() => rawModelsOf(namespace?.value, settingsPath), [namespace, settingsPath])
  const seed = useMemo(() => seedModels(raw), [raw])
  const storedModels = useMemo(() => modelsOf(namespace?.value, settingsPath), [namespace, settingsPath])

  const [draft, setDraft] = useState<readonly DraftModel[] | null>(null)
  const models = draft ?? seed
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<Discovery>({ kind: 'idle' })

  const baseline = useMemo(() => canonical(raw.filter(isRecordValue)), [raw])
  const dirty = canonical(models.map(storedValueOf)) !== baseline
  const problems = useMemo(() => problemsOf(models, t), [models, t])
  const invalid = problems.size > 0

  useEffect(() => { props.onDirtyChange(dirty) }, [dirty, props.onDirtyChange])
  useEffect(() => () => { props.onDirtyChange(false) }, [props.onDirtyChange])

  const escapeRef = useRef<(event: KeyboardEvent) => void>(() => {})
  escapeRef.current = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.dmc-well') != null) return
    event.stopPropagation()
    event.preventDefault()
    if (props.confirming) {
      props.onKeepEditing()
      return
    }
    const modelRow = target?.closest(MODEL_ROW_SELECTOR) ?? null
    if (modelRow !== null) {
      const key = modelRow.getAttribute('data-key')
      const model = key === null ? undefined : models.find(entry => entry.key === key)
      if (key !== null && model?.open === true) {
        modelRow.querySelector<HTMLElement>('.dmc-model-edit')?.focus()
        patch(rows => rows.map(entry => entry.key === key ? { ...entry, open: false } : entry))
        return
      }
    }
    if (discovery.kind !== 'idle') {
      panelRef.current?.querySelector<HTMLElement>('.dmc-discover')?.focus()
      setDiscovery({ kind: 'idle' })
      return
    }
    props.onRequestClose()
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent): void => { escapeRef.current(event) }
    // CAPTURE on `document`, not a React handler on the region: the host settings panel has
    // its own document-level Escape while it is open, so this layer claims the keystroke
    // first — one Escape closes exactly one layer.
    document.addEventListener('keydown', listener, true)
    return () => { document.removeEventListener('keydown', listener, true) }
  }, [])

  const patch = (change: (rows: readonly DraftModel[]) => readonly DraftModel[]): void => {
    setNote(null)
    setDraft(current => change(current ?? seed))
  }

  const updateModel = (model: DraftModel, edit: ModelEdit): void => {
    const next: DraftModel = {
      key: model.key,
      id: edit.id ?? model.id,
      name: edit.name ?? model.name,
      contextWindow: edit.contextWindow ?? model.contextWindow,
      maxTokens: edit.maxTokens ?? model.maxTokens,
      storedWindow: model.storedWindow,
      storedTokens: model.storedTokens,
      reasoning: edit.reasoning ?? model.reasoning,
      extra: model.extra,
      open: edit.open ?? model.open,
    }
    patch(rows => rows.map(row => row.key === next.key ? next : row))
  }

  const addModel = (): void => {
    const blank: DraftModel = {
      key: nextAddedKey(),
      id: '',
      name: '',
      contextWindow: '',
      maxTokens: '',
      storedWindow: undefined,
      storedTokens: undefined,
      reasoning: [],
      extra: {},
      open: false,
    }
    patch(rows => [...rows, blank])
  }

  const removeModel = (key: string): void => {
    patch(rows => rows.filter(row => row.key !== key))
  }

  const addReasoning = (model: DraftModel): void => {
    const used = new Set(model.reasoning.map(row => row.level))
    const next = levelChoices.find(choice => choice !== OFF_LEVEL && !used.has(choice)) ?? OFF_LEVEL
    updateModel(model, { reasoning: [...model.reasoning, { level: next, value: '' }] })
  }

  const removeReasoning = (model: DraftModel, index: number): void => {
    updateModel(model, { reasoning: model.reasoning.filter((_, position) => position !== index) })
  }

  const updateReasoning = (model: DraftModel, index: number, change: { level?: string; value?: string }): void => {
    const reasoning = model.reasoning.map((row, position) => position === index
      ? { level: change.level ?? row.level, value: change.value ?? row.value }
      : row)
    updateModel(model, { reasoning })
  }

  // Levels another row of the same model already declares are withheld: two rows for
  // one level collapse into one dict key on write, silently dropping a value.
  const levelOptionsFor = (current: string, used: ReadonlySet<string>): readonly string[] => {
    const options = [...levelChoices]
    if (current !== OFF_LEVEL && !options.includes(current)) options.push(current)
    if (!options.includes(OFF_LEVEL)) options.push(OFF_LEVEL)
    return options.filter(level => level === current || !used.has(level))
  }

  // `pathOps` unsets every key its `after` omits, so the write repeats the whole
  // effective profile; each row carries its unedited fields in `extra` for the same
  // reason — one write replaces the whole `models` array.
  const writeModels = async (next: readonly DraftModel[]): Promise<boolean> => {
    if (namespace === undefined) return false
    const profile = asRecord(readPath(namespace.value, settingsPath)) ?? {}
    const ops = pathOps(settingsPath, profile, { ...profile, models: next.map(storedValueOf) })
    setBusy(true)
    setNote(null)
    const outcome = await store.write(settingsNs, ops, namespace.revision)
    if (!mounted.current) return outcome.ok
    setBusy(false)
    if (!outcome.ok) {
      setNote(outcome.conflict ? t(KEYS['config.conflict']) : outcome.message)
      return false
    }
    setDraft(null)
    setNote(t(KEYS['config.savedProvider'], { provider: row.entry.displayName }))
    return true
  }

  const save = (): void => {
    if (!writable || busy || !dirty || invalid) return
    void writeModels(models)
  }

  // Unsetting the `models` key is the whole reset: an absent list means the adapter's
  // own catalog is inherited again, where an empty array would state "no models".
  const reset = async (): Promise<void> => {
    if (!writable || busy || namespace === undefined) return
    setBusy(true)
    setNote(null)
    const outcome = await store.write(settingsNs, [{ op: 'unset', path: modelsPath }], namespace.revision)
    if (!mounted.current) return
    setBusy(false)
    if (!outcome.ok) {
      setNote(outcome.conflict ? t(KEYS['config.conflict']) : outcome.message)
      return
    }
    setDraft(null)
    setNote(t(KEYS['config.savedProvider'], { provider: row.entry.displayName }))
  }

  const profile = asRecord(readPath(namespace?.value, settingsPath))
  const baseURL = typeof profile?.baseURL === 'string' && profile.baseURL !== '' ? profile.baseURL : undefined
  const api = typeof profile?.api === 'string' && profile.api !== '' ? profile.api : undefined

  // No credential travels: the Host resolves the profile's own key reference and this
  // surface cannot read a secret. A `declared` route is interrogated only once the
  // profile states a baseURL, because that call goes to the endpoint.
  const fetchModels = async (): Promise<void> => {
    if (namespace === undefined) return
    if (row.entry.declared === true && baseURL === undefined) {
      setDiscovery({ kind: 'needsBaseUrl' })
      return
    }
    setDiscovery({ kind: 'fetching' })
    const request: ModelDiscoveryRequest = {
      provider: row.entry.provider,
      ...baseURL === undefined ? {} : { baseURL },
      ...api === undefined ? {} : { api },
    }
    const answer = await store.discover(settingsNs, request)
    if (!mounted.current) return
    if (!answer.ok) {
      setDiscovery({ kind: 'error', message: answer.message })
      return
    }
    const seen = new Set<string>()
    const candidates = answer.models.filter((candidate) => {
      if (candidate.id === '' || seen.has(candidate.id)) return false
      seen.add(candidate.id)
      return true
    })
    if (candidates.length === 0) {
      setDiscovery({ kind: 'empty' })
      return
    }
    setDiscovery({ kind: 'ready', candidates, selected: new Set<string>(), query: '', note: null })
  }

  const toggleCandidate = (id: string, checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    if (checked) selected.add(id)
    else selected.delete(id)
    setDiscovery({ ...discovery, selected, note: null })
  }

  const adopt = async (): Promise<void> => {
    if (discovery.kind !== 'ready' || busy || !writable) return
    const existing = new Set(models.map(model => model.id))
    const additions: DraftModel[] = []
    for (const candidate of discovery.candidates) {
      if (!discovery.selected.has(candidate.id)) continue
      if (existing.has(candidate.id)) continue
      existing.add(candidate.id)
      additions.push(seedCandidate(candidate))
    }
    if (additions.length === 0) return
    const merged = [...models, ...additions]
    const firstProblem = [...problemsOf(merged, t).values()][0]
    if (firstProblem !== undefined) {
      setDiscovery({ ...discovery, note: firstProblem })
      return
    }
    const written = await writeModels(merged)
    if (written && mounted.current) setDiscovery({ kind: 'idle' })
  }

  const catalogHead = (
    <div className="dmc-catalog-head zmd-runhead">
      <h2 className="dmc-catalog-title">{t(KEYS['config.models.label'])}</h2>
      <span className="dmc-catalog-status">
        {storedModels.length > 0
          ? t(KEYS['config.models.customized'])
          : t(KEYS['config.models.inherited'])}
      </span>
      <span className="zmd-rule" aria-hidden="true" />
      <span className="dmc-roster-count zmd-num">
        {t(KEYS['config.models.count'], { count: String(models.length) })}
      </span>
      <button type="button" className="dmc-btn dmc-catalog-close" onClick={onRequestClose}>
        {t(KEYS['config.catalog.collapse'])}
      </button>
    </div>
  )

  const guardLine = props.confirming
    ? (
      <div className="dmc-catalog-guard" role="alert">
        <p className="dmc-catalog-notice">{t(KEYS['config.catalog.unsaved'])}</p>
        <div className="dmc-catalog-guard-actions">
          <button type="button" className="dmc-btn" onClick={props.onKeepEditing}>
            {t(KEYS['config.catalog.keepEditing'])}
          </button>
          <button type="button" className="dmc-btn" onClick={props.onDiscard}>
            {t(KEYS['config.catalog.discard'])}
          </button>
        </div>
      </div>
    )
    : null

  const panel = (body: ReactNode, foot: ReactNode): ReactElement => (
    <div
      className="dmc-catalog-panel"
      id={`dmc-catalog-${row.entry.provider}`}
      ref={panelRef}
    >
      {catalogHead}
      <div className="dmc-catalog-body">
        {guardLine}
        {body}
      </div>
      {foot}
    </div>
  )

  if (namespace === undefined) {
    return panel(
      <>
        {snapshot.status === 'error' ? (
          <>
            <p className="dmc-catalog-notice">{t(KEYS['config.loadFailed'])}</p>
            {snapshot.error === null ? null : <p className="dmc-catalog-error">{snapshot.error}</p>}
          </>
        ) : (
          <p className="dmc-catalog-status">{t(KEYS['config.models.inherited'])}</p>
        )}
      </>,
      null,
    )
  }

  const canReset = hasPath(namespace.user, modelsPath) || dirty
  const presentIds = new Set(models.map(model => model.id))
  const query = discovery.kind === 'ready' ? discovery.query.trim().toLowerCase() : ''
  const visible = discovery.kind === 'ready'
    ? discovery.candidates.filter(candidate => query === ''
      || candidate.id.toLowerCase().includes(query)
      || (candidate.name ?? '').toLowerCase().includes(query))
    : []
  const addable = visible.filter(candidate => !presentIds.has(candidate.id))
  const selectedAddable = discovery.kind === 'ready'
    ? addable.filter(candidate => discovery.selected.has(candidate.id))
    : []
  const allSelected = addable.length > 0 && selectedAddable.length === addable.length
  const listedInCatalog = visible.length - addable.length
  const listedGroups = groupByPrefix(visible)
  const grouped = listedGroups.length > 1

  const selectAll = (checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    for (const candidate of addable) {
      if (checked) selected.add(candidate.id)
      else selected.delete(candidate.id)
    }
    setDiscovery({ ...discovery, selected, note: null })
  }

  const modelRow = (model: DraftModel, position: number): ReactElement => {
    const message = problems.get(model.key)
    const wellId = `dmc-model-well-${model.key}`
    const used = new Set(model.reasoning.map(entry => entry.level))
    const disabled = !writable || busy
    const alias = model.name.trim()
    const context = formatWindowStatement(model.contextWindow, model.storedWindow)
    const output = formatWindowStatement(model.maxTokens, model.storedTokens)
    const manifestIndex = String(position).padStart(2, '0')
    return (
      <li
        key={model.key}
        className="dmc-model-row"
        data-key={model.key}
        data-invalid={message === undefined ? undefined : 'true'}
        data-well={model.open ? 'true' : undefined}
      >
        <span className="dmc-model-index zmd-ordinal" aria-hidden="true">{manifestIndex}</span>
        <span className="dmc-model-ref" title={model.id === '' ? undefined : model.id}>
          {model.id === '' ? t(KEYS['config.model.newLabel']) : model.id}
        </span>
        <button
          type="button"
          className="dmc-model-edit zmd-btn-quiet"
          aria-expanded={model.open}
          aria-controls={wellId}
          onClick={() => { updateModel(model, { open: !model.open }) }}
        >
          {t(KEYS['config.edit'])}
        </button>
        <span className="dmc-model-sub">
          {alias === '' ? null : <span className="dmc-model-alias">{alias}</span>}
          <span className="dmc-model-facts">
            {context === '' ? null : (
              <span className="dmc-model-fact">
                {t(KEYS['config.model.contextShort'])} {context}
              </span>
            )}
            {output === '' ? null : (
              <span className="dmc-model-fact">
                {t(KEYS['config.model.outputShort'])} {output}
              </span>
            )}
            {context === '' && output === ''
              ? <span className="dmc-model-fact">{t(KEYS['config.model.capacityDefault'])}</span>
              : null}
          </span>
        </span>
        {model.open ? (
          <div className="dmc-model-well" id={wellId}>
            {message === undefined ? null : <p className="dmc-model-error">{message}</p>}
            <div className="dmc-model-fields">
              <div className="dmc-model-id">
                <label className="dmc-model-label" htmlFor={`dmc-model-id-${model.key}`}>
                  {t(KEYS['config.model.id'])}
                </label>
                <input
                  className="dmc-model-input"
                  id={`dmc-model-id-${model.key}`}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={model.id}
                  disabled={disabled}
                  data-invalid={message === undefined ? undefined : 'true'}
                  onChange={(event) => { updateModel(model, { id: event.target.value }) }}
                />
              </div>
              <div className="dmc-model-name">
                <label className="dmc-model-label" htmlFor={`dmc-model-name-${model.key}`}>
                  {t(KEYS['config.model.name'])}
                </label>
                <input
                  className="dmc-model-input"
                  id={`dmc-model-name-${model.key}`}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={model.name}
                  placeholder={t(KEYS['config.model.namePlaceholder'])}
                  disabled={disabled}
                  onChange={(event) => { updateModel(model, { name: event.target.value }) }}
                />
              </div>
              <div className="dmc-model-window">
                <label className="dmc-model-label" htmlFor={`dmc-model-window-${model.key}`}>
                  {t(KEYS['config.model.contextWindow'])}
                </label>
                <input
                  className="dmc-model-input"
                  id={`dmc-model-window-${model.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={model.contextWindow}
                  placeholder={t(KEYS['config.model.contextWindowPlaceholder'])}
                  disabled={disabled}
                  onChange={(event) => { updateModel(model, { contextWindow: event.target.value }) }}
                />
              </div>
              <div className="dmc-model-tokens">
                <label className="dmc-model-label" htmlFor={`dmc-model-tokens-${model.key}`}>
                  {t(KEYS['config.model.maxTokens'])}
                </label>
                <input
                  className="dmc-model-input"
                  id={`dmc-model-tokens-${model.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={model.maxTokens}
                  placeholder={t(KEYS['config.model.maxTokensPlaceholder'])}
                  disabled={disabled}
                  onChange={(event) => { updateModel(model, { maxTokens: event.target.value }) }}
                />
              </div>
            </div>
            <div className="dmc-reasoning">
              <span className="dmc-model-label">{t(KEYS['config.reasoning.label'])}</span>
              {model.reasoning.length === 0 ? null : (
                <div className="dmc-reasoning-head">
                  <span className="dmc-model-label">{t(KEYS['config.reasoning.level'])}</span>
                  <span className="dmc-model-label">{t(KEYS['config.reasoning.value'])}</span>
                  <span />
                </div>
              )}
              {model.reasoning.map((entry, index) => (
                <div className="dmc-reasoning-row" key={`${entry.level}-${index}`}>
                  <select
                    className="dmc-reasoning-level"
                    aria-label={t(KEYS['config.reasoning.level'])}
                    value={entry.level}
                    disabled={disabled}
                    onChange={(event) => { updateReasoning(model, index, { level: event.target.value }) }}
                  >
                    {levelOptionsFor(entry.level, used).map(level => (
                      <option key={level} value={level}>
                        {level === OFF_LEVEL ? t(KEYS['config.reasoning.off']) : level}
                      </option>
                    ))}
                  </select>
                  <input
                    className="dmc-reasoning-value"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t(KEYS['config.reasoning.value'])}
                    value={entry.value}
                    disabled={disabled || entry.level === OFF_LEVEL}
                    placeholder={entry.level === OFF_LEVEL ? t(KEYS['config.reasoning.offPlaceholder']) : ''}
                    onChange={(event) => { updateReasoning(model, index, { value: event.target.value }) }}
                  />
                  <button
                    type="button"
                    className="zmd-btn-danger dmc-reasoning-remove"
                    disabled={disabled}
                    onClick={() => { removeReasoning(model, index) }}
                  >
                    {t(KEYS['config.reasoning.remove'])}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="dmc-btn dmc-reasoning-add zmd-btn-quiet"
                disabled={disabled}
                onClick={() => { addReasoning(model) }}
              >
                {t(KEYS['config.reasoning.add'])}
              </button>
              {model.reasoning.length === 0
                ? null
                : <p className="dmc-reasoning-help">{t(KEYS['config.reasoning.helpText'])}</p>}
            </div>
            <button
              type="button"
              className="dmc-model-danger zmd-btn-danger"
              disabled={disabled}
              onClick={() => { removeModel(model.key) }}
            >
              {t(KEYS['config.model.remove'])}
            </button>
          </div>
        ) : null}
      </li>
    )
  }

  const body = (
    <>
      {writable ? null : <p className="dmc-catalog-notice">{t(KEYS['config.readOnly'])}</p>}
      {storedModels.length === 0 && models.length === 0
        ? <p className="dmc-catalog-notice">{t(KEYS['config.models.empty'])}</p>
        : null}
      <ul className="dmc-model-list">{models.map((model, index) => modelRow(model, index + 1))}</ul>
      <button type="button" className="dmc-btn dmc-model-add" disabled={!writable || busy} onClick={addModel}>
        {t(KEYS['config.model.add'])}
      </button>

      <div className="dmc-discover-actions">
        <button
          type="button"
          className="zmd-btn-door dmc-discover"
          disabled={busy || discovery.kind === 'fetching'}
          onClick={() => { void fetchModels() }}
        >
          {t(KEYS['config.fetch.action'])}
        </button>
        {discovery.kind === 'fetching' ? <span className="dmc-catalog-status">{t(KEYS['config.fetch.fetching'])}</span> : null}
      </div>
      {discovery.kind === 'needsBaseUrl' ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.needsBaseUrl'])}</p> : null}
      {discovery.kind === 'empty' ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.empty'])}</p> : null}
      {discovery.kind === 'error' ? <p className="dmc-catalog-error">{discovery.message}</p> : null}

      {discovery.kind === 'ready' ? (
        <div className="dmc-discover-panel">
          <h3 className="dmc-catalog-section zmd-runhead">
            {t(KEYS['config.fetch.title'])}
            <span className="zmd-rule" aria-hidden="true" />
          </h3>
          <p className="dmc-catalog-notice">{t(KEYS['config.fetch.description'])}</p>
          <input
            className="dmc-discover-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label={t(KEYS['config.fetch.search'])}
            placeholder={t(KEYS['config.fetch.search'])}
            value={discovery.query}
            onChange={(event) => { setDiscovery({ ...discovery, query: event.target.value, note: null }) }}
          />
          <div className="dmc-discover-tools">
            <span className="dmc-catalog-status">
              {t(KEYS['config.fetch.count'], {
                count: String(visible.length),
                inCatalog: String(listedInCatalog),
              })}
            </span>
            <button
              type="button"
              className="dmc-btn dmc-discover-tool zmd-btn-quiet"
              disabled={addable.length === 0 || allSelected}
              onClick={() => { selectAll(true) }}
            >
              {t(KEYS['config.fetch.selectAll'])}
            </button>
            <button
              type="button"
              className="dmc-btn dmc-discover-tool zmd-btn-quiet"
              disabled={selectedAddable.length === 0}
              onClick={() => { selectAll(false) }}
            >
              {t(KEYS['config.fetch.deselectAll'])}
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="dmc-catalog-notice">{t(KEYS['config.fetch.noMatches'])}</p>
          ) : (
            <ul className="dmc-discover-list">
              {listedGroups.map((group) => (
                <Fragment key={`group-${group.label}`}>
                  {grouped && group.label !== '' ? (
                    <li className="dmc-discover-group">
                      <span>{group.label}</span>
                      <span>{group.items.length}</span>
                    </li>
                  ) : null}
                  {group.items.map((candidate) => {
                    const present = presentIds.has(candidate.id)
                    return (
                      <li
                        key={candidate.id}
                        className="dmc-discover-candidate"
                        data-present={present ? 'true' : undefined}
                      >
                        <label className="dmc-discover-label">
                          <input
                            className="dmc-discover-check"
                            type="checkbox"
                            checked={!present && discovery.selected.has(candidate.id)}
                            disabled={present || busy}
                            onChange={(event) => { toggleCandidate(candidate.id, event.target.checked) }}
                          />
                          <span className="dmc-discover-id">{candidate.id}</span>
                        </label>
                        {candidate.name === undefined || candidate.name === candidate.id
                          ? null
                          : <span className="dmc-discover-name">{candidate.name}</span>}
                      </li>
                    )
                  })}
                </Fragment>
              ))}
            </ul>
          )}
          {discovery.note === null ? null : <p className="dmc-catalog-error">{discovery.note}</p>}
          <div className="dmc-discover-actions">
            <button
              type="button"
              className="dmc-btn dmc-discover-adopt zmd-btn-door"
              disabled={!writable || busy || selectedAddable.length === 0}
              onClick={() => { void adopt() }}
            >
              {busy ? t(KEYS['config.applying']) : t(KEYS['config.fetch.adopt'])}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )

  const foot = (
    <div className="dmc-catalog-foot zmd-footing">
      <span className="zmd-footing-note">
        {t(KEYS['config.models.count'], { count: String(models.length) })}
      </span>
      <span className="dmc-catalog-foot-actions">
        <button
          type="button"
          className="dmc-btn zmd-btn-quiet"
          disabled={!writable || busy || !canReset}
          onClick={() => { void reset() }}
        >
          {t(KEYS['config.models.reset'])}
        </button>
        <button
          type="button"
          className="zmd-btn-primary"
          disabled={!writable || busy || !dirty || invalid}
          onClick={save}
        >
          {busy ? t(KEYS['config.applying']) : t(KEYS['config.apply'])}
        </button>
      </span>
      {note === null ? null : <span className="dmc-catalog-note">{note}</span>}
    </div>
  )

  return panel(body, foot)
}
