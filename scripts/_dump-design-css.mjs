#!/usr/bin/env node
/**
 * Dump the design-system sheet to `shots/_design-system.css` for the static
 * fixtures (and for anyone eyeballing the tokens without a browser).
 *
 * The sheet is a TS module string; a fixture cannot `require()` it. esbuild
 * bundles the module, the bundle is evaluated as a data-URL import, and only
 * the exported text is written. Dev-only: this file is under `shots/_*`, which
 * the repo ignores, and the real styles are still owned by `designSystem.ts`.
 *
 * Run: node scripts/_dump-design-css.mjs
 *
 * @module dsh-rabbit-model-picker/dump-design-css
 */

import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const bundled = await build({
  entryPoints: [join(root, 'src', 'client', 'designSystem.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
})
const code = bundled.outputFiles[0].text
const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
mkdirSync(join(root, 'shots'), { recursive: true })
const out = join(root, 'shots', '_design-system.css')
writeFileSync(out, module.DESIGN_SYSTEM_STYLESHEET)
console.log(`wrote ${out} (${module.DESIGN_SYSTEM_STYLESHEET.length} chars)`)
