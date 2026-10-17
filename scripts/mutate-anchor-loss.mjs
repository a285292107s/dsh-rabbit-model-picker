/**
 * 改坏验证 for §5.18 … and, since the Endfield revision, the gate ON the gates:
 * each mutation breaks one decision a gate rests on; a gate has to notice every
 * one of them, and the source has to come back byte-identical afterwards.
 *
 * THE BASELINE MUST BE GREEN BEFORE ANY MUTATION RUNS. This is not a convenience:
 * when the tree is half-edited (or a parallel writer is mid-save) an unrelated red
 * gate satisfies the mutation detector for every mutation, so the whole suite
 * reports "caught" while it has proved nothing. That failure mode is worse than a
 * red gate, so the preflight below refuses to run on a red baseline instead of
 * counting it as success.
 *
 * Written as a script rather than a shell one-liner because the mutations are
 * line-anchored text edits, and a PowerShell heredoc that mangles a quote or a
 * newline silently reports a false "gate missed" — which is the one thing this
 * file must never do.
 *
 * Run: node scripts/mutate-anchor-loss.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const SELFCHECK = 'scripts/selfcheck-static.mjs'
const CONTRAST = 'scripts/check-contrast.mjs'
const UNIT = 'scripts/test-params.mjs'
const RECOVERY_GATE = 'scripts/test-rate-limit-recovery.mjs'
const LOSS = 'src/client/anchorLoss.ts'
const PICKER = 'src/client/Picker.tsx'
const RECOVERY = 'src/host/rateLimitRecovery.ts'
const WIRING = 'src/index.ts'

/**
 * Both gates, because the two halves of this rule are checked in different places
 * and a mutation only has to be caught by one of them. The static gate reads the
 * WIRING (is the root the observed node, are both popovers dismissed together),
 * and the unit gate DRIVES the decision (does a one-look dip dismiss the panel).
 * Running only the static gate is what let six logic mutations through unnoticed:
 * a regex can see that `setTimeout(confirm` is written, it cannot see whether the
 * second look actually happens, which is the entire rule.
 *
 * The recovery gate joins them because the newest decision in the repo lives in a
 * module no other gate loads (a Host-side rule, not a page). Its seven mutations
 * drop one condition of that rule, or one half of its wiring; none of them is
 * visible to the static gate, which is exactly why the rule needs a gate that
 * drives it.
 *
 * The contrast gate joins them for the Endfield mutations: the token layer's
 * pairs, the line bands and the per-style AA floors live only there, so a
 * mutation that breaks one of those numbers would otherwise be "unprotected".
 */
const GATES = [SELFCHECK, CONTRAST, UNIT, RECOVERY_GATE]

/**
 * Run one gate and return its combined output.
 * @param gate - repository-relative script path.
 * @returns the stdout and stderr text and whether it failed.
 */
function runGate(gate) {
  const run = spawnSync(process.execPath, [gate], { encoding: 'utf8' })
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  // A nonzero exit OR a line that STARTS with FAIL. The old test was a bare
  // `includes('FAIL')`, which this repo's own selfcheck defeats on every run:
  // one of its green lines reads "ok taste-skill lint: no FAIL on the four
  // round surfaces", so the harness reported `caught by selfcheck-static.mjs`
  // for mutations that selfcheck had exited 0 on.
  const failed = run.status !== 0 || /(?:^|\n)\s*FAIL\b/.test(output)
  return { failed, output, status: run.status }
}

/**
 * The last line of a gate's output, for the report.
 * @param gate - repository-relative script path.
 * @returns the last non-empty line.
 */
function gateSummary(gate) {
  const { output } = runGate(gate)
  return output.trim().split(/\r?\n/).filter(Boolean).pop() ?? '(no output)'
}

// --- the baseline preflight ------------------------------------------------
// A mutation suite is only evidence if the gates start green: otherwise the
// first red gate "catches" every mutation and the report means nothing.
const baseline = GATES.map(gate => ({ gate, ...runGate(gate) }))
const baselineRed = baseline.filter(entry => entry.failed)
if (baselineRed.length > 0) {
  console.error('mutation harness: BASELINE IS RED — refusing to run. A red gate would "catch" every mutation, so this run would prove nothing.')
  for (const entry of baselineRed) {
    const failing = entry.output.split(/\r?\n/).filter(line => /^\s*FAIL\b/.test(line)).slice(0, 6)
    console.error(`  ${entry.gate} (exit ${entry.status})`)
    for (const line of failing) console.error(`    ${line.trim()}`)
  }
  console.error('\nFix the baseline (or run the mutation harness after the implementation lands), then re-run.')
  process.exit(1)
}
console.log(`  baseline: ${GATES.length} gate(s) green`)

