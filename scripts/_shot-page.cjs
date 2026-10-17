/**
 * Screenshot the ink settings-page fixture (`shots/_ink-settings.html`) in both
 * themes at the three container widths the host really hands this section
 * (560 / 484 / 106), plus the empty state, the expanded settings well, the
 * catalog region and the retry editor — and measure the numbers the design
 * language pins:
 *
 *   - collapsed ledger row height 48 at 560 / 484;
 *   - the answer word's and the door's right edges coincide (spread 0);
 *   - 106 has NO horizontal overflow (`scrollWidth == clientWidth`);
 *   - the wash gradient and the grain tile compute on the page head and on the
 *     catalog panel;
 *   - the expanded row takes the hover fill; the retry editor's backoff scale is
 *     2 filled + 3 empty slots (the real waits of a 2-retry policy), and the
 *     discovery checklist shows all three checkbox states;
 *   - the rejected HUD vocabulary (field codes, display numerals, corner cuts)
 *     is absent from the DOM, and the page head is just the live sentence.
 *
 * Writes (committed, plain names):
 *   shots/ink-settings-560-{light,dark}.png
 *   shots/ink-settings-484-{light,dark}.png
 *   shots/ink-settings-106-{light,dark}.png
 *   shots/ink-settings-empty-{light,dark}.png
 *   shots/ink-well-{light,dark}.png       the expanded settings well
 *   shots/ink-catalog-{light,dark}.png    the expanded catalog region
 *   shots/ink-retry-{light,dark}.png      the retry editor
 *
 * Run: node scripts/_shot-page.cjs
 */
const path = require('node:path')
const { pathToFileURL } = require('node:url')

