
import {
  IconCheckOutlineRegular, IconChevronDownOutlineRegular,
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
import { cardChainOf, stepChain } from './focusChain.ts'
import { resolveRoute } from './params.ts'
import { ProviderRail, type ProviderOption } from './ProviderRail.tsx'
import { rowKey, type CatalogModel, type ModelSelection, type PickerProps, type ProviderGroup } from './contract.ts'
import { SettingsMenu } from './SettingsMenu.tsx'

const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

interface Row {
  readonly key: string
  readonly provider: string
  readonly model: CatalogModel
}

interface DisplayGroup {
  readonly id: string
  readonly label: string
  readonly rows: readonly Row[]
}

function orderProviders(groups: readonly ProviderGroup[]): ProviderGroup[] {
  return groups.slice().sort((left, right) =>
    (left.id === 'deepseek-account' ? 0 : left.id === 'deepseek-official' ? 1 : 2)
      - (right.id === 'deepseek-account' ? 0 : right.id === 'deepseek-official' ? 1 : 2))
}

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
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [settingsAt, setSettingsAt] = useState(false)
  const [settingsSide, setSettingsSide] = useState<'top' | 'bottom'>('bottom')
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
  const railRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastActionRef = useRef<'load' | 'select'>('load')
  const id = useId()

  const [settingsSession, setSettingsSession] = useState(sessionId)
  if (settingsAt && settingsSession !== sessionId) {
    setSettingsAt(false)
    setSettingsSession(sessionId)
  }

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

  const paramsSnapshot = useSyncExternalStore(
    subscribe => params.subscribe(subscribe),
    () => params.getSnapshot(),
  )
  const catalog = useSyncExternalStore(
    subscribe => capabilities.subscribe(subscribe),
    () => capabilities.getSnapshot(),
  )
  const declaredCurrent = resolveRoute(paramsSnapshot, state.current)?.declared === true

  const specsByRow = useMemo(() => {
    const map = new Map<string, readonly BadgeSpec[]>()
    for (const row of catalogRows) {
      map.set(rowKey(row.provider, row.model.id), badgeSpecsOf({
        address: resolveRoute(paramsSnapshot, { provider: row.provider, model: row.model.id }),
        capability: catalog.routes[rowKey(row.provider, row.model.id)],
        reasoning: row.model.reasoning,
        t,
      }))
    }
    return map
  }, [catalog, catalogRows, paramsSnapshot, t])

  const trimmedQuery = query.trim()

  const providerLabel = useCallback(
    (providerId: string, fallback: string): string =>
      providerId === 'deepseek-account' ? t('provider.account') : fallback,
    [t],
  )

  const groups = useMemo<DisplayGroup[]>(() => {
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
      .sort((left, right) => bestRank(left) - bestRank(right))
  }, [catalogRows, orderedGroups, providerFilter, providerLabel, trimmedQuery])

  const modelCounts = useMemo(() => new Map(
    orderedGroups.map(group => [group.id, group.models.length]),
  ), [orderedGroups])

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

  const providerNameOf = useCallback(
    (providerId: string): string =>
      providerOptions.find(option => option.id === providerId)?.label
      ?? providerLabel(providerId, providerId),
    [providerLabel, providerOptions],
  )

  const railStop = useMemo(() => {
    const selected = providerOptions.findIndex(option => option.id === providerFilter && !option.failed)
    if (selected >= 0) return selected
    return providerOptions.findIndex(option => !option.failed)
  }, [providerOptions, providerFilter])

  const currentProviderId = state.current?.provider ?? null
  const currentProviderLabel = currentProviderId === null ? null : providerNameOf(currentProviderId)

  const knownProviders = useMemo(() => new Set(providerOptions.map(option => option.id)), [providerOptions])

  // Guarded on load: an unloaded catalog knows no providers, and "not read yet" must not be
  // mistaken for "this provider no longer exists".
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

  const elsewhereCount = useMemo(() => {
    if (providerFilter === null || trimmedQuery === '') return 0
    const matches = rankByName(catalogRows.map(row => row.model), trimmedQuery).length
    return Math.max(0, matches - rows.length)
  }, [catalogRows, providerFilter, rows.length, trimmedQuery])

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  useEffect(() => { params.ensure() }, [params])

  useEffect(() => {
    if (!open) return
    void params.refresh()
  }, [open, params])

  useEffect(() => {
    if (!open) return
    capabilities.ensure(catalogRows.map(row => row.provider))
  }, [capabilities, catalogRows, open])

  // The Host can take the composer off the page without unmounting it — an overlay question
  // card renders it `display: none` — which leaves this portal with no anchor at all. That is
  // why this outside click and `observeSeatLoss` below dismiss together, restoring no focus.
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

  useEffect(() => {
    if (!open && !settingsAt) return
    return observeSeatLoss(
      () => rootRef.current,
      () => {
        setOpen(false)
        setSettingsAt(false)
        setSelectionFocus(false)
      },
    )
  }, [open, settingsAt])

  useEffect(() => {
    const viewport = groupsRef.current
    if (viewport === null) return
    return observeStickyMenuGroups(viewport)
  }, [available, open, groups])

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
    setProviderFilter(currentProviderId)
    setSettingsAt(false)
    setOpen(true)
    reload()
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setSettingsAt(false)
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const pickProvider = (providerId: string | null): void => {
    setProviderFilter(providerId)
    setHighlight(0)
    searchRef.current?.focus()
  }

  const toggleSettings = (): void => {
    if (settingsAt) {
      setSettingsAt(false)
      return
    }
    const rect = settingsButtonRef.current?.getBoundingClientRect()
    if (rect !== undefined) {
      const estimated = 330
      const below = window.innerHeight - rect.bottom
      const top = below < estimated && rect.top > below ? 'top' : 'bottom'
      setSettingsSide(top)
      const room = top === 'top' ? rect.top - 28 : below - 28
      setSettingsBudget(Math.max(240, Math.min(460, room)))
    }
    setOpen(false)
    setSettingsAt(true)
  }

  const closeSettings = (restoreToGear: boolean): void => {
    setSettingsAt(false)
    if (restoreToGear) queueMicrotask(() => { settingsButtonRef.current?.focus() })
  }

  const closeAfterSelection = (): void => {
    setSelectionFocus(true)
    close(true)
  }

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
    setSelectionFocus(true)
    triggerRef.current?.focus()
    void select(selection).then(settleSelection).catch((error: unknown) => {
      showFailure(t('error.action', { message: error instanceof Error ? error.message : String(error) }))
    })
  }

  const choose = (row: Row): void => {
    if (state.current?.provider === row.provider && state.current.model === row.model.id) {
      closeAfterSelection()
      return
    }
    submit({ provider: row.provider, model: row.model.id })
  }

  const focusedIndexOf = (): number | null => {
    const active = document.activeElement
    if (active === null) return null
    const rowIndex = rowRefs.current.findIndex(element => element === active)
    return rowIndex === -1 ? null : rowIndex
  }

  const moveTab = (delta: number): void => {
    const panel = menuRef.current
    if (panel === null) return
    const step = stepChain(cardChainOf(panel), document.activeElement, delta)
    if (step.kind === 'close') {
      close(true)
      return
    }
    if (step.kind === 'focus') step.element.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
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
    // No destination is not a departure: React detaches a control that leaves the tree while
    // a settings write is in flight (every such control disables), and that unmount fires
    // focusout with a null relatedTarget. Treating it as departure closed the seat mid-write.
    if (event.currentTarget.contains(document.activeElement) || document.activeElement === document.body) return
    close()
  }

  const legend: readonly { fact: BadgeFact; label: string }[] = [
    { fact: 'text', label: t('badge.key.text') },
    { fact: 'image', label: t('badge.key.image') },
    { fact: 'effort', label: t('badge.key.effort') },
    { fact: 'context', label: t('badge.key.context') },
  ]

  const waiting = state.current === null && state.status === 'loading'
  const modelName = waiting
    ? t('trigger.loading')
    : currentRow?.model.name
      ?? (state.current === null ? t('trigger.fallback') : state.current.model)
  const triggerLabel = currentProviderLabel === null ? modelName : `${currentProviderLabel}/${modelName}`
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

  const scopeName = providerFilter === null ? t('provider.all') : providerNameOf(providerFilter)
  const scopeSub = providerFilter === null ? t('card.subAll') : t('card.subScoped')
  const scopeCount = t('card.count', { count: String(rows.length) })
  // The footer's job is to answer "is this all of it?", not only "how many". When a search or
  // a scope hides rows, it says BOTH numbers; when nothing is hidden it states the total once
  // rather than printing `4 / 4`, which reads as a page counter on a surface that has no pages.
  const hiddenRows = Math.max(0, catalogRows.length - rows.length)
  const footNote = hiddenRows === 0
    ? t('card.footTotal', { count: String(rows.length) })
    : t('card.footPart', { shown: String(rows.length), total: String(catalogRows.length) })
  const footKeys = groups.length > 1
    ? t('card.footProviders', { count: String(groups.length) })
    : ''
  // The rail's ordinals are live keys (`01`–`09` jump to that provider). A shortcut nobody is
  // told about is one nobody uses, so the footer states it — but only when at least two rows
  // are usable, because with one row there is nothing to jump between.
  const railKeys = providerOptions.filter(option => !option.failed).length > 1
    ? t('card.railKeys')
    : ''

  rowRefs.current = []

  return (
    <div
      ref={rootRef}
      className="dmp-root"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest('button,[role="menuitemradio"]') !== null) {
          event.preventDefault()
        }
      }}
    >
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
          data-selection-focus={settingsAt ? '' : undefined}
          disabled={locked || state.current === null}
          onClick={toggleSettings}
        >
          <IconSettingsOutlineRegular className="dmp-settings-icon" size={16} />
        </button>
      </Tooltip>

      {open && createPortal(
        <MenuSurface
          ref={menuRef}
          id={`${id}-menu`}
          className="dmp-menu dmp-card zmd-plate zmd-grain"
          data-scope={providerFilter === null ? 'all' : 'one'}
          style={menuPos ?? MEASURE_STYLE}
          role="group"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          <div className="dmp-card-head">
            <div className="dmp-card-identity">
              <p className="dmp-card-name">{scopeName}</p>
              <span className="dmp-card-sub">{scopeSub}</span>
            </div>
            <span className="dmp-card-count zmd-num">{scopeCount}</span>
          </div>

          <div className="dmp-card-body">
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
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>

            {state.status === 'loading' && (
              <div className="dmp-status" role="status">
                <StateDot state="ongoing" />
                <span>{t('status.loading')}</span>
              </div>
            )}            {elsewhereCount > 0 && (
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
                    const specs = specsByRow.get(rowKey(row.provider, row.model.id)) ?? []
                    const facts = specs.map(spec => spec.sentence).join(t('settings.listJoin'))
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
                              {BADGE_FACTS.map(fact => {
                                const spec = shownByFact.get(fact)
                                if (spec === undefined) {
                                  return <span className="dmp-badge-slot" key={fact} />
                                }
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
                        <span className="dmp-check" data-on={selected ? '' : undefined}>
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
                <IconDataOutlineRegular className="dmp-empty-icon" size={20} aria-hidden="true" />
                <span>
                  {providerFilter !== null
                    ? trimmedQuery === '' ? t('empty.provider') : t('empty.providerSearch')
                    : catalogRows.length === 0 ? t('empty.models') : t('search.empty')}
                </span>
              </div>
            )}
          </div>
          </div>

          <div className="dmp-card-foot">
            <span className="dmp-card-foot-note zmd-num">{footNote}</span>
            <span className="dmp-card-foot-providers zmd-num">{footKeys}</span>
            {railKeys === '' ? null : <span className="dmp-card-foot-keys">{railKeys}</span>}
            <span className="dmp-card-key" role="note" aria-label={t('badge.keyAria')}>
              {legend.map(item => (
                <span className="dmp-card-key-item" key={item.fact}>
                  <BadgeIcon fact={item.fact} className="dmp-card-key-icon" />
                  {item.label}
                </span>
              ))}
            </span>
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