const MUTATIONS = [
  {
    name: 'timer -> requestAnimationFrame',
    file: LOSS,
    // The defect this fix was born from: a `display: none` subtree stops the
    // browser servicing the frame callback, so the confirmation never runs and
    // the popover stays open — the original bug, untouched.
    from: 'timer = window.setTimeout(confirm, CONFIRM_DELAY_MS)',
    to: 'requestAnimationFrame(confirm);',
  },
  {
    name: 'seat root -> single anchor',
    file: PICKER,
    from: '() => rootRef.current,',
    to: '() => triggerRef.current,',
  },
  {
    name: 'drop setSettingsAt(false)',
    file: PICKER,
    // The panel is the surface a vanished composer leaves behind, so it has to go
    // with the card. Both closings are checked separately, which is why exactly
    // one of them can be deleted and still be caught.
    from: '        setOpen(false)\n        setSettingsAt(false)\n        // Focus',
    to: '        setOpen(false)\n        // Focus',
  },
  {
    name: 'drop the open-only guard',
    file: PICKER,
    // Without it the observer watches the seat all the time, which makes every
    // surface hostage to ordinary layout noise — the failure mode the negative
    // half of the GUI check exists to catch.
    from: 'if (!open && !settingsAt) return\n    return observeSeatLoss(',
    to: 'return observeSeatLoss(',
  },
  {
    name: 'clientRects -> isConnected',
    file: LOSS,
    // `isConnected` stays true under `display: none`, so the seat would read as
    // present and the popover would keep drifting.
    from: 'return element.isConnected && element.getClientRects().length > 0',
    to: 'return element.isConnected',
  },
  {
    name: 'drop observer.disconnect()',
    file: LOSS,
    from: 'observer.disconnect()',
    to: '/* removed */',
  },
  {
    name: 'drop clearTimeout',
    file: LOSS,
    from: 'if (timer !== null) window.clearTimeout(timer)',
    to: '/* removed */',
  },
  {
    name: 'restore focus on dismissal',
    file: PICKER,
    // Focus has nowhere to go: the trigger is inside the box that just
    // disappeared, and the Host's card autoFocuses its own answer controls.
    // `close()` would also restore focus, so reaching for it here is the
    // tempting wrong answer and the gate has to keep it out.
    from: '        setSettingsAt(false)\n        // Focus is not handed back anywhere',
    to: '        setSettingsAt(false)\n        lastActionRef.current?.focus()\n        // Focus is not handed back anywhere',
  },
  {
    name: 'drop setSelectionFocus(false)',
    file: PICKER,
    // The third release, and the one that was asserted by NOTHING while the design
    // record described this rule as "三个一起关": deleting it left every gate green.
    // The flag latches the trigger's focus ring off, so a stale true means the
    // control is unmarked for a keyboard user once the composer comes back.
    from: '        setSelectionFocus(false)\n      },',
    to: '      },',
  },

  // The six below are the DECISION, not the wiring, and every one of them used to
  // pass every gate in the repo: they were added after driving the real state
  // machine showed the static patterns could not see any of them.
  {
    name: 'confirm on the first look (CONFIRM_LOOKS 2 -> 1)',
    file: LOSS,
    // A re-layout in flight reports 0x0 and recovers within the frame, so this
    // throws away a panel the user can still see and use.
    from: 'const CONFIRM_LOOKS = 2',
    to: 'const CONFIRM_LOOKS = 1',
  },
  {
    name: 'never set the reported flag (dismissal fires repeatedly)',
    file: LOSS,
    from: '    reported = true\n    onLost()',
    to: '    onLost()',
  },
  {
    name: 'ignore the stopped flag (a disposed observer still reports)',
    file: LOSS,
    from: 'if (stopped || reported) return',
    to: 'if (reported) return',
  },
  {
    name: 'invert the recovery test',
    file: LOSS,
    // Every look now reads as a loss and the panel is closed on the first
    // re-layout, however transient.
    from: 'if (seatLeftThePage(root()) === false) {',
    to: 'if (seatLeftThePage(root()) === true) {',
  },
  {
    name: 'arm the observer only when there is no root',
    file: LOSS,
    from: 'if (element !== null) observer.observe(element)',
    to: 'if (element === null) observer.observe(element)',
  },
  {
    name: 'never store the timer (the pending look cannot be cancelled)',
    file: LOSS,
    from: 'timer = window.setTimeout(confirm, CONFIRM_DELAY_MS)',
    to: 'window.setTimeout(confirm, CONFIRM_DELAY_MS)',
  },

  // The five below are the rate-limit wording recovery's own four conditions plus
  // its copy. Each one is a decision the feature rests on, and each is invisible
  // to the static gate because nothing about it is in the client bundle.
  {
    name: 'recovery: promote on the wording alone (the card can no longer switch it off)',
    file: RECOVERY,
    from: 'if (codes === null || !codes.includes(RECOVERED_CODE)) return null',
    to: 'if (codes === null) return null',
  },
  {
    name: 'recovery: promote a code the shipped executor already retries (its budget is double-spent)',
    file: RECOVERY,
    from: 'if (codes.includes(read.code)) return null',
    to: 'if (read.code === RECOVERED_CODE) return null',
  },
  {
    name: 'recovery: let wording outrank a definitive status',
    file: RECOVERY,
    from: 'if (statusBlocksPromotion(read.status)) return null',
    to: 'if (false && statusBlocksPromotion(read.status)) return null',
  },
  {
    name: 'recovery: promote every failure, wording or not',
    file: RECOVERY,
    from: 'if (!statesRateLimit(read.message)) return null',
    to: 'if (false) return null',
  },
  {
    name: 'recovery: rewrite the recorded failure instead of copying it',
    file: RECOVERY,
    from: 'return { ...read, code: RECOVERED_CODE }',
    to: ';(read as { code: string }).code = RECOVERED_CODE\n  return read',
  },
  {
    name: 'wiring: register behind the shipped executor (the decision is already made)',
    file: WIRING,
    from: '    { prepend: true },',
    to: '    {},',
  },
  {
    name: 'wiring: skip the promotion (the rule never reaches the payload)',
    file: WIRING,
    from: 'if (recovered !== null) payload.failure = recovered',
    to: '/* removed */',
  },
]