;(async () => {
  const { loadPlaywright } = await import('./_fixture-css.mjs')
  const playwright = loadPlaywright()
  const browser = await playwright.chromium.launch()
  const shots = path.join(__dirname, '..', 'shots')
  const page = await browser.newPage({ viewport: { width: 1500, height: 2400 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(shots, '_ink-settings.html')).href)
  await page.waitForTimeout(400)

  /**
   * Measure every pane. Runs in the page.
   * @returns the geometry report.
   */
  const measurePanes = () => {
    const round = value => Math.round(value * 10) / 10
    const box = element => round(element.getBoundingClientRect().width)
    const height = element => round(element.getBoundingClientRect().height)
    const spreadOf = (elements) => {
      if (elements.length === 0) return null
      const rights = elements.map(element => round(element.getBoundingClientRect().right))
      return round(Math.max(...rights) - Math.min(...rights))
    }
    const materialOf = element => ({
      wash: element.classList.contains('zmd-wash'),
      washImage: getComputedStyle(element).backgroundImage.slice(0, 60),
      grain: getComputedStyle(element, '::after').backgroundImage.includes('data:image/svg'),
    })
    return [...document.querySelectorAll('.dmc-page')].map(pane => {
      const rows = [...pane.querySelectorAll('.dmc-row')]
      const head = pane.querySelector('.dmc-head')
      const collapsed = rows.filter(row => !row.hasAttribute('data-well') && !row.hasAttribute('data-catalog'))
      const rowOfWell = pane.querySelector('.dmc-row[data-well="true"]')
      return {
        pane: pane.getAttribute('data-pane'),
        width: box(pane),
        headHeight: height(head),
        headMaterial: materialOf(head),
        headChildCount: head.children.length,
        rowCount: rows.length,
        collapsedRowHeights: [...new Set(collapsed.map(height))],
        expandedRowHeights: [...new Set(rows.filter(row => row.hasAttribute('data-well') || row.hasAttribute('data-catalog')).map(height))],
        verdictRightSpread: spreadOf([...pane.querySelectorAll('.dmc-verdict')]),
        manageRightSpread: spreadOf([...pane.querySelectorAll('.dmc-manage')]),
        horizontalOverflow: pane.scrollWidth - pane.clientWidth,
        wellFill: rowOfWell === null ? null : getComputedStyle(rowOfWell).backgroundColor,
        catalogMaterial: pane.querySelector('.dmc-catalog-panel') === null ? null : materialOf(pane.querySelector('.dmc-catalog-panel')),
        backoffLevels: [...pane.querySelectorAll('.dmc-backoff-cell')].map(cell => cell.getAttribute('data-level')),
        checkboxes: [...pane.querySelectorAll('.dmc-discover-check')].map(input => ({
          checked: input.checked,
          disabled: input.disabled,
          present: (input.closest('[data-present]')?.getAttribute('data-present') ?? 'false') === 'true',
        })),
        hudElements: pane.querySelectorAll('.zmd-code, .zmd-display, .zmd-notch, .dmc-head-index').length,
        addVisible: pane.querySelector('.dmc-add') !== null,
        emptyVisible: pane.querySelector('.dmc-empty') !== null,
      }
    })
  }

  /** Shoot one element, for both themes. */
  const shootBoth = async (selector, stem) => {
    const target = page.locator(selector).first()
    await target.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await target.screenshot({ path: path.join(shots, `${stem}-light.png`) })
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    await page.waitForTimeout(220)
    await target.screenshot({ path: path.join(shots, `${stem}-dark.png`) })
    await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
    await page.waitForTimeout(150)
  }

  const light = await page.evaluate(measurePanes)

  await shootBoth('#settings-560', 'ink-settings-560')
  await shootBoth('#settings-484', 'ink-settings-484')
  await shootBoth('#settings-106', 'ink-settings-106')
  await shootBoth('#settings-empty', 'ink-settings-empty')
  await shootBoth('#dmc-well-opencode-go', 'ink-well')
  await shootBoth('#dmc-catalog-openrouter', 'ink-catalog')
  await shootBoth('#dmc-retry-opencode-go', 'ink-retry')

  /* Dark re-points the tokens, so the well fill and the material are measured
     again there — the design claims both themes, not just light. */
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.waitForTimeout(250)
  const dark = await page.evaluate(measurePanes)
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  await browser.close()

  const report = { light, dark }
  console.log('\n=== ink model-config page geometry (static fixture, 560 / 484 / 106) ===')
  console.log(JSON.stringify(report, null, 2))

  const problems = []
  const expect = (name, actual, target, tolerance = 1) => {
    if (typeof actual !== 'number' || Math.abs(actual - target) > tolerance) {
      problems.push(`${name}: measured ${actual}, spec ${target} (tolerance ±${tolerance}px)`)
    }
  }
  const byPane = Object.fromEntries(light.map(pane => [pane.pane, pane]))
  const byPaneDark = Object.fromEntries(dark.map(pane => [pane.pane, pane]))
  // The 48px rhythm holds at the two desktop container widths. At 106 the scan
  // line deliberately stacks into four lines, so it is measured but not pinned.
  for (const width of ['560', '484']) {
    const pane = byPane[`settings-${width}`]
    for (const rowHeight of pane.collapsedRowHeights) expect(`collapsed row height @${width}`, rowHeight, 48)
    expect(`verdict right-edge spread @${width}`, pane.verdictRightSpread, 0, 0.5)
    expect(`door right-edge spread @${width}`, pane.manageRightSpread, 0, 0.5)
  }
  expect('106 horizontal overflow', byPane['settings-106'].horizontalOverflow, 0, 0)
  for (const width of ['560', '484', '106', 'empty']) {
    const pane = byPane[`settings-${width}`]
    if (pane.headMaterial.washImage.includes('none')) problems.push(`@${width}: the page head has no wash gradient`)
    if (pane.headMaterial.grain !== true) problems.push(`@${width}: the page head has no grain tile on ::after`)
    if (pane.headChildCount !== 1) problems.push(`@${width}: the page head has ${pane.headChildCount} children; expected only the readout sentence`)
    if (pane.hudElements !== 0) problems.push(`@${width}: still renders ${pane.hudElements} HUD construct(s)`)
  }
  const catalogMaterial = byPane['settings-560'].catalogMaterial
  if (catalogMaterial === null) problems.push('560: the catalog region is missing')
  else {
    if (catalogMaterial.washImage.includes('none')) problems.push('560: the catalog region has no wash gradient')
    if (catalogMaterial.grain !== true) problems.push('560: the catalog region has no grain tile on ::after')
  }
  expect('block parity: light and dark head height', byPaneDark['settings-560'].headHeight, byPane['settings-560'].headHeight, 0.5)
  if (byPane['settings-560'].wellFill !== null) {
    const lightFill = byPane['settings-560'].wellFill
    const darkFill = byPaneDark['settings-560'].wellFill
    if (lightFill === darkFill) problems.push(`expanded row fill does not change with the theme (${lightFill})`)
    console.log(`\nexpanded row fill: light ${lightFill} / dark ${darkFill}`)
  }

  const levels = byPane['settings-560'].backoffLevels
  const filled = levels.filter(level => level !== '0').length
  if (levels.length !== 5) problems.push(`backoff scale has ${levels.length} slots; expected 5`)
  if (filled !== 2) problems.push(`backoff scale fills ${filled} slot(s); a 2-retry policy spends 2`)

  const checks = byPane['settings-560'].checkboxes
  if (checks.length !== 3) problems.push(`discovery checklist renders ${checks.length} checkbox(es); expected 3`)
  if (checks.some(checkbox => checkbox.checked === false && checkbox.disabled === false) !== true) {
    problems.push('discovery checklist is missing its unchecked state')
  }
  if (checks.some(checkbox => checkbox.checked === true) !== true) problems.push('discovery checklist is missing its checked state')
  if (checks.some(checkbox => checkbox.present === true && checkbox.disabled === true) !== true) {
    problems.push('discovery checklist is missing its "already in the catalog" state')
  }

  if (byPane['settings-empty'].emptyVisible !== true) problems.push('the empty-state pane does not render its first-run sentence')
  if (byPane['settings-empty'].rowCount !== 0) problems.push('the empty-state pane renders ledger rows')

  if (problems.length === 0) {
    console.log('\nsettings page: all pinned numbers match.')
  } else {
    console.log('\nGEOMETRY DIFFERENCES (report to the Lead; do NOT adjust src/ from a preview script):')
    for (const problem of problems) console.log(` - ${problem}`)
    process.exitCode = 1
  }
})()
