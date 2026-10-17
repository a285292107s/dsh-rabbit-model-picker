/**
 * Rate-limit wording recovery: make ONE mis-classified failure retryable,
 * without building a second retry scheduler.
 *
 * WHY THIS EXISTS. A relay returned the failure `请求过于频繁，请稍后重试` as a
 * stream error event, so it carried no HTTP status. The shipped classifier in
 * `@deepseek-ai/dsh-llm-pi-ai` reads only the message text and recognizes
 * `\b429\b|rate.?limit` (plus English quota wording), so Chinese throttling text
 * falls through to its `PI_AI_ERROR` catch-all. That code appears in no
 * provider's `retryableCodes`, and `@deepseek-ai/dsh-llm-retry` abandons every
 * failure whose code its policy does not list — so the wait schedule configured
 * on the retry card was never consulted and the turn closed ~3 ms after the
 * failure. 18 such `turn/end` events are recorded across 14 sessions, against 75
 * correctly classified `RATE_LIMIT` failures that retried normally.
 *
 * WHAT THIS DECIDES, AND WHAT IT DELIBERATELY DOES NOT. {@link recoverRateLimitFailure}
 * returns a REPLACEMENT failure whose code is {@link RECOVERED_CODE}, or `null`
 * to leave the failure exactly as it arrived. It never waits, never counts and
 * never appends a session event: the promoted code is handed to the shipped
 * executor, so the wait curve, the retry budget, the per-session counter and the
 * conversation's 「等待重试模型请求」 row all keep coming from the retry card. A
 * timer here would be a second answer to "how long do we wait", which is the one
 * thing this feature must not add.
 *
 * THE RECORDED FAILURE IS NOT REWRITTEN. The replacement is a COPY, so the
 * terminal `turn/end` — which reads the original object — still reports
 * `PI_AI_ERROR`. Promotion authorizes a retry; it does not put words in the
 * provider's mouth.
 *
 * THE CARD KEEPS A REAL SWITCH. Promotion happens only while the provider's
 * resolved policy still lists {@link RECOVERED_CODE}. Clearing `RATE_LIMIT` on
 * the card therefore switches this whole path off, which is what makes the
 * card's 「自动重试」 claim true rather than decorative.
 *
 * THE REST OF THE FAILURE IS CARRIED THROUGH, NOT NORMALIZED — `providerRetryAfterMs`
 * included. So the executor's own rule still applies: a provider-requested delay
 * larger than the policy's `maxDelayMs` makes it give up, exactly as it would for
 * a failure it had classified itself. Promotion changes the CODE the executor
 * judges; it does not overrule the executor's answer. (On the pi-ai routes this
 * module exists for, that field is never set — only the first-party DeepSeek
 * adapter fills it, from a `Retry-After` header — so this is a hedge, not the
 * path. An independent verifier reproduced the interaction end to end.)
 *
 * @module dsh-rabbit-model-picker/host/rateLimitRecovery
 */

/** The code a recovered failure is promoted to, and the card's opt-in switch. */
export const RECOVERED_CODE = 'RATE_LIMIT'

/**
 * A provider failure as the agent loop carries it: the two fields every
 * consumer reads, plus whatever else that provider attached (`status`,
 * `providerRetryAfterMs`, `requestId`, …) which a promotion must preserve.
 */
export interface ProviderFailure {
  readonly message: string
  readonly code: string
  readonly [key: string]: unknown
}

/**
 * Message wordings that mean "you are being throttled", limited to phrases the
 * shipped classifier does NOT already recognize.
 *
 * EVERY ENTRY MUST EARN ITS PLACE. A wording the classifier already matches
 * (`rate limit`, `rate_limit`, `429`, …) can never reach this table: it would
 * have produced {@link RECOVERED_CODE} on its own, and the code is then already
 * retryable, so {@link recoverRateLimitFailure} declines before reading the
 * message. Entries that cannot fire are worse than missing ones — they read as
 * coverage while asserting nothing — so the redundant spellings are left out on
 * purpose. This is also why the table is a reviewed list rather than a set of
 * regexes: a new gateway wording is a one-line addition with a provenance note.
 *
 * Provenance, per entry:
 * - 「请求过于频繁」 — the recorded failure this module was written for (18 events).
 * - 「当前并发已达上限」/「请求数限制」/「requests are too frequent」 — observed on the
 *   same relays but arriving WITH a 429 prefix, so they were classified
 *   correctly; listed so a relay that drops the prefix keeps its retries.
 * - The rest are the same instruction in wordings these gateways commonly use.
 */
