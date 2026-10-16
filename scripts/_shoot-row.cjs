/**
 * Screenshot the offline row comparison (`shots/_row-compare.html`) in both
 * themes, and measure the geometry the change is supposed to move.
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_shoot-row.cjs
 */
async page => {
  const url = 'file:///C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots/_row-compare.html'
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'

  const measure = async theme => {
    await page.goto(url, { waitUntil: 'load' })
    if (theme === 'dark') {
      await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    }
    await page.waitForTimeout(350)

    const data = await page.evaluate(() => {
      /**
       * The frame a badge paints, plus the strip and name widths, for one pane.
       * @param selector - the pane selector.
       */
      const paneOf = selector => {
        const pane = document.querySelector(selector)
        const strips = [...pane.querySelectorAll('.dmp-badges')]
        const badges = [...pane.querySelectorAll('.dmp-badge')]
        const style = badges.length === 0 ? null : getComputedStyle(badges[0])
        return {
          stripWidths: strips.map(node => Math.round(node.getBoundingClientRect().width)),
          nameWidths: [...pane.querySelectorAll('.dmp-row-name')]
            .map(node => Math.round(node.getBoundingClientRect().width)),
          badgeCount: badges.length,
          badgeBackgrounds: [...new Set(badges.map(node => getComputedStyle(node).backgroundColor))],
          badgeBorders: [...new Set(badges.map(node => getComputedStyle(node).borderTopWidth))],
          badgePadding: style === null ? null : `${style.paddingLeft} ${style.paddingRight}`,
          stripGap: strips.length === 0 ? null : getComputedStyle(strips[0]).columnGap,
          rowHeight: [...pane.querySelectorAll('.dmp-row')]
            .map(node => Math.round(node.getBoundingClientRect().height)),
        }
      }
      return { before: paneOf('.dmp-menu.framed'), after: paneOf('.dmp-menu:not(.framed)') }
    })

    await page.screenshot({ path: `${out}/row-compare-${theme}.png`, fullPage: true })
    return data
  }

  const light = await measure('light')
  const dark = await measure('dark')
  return { light, dark }
}
