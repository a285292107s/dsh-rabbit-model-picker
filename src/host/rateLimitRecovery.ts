/**
 * Make ONE mis-classified failure retryable, without adding a second retry scheduler.
 *
 * A relay returned `请求过于频繁，请稍后重试` as a stream error event, so it carried no
 * HTTP status. The shipped classifier reads only the message text and recognises
 * `\b429\b|rate.?limit` (plus English quota wording), so Chinese throttling text fell
 * through to `PI_AI_ERROR`; no provider lists that code as retryable, so the wait
 * schedule configured on the retry card was never consulted and the turn closed ~3ms
 * later (18 recorded events, against 75 correctly classified `RATE_LIMIT` failures).
 *
 * The promoted code is handed to the SHIPPED executor: the wait curve, the retry
 * budget, the retry counter (the executor's own, reset every step) and the
 * 「等待重试模型请求」 row all keep coming from the retry card. This module never waits
 * and never counts — a timer here would be a second answer to "how long do we wait".
 */

/** The code a recovered failure is promoted to, and the card's opt-in switch. */
export const RECOVERED_CODE = 'RATE_LIMIT'

export interface ProviderFailure {
  readonly message: string
  readonly code: string
  readonly [key: string]: unknown
}

/**
 * Wordings the shipped classifier does NOT already match. A redundant spelling could
 * never reach this table (the code would already be retryable), and an entry that
 * cannot fire reads as coverage while asserting nothing.
 *
 * Provenance: 「请求过于频繁」 is the recorded failure; 「当前并发已达上限」/
 * 「请求数限制」/`requests are too frequent` arrived WITH a 429 prefix, so they are
 * listed only so a relay that drops the prefix keeps its retries; the rest are
 * precautionary spellings, added before any relay was seen using them.
 */
export const RATE_LIMIT_WORDING: readonly string[] = Object.freeze([
  '请求过于频繁',
  '当前并发已达上限',
  '并发已达上限',
  '请求数限制',
  'requests are too frequent',
  '访问过于频繁',
  '操作过于频繁',
  '请求过于密集',
  '速率限制',
  '触发限流',
  'too many requests',
])

/** A present 4xx that is not 429/408 is the provider answering, not throttling: wording
 * must not overrule it. The recorded failure carries no status, which is why wording is
 * the only evidence available there. */
function statusBlocksPromotion(status: unknown): boolean {
  if (typeof status !== 'number' || !Number.isFinite(status)) return false
  if (status === 429 || status === 408) return false
  if (status >= 500) return false
  return true
}

/** Runs inside the agent loop's error path: a malformed payload must read as "not ours"
 * rather than throw, since an exception here would replace a provider failure with a
 * plugin failure. */
function readFailure(value: unknown): ProviderFailure | null {
  if (typeof value !== 'object' || value === null) return null
  const message = (value as { message?: unknown }).message
  const code = (value as { code?: unknown }).code
  if (typeof message !== 'string' || typeof code !== 'string') return null
  return value as ProviderFailure
}

function readRetryableCodes(value: unknown): readonly string[] | null {
  if (typeof value !== 'object' || value === null) return null
  const codes = (value as { retryableCodes?: unknown }).retryableCodes
  if (!Array.isArray(codes)) return null
  return codes.filter((code): code is string => typeof code === 'string')
}

export function statesRateLimit(message: string): boolean {
  const text = message.toLowerCase()
  return RATE_LIMIT_WORDING.some((wording) => text.includes(wording.toLowerCase()))
}

/**
 * The five conditions, in this order of authority: no resolved policy (the shipped
 * executor does nothing without one); the card does not list {@link RECOVERED_CODE}
 * (the operator switched this path off); the failure's own code is already retryable
 * (the shipped executor owns it and its budget must not be double-spent); a status
 * that is a definitive non-throttling answer; the message does not state a throttling
 * condition.
 *
 * The replacement is a COPY, so the terminal `turn/end` reading the original object
 * still reports `PI_AI_ERROR`: promotion authorises a retry, it does not put words in
 * the provider's mouth.
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

  return { ...read, code: RECOVERED_CODE }
}