export const RATE_LIMIT_WORDING: readonly string[] = Object.freeze([
  // Recorded: no status, mis-classified, never retried.
  '请求过于频繁',
  // Recorded with a 429 prefix; prefix-less variants must not lose retries.
  '当前并发已达上限',
  '并发已达上限',
  '请求数限制',
  'requests are too frequent',
  // Precautionary, same intent.
  '访问过于频繁',
  '操作过于频繁',
  '请求过于密集',
  '速率限制',
  '触发限流',
  // English wording the shipped classifier does NOT match (`too many requests`
  // is absent from its pattern), so a prefix-less body still needs this entry.
  'too many requests',
])

/**
 * An HTTP status that is a definitive non-throttling answer, and therefore
 * outranks any wording in the message.
 *
 * The recorded failure carries no status at all, which is exactly why wording is
 * the only evidence available there. When a status IS present, a 4xx that is not
 * 429 (or 408, the other "try again" 4xx) is the provider answering the request
 * rather than throttling it, so this module must not overrule it.
 * @param status - the failure's numeric status, if any.
 * @returns whether the status blocks promotion.
 */
function statusBlocksPromotion(status: unknown): boolean {
  if (typeof status !== 'number' || !Number.isFinite(status)) return false
  if (status === 429 || status === 408) return false
  if (status >= 500) return false
  return true
}

/**
 * Read a failure's two indispensable fields.
 *
 * The listener runs inside the agent loop's error path, so a malformed payload
 * must read as "not ours" rather than throw: an exception here would replace a
 * provider failure with a plugin failure, which is strictly worse than the bug
 * being fixed.
 * @param value - the dispatched failure.
 * @returns the message and code, or null when either is absent.
 */
function readFailure(value: unknown): ProviderFailure | null {
  if (typeof value !== 'object' || value === null) return null
  const message = (value as { message?: unknown }).message
  const code = (value as { code?: unknown }).code
  if (typeof message !== 'string' || typeof code !== 'string') return null
  return value as ProviderFailure
}

/**
 * Read the resolved policy's opt-in list.
 * @param value - the dispatched policy.
 * @returns the retryable codes, or null when the payload carries no usable policy.
 */
function readRetryableCodes(value: unknown): readonly string[] | null {
  if (typeof value !== 'object' || value === null) return null
  const codes = (value as { retryableCodes?: unknown }).retryableCodes
  if (!Array.isArray(codes)) return null
  return codes.filter((code): code is string => typeof code === 'string')
}

/**
 * Whether one message states a throttling condition.
 * @param message - the provider's failure message.
 * @returns whether any {@link RATE_LIMIT_WORDING} entry occurs in it.
 */
export function statesRateLimit(message: string): boolean {
  const text = message.toLowerCase()
  return RATE_LIMIT_WORDING.some((wording) => text.includes(wording.toLowerCase()))
}

/**
 * Decide whether one failed model request should be handed back to the retry
 * executor as a rate limit.
 *
 * Declining is the answer in every case this module does not own, in this order
 * of authority:
 * 1. no resolved policy — `dsh-llm-retry` itself does nothing without one, so a
 *    promotion would change nothing and only muddy the recorded payload;
 * 2. the card does not list {@link RECOVERED_CODE} — the operator switched this
 *    path off;
 * 3. the failure's own code is already retryable — the shipped executor owns it
 *    and its budget must not be double-spent;
 * 4. a status that is a definitive non-throttling answer;
 * 5. the message does not state a throttling condition.
 * @param failure - the dispatched failure object (never mutated).
 * @param policy - the resolved retry policy for the request's provider.
 * @returns a promoted copy of the failure, or null to leave it untouched.
 */
export function recoverRateLimitFailure(
  failure: unknown,
  policy: unknown,
): ProviderFailure | null {
  const read = readFailure(failure)
  if (read === null) return null

  const codes = readRetryableCodes(policy)
  if (codes === null || !codes.includes(RECOVERED_CODE)) return null
  if (codes.includes(read.code)) return null

  if (statusBlocksPromotion(read.status)) return null
  if (!statesRateLimit(read.message)) return null

  // A copy, so the loop's own `finish.failure` keeps the provider's original
  // code and whatever it leads to is recorded truthfully.
  return { ...read, code: RECOVERED_CODE }
}
