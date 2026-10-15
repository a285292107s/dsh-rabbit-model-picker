/**
 * Regenerate the committed theme-token fixture that `check-contrast.mjs` falls
 * back to when the host is not installed (CI).
 *
 * WHY A FIXTURE AT ALL. The contrast gate's whole point is measuring this
 * plugin's ink against the host's REAL palette, and the palette only exists
 * inside an installed DSH. On CI there is no DSH, so the gate used to print
 * `skip` and exit 0 — a green tick that had measured nothing, on the one gate
 * the README advertises as proof that "面板文字全部过 WCAG AA". Vendoring the
 * exact token VALUES the gate resolves turns that into a real measurement
 * everywhere, while a local run with DSH installed still prefers the live sheet
 * (so a host upgrade that moves the palette is still caught).
 *
 * THE FIXTURE IS DERIVED, NEVER HAND-EDITED: it holds the transitive closure of
 * `var()` references starting from the tokens this plugin's sheet and the gate
 * mention, because `resolveToken` walks those chains (`--dsw-alias-label-x` →
 * `--dsw-static-…`) and a missing link would make the gate report "cannot
 * resolve" instead of a ratio.
 *
 * Run: node scripts/_dump-theme-fixture.mjs
 *
 * @module dsh-rabbit-model-picker/dump-theme-fixture
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the installed host's token sheet lives. */
const THEME_CANDIDATES = [
  process.env.DSH_INSTALL_DIR === undefined
    ? null
    : join(process.env.DSH_INSTALL_DIR, 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
  join(
    process.env.APPDATA ?? '',
    'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  ),
]

/**
 * Parse both palettes out of the theme bundle.
 *
 * Kept byte-identical in behaviour to the gate's own parser: the fixture has to
 * describe the same palettes the gate would otherwise read live, or the two
 * paths would judge different colors.
 * @param source - the theme bundle's text.
 * @returns `{ light, dark }` token bags.
 */
function palettes(source) {
  const anchor = source.indexOf('--dsw-static-amber-100')
  if (anchor < 0) throw new Error('theme bundle: token sheet not found')
  const start = source.lastIndexOf('"', anchor - 1) + 1
  const end = source.indexOf('"', source.indexOf('--shiki', anchor))
  const sheet = source.slice(start, end).replace(/\\n/g, '\n').replace(/\\"/g, '"')

  const bags = { light: {}, dark: {} }
  for (const match of sheet.matchAll(/([^ {}]+)\{([^{}]*)\}/g)) {
    const target = match[1].includes('data-ds-dark-theme') ? bags.dark : bags.light
    for (const declaration of match[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const name = declaration.slice(0, colon).trim()
      if (name.startsWith('--')) target[name] = declaration.slice(colon + 1).trim()
    }
  }
  return bags
}

/**
 * Every `--dsw-*` name referenced anywhere in this repository's own sources.
 * @returns the seed token names.
 */
function seedTokens() {
  const files = [
    'src/client/styles.ts',
    'scripts/check-contrast.mjs',
  ]
  const names = new Set()
  for (const file of files) {
    const text = readFileSync(resolve(root, file), 'utf8')
    for (const match of text.matchAll(/--dsw-[a-z0-9-]+/g)) names.add(match[0])
  }
  return names
}

/**
 * Follow `var()` references outwards until nothing new is reached.
 * @param bag - one palette's raw values.
 * @param seeds - the token names to start from.
 * @returns every name reachable from the seeds, seeds included.
 */
function closure(bag, seeds) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length > 0) {
    const name = queue.pop()
    if (seen.has(name)) continue
    seen.add(name)
    const value = bag[name]
    if (value === undefined) continue
    for (const match of value.matchAll(/var\((--[a-z0-9-]+)/g)) queue.push(match[1])
  }
  return seen
}

const theme = THEME_CANDIDATES.find(candidate => candidate !== null) ?? null
if (theme === null) {
  console.error('no host theme bundle found; install DSH or set DSH_INSTALL_DIR')
  process.exit(1)
}

const bags = palettes(readFileSync(theme, 'utf8'))
const seeds = seedTokens()
// The closure is taken over BOTH palettes' union: a token may resolve in one
// theme through a name that only the other theme declares.
const names = new Set([...closure(bags.light, seeds), ...closure(bags.dark, seeds)])

const fixture = { light: {}, dark: {} }
const missing = []
for (const name of [...names].sort()) {
  for (const themeName of ['light', 'dark']) {
    const value = bags[themeName][name]
    if (value === undefined) { missing.push(`${themeName}:${name}`); continue }
    fixture[themeName][name] = value
  }
}

const out = resolve(root, 'scripts/theme-tokens.json')
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`theme fixture: ${names.size} tokens -> scripts/theme-tokens.json`)
console.log(`  sizes: ${(JSON.stringify(fixture).length / 1024).toFixed(1)} KB`)
if (missing.length > 0) {
  // Not fatal: some tokens are theme-specific by design (radius, elevation).
  console.log(`  note: ${missing.length} theme-specific names absent from one palette`)
  for (const name of missing.slice(0, 12)) console.log(`    ${name}`)
}
