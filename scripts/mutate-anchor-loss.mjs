/**
 * 改坏验证 for §5.18. Each mutation breaks one decision the fix rests on; the
 * static gate has to notice every one of them, and the source has to come back
 * byte-identical afterwards.
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
const UNIT = 'scripts/test-params.mjs'
const LOSS = 'src/client/anchorLoss.ts'
const PICKER = 'src/client/Picker.tsx'

/**
 * Both gates, because the two halves of this rule are checked in different places
 * and a mutation only has to be caught by one of them. The static gate reads the
 * WIRING (is the root the observed node, are both popovers dismissed together),
 * and the unit gate DRIVES the decision (does a one-look dip dismiss the panel).
 * Running only the static gate is what let six logic mutations through unnoticed:
 * a regex can see that `setTimeout(confirm` is written, it cannot see whether the
 * second look actually happens, which is the entire rule.
 */
const GATES = [SELFCHECK, UNIT]

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
      const run = spawnSync(process.execPath, [gate], { encoding: 'utf8' })
      if ((run.stdout + run.stderr).includes('FAIL')) { caught = gate; break }
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

const final = (() => {
  const proc = spawnSync(process.execPath, [SELFCHECK], { encoding: 'utf8' })
  return (proc.stdout + proc.stderr).trim().split(/\r?\n/).pop()
})()
console.log(`after revert: ${final}`)

process.exitCode = missed.length > 0 || final.includes('all good') === false ? 1 : 0
