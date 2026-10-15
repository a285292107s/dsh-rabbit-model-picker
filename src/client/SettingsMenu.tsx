/**
 * The model settings surface: the parameters of the model the seat has selected.
 *
 * ALL THREE FIELDS HERE ARE LIVE, each through the door its owner actually
 * offers:
 *
 *   - input modalities and the context window are written into the adapter's
 *     own declaration for this route (`settings/mutate` over the namespace and
 *     path `llm/listConfigurableProviders` names), which the adapter re-resolves
 *     immediately — the same fields the shipped Models settings page edits;
 *   - reasoning effort is submitted through the shared `directory.select()`, and
 *     the marked level comes back from the shared directory, so only what the
 *     Host accepted is ever shown as active. This is the one place effort can be
 *     changed: the model menu's rows only state the effort in force.
 *
 * The panel therefore shows what the Host says, not what this plugin remembers:
 * every displayed value is read from the settings snapshot, and a write that the
 * Host refuses leaves the shown value where it was and states the reason.
 *
 * A route the adapter serves straight from its installed catalog has no
 * declaration to edit; the panel opens read-only for it and says why, instead of
 * offering a control that would silently do nothing.
 *
 * The panel is a sibling popover of the model menu and the provider menu — one
 * popover at a time, never nested — and it owns and stops the keys it consumes,
 * exactly like the other two levels.
 *
 * Opening it puts focus on the PANEL, not on the capacity field: the field is the
 * only text input here, it commits on blur, and this card is anchored to the
 * composer where a summoned keypad would cover it. `Tab` then walks the controls
 * in the order they are rendered, which is the order the switches appear in.
 *
 * @module dsh-rabbit-model-picker/client/SettingsMenu
 */

import {
  IconCheckOutlineRegular, IconInfoOutlineRegular, IconWarningOutlineRegular, Input, MenuSurface, Switch,
  useAnchoredPosition,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  rowKey, type CapabilityFace, type CapabilitySnapshot, type DirectoryStore, type ModelRoute,
  type ModelSelection, type ParamsFace, type ParamsSnapshot, type RouteAddress, type RouteCapability,
  type SettingsOp, type Translate,
} from './contract.ts'
import { effortChoicesOf } from './effort.ts'
import {
  capacityAction, contextFieldOf, contextHintOf, inputHintOf, noticeOf, restoreIsEmpty, shownInputOf,
  showsContextField, showsInputSection,
} from './panelCopy.ts'
import { formatContext, PANEL_MODALITIES, parseContext, resolveRoute } from './params.ts'

/** Unplaced portal card: hidden but laid out at a fixed origin so measurement is real. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Props of the settings panel. */
export interface SettingsMenuProps {
  /** The gear this panel hangs off. */
  readonly anchorRef: RefObject<HTMLElement | null>
  /** The panel element; the parent also uses it to contain blur/outside checks. */
  readonly panelRef: RefObject<HTMLDivElement | null>
  /** This plugin's `useId` prefix, so the trigger's `aria-controls` can point here. */
  readonly idPrefix: string
  /** Which side of the gear to open on (the parent measured the free space). */
  readonly side: 'top' | 'bottom'
  /** The session's shared directory store: the panel's effort source of truth. */
  readonly directory: DirectoryStore
  /** The Host settings behind the panel (read for every displayed value). */
  readonly params: ParamsFace
  /** The adapter-published facts behind the read-only branches. */
  readonly capabilities: CapabilityFace
  /** A model selection is in flight: the effort list is inert. */
  readonly busy: boolean
  /** The card's own height budget, measured from the gear by the parent. */
  readonly maxHeight?: number | undefined
  /** Translator for the plugin namespace. */
  readonly t: Translate
  /** Submit a complete selection (used by the effort field only). */
  readonly onSelect: (selection: ModelSelection) => void
  /**
   * Leave this level.
   * @param restoreToGear - whether the parent should hand focus back to the gear.
   */
  readonly onClose: (restoreToGear: boolean) => void
}

/**
 * The catalog entry for one route, when the catalog still lists it.
 * @param store - the shared directory store.
 * @param route - the selected route.
 * @returns the model entry, or null when the route is not in the last good load.
 */
function modelOf(store: DirectoryStore, route: ModelRoute) {
  const group = store.getSnapshot().groups.find(candidate => candidate.id === route.provider)
  return group?.models.find(candidate => candidate.id === route.model) ?? null
}

/**
 * Render the parameters of the model the seat currently has selected.
 * @param props - see {@link SettingsMenuProps}.
 * @returns the portaled panel, or null while no model is selected yet.
 */
