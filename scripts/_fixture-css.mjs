#!/usr/bin/env node
/**
 * Shared CSS + browser plumbing for the static preview fixtures (not shipped,
 * not gated).
 *
 * WHY THIS FILE EXISTS. Before the 2026-10-17 redesign each preview script
 * pulled its own CSS: `_page-preview.mjs` sliced the `<head>` of a previously
 * rendered `_row-compare.html`, and `_render-row.cjs` / `_render-trigger.cjs`
 * re-pulled the host theme bundle and read `shots/_extracted.css` (a stale
 * compiled sheet). That is three copies of the same extraction logic and one of
 * them shipped the OLD composer CSS beside the NEW settings CSS. This helper is
 * now the ONE place a fixture gets its styles from:
 *
 *   1. the host's real token sheet, unwrapped from the installed theme bundle
 *      (light under `:root`/`body`, dark under `body[data-ds-dark-theme]`), with
 *      the captured `shots/_row-compare.html` head as the offline fallback;
 *   2. the host primitive BASE boxes the fixture DOM borrows (tag / input), in a
 *      small labelled shim — the live host supplies these through hashed class
 *      names, which a static page cannot reproduce;
 *   3. the FOUR sheets owned by this plugin: `designSystem.ts` (the embedded
 *      ZMD Archivo face + `--zmd-*` ink tokens + `.zmd-wash` / `.zmd-grain` /
 *      `.zmd-rule` / `.zmd-num`), `styles.ts` (composer seat, card, panel),
 *      `modelConfigStyles.ts` (settings page) and `catalogStyles.ts` (catalog
 *      region). Each is the module's own exported text, read out of an esbuild
 *      bundle — never a hand copy and never `lib/client.js`.
 *
 * Theme switching is the host's: fixtures set `data-ds-dark-theme` on `<body>`,
 * the same boolean attribute DSH's theme plugin toggles. There is no JS listener
 * and no `prefers-color-scheme` branch.
 *
 * Fixture HTML is written under `shots/_*`, which the repo ignores (it rebuilds
 * from `src/` on demand). Screenshots are written under plain names so they ARE
 * committed; see the `_shot-page.cjs` / `_shoot-*.cjs` scripts.
 *
 * Run: imported by the preview scripts; not meant to be run directly.
 *
 * @module dsh-rabbit-model-picker/fixture-css
 */

import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Where fixtures are written (git-ignored `shots/_*`). */
export const SHOTS = join(ROOT, 'shots')

/**
 * One plugin sheet: the module, its export and the file the export belongs to.
 *
 * The export is what `inject*Styles()` puts in the page, so a fixture renders
 * the same text the browser gets on activation. `lib/client.js` is deliberately
 * not read: a stale build would silently preview the previous design.
 */
const SHEETS = [
  { key: 'design', file: 'src/client/designSystem.ts', export: 'DESIGN_SYSTEM_STYLESHEET' },
  { key: 'composer', file: 'src/client/styles.ts', export: 'STYLESHEET' },
  { key: 'modelConfig', file: 'src/client/modelConfigStyles.ts', export: 'MODEL_CONFIG_STYLESHEET' },
  { key: 'catalog', file: 'src/client/catalogStyles.ts', export: 'CATALOG_STYLESHEET' },
]

/**
 * Bundle one TS module and evaluate it as a data-URL module, so its exported
 * string can be read without a TypeScript loader.
 * @param entry - absolute path of the module.
 * @returns the evaluated module namespace.
 */
