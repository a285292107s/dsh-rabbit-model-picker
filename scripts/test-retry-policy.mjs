/**
 * Unit gates for the provider retry policy — the two numbers a provider card
 * edits, and the curve those numbers actually produce.
 *
 * WHY THE CURVE NEEDS A GATE. The second control is a CAP, not an interval, and
 * the difference only shows up as arithmetic: `initialDelayMs * 2**n` clamped to
 * `maxDelayMs`. A card that drew the wrong schedule would be worse than no card,
 * because it would state a wait the executor does not take. So the assertions
 * below pin the schedule at its boundaries (a budget of zero, one wait, a cap
 * that binds immediately, a cap that never binds) and pin the one property the
 * whole feature rests on: the series is non-decreasing and clamped.
 *
 * Because the formula is copied from `@deepseek-ai/dsh-llm-retry`, the final
 * block re-derives it independently from the executor's own source and compares
 * the two, so a drift between this model and the code that spends the budget
 * fails here rather than on the user's next outage.
 *
 * Run: node scripts/test-retry-policy.mjs
 *
 * @module dsh-rabbit-model-picker/test-retry-policy
 */

import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0

/**
 * Record one assertion.
 * @param label - what is being asserted.
 * @param ok - whether it held.
 * @param detail - evidence printed on failure.
 */
function check(label, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) failures += 1
}

/** Compare two values structurally, printing the first difference. */
function equal(label, actual, expected) {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  check(label, left === right, { actual, expected })
}

const work = mkdtempSync(join(tmpdir(), 'dmp-retry-'))
const outfile = join(work, 'retry.mjs')

