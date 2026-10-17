/**
 * 改坏验证 for the INK quality gates (docs/ink-design-language.md §10).
 *
 * The HUD revision of this suite (signal yellow, field codes, notch/wipe, dot
 * matrix) is RETIRED with the direction it proved. This suite proves the ink
 * gates that replaced it:
 *
 *   - the token layer is the only place a colour literal may be spelled;
 *   - the accent / focus / error roles reference the HOST palette (one palette);
 *   - every referenced `--zmd-*` token is declared (a typo paints nothing);
 *   - the 1px roles are structure / registered control edge / 2px accent bar /
 *     4px error bar, and hover is the hover token;
 *   - the host blue never paints text and a blue fill carries on-accent ink;
 *   - the only textures are the wash gradient and the one grain data URI;
 *   - the wash's two ends both keep the words readable;
 *   - the rejected HUD vocabulary stays gone (no FIELD_CODES / zmd-code / notch /
 *     clip-path / signal colour) and no display-tier type returns;
 *   - the embedded face keeps its three byte counts and the OFL notice.
 *
 * EACH MUTATION IS A REAL DEFECT, NOT A SYNTAX ERROR: the point is that the gate
 * names the rule. The source is restored byte-identically after every mutation and
 * the BASELINE must be green first — a red baseline would satisfy the detector for
 * every mutation and certify nothing.
 *
 * Run: node scripts/mutate-ink-gates.mjs
 *
 * @module dsh-rabbit-model-picker/mutate-ink-gates
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const SELFCHECK = 'scripts/selfcheck-static.mjs'
const CONTRAST = 'scripts/check-contrast.mjs'
const DESIGN_SYSTEM = 'src/client/designSystem.ts'
const FONT_ASSET = 'src/client/fontAsset.ts'
const SEAT = 'src/client/styles.ts'
const PICKER = 'src/client/Picker.tsx'

/**
 * The gates this suite is the proof for. Both are static (no build, no browser),
 * so the suite runs wherever `selfcheck` does; build-fresh is deliberately absent
 * — it judges HEAD, and a working-tree mutation can never change what HEAD says.
 */
const GATES = [SELFCHECK, CONTRAST]

/**
 * Run one gate.
 * @param gate - repository-relative script path.
 * @returns whether it failed and its output.
 */
function runGate(gate) {
  const run = spawnSync(process.execPath, [gate], { encoding: 'utf8' })
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  return { failed: run.status !== 0 || /(?:^|\n)\s*FAIL\b/.test(output), output }
}

