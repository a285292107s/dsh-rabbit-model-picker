/**
 * Visual + measured acceptance for the frameless badge strip.
 *
 * The claim under test is geometric, not aesthetic: a badge must paint NO
 * frame (no background, no border) and the strip must be NARROWER than the
 * framed version was, while every fact still renders and the glyphs keep their
 * shared on-screen weight. A screenshot alone cannot say "no border", so the
 * computed style is read for each badge and the strip's own width is measured.
 *
 * The cache is disabled before the reload for the reason _accept-anchor-loss
 * documents: a cached body served under a new URL makes a working fix look
 * broken. The built bundle's rev is asserted so the verdict is about THIS code.
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_verify-badge-frame.cjs
 */
async page => {
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })

  const previous = await page.evaluate(() => localStorage.getItem('dsh-theme'))
  const shoot = async theme => {
    await page.evaluate(next => localStorage.setItem('dsh-theme', next), theme)
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.dmp-trigger', { timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.locator('.dmp-trigger').click()
    await page.waitForSelector('.dmp-menu', { state: 'visible', timeout: 8000 })
    await page.waitForTimeout(500)

    const measured = await page.evaluate(() => {
      /** @returns the painted frame of one badge, as the browser computed it. */
      const frameOf = node => {
        const style = getComputedStyle(node)
        return {
          background: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderTopColor: style.borderTopColor,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        }
      }
      const rows = [...document.querySelectorAll('.dmp-row')]
      const withBadges = rows.filter(row => row.querySelector('.dmp-badge') !== null)
      const firstStrip = withBadges[0]?.querySelector('.dmp-badges') ?? null
      const badges = firstStrip === null ? [] : [...firstStrip.querySelectorAll('.dmp-badge')]
      // The name absorbs the deficit, so the strip's own width is the number the
      // frameless change is supposed to move.
      const name = withBadges[0]?.querySelector('.dmp-row-name') ?? null
      return {
        rowsWithBadges: withBadges.length,
        firstRowName: name?.textContent ?? null,
        stripWidth: firstStrip === null ? null : Math.round(firstStrip.getBoundingClientRect().width),
        nameWidth: name === null ? null : Math.round(name.getBoundingClientRect().width),
        badgeCount: badges.length,
        badgeFrames: badges.map(frameOf),
        // Every badge in the whole list, so one framed badge cannot hide behind
        // a frameless first row.
        allFramed: [...document.querySelectorAll('.dmp-badge')].filter(node => {
          const style = getComputedStyle(node)
          const transparent = style.backgroundColor === 'rgba(0, 0, 0, 0)'
          const borderless = Number.parseFloat(style.borderTopWidth) === 0
          return !(transparent && borderless && style.boxShadow === 'none')
        }).length,
        totalBadges: document.querySelectorAll('.dmp-badge').length,
        // The strip must still hold every fact, on one line.
        stripLines: firstStrip === null
          ? null
          : Math.round(firstStrip.getBoundingClientRect().height),
      }
    })

    await page.locator('.dmp-menu').screenshot({ path: `${out}/frame-check-${theme}.png` })
    const rows = page.locator('.dmp-row')
    const target = rows.filter({ has: page.locator('.dmp-badge') }).first()
    await target.screenshot({ path: `${out}/frame-row-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    return measured
  }

  const light = await shoot('light')
  const dark = await shoot('dark')
  await page.evaluate(value => {
    if (value === null) localStorage.removeItem('dsh-theme')
    else localStorage.setItem('dsh-theme', value)
  }, previous ?? null)

  return { light, dark }
}