try {
  await build({
    stdin: {
      contents: "export * from './src/client/retryPolicy.ts'",
      resolveDir: root,
      sourcefile: 'retry-entry.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
  })

  const {
    resolveRetryPolicy, retryWaitCurve, totalWaitMs, waitRange,
    parseRetries, parseMaxDelaySeconds, formatMaxDelaySeconds, formatDuration,
    retryPolicyDocument,
    MIN_RETRIES, MAX_RETRIES, MIN_MAX_DELAY_MS, MAX_MAX_DELAY_MS,
    DEFAULT_MAX_RETRIES, DEFAULT_MAX_DELAY_MS, DEFAULT_INITIAL_DELAY_MS,
  } = await import(pathToFileURL(outfile).href)

  // --- reading a provider's policy ------------------------------------------
  equal('policy: an undeclared provider reads the shipped defaults',
    (() => {
      const view = resolveRetryPolicy({ providers: { naizi: {} } }, ['providers', 'naizi'])
      return [view.maxRetries, view.maxDelayMs, view.initialDelayMs, view.mode, view.declared]
    })(),
    [DEFAULT_MAX_RETRIES, DEFAULT_MAX_DELAY_MS, DEFAULT_INITIAL_DELAY_MS, 'normal', false])

  equal('policy: the naizi shape reads back exactly',
    (() => {
      const view = resolveRetryPolicy({
        providers: {
          naizi: {
            apiKeyEnv: 'NAIZI_API_KEY',
            retryPolicy: {
              mode: 'normal',
              maxRetries: 10,
              backoff: { initialDelayMs: 500, maxDelayMs: 60000, jitterRatio: 0.1 },
            },
          },
        },
      }, ['providers', 'naizi'])
      return [view.maxRetries, view.maxDelayMs, view.initialDelayMs, view.declared]
    })(),
    [10, 60_000, 500, false])

  check('policy: a provider layer stating a policy is reported as declared',
    resolveRetryPolicy(
      { providers: { naizi: { retryPolicy: { mode: 'normal', maxRetries: 10 } } } },
      ['providers', 'naizi'],
      { providers: { naizi: { retryPolicy: { mode: 'normal', maxRetries: 10 } } } },
    ).declared === true,
    {})

  check('policy: an unrelated provider does not make this one declared',
    resolveRetryPolicy(
      { providers: { naizi: {}, magpie: { retryPolicy: { mode: 'normal' } } } },
      ['providers', 'naizi'],
      { providers: { magpie: { retryPolicy: { mode: 'normal' } } } },
    ).declared === false,
    {})

  equal('policy: an always-mode provider is read as always',
    resolveRetryPolicy(
      { providers: { x: { retryPolicy: { mode: 'always' } } } }, ['providers', 'x'],
    ).mode,
    'always')

  equal('policy: a nonsense mode falls back to normal (what the executor does)',
    resolveRetryPolicy(
      { providers: { x: { retryPolicy: { mode: 'sideways' } } } }, ['providers', 'x'],
    ).mode,
    'normal')

  check('policy: a malformed value subtree does not throw',
    (() => {
      for (const value of [null, 'text', 42, [], { providers: 'no' }]) {
        resolveRetryPolicy(value, ['providers', 'naizi'])
      }
      return true
    })(),
    {})

  // --- the wait curve -------------------------------------------------------
  const backoff = { initialDelayMs: 500, maxDelayMs: 60_000, jitterRatio: 0.1 }

  equal('curve: 10 retries at 60s cap doubles then holds',
    retryWaitCurve(backoff, 10),
    [500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000])

  equal('curve: a budget of zero draws no waits', retryWaitCurve(backoff, 0), [])
  equal('curve: one retry is the first wait alone', retryWaitCurve(backoff, 1), [500])
  equal('curve: a cap at the first wait binds immediately',
    retryWaitCurve({ ...backoff, maxDelayMs: 500 }, 4), [500, 500, 500, 500])
  equal('curve: a cap below the first wait still clamps',
    retryWaitCurve({ ...backoff, initialDelayMs: 900, maxDelayMs: 500 }, 3), [500, 500, 500])
  equal('curve: the shipped default budget is 5 waits',
    retryWaitCurve({ initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 }, 5),
    [500, 1_000, 2_000, 4_000, 8_000])

  check('curve: the series never decreases and never exceeds the cap',
    (() => {
      for (const budget of [0, 1, 5, 10, 60]) {
        const waits = retryWaitCurve(backoff, budget)
        if (waits.length !== budget) return false
        for (let i = 0; i < waits.length; i += 1) {
          if (waits[i] > backoff.maxDelayMs) return false
          if (i > 0 && waits[i] < waits[i - 1]) return false
        }
      }
      return true
    })(),
    {})

  check('curve: a huge budget stays finite (no Infinity before the clamp)',
    (() => {
      const waits = retryWaitCurve({ ...backoff, maxDelayMs: 60_000 }, MAX_RETRIES)
      return waits.every(wait => Number.isFinite(wait) && wait <= 60_000)
    })(),
    {})

  equal('curve: the 10x60s budget totals 243.5s nominally',
    totalWaitMs(retryWaitCurve(backoff, 10)),
    243_500)

  equal('curve: jitter widens the total symmetrically',
    (() => {
      const range = waitRange(retryWaitCurve(backoff, 10), 0.1)
      return [Math.round(range.low), Math.round(range.high)]
    })(),
    [219_150, 267_850])

  equal('curve: no jitter collapses the range to the nominal total',
    (() => {
      const waits = retryWaitCurve(backoff, 10)
      const range = waitRange(waits, 0)
      return [range.low, range.high, totalWaitMs(waits)]
    })(),
    [243_500, 243_500, 243_500])

  // --- typing ---------------------------------------------------------------
  equal('retries: 0 is accepted (it means "do not retry")', parseRetries('0'), 0)
  equal('retries: the cap is accepted', parseRetries('60'), MAX_RETRIES)
  equal('retries: one past the cap is refused', parseRetries('61'), null)
  equal('retries: a negative is refused', parseRetries('-1'), null)
  equal('retries: a fraction is refused', parseRetries('2.5'), null)
  equal('retries: text is refused', parseRetries('ten'), null)
  equal('retries: an empty field is refused', parseRetries('  '), null)
  check('retries: the floor is what it says', MIN_RETRIES === 0, { MIN_RETRIES })

  equal('cap: 60 seconds is accepted', parseMaxDelaySeconds('60'), 60_000)
  equal('cap: 0.5 seconds is accepted', parseMaxDelaySeconds('0.5'), MIN_MAX_DELAY_MS)
  equal('cap: 61 seconds is refused', parseMaxDelaySeconds('61'), null)
  equal('cap: below the floor is refused', parseMaxDelaySeconds('0.1'), null)
  equal('cap: text is refused', parseMaxDelaySeconds('a minute'), null)
  check('cap: the ceiling is one minute', MAX_MAX_DELAY_MS === 60_000, { MAX_MAX_DELAY_MS })

  equal('cap: 60000ms renders as 60', formatMaxDelaySeconds(60_000), '60')
  equal('cap: 500ms renders as 0.5', formatMaxDelaySeconds(500), '0.5')
  equal('cap: 1500ms renders as 1.5', formatMaxDelaySeconds(1_500), '1.5')

  equal('duration: sub-second stays in ms', formatDuration(500), '500ms')
  equal('duration: whole seconds', formatDuration(2_000), '2s')
  equal('duration: minutes and seconds', formatDuration(90_000), '1m30s')
  equal('duration: a whole minute', formatDuration(60_000), '1m')
  equal('duration: rounding into the next minute carries', formatDuration(119_600), '2m')
  equal('duration: zero is zero', formatDuration(0), '0s')

  // --- the document written back --------------------------------------------
  {
    const view = resolveRetryPolicy({
      providers: {
        naizi: {
          retryPolicy: {
            mode: 'normal',
            maxRetries: 5,
            retryableCodes: ['SERVER', 'TIMEOUT'],
            backoff: { initialDelayMs: 750, maxDelayMs: 10_000, jitterRatio: 0.25 },
          },
        },
      },
    }, ['providers', 'naizi'])
    const doc = retryPolicyDocument(view, 10, 60_000)
    equal('document: the two edited numbers are the typed ones',
      [doc.maxRetries, doc.backoff.maxDelayMs], [10, 60_000])
    equal('document: the untouched fields survive the write',
      [doc.backoff.initialDelayMs, doc.backoff.jitterRatio, doc.retryableCodes],
      [750, 0.25, ['SERVER', 'TIMEOUT']])
    equal('document: mode is carried through', doc.mode, 'normal')
  }

  {
    // A cap that would fall below the first wait must not produce the
    // initialDelayMs > maxDelayMs pair the resolver rejects outright.
    const view = resolveRetryPolicy({ providers: { x: {} } }, ['providers', 'x'])
    const doc = retryPolicyDocument(view, 3, 500)
    check('document: the first wait is pulled down to a tight cap',
      doc.backoff.initialDelayMs <= doc.backoff.maxDelayMs,
      { initial: doc.backoff.initialDelayMs, cap: doc.backoff.maxDelayMs })
  }

  {
    // No stored codes: the key is omitted, not written as null (the schema
    // rejects an explicit null and would refuse the whole edit).
    const view = resolveRetryPolicy({ providers: { x: {} } }, ['providers', 'x'])
    const doc = retryPolicyDocument(view, 5, 10_000)
    check('document: absent retryableCodes stays absent',
      !Object.hasOwn(doc, 'retryableCodes'), { doc })
  }

  // --- agreement with the executor -------------------------------------------
  // The formula above is copied from dsh-llm-retry. Re-derive it from that
  // package's own shipped source and compare, so a drift between this model and
  // the code that actually spends the budget fails HERE.
  //
  // The plugin itself does not depend on DSH (it is an external Client plugin),
  // so the executor is located by probe rather than by a declared dependency.
  // Candidates are tried in order and the FIRST that reads wins; when none does,
  // the check is reported as skipped rather than passed, because a silently
  // absent cross-check is how this assertion would rot.
  {
    const candidates = [
      // The active profile may link the harness; the global npm prefix is where
      // `dsh` itself is installed on this machine.
      join(root, 'node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-retry/lib/index.js'),
      ...(process.env.APPDATA === undefined
        ? []
        : [join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-retry/lib/index.js')]),
      ...(process.env.DSH_PROFILE_DIR === undefined
        ? []
        : [join(process.env.DSH_PROFILE_DIR, 'node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-retry/lib/index.js')]),
    ]

    let source = null
    let foundAt = null
    for (const candidate of candidates) {
      try {
        source = readFileSync(candidate, 'utf8')
        foundAt = candidate
        break
      } catch {
        // try the next candidate
      }
    }

    if (source === null) {
      check('executor: the dsh-llm-retry source was located for the cross-check', false, { candidates })
    } else {
      const body = /function localDelay\(config, retry, random\) \{([\s\S]*?)\n\}/.exec(source)
      check('executor: localDelay is still found where this model expects it', body !== null, { foundAt })
      if (body !== null) {
        // Re-run the executor's own body, without its random term (a constant
        // 0.5 makes jitter neutral), and compare against this model's schedule.
        const localDelay = new Function('config', 'retry', 'random', body[1])
        const config = { initialDelayMs: 500, maxDelayMs: 60_000, jitterRatio: 0.1 }
        const theirs = []
        for (let retry = 1; retry <= 12; retry += 1) {
          theirs.push(localDelay(config, retry, () => 0.5))
        }
        equal(
          'executor: this model reproduces the executor schedule exactly',
          retryWaitCurve(backoff, 12),
          theirs,
        )
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(failures === 0 ? 'retry policy unit: all good' : `retry policy unit: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
