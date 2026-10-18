#!/usr/bin/env node

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

const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf'
const LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt'

const UNICODES = [
  'U+0020-007E',
  'U+00B7',
  'U+2013-2014',
  'U+2018-201D',
  'U+2022',
  'U+2026',
  'U+2190-2193',
  'U+25A0',
  'U+25CF',
  'U+00D7',
  'U+2713',
  'U+2717',
].join(',')

const MAX_BYTES = 64 * 1024

const family = 'ZMD Archivo'

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
  const body = `export const FONT_FAMILY = ${JSON.stringify(family)}

export const FONT_PROVENANCE = ${JSON.stringify({
    source: FONT_URL,
    license: 'SIL Open Font License 1.1',
    copyright,
    axes,
    unicodes: UNICODES,
    bytes: bytes.length,
  }, null, 2)}

export const FONT_WOFF2_BASE64 = ${JSON.stringify(base64)}
`
  writeFileSync(outFile, body)
  console.log(`wrote ${outFile} (${bytes.length} B woff2 / ${base64.length} B base64)`)
  console.log(`wrote ${licenseFile}`)
}

main()