async function evaluateModule(entry) {
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  const code = bundled.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

/** Cache per process: the sheets are a few hundred KB and several fixtures share them. */
let sheetsPromise

/**
 * Read the four owned sheets out of their sources.
 * @returns the sheet texts keyed by {@link SHEETS.key}, plus their char counts.
 */
export function pluginSheets() {
  sheetsPromise ??= (async () => {
    const out = {}
    for (const sheet of SHEETS) {
      const module = await evaluateModule(join(ROOT, sheet.file))
      const text = module[sheet.export]
      if (typeof text !== 'string' || text.length === 0) {
        throw new Error(`${sheet.file} did not export ${sheet.export}`)
      }
      out[sheet.key] = text
    }
    return out
  })()
  return sheetsPromise
}

/** The host theme bundle that publishes the `--dsw-*` sheets as JS string literals. */const THEME_BUNDLE = join(
  process.env.APPDATA ?? '',
  'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
)

/** The captured host head old fixtures were sliced from; the offline fallback only. */
const CAPTURED_HEAD = join(SHOTS, '_row-compare.html')

/**
 * Unwrap the theme bundle's published sheets.
 *
 * The bundle is JavaScript: each stylesheet is a `var <name>_css_default = "…"`
 * literal interleaved with `//#region` comments and JS, and a browser drops
 * every rule after the first parse error, so the literals have to be unwrapped
 * and joined in file order (which is the cascade order the shell applies).
 * @param source - the theme bundle text.
 * @returns the concatenated token CSS.
 */
function unwrapThemeSheets(source) {
  const chunks = []
  for (const match of source.matchAll(/var\s+\w*_?css_default\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    const body = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
    if (body.includes('--dsw-')) chunks.push(body)
  }
  if (chunks.length === 0) throw new Error('the theme bundle published no token CSS')
  return chunks.join('\n')
}

/**
 * The captured head's token part, for hosts where the theme bundle is not
 * installed. `_row-compare.html` was rendered against a real GUI, so its head
 * carries the same token sheet (and the old `.tag` rewrite); the composer sheet
 * that follows it is dropped, because the current one is read from `src/`.
 * @returns the token CSS, or null when the capture is missing.
 */
function capturedTokenCss() {
  if (!existsSync(CAPTURED_HEAD)) return null
  const source = readFileSync(CAPTURED_HEAD, 'utf8')
  const marker = source.indexOf('/* The card the rows sit in')
  const head = marker === -1 ? source : source.slice(0, marker)
  if (!head.includes('--dsw-')) return null
  return head.replace(/^[\s\S]*?<style>/, '')
}

/**
 * The host token sheet, plus where it came from.
 * @returns `{ css, source, bundled }` — `bundled` says whether the tag base is
 *   already inside it (the capture carried the old `.tag` rewrite).
 */
export function hostTokenCss() {
  if (existsSync(THEME_BUNDLE)) {
    return {
      css: unwrapThemeSheets(readFileSync(THEME_BUNDLE, 'utf8')),
      source: 'installed DSH theme bundle (dsh-client-ui-theme)',
      bundled: false,
    }
  }
  const captured = capturedTokenCss()
  if (captured !== null) {
    return {
      css: captured,
      source: 'captured host head in shots/_row-compare.html',
      bundled: true,
    }
  }
  throw new Error(`no host token sheet: neither ${THEME_BUNDLE} nor ${CAPTURED_HEAD} carries --dsw-*`)
}

/**
 * The host primitive BASE boxes the fixture DOM borrows.
 *
 * This is a SHIM, and it is stated as one: the live host ships these as hashed
 * CSS-module classes (`_tag_brmue_4`, `_wrap_14sgc_1`, `_input_14sgc_25` on the
 * installed 0.2.1-rc.2 web build), and a static page cannot reproduce a hash. The
 * fixture DOM therefore carries the same plain `.tag` alias the old row fixture
 * used, and the input reset the host's `Input` wrapper gives its `<input>`.
 * Every property that belongs to the DESIGN lives in the plugin sheets, which are
 * appended after this block and win the cascade; nothing here paints a surface.
 * If a future host restyles those primitives, only this block can drift — and
 * only by the primitive's own base box, never by the plugin's.
 */
export const HOST_PRIMITIVE_BASE = `
/* --- host primitive base boxes (shim; see scripts/_fixture-css.mjs) -------- */
.tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  font-weight: 500;
  white-space: nowrap;
}
.dmp-search-row .dmp-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dmp-search-row .dmp-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
/* The host Input primitive's inner reset, for the parameter panel's context field
   (SettingsMenu.tsx puts the dmp-settings-input class on the host Input wrapper,
   which supplies this reset itself in the live page). */
.dmp-settings-input input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
}
/* MenuSurface's fill layer (the host paints it as an absolutely positioned
   sibling of the content). The plugin re-points its colour to --zmd-panel; the
   absolute placement is the host's own base box. */
.dmp-menu > .material {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
}
`

/** The fixture page itself: a neutral stage, no design opinions. */
const FIXTURE_STAGE = `
/* --- fixture stage (not part of the plugin) -------------------------------- */
html, body { margin: 0; }
body {
  padding: 24px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsh-font-family-text, var(--dsh-font-family-text-default, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif));
}
.pv-stage { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
.pv-pane { flex: none; }
.pv-label {
  margin: 0 0 8px;
  color: var(--dsw-alias-label-secondary);
  font: 600 12px/18px var(--dsw-font-family, system-ui);
}
/* The two cards ship as position:fixed surfaces anchored to the seat. A static
   page stacks the same subtree in flow; the surface keeps its own box model
   (relative, not static, so the frame pseudo-element still belongs to it) and
   grows to its content instead of holding the live 420px viewport. */
.dmp-menu {
  position: relative;
  max-height: none;
  box-shadow: none;
}
`

/**
 * The whole fixture stylesheet: host tokens, the primitive shim, the four
 * plugin sheets, then the neutral stage (the stage comes last so it can stack
 * the fixed surfaces without touching a plugin rule).
 * @param sheets - {@link pluginSheets}' result.
 * @param host - {@link hostTokenCss}' result.
 * @returns the CSS text.
 */
export function fixtureCss(sheets, host) {
  return [
    `/* host tokens: ${host.source} */`,
    host.css,
    host.bundled ? '' : HOST_PRIMITIVE_BASE,
    `/* plugin sheet: designSystem.ts (font + --zmd-* tokens + .zmd-* utilities) */`,
    sheets.design,
    `/* plugin sheet: styles.ts (composer seat, model card, parameter panel) */`,
    sheets.composer,
    `/* plugin sheet: modelConfigStyles.ts (model config page) */`,
    sheets.modelConfig,
    `/* plugin sheet: catalogStyles.ts (catalog region) */`,
    sheets.catalog,
    FIXTURE_STAGE,
  ].join('\n')
}

/**
 * Write one fixture HTML file.
 * @param name - file name under `shots/` (must start with `_` to stay ignored).
 * @param options - `title`, the body markup and optional extra CSS.
 * @returns the absolute path written.
 */
export async function writeFixture(name, { title, body, extraCss = '' }) {
  const sheets = await pluginSheets()
  const host = hostTokenCss()
  mkdirSync(SHOTS, { recursive: true })
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${fixtureCss(sheets, host)}
${extraCss}
</style>
</head>
<body>
${body}
</body>
</html>
`
  const out = join(SHOTS, name)
  writeFileSync(out, html)
  return out
}

/**
 * The globally installed Playwright (the repo does not depend on it). Same
 * lookup `_shot-page.cjs` used, kept here so every shot script resolves the
 * browser the same way.
 * @returns the `playwright` module.
 */
export function loadPlaywright() {
  const requireFromHere = createRequire(import.meta.url)
  const candidates = [
    join(process.env.APPDATA ?? '', 'npm/node_modules/@playwright/cli'),
    ROOT,
  ]
  for (const base of candidates) {
    try {
      return requireFromHere(requireFromHere.resolve('playwright', { paths: [base] }))
    } catch {
      /* next candidate */
    }
  }
  throw new Error('playwright not found; install it globally (`npm i -g @playwright/cli`)')
}
