/**
 * Close-up of the badge strip in both panes, at 3x, so the frame is visible (or
 * provably absent) at the size the eye actually reads it.
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_zoom-row.cjs
 */
async page => {
  const out = 'C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots'
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto('file:///C:/Users/28529/Desktop/dsh-rabbit-model-picker/shots/_row-compare.html', {
    waitUntil: 'load',
  })
  await page.waitForTimeout(300)

  // A label above each strip, rendered large, so the comparison is self-describing.
  await page.evaluate(() => {
    for (const [selector, text] of [
      ['.dmp-menu.framed', 'BEFORE - framed capsule'],
      ['.dmp-menu:not(.framed)', 'AFTER - frameless (shipped)'],
    ]) {
      const menu = document.querySelector(selector)
      const tag = document.createElement('div')
      tag.textContent = text
      tag.style.cssText = 'font:600 13px system-ui;color:#111;margin:10px 0 4px;'
      menu.parentElement.insertBefore(tag, menu)
    }
  })

  for (const [selector, name] of [
    ['.dmp-menu.framed', 'zoom-before'],
    ['.dmp-menu:not(.framed)', 'zoom-after'],
  ]) {
    const menu = page.locator(selector)
    await menu.screenshot({ path: `${out}/${name}.png`, scale: 'css' })
  }

  // At 3x: the whole comparison, magnified.
  await page.evaluate(() => {
    const pane = document.createElement('div')
    pane.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999;'
      + 'transform:scale(2.6);transform-origin:0 0;padding:8px;'
    const source = document.querySelector('.pane')
    pane.innerHTML = source.outerHTML
    document.body.appendChild(pane)
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}/zoom-compare-3x.png` })
  return 'ok'
}
