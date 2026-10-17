#!/usr/bin/env node
/**
 * Regenerate `src/client/fontAsset.ts`: the embedded technical Latin face.
 *
 * WHY THIS EXISTS. The design language (`docs/ink-design-language.md` §2)
 * calls for a condensed/expanded technical grotesque over the host's CJK stack.
 * A DSH client plugin ships ONE browser module (`lib/client.js`) and the seed
 * `files` list carries no font assets, so the face has to travel inside the
 * module: a `@font-face` rule whose `src` is a base64 woff2 data URI.
 *
 * THE ASSET IS COMMITTED. This script needs Python + fonttools + network, none
 * of which a git install (or CI) has. It is a REGENERATION tool, run by hand;
 * `npm run build` never calls it. The generated file states the source URL, the
 * subset ranges and the OFL notice, so the provenance of a 50 KB blob is not a
 * mystery in review.
 *
 * WHY ARCHIVO. SIL OFL 1.1, variable on both axes this language needs — width
 * (62..125) for the wide display numerals and condensed field codes, weight
 * (100..900) for the ink ladder. It is subsetted to the Latin/symbol ranges the
 * UI can actually paint; CJK comes from the host font stack.
 *
 * Usage: node scripts/build-font-asset.mjs
 *
 * @module dsh-rabbit-model-picker/build-font-asset
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache', 'fonts')
const sourceFile = join(cacheDir, 'Archivo[wdth,wght].ttf')
const licenseFile = join(root, 'docs', 'fonts', 'Archivo-OFL.txt')
const outFile = join(root, 'src', 'client', 'fontAsset.ts')
const subsetFile = join(cacheDir, 'archivo-subset.woff2')

/** Upstream variable font (Google Fonts repository, the OFL origin). */
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf'
/** Its license, shipped in-repo AND with the package (`files`). */
const LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt'

/**
 * The glyphs the UI can paint: printable ASCII (model ids, route ids, field
 * codes, Latin names) plus the handful of symbols the sheets/templates use.
 * Everything else falls through to the host's CJK stack.
 */
const UNICODES = [
  'U+0020-007E', // printable ASCII
  'U+00B7', // middle dot — trigger separator
  'U+2013-2014', // en/em dash
  'U+2018-201D', // curly quotes (copy uses them; ASCII quotes are the fallback)
  'U+2022', // bullet
  'U+2026', // ellipsis
  'U+2190-2193', // arrows
  'U+25A0', // black square (field-code marker)
  'U+25CF', // black circle (status dot)
  'U+00D7', // multiplication sign (close)
  'U+2713', // check
  'U+2717', // ballot X
].join(',')

/** Upper bound on the embedded woff2, so a careless subset cannot bloat the bundle. */
const MAX_BYTES = 64 * 1024

const family = 'ZMD Archivo'

/** Download a URL to a local path when the cache does not have it. */
function fetchTo(url, path) {
  if (existsSync(path)) return
  mkdirSync(dirname(path), { recursive: true })
  console.log(`download ${url}`)
  execFileSync(process.platform === 'win32' ? 'pwsh' : 'bash', [
    process.platform === 'win32' ? '-NoProfile' : '-c',
    ...(process.platform === 'win32'
      ? ['-Command', `Invoke-WebRequest -Uri '${url}' -OutFile '${path}' -UseBasicParsing -TimeoutSec 60`]
      : [`curl -fsSL -o '${path}' '${url}'`]),
  ], { stdio: 'inherit' })
}

/** Run pyftsubset, or explain exactly what is missing. */
function subsetFont() {
  try {
    execFileSync('python', [
      '-m', 'fontTools.subset', sourceFile,
      `--output-file=${subsetFile}`,
      '--flavor=woff2',
      `--unicodes=${UNICODES}`,
      '--layout-features=kern,liga,tnum,case',
      '--name-IDs=1,2,3,4,5,6',
      '--no-hinting',
      '--desubroutinize',
    ], { stdio: 'inherit' })
  } catch (error) {
    throw new Error(
      'pyftsubset failed. This is a REGENERATION tool: install Python 3 + fonttools '
      + '(`pip install fonttools brotli`) and re-run. The committed src/client/fontAsset.ts '
      + 'is what the build consumes, so ordinary builds do not need this.\n'
      + String(error.message ?? error),
    )
  }
}

/** Read the variable axes, so the generated file states what it kept. */
function axesOf() {
  const probe = execFileSync('python', ['-c', [
    'import json,sys',
    'from fontTools.ttLib import TTFont',
    'f=TTFont(sys.argv[1])',
    'print(json.dumps([{"tag":a.axisTag,"min":a.minValue,"default":a.defaultValue,"max":a.maxValue} for a in f["fvar"].axes]))',
  ].join('\n'), sourceFile], { encoding: 'utf8' })
  return JSON.parse(probe)
}

function main() {
  fetchTo(FONT_URL, sourceFile)
  fetchTo(LICENSE_URL, licenseFile)
  subsetFont()
  const bytes = readFileSync(subsetFile)
  if (bytes.length > MAX_BYTES) throw new Error(`subset is ${bytes.length} bytes, over the ${MAX_BYTES} budget`)
  const axes = axesOf()
  const base64 = bytes.toString('base64')
  const license = readFileSync(licenseFile, 'utf8')
  const copyright = /Copyright[^\n]*/u.exec(license)?.[0] ?? 'SIL Open Font License 1.1'
  const body = `/**
 * GENERATED by scripts/build-font-asset.mjs — do not edit by hand.
 *
 * The embedded technical Latin face of the \`--zmd-*\` design language
 * (docs/ink-design-language.md §2). Why a data URI and not a file:
 * the plugin ships one browser module and no asset server (see the script).
 *
 * Source: ${FONT_URL}
 * Family: ${family} (renamed; the OFL has no reserved name, and the subset is a
 *         Modified Version — the name keeps the origin legible without
 *         impersonating the upstream release)
 * Axes kept: ${axes.map((axis) => `${axis.tag} ${axis.min}..${axis.max}`).join(', ')}
 * Subset: ${UNICODES}
 * Raw woff2: ${bytes.length} bytes
 * ${copyright}
 *
 * ${license.trim().split('\n')[0]}
 * Full license: docs/fonts/Archivo-OFL.txt (shipped with the package).
 */

/** The CSS family name the token layer declares. */
export const FONT_FAMILY = ${JSON.stringify(family)}

/** Provenance for the docs gate; not read at runtime. */
export const FONT_PROVENANCE = ${JSON.stringify({
    source: FONT_URL,
    license: 'SIL Open Font License 1.1',
    copyright,
    axes,
    unicodes: UNICODES,
    bytes: bytes.length,
  }, null, 2)}

/** woff2 payload, base64 (embedded by \`designSystem.ts\`). */
export const FONT_WOFF2_BASE64 = ${JSON.stringify(base64)}
`
  writeFileSync(outFile, body)
  console.log(`wrote ${outFile} (${bytes.length} B woff2 / ${base64.length} B base64)`)
  console.log(`wrote ${licenseFile}`)
}

main()
