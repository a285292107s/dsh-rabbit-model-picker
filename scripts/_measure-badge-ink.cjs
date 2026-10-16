/**
 * Measure the badge inks against the CARD the strip now sits on directly.
 *
 * `scripts/check-contrast.mjs` judges every text rule against
 * `--dsw-menu-surface-fill` over the two card backdrops. That is still the right
 * backdrop here — with the capsule fill gone, `.dmp-badge-value` and the glyph
 * sit on the card rather than on a `bg-module-platform` capsule — but the gate
 * does not list the badge GLYPH (it is exempted as an icon slot). Removing the
 * frame makes the glyph the primary carrier of "which fact", so its ratio is
 * worth having a number for.
 *
 * Run: node scripts/_measure-badge-ink.cjs
 */
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const host = join(
  process.env.APPDATA ?? '',
  'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai',
)
const source = readFileSync(join(host, 'dsh-client-ui-theme/lib/client.js'), 'utf8')

/** Both palettes, the way the contrast gate reads them. */
const bags = { light: {}, dark: {} }
for (const match of source.matchAll(/var\s+\w*_?css_default\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
  const sheet = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
  for (const rule of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const target = rule[1].includes('data-ds-dark-theme') ? bags.dark : bags.light
    for (const declaration of rule[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const name = declaration.slice(0, colon).trim()
      if (name.startsWith('--')) target[name] = declaration.slice(colon + 1).trim()
    }
  }
}

const parse = text => {
  const hex = /^#([0-9a-f]{3,8})$/i.exec((text ?? '').trim())
  if (hex === null) return null
  let digits = hex[1]
  if (digits.length === 3) digits = digits.split('').map(c => c + c).join('')
  if (digits.length === 6) digits += 'ff'
  if (digits.length !== 8) return null
  return [0, 2, 4, 6].map(at => parseInt(digits.slice(at, at + 2), 16))
    .map((value, index) => (index === 3 ? value / 255 : value))
}

/** Resolve a token through `var()` chains. */
const resolve = (bag, name, depth = 0) => {
  if (depth > 12) return null
  const value = bag[name]
  if (value === undefined) return null
  const reference = /^var\((--[^,)]+)(?:,\s*(.+))?\)$/.exec(value.trim())
  return reference === null ? parse(value) : resolve(bag, reference[1], depth + 1)
}

const over = (fg, bg) => [0, 1, 2].map(c => Math.round(fg[c] * fg[3] + bg[c] * (1 - fg[3])))
const luminance = rgb => {
  const [r, g, b] = rgb.map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** The backdrops the card can sit on, composited exactly as the gate does. */
const backdrops = bag => {
  const fill = resolve(bag, '--dsw-menu-surface-fill')
  return ['--dsw-alias-bg-base', '--dsw-specific-input-major']
    .map(token => resolve(bag, token))
    .filter(page => page !== null)
    .map(page => over(fill, page))
}

// The inks the badge paints with, each with the WCAG floor that actually
// applies. The glyph is an ICON slot, not copy: the fact it encodes is spelled
// out in the row's aria-label and, for the two valued facts, in the adjacent
// value cell in text — so it is judged on 1.4.11's 3:1 non-text floor, exactly
// as `check-contrast.mjs` exempts it. The value cell IS text and owes 4.5:1.
const INKS = [
  { label: 'badge glyph, on', token: '--dsw-alias-label-secondary', floor: 3, kind: 'icon (1.4.11)' },
  { label: 'badge glyph, off', token: '--dsw-alias-label-tertiary', floor: 3, kind: 'icon (1.4.11)' },
  { label: 'badge value', token: '--dsw-alias-label-secondary', floor: 4.5, kind: 'text (AA)' },
]

let failures = 0
for (const which of ['light', 'dark']) {
  const bag = bags[which]
  const cards = backdrops(bag)
  const capsule = resolve(bag, '--dsw-alias-bg-module-platform')
  console.log(`\n${which}:`)
  for (const { label, token, floor, kind } of INKS) {
    const ink = resolve(bag, token)
    if (ink === null) { console.log(`  ${label}: token did not resolve`); failures += 1; continue }
    // Frameless: the ink sits on the card itself.
    const onCard = Math.min(...cards.map(card => contrast(over(ink, card), card)))
    // Framed: on the capsule fill, which is itself over the card.
    const onCapsule = capsule === null
      ? null
      : Math.min(...cards.map(card => contrast(over(ink, over(capsule, card)), over(capsule, card))))
    const verdict = onCard >= floor ? 'PASS' : 'FAIL'
    if (onCard < floor) failures += 1
    console.log(`  ${label.padEnd(18)} ${token}  [${kind}, floor ${floor}:1]`)
    console.log(`      frameless (on card)  : ${onCard.toFixed(2)}:1  [${verdict}]`)
    if (onCapsule !== null) {
      console.log(`      framed    (on capsule): ${onCapsule.toFixed(2)}:1`)
    }
  }
}
console.log(failures === 0
  ? '\nbadge ink: every ink clears its own floor on the card'
  : `\nbadge ink: ${failures} ink(s) below their floor on the card`)
process.exitCode = failures > 0 ? 1 : 0
