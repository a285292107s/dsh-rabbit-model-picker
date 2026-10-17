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
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.waitForTimeout(200)
  const pane = page.locator('.dmc-page').first()
  await pane.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-35-ledger-dark.png') })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  await page.waitForTimeout(200)
  await pane.screenshot({ path: path.join(__dirname, '..', 'shots', 'model-config-36-ledger-light.png') })
  await browser.close()
  console.log('readme shots written (dark first)')
})()
