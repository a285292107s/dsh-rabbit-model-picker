#!/usr/bin/env node
/**
 * ADAPTER (not shipped, not gated): write the settings-page static preview
 * fixture for the INK design language.
 *
 * This entry point is kept because `docs/ui-language.md` and the README's
 * structure table have pointed at it since §5.35; the fixture itself now lives
 * in ONE place (`scripts/_preview-ink.mjs`) and gets its CSS from ONE place
 * (`scripts/_fixture-css.mjs`). The old version of this file was the thing that
 * duplicated the CSS extraction: it sliced the `<head>` of a previously
 * rendered `shots/_row-compare.html`, so it previewed a stale sheet beside the
 * new one — and the rejected HUD round made that doubly wrong.
 *
 * Output (git-ignored intermediate; the shot script turns it into images):
 *   shots/_ink-settings.html   the 560 / 484 / 106 panes + the empty state
 *
 * Run: node scripts/_page-preview.mjs
 */
import { writeSettingsFixtures } from './_preview-ink.mjs'

const written = await writeSettingsFixtures()
for (const path of written) console.log(`wrote ${path}`)
