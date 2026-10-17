/**
 * 模型目录：一个提供商的模型目录，以及「发现 → 勾选确认 → 落盘」三步。
 *
 * WHERE THIS RENDERS, AND WHY IT IS INLINE. The 模型配置 tab is a PAGE inside the
 * host's settings dialog, and that dialog is the only modal the task is allowed to
 * have. The catalog used to be a right-side drawer (`position: fixed`, its own
 * scrim, `role=dialog`, `aria-modal`, a Tab trap): a second viewport-level modal
 * inside the host's, which at a wide viewport landed OUTSIDE the settings dialog
 * and at 1920 covered 460 of the page's 560px content column. This component is
 * therefore the provider row's own expanded region: it spans the content column,
 * scrolls with the page, and carries no overlay semantics. The row above states
 * whose catalog this is; the head below states only the catalog itself.
 *
 * ONE STORE, TWO SURFACES. The catalog reads and writes through the page's own
 * `ModelConfigStore` — never around it and never a second read of its own — so the
 * row and the catalog can never disagree about the same revision, and the catalog
 * inherits the store's conflict retry (re-read the revision, re-apply once).
 *
 * THE THREE STEPS, EACH ONE ITS OWN CALL. `store.discover` is a PURE READ: the
 * Host's own contract says it describes a draft and reads or writes nothing, so
 * nothing here persists its answer. The candidates go into a checklist the user
 * ticks; only then does the adopt action merge them into the draft layer and issue
 * ONE `write`. An empty answer never opens the checklist at all, and a refused
 * answer is printed exactly as the Host worded it (not localized, no prefix) in
 * session state, so collapsing the catalog loses it — which is what "not persisted"
 * means here. (The DRAFT is different: it is guarded. See `onRequestClose` and the
 * unsaved-changes line.)
 *
 * THE CHECKLIST IS GROUPED, BECAUSE THE MEASURED ONE HAS 396 ROWS. A flat run of
 * 396 equal checkboxes is a wall rather than a list, so the listed candidates are
 * grouped by the id's own first segment (the vendor in every namespaced listing:
 * `openai` in `openai/gpt-4o`), each group heading stating how many rows it
 * introduces, with the count of listed rows stated above them and the filter the
 * way through. The grouping is a RENDERING of facts the endpoint already stated —
 * no candidate is dropped, reordered or relabelled, and ids that declare no
 * segment simply have no heading drawn above them. A candidate whose id the
 * catalog already declares still keeps `data-present`: its box is inert and its
 * row falls back to the quieter ink, because the draft's own entry wins by
 * contract when the ticked candidates are merged.
 *
 * `models` IS WRITTEN AS A WHOLE ARRAY. Merging happens in the draft layer only;
 * the write states the entire array. That is also why the draft is seeded from the
 * STORED entries rather than from the typed view: `modelsOf` answers the facts the
 * page states (which models exist, in order), but a draft rebuilt from its four
 * fields alone would delete whatever else an entry declares — `input` on the pi-ai
 * adapter, a field a later release adds — the moment the user saved anything.
 *
 * @module dsh-rabbit-model-picker/client/ModelCatalog
 */

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
import { injectCatalogStyles } from './catalogStyles.ts'

/** The wire's own name for the level that turns reasoning off. */
const OFF_LEVEL = 'off'

/** The fields this editor owns; every other field of a stored entry is preserved. */
const EDITED_FIELDS: readonly string[] = ['id', 'name', 'contextWindow', 'maxTokens', 'reasoningEfforts']

/**
 * The model well whose Escape key this panel owns, when the event started inside
 * one. The roster can have several wells open at once, and Escape must close the
 * INNERMOST thing first: a model's well, then the discovery checklist, then (by
 * bubbling to the section) the whole catalog. The row carries its draft key in
 * `data-key`, so the handler can name the exact model without a second lookup map.
 */
const MODEL_ROW_SELECTOR = '.dmc-model-row'

/** The key added rows get; seeded rows use their position, so a reload remounts nothing. */
let addedKeySeed = 0

/**
 * The key for a row the user just added.
 * @returns a key that cannot collide with a seeded one.
 */
function nextAddedKey(): string {
  addedKeySeed += 1
  return `a${addedKeySeed}`
}

