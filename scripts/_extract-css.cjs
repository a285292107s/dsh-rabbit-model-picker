/**
 * Extract the compiled CSS template out of the built client bundle, so a
 * headless render can use the EXACT sheet that ships (not a hand copy).
 *
 * Run: node scripts/_extract-css.cjs
 */
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const root = resolve(__dirname, '..')
const bundle = readFileSync(resolve(root, 'lib/client.js'), 'utf8')

// The sheet is the single template literal holding `.dmp-` rules.
const start = bundle.indexOf('.dmp-root')
if (start < 0) throw new Error('the compiled sheet was not found in lib/client.js')
const open = bundle.lastIndexOf('`', start)
const close = bundle.indexOf('`', start)
if (open < 0 || close < 0) throw new Error('the template literal boundaries were not found')

const css = bundle.slice(open + 1, close)
if (!css.includes('.dmp-badges')) throw new Error('the extracted sheet does not contain the badge rules')

const out = resolve(root, 'shots/_extracted.css')
writeFileSync(out, css)
console.log(`extracted ${css.length} bytes -> ${out}`)
