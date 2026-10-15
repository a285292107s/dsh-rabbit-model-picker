/**
 * Print the host token values the design needs, per theme, straight from the
 * theme bundle the way scripts/check-contrast.mjs reads it.
 *
 * Run: node scripts/_dump-tokens.cjs [token ...]
 */
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const hostModules = join(
  process.env.APPDATA ?? '',
  'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai',
)
const source = readFileSync(join(hostModules, 'dsh-client-ui-theme/lib/client.js'), 'utf8')
const chunks = []
for (const match of source.matchAll(/var\s+\w*_?css_default\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
  const body = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
  if (body.includes('--dsw-')) chunks.push(body)
}
const css = chunks.join('\n')

const wanted = process.argv.slice(2)
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]])

for (const [selector, body] of blocks) {
  const names = [...body.matchAll(/(--dsw-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
  const hit = names.filter(([, n]) => wanted.length === 0 || wanted.some(w => n.includes(w)))
  if (hit.length === 0) continue
  console.log(`\n=== ${selector.replace(/\s+/g, ' ').slice(0, 120)} ===`)
  const seen = new Set()
  for (const [, n, v] of hit) {
    if (seen.has(n)) continue
    seen.add(n)
    console.log(`  ${n}: ${v.trim()}`)
  }
}
