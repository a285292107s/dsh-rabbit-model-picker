/**
 * §5.18 acceptance, run against the live GUI.
 *
 * Two things make this trustworthy:
 *
 *  - The cache is disabled before the reload. The loader keys client modules by
 *    a `rev` it computes itself, so a browser-cached body can be served under
 *    the URL of a new build — the page then looks exactly like a fix that does
 *    not work, and that is a false negative this script must not be able to
 *    produce. `bundleIsNew` is asserted before any verdict is recorded.
 *  - The host's own move is used instead of a faked card. Electing a chain entry
 *    into `conversation.composer` switches the default composer bar to
 *    `display: none` (`renderChainResult` with `overlay: true`), which is what
 *    the question / approval / read-only-subagent cards actually do.
 *
 * Each surface is exercised on its own because the fix watches the seat root
 * while each surface is placed from a different rect: a rule that closed only
 * the panel would pass the panel case and leave the other broken. (§5.25 removed
 * the third surface — the provider popover is now the rail inside the model card
 * — so the model card carries both anchors' worth of this check on its own.)
 *
 * The negative half matters as much as the positive one — a dismissal rule that
 * also fires on ordinary layout pressure would be a worse bug than the drift.
 *
 * Run: playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/_accept-anchor-loss.cjs
 */
async page => {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.dmp-settings-button', { timeout: 20000 })
  await page.waitForTimeout(1500)

  const settle = async (ms = 450) => { await page.waitForTimeout(ms) }

  const read = () => page.evaluate(() => {
    // Count only panels that are actually on the page: a closed popover is
    // unmounted, but a sibling that happens to match a selector must not be
    // able to fake a survivor.
    const visible = selector => [...document.querySelectorAll(selector)]
      .filter(node => node.getClientRects().length > 0).length
    const panel = document.querySelector('.dmp-settings, .dmp-menu')
    const rect = panel?.getBoundingClientRect()
    const seat = document.querySelector('.dmp-root')
    return {
      settings: visible('.dmp-settings'),
      modelMenu: visible('.dmp-menu'),
      panel: visible('.dmp-settings, .dmp-menu'),
      top: rect === undefined ? null : Math.round(rect.top),
      left: rect === undefined ? null : Math.round(rect.left),
      seatRects: seat?.getClientRects().length ?? null,
      seatWidth: seat === null ? null : Math.round(seat.getBoundingClientRect().width),
    }
  })

  /** The host takes the composer away, then read the page. */
  const cardAppears = async () => {
    const during = await page.evaluate(async () => {
      const fallback = document.querySelector('[data-chain-overlay-fallback="conversation.composer"]')
      if (fallback === null) return { error: 'composer fallback not found' }
      fallback.style.display = 'none'
      await new Promise(r => setTimeout(r, 500))
      return { hidden: true }
    })
    const after = await read()
    await page.evaluate(() => {
      const fallback = document.querySelector('[data-chain-overlay-fallback="conversation.composer"]')
      if (fallback !== null) fallback.style.display = ''
    })
    await settle(400)
    return { during, after }
  }

  const out = {}
  out.bundleIsNew = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name)
      .find(n => n.includes('/plugins/') && n.includes('model-picker'))
    const text = await (await fetch(url, { cache: 'no-store' })).text()
    return {
      rev: /rev=([0-9a-f]+)/.exec(url)?.[1] ?? null,
      hasFix: text.includes('seatLeftThePage'),
    }
  })
  if (out.bundleIsNew.hasFix !== true) return JSON.stringify({ aborted: 'stale bundle', ...out })

  // --- positive: each of the two surfaces, on its own anchor -----------------
  for (const [name, open] of [
    ['settings', '.dmp-settings-button'],
    ['modelMenu', '.dmp-trigger'],
  ]) {
    await page.keyboard.press('Escape')
    await settle(300)
    await page.locator(open).first().click()
    await settle(700)
    out[`${name}.opened`] = await read()
    out[`${name}.card`] = await cardAppears()
  }

  // --- negative: layout pressure is not a dismissal -------------------------
  out.narrow = {}
  await page.keyboard.press('Escape')
  await settle(300)
  await page.locator('.dmp-settings-button').first().click()
  await settle(700)
  out.narrow.opened = await read()
  for (const width of [480, 320, 160, 40]) {
    await page.evaluate(w => {
      const seat = document.querySelector('.dmp-root')?.closest('[data-composer-seat]')
      if (seat === null || seat === undefined) return
      seat.style.maxWidth = `${w}px`
    }, width)
    await settle(300)
    out.narrow[`w${width}`] = await read()
  }
  await page.evaluate(() => {
    const seat = document.querySelector('.dmp-root')?.closest('[data-composer-seat]')
    if (seat !== null && seat !== undefined) seat.style.maxWidth = ''
  })
  await settle(300)
  await page.mouse.wheel(0, 300)
  await settle(300)
  out.narrow.afterScroll = await read()
  out.narrow.survived = out.narrow.afterScroll.panel === 1
  out.narrow.closedByEscape = out.narrow.afterScroll.panel > 0
  await page.keyboard.press('Escape')
  await settle(300)
  out.narrow.afterEscape = await read()

  return JSON.stringify(out, null, 1)
}
