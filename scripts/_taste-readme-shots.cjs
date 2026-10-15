/**
 * Refresh the README's screenshots against the shipped build. The committed
 * shots predate the fact-grid pass (they still show the right-packed strip), so
 * they are re-taken here from the real GUI in both themes.
 *
 * Run: playwright-cli -s=verify --raw run-code --filename=./scripts/_taste-readme-shots.cjs
 */
async page => {
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  const light = () => page.evaluate(() => {
    document.body.removeAttribute('data-ds-dark-theme')
    document.documentElement.removeAttribute('data-ds-dark-theme')
  })

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.dmp-trigger', { timeout: 20000 })
  await page.waitForTimeout(1400)

  /**
   * One theme's worth of surfaces.
   * @param theme - the file-name suffix.
   * @param force - whether to strip the dark attribute before each shot.
   */
  const pass = async (theme, force) => {
    const settle = async () => {
      if (force) await light()
      // A previous level's focus is still on the gear after Escape, and CSS
      // `scroll-behavior: smooth` animates even a direct `scrollTop` write: both
      // leaked into the first version of these images (a focus ring round the
      // gear, and a list photographed mid-flight with a row sliding under its
      // pinned heading). Clear one, switch the other off for the capture.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        document.querySelectorAll('.dmp-groups').forEach(groups => { groups.style.scrollBehavior = 'auto' })
      })
      await page.mouse.move(12, 12)
      await page.waitForTimeout(350)
    }
    await settle()
    await page.locator('.dmp-root').screenshot({ path: `${out}/composer-with-gear.png` })

    await page.locator('.dmp-trigger').click()
    await page.waitForSelector('.dmp-menu', { state: 'visible', timeout: 8000 })
    await settle()
    await page.evaluate(() => {
      const groups = document.querySelector('.dmp-groups')
      groups.style.scrollBehavior = 'auto'
      groups.scrollTop = 0
    })
    await page.waitForTimeout(250)
    await page.locator('.dmp-menu').screenshot({ path: `${out}/row-badges-${theme}.png` })

    // The same card with the rail holding a DIFFERENT scope: §5.26 makes every open
    // start on the conversation's own provider, so this shot has to move off it —
    // "the first row that is neither selected nor 全部" is what makes the two
    // screenshots different pictures rather than one picture twice.
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.dmp-rail-row')]
      const target = rows.find(row => !row.hasAttribute('disabled')
        && row.getAttribute('aria-selected') !== 'true'
        && row.querySelector('.dmp-provider-count') !== null
        && Number.parseInt(row.querySelector('.dmp-provider-count').textContent ?? '0', 10) > 1
        && Number.parseInt(row.querySelector('.dmp-provider-count').textContent ?? '0', 10) < 20)
      target?.click()
    })
    await page.waitForTimeout(600)
    await settle()
    await page.evaluate(() => {
      const groups = document.querySelector('.dmp-groups')
      if (groups !== null) groups.scrollTop = 0
    })
    await page.waitForTimeout(250)
    await page.locator('.dmp-menu').screenshot({ path: `${out}/provider-${theme}.png` })
    // …and back out of the scope through the rail's own unfiltered row.
    await page.evaluate(() => { document.querySelectorAll('.dmp-rail-row')[0]?.click() })
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // The narrow card: the rail lays out as a strip above the list at every width
    // below the two-pane floor, so the scope is never a hidden mode. 520px rather
    // than 560: the panes still fit at 560 (the card is 528px there, and they need
    // 505), and a shot that claims to show the stacked layout has to be BELOW the
    // breakpoint the sheet actually states.
    await page.setViewportSize({ width: 520, height: 820 })
    await page.waitForTimeout(500)
    await page.locator('.dmp-trigger').click()
    await page.waitForSelector('.dmp-menu', { state: 'visible', timeout: 8000 })
    await settle()
    // The host re-applies its persisted theme on a resize, so the light pass has
    // to strip the dark attribute again AFTER the viewport change that pulled it
    // back — otherwise this one file comes out dark inside the light set.
    if (force) await light()
    await page.waitForTimeout(350)
    await page.locator('.dmp-menu').screenshot({ path: `${out}/rail-stacked-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    await page.locator('.dmp-settings-button').click()
    await page.waitForSelector('.dmp-settings', { state: 'visible', timeout: 8000 })
    await settle()
    await page.locator('.dmp-settings').screenshot({ path: `${out}/panel-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }

  await pass('dark', false)
  await pass('light', true)
  return 'readme shots refreshed'
}