const original = new Map(MUTATIONS.map(m => [m.file, readFileSync(m.file, 'utf8')]))

/**
 * The newline a file actually uses.
 *
 * `Picker.tsx` is CRLF while the other sources are LF, and the mutation patterns
 * above are written with plain `\n` because that is what a human types. Matching
 * them literally made three of these mutations unapplicable for as long as nobody
 * ran this script — the harness reported "pattern not found" and the three
 * protections it was supposed to be proving went unverified. So the pattern is
 * re-spaced to the file's own ending instead of the file being normalised, which
 * would rewrite every line of a source file as a side effect of a test.
 * @param text - the file's contents.
 * @returns the dominant newline sequence.
 */
function newlineOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/** Re-space a pattern's `\n` to the file's own newline. */
function inFileNewlines(pattern, text) {
  const nl = newlineOf(text)
  return nl === '\n' ? pattern : pattern.replace(/\r?\n/g, nl)
}

function restore() {
  for (const [file, text] of original) writeFileSync(file, text, 'utf8')
}

const rows = []
for (const m of MUTATIONS) {
  const source = readFileSync(m.file, 'utf8')
  const from = inFileNewlines(m.from, source)
  const to = inFileNewlines(m.to, source)
  if (source.includes(from) === false) {
    // A pattern that no longer matches means the mutation was NOT applied, so this
    // run proves nothing about the protection it names. That is a failure of the
    // harness, not a pass: three mutations sat here unapplied for as long as nobody
    // ran this file, which is exactly how the `providerAt` removals went unnoticed.
    rows.push(['STALE', m.name, 'pattern not found in ' + m.file])
    continue
  }
  // A pattern that is no longer unique would mutate a different decision than the
  // one it names, and report a pass for a mutation it never applied.
  const hits = source.split(from).length - 1
  if (hits !== 1) {
    rows.push(['STALE', m.name, `pattern matches ${hits} sites in ${m.file}, not 1`])
    continue
  }
  writeFileSync(m.file, source.replace(from, to), 'utf8')
  let caught = null
  try {
    for (const gate of GATES) {
      const run = runGate(gate)
      if (run.failed) { caught = gate; break }
    }
  } finally {
    writeFileSync(m.file, original.get(m.file), 'utf8')
  }
  rows.push([caught === null ? 'MISSED' : 'RED', m.name,
    caught === null ? 'gate passed — regression unprotected' : `caught by ${caught}`])
}

restore()

for (const [verdict, name, note] of rows) {
  const mark = verdict === 'RED' ? 'ok  ' : 'BAD '
  console.log(`  ${mark} ${name} — ${note}`)
}

const missed = rows.filter(([v]) => v !== 'RED')
// A no-op mutation is a HARNESS failure, not a pass: it means this run proved
// nothing about the protection it names. Both verdicts are reported separately so
// "the gate is too weak" and "this mutation no longer applies" cannot be confused
// with each other — the first needs a stronger gate, the second needs this file
// updated to the code it is describing.
const stale = rows.filter(([v]) => v === 'STALE')
const unprotected = rows.filter(([v]) => v === 'MISSED')
if (stale.length > 0) {
  console.log(`\n${stale.length} mutation(s) no longer apply — this file is describing code that moved:`)
  for (const [, name, note] of stale) console.log(`  - ${name}: ${note}`)
}
if (unprotected.length > 0) {
  console.log(`\n${unprotected.length} mutation(s) are NOT protected by any gate:`)
  for (const [, name] of unprotected) console.log(`  - ${name}`)
}
console.log(`\n${rows.length - missed.length}/${rows.length} mutations caught`)

const final = gateSummary(SELFCHECK)
console.log(`after revert: ${final}`)

process.exitCode = missed.length > 0 || final.includes('all good') === false ? 1 : 0
