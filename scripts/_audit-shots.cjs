/**
 * Visual audit shots, light theme: the host's theme applier re-asserts the
 * body attribute, so the theme is switched the way the GUI itself does —
 * through its persisted `dsh-theme` key + reload. The previous value is
 * restored at the end.
 *
 * Run: playwright-cli -s=verify --raw run-code --filename=./scripts/_audit-shots.cjs
 */
async page => {
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  const previous = await page.evaluate(() => localStorage.getItem('dsh-theme'))
  await page.evaluate(() => localStorage.setItem('dsh-theme', 'light'))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.dmp-trigger', { timeout: 20000 })
  await page.waitForTimeout(1200)

  const openMenu = async () => {
    await page.locator('.dmp-trigger').click()
    await page.waitForSelector('.dmp-menu', { state: 'visible', timeout: 8000 })
    await page.waitForTimeout(450)
  }
  const openSettings = async () => {
    await page.locator('.dmp-settings-button').click()
    await page.waitForSelector('.dmp-settings', { state: 'visible', timeout: 8000 })
    await page.waitForTimeout(450)
  }
  const seat = async name => {
    const composer = page.locator('[data-composer-card]').first()
    await composer.screenshot({ path: `${out}/${name}` })
  }

  await openMenu()
  await page.locator('.dmp-menu').screenshot({ path: `${out}/audit-card-light.png` })
  await seat('audit-seat-open-light.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  // The card again, with the RAIL holding a scope other than the one a fresh open
  // lands on (§5.26 starts every open on the conversation's own provider).
  await openMenu()
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dmp-rail-row')]
    const target = rows.find(row => !row.hasAttribute('disabled')
      && row.getAttribute('aria-selected') !== 'true'
      && Number.parseInt(row.querySelector('.dmp-provider-count')?.textContent ?? '0', 10) > 1
      && Number.parseInt(row.querySelector('.dmp-provider-count')?.textContent ?? '0', 10) < 20)
    target?.click()
  })
  await page.waitForTimeout(600)
  await page.locator('.dmp-menu').screenshot({ path: `${out}/audit-rail-light.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await openSettings()
  await page.locator('.dmp-settings').screenshot({ path: `${out}/audit-panel-light.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  if (previous === null) await page.evaluate(() => localStorage.removeItem('dsh-theme'))
  else await page.evaluate(value => localStorage.setItem('dsh-theme', value), previous)
  await page.reload({ waitUntil: 'load' })
  return `light shots done (was: ${String(previous)})`
}
