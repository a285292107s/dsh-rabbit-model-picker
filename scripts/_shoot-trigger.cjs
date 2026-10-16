/**
 * Screenshot the offline seat comparison (`shots/_trigger-compare.html`) in both
 * themes, and measure the effort tail the trigger now paints: is it rendered,
 * what ink, does the long name ellipsize while the effort holds.
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_shoot-trigger.cjs
 */
async page => {
  const url = 'file:///C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots/_trigger-compare.html'
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'

  const measure = async theme => {
    await page.goto(url, { waitUntil: 'load' })
    if (theme === 'dark') {
      await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    }
    await page.waitForTimeout(350)

    const data = await page.evaluate(() => {
      const seats = [...document.querySelectorAll('.dmp-root')]
      return seats.map(seat => {
        const name = seat.querySelector('.dmp-trigger-label')
        const effort = seat.querySelector('.dmp-trigger-effort')
        const nameStyle = getComputedStyle(name)
        // Ellipsized when the content is wider than the box it was given.
        const nameClipped = name.scrollWidth > name.clientWidth + 1
        return {
          triggerWidth: Math.round(seat.querySelector('.dmp-trigger').getBoundingClientRect().width),
          nameWidth: Math.round(name.getBoundingClientRect().width),
          nameClipped,
          nameOverflow: nameStyle.textOverflow,
          effortText: effort === null ? null : effort.textContent,
          effortWidth: effort === null ? null : Math.round(effort.getBoundingClientRect().width),
          effortColor: effort === null ? null : getComputedStyle(effort).color,
          effortFontSize: effort === null ? null : getComputedStyle(effort).fontSize,
          // The middot separator comes from ::before, not from DOM text.
          effortBefore: effort === null
            ? null
            : getComputedStyle(effort, '::before').content,
        }
      })
    })

    await page.screenshot({ path: `${out}/trigger-${theme}.png`, fullPage: true })
    return data
  }

  const light = await measure('light')
  const dark = await measure('dark')
  return { light, dark }
}