/**
 * Whether a value is a plain record.
 *
 * Both `modelConfigModel.ts` and `params.ts` keep an equivalent one-liner private,
 * and neither of the two frozen pure functions exposes one, so the catalog carries
 * its own rather than reaching into either module's internals.
 * @param value - the value to test.
 * @returns whether it can be read by key.
 */
function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The record view of a value, when it has one.
 * @param value - the value to read.
 * @returns the record, or undefined.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecordValue(value) ? value : undefined
}

/** One reasoning level in a model's draft. */
interface DraftReasoning {
  readonly level: string
  readonly value: string
}

/**
 * One model as the catalog edits it.
 *
 * `extra` carries every field this editor does not own, because the write replaces
 * the whole `models` array: a draft rebuilt from the four editable fields alone
 * would delete `input` (pi-ai's modality list) from every entry it touched.
 *
 * The capacity fields are held as TEXT — what the user is typing is not a number
 * until it parses — and `storedWindow` / `storedTokens` remember the number the
 * text came from, so a value this editor cannot re-parse still round-trips.
 */
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

/** The fields of one draft row a handler may replace. */
interface ModelEdit {
  readonly id?: string
  readonly name?: string
  readonly contextWindow?: string
  readonly maxTokens?: string
  readonly reasoning?: readonly DraftReasoning[]
  readonly open?: boolean
}

/**
 * The discovery sub-flow's state.
 *
 * Every arm of this union lives in component state and dies with the region: the
 * candidate list, the ticks, and the Host's refusal are session facts, never
 * settings.
 */
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

/**
 * The stored `models` array of one profile, before any typing.
 *
 * Read raw rather than through `modelsOf` because the draft has to preserve the
 * fields this editor does not own (see the module note).
 * @param value - the namespace's effective value.
 * @param settingsPath - path of this provider's profile.
 * @returns the stored array, or an empty list when there is none.
 */
function rawModelsOf(value: unknown, settingsPath: readonly string[]): readonly unknown[] {
  const list = readPath(value, [...settingsPath, 'models'])
  return Array.isArray(list) ? list : []
}

/**
 * The reasoning rows a stored value declares.
 * @param value - the stored `reasoningEfforts` value.
 * @returns one row per declared level, in declaration order.
 */
function reasoningRowsOf(value: unknown): readonly DraftReasoning[] {
  const record = asRecord(value)
  if (record === undefined) return []
  return Object.entries(record).map(([level, raw]) => ({
    level,
    value: typeof raw === 'string' ? raw : '',
  }))
}

/**
 * One draft row seeded from a stored entry.
 * @param raw - the stored entry.
 * @param key - the row's React key.
 * @returns the draft row.
 */
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

/**
 * The draft rows one stored array seeds.
 * @param raw - the stored `models` array.
 * @returns one row per stored record, skipping anything that is not one.
 */
function seedModels(raw: readonly unknown[]): readonly DraftModel[] {
  const models: DraftModel[] = []
  raw.forEach((item, index) => {
    if (!isRecordValue(item)) return
    models.push(seedModel(item, `m${index}`))
  })
  return models
}

/**
 * One discovered candidate as a draft row.
 *
 * `inputModalities` is deliberately NOT adopted: the settings field it would have
 * to land in is the adapter's own (`input` on pi-ai, `inputModalities` on the
 * DeepSeek namespace), and the pi-ai listing never publishes it anyway, so writing
 * a guess would be a claim about a model that nothing verified. A new entry
 * therefore declares only what the listing actually stated.
 * @param candidate - the Host's candidate.
 * @returns the draft row.
 */
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

/** One group of the discovery checklist. */
interface CandidateGroup {
  /** The id's own first segment, or '' for ids that declare none. */
  readonly label: string
  /** The group's candidates, in the endpoint's own order. */
  readonly items: readonly DiscoveredModel[]
}

