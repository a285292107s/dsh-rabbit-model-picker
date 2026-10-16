/**
 * Offline render of ONE model row, built from the real pieces:
 *
 *   - the host's own tag sheet (`dsh-client-ui-primitives/lib/Tag.module.css`);
 *   - the host's own token sheet, pulled from the theme bundle the same way
 *     `scripts/check-contrast.mjs` pulls it (light under `body`, dark under
 *     `body[data-ds-dark-theme]`);
 *   - this plugin's COMPILED sheet, extracted from `lib/client.js`, so what is
 *     measured is what ships rather than a hand copy;
 *   - the exact DOM `Picker.tsx` renders for a row (name + four badges), with
 *     the badge glyphs inlined from `BadgeIcons.tsx`'s artwork.
 *
 * This exists because the GUI needs a token this script will not invent. It is
 * a faithful reproduction of the row's own subtree and nothing else — it does
 * not claim to reproduce the card, the menu chrome or the placement.
 *
 * Run: node scripts/_render-row.cjs
 */
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve, join } = require('node:path')

const root = resolve(__dirname, '..')
const hostModules = join(
  process.env.APPDATA ?? '',
  'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai',
)

/** The host's Tag sheet: the primitive the badges are built from. The shell
 *  hashes these class names at build time; rewrite every local class to the
 *  plain name the plugin's own sheet and DOM use. */
const tagSheet = readFileSync(join(hostModules, 'dsh-client-ui-primitives/lib/Tag.module.css'), 'utf8')
  .replace(/\._?tag[A-Za-z0-9_-]*/g, '.tag')

/**
 * The host's token sheet.
 *
 * The theme bundle is JavaScript, not CSS: its sheets are string literals
 * (`var x_css_default = "…"`) interleaved with `//#region` comments and JS. A
 * browser drops every rule after the first parse error, so the literals have to
 * be unwrapped — taking each `"…"` payload that contains a `--dsw-` declaration
 * and joining them in file order, which is also the cascade order the shell
 * applies them in.
 * @returns the concatenated token CSS.
 */
