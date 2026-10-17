/**
 * Unit gates for rate-limit wording recovery — the decision that hands one
 * mis-classified provider failure back to the shipped retry executor.
 *
 * WHY THIS NEEDS A GATE. The rule is four conditions ANDed, and every one of
 * them is a decision that could be dropped without breaking the happy path:
 * without the card's opt-in the feature cannot be switched off, without the
 * "already retryable" test the executor's budget is double-spent, without the
 * copy the recorded failure is rewritten, and without the wording test every
 * terminal failure becomes a retry candidate. The assertions below pin each
 * condition on its own, in both directions, so a weakened rule shows up as a red
 * gate rather than as a provider quietly retrying something it should not.
 *
 * THE TABLE IS PART OF THE RULE, SO IT IS ASSERTED TOO. Every entry must be able
 * to fire (an entry the shipped classifier already matches is dead coverage),
 * and every recorded real-world message must still be recognized. That is the
 * half that would otherwise rot as gateways reword their errors.
 *
 * THE WIRING IS COVERED TOO, UP TO THE HOST'S EDGE. `src/index.ts` is bundled
 * here and driven with a stand-in context, which pins what this repo owns: one
 * listener on `agent/request-error`, registered `prepend: true`, replacing the
 * failure only when the rule says so, and ALWAYS delegating through `next()`.
 * What stays uncovered is the host's half of that bargain — that a prepended
 * listener really does run before `@deepseek-ai/dsh-llm-retry`, and that the
 * replaced `payload.failure` reaches it — because neither is observable without
 * the host installed. Those two are checked against the host's own dispatcher
 * source instead (`@deepseek-ai/cordis`: `waterfall` takes `cbs.shift()`, so the
 * first-registered listener runs outermost; `dispatch` hands every listener the
 * same `fused(payload)`, a shallow unfrozen copy), not by this gate.
 *
 * Run: node scripts/test-rate-limit-recovery.mjs
 *
 * @module dsh-rabbit-model-picker/test-rate-limit-recovery
 */

import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
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

const work = mkdtempSync(join(tmpdir(), 'dmp-recovery-'))
const outfile = join(work, 'recovery.mjs')

