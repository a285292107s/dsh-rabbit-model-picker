/**
 * Screenshot the ink model-card fixture (`shots/_ink-card.html` and the narrow
 * one) in both themes, and measure the geometry the design language pins:
 * card 520 / model pane 331 / name column 175 / badge strip 113 / row 38 / rail
 * basis 176, plus the ≤536 collapse and the two texture primitives
 * (`.zmd-wash` gradient and `.zmd-grain::after` noise) being computed.
 *
 * These are STATIC previews: the real sheets from `src/` over the host's real
 * token values. They prove layout and both themes; they cannot prove scrolling,
 * the focus chain or Esc layering inside the live host.
 *
 * Writes (committed, plain names — never `shots/_*`):
 *   shots/ink-card-{light,dark}.png        scope = current provider
 *   shots/ink-card-all-{light,dark}.png    scope = all, grouped by provider
 *   shots/ink-card-narrow-{light,dark}.png the ≤536px collapsed card
 *
 * Run: node scripts/_shoot-row.cjs
 */
const path = require('node:path')
const { pathToFileURL } = require('node:url')

;(async () => {
  const { loadPlaywright } = await import('./_fixture-css.mjs')
  const playwright = loadPlaywright()
  const browser = await playwright.chromium.launch()
  const shots = path.join(__dirname, '..', 'shots')

  /**
   * Measure one card subtree.
   * @param pane - the fixture pane name (`scoped` / `all`).
   */
  const measureCard = (pane) => {
    const card = document.querySelector(`.dmp-menu[data-pane="${pane}"]`)
    const round = value => Math.round(value * 10) / 10
    const box = element => element === null ? null : round(element.getBoundingClientRect().width)
    const height = element => element === null ? null : round(element.getBoundingClientRect().height)
    const rows = [...card.querySelectorAll('.dmp-row')]
    const railRows = [...card.querySelectorAll('.dmp-rail-row')]
    const strips = rows.map(row => row.querySelector('.dmp-badges')).filter(Boolean)
    const names = rows.map(row => row.querySelector('.dmp-row-name'))
    const cardStyle = getComputedStyle(card)
    const grain = getComputedStyle(card, '::after')
    return {
      cardWidth: box(card),
      cardHeight: height(card),
      cardDirection: cardStyle.flexDirection,
      railBasis: getComputedStyle(card.querySelector('.dmp-rail')).flexBasis,
      railBoxWidth: box(card.querySelector('.dmp-rail')),
      modelsPaneWidth: box(card.querySelector('.dmp-models')),
      groupCount: card.querySelectorAll('[data-menu-group]').length,
      rowCount: rows.length,
      rowHeights: [...new Set(rows.map(height))],
      nameWidths: [...new Set(names.map(box))],
      stripWidths: [...new Set(strips.map(box))],
      selected: railRows.filter(row => row.getAttribute('aria-selected') === 'true').map(row => row.querySelector('.dmp-rail-name').textContent),
      current: railRows.filter(row => row.getAttribute('aria-current') === 'true').map(row => row.querySelector('.dmp-rail-name').textContent),
      selectedScopeFill: getComputedStyle(railRows.find(row => row.getAttribute('aria-selected') === 'true') ?? railRows[0]).backgroundColor,
      selectedScopeRing: getComputedStyle(railRows.find(row => row.getAttribute('aria-selected') === 'true') ?? railRows[0]).boxShadow,
      selectedRowFill: getComputedStyle(rows.find(row => row.getAttribute('aria-checked') === 'true') ?? rows[0]).backgroundColor,
      checkMarkFill: getComputedStyle(rows.find(row => row.getAttribute('aria-checked') === 'true')?.querySelector('.dmp-check') ?? rows[0]).backgroundColor,
      // The material primitives must actually compute: a wash gradient on the
      // surface and the grain tile on its ::after overlay.
      washBackground: card.classList.contains('zmd-wash'),
      washImage: cardStyle.backgroundImage.slice(0, 60),
      grainNoise: grain.backgroundImage.includes('data:image/svg'),
      grainPointerEvents: grain.pointerEvents,
      // The rejected HUD vocabulary must be gone from the DOM, not just the sheet.
      hudElements: card.querySelectorAll('.zmd-code, .zmd-display, .zmd-notch, .dmp-card-status').length,
    }
  }

  /**
   * Shoot one card in both themes.
   * @param page - the Playwright page (already on the fixture).
   * @param selector - the card selector.
   * @param stem - the image name stem.
   */
  const shootBoth = async (page, selector, stem) => {
    const card = page.locator(selector)
    await page.waitForTimeout(350)
    await card.screenshot({ path: path.join(shots, `${stem}-light.png`) })
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    await page.waitForTimeout(250)
    await card.screenshot({ path: path.join(shots, `${stem}-dark.png`) })
    await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
    await page.waitForTimeout(150)
  }

  /* --- the wide card: 1400 viewport so `min(520px, 100vw - 32px)` is 520 --- */
  const page = await browser.newPage({ viewport: { width: 1400, height: 1600 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(shots, '_ink-card.html')).href)
  await page.waitForTimeout(400)

  const wide = {
    scoped: await page.evaluate(measureCard, 'scoped'),
    all: await page.evaluate(measureCard, 'all'),
  }
  await shootBoth(page, '.dmp-menu[data-pane="scoped"]', 'ink-card')
  await shootBoth(page, '.dmp-menu[data-pane="all"]', 'ink-card-all')

  /* --- the narrow card: the collapse is a viewport @media branch --- */
  const narrowPage = await browser.newPage({ viewport: { width: 520, height: 1200 }, deviceScaleFactor: 2 })
  await narrowPage.goto(pathToFileURL(path.join(shots, '_ink-card-narrow.html')).href)
  await narrowPage.waitForTimeout(400)
  const narrow = await narrowPage.evaluate(() => {
    const card = document.querySelector('.dmp-menu')
    const rail = card.querySelector('.dmp-rail')
    const round = value => Math.round(value * 10) / 10
    const box = element => round(element.getBoundingClientRect().width)
    return {
      viewportWidth: window.innerWidth,
      cardWidth: box(card),
      cardDirection: getComputedStyle(card).flexDirection,
      railDirection: getComputedStyle(rail).flexDirection,
      modelsPaneWidth: box(card.querySelector('.dmp-models')),
      rowHeights: [...new Set([...card.querySelectorAll('.dmp-row')].map(row => round(row.getBoundingClientRect().height)))],
      nameWidths: [...new Set([...card.querySelectorAll('.dmp-row-name')].map(box))],
      stripWidths: [...new Set([...card.querySelectorAll('.dmp-badges')].map(box))],
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  await shootBoth(narrowPage, '.dmp-menu', 'ink-card-narrow')

  await browser.close()

  const report = { wide, narrow }
  console.log('\n=== ink model card geometry (static fixture, real sheets + host tokens) ===')
  console.log(JSON.stringify(report, null, 2))

  const problems = []
  const expect = (name, actual, target, tolerance = 1) => {
    if (typeof actual !== 'number' || Math.abs(actual - target) > tolerance) {
      problems.push(`${name}: measured ${actual}, spec ${target} (tolerance ±${tolerance}px)`)
    }
  }
  expect('card width', wide.scoped.cardWidth, 520)
  expect('models pane', wide.scoped.modelsPaneWidth, 331)
  for (const nameWidth of wide.scoped.nameWidths) expect('name column', nameWidth, 175)
  for (const stripWidth of wide.scoped.stripWidths) expect('badge strip', stripWidth, 113)
  expect('row height', wide.scoped.rowHeights[0], 38)
  expect('rail basis', Number.parseFloat(wide.scoped.railBasis), 176)
  expect('rail box width', wide.scoped.railBoxWidth, 181)
  if (wide.all.groupCount < 2) problems.push(`all-provider scope renders ${wide.all.groupCount} group(s); expected the list grouped by provider`)
  if (wide.scoped.groupCount !== 1) problems.push(`scoped card renders ${wide.scoped.groupCount} group(s); expected exactly the selected provider's`)
  if (wide.scoped.selected.join() !== 'opencode-go') problems.push(`scoped card rail selection = ${wide.scoped.selected.join() || 'none'}`)
  if (wide.scoped.current.join() !== 'opencode-go') problems.push(`session marker = ${wide.scoped.current.join() || 'none'}`)
  for (const theme of ['scoped', 'all']) {
    if (wide[theme].washImage.includes('none')) problems.push(`the ${theme} card has no wash gradient`)
    if (wide[theme].grainNoise !== true) problems.push(`the ${theme} card has no grain tile on ::after`)
    if (wide[theme].hudElements !== 0) problems.push(`the ${theme} card still renders ${wide[theme].hudElements} HUD construct(s)`)
  }
  if (narrow.cardDirection !== 'column') problems.push(`narrow card direction = ${narrow.cardDirection}; expected column`)
  if (narrow.railDirection !== 'row') problems.push(`narrow rail direction = ${narrow.railDirection}; expected row`)
  if (narrow.pageOverflow > 0) problems.push(`narrow page overflows horizontally by ${narrow.pageOverflow}px`)

  if (problems.length === 0) {
    console.log('\ngeometry: all pinned numbers match.')
  } else {
    console.log('\nGEOMETRY DIFFERENCES (report to the Lead; do NOT adjust src/ from a preview script):')
    for (const problem of problems) console.log(` - ${problem}`)
    process.exitCode = 1
  }
})()