/**
 * The listed candidates, grouped by the id's own first segment.
 *
 * The measured deployment lists 396 candidates, and a flat run of 396 equal
 * checkboxes is a wall rather than a list. The first segment of a namespaced id
 * (`openai` in `openai/gpt-4o`) is a fact the endpoint itself stated, so it can
 * carry the hierarchy without inventing one. Nothing is dropped, reordered or
 * relabelled: the groups keep first-appearance order and each keeps its
 * candidates in the order the endpoint listed them. Ids that declare no segment
 * collect into one unnamed group, whose heading the renderer does not draw.
 * @param candidates - the candidates currently listed.
 * @returns the groups, in first-appearance order.
 */
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

/**
 * The token count a capacity field means.
 *
 * `parseContext` owns the parameter panel's range and spellings, so it is asked
 * first and both surfaces accept the same text. It is deliberately not the only
 * reader: a catalog the official page wrote outside that range must survive an
 * edit made here, so a field still holding exactly the text it was seeded with
 * keeps the number it came from instead of being refused (which would block every
 * save in the region until the user destroyed a value the adapter was using).
 * @param text - the field's text.
 * @param stored - the number the seed text came from, when it was one.
 * @returns the count, undefined when the field is empty, null when it is not a capacity.
 */
function capacityOf(text: string, stored: number | undefined): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const parsed = parseContext(trimmed)
  if (parsed !== null) return parsed
  if (stored !== undefined && trimmed === formatContext(stored)) return stored
  return null
}

/**
 * The two capacity fields one draft row would write.
 * @param model - the draft row.
 * @returns each count, absent when the field is empty or not a capacity.
 */
function capacitiesOf(model: DraftModel): { readonly contextWindow: number | undefined; readonly maxTokens: number | undefined } {
  const contextWindow = capacityOf(model.contextWindow, model.storedWindow)
  const maxTokens = capacityOf(model.maxTokens, model.storedTokens)
  return {
    contextWindow: contextWindow === null ? undefined : contextWindow,
    maxTokens: maxTokens === null ? undefined : maxTokens,
  }
}

/**
 * The `reasoningEfforts` dict one draft row declares.
 * @param rows - the draft's level rows.
 * @returns the dict, or undefined when the row declares no levels at all.
 */
function reasoningValueOf(rows: readonly DraftReasoning[]): Record<string, string> | undefined {
  if (rows.length === 0) return undefined
  const table: Record<string, string> = {}
  for (const row of rows) table[row.level] = row.value
  return table
}

/**
 * The catalog shape `validateModels` reads.
 * @param model - the draft row.
 * @returns the entry as this editor would write it.
 */
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

/**
 * The stored shape of one draft row: the edited fields plus everything preserved.
 * @param model - the draft row.
 * @returns the entry the write will carry.
 */
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

/**
 * A key-order-independent rendering of a value.
 *
 * `pathOps` compares with `JSON.stringify`, which is sensitive to key order; the
 * catalog needs its own "did anything move" answer that is not, so that a draft
 * which merely re-serializes the stored fields (extra fields first) does not read
 * as an edit and does not make the save button claim there is something to write.
 * @param value - the value to render.
 * @returns a canonical string.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isRecordValue(value)) {
    const entries = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

/**
 * The reasoning rule one model's levels must satisfy.
 *
 * The two halves are the official rule: a declared ladder needs at least one level
 * besides Off, and every level besides Off needs a value.
 * @param rows - the model's level rows.
 * @returns the copy key of the failure, or undefined when the rows are valid.
 */
function reasoningProblemOf(rows: readonly DraftReasoning[]): ConfigKey | undefined {
  if (rows.length === 0) return undefined
  const decisive = rows.filter(row => row.level !== OFF_LEVEL)
  if (decisive.length === 0) return KEYS['config.reasoning.needsLevel']
  if (decisive.some(row => row.value.trim() === '')) return KEYS['config.reasoning.valueRequired']
  return undefined
}

/**
 * Every draft row the catalog would refuse to write.
 * @param models - the draft catalog.
 * @param t - the surface's translator.
 * @returns the sentence to show on each offending row, by row key.
 */
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

