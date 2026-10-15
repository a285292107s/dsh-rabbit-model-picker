async page => {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.dmp-root', { timeout: 30000 })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { document.querySelector('.dmp-settings-button')?.click() })
  await page.waitForSelector('.dmp-settings', { state: 'visible', timeout: 8000 })
  await page.waitForTimeout(700)
  const settings = await page.evaluate(() => {
    const head = document.querySelector('.dmp-settings-head')?.getBoundingClientRect()
    const body = document.querySelector('.dmp-settings-body')?.getBoundingClientRect()
    const card = document.querySelector('.dmp-settings')?.getBoundingClientRect()
    return {
      cardWidth: Math.round(card?.width ?? 0),
      cardHeight: Math.round(card?.height ?? 0),
      stacked: head !== undefined && body !== undefined && body.top >= head.bottom - 1,
      fullWidth: head !== undefined && card !== undefined && card.width - head.width < 20,
    }
  })
  await page.locator('.dmp-settings').screenshot({ path: './shots/accept-settings-column.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  return settings
}
