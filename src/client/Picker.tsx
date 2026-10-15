/**
 * The composer model seat: a trigger, one fact chip, and ONE card holding two
 * panes.
 *
 * What this replaces: the incumbent seat's root pane is a two-cell menu
 * (Model / Effort) that drills into a second pane each. Here the card is a
 * single surface with a provider rail on the left and the model list on the
 * right (§5.25) — picking a scope and picking a model are two gestures in one
 * place, so narrowing the list is never a mode the user has to notice, and
 * "全部" is a row of the same list rather than a separate exit.
 *
 * Each model row states its own facts as a read-only badge strip (text / image
 * input, the effort in force, the context window). Nothing inside a row is a
 * control: effort is edited in the model parameters panel, which is what the
 * row's badges now merely report. Search is always present (the incumbent only
 * shows it above four models) and it stays GLOBAL in scope: a query that matches
 * models outside the rail's scope states how many, with one click back to all of
 * them, instead of reading as "no such model".
 *
 * The chip beside the trigger is a FACT, not a control: it names the provider
 * the selected model lives on and never the scope (§5.25). Two models with the
 * same name really do exist under two providers (the row screenshots show
 * exactly that), so the fact is not redundant with the trigger.
 *
 * Data and submission ride the same per-session `ModelDirectory` the `/model`
 * popup uses, so a switch made in either entry is what the other shows next.
 * Everything external (catalog, current selection, pending, errors) is read
 * from that one store; only view state (open, query, highlight, the scope, the
 * toast) is local.
 *
 * @module dsh-rabbit-model-picker/client/Picker
 */

