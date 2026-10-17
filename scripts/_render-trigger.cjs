/**
 * ADAPTER (not shipped, not gated): write the seat + parameter-panel static
 * preview fixture for the INK design language.
 *
 * Kept as the historical entry point for the trigger harness; the markup now
 * lives in ONE place (`scripts/_preview-ink.mjs`) and its CSS in ONE place
 * (`scripts/_fixture-css.mjs`). The old script had the same two problems as
 * `_render-row.cjs`: a private copy of the host-token extraction and a stale
 * `shots/_extracted.css`.
 *
 * Output (git-ignored intermediate; `_shoot-trigger.cjs` turns it into images):
 *   shots/_ink-seat.html   seat rows (closed / open / long name) + panel
 *
 * Run: node scripts/_render-trigger.cjs
 */
;(async () => {
  const { writeSeatFixtures } = await import('./_preview-ink.mjs')
  const written = await writeSeatFixtures()
  for (const path of written) console.log(`wrote ${path}`)
})()