/** Props the 模型配置 page dispatches its catalog region with. */
export interface ModelCatalogProps {
  /** The provider row this catalog belongs to. */
  readonly row: ModelConfigRow
  /** The page's fact store: the catalog reads and writes through it, never around it. */
  readonly store: ModelConfigStore
  /** The surface's translator. */
  readonly t: Translate
  /**
   * Report the draft's dirty state to the page, which owns the collapse guard:
   * the page asks whether to discard before it removes this region.
   */
  readonly onDirtyChange: (dirty: boolean) => void
  /** Ask the page to collapse; the page decides whether the draft needs confirming. */
  readonly onRequestClose: () => void
  /** Whether the page is holding a discard confirmation open. */
  readonly confirming: boolean
  /** Dismiss that confirmation and keep editing. */
  readonly onKeepEditing: () => void
  /** Discard the draft and proceed with the page's pending action. */
  readonly onDiscard: () => void
}

/**
 * The model catalog for one provider row, as the row's expanded region.
 * @param props - the row, the store, the translator, and the page's collapse guard.
 * @returns the catalog region.
 */
export function ModelCatalog(props: ModelCatalogProps): ReactElement {
  const { row, store, t, onRequestClose } = props
  // The snapshot is named as the server snapshot too: this surface only ever runs
  // in the browser, but the third argument is what lets a plain renderer render
  // the catalog at all (without it React refuses with "Missing getServerSnapshot"),
  // and it makes the markup assertable without a DOM.
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const settingsNs = row.entry.settingsNs
  const settingsPath = row.entry.settingsPath
  const modelsPath = useMemo(() => [...settingsPath, 'models'], [settingsPath])
  const namespace = snapshot.namespaces.get(settingsNs)
  const writable = snapshot.writable

  // The sheet is injected by the surface that renders it, so the catalog is styled
  // wherever it is mounted and the injection stays idempotent (the injector
  // replaces its own element and the disposer removes only what it created).
  useEffect(() => injectCatalogStyles(), [])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // The region is inside the provider row, so focus is NOT moved on open: the
  // model cell that opened it keeps focus and Tab continues into the region. When
  // the page collapses it, the page returns focus to that cell.
  const panelRef = useRef<HTMLDivElement | null>(null)

  const levelChoices = useMemo(
    () => reasoningLevelChoices(namespace),
    [namespace],
  )

  const raw = useMemo(() => rawModelsOf(namespace?.value, settingsPath), [namespace, settingsPath])
  const seed = useMemo(() => seedModels(raw), [raw])
  const storedModels = useMemo(() => modelsOf(namespace?.value, settingsPath), [namespace, settingsPath])

  // `draft === null` means "nothing typed yet": the rows then mirror what is
  // stored, so a reload from an unrelated push cannot overwrite an edit in
  // progress (the same reason the retry card keeps its two fields as drafts).
  const [draft, setDraft] = useState<readonly DraftModel[] | null>(null)
  const models = draft ?? seed
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<Discovery>({ kind: 'idle' })

  const baseline = useMemo(() => canonical(raw.filter(isRecordValue)), [raw])
  const dirty = canonical(models.map(storedValueOf)) !== baseline
  const problems = useMemo(() => problemsOf(models, t), [models, t])
  const invalid = problems.size > 0

  // The page owns the collapse guard (it also owns the pending switch target), so
  // the region reports its draft state and clears it on unmount: a stale "dirty"
  // left behind by a removed region would make the next collapse ask a question
  // about a draft that no longer exists.
  useEffect(() => { props.onDirtyChange(dirty) }, [dirty, props.onDirtyChange])
  useEffect(() => () => { props.onDirtyChange(false) }, [props.onDirtyChange])

  /**
   * Escape, innermost first. It is a DOCUMENT CAPTURE listener, not a React
   * handler on the region, because the host settings dialog also closes on Escape
   * and its handler would win otherwise — the same ordering the old drawer recorded
   * (a bubble-phase document listener fires after the host's handler). Capture runs
   * first and consumes the keystroke, so one Escape closes one layer:
   *
   *   1. the provider's own key field owns its Escape (we return without stopping);
   *   2. an open model well closes, focus returns to that row's 编辑 door;
   *   3. an open discovery checklist closes, focus returns to 获取可用模型;
   *   4. the discard question is answered (keep editing);
   *   5. otherwise the page is asked to collapse the region (which may raise the
   *      same question when the draft is dirty).
   *
   * The handler reads the LATEST render through a ref, so it can be registered once
   * and still see the current draft and discovery state.
   */
  const escapeRef = useRef<(event: KeyboardEvent) => void>(() => {})
  escapeRef.current = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    const target = event.target instanceof Element ? event.target : null
    // The provider's settings well is a sibling, not a layer of this region; its
    // key field cancels itself and must not also lose the catalog.
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
      // Only an OPEN well is a layer to close. Without this guard, Escape on the
      // row's `编辑` door would keep being consumed by a well that is already
      // closed, and the region itself could never be collapsed from the keyboard.
      if (key !== null && model?.open === true) {
        modelRow.querySelector<HTMLElement>('.dmc-model-edit')?.focus()
        patch(rows => rows.map(entry => entry.key === key ? { ...entry, open: false } : entry))
        return
      }
    }
    if (discovery.kind !== 'idle') {
      // A refused or empty answer is session state and dies with the checklist;
      // closing the checklist is the gesture that says "I am done with this".
      panelRef.current?.querySelector<HTMLElement>('.dmc-discover')?.focus()
      setDiscovery({ kind: 'idle' })
      return
    }
    props.onRequestClose()
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent): void => { escapeRef.current(event) }
    document.addEventListener('keydown', listener, true)
    return () => { document.removeEventListener('keydown', listener, true) }
  }, [])

  /** Replace the draft rows, dropping any message that described the old ones. */
  const patch = (change: (rows: readonly DraftModel[]) => readonly DraftModel[]): void => {
    setNote(null)
    setDraft(current => change(current ?? seed))
  }

  /** Replace one draft row. */
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

  /** Append an empty row the user fills in by hand. */
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

  /** Drop one row. */
  const removeModel = (key: string): void => {
    patch(rows => rows.filter(row => row.key !== key))
  }

  /** Add one reasoning level, defaulting to the first choice this model does not use. */
  const addReasoning = (model: DraftModel): void => {
    const used = new Set(model.reasoning.map(row => row.level))
    const next = levelChoices.find(choice => choice !== OFF_LEVEL && !used.has(choice)) ?? OFF_LEVEL
    updateModel(model, { reasoning: [...model.reasoning, { level: next, value: '' }] })
  }

  /** Drop one reasoning level. */
  const removeReasoning = (model: DraftModel, index: number): void => {
    updateModel(model, { reasoning: model.reasoning.filter((_, position) => position !== index) })
  }

  /** Change one reasoning row. */
  const updateReasoning = (model: DraftModel, index: number, change: { level?: string; value?: string }): void => {
    const reasoning = model.reasoning.map((row, position) => position === index
      ? { level: change.level ?? row.level, value: change.value ?? row.value }
      : row)
    updateModel(model, { reasoning })
  }

  /**
   * The option list one level's select offers.
   *
   * The schema's own order leads, the level this select already holds is always
   * kept (so the control never shows a value it does not offer), Off is stated
   * explicitly because it is a protocol name rather than a schema entry, and
   * levels another row of the same model already uses are withheld: two rows for
   * one level would collapse into one dict key on write, silently dropping a value.
   * @param current - this row's level.
   * @param used - every level this model's other rows declare.
   * @returns the options.
   */
  const levelOptionsFor = (current: string, used: ReadonlySet<string>): readonly string[] => {
    const options = [...levelChoices]
    if (current !== OFF_LEVEL && !options.includes(current)) options.push(current)
    if (!options.includes(OFF_LEVEL)) options.push(OFF_LEVEL)
    return options.filter(level => level === current || !used.has(level))
  }

  /** Write one whole catalog, through the store's own fenced write. */
  const writeModels = async (next: readonly DraftModel[]): Promise<boolean> => {
    if (namespace === undefined) return false
    const profile = asRecord(readPath(namespace.value, settingsPath)) ?? {}
    // `pathOps` against the profile the catalog is showing, so only the fields that
    // moved become ops. `after` carries the effective profile plus the new array,
    // which is what keeps this write from unsetting a field it does not own.
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

  /** Commit the draft. */
  const save = (): void => {
    if (!writable || busy || !dirty || invalid) return
    void writeModels(models)
  }

  /**
   * Restore the provider's default catalog.
   *
   * The Host's own `models` key is unset, which is the whole reset: an absent list
   * means the adapter's catalog is inherited again.
   */
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

  // The endpoint facts a draft is interrogated with. Read off the effective
  // profile, never invented: no base URL is sent when the profile declares none,
  // and no api key is ever sent — the Host resolves the profile's own credential
  // reference itself, and this surface has no way to read a secret (A6).
  const profile = asRecord(readPath(namespace?.value, settingsPath))
  const baseURL = typeof profile?.baseURL === 'string' && profile.baseURL !== '' ? profile.baseURL : undefined
  const api = typeof profile?.api === 'string' && profile.api !== '' ? profile.api : undefined

  /** Step one: ask the endpoint what it serves. Nothing is written here. */
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
      // No listing at all: no checklist, no draft change, no write.
      setDiscovery({ kind: 'empty' })
      return
    }
    setDiscovery({ kind: 'ready', candidates, selected: new Set<string>(), query: '', note: null })
  }

  /** Step two: tick or untick one candidate. */
  const toggleCandidate = (id: string, checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    if (checked) selected.add(id)
    else selected.delete(id)
    setDiscovery({ ...discovery, selected, note: null })
  }

  /** Step three: merge the ticked candidates into the draft, then write once. */
  const adopt = async (): Promise<void> => {
    if (discovery.kind !== 'ready' || busy || !writable) return
    const existing = new Set(models.map(model => model.id))
    const additions: DraftModel[] = []
    for (const candidate of discovery.candidates) {
      if (!discovery.selected.has(candidate.id)) continue
      // The draft's own entry wins by contract: an id the catalog already
      // declares is never overwritten by what the endpoint listed.
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

  // The region's head states the catalog itself. It does NOT repeat the provider's
  // name and route id: the ledger row directly above it already states both, and a
  // second copy would make the expanded region read as a detached card again.
  // The field code names the block in the language's decorative grammar and the
  // right-end tally is the ROSTER's own count (the models this draft holds, not a
  // stored counter), so the region reads as a manifest page of the ledger.
  const rosterCount = String(models.length).padStart(2, '0')
  const catalogHead = (
    <div className="dmc-catalog-head">
      <div className="dmc-catalog-heading">
        <h2 className="dmc-catalog-title">{t(KEYS['config.models.label'])}</h2>
        <span className="dmc-catalog-status">
          {storedModels.length > 0
            ? t(KEYS['config.models.customized'])
            : t(KEYS['config.models.inherited'])}
        </span>
      </div>
      <span className="dmc-roster-count zmd-num">{rosterCount}</span>
      <button type="button" className="dmc-btn dmc-catalog-close" onClick={onRequestClose}>
        {t(KEYS['config.catalog.collapse'])}
      </button>
    </div>
  )

  // The collapse guard. It is a line in the region, not a dialog on top of it: the
  // page only removes a dirty draft after this line has been answered.
  const guardLine = props.confirming
    ? (
      <div className="dmc-catalog-guard" role="alert">
        <p className="dmc-catalog-notice">{t(KEYS['config.catalog.unsaved'])}</p>
        <div className="dmc-catalog-guard-actions">
          <button type="button" className="dmc-btn" onClick={props.onKeepEditing}>
            {t(KEYS['config.catalog.keepEditing'])}
          </button>
          <button type="button" className="dmc-btn dmc-btn-commit" onClick={props.onDiscard}>
            {t(KEYS['config.catalog.discard'])}
          </button>
        </div>
      </div>
    )
    : null

  /** The region: the row's expanded body, with the page's guard line above it. */
  const panel = (body: ReactNode, foot: ReactNode): ReactElement => (
    <div
      className="dmc-catalog-panel zmd-wash zmd-grain"
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

  // A route with no settings address has no profile to write and inherits the
  // adapter's own catalog; a namespace that was never described is reported as the
  // load failure it is rather than as an empty catalog.
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
  // How many of the listed candidates the catalog already declares. Counted off
  // `addable` rather than with a second pass, so the sentence above the checklist
  // can never disagree with what the checklist itself states.
  const listedInCatalog = visible.length - addable.length
  // The checklist's hierarchy. Drawn only when the listed ids actually fall into
  // more than one named group: a single group, or a listing whose ids declare no
  // vendor segment at all, reads better flat, and a heading that labels one
  // group of one is a title rather than a hierarchy.
  const listedGroups = groupByPrefix(visible)
  const grouped = listedGroups.length > 1

  /** Tick or untick every addable candidate currently listed. */
  const selectAll = (checked: boolean): void => {
    if (discovery.kind !== 'ready') return
    const selected = new Set(discovery.selected)
    for (const candidate of addable) {
      if (checked) selected.add(candidate.id)
      else selected.delete(candidate.id)
    }
    setDiscovery({ ...discovery, selected, note: null })
  }

  /**
   * The roster line for one model, plus the editor it opens.
   *
   * A MODEL IS A RECORD, NOT A FORM. Before §5.36 every model drawn here was four
   * always-open inputs plus two buttons — seven models meant twenty-eight boxes
   * before the reader had asked for anything. The roster states the record instead:
   * the id and its one door on line one, the display name and the two capacity facts
   * on line two (quiet ink), and the four fields + reasoning levels + remove entry
   * inside the well that the door opens. Same grammar as the page's provider rows,
   * one level narrower.
   */
  const modelRow = (model: DraftModel, position: number): ReactElement => {
    const message = problems.get(model.key)
    const wellId = `dmc-model-well-${model.key}`
    const used = new Set(model.reasoning.map(entry => entry.level))
    const disabled = !writable || busy
    const alias = model.name.trim()
    const context = model.contextWindow.trim()
    const output = model.maxTokens.trim()
    /** The roster's two-digit position mark (decoration over the real array order). */
    const manifestIndex = String(position).padStart(2, '0')
    return (
      <li
        key={model.key}
        className="dmc-model-row"
        data-key={model.key}
        data-invalid={message === undefined ? undefined : 'true'}
        data-well={model.open ? 'true' : undefined}
      >
        {/* Line one: identity and the row's one door. The two-digit number is the
            roster's position mark — decoration over the draft array's real order. */}
        <span className="dmc-model-index" aria-hidden="true">{manifestIndex}</span>
        <span className="dmc-model-ref" title={model.id === '' ? undefined : model.id}>
          {model.id === '' ? t(KEYS['config.model.newLabel']) : model.id}
        </span>
        <button
          type="button"
          className="dmc-model-edit"
          aria-expanded={model.open}
          aria-controls={wellId}
          onClick={() => { updateModel(model, { open: !model.open }) }}
        >
          {t(KEYS['config.edit'])}
        </button>
        {/* Line two: display name + capacity facts, all in the quiet ink. "Both
            overrides empty" is a fact too — the model uses the provider's own
            capacity, and the roster states that rather than leaving the line blank.
            The facts are a group of their own, right-aligned on the roster's right
            edge so the capacities form a tabular column down the list. */}
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
            {alias === '' && context === '' && output === ''
              ? <span className="dmc-model-fact">{t(KEYS['config.model.capacityDefault'])}</span>
              : null}
          </span>
        </span>
        {model.open ? (
          <div className="dmc-model-well" id={wellId}>
            {/* A draft problem is a fact about this record, so it is the first line
                of the well, where the fields that cause it are. */}
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
              {/* The level table and its explanation exist only once the model HAS
                  levels: a model that declares none shows the one action that adds
                  the first row, not an empty header and a paragraph about values it
                  does not have. */}
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
                    // Off needs no value, and the sentence says so; the stored value
                    // stays in the draft and is written back untouched.
                    disabled={disabled || entry.level === OFF_LEVEL}
                    placeholder={entry.level === OFF_LEVEL ? t(KEYS['config.reasoning.offPlaceholder']) : ''}
                    onChange={(event) => { updateReasoning(model, index, { value: event.target.value }) }}
                  />
                  <button
                    type="button"
                    className="dmc-btn dmc-reasoning-remove"
                    disabled={disabled}
                    onClick={() => { removeReasoning(model, index) }}
                  >
                    {t(KEYS['config.reasoning.remove'])}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="dmc-btn dmc-reasoning-add"
                disabled={disabled}
                onClick={() => { addReasoning(model) }}
              >
                {t(KEYS['config.reasoning.add'])}
              </button>
              {model.reasoning.length === 0
                ? null
                : <p className="dmc-reasoning-help">{t(KEYS['config.reasoning.helpText'])}</p>}
            </div>
            {/* The remove entry is the well's last line, away from the fields it
                must not be confused with. */}
            <button
              type="button"
              className="dmc-model-danger"
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
      {/* The head above states the catalog's own state (custom or inherited), so
          the body starts with the state that needs the reader: a read-only
          deployment, and the empty-catalog sentence. */}
      {writable ? null : <p className="dmc-catalog-notice">{t(KEYS['config.readOnly'])}</p>}
      {storedModels.length === 0 && models.length === 0
        ? <p className="dmc-catalog-notice">{t(KEYS['config.models.empty'])}</p>
        : null}
      <ul className="dmc-model-list">{models.map((model, index) => modelRow(model, index + 1))}</ul>
      {/* The roster's add entry: one full-width line under the last model, the same
          shape the page's own add entry uses. */}
      <button type="button" className="dmc-btn dmc-model-add" disabled={!writable || busy} onClick={addModel}>
        {'+ '}{t(KEYS['config.model.add'])}
      </button>

      {/* Step one of the discovery flow. The button is a READ, so a read-only
          deployment may still ask; only adopting waits on writability. */}
      <div className="dmc-discover-actions">
        <button
          type="button"
          className="dmc-btn dmc-discover"
          disabled={busy || discovery.kind === 'fetching'}
          onClick={() => { void fetchModels() }}
        >
          {t(KEYS['config.fetch.action'])}
        </button>
        {discovery.kind === 'fetching' ? <span className="dmc-catalog-status">{t(KEYS['config.fetch.fetching'])}</span> : null}
      </div>
      {discovery.kind === 'needsBaseUrl' ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.needsBaseUrl'])}</p> : null}
      {discovery.kind === 'empty' ? <p className="dmc-catalog-notice">{t(KEYS['config.fetch.empty'])}</p> : null}
      {/* The Host's refusal, verbatim: not localized, not prefixed. It lives in
          component state, so it is gone when the region collapses. */}
      {discovery.kind === 'error' ? <p className="dmc-catalog-error">{discovery.message}</p> : null}

      {/* Step two: the checklist. It exists only while a non-empty answer is held. */}
      {discovery.kind === 'ready' ? (
        <div className="dmc-discover-panel">
          <h3 className="dmc-catalog-section">{t(KEYS['config.fetch.title'])}</h3>
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
            {/* The count leads the tools, because the count is what the reader is
                choosing from: 396 candidates is a set to filter and take from
                rather than a list to read top to bottom. Tabular figures keep it
                from shifting as the filter narrows it. */}
            <span className="dmc-catalog-status">
              {t(KEYS['config.fetch.count'], {
                count: String(visible.length),
                inCatalog: String(listedInCatalog),
              })}
            </span>
            <button
              type="button"
              className="dmc-btn dmc-discover-tool"
              disabled={addable.length === 0 || allSelected}
              onClick={() => { selectAll(true) }}
            >
              {t(KEYS['config.fetch.selectAll'])}
            </button>
            <button
              type="button"
              className="dmc-btn dmc-discover-tool"
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
                  {/* A heading only labels a group that HAS a name: the ids
                      without a vendor segment are still listed, they simply
                      carry no heading above them. */}
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
                        {/* The label wraps the box rather than naming it by id:
                            the candidate id comes from the endpoint and is not a
                            legal fragment to build one from. */}
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
          {/* Step three: merge what is ticked into the draft and write once. */}
          <div className="dmc-discover-actions">
            <button
              type="button"
              className="dmc-btn dmc-btn-commit dmc-discover-adopt"
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
    <div className="dmc-catalog-foot">
      <button
        type="button"
        className="dmc-btn dmc-btn-commit"
        disabled={!writable || busy || !dirty || invalid}
        onClick={save}
      >
        {busy ? t(KEYS['config.applying']) : t(KEYS['config.apply'])}
      </button>
      <button
        type="button"
        className="dmc-btn"
        disabled={!writable || busy || !canReset}
        onClick={() => { void reset() }}
      >
        {t(KEYS['config.models.reset'])}
      </button>
      {note === null ? null : <span className="dmc-catalog-note">{note}</span>}
    </div>
  )

  return panel(body, foot)
}
