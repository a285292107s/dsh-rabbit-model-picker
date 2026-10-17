/**
 * ADAPTER (not shipped, not gated): write the model-card static preview
 * fixtures for the INK design language.
 *
 * Kept as the historical entry point for the card/row harness; the markup now
 * lives in ONE place (`scripts/_preview-ink.mjs`) and its CSS in ONE place
 * (`scripts/_fixture-css.mjs`, which reads `designSystem.ts` + the three real
 * sheets). The old script built its own CSS from the host theme bundle plus
 * `shots/_extracted.css` — a hand-extracted copy of an older compiled sheet —
 * so it could preview a design that was no longer in `src/`.
 *
 * Output (git-ignored intermediates; `_shoot-row.cjs` turns them into images):
 *   shots/_ink-card.html         two wide cards (scoped / all providers)
 *   shots/_ink-card-narrow.html  the ≤536px collapsed card
 *
 * Run: node scripts/_render-row.cjs
 */
;(async () => {
  const { writeCardFixtures } = await import('./_preview-ink.mjs')
  const written = await writeCardFixtures()
  for (const path of written) console.log(`wrote ${path}`)
})()