const MUTATIONS = [
  {
    name: 'token layer: a colour literal escapes into a primitive rule',
    file: DESIGN_SYSTEM,
    from: '  background: var(--zmd-line);',
    to: '  background: #d8d8d4;',
    breaks: '§10: literals live only in the --zmd-* token blocks',
  },
  {
    name: 'token: the accent spells a literal instead of the host palette',
    file: DESIGN_SYSTEM,
    from: '  --zmd-accent: var(--dsw-alias-state-business-primary);',
    to: '  --zmd-accent: #4176e6;',
    breaks: '§2: the accent is the host\'s own information blue (one palette)',
  },
  {
    name: 'token: the focus role points at the error colour',
    file: DESIGN_SYSTEM,
    from: '  --zmd-focus: var(--dsw-alias-state-business-primary);',
    to: '  --zmd-focus: var(--dsw-alias-state-error-primary);',
    breaks: '§2.3/§5: the focus ring is the host blue, not the error red',
  },
  {
    name: 'token: the host aliases move back onto :root (empty var() evaluation)',
    file: DESIGN_SYSTEM,
    from: 'body {\n  --zmd-accent: var(--dsw-alias-state-business-primary);',
    to: ':root {\n  --zmd-accent: var(--dsw-alias-state-business-primary);',
    breaks: '§2: var() is substituted on the declaring element; the host palette lives on <body>',
  },
  {
    name: 'token: a referenced --zmd-* token does not exist (paints nothing)',
    file: SEAT,
    from: '.dmp-rail-row:hover:not(:disabled),\n.dmp-rail-row:focus-visible {\n  background: var(--zmd-hover);',
    to: '.dmp-rail-row:hover:not(:disabled),\n.dmp-rail-row:focus-visible {\n  background: var(--zmd-hoverr);',
    breaks: '§2: every referenced token must be declared (a typo is silent)',
  },
  {
    name: 'wash: a stop leaves the three-token set',
    file: DESIGN_SYSTEM,
    from: 'var(--zmd-panel) 58%',
    to: 'var(--zmd-ink) 58%',
    breaks: '§10: the wash stops are only wash-top / panel / wash-bottom',
  },
  {
    name: 'grain: the noise tile is no longer the inline SVG',
    file: DESIGN_SYSTEM,
    from: 'background-image: url("data:image/svg+xml,',
    to: 'background-image: url("data:image/png;base64,',
    breaks: '§10: the one data URI is the SVG fractal-noise tile',
  },
  {
    name: 'wash end: the bright end of the wash stops carrying AA text',
    file: DESIGN_SYSTEM,
    from: '  --zmd-wash-top: #fbfbfa;',
    to: '  --zmd-wash-top: #c8c8c4;',
    breaks: '§2.2: every word must clear AA against BOTH ends of the wash',
  },
  {
    name: 'contrast: the muted ink drops under the AA floor',
    file: DESIGN_SYSTEM,
    from: '  --zmd-ink-mute: #66665f;',
    to: '  --zmd-ink-mute: #b6b6b0;',
    breaks: '§2.1: the muted ordinals keep their measured 5.18:1 (light)',
  },
  {
    name: 'contrast: the decorative line jumps into the text band',
    file: DESIGN_SYSTEM,
    from: '  --zmd-line: #d8d8d4;',
    to: '  --zmd-line: #141414;',
    breaks: '§2.1: the line stays in its measured 1.26–2.51 visibility band',
  },
  {
    name: 'contrast: the form-control edge falls under the 3:1 boundary floor',
    file: DESIGN_SYSTEM,
    from: '  --zmd-line-control: #82827c;',
    to: '  --zmd-line-control: #d8d8d4;',
    breaks: '§2.1/§10: a field edge is a graphical boundary and owes 3:1',
  },
  {
    name: 'accent: the ink on the blue fill is no longer on-accent',
    file: DESIGN_SYSTEM,
    from: '  --zmd-on-accent: var(--zmd-panel);',
    to: '  --zmd-on-accent: var(--zmd-ink-mute);',
    breaks: '§2.3/§5: the blue fill carries on-accent ink only',
  },
  {
    name: 'font: the embedded payload loses its woff2 magic',
    file: FONT_ASSET,
    from: 'export const FONT_WOFF2_BASE64 = "',
    to: 'export const FONT_WOFF2_BASE64 = "AAAA',
    breaks: '§3/§10: the decoded payload must be woff2',
  },
  {
    name: 'font: the generated header byte count drifts from the payload',
    file: FONT_ASSET,
    from: '* Raw woff2: 46728 bytes',
    to: '* Raw woff2: 46729 bytes',
    breaks: '§3: the three byte counts must agree (header / provenance / decoded)',
  },
  {
    name: 'fill: a row hover goes back to the line colour (AA failure)',
    file: SEAT,
    from: '.dmp-rail-row:hover:not(:disabled),\n.dmp-rail-row:focus-visible {\n  background: var(--zmd-hover);',
    to: '.dmp-rail-row:hover:not(:disabled),\n.dmp-rail-row:focus-visible {\n  background: var(--zmd-line);',
    breaks: '§5: row hover is --zmd-hover; --zmd-line is a line, not a fill',
  },
  {
    name: 'accent: the blue is used as text (3.91:1 in the light theme)',
    file: SEAT,
    from: '  color: inherit;\n  font-size: 13px;\n  line-height: 18px;',
    to: '  color: var(--zmd-accent);\n  font-size: 13px;\n  line-height: 18px;',
    breaks: '§2.3/§5: the host blue is graphic-only and never a word',
  },
  {
    name: 'error: the red is used as text',
    file: SEAT,
    from: '  color: inherit;\n  font-size: 13px;\n  line-height: 18px;',
    to: '  color: var(--zmd-danger);\n  font-size: 13px;\n  line-height: 18px;',
    breaks: '§5.4: the error red is a 4px bar, never a word',
  },
  {
    name: 'geometry: the elevation shadow returns to the card',
    file: SEAT,
    from: '  background: var(--zmd-panel);',
    to: '  background: var(--zmd-panel);\n  box-shadow: var(--dsw-elevation-prominent);',
    breaks: '§4: no shadow expresses hierarchy — the surface is one opaque plane',
  },
  {
    name: 'geometry: a fade returns (opacity on the card)',
    file: SEAT,
    from: '  background: var(--zmd-panel);',
    to: '  background: var(--zmd-panel);\n  opacity: 0.55;',
    breaks: '§4: no opacity/filter/text-shadow/mix-blend may dim text',
  },
  {
    name: 'geometry: a rounded corner returns under a host radius token',
    file: SEAT,
    from: '  background: var(--zmd-panel);',
    to: '  background: var(--zmd-panel);\n  border-radius: var(--dsw-radius-sm);',
    breaks: '§4: all right angles; only a 50% state dot is round',
  },
  {
    name: 'texture: a gradient outside the wash returns to a sheet',
    file: SEAT,
    from: '  background: var(--zmd-panel);',
    to: '  background: linear-gradient(var(--zmd-panel), var(--zmd-panel-deep));',
    breaks: '§10: a sheet carries no gradient — the wash owns the only one',
  },
  {
    name: 'HUD: the clip-path reveal returns',
    file: SEAT,
    from: '  position: fixed;\n  z-index: 1100;',
    to: '  position: fixed;\n  z-index: 1100;\n  clip-path: inset(0);',
    breaks: '§10: clip-path / notch / wipe are retired with the HUD',
  },
  {
    name: 'HUD: a field-code class returns to the seat markup',
    file: PICKER,
    from: '<span className="dmp-trigger-label">{triggerLabel}</span>',
    to: '<span className="dmp-trigger-label zmd-code">{triggerLabel}</span>',
    breaks: '§10: FIELD_CODES / zmd-code are retired; the vocabulary must not return',
  },
  {
    name: 'HUD: display-tier type returns',
    file: SEAT,
    from: '  color: inherit;\n  font-size: 13px;\n  line-height: 18px;',
    to: '  color: inherit;\n  font-size: 44px;\n  line-height: 18px;',
    breaks: '§3/§4: no 44px display tier and no HUD display type',
  },
]

