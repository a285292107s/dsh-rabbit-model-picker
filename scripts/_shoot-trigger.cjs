/**
 * Screenshot the ink composer SEAT (trigger + gear) and the PARAMETER PANEL
 * (`shots/_ink-seat.html`) in both themes, and measure the marks the design
 * language pins:
 *   - trigger: 28px tall, ≤min(360px, 45cqw), label ellipsizes before the effort
 *     tail, no signal bar / no field code;
 *   - gear: the 28px square with its 1px ink edge, host-blue edge when declared;
 *   - panel: 280px wide, title + 恢复默认, Chinese section titles with hairlines,
 *     square switches (host blue when on), the chosen effort's 2px accent bar +
 *     accent check;
 *   - both surfaces: the wash gradient and the grain tile actually compute.
 *
 * Writes (committed, plain names):
 *   shots/ink-seat-{light,dark}.png    seat rows: closed / open / long name
 *   shots/ink-panel-{light,dark}.png   the parameter panel
 *
 * Run: node scripts/_shoot-trigger.cjs
 */
const path = require('node:path')
const { pathToFileURL } = require('node:url')

;(async () => {
  const { loadPlaywright } = await import('./_fixture-css.mjs')
  const playwright = loadPlaywright()
  const browser = await playwright.chromium.launch()
  const shots = path.join(__dirname, '..', 'shots')
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(shots, '_ink-seat.html')).href)
  await page.waitForTimeout(400)

  const shootBoth = async (selector, stem) => {
    const target = page.locator(selector)
    await page.waitForTimeout(200)
    await target.screenshot({ path: path.join(shots, `${stem}-light.png`) })
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    await page.waitForTimeout(200)
    await target.screenshot({ path: path.join(shots, `${stem}-dark.png`) })
    await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
    await page.waitForTimeout(150)
  }
  await shootBoth('.pv-pane:has(.pv-seat)', 'ink-seat')
  await shootBoth('.dmp-menu.dmp-settings', 'ink-panel')

  const measure = await page.evaluate(() => {
    const round = value => Math.round(value * 10) / 10
    const height = element => round(element.getBoundingClientRect().height)
    const seatOf = element => {
      const trigger = element.querySelector('.dmp-trigger')
      const label = element.querySelector('.dmp-trigger-label')
      const effort = element.querySelector('.dmp-trigger-effort')
      const gear = element.querySelector('.dmp-settings-button')
      return {
        state: element.getAttribute('data-seat'),
        triggerWidth: round(trigger.getBoundingClientRect().width),
        triggerHeight: height(trigger),
        triggerBeforeContent: getComputedStyle(trigger, '::before').content,
        labelClipped: label.scrollWidth > label.clientWidth + 1,
        labelOverflow: getComputedStyle(label).textOverflow,
        effortText: effort.textContent,
        effortColor: getComputedStyle(effort).color,
        effortFontSize: getComputedStyle(effort).fontSize,
        gearWidth: round(gear.getBoundingClientRect().width),
        gearHeight: height(gear),
        gearBorder: getComputedStyle(gear).borderTopWidth + ' ' + getComputedStyle(gear).borderTopColor,
        gearEdited: gear.hasAttribute('data-edited'),
        gearOpen: gear.classList.contains('dmp-settings-open'),
        chevronRotated: getComputedStyle(element.querySelector('.dmp-chevron')).transform !== 'none',
      }
    }
    const panel = document.querySelector('.dmp-menu.dmp-settings')
    const panelStyle = getComputedStyle(panel)
    const switchOn = panel.querySelector('.dmp-settings-switch[aria-checked="true"]')
    const effortOn = panel.querySelector('.dmp-effort-item[aria-checked="true"]')
    const effortCheck = effortOn.querySelector('.dmp-effort-check')
    return {
      seats: [...document.querySelectorAll('.dmp-root')].map(seatOf),
      panel: {
        width: round(panel.getBoundingClientRect().width),
        height: height(panel),
        headHeight: height(panel.querySelector('.dmp-settings-head')),
        titleFontSize: getComputedStyle(panel.querySelector('.dmp-settings-title')).fontSize,
        washImage: panelStyle.backgroundImage.slice(0, 60),
        grainNoise: getComputedStyle(panel, '::after').backgroundImage.includes('data:image/svg'),
        switchWidth: round(switchOn.getBoundingClientRect().width),
        switchHeight: height(switchOn),
        switchRadius: getComputedStyle(switchOn).borderRadius,
        switchFill: getComputedStyle(switchOn).backgroundColor,
        effortRows: panel.querySelectorAll('.dmp-effort-item').length,
        effortMarkFill: getComputedStyle(effortCheck).backgroundColor,
        effortMarkInk: getComputedStyle(effortCheck).color,
        sectionLabels: [...panel.querySelectorAll('.dmp-settings-label > span:first-child')].map(node => node.textContent),
        sectionRules: panel.querySelectorAll('.dmp-settings-label > .zmd-rule').length,
        hudElements: panel.querySelectorAll('.zmd-code, .zmd-display, .zmd-notch').length,
      },
    }
  })

  await browser.close()

  console.log('\n=== ink seat + parameter panel geometry (static fixture) ===')
  console.log(JSON.stringify(measure, null, 2))

  const problems = []
  const expect = (name, actual, target, tolerance = 1) => {
    if (typeof actual !== 'number' || Math.abs(actual - target) > tolerance) {
      problems.push(`${name}: measured ${actual}, spec ${target} (tolerance ±${tolerance}px)`)
    }
  }
  const [closed, open, longName] = measure.seats
  expect('closed trigger height', closed.triggerHeight, 28)
  expect('gear width', closed.gearWidth, 28)
  expect('gear height', closed.gearHeight, 28)
  for (const seat of measure.seats) {
    if (seat.triggerBeforeContent !== 'none') problems.push(`seat (${seat.state}) still paints a ::before mark: ${seat.triggerBeforeContent}`)
  }
  if (open.gearEdited !== true) problems.push('the open seat\'s gear is not marked data-edited')
  if (open.gearOpen !== true) problems.push('the open seat\'s gear is not marked open')
  if (longName.labelClipped !== true) problems.push('the long-name seat does not ellipsize its label')
  if (open.chevronRotated !== true) problems.push('the open seat\'s chevron is not rotated')
  expect('panel width', measure.panel.width, 280)
  if (measure.panel.washImage.includes('none')) problems.push('the panel has no wash gradient')
  if (measure.panel.grainNoise !== true) problems.push('the panel has no grain tile on ::after')
  if (measure.panel.sectionLabels.join() !== '输入类型,上下文窗口,推理等级') {
    problems.push(`panel section titles: ${measure.panel.sectionLabels.join(', ')}`)
  }
  if (measure.panel.sectionRules !== 3) problems.push(`panel hairline count = ${measure.panel.sectionRules}; expected one per section title`)
  if (measure.panel.switchRadius !== '0px') problems.push(`panel switch radius = ${measure.panel.switchRadius}; expected square`)
  if (measure.panel.hudElements !== 0) problems.push(`the panel still renders ${measure.panel.hudElements} HUD construct(s)`)
  if (measure.panel.effortRows < 2) problems.push('the panel does not render the effort radiogroup')

  if (problems.length === 0) {
    console.log('\nseat/panel: all pinned numbers match.')
  } else {
    console.log('\nGEOMETRY DIFFERENCES (report to the Lead; do NOT adjust src/ from a preview script):')
    for (const problem of problems) console.log(` - ${problem}`)
    process.exitCode = 1
  }
})()
