const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
function loadPlaywright () {
  const candidates = [path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@playwright', 'cli'), path.join(__dirname, '..')]
  for (const base of candidates) { try { return require(require.resolve('playwright', { paths: [base] })) } catch { /* next */ } }
  return undefined
}
;(async () => {
  const playwright = loadPlaywright()
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'shots', '_page-preview.html')).href)
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => [...document.querySelectorAll('.dmc-page')].map((el) => {
    const rows = [...el.querySelectorAll('.dmc-row')]
    const well = el.querySelector('.dmc-well')
    const v = el.querySelector('.dmc-verdict')
    return {
      width: el.clientWidth,
      height: Math.round(el.getBoundingClientRect().height),
      rowHeights: rows.map(r => Math.round(r.getBoundingClientRect().height)),
      verdicts: [...el.querySelectorAll('.dmc-verdict')].map(x => Math.round(x.getBoundingClientRect().right)),
      scrollOverflow: el.scrollWidth - el.clientWidth,
      well: well === null ? null : { w: Math.round(well.getBoundingClientRect().width), h: Math.round(well.getBoundingClientRect().height), scroll: well.scrollWidth - well.clientWidth },
      verdictWidth: v === null ? null : Math.round(v.getBoundingClientRect().width),
    }
  }))
  console.log(JSON.stringify(m, null, 1))
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'page-preview-light.png'), fullPage: true })
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'page-preview-dark.png'), fullPage: true })
  await browser.close()
})()