const original = new Map(MUTATIONS.map(mutation => [mutation.file, readFileSync(mutation.file, 'utf8')]))

/** The newline a file actually uses. */
function newlineOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/** Re-space a pattern's `\n` to the file's own newline. */
function inFileNewlines(pattern, text) {
  const newline = newlineOf(text)
  return newline === '\n' ? pattern : pattern.replace(/\r?\n/g, newline)
}

function restore() {
  for (const [file, text] of original) writeFileSync(file, text, 'utf8')
}

// --- baseline preflight ----------------------------------------------------
const baseline = GATES.map(gate => ({ gate, ...runGate(gate) }))
const baselineRed = baseline.filter(entry => entry.failed)
if (baselineRed.length > 0) {
  console.error('ink mutations: BASELINE IS RED — refusing to run. A red gate would "catch" every mutation, so this run would prove nothing.')
  for (const entry of baselineRed) {
    const failing = entry.output.split(/\r?\n/).filter(line => /^\s*FAIL\b/.test(line)).slice(0, 6)
    console.error(`  ${entry.gate}`)
    for (const line of failing) console.error(`    ${line.trim()}`)
  }
  process.exit(1)
}
console.log(`  baseline: ${GATES.length} gate(s) green`)

// A pattern that no longer matches / matches twice is a HARNESS failure, not a
// pass: the mutation was not applied (or applied to a different decision than the
// one it names), so the run would prove nothing about the protection.
const rows = []
for (const mutation of MUTATIONS) {
  const source = readFileSync(mutation.file, 'utf8')
  const from = inFileNewlines(mutation.from, source)
  const to = inFileNewlines(mutation.to, source)
  const hits = source.split(from).length - 1
  if (hits !== 1) {
    rows.push(['STALE', mutation.name, hits === 0 ? 'pattern not found' : `pattern matches ${hits} sites`])
    continue
  }
  writeFileSync(mutation.file, source.replace(from, to), 'utf8')
  let caught = null
  try {
    for (const gate of GATES) {
      if (runGate(gate).failed) { caught = gate; break }
    }
  } finally {
    writeFileSync(mutation.file, original.get(mutation.file), 'utf8')
  }
  rows.push([caught === null ? 'MISSED' : 'RED', mutation.name,
    caught === null ? `gate passed — unprotected (${mutation.breaks})` : `caught by ${caught}`])
}

restore()

for (const [verdict, name, note] of rows) {
  console.log(`  ${verdict === 'RED' ? 'ok  ' : 'BAD '} ${name} — ${note}`)
}

const stale = rows.filter(([verdict]) => verdict === 'STALE')
const unprotected = rows.filter(([verdict]) => verdict === 'MISSED')
if (stale.length > 0) {
  console.log(`\n${stale.length} mutation(s) no longer apply — this file is describing code that moved:`)
  for (const [, name, note] of stale) console.log(`  - ${name}: ${note}`)
}
if (unprotected.length > 0) {
  console.log(`\n${unprotected.length} mutation(s) are NOT protected by any gate:`)
  for (const [, name] of unprotected) console.log(`  - ${name}`)
}
console.log(`\n${rows.length - stale.length - unprotected.length}/${rows.length} mutations caught`)
process.exitCode = stale.length > 0 || unprotected.length > 0 ? 1 : 0