function tokenCss() {
  const source = readFileSync(join(hostModules, 'dsh-client-ui-theme/lib/client.js'), 'utf8')
  // Each sheet is published as `var <name>_css_default = "<css>"`. Anchoring on
  // that assignment is what keeps JS comments (`//#region`) and unrelated string
  // literals out of the sheet — a single stray `//` line makes the browser drop
  // every rule after it.
  const chunks = []
  for (const match of source.matchAll(/var\s+\w*_?css_default\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    const body = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
    if (body.includes('--dsw-')) chunks.push(body)
  }
  if (chunks.length === 0) throw new Error('the theme bundle published no token CSS')
  return chunks.join('\n')
}

/** The plugin's compiled sheet. */
const pluginSheet = readFileSync(resolve(root, 'shots/_extracted.css'), 'utf8')

/**
 * The four glyphs, inlined from BadgeIcons.tsx's own artwork. The stroke and
 * viewBox per grid are the file's constants; the value cell is the badge's
 * text half.
 */
const GLYPH = {
  text: `<path d="M5.4 2.5 H8.5 L12 6 V12.1 A1.4 1.4 0 0 1 10.6 13.5 H5.4 A1.4 1.4 0 0 1 4 12.1 V3.9 A1.4 1.4 0 0 1 5.4 2.5 Z" /><path d="M8.5 2.5 V6 H12" /><path d="M6.5 9 H9.5" /><path d="M6.5 11 H9.5" />`,
  image: `<path d="M2.75 8 C4.6 4.8 6.5 3.5 8 3.5 C9.5 3.5 11.4 4.8 13.25 8 C11.4 11.2 9.5 12.5 8 12.5 C6.5 12.5 4.6 11.2 2.75 8 Z" /><circle cx="8" cy="8" r="1.6" />`,
  effort: `<path d="M4 8h8M8 4v8" />`,
  context: `<rect x="2.5" y="4.5" width="11" height="7" rx="1.5" /><path d="M5 7.2h6M5 9h3.5" />`,
}

/**
 * One badge, as Picker.tsx builds it: the icon cell then the value cell.
 * @param fact - the fact key.
 * @param tone - the Tag tone the row passes.
 * @param value - the value cell's text, empty for the two yes/no facts.
 * @param off - whether the glyph is slashed.
 */
function badge(fact, tone, value, off) {
  const slash = off
    ? `<path d="M3 13 13 3" stroke-width="1.6" />`
    : ''
  const valueCell = value === '' ? '' : `<span class="dmp-badge-value">${value}</span>`
  return `<span class="tag dmp-badge" data-tone="${tone}">`
    + `<span class="dmp-badge-fact"><svg class="dmp-badge-icon" width="14" height="14" viewBox="0 0 16 16" `
    + `fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">`
    + `${GLYPH[fact]}${slash}</svg></span>${valueCell}</span>`
}

/**
 * One model row. The `showOff` flag is the whole before/after difference in
 * which facts reach the strip:
 *   - framed (before): every fact renders, an `off` one slashed and in the
 *     quiet tone (no fill, dim ink) inside the row;
 *   - frameless (after): Picker.tsx now filters `spec.off`, so only `on` facts
 *     render and every shown badge is the neutral tone.
 * @param name - the model name.
 * @param facts - [fact, off, value] triples, the real badgeSpecsOf output shape.
 * @param showOff - whether `off` facts still get a badge (the framed pane).
 */
function row(name, facts, showOff) {
  const shown = showOff ? facts : facts.filter(([, off]) => off !== true)
  const badges = shown.map(([fact, off, value]) => {
    const tone = showOff && off === true ? 'quiet' : 'neutral'
    return badge(fact, tone, value, off === true)
  }).join('')
  const strip = shown.length === 0 ? '' : `<span class="dmp-badges">${badges}</span>`
  return `<div class="dmp-row" role="menuitemradio" aria-checked="false">
  <span class="dmp-row-copy">
    <span class="dmp-row-name">${name}</span>
    ${strip}
  </span>
  <span class="dmp-check"></span>
</div>`
}

/* The fixtures are the real badgeSpecsOf output shape: [fact, off, value].
   `off` is what the render rule keys on (an off fact is hidden), so at least
   one row must carry off facts. The effort badge now names no level — the row
   states only that the model CAN reason, so its value is always ''. */
/** A fully-declared route: every fact on. */
const FULL = [
  ['text', false, ''],
  ['image', false, ''],
  ['effort', false, ''],
  ['context', false, '262K'],
]
/** Text-only: the image fact is off (the `second` shape in test-params). */
const TEXT_ONLY = [
  ['text', false, ''],
  ['image', true, ''],
  ['effort', false, ''],
  ['context', false, '1M'],
]
/** A bare route: both modalities off and no reasoning ability declared. */
const BARE = [
  ['text', true, ''],
  ['image', true, ''],
  ['effort', true, ''],
  ['context', false, '1M'],
]

const FIXTURES = [
  ['dots3-note-prev', FULL],
  ['DeepSeek-V41-Flash', FULL],
  ['DeepSeek V4.1 Flash', TEXT_ONLY],
  ['Deepseek-V4.1-Flash · x0.11', BARE],
  ['DeepSeek V4.1 Flash Fast', FULL],
  ['DeepSeek-V4-Pro', TEXT_ONLY],
]

const before = FIXTURES.map(([name, facts]) => row(name, facts, true)).join('')
const after = FIXTURES.map(([name, facts]) => row(name, facts, false)).join('')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${tokenCss()}
${tagSheet}
/* The card the rows sit in, from the plugin's own sheet, so the strip is judged
   on the surface it actually ships over. */
.dmp-menu {
  box-sizing: border-box;
  width: 320px;
  padding: 6px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-menu-surface-fill);
}
body { margin: 0; padding: 24px; background: var(--dsw-alias-bg-base); }
/* Two panes: the shipped look, and the same rows with the OLD framed capsule
   restored, so the comparison is side by side in one shot. */
.pane { margin-bottom: 28px; }
.pane > h2 { font: 600 12px system-ui; color: var(--dsw-alias-label-secondary); margin: 0 0 8px; }
${pluginSheet}
/* AFTER the shipped sheet, so these win. The card ships as a portaled
   position:fixed popover; this static harness stacks two of them, so the
   placement is neutralized here — the row subtree under test is untouched. */
.dmp-menu {
  position: static;
  max-height: none;
  box-shadow: none;
}
.dmp-groups { overflow: visible; }
/* …and the framed pane restores exactly what the capsule used to paint. */
.framed .dmp-badges { gap: 2px; }
.framed .dmp-badges .dmp-badge {
  padding: 0 4px;
  background: var(--dsw-alias-bg-module-platform);
}
.framed .dmp-badges .dmp-badge[data-tone='quiet'] { background: transparent; }
</style></head>
<body>
  <div class="pane"><h2>1. Framed (before)</h2><div class="dmp-menu framed">${before}</div></div>
  <div class="pane"><h2>2. Frameless, off facts hidden (after, shipped)</h2><div class="dmp-menu">${after}</div></div>
</body></html>`

const out = resolve(root, 'shots/_row-compare.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes)`)