export function SettingsMenu({
  anchorRef, panelRef, idPrefix, side, directory, params, capabilities, busy, maxHeight, t, onSelect, onClose,
}: SettingsMenuProps) {
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null)
  const [capacityError, setCapacityError] = useState(false)
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)

  // Both the live selection and the settings snapshot are external stores, so
  // both are read the same way the seat reads the directory. Re-reading here
  // (rather than trusting a prop) is what keeps the panel and the trigger from
  // disagreeing.
  const current = useSyncExternalStore(
    subscribe => directory.subscribe(subscribe),
    () => directory.getSnapshot().current,
  )
  const snapshot: ParamsSnapshot = useSyncExternalStore(
    subscribe => params.subscribe(subscribe),
    () => params.getSnapshot(),
  )
  const catalog: CapabilitySnapshot = useSyncExternalStore(
    subscribe => capabilities.subscribe(subscribe),
    () => capabilities.getSnapshot(),
  )
  const position = useAnchoredPosition({ open: true, anchorRef, panelRef, side, align: 'end', gap: 8, margin: 12 })

  // The panel reads the Host at mount — which IS each open, because the parent
  // renders this panel only while it is open — so a declaration edited in the
  // Settings → Models page is what this panel shows, not the snapshot the seat
  // mounted with.
  useEffect(() => { void params.refresh() }, [params])

  const route: ModelRoute | null = current === null ? null : { provider: current.provider, model: current.model }
  const address: RouteAddress | null = useMemo(
    () => resolveRoute(snapshot, route),
    [snapshot, route?.provider, route?.model],
  )
  // What the adapter published about this exact route. Read here rather than
  // taken from a prop for the same reason the settings snapshot is: the panel
  // must not be able to disagree with the row behind it.
  const capability: RouteCapability | null = route === null
    ? null
    : catalog.routes[rowKey(route.provider, route.model)] ?? null
  // The read only starts once the panel is open on a route, so a model nobody
  // inspects never costs a Remote call. It is one call per provider per page
  // load, and an answer that never arrives leaves the facts absent.
  useEffect(() => {
    if (route !== null) capabilities.ensure([route.provider])
  }, [capabilities, route?.provider])
  const model = route === null ? null : modelOf(directory, route)
  const reasoning = model?.reasoning
  const choices = useMemo(
    () => reasoning === undefined ? [] : effortChoicesOf(reasoning, t),
    [reasoning, t],
  )
  // The effort in force: what the Host accepted, else the adapter's default.
  // The radio marks compare by ID, not by label: two levels may share a name,
  // and a mark that lights two rows at once is a lie about the Host's answer.
  const activeEffort = current?.reasoningEffort ?? reasoning?.defaultEffort
  const modelLabel = model?.name ?? (route === null ? '' : `${route.provider}/${route.model}`)

  // Every line this panel says about its own state comes from `panelCopy`, which
  // is pure data: it decides WHICH line each state produces, and the unit gate
  // asserts that decision against the real dictionary.
  const copyState = { address, capability, snapshot, busy, capacityError } as const
  const noticeLine = noticeOf(copyState)
  const sectionNotice = noticeLine === null ? null : t(noticeLine.key, noticeLine.params)
  const inputHintLine = inputHintOf(copyState, t)
  // The one disabled state no notice covers: an addressable, writable route whose
  // declaration is empty, which disables "restore defaults". That reason rides on
  // the section hint rather than on the button's `title`, because a disabled
  // button cannot be focused to reveal a tooltip.
  const inputHint = inputHintLine === null
    ? null
    : [
        t(inputHintLine.key, inputHintLine.params),
        restoreIsEmpty(copyState) ? t('settings.resetNothing') : null,
      ].filter(part => part !== null).join(' ')
  const contextHintLine = contextHintOf(copyState)
  const contextHint = contextHintLine === null ? null : t(contextHintLine.key, contextHintLine.params)

  // What the switches and the capacity field show, again from the pure module:
  // the declared list, or the adapter default in force while the entry declares
  // none. The hint below each is what says which of those it is.
  const shownInput = shownInputOf(address, capability)
  const contextField = contextFieldOf(address, capability)
  const editable = address !== null && snapshot.writable && !busy && !writing
  // The field shows the Host's own value; the local draft exists only between the
  // first keystroke and the commit, so the field can never display a stale value
  // after a write, and only a half-typed entry is ever component state.
  const capacity = capacityDraft ?? contextField.value

  /**
   * The focus chain of this level, in reading order, without disabled controls.
   *
   * Read from the rendered panel rather than from component refs: the baseline
   * `Switch` forwards no ref, so a ref-based chain would silently drop both
   * switches and leave them unreachable by keyboard.
   *
   * The order here is the order the controls are RENDERED in, which is the only
   * defensible one: the two modality switches sit above the capacity field, so a
   * chain that started at the field sent `Tab` backwards up the card — WCAG 2.4.3
   * Focus Order, and a defect on its own regardless of where focus starts. The
   * order is asserted against the JSX by the static gate in §5.10.
   * @returns the focusable elements, in order.
   */
  const chain = (): HTMLElement[] => {
    const panel = panelRef.current
    if (panel === null) return []
    return [
      ...panel.querySelectorAll<HTMLElement>('[role="switch"]'),
      panel.querySelector<HTMLElement>('.dmp-settings-input input'),
      ...panel.querySelectorAll<HTMLElement>('.dmp-effort-item'),
      panel.querySelector<HTMLElement>('.dmp-settings-reset'),
    ].filter((item): item is HTMLElement => item !== null && !item.hasAttribute('disabled'))
  }

  // The PANEL takes initial focus, not its first control. Three reasons, none of
  // them taste: a text field parked here summons the numeric keypad on touch —
  // this card is anchored to the composer, so the keypad covers it; that field
  // COMMITS ON BLUR, so a caret sitting there puts one stray Tab away from a
  // write into the Host's own config; and a screen reader hears the field and
  // its placeholder instead of the group label and the state line above it
  // (§5.10). It also stops needing a read-only special case: the card can always
  // take focus, where every control is disabled and a control-based target
  // silently leaves the keyboard on the gear.
  //
  // Once, not on every placement: `position` is re-measured on scroll and
  // resize, and re-running this would drag focus back out of whatever the seat
  // was using — mid-edit in the capacity field, mid-arrow in the effort list.
  const tookFocus = useRef(false)

  // Gated on the measured position: while the card is still placing it is
  // `visibility: hidden`, and a hidden element cannot take focus.
  useLayoutEffect(() => {
    if (position === null || tookFocus.current) return
    tookFocus.current = true
    panelRef.current?.focus()
  }, [position])

  // The field shows the Host's value again when the route changes, and also when
  // the declared value itself moves (our own accepted write publishes the new
  // value, so this lands on the same text the draft already had). An external
  // edit to the same model's declaration therefore also drops a half-typed draft
  // — accepted, because a field that keeps text the Host no longer holds is the
  // worse of the two, and this document is single-user.
  const addressId = address === null ? '' : `${address.ns}#${address.entryPath.join('.')}`
  useEffect(() => {
    setCapacityDraft(null)
    setCapacityError(false)
    setWriteError(null)
  }, [addressId, contextField.value])

  /**
   * Move focus along this level's own chain of controls.
   * @param delta - +1 forward, -1 backward.
   */
  const move = (delta: number): void => {
    const items = chain()
    if (items.length === 0) return
    const active = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1
    const next = active === -1 ? (delta > 0 ? 0 : items.length - 1) : (active + delta + items.length) % items.length
    items[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'Escape':
      case 'ArrowLeft':
        event.preventDefault()
        event.stopPropagation()
        onClose(true)
        return
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        move(event.shiftKey ? -1 : 1)
        return
      default:
        // ↑/↓ stay with the input's own caret and the switches' own behaviour;
        // only the panel-level keys above are consumed.
    }
  }

  /**
   * Apply one write and report exactly what the Host answered.
   * @param ops - the path-addressed edits.
   * @param done - runs after the Host accepted the write.
   * @param failed - runs after the Host refused it, before the message is shown.
   */
  const write = (ops: readonly SettingsOp[], done?: () => void, failed?: () => void): void => {
    if (address === null) return
    setWriting(true)
    setWriteError(null)
    void params.write(address.ns, ops, address.revision).then((outcome) => {
      setWriting(false)
      if (!outcome.ok) {
        failed?.()
        setWriteError(outcome.message)
        return
      }
      done?.()
    })
  }

  /**
   * Commit the typed capacity, or flag it as unreadable.
   *
   * The DECISION lives in `capacityAction` (pure, and unit-gated): an untouched
   * field writes nothing, a rejected value stays flagged until the text changes,
   * and an empty field un-declares. This function only performs the action.
   */
  const commitCapacity = (): void => {
    if (address === null || !editable) return
    const action = capacityAction(capacityDraft, contextField.value, address.contextWindow, parseContext)
    switch (action.kind) {
      case 'skip':
        return
      case 'reject':
        setCapacityError(true)
        return
      case 'normalize':
        setCapacityError(false)
        setCapacityDraft(action.text)
        return
      case 'unset':
        setCapacityError(false)
        write(
          [{ op: 'unset', path: [...address.entryPath, 'contextWindow'] }],
          () => { setCapacityDraft(null) },
          () => { setCapacityDraft(null) },
        )
        return
      case 'set':
        setCapacityError(false)
        write(
          [{ op: 'set', path: [...address.entryPath, 'contextWindow'], value: action.value }],
          () => { setCapacityDraft(formatContext(action.value)) },
          // On a refusal the field goes back to what the Host actually holds.
          // Otherwise the rejected draft stays in the box, and the NEXT dismissal
          // re-issues the same refused mutation — a write per blur, forever, with
          // only "retype the declared value" as a way out. The refusal message is
          // what stays on screen; the draft does not.
          () => { setCapacityDraft(null) },
        )
    }
  }

  /**
   * Declare one modality list for this route.
   *
   * The list written is the one shown — the declared list, or the adapter
   * default while the entry declares none — with the toggled modality added or
   * removed, and any modality this panel has no switch for preserved.
   * @param modality - the modality the switch belongs to.
   * @param on - the switch's next state.
   */
  const toggleModality = (modality: string, on: boolean): void => {
    if (address === null || !editable) return
    const next = new Set(shownInput)
    if (on) next.add(modality)
    else next.delete(modality)
    const known = PANEL_MODALITIES.filter(candidate => next.has(candidate))
    const extras = shownInput.filter(candidate => !(PANEL_MODALITIES as readonly string[]).includes(candidate))
    const list = [...known, ...extras.filter(candidate => candidate !== modality)]
    // A model that accepts nothing could serve no request; the Host rejects the
    // empty list on one adapter and silently re-inherits it on the other.
    if (list.length === 0) {
      setWriteError(t('settings.input.needOne'))
      return
    }
    write([{ op: 'set', path: [...address.entryPath, address.inputField], value: list }])
  }

  /** Drop everything this panel declares for the route, back to the adapter defaults. */
  const restoreDefaults = (): void => {
    if (address === null || !editable) return
    const ops: SettingsOp[] = []
    if (address.contextWindow !== undefined) {
      ops.push({ op: 'unset', path: [...address.entryPath, 'contextWindow'] })
    }
    if (address.input.length > 0) {
      ops.push({ op: 'unset', path: [...address.entryPath, address.inputField] })
    }
    if (ops.length === 0) return
    write(ops)
  }

  /**
   * Commit one reasoning level for the selected model.
   *
   * Nothing is recorded here: the level the panel marks comes from the shared
   * directory, so the mark only moves once the Host has accepted the switch. A
   * rejected switch therefore leaves no stale claim behind — it surfaces through
   * the seat's ordinary toast.
   * @param effort - the chosen level, or undefined for the provider default.
   */
  const pickEffort = (effort: string | undefined): void => {
    if (route === null || reasoning === undefined) return
    if ((activeEffort ?? undefined) === effort) return
    onSelect({
      provider: route.provider,
      model: route.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    })
  }

  if (route === null) return null

  /**
   * One informational or blocking line, above the controls it qualifies: the
   * panel's single explanation of an unusable state, or the Host's own words
   * when it refused the last write.
   */
  const notice: ReactNode = writeError !== null
    ? (
        <div className="dmp-settings-alert" role="alert">
          <IconWarningOutlineRegular className="dmp-settings-alert-icon" />
          <span>{t('settings.writeFailed', { message: writeError })}</span>
        </div>
      )
    : sectionNotice === null
      ? null
      : <div className="dmp-settings-notice">{sectionNotice}</div>

  return createPortal(
    <MenuSurface
      ref={panelRef}
      id={`${idPrefix}-settings`}
      className={position === null
        ? 'dmp-menu dmp-settings'
        : `dmp-menu dmp-settings dmp-menu-in ${side === 'top' ? 'dmp-from-top' : 'dmp-from-bottom'}`}
      style={position === null ? MEASURE_STYLE : { ...position, maxHeight }}
      role="group"
      aria-label={t('settings.aria', { model: modelLabel })}
      aria-busy={writing || busy}
      // The card is this level's initial focus target (§5.10): it is announced
      // by name, it exists in every state including read-only, and parking the
      // caret in the one text field instead would summon the keypad and arm a
      // blur-commit. `-1` keeps it out of the Host's own page-level `Tab` order —
      // this card never participates in that traversal; its chain is `Tab` inside.
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="dmp-settings-head">
        <span className="dmp-settings-title">{modelLabel}</span>
        {/* Disabled for three different reasons, and each is stated on screen:
            an unusable panel says so in the notice below, and a route with an
            empty declaration says so in the hint under the sections (see
            `restoreIsEmpty`) — so no `title` is needed to hide a reason here. */}
        <button
          type="button"
          className="dmp-settings-reset"
          aria-label={t('settings.resetAria', { model: modelLabel })}
          disabled={!editable || address === null || !address.declared}
          onClick={restoreDefaults}
        >
          {t('settings.reset')}
        </button>
      </div>

      {notice}

      {/* The scroll role lives HERE, never on the surface: `MenuSurface` paints
          the card's fill as an absolutely positioned child of the surface, so a
          scrolling surface slides that layer up with the content and the bottom
          of the card ends up with no fill at all (the page shows through it).
          The head and the state line above stay put; this body scrolls. */}
      <div className="dmp-settings-body">
        {showsInputSection(address, capability) && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-label">{t('settings.input.title')}</div>
            <div className="dmp-settings-row">
              <span className="dmp-settings-name">{t('settings.input.text')}</span>
              <Switch
                className="dmp-settings-switch"
                checked={shownInput.includes('text')}
                label={t('settings.input.text')}
                disabled={!editable}
                onChange={(next) => { toggleModality('text', next) }}
              />
            </div>
            <div className="dmp-settings-row">
              <span className="dmp-settings-name">{t('settings.input.image')}</span>
              <Switch
                className="dmp-settings-switch"
                checked={shownInput.includes('image')}
                label={t('settings.input.image')}
                disabled={!editable}
                onChange={(next) => { toggleModality('image', next) }}
              />
            </div>
            {inputHint !== null && <div className="dmp-settings-hint">{inputHint}</div>}
          </div>
        )}

        {/* Only a route WITH a declaration gets a field to declare into: with no
            address the field would be a disabled empty box restating the section
            header, while the notice above already carries the reason. The
            adapter's own default for this model is still stated — in the badge
            on the model row and in the row's hover sentence.

            A route with no address but a PUBLISHED window is the exception, and
            it keeps the field because the placeholder is where that window is
            stated: the box stays empty (nothing is declared) while naming the
            number in force. */}
        {showsContextField(address, capability) && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-label">{t('settings.context.title')}</div>
            <div className="dmp-settings-row">
              <Input
                className={capacityError ? 'dmp-settings-input dmp-settings-input-bad' : 'dmp-settings-input'}
                type="text"
                inputMode="numeric"
                disabled={!editable}
                aria-label={t('settings.context.title')}
                aria-invalid={capacityError || undefined}
                placeholder={contextField.placeholder}
                value={capacity}
                onChange={(event) => {
                  setCapacityDraft(event.target.value)
                  setCapacityError(false)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  event.stopPropagation()
                  commitCapacity()
                }}
                onBlur={() => { commitCapacity() }}
              />
            </div>
            {contextHint !== null && <div className="dmp-settings-hint">{contextHint}</div>}
          </div>
        )}

        {reasoning !== undefined && (
          <div className="dmp-settings-section">
            <div className="dmp-settings-label">{t('settings.effort.title')}</div>
            <div className="dmp-effort-list" role="radiogroup" aria-label={t('settings.effort.title')}>
              {choices.map(choice => (
                <button
                  key={choice.key}
                  type="button"
                  role="radio"
                  aria-checked={choice.effort === activeEffort}
                  className="dmp-effort-item"
                  disabled={busy}
                  onClick={() => { pickEffort(choice.effort) }}
                >
                  <span className="dmp-effort-name">{choice.label}</span>
                  <span className="dmp-effort-check">
                    {choice.effort === activeEffort ? <IconCheckOutlineRegular /> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The panel edits a declaration, not a decoration: naming the namespace
            and the field path is what lets a reviewer check the edit landed. */}
        {address !== null && (
          <div className="dmp-settings-target" title={`${address.ns} · ${address.entryPath.join('.')}`}>
            {t('settings.target', { ns: address.ns, path: address.entryPath.join('.') })}
          </div>
        )}

        <div className="dmp-settings-note">
          <IconInfoOutlineRegular className="dmp-settings-note-icon" />
          <span>{t('settings.note')}</span>
        </div>
      </div>
    </MenuSurface>,
    document.body,
  )
}