import {
  IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconCloseFillRegular,
  IconDataOutlineRegular, IconSettingsOutlineRegular, IconWarningOutlineRegular, Input, MenuGroup, MenuSurface,
  observeStickyMenuGroups, rankByName, StateDot, Tag, Toast, Tooltip, useAnchoredPosition,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type FocusEvent, type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { BadgeIcon } from './BadgeIcons.tsx'
import { observeSeatLoss } from './anchorLoss.ts'
import { badgeSpecsOf, BADGE_FACTS, type BadgeFact, type BadgeSpec } from './badges.ts'
import { effortLabelOf } from './effort.ts'
import { resolveRoute } from './params.ts'
import { ProviderRail, type ProviderOption } from './ProviderRail.tsx'
import { rowKey, type CatalogModel, type ModelSelection, type PickerProps, type ProviderGroup } from './contract.ts'
import { SettingsMenu } from './SettingsMenu.tsx'

/** Unplaced portal card: hidden but laid out at a fixed origin so measurement is real. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** One rendered model row. `key` is unique across groups. */
interface Row {
  readonly key: string
  readonly provider: string
  readonly model: CatalogModel
}

/** One rendered group: a provider group with its sticky heading. */
interface DisplayGroup {
  readonly id: string
  readonly label: string
  readonly rows: readonly Row[]
}

/**
 * Put the account and official providers first, preserving every other relative
 * order (the same ordering the `/model` popup uses).
 * @param groups - provider groups in catalog order.
 * @returns a sorted copy.
 */
function orderProviders(groups: readonly ProviderGroup[]): ProviderGroup[] {
  return groups.slice().sort((left, right) =>
    (left.id === 'deepseek-account' ? 0 : left.id === 'deepseek-official' ? 1 : 2)
      - (right.id === 'deepseek-account' ? 0 : right.id === 'deepseek-official' ? 1 : 2))
}

/**
 * Render the composer model seat.
 * @param props - the owner share (`locked`), the injected directory face, and the translators.
 * @returns the trigger and, while open, the single-level menu.
 */
export function Picker(props: PickerProps) {
  const { locked, available, directory, load, select, params, capabilities, translate, sessionId } = props
  const t = props.t ?? translate
  const state = useSyncExternalStore(
    subscribe => directory.subscribe(subscribe),
    () => directory.getSnapshot(),
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<number | null>(null)
  // The rail's scope is VIEW state with the lifetime of one open (§5.26), and it
  // is NOT remembered: every open starts from the provider this conversation runs
  // on, so the list always answers "what can I switch to from here" before it
  // answers "what exists". `null` is the unfiltered row (「全部」), which is what a
  // session with no model yet honestly has.
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [settingsAt, setSettingsAt] = useState(false)
  const [settingsSide, setSettingsSide] = useState<'top' | 'bottom'>('bottom')
  // The panel is the tallest surface in this seat, and the composer sits near
  // the viewport floor, so its own budget is measured from the gear instead of
  // being left to the generic 460px cap (which lets the footer note fall past
  // the viewport edge with no scrollbar to reach it).
  const [settingsBudget, setSettingsBudget] = useState<number | undefined>(undefined)
  const [selectionFocus, setSelectionFocus] = useState(false)
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)

  const toastSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsMenuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const groupsRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  // The rail's rows, in `providerOptions` order. The rail fills this array; the
  // seat reads it for its own `Tab` chain, whose first stop is the rail's.
  const railRefs = useRef<(HTMLButtonElement | null)[]>([])
  // The in-menu strip is the catalog-load surface; a rejected SELECTION
  // announces through the transient toast instead.
  const lastActionRef = useRef<'load' | 'select'>('load')
  const id = useId()

  // Which session the settings panel was opened on. The seat spans sessions, so
  // the panel closes when the session (not merely the model) changes under it.
  const [settingsSession, setSettingsSession] = useState(sessionId)
  if (settingsAt && settingsSession !== sessionId) {
    setSettingsAt(false)
    setSettingsSession(sessionId)
  }

  // The same boundary for the scope. The seat is NOT remounted when the
  // conversation changes — the model trigger keeps up only because the injected
  // directory is re-resolved per session — so a scope left over from the previous
  // conversation would be scoped to a provider the new one has nothing to do with.
  // The new session's own provider is the answer, not a remembered value: there is
  // nothing remembered any more (§5.26).
  const [scopeSession, setScopeSession] = useState(sessionId)
  if (scopeSession !== sessionId) {
    setScopeSession(sessionId)
    setProviderFilter(state.current?.provider ?? null)
  }

  const menuPos = useAnchoredPosition({
    open, anchorRef: triggerRef, panelRef: menuRef, side: 'top', align: 'end', gap: 8, margin: 12,
  })

  const orderedGroups = useMemo(() => orderProviders(state.groups), [state.groups])
  const catalogRows = useMemo<Row[]>(() => orderedGroups.flatMap(group =>
    group.models.map(model => ({ key: `${group.id}:${model.id}`, provider: group.id, model }))), [orderedGroups])
  const selectedKey = state.current === null ? null : rowKey(state.current.provider, state.current.model)
  const currentRow = catalogRows.find(row => rowKey(row.provider, row.model.id) === selectedKey) ?? null
  const currentReasoning = currentRow?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? currentReasoning?.defaultEffort
  const effortLabel = currentReasoning === undefined
    ? state.retainedEffort
    : effortLabelOf(currentReasoning, effectiveEffort, t)

  // The whole settings snapshot, read once for two purposes that must agree:
  // the gear's "edited" mark, and every row's read-only facts. Both derive from
  // this one snapshot through `resolveRoute`, so the badge strip and the panel
  // can never tell different stories about a route.
  const paramsSnapshot = useSyncExternalStore(
    subscribe => params.subscribe(subscribe),
    () => params.getSnapshot(),
  )
  // What each adapter PUBLISHED about its own routes. Read here for the same
  // reason, and one pass lower it feeds the same `badgeSpecsOf` call, so the
  // strip cannot say one thing on the row and another in the panel.
  const catalog = useSyncExternalStore(
    subscribe => capabilities.subscribe(subscribe),
    () => capabilities.getSnapshot(),
  )
  const declaredCurrent = resolveRoute(paramsSnapshot, state.current)?.declared === true

  // One pass per catalog revision resolves the facts of every row: the rows are
  // re-rendered on every highlight move, so nothing may resolve per render.
  const specsByRow = useMemo(() => {
    const map = new Map<string, readonly BadgeSpec[]>()
    for (const row of catalogRows) {
      map.set(rowKey(row.provider, row.model.id), badgeSpecsOf({
        address: resolveRoute(paramsSnapshot, { provider: row.provider, model: row.model.id }),
        capability: catalog.routes[rowKey(row.provider, row.model.id)],
        // The row states only whether the model CAN reason (reasoning metadata
        // present or not); the effort in force is the trigger's and the panel's
        // subject, so it is not passed here.
        reasoning: row.model.reasoning,
        t,
      }))
    }
    return map
  }, [catalog, catalogRows, paramsSnapshot, t])

  const trimmedQuery = query.trim()

  /**
   * Localize one provider id: the account provider carries a display name of
   * its own, everything else keeps the catalog name (also used for failures).
   * @param providerId - provider group id.
   * @param fallback - the catalog name.
   * @returns the display label.
   */
  const providerLabel = useCallback(
    (providerId: string, fallback: string): string =>
      providerId === 'deepseek-account' ? t('provider.account') : fallback,
    [t],
  )

  const groups = useMemo<DisplayGroup[]>(() => {
    // Narrowing happens here and nowhere else: it never reaches the store, so
    // the /model popup keeps listing every provider.
    const ranked = rankByName(catalogRows.map(row => row.model), trimmedQuery)
    const rankOf = new Map<CatalogModel, number>(ranked.map((model, index) => [model, index]))
    const bestRank = (candidate: DisplayGroup): number => candidate.rows.reduce(
      (best, row) => Math.min(best, rankOf.get(row.model) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER,
    )
    const scoped = providerFilter === null
      ? orderedGroups
      : orderedGroups.filter(group => group.id === providerFilter)
    return scoped
      .map(group => ({
        id: group.id,
        label: providerLabel(group.id, group.name),
        rows: rankByName(group.models, trimmedQuery).map(model => ({
          key: `${group.id}:${model.id}`, provider: group.id, model,
        })),
      }))
      .filter(group => group.rows.length > 0)
      // Group order follows relevance: the best-matching provider floats up,
      // and an empty query leaves catalog order untouched.
      .sort((left, right) => bestRank(left) - bestRank(right))
  }, [catalogRows, orderedGroups, providerFilter, providerLabel, trimmedQuery])

  // How many models each provider currently offers, counted for the rail's row.
  // Every row in the rail counts what you get, so the number here is the same
  // list the pick beside it shows.
  const modelCounts = useMemo(() => new Map(
    orderedGroups.map(group => [group.id, group.models.length]),
  ), [orderedGroups])

  // The rail's rows: the unfiltered scope first, then every loaded provider with
  // its model count, then the providers whose catalog failed (listed so a missing
  // provider is explained rather than mysterious). The unfiltered row is a real
  // member of this list (§5.25): the rail IS the scope, so it needs an "everything"
  // position — that row is what replaced the in-card "show all" strip, which was
  // the only way out of a narrowing while the scope lived in its own popover.
  // `session` marks the one this conversation actually runs on; the rail draws it
  // as a heavier name (the words are on the seat's chip, which stays on screen).
  const providerOptions = useMemo<ProviderOption[]>(() => [
    {
      id: null,
      label: t('provider.all'),
      count: catalogRows.length,
      failed: false,
      session: false,
    },
    ...orderedGroups.map(group => ({
      id: group.id,
      label: providerLabel(group.id, group.name),
      count: modelCounts.get(group.id) ?? group.models.length,
      failed: false,
      session: group.id === state.current?.provider,
    })),
    ...state.failures.map(failure => ({
      id: failure.id,
      label: providerLabel(failure.id, failure.name),
      count: 0,
      failed: true,
      session: failure.id === state.current?.provider,
    })),
  ], [catalogRows.length, modelCounts, orderedGroups, providerLabel, state.current, state.failures, t])

  /**
   * The display name of one provider id.
   * @param providerId - an id from the catalog or from the failures list.
   * @returns the name to paint; until the catalog loads there is no option to
   * take a name from, so the id stands in for itself (still localized when it
   * names the account).
   */
  const providerNameOf = useCallback(
    (providerId: string): string =>
      providerOptions.find(option => option.id === providerId)?.label
      ?? providerLabel(providerId, providerId),
    [providerLabel, providerOptions],
  )

  // The rail's single tab stop (§5.25). It follows the scope so `Tab` lands on
  // the row the user is actually on, and it never lands on a disabled row: a
  // failed provider cannot take focus, and parking the stop there would make the
  // whole pane unreachable from the keyboard.
  const railStop = useMemo(() => {
    const selected = providerOptions.findIndex(option => option.id === providerFilter && !option.failed)
    if (selected >= 0) return selected
    return providerOptions.findIndex(option => !option.failed)
  }, [providerOptions, providerFilter])

  // What the TRIGGER names (§5.26): the model AND the provider it lives on, as
  // `provider/model` — the provider prefix is not decoration, because two
  // providers really do offer the same model names (the row screenshots show
  // exactly that) and the seat has to say which one this conversation is on. The
  // effort follows it as its own segment (see the label composition below).
  const currentProviderId = state.current?.provider ?? null
  const currentProviderLabel = currentProviderId === null ? null : providerNameOf(currentProviderId)

  // Every provider this catalog knows about, failed ones included: they are
  // listed on the rail, so a scope naming one of them is still a scope the user
  // can see and leave. `null` is not in here — it is the unfiltered row, and the
  // cleanup below is guarded on it.
  const knownProviders = useMemo(() => new Set(providerOptions.map(option => option.id)), [providerOptions])

  // A scope this catalog does not offer (the provider was removed, or renamed
  // while the card was open) would narrow the list to nothing with no visible
  // reason, so it falls back to the session's own provider — the state a fresh
  // open starts from. Only once the catalog has answered: an unloaded catalog
  // knows no providers, and that must not be mistaken for "this one is gone".
  useEffect(() => {
    if (providerFilter === null || state.status !== 'ready') return
    if (knownProviders.has(providerFilter)) return
    setProviderFilter(currentProviderId)
  }, [currentProviderId, knownProviders, providerFilter, state.status])

  const rows = useMemo(() => groups.flatMap(group => group.rows), [groups])
  const indexOfRow = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows])
  const currentVisibleIndex = rows.findIndex(row =>
    row.provider === state.current?.provider && row.model.id === state.current.model)
  const activeIndex = rows.length === 0
    ? -1
    : Math.min(highlight ?? Math.max(0, currentVisibleIndex), rows.length - 1)
  const pending = state.pending
  const busy = pending !== null

  // The rail scopes the LIST; it never scopes the SEARCH. A query typed while one
  // provider is in scope is still a query about every model this catalog has, so
  // a hit under another provider is reported and reachable in one click instead
  // of reading as "no matching models" — the dead end that would make scoping
  // feel like losing models (§5.25). Counted only while both a scope and a query
  // are in force: unscoped, the list IS the whole answer.
  const elsewhereCount = useMemo(() => {
    if (providerFilter === null || trimmedQuery === '') return 0
    const matches = rankByName(catalogRows.map(row => row.model), trimmedQuery).length
    return Math.max(0, matches - rows.length)
  }, [catalogRows, providerFilter, rows.length, trimmedQuery])

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  // The gear's edited dot is a claim about the Host's config, so the settings
  // snapshot is read once per mounted seat — and re-read on every open (below),
  // because an edit made in the Settings → Models page must not stay invisible
  // until this plugin's next own write.
  useEffect(() => { params.ensure() }, [params])

  // Each open re-reads the Host. `read()` keeps the last good snapshot while the
  // answer is in flight and joins concurrent asks, so this costs one read per
  // open and changes nothing on screen until the fresher answer lands.
  useEffect(() => {
    if (!open) return
    void params.refresh()
  }, [open, params])

  // The row strip is the surface that states adapter-published facts, and it
  // exists only while the menu is open — so the read starts with the menu, and a
  // session that never opens it never spends the Remote call. `ensure` joins
  // repeated asks, so re-opening the menu costs nothing.
  useEffect(() => {
    if (!open) return
    capabilities.ensure(catalogRows.map(row => row.provider))
  }, [capabilities, catalogRows, open])

  useEffect(() => {
    if (!open && !settingsAt) return
    const closeOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) === true) return
      if (menuRef.current?.contains(target) === true) return
      if (settingsMenuRef.current?.contains(target) === true) return
      setOpen(false)
      setSettingsAt(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open, settingsAt])

  // The other way out. This seat is a `position: fixed` anchor, and its two
  // surfaces are portaled to the body, so the Host can remove the composer from
  // the page and leave them on screen with no anchor at all — a question card
  // does exactly this (§5.18). An outside CLICK dismisses for the same reason
  // this does: a popover whose trigger is gone is not a thing the user can still
  // be reading, and the panel is measured once, from a rect that no longer
  // describes anything. Both go together, because they already share the
  // one-at-a-time contract and a model card over a vanished composer is the same
  // defect as a parameter panel over one.
  useEffect(() => {
    if (!open && !settingsAt) return
    return observeSeatLoss(
      () => rootRef.current,
      () => {
        setOpen(false)
        setSettingsAt(false)
        // Focus is not handed back anywhere: the trigger the popover would
        // return it to is inside the box that just disappeared, and the Host's
        // card takes focus for its own answer controls.
        setSelectionFocus(false)
      },
    )
  }, [open, settingsAt])

  useEffect(() => {
    const viewport = groupsRef.current
    if (viewport === null) return
    return observeStickyMenuGroups(viewport)
  }, [available, open, groups])

  // The card is `visibility: hidden` until the anchor hook has measured it, and
  // a hidden input cannot take focus — so the search seat is focused on the
  // first commit that is actually placed. Later re-placements (scroll, resize)
  // must not steal the keyboard back, hence the containment guard.
  useLayoutEffect(() => {
    if (!open || menuPos === null) return
    const active = document.activeElement
    if (active instanceof Node && menuRef.current?.contains(active) === true) return
    searchRef.current?.focus()
  }, [open, menuPos])

  useLayoutEffect(() => {
    if (open && activeIndex >= 0) {
      rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex, rows])

  if (!available) return null

  const show = (): void => {
    setSelectionFocus(false)
    triggerRef.current?.focus()
    setQuery('')
    setHighlight(null)
    // Every open re-answers "which provider am I on": the scope starts from this
    // conversation's own provider, never from what the last open ended on (§5.26).
    // The highlight then lands on the current model inside it (see `activeIndex`),
    // which is the model the user is most likely to compare against.
    setProviderFilter(currentProviderId)
    // One card at a time: the parameter panel is a sibling composer control, not
    // a level inside the model card.
    setSettingsAt(false)
    setOpen(true)
    reload()
  }

  /**
   * Close the seat.
   * @param restoreFocus - hand the keyboard back to the trigger.
   */
  const close = (restoreFocus = false): void => {
    setOpen(false)
    setSettingsAt(false)
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  /**
   * Commit the rail's scope, and hand the keyboard to the list it just scoped.
   *
   * The hand-off is the point of the pane: scoping exists to pick a model from
   * inside it, so the next keystroke belongs in the search box rather than on the
   * row that was just clicked. Picking a scope never touches the Host — the
   * directory, `/model` and the trigger are all unaffected (§5.9).
   * @param providerId - the chosen provider, or null for every provider.
   */
  const pickProvider = (providerId: string | null): void => {
    setProviderFilter(providerId)
    // The list under a new scope is a different list; its own highlight starts at
    // the top rather than at an index carried over from the previous one.
    setHighlight(0)
    searchRef.current?.focus()
  }

  /**
   * Open or close the parameter panel, choosing the side the gear has room for.
   */
  const toggleSettings = (): void => {
    if (settingsAt) {
      setSettingsAt(false)
      return
    }
    const rect = settingsButtonRef.current?.getBoundingClientRect()
    if (rect !== undefined) {
      // The panel is the tallest surface here; estimate the three sections and
      // the note so a cramped composer opens it upward instead of off-screen.
      const estimated = 330
      const below = window.innerHeight - rect.bottom
      const top = below < estimated && rect.top > below ? 'top' : 'bottom'
      setSettingsSide(top)
      // The card gets its own height budget from the measured free space: the
      // 8px gap to the gear plus the 20px viewport margin the anchor hook keeps.
      const room = top === 'top' ? rect.top - 28 : below - 28
      setSettingsBudget(Math.max(240, Math.min(460, room)))
    }
    // One card at a time: this is a sibling of the model card, not a level in it.
    setOpen(false)
    setSettingsAt(true)
  }

  /**
   * Close the parameter panel.
   * @param restoreToGear - hand focus back to the gear.
   */
  const closeSettings = (restoreToGear: boolean): void => {
    setSettingsAt(false)
    if (restoreToGear) queueMicrotask(() => { settingsButtonRef.current?.focus() })
  }

  const closeAfterSelection = (): void => {
    setSelectionFocus(true)
    close(true)
  }

  /**
   * Announce a failed model operation through the seat's toast.
   * @param text - the already-localized message.
   */
  const showFailure = (text: string): void => {
    toastSeq.current += 1
    setToast({ seq: toastSeq.current, text })
  }

  const settleSelection = (result: Awaited<ReturnType<PickerProps['select']>>): void => {
    if (result === undefined) return
    if (result.ok) {
      if (rootRef.current !== null) closeAfterSelection()
      return
    }
    const { error } = result
    showFailure(error.code === 'session/writer-held'
      ? t('error.sessionInUse')
      : t('error.action', { message: `${error.code}: ${error.message}` }))
  }

  const submit = (selection: ModelSelection): void => {
    lastActionRef.current = 'select'
    // Rows a selection in flight disables cannot hold the keyboard; the trigger
    // does, so the card's keys still reach the menu.
    setSelectionFocus(true)
    triggerRef.current?.focus()
    // A transport-level failure REJECTS rather than answering { ok: false };
    // without this catch it would be an unhandled rejection and a silent
    // nothing on screen, instead of the refusal toast a Host-side rejection
    // takes.
    void select(selection).then(settleSelection).catch((error: unknown) => {
      showFailure(t('error.action', { message: error instanceof Error ? error.message : String(error) }))
    })
  }

  const choose = (row: Row): void => {
    if (state.current?.provider === row.provider && state.current.model === row.model.id) {
      closeAfterSelection()
      return
    }
    // A plain row pick keeps the adapter's own default effort.
    submit({ provider: row.provider, model: row.model.id })
  }

  /**
   * The row that currently holds DOM focus.
   * @returns its flat index, or null when focus is elsewhere (the search box).
   */
  const focusedIndexOf = (): number | null => {
    const active = document.activeElement
    if (active === null) return null
    const rowIndex = rowRefs.current.findIndex(element => element === active)
    return rowIndex === -1 ? null : rowIndex
  }

  /**
   * Move the keyboard along the card's own focus chain, in the order the card
   * renders it: the provider rail's single stop, then the search box, then each
   * model row. The rows carry no controls of their own any more — a row is one
   * target, and effort is a fact it states, not a thing it does. The rail is one
   * stop rather than a dozen because it is a listbox: its own arrows move within
   * it. Traversal never leaves the card; the ends wrap, and stepping back off the
   * chain's first element closes the seat like Escape does.
   * @param delta - +1 forward, -1 backward.
   */
  const moveTab = (delta: number): void => {
    // The rail is the first pane of the card (left of the list on a wide card,
    // above it on a narrow one), so the chain starts there and follows the DOM.
    const chain: (HTMLElement | null)[] = [railRefs.current[railStop] ?? null, searchRef.current]
    rows.forEach((_row, index) => {
      chain.push(rowRefs.current[index] ?? null)
    })
    // A disabled control is not a tab stop — that is what `disabled` means to the
    // platform. The rail's rows are all disabled while a selection is in flight,
    // and a chain that kept one would swallow the keypress that lands on it
    // (`.focus()` on a disabled button does nothing), so `Shift+Tab` off the
    // search box would look dead for the length of the write.
    const elements = chain.filter(
      (element): element is HTMLElement =>
        element !== null && !(element instanceof HTMLButtonElement && element.disabled),
    )
    if (elements.length === 0) return
    const active = document.activeElement instanceof HTMLElement ? elements.indexOf(document.activeElement) : -1
    const next = active === -1 ? (delta > 0 ? 0 : elements.length - 1) : active + delta
    if (next < 0) {
      close(true)
      return
    }
    elements[next % elements.length]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    // The settings panel owns every key it consumes and stops it there; the rail
    // does the same for the arrows it owns.
    if (settingsAt) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      if (query !== '') {
        setQuery('')
        setHighlight(null)
        searchRef.current?.focus()
        return
      }
      close(true)
      return
    }
    if (!open) return
    const onSearch = document.activeElement === searchRef.current
    // Left steps out of the list and into the provider pane beside it. From the
    // search box that only holds while the box is empty: with a caret in text,
    // ArrowLeft is the caret's own key and must stay one.
    if (event.key === 'ArrowLeft' && (onSearch ? query === '' : focusedIndexOf() !== null)) {
      const stop = railRefs.current[railStop] ?? null
      if (stop !== null) {
        event.preventDefault()
        stop.focus()
      }
      return
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && rows.length > 0) {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      // With the search box focused the highlight moves on its own
      // (aria-activedescendant); otherwise the keyboard walks the rows.
      const base = highlight ?? activeIndex
      const next = (base + delta + rows.length) % rows.length
      if (onSearch) {
        setHighlight(next)
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' })
      } else {
        setHighlight(next)
        rowRefs.current[next]?.focus()
      }
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      // The ends of a long catalog are a keyboard's worth of ArrowDowns away;
      // the listbox pattern names these keys for exactly that.
      if (rows.length === 0) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : rows.length - 1
      setHighlight(next)
      if (onSearch) {
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' })
      } else {
        rowRefs.current[next]?.focus()
      }
      return
    }
    if (event.key === 'Enter') {
      const index = focusedIndexOf()
      if (index !== null) {
        event.preventDefault()
        const row = rows[index]
        if (row === undefined || busy) return
        choose(row)
        return
      }
      if (onSearch && activeIndex >= 0) {
        const row = rows[activeIndex]
        if (row !== undefined && !busy) {
          event.preventDefault()
          choose(row)
        }
      }
      return
    }
    if (event.key === 'Tab') {
      // The card keeps the browser's traversal out while it is open.
      event.preventDefault()
      moveTab(event.shiftKey ? -1 : 1)
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const target = event.relatedTarget
    if (target instanceof Node && (
      rootRef.current?.contains(target) === true
      || menuRef.current?.contains(target) === true
      || settingsMenuRef.current?.contains(target) === true
    )) return
    // A focus move with no destination is not a departure: React detaches a
    // control that leaves the tree (every control of the parameter panel is
    // disabled while a settings write is in flight), and that unmount fires
    // focusout with a null relatedTarget. Treating it as a departure closed the
    // whole seat mid-write, on the Enter that submitted a new value.
    if (event.currentTarget.contains(document.activeElement) || document.activeElement === document.body) return
    close()
  }

  // The key to the strip's four columns, in the order they are drawn. The list
  // states four facts per row as bare glyphs; without this line a first-time
  // user has to hover a row to learn what any of them means, so the card says it
  // once, above the table it explains. Static calls (never a computed key): the
  // copy gate reads the dictionary entries out of the source, and a template
  // literal would leave all four keys looking unused.
  const legend: readonly { fact: BadgeFact; label: string }[] = [
    { fact: 'text', label: t('badge.key.text') },
    { fact: 'image', label: t('badge.key.image') },
    { fact: 'effort', label: t('badge.key.effort') },
    { fact: 'context', label: t('badge.key.context') },
  ]

  const waiting = state.current === null && state.status === 'loading'
  // The model's own name, without the provider: the parameter panel's accessible
  // name is about the model's parameters, and the provider is not one of them.
  const modelName = waiting
    ? t('trigger.loading')
    : currentRow?.model.name
      ?? (state.current === null ? t('trigger.fallback') : state.current.model)
  // What the trigger shows (§5.26): `provider/model`. One string rather than two
  // spans on purpose — it is the model's identity, and the label keeps the width
  // contract §5.1 gave it (the whole half collapses under the composer's narrow-row
  // variable, and the tail ellipsizes). The provider is a prefix, so a truncated
  // label still says WHICH provider it belongs to.
  const triggerLabel = currentProviderLabel === null ? modelName : `${currentProviderLabel}/${modelName}`
  // The effort in force follows as its own segment: it is a parameter, it is stated
  // by the row's badge and edited in the panel, and it holds one short word.
  const triggerAria = waiting
    ? t('trigger.loading')
    : state.current === null || currentProviderLabel === null
      ? t('trigger.selectAria')
      : effortLabel === undefined
        ? t('trigger.aria', { provider: currentProviderLabel, model: modelName })
        : t('trigger.ariaEffort', { provider: currentProviderLabel, model: modelName, effort: effortLabel })
  const settingsTitle = state.current === null
    ? t('settings.openNoModel')
    : declaredCurrent
      ? `${t('settings.open')} · ${t('settings.openDeclared')}`
      : t('settings.open')

  rowRefs.current = []

  return (
    <div
      ref={rootRef}
      className="dmp-root"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onMouseDown={(event) => {
        // WebKit blurs a focused control before click unless the mousedown keeps it.
        if (event.target instanceof Element && event.target.closest('button,[role="menuitemradio"]') !== null) {
          event.preventDefault()
        }
      }}
    >
      {/* Narrow rows drop the text through the composer's own display variables;
          the bubble is hover/focus only, so it is the one place the full label
          stays readable there. It repeats the model's identity — provider and
          name — not the effort: the effort is the settings panel's subject. */}
      <Tooltip label={triggerLabel} side="top" align="end" portal disabled={open}>
        <button
          ref={triggerRef}
          type="button"
          className={open ? 'dmp-trigger dmp-trigger-open' : 'dmp-trigger'}
          aria-label={triggerAria}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          aria-busy={busy}
          data-selection-focus={selectionFocus ? '' : undefined}
          onBlur={() => { setSelectionFocus(false) }}
          disabled={locked}
          onClick={() => {
            if (open) close(true)
            else show()
          }}
        >
          <IconDataOutlineRegular className="dmp-trigger-icon" size={16} />
          <span className="dmp-trigger-label">{triggerLabel}</span>
          {!waiting && effortLabel !== undefined && (
            <span className="dmp-trigger-effort">{effortLabel}</span>
          )}
          {busy
            ? <StateDot state="ongoing" />
            : <IconChevronDownOutlineRegular className={open ? 'dmp-chevron dmp-chevron-open' : 'dmp-chevron'} />}
        </button>
      </Tooltip>

      {/* Parameters of the model in use. It sits to the trigger's RIGHT, and it is
          icon-only because the composer's own display variables are about the model
          label; the gear therefore keeps its accessible name from the label, not
          from CSS. Its subject is the MODEL (the provider is not a parameter), so
          it names the model alone even though the trigger beside it shows both. */}
      <Tooltip label={settingsTitle} side="top" align="end" portal disabled={settingsAt}>
        <button
          ref={settingsButtonRef}
          type="button"
          className={settingsAt ? 'dmp-settings-button dmp-settings-open' : 'dmp-settings-button'}
          aria-label={state.current === null
            ? t('settings.openNoModel')
            : t('settings.openAria', { model: modelName })}
          aria-haspopup="menu"
          aria-expanded={settingsAt}
          aria-controls={settingsAt ? `${id}-settings` : undefined}
          data-edited={declaredCurrent ? '' : undefined}
          data-selection-focus={settingsAt ? '' : undefined}
          // Nothing to parameterize before a model is selected; the tooltip says so.
          disabled={locked || state.current === null}
          onClick={toggleSettings}
        >
          <IconSettingsOutlineRegular className="dmp-settings-icon" size={16} />
        </button>
      </Tooltip>

      {/* Portaled to body so the sidebar and the columns' overflow clips cannot
          crop the card; synthetic events still bubble through this React
          subtree, keeping onKeyDown/onBlur live. */}
      {open && createPortal(
        <MenuSurface
          ref={menuRef}
          id={`${id}-menu`}
          className={menuPos === null ? 'dmp-menu dmp-card' : 'dmp-menu dmp-card dmp-menu-in dmp-from-top'}
          style={menuPos ?? MEASURE_STYLE}
          role="group"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {/* The rail is the card's left pane and the only place the list's scope
              is chosen; on a narrow card it lays out as a strip above the list
              (same DOM, same a11y tree — the breakpoint is CSS only). */}
          <ProviderRail
            options={providerOptions}
            current={providerFilter}
            stopIndex={railStop}
            busy={busy}
            t={t}
            refs={railRefs}
            onPick={pickProvider}
            onEnterList={() => { searchRef.current?.focus() }}
          />

          <div className="dmp-models">
            <div className="dmp-search-row">
              <Input
                ref={searchRef}
                className={query === '' ? 'dmp-search' : 'dmp-search dmp-search-with-query'}
                type="text"
                role="searchbox"
                aria-label={t('search.placeholder')}
                aria-controls={`${id}-models`}
                aria-activedescendant={activeIndex < 0 ? undefined : `${id}-row-${activeIndex}`}
                placeholder={t('search.placeholder')}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setHighlight(0)
                }}
              />
              {query !== '' && (
                <button
                  type="button"
                  className="dmp-search-clear"
                  aria-label={t('search.clear')}
                  disabled={busy}
                  onClick={() => {
                    setQuery('')
                    setHighlight(null)
                    searchRef.current?.focus()
                  }}
                >
                  <IconCloseFillRegular />
                </button>
              )}
            </div>

            {/* The table's head: no rows, no table, no key. It sits here rather
                than inside the scroll viewport so the words stay put while the
                rows move — the same reason a real table head does. */}
            {rows.length > 0 && (
              <div className="dmp-legend" role="note" aria-label={t('badge.keyAria')}>
                {legend.map(item => (
                  <span className="dmp-legend-item" key={item.fact}>
                    <span className="dmp-legend-icon">
                      <BadgeIcon fact={item.fact} className="dmp-badge-icon" />
                    </span>
                    <span className="dmp-legend-word">{item.label}</span>
                  </span>
                ))}
              </div>
            )}

            {state.status === 'loading' && (
              <div className="dmp-status" role="status">
                <StateDot state="ongoing" />
                <span>{t('status.loading')}</span>
              </div>
            )}
            {/* A query that matches models OUTSIDE the rail's scope: the list below
                is about to say "no matching models" about models this catalog has,
                so the count and the one-click way back to every provider are what
                keep a scope from reading as a lost catalog. The rail states the
                scope itself (its selected row), so this strip is not a scope
                label — it only exists when there is something to go to. */}
            {elsewhereCount > 0 && (
              <div className="dmp-filter-hint" role="status">
                <span>{t('provider.elsewhere', { count: String(elsewhereCount) })}</span>
                <button
                  type="button"
                  className="dmp-filter-clear"
                  disabled={busy}
                  onClick={() => { pickProvider(null) }}
                >
                  {t('provider.showAll')}
                </button>
              </div>
            )}
            {state.error !== null && lastActionRef.current === 'load' && (
              <div className="dmp-error">
                <IconWarningOutlineRegular className="dmp-error-icon" />
                <span>{t('error.action', { message: state.error })}</span>
                <button type="button" className="dmp-retry" onClick={reload}>{t('action.reload')}</button>
              </div>
            )}
            {state.failures.map(failure => (
              <div className="dmp-warning" key={failure.id}>
                <IconWarningOutlineRegular className="dmp-error-icon" />
                <span>
                  {t('warning.groupLoad', {
                    name: providerLabel(failure.id, failure.name),
                    message: failure.message,
                  })}
                </span>
                <button type="button" className="dmp-retry" onClick={reload}>{t('action.reload')}</button>
              </div>
            ))}

            <div
              ref={groupsRef}
              id={`${id}-models`}
              className="dmp-groups scrollable"
              role="menu"
              aria-label={t('menu.model')}
              hidden={rows.length === 0}
            >
              {groups.map(group => (
                <MenuGroup key={group.id} label={group.label}>
                  {group.rows.map((row) => {
                    const index = indexOfRow.get(row.key) ?? -1
                    const selected = row.provider === state.current?.provider && row.model.id === state.current.model
                    // The facts of this route, resolved once per catalog/settings
                    // revision: the row only renders them.
                    const specs = specsByRow.get(rowKey(row.provider, row.model.id)) ?? []
                    const facts = specs.map(spec => spec.sentence).join(t('settings.listJoin'))
                    // The strip shows only the facts the model actually has. An
                    // `off` fact (no image input, no declared level) used to read
                    // as a slashed glyph inside a capsule; with the capsule gone
                    // it is a single dim slashed glyph, the weakest possible way
                    // to say "this model does not do X" — so the strip drops it.
                    // The row's aria-label and title keep the FULL list: "does not
                    // support image input" is still a fact about the model, it
                    // just is not worth a near-invisible mark in the row.
                    const shown = specs.filter(spec => !spec.off)
                    const shownByFact = new Map(shown.map(spec => [spec.fact, spec]))
                    const rowPending = pending !== null
                      && pending.provider === row.provider && pending.model === row.model.id
                    return (
                      <div
                        key={row.key}
                        ref={(element) => { rowRefs.current[index] = element }}
                        id={`${id}-row-${index}`}
                        role="menuitemradio"
                        aria-checked={selected}
                        // The badge strip is decoration plus values ("High", "128K");
                        // the row's own name carries the whole sentence instead, so a
                        // screen reader hears "model: facts", not a bag of numbers.
                        aria-label={facts === ''
                          ? row.model.name
                          : t('badge.rowAria', { model: row.model.name, facts })}
                        aria-disabled={busy || undefined}
                        data-active={index === activeIndex ? '' : undefined}
                        className="dmp-row"
                        tabIndex={-1}
                        onMouseDown={() => { rowRefs.current[index]?.focus() }}
                        onMouseMove={busy || index === activeIndex ? undefined : () => { setHighlight(index) }}
                        onClick={() => { if (!busy) choose(row) }}
                      >
                        <span className="dmp-row-copy">
                          <span className="dmp-row-name" title={row.model.name}>{row.model.name}</span>
                          {shown.length > 0 && (
                            <span className="dmp-badges" title={facts} aria-hidden="true">
                              {/* ONE TRACK PER FACT, always all four, in canonical
                                  order. A fact this model does not have leaves its
                                  own track empty instead of pulling its neighbours
                                  left: that is what makes the four columns line up
                                  across every row (the eye reads a spec sheet, not
                                  a bag of glyphs), and what keeps the name column —
                                  and therefore the ellipsis point — identical on
                                  every row. The empty track states the absence by
                                  position; the row's title and aria-label still
                                  spell it out in words. */}
                              {BADGE_FACTS.map(fact => {
                                const spec = shownByFact.get(fact)
                                if (spec === undefined) {
                                  return <span className="dmp-badge-slot" key={fact} />
                                }
                                // `Tag` renders a span, never a button: a fact badge
                                // cannot be clicked into anything, by construction.
                                // Every shown badge is the SAME two-cell mark: the
                                // icon cell states which fact, the text cell names
                                // its value (or stays empty for the yes/no ones).
                                // Only `on` facts reach here (see `shown`), so the
                                // tone is always the neutral one.
                                return (
                                  <Tag
                                    key={spec.fact}
                                    tone="neutral"
                                    className="dmp-badge"
                                  >
                                    <span className="dmp-badge-fact">
                                      <BadgeIcon fact={spec.fact} className="dmp-badge-icon" />
                                    </span>
                                    {spec.value !== '' && <span className="dmp-badge-value">{spec.value}</span>}
                                  </Tag>
                                )
                              })}
                            </span>
                          )}
                        </span>
                        <span className="dmp-check">
                          {rowPending
                            ? <StateDot state="ongoing" />
                            : selected ? <IconCheckOutlineRegular /> : null}
                        </span>
                      </div>
                    )
                  })}
                </MenuGroup>
              ))}
            </div>

            {state.status === 'ready' && rows.length === 0 && (
              <div className="dmp-empty" role="status">
                {/* One sentence per reason the list came up empty: the catalog
                    itself is empty, the rail's scope left nothing, or the query
                    matched nothing. The glyph is the seat's own mark, quiet by
                    tone; the sentence carries the reason. */}
                <IconDataOutlineRegular className="dmp-empty-icon" size={20} aria-hidden="true" />
                {/* Three reasons, three sentences — and the scope gets two of them,
                    because "this provider has no models" and "nothing in this
                    provider matches" are different facts and the rail makes the
                    second one easy to reach. */}
                <span>
                  {providerFilter !== null
                    ? trimmedQuery === '' ? t('empty.provider') : t('empty.providerSearch')
                    : catalogRows.length === 0 ? t('empty.models') : t('search.empty')}
                </span>
              </div>
            )}
          </div>
        </MenuSurface>,
        document.body,
      )}

      {settingsAt && createPortal(
        <SettingsMenu
          anchorRef={settingsButtonRef}
          panelRef={settingsMenuRef}
          idPrefix={id}
          side={settingsSide}
          directory={directory}
          params={params}
          capabilities={capabilities}
          busy={busy}
          maxHeight={settingsBudget}
          t={t}
          onSelect={(selection) => { submit(selection) }}
          onClose={closeSettings}
        />,
        document.body,
      )}

      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutlineRegular />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
