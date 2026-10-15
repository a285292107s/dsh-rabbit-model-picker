/**
 * §5.26 acceptance, run against the live GUI: the trigger names
 * `provider/model`, the scope is chosen per open, and nothing about it is stored.
 *
 * What this has to prove, and why no static gate or unit test can: the gates read
 * the source of the label composition, of the rail's rows and of the sheet's
 * rules, and the unit tests drive pure functions. None of them can see what the
 * assembled seat paints, nor what a SECOND open of the card actually starts from.
 * The claims below are about the running page:
 *
 *  - the bundle under test is THIS revision's (it carries the rail and the
 *    hidden-hits strip, and no longer carries the chip's class or its copy key);
 *  - the trigger states the model's identity as `provider/model` followed by the
 *    effort in force, and there is no second element beside it naming the same
 *    provider — with no provider to prefix, the label is the fallback copy alone;
 *  - opening the card scopes the list to the provider THIS CONVERSATION runs on,
 *    and the rail's selected row is that provider — not 「全部」, and not whatever
 *    the last open ended on;
 *  - picking another provider scopes the list to exactly its model count and hands
 *    focus to the search box, with the card still open;
 *  - 「全部」 still exists and still shows every provider at once;
 *  - and closing and RE-OPENING the card returns to the session's provider, both
 *    after picking a provider and after picking 「全部」 — the scope has the
 *    lifetime of one open, and nothing about it survives in `localStorage`;
 *  - the hidden-hits strip still counts what the scope is hiding and returns to
 *    every provider;
 *  - the keyboard still leaves the list for the rail and comes back;
 *  - at 500px viewport width the same DOM lays out as a horizontal strip ABOVE the
 *    list, so the scope stays visible and changeable at every width.
 *
 * Every interaction here is view state only (the scope, the query, focus). The
 * script never selects a model and never writes to the Host.
 *
 * Run: playwright-cli -s=verify --raw run-code --filename=./scripts/_accept-provider-rail.cjs
 * Screenshots land in the CLI daemon's working directory, so start the browser
 * session from this package directory for `./shots/…` to be the repo's own.
 */
