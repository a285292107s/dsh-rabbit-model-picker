/**
 * Two measurements the fix's shape depends on, read against the live GUI:
 *
 *   1. SQUEEZE — can each anchor's own box legitimately reach 0×0 while the
 *      seat is still visible? If yes, a per-anchor zero-box probe would close a
 *      popover on ordinary narrow layout instead of only when the seat left.
 *   2. HIDE — the host's own move (the elected chain entry switches the default
 *      composer bar to `display: none`, §5.18): does the SEAT ROOT collapse too,
 *      and does it do so while still connected?
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_squeeze-probe.cjs
 */
async page => {
  const box = `el => { if (el === null) return null; const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), el.getClientRects().length, el.isConnected] }`
  const squeezed = await page.evaluate(async fn => {
    const read = eval(fn)
    const gear = document.querySelector('.dmp-settings-button')
    const root = document.querySelector('.dmp-root')
    const trigger = document.querySelector('.dmp-trigger')
    // §5.26 removed the provider chip, so the trigger is the seat's only text
    // control; it is the box whose squeeze this probe cares about now.
    const seat = gear.closest('[data-composer-seat]') ?? root.parentElement
    const frame = () => new Promise(r => requestAnimationFrame(() => r()))
    const rows = []
    for (const maxWidth of [1280, 700, 420, 300, 200, 120, 40, 0]) {
      seat.style.maxWidth = `${maxWidth}px`
      await frame()
      await frame()
      rows.push({
        maxWidth,
        root: read(root),
        trigger: read(trigger),
        gear: read(gear),
      })
    }
    seat.style.maxWidth = ''
    await frame()
    return rows
  }, box)

  // The host's exact move, with the panel open.
  await page.locator('.dmp-settings-button').first().click()
  await page.waitForTimeout(700)
  const hidden = await page.evaluate(async fn => {
    const read = eval(fn)
    const root = document.querySelector('.dmp-root')
    const gear = document.querySelector('.dmp-settings-button')
    const panel = document.querySelector('.dmp-settings')
    const fallback = document.querySelector('[data-chain-overlay-fallback="conversation.composer"]')
    const before = { root: read(root), gear: read(gear), panel: read(panel) }
    let seen = 0
    const ro = new ResizeObserver(() => { seen += 1 })
    ro.observe(root)
    fallback.style.display = 'none'
    await new Promise(r => requestAnimationFrame(() => r()))
    await new Promise(r => requestAnimationFrame(() => r()))
    const after = { root: read(root), gear: read(gear), panel: read(panel), rootObserverFired: seen }
    fallback.style.display = ''
    ro.disconnect()
    return { before, after }
  }, box)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  return JSON.stringify({ shape: 'w,h,clientRects,isConnected', squeezed, hidden }, null, 1)
}
