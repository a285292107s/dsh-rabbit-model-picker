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
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'shots', '_page-preview.html')).href)
  await page.waitForTimeout(300)
  const panes = page.locator('.dmc-page')
  // Pane 0 is the 560px column with the catalog region expanded; pane 3 is the
  // same width with every row collapsed. The README shows both: the ledger alone
  // (35/36, unchanged) and the inline catalog (40/41).
  const expanded = panes.nth(0)
  const collapsed = panes.nth(3)
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.waitForTimeout(200)
  await expanded.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-40-catalog-inline-dark.png') })
  await collapsed.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-35-ledger-dark.png') })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  await page.waitForTimeout(200)
  await expanded.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-41-catalog-inline-light.png') })
  await collapsed.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-36-ledger-light.png') })
  await browser.close()
  console.log('readme shots written (dark first)')
})()