async page => {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.dmp-root', { timeout: 30000 })
  await page.waitForTimeout(1200)

  // --- 0. the bundle under test is the bundle that shipped -------------------
  // The loader keys client modules by a `rev` it computes itself, so a cached body
  // can be served under the URL of a new build (DESIGN §8.7). The bundle must carry
  // THIS revision's copy and must NOT carry the machinery §5.26 deleted.
  const bundleUrl = await page.evaluate(() =>
    performance.getEntriesByType('resource').map(entry => entry.name)
      .find(name => /rabbit-model-picker/i.test(name)) ?? null)
  const bundleText = bundleUrl === null
    ? ''
    : await page.evaluate(async href => await (await fetch(href)).text(), bundleUrl)
  const freshness = {
    bundleUrl,
    bytes: bundleText.length,
    hasRail: bundleText.includes('dmp-rail'),
    hasElsewhere: bundleText.includes('provider.elsewhere'),
    hasTriggerLabel: bundleText.includes('dmp-trigger-label'),
    hasOldChip: /dmp-provider-label|dmp-provider-icon|provider\.chipTip/.test(bundleText),
    hasOldStorage: /readProviderFilter|rememberProviderFilter/.test(bundleText),
    hasSweep: bundleText.includes('RETIRED_SCOPE_PREFIX') || bundleText.includes('dsh-model-picker.provider.'),
  }
  if (!freshness.hasRail || !freshness.hasElsewhere || !freshness.hasTriggerLabel
    || freshness.hasOldChip || freshness.hasOldStorage || !freshness.hasSweep) {
    return { ok: false, step: 'bundle-freshness', ...freshness }
  }

  /** The trigger: the seat's whole statement about the model in use. */
  const readTrigger = () => page.evaluate(() => {
    const trigger = document.querySelector('.dmp-trigger')
    return {
      label: trigger?.querySelector('.dmp-trigger-label')?.textContent?.trim() ?? null,
      effort: trigger?.querySelector('.dmp-trigger-effort')?.textContent?.trim() ?? null,
      aria: trigger?.getAttribute('aria-label') ?? null,
      // `.dmp-provider` is the chip's class; the rail's own count/failure bits are
      // different tokens (`dmp-provider-count` / `-failed`), so this cannot match them.
      chipBeside: document.querySelector('.dmp-provider') !== null,
    }
  })

  /**
   * Open the model card by DOM click and wait for the card to EXIST, not merely
   * for a click to have been dispatched: this seat closes its surfaces when the
   * seat root leaves the layout (§5.18), and a click landing as the composer
   * re-renders can be swallowed. Waiting on a predicate makes a card that never
   * opens a finding rather than a timeout.
   */
  const openCard = async () => {
    // Never press Escape first: with a query in the box Escape clears the query
    // rather than closing the card, and the click that follows would then CLOSE an
    // already-open card, leaving this predicate waiting for something that is never
    // coming. Open state is checked instead of assumed.
    if (await page.evaluate(() => document.querySelector('.dmp-menu') !== null)) return true
    await page.evaluate(() => { document.querySelector('.dmp-trigger')?.click() })
    return page.waitForFunction(
      () => document.querySelector('.dmp-menu') !== null
        && document.querySelector('.dmp-trigger')?.getAttribute('aria-expanded') === 'true',
      undefined,
      { timeout: 15000 },
    ).then(() => true).catch(() => false)
  }

  /** Close the card the way a user does, and wait for it to be gone. */
  const closeCard = async () => {
    await page.evaluate(() => { document.querySelector('.dmp-trigger')?.click() })
    return page.waitForFunction(() => document.querySelector('.dmp-menu') === null, undefined, { timeout: 8000 })
      .then(() => true).catch(() => false)
  }

  /** One row of the rail, as the page itself describes it. */
  const readRail = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dmp-rail-row')]
    return rows.map(row => ({
      name: row.querySelector('.dmp-rail-name')?.textContent?.trim() ?? '',
      selected: row.getAttribute('aria-selected') === 'true',
      current: row.getAttribute('aria-current') === 'true',
      disabled: row.hasAttribute('disabled'),
      failed: row.querySelector('.dmp-provider-failed') !== null,
      count: Number.parseInt(row.querySelector('.dmp-provider-count')?.textContent?.trim() ?? 'NaN', 10),
      tabIndex: row.getAttribute('tabindex'),
    }))
  })

  /** The model pane's rows, plus the provider landmark each one sits under. */
  const readModels = () => page.evaluate(() => {
    const groups = [...document.querySelectorAll('.dmp-groups [data-menu-group]')]
    return {
      flat: [...document.querySelectorAll('.dmp-row')].length,
      groups: groups.map(group => ({
        provider: group.querySelector('[data-menu-group-heading]')?.textContent?.trim() ?? '',
        models: [...group.querySelectorAll('.dmp-row .dmp-row-name')].map(name => name.textContent?.trim() ?? ''),
      })),
    }
  })

  /** Every key the retired scope record could have written. */
  const storedScopeKeys = () => page.evaluate(() =>
    Object.keys(window.localStorage).filter(key => key.startsWith('dsh-model-picker.provider')))

  const measure = () => page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector)
      if (element === null) return null
      const rect = element.getBoundingClientRect()
      return {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
        right: Math.round(rect.right), bottom: Math.round(rect.bottom),
      }
    }
    return { menu: box('.dmp-menu'), rail: box('.dmp-rail'), models: box('.dmp-models'), search: box('.dmp-search-row') }
  })

  const trigger = await readTrigger()

  // --- 1. the FIRST open starts on the conversation's own provider -----------
  if (!await openCard()) return { ok: false, step: 'card-did-not-open', freshness, trigger }
  await page.waitForTimeout(900)
  const wide = await measure()
  // The trigger's `provider/model` prefix is the session's provider, spelled the
  // same way the rail spells it (both go through the same label function), so it is
  // the yardstick for "where a fresh open should land".
  const sessionProvider = (trigger.label ?? '').split('/')[0] ?? null
  const firstRail = await readRail()
  const firstModels = await readModels()
  const firstStop = firstRail.find(row => row.selected)?.name ?? null
  const storedAfterOpen = await storedScopeKeys()

  // Both panes must exist and the rail must be LEFT of the list. A 1px tolerance
  // absorbs sub-pixel rounding; anything larger is a layout that is not two panes.
  const sideBySide = wide.rail !== null && wide.models !== null
    && wide.rail.right <= wide.models.x + 1
    && wide.models.width >= 320
  await page.screenshot({ path: './shots/accept-rail-wide.png' })

  const rail = firstRail
  const unfilteredModels = firstModels
  const allRow = rail[0]
  const providers = rail.filter(row => row.name !== allRow.name && !row.failed)
  const railShape = {
    count: rail.length,
    firstIsAll: allRow.name === '全部' && !allRow.failed,
    providerRows: providers.length,
    countsStated: providers.every(row => Number.isFinite(row.count)),
    countsAddUp: providers.reduce((sum, row) => sum + row.count, 0) === rail[0].count,
    allCountMatches: allRow.count === firstModels.flat,
    oneTabStop: rail.filter(row => row.tabIndex === '0').length === 1,
    atMostOneScope: rail.filter(row => row.selected).length === 1,
  }

  // --- 2. picking another provider scopes the list --------------------------
  const target = providers.find(row => row.name !== firstStop && row.count > 0 && row.count < firstModels.flat)
  if (target === undefined) return { ok: false, step: 'no-distinct-provider-with-models', trigger, firstStop, rail }
  const targetIndex = rail.findIndex(row => row.name === target.name)
  await page.evaluate(index => { document.querySelectorAll('.dmp-rail-row')[index]?.click() }, targetIndex)
  await page.waitForTimeout(900)
  const scopedRail = await readRail()
  const scopedModels = await readModels()
  const scopedFocus = await page.evaluate(() => ({
    insideSearch: document.activeElement === document.querySelector('.dmp-search-row input'),
    tag: document.activeElement?.tagName ?? null,
  }))
  const scopedCardOpen = await page.evaluate(() => document.querySelector('.dmp-menu') !== null)
  const triggerWhileScoped = await readTrigger()
  await page.screenshot({ path: './shots/accept-rail-scoped.png' })

  // --- 3. closing and RE-OPENING forgets that choice ------------------------
  const closedAfterPick = await closeCard()
  await page.waitForTimeout(400)
  const reopenedAfterPick = await openCard()
  await page.waitForTimeout(900)
  const secondRail = await readRail()
  const secondModels = await readModels()
  const storedAfterReopen = await storedScopeKeys()

  // --- 4. 「全部」 shows every provider, and reopening forgets THAT too -------
  const allIndex = secondRail.findIndex(row => row.name === '全部')
  await page.evaluate(index => { document.querySelectorAll('.dmp-rail-row')[index]?.click() }, allIndex)
  await page.waitForTimeout(900)
  const everyRail = await readRail()
  const everyModels = await readModels()
  const everyCardOpen = await page.evaluate(() => document.querySelector('.dmp-menu') !== null)
  const closedAfterAll = await closeCard()
  await page.waitForTimeout(400)
  const reopenedAfterAll = await openCard()
  await page.waitForTimeout(900)
  const thirdRail = await readRail()
  const thirdModels = await readModels()

  // --- 5. the keyboard owns the rail from the list, and comes back -----------
  await page.evaluate(() => { document.querySelector('.dmp-search-row input')?.focus() })
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(250)
  const afterLeft = await page.evaluate(() => ({
    rail: document.activeElement?.classList.contains('dmp-rail-row') ?? false,
    name: document.activeElement?.querySelector?.('.dmp-rail-name')?.textContent?.trim() ?? null,
  }))
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const afterDown = await page.evaluate(() => ({
    rail: document.activeElement?.classList.contains('dmp-rail-row') ?? false,
    name: document.activeElement?.querySelector?.('.dmp-rail-name')?.textContent?.trim() ?? null,
  }))
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(250)
  const afterRight = await page.evaluate(() => (document.activeElement === document.querySelector('.dmp-search-row input')))

  // --- 6. a query whose hits the scope hides is COUNTED ----------------------
  // Scope to a provider that is NOT the one the query matches, and derive the query
  // from the unscoped catalog so nothing inside the scope matches it. rankByName
  // matches an ordered SUBSEQUENCE, so that test is spelled out here.
  const targetIndexAgain = (await readRail()).findIndex(row => row.name === target.name)
  await page.evaluate(index => { document.querySelectorAll('.dmp-rail-row')[index]?.click() }, targetIndexAgain)
  await page.waitForTimeout(700)

  /** rankByName's own rule, so "hidden by the scope" is decided the same way. */
  const isSubsequence = (needle, haystack) => {
    const wanted = needle.toLowerCase()
    let cursor = 0
    for (const character of haystack.toLowerCase()) {
      if (cursor < wanted.length && character === wanted[cursor]) cursor += 1
    }
    return cursor === wanted.length
  }
  const scopedNames = scopedModels.groups.flatMap(group => group.models)
  const elsewhereNames = unfilteredModels.groups
    .filter(group => group.provider !== target.name)
    .flatMap(group => group.models)
  let query = null
  for (let length = 4; length <= 14 && query === null; length += 2) {
    for (const name of elsewhereNames) {
      const candidate = name.slice(0, length)
      if (candidate.length < 4) continue
      if (!scopedNames.some(scopedName => isSubsequence(candidate, scopedName))) { query = candidate; break }
    }
  }
  if (query === null) return { ok: false, step: 'no-query-hidden-by-the-scope', target, scopedNames, elsewhereNames }

  await page.locator('.dmp-search-row input').fill(query)
  await page.waitForTimeout(800)
  const elsewhere = await page.evaluate(() => {
    const hint = document.querySelector('.dmp-filter-hint')
    return {
      hintPresent: hint !== null,
      text: hint?.textContent?.trim() ?? null,
      clearPresent: document.querySelector('.dmp-filter-clear') !== null,
      modelRows: document.querySelectorAll('.dmp-row').length,
    }
  })
  await page.screenshot({ path: './shots/accept-rail-search-elsewhere.png' })
  if (elsewhere.clearPresent) {
    await page.evaluate(() => { document.querySelector('.dmp-filter-clear')?.click() })
    await page.waitForTimeout(900)
  }
  const afterElsewhere = await page.evaluate(() => ({
    scopeAll: document.querySelectorAll('.dmp-rail-row')[0]?.getAttribute('aria-selected') === 'true',
    modelRows: document.querySelectorAll('.dmp-row').length,
  }))

  // --- 7. the same DOM, one column, when the viewport cannot hold two --------
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 500, height: 820 })
  await page.waitForTimeout(600)
  if (!await openCard()) return { ok: false, step: 'card-did-not-open-narrow', wide }
  await page.waitForTimeout(900)
  const narrow = await measure()
  const narrowRail = await readRail()
  await page.screenshot({ path: './shots/accept-rail-narrow.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.keyboard.press('Escape')

  return {
    ok: true,
    freshness,
    trigger,
    sessionProvider,
    wide,
    narrow,
    scope: {
      firstStop,
      firstRows: firstModels.flat,
      target: target.name,
      expectedRows: target.count,
      measuredRows: scopedModels.flat,
      selectedRow: scopedRail.find(row => row.selected)?.name ?? null,
      cardStayedOpen: scopedCardOpen,
      focusMovedToSearch: scopedFocus.insideSearch,
      groupHeaders: scopedModels.groups.map(group => group.provider),
    },
    reopened: {
      afterPick: {
        closed: closedAfterPick,
        reopened: reopenedAfterPick,
        selectedRow: secondRail.find(row => row.selected)?.name ?? null,
        rows: secondModels.flat,
      },
      afterAll: {
        closed: closedAfterAll,
        reopened: reopenedAfterAll,
        selectedRow: thirdRail.find(row => row.selected)?.name ?? null,
        rows: thirdModels.flat,
      },
    },
    all: {
      selectedRow: everyRail.find(row => row.selected)?.name ?? null,
      rows: everyModels.flat,
      cardStayedOpen: everyCardOpen,
    },
    storage: { afterOpen: storedAfterOpen, afterReopen: storedAfterReopen },
    keys: { leftLandsOnRail: afterLeft.rail, leftName: afterLeft.name, downStaysOnRail: afterDown.rail, downName: afterDown.name, rightReturnsToSearch: afterRight },
    elsewhere: { query, hiddenCandidates: elsewhereNames.length, scopedCandidates: scopedNames.length, ...elsewhere, afterClear: afterElsewhere },
    claims: {
      // the trigger states the identity, once
      'the trigger label is provider/model': /^[^/]+\/.+/.test(trigger.label ?? ''),
      'the label\'s provider half is a provider this catalog lists':
        sessionProvider !== null && firstRail.some(row => row.name === sessionProvider),
      'the trigger carries the effort after the identity': typeof trigger.effort === 'string' && trigger.effort.length > 0,
      'the trigger names the provider in its accessible name': (trigger.aria ?? '').includes(`${sessionProvider}/`),
      'no separate provider chip sits beside the trigger': trigger.chipBeside === false,
      // the first open lands on the conversation's provider
      'a fresh open is scoped to the conversation\'s provider': firstStop === sessionProvider,
      'a fresh open shows that provider\'s models, not the whole catalog': firstModels.flat > 0
        && firstModels.flat === (firstRail.find(row => row.name === firstStop)?.count ?? -1)
        && firstModels.groups.length === 1,
      'the session\'s provider is marked as current on its own row':
        firstRail.filter(row => row.current).length === 1 && firstRail.find(row => row.current)?.name === sessionProvider,
      'the rail still offers the way to every provider': railShape.firstIsAll,
      'every provider row states a count, and they add up to the catalog': railShape.countsStated && railShape.countsAddUp,
      'the rail has exactly one tab stop': railShape.oneTabStop,
      'exactly one row reports the scope': railShape.atMostOneScope,
      'the rail is the LEFT pane': sideBySide,
      'the model pane keeps the 320px the fact grid needs': (wide.models?.width ?? 0) >= 320,
      // picking a provider
      'picking a provider scopes the list to exactly its count': scopedModels.flat === target.count,
      'picking a provider marks its own row': scopedRail.find(row => row.selected)?.name === target.name,
      'picking a provider keeps the card open': scopedCardOpen,
      'picking a provider hands focus to the search box': scopedFocus.insideSearch,
      'the scoped list is one provider\'s group': scopedModels.groups.length === 1 && scopedModels.groups[0].provider === target.name,
      'picking a provider does not change the trigger': triggerWhileScoped.label === trigger.label,
      // the scope has the lifetime of one open
      'the card closed and reopened': closedAfterPick && reopenedAfterPick,
      're-opening forgets the picked provider': secondRail.find(row => row.selected)?.name === sessionProvider,
      're-opening shows the conversation\'s provider again': secondModels.flat === firstModels.flat,
      '「全部」 shows every provider at once': everyModels.flat === rail[0].count && everyModels.groups.length > 1,
      '「全部」 marks the unfiltered row, not a provider': everyRail.find(row => row.selected)?.name === '全部',
      'the scope returns to the conversation\'s provider after 「全部」 too': closedAfterAll && reopenedAfterAll
        && thirdRail.find(row => row.selected)?.name === sessionProvider,
      're-opening after 「全部」 shows that provider\'s models': thirdModels.flat === firstModels.flat,
      'nothing about the scope is stored': storedAfterOpen.length === 0 && storedAfterReopen.length === 0,
      // keyboard
      'ArrowLeft from the list lands on the rail': afterLeft.rail,
      'ArrowDown moves within the rail': afterDown.rail && afterDown.name !== afterLeft.name,
      'ArrowRight returns to the search box': afterRight,
      // search is not scoped
      'a query hidden by the scope is counted': elsewhere.hintPresent && elsewhere.modelRows === 0,
      'the strip offers the way back to every provider': elsewhere.clearPresent,
      'that way back restores every provider': afterElsewhere.scopeAll,
      // narrow
      'narrow: the rail lays out ABOVE the list': narrow.rail !== null && narrow.models !== null
        && narrow.rail.bottom <= narrow.models.y + 1 && narrow.rail.x <= narrow.menu.x + 5,
      'narrow: the rail still lists every scope': narrowRail.length === rail.length,
      'narrow: the model pane still fits the card': narrow.models !== null && narrow.models.width >= 300,
    },
  }
}