try {
  await build({
    stdin: {
      contents: "export * from './src/host/rateLimitRecovery.ts'",
      resolveDir: root,
      sourcefile: 'recovery-entry.ts',
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
    RECOVERED_CODE, RATE_LIMIT_WORDING, statesRateLimit, recoverRateLimitFailure,
  } = await import(pathToFileURL(outfile).href)

  /**
   * The policy shape the host resolves for a provider that declares none, and
   * the one every provider in the recorded corpus resolved to. The card's opt-in
   * is the presence of {@link RECOVERED_CODE} in this list.
   */
  const POLICY = Object.freeze({
    mode: 'normal',
    maxRetries: 20,
    retryableCodes: Object.freeze(['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT']),
    backoff: Object.freeze({ initialDelayMs: 500, maxDelayMs: 60_000, jitterRatio: 0.1 }),
  })

  // --- the failure this module was written for -------------------------------
  {
    // Verbatim from the recorded sessions (14 sessions, 18 turn/end events):
    // a relay answered inside the stream, so the failure carried no HTTP status
    // and the shipped classifier fell through to its catch-all.
    const recorded = { message: '请求过于频繁，请稍后重试', code: 'PI_AI_ERROR' }
    const recovered = recoverRateLimitFailure(recorded, POLICY)

    check('recorded: the observed failure is promoted', recovered !== null, { recovered })
    equal('recorded: promoted to the retryable code', recovered?.code, RECOVERED_CODE)
    equal('recorded: the provider wording is preserved', recovered?.message, '请求过于频繁，请稍后重试')
    equal('recorded: the input object is NOT rewritten', recorded.code, 'PI_AI_ERROR')
    check('recorded: a copy is returned, not the same object', recovered !== recorded && recovered !== null, {
      sameReference: recovered === recorded,
    })
  }

  {
    // The executor reads more than code/message on some routes, so a promotion
    // must not be a lossy rebuild.
    const withExtras = {
      message: '请求过于频繁，请稍后重试',
      code: 'PI_AI_ERROR',
      requestId: 'req-1',
      providerRetryAfterMs: 4_000,
    }
    const recovered = recoverRateLimitFailure(withExtras, POLICY)
    equal('copy: unrelated failure fields survive',
      [recovered?.requestId, recovered?.providerRetryAfterMs], ['req-1', 4_000])
  }

  // --- condition 1: the card's opt-in ---------------------------------------
  {
    const failure = { message: '请求过于频繁，请稍后重试', code: 'PI_AI_ERROR' }
    check('opt-in: a policy without RATE_LIMIT declines',
      recoverRateLimitFailure(failure, {
        mode: 'normal',
        maxRetries: 5,
        retryableCodes: ['SERVER', 'TIMEOUT'],
        backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 },
      }) === null)
    check('opt-in: an empty code list declines', recoverRateLimitFailure(failure, {
      mode: 'normal', maxRetries: 5, retryableCodes: [], backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 },
    }) === null)
  }

  // --- condition 2: no policy means the executor does nothing anyway ---------
  {
    const failure = { message: '请求过于频繁，请稍后重试', code: 'PI_AI_ERROR' }
    check('policy: undefined declines', recoverRateLimitFailure(failure, undefined) === null)
    check('policy: null declines', recoverRateLimitFailure(failure, null) === null)
    check('policy: a missing code list declines', recoverRateLimitFailure(failure, { mode: 'normal' }) === null)
    check('policy: a non-array code list declines', recoverRateLimitFailure(failure, { retryableCodes: 'RATE_LIMIT' }) === null)
  }

  // --- condition 3: the executor's own budget is never double-spent ----------
  {
    check('ownership: a code the policy already retries is left alone',
      recoverRateLimitFailure({ message: '请求过于频繁，请稍后重试', code: 'RATE_LIMIT' }, POLICY) === null)
    check('ownership: an unrelated retryable code is left alone',
      recoverRateLimitFailure({ message: '请求过于频繁，请稍后重试', code: 'SERVER' }, POLICY) === null)
    check('ownership: a retryable code with ordinary wording is left alone',
      recoverRateLimitFailure({ message: '服务暂时不可用，请稍后重试', code: 'SERVER' }, POLICY) === null)
  }

  // --- condition 4: a definitive status outranks wording ---------------------
  {
    const base = { message: '请求过于频繁，请稍后重试', code: 'PI_AI_ERROR' }
    check('status: 400 blocks promotion', recoverRateLimitFailure({ ...base, status: 400 }, POLICY) === null)
    check('status: 404 blocks promotion', recoverRateLimitFailure({ ...base, status: 404 }, POLICY) === null)
    check('status: 429 does not block', recoverRateLimitFailure({ ...base, status: 429 }, POLICY) !== null)
    check('status: 408 does not block', recoverRateLimitFailure({ ...base, status: 408 }, POLICY) !== null)
    check('status: 503 does not block', recoverRateLimitFailure({ ...base, status: 503 }, POLICY) !== null)
    check('status: a non-numeric status does not block', recoverRateLimitFailure({ ...base, status: 'n/a' }, POLICY) !== null)
  }

  // --- condition 5: the wording, in both directions --------------------------
  {
    check('wording: an unrelated message stays terminal',
      recoverRateLimitFailure({ message: 'pi-ai deferred response for model "x" is not supported', code: 'PI_AI_ERROR' }, POLICY) === null)
    check('wording: an empty message stays terminal',
      recoverRateLimitFailure({ message: '', code: 'PI_AI_ERROR' }, POLICY) === null)
    check('wording: an account balance message stays terminal',
      recoverRateLimitFailure({ message: '账号余额不足，请充值', code: 'PI_AI_ERROR' }, POLICY) === null)
    check('wording: a context overflow message stays terminal',
      recoverRateLimitFailure({ message: 'prompt is too long for this model', code: 'PI_AI_ERROR' }, POLICY) === null)
    check('wording: English matching is case-insensitive',
      recoverRateLimitFailure({ message: 'Too Many Requests, slow down', code: 'PI_AI_ERROR' }, POLICY) !== null)
    check('wording: wording is the evidence when the code is not retryable',
      recoverRateLimitFailure({ message: '请求过于频繁，请稍后重试', code: 'MALFORMED_RESPONSE' }, POLICY) !== null)
  }

  // --- malformed payloads must never throw ----------------------------------
  {
    for (const [label, value] of [
      ['null', null],
      ['a string', '请求过于频繁'],
      ['a number', 7],
      ['no code', { message: '请求过于频繁，请稍后重试' }],
      ['no message', { code: 'PI_AI_ERROR' }],
      ['a numeric message', { message: 42, code: 'PI_AI_ERROR' }],
      ['a numeric code', { message: '请求过于频繁，请稍后重试', code: 429 }],
    ]) {
      let threw = null
      let result
      try {
        result = recoverRateLimitFailure(value, POLICY)
      } catch (error) {
        threw = error
      }
      check(`malformed: ${label} declines without throwing`, threw === null && result === null, {
        threw: threw === null ? null : String(threw),
        result,
      })
    }
  }

  // --- the table itself -----------------------------------------------------
  {
    // An entry the shipped classifier already matches can never fire: the code
    // would have been RECOVERED_CODE on its own, and condition 3 declines before
    // the message is read. Such an entry reads as coverage while asserting
    // nothing, so the table is required to stay free of them.
    const SHIPPED_PATTERNS = [
      /\b429\b/i,
      /rate.?limit/i,
      /\binsufficient[\s_-]+(?:quota|balance|credits?)\b/i,
      /\b(?:quota|usage[\s_-]+limit)[\s_-]+(?:exceeded|exhausted|reached)\b/i,
      /\bexceed(?:ed|s)?[\s_-]+(?:(?:your|the)[\s_-]+)?(?:current[\s_-]+)?quota\b/i,
      /\b(?:balance|credits?)[\s_-]+(?:exhausted|depleted)\b/i,
      /\bout[\s_-]+of[\s_-]+(?:credits?|budget)\b/i,
    ]
    const dead = RATE_LIMIT_WORDING.filter((wording) => SHIPPED_PATTERNS.some((pattern) => pattern.test(wording)))
    check('table: no entry is one the shipped classifier already matches', dead.length === 0, { dead })

    check('table: every entry is non-empty and free of surrounding space',
      RATE_LIMIT_WORDING.every((wording) => wording.length > 0 && wording === wording.trim()),
      { RATE_LIMIT_WORDING })
    check('table: entries are unique',
      new Set(RATE_LIMIT_WORDING).size === RATE_LIMIT_WORDING.length, { RATE_LIMIT_WORDING })

    // Dead coverage the other way round: an entry that cannot promote anything
    // is a line that lies about what is covered.
    const inert = RATE_LIMIT_WORDING.filter((wording) => recoverRateLimitFailure(
      { message: `网关返回：${wording}，请稍后再试`, code: 'PI_AI_ERROR' }, POLICY,
    ) === null)
    check('table: every entry can actually promote a failure', inert.length === 0, { inert })

    check('table: the recorded wording is still in the table',
      RATE_LIMIT_WORDING.includes('请求过于频繁'), { RATE_LIMIT_WORDING })
    check('table: the wording test is exposed for the wiring and honors case',
      statesRateLimit('TOO MANY REQUESTS') && !statesRateLimit('all good'), {})
  }

  // --- the wiring: src/index.ts, driven through a stand-in context -----------
  // The rule above is worth nothing if the listener never reaches the loop, is
  // registered behind the executor, or decides on its own. All three are
  // asserted here on the real entry point, not on a copy of it.
  {
    const wiringOut = join(work, 'wiring.mjs')
    await build({
      stdin: {
        contents: "export * from './src/index.ts'",
        resolveDir: root,
        sourcefile: 'wiring-entry.ts',
        loader: 'ts',
      },
      outfile: wiringOut,
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      target: 'es2022',
      logLevel: 'silent',
    })
    const { apply } = await import(pathToFileURL(wiringOut).href)

    const registered = []
    apply({
      on: (event, listener, options) => {
        registered.push({ event, listener, options })
      },
    })

    equal('wiring: exactly one listener is registered', registered.length, 1)
    equal('wiring: on the loop\'s failed-request extension point', registered[0]?.event, 'agent/request-error')
    equal('wiring: registered ahead of the shipped executor', registered[0]?.options, { prepend: true })

    const listener = registered[0]?.listener

    // The recorded failure, end to end through the wiring.
    let nextCalls = 0
    const payload = {
      failure: { message: '请求过于频繁，请稍后重试', code: 'PI_AI_ERROR' },
      retryPolicy: POLICY,
    }
    const returned = await listener(payload, () => { nextCalls += 1; return 'delegated' })
    equal('wiring: the dispatched failure is promoted', payload.failure.code, RECOVERED_CODE)
    equal('wiring: the executor is always given its turn', [nextCalls, returned], [1, 'delegated'])

    // A failure this module does not own must reach the executor UNTOUCHED — the
    // same object, not a copy — so nothing about it can drift on the way.
    const untouched = { message: 'pi-ai deferred response', code: 'PI_AI_ERROR' }
    const foreign = { failure: untouched, retryPolicy: POLICY }
    nextCalls = 0
    await listener(foreign, () => { nextCalls += 1 })
    check('wiring: a failure this module does not own is passed through by reference',
      foreign.failure === untouched && nextCalls === 1,
      { sameReference: foreign.failure === untouched, nextCalls })
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(failures === 0 ? 'rate limit recovery unit: all good' : `rate limit recovery unit: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
