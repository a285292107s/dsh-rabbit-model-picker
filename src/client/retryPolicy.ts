/**
 * Provider retry policy: the two numbers the 模型配置 page's retry editor sets,
 * and the wait curve those numbers actually produce.
 *
 * WHOSE MODEL THIS IS. The editor that spends it is `RetryEditor.tsx`, rendered
 * inside one provider's row in this plugin's own 模型配置 tab (it used to be a
 * card in the shipped Models section). Nothing here knows about either surface:
 * this module is the arithmetic, and the editor, its gate (`test-retry-policy.mjs`)
 * and the written document all read these functions rather than re-deriving them.
 *
 * WHY THE CURVE IS PART OF THE MODEL, NOT OF THE VIEW. The Host exposes the
 * retry budget as `maxRetries` plus a bounded exponential backoff, so the
 * second control is a CAP and not an interval: `initialDelayMs * 2**n`, clamped
 * to `maxDelayMs`. A user who sets "10 retries, 60s cap" and expects ten
 * one-minute waits is reading the control the only way its label invites, and
 * would be wrong in a way no amount of help text fixes as well as stating the
 * real numbers does. {@link retryWaitCurve} is therefore the single place the
 * schedule is derived, and both the summary the editor prints and its tests
 * render from it. (The editor used to draw one bar per retry; the chart is gone,
 * the derivation it depended on is not.)
 *
 * The formula mirrors `@deepseek-ai/dsh-llm-retry`'s `localDelay` exactly
 * (`lib/index.js`, the executor that spends the budget), minus its jitter: the
 * ±`jitterRatio` term is random per attempt and is reported as a range instead
 * of being baked into a number that would look precise and be false.
 *
 * @module dsh-rabbit-model-picker/client/retryPolicy
 */

import type { RetryBackoff, RetryPolicyValue, RetryPolicyView } from './contract.ts'

/** Smallest accepted retry count: zero means "do not retry", which is real. */
export const MIN_RETRIES = 0

/** Largest accepted retry count (the field's own cap, per the product ask). */
export const MAX_RETRIES = 60

/** Smallest accepted cap on one wait, in milliseconds. */
export const MIN_MAX_DELAY_MS = 500

/** Largest accepted cap on one wait, in milliseconds (the field's own cap). */
export const MAX_MAX_DELAY_MS = 60_000

/** The first wait this panel assumes while a provider declares no backoff. */
export const DEFAULT_INITIAL_DELAY_MS = 500

/** The cap this panel assumes while a provider declares no backoff. */
export const DEFAULT_MAX_DELAY_MS = 10_000

/** The jitter ratio the executor defaults to, used for the reported range. */
export const DEFAULT_JITTER_RATIO = 0.1

/** The retry budget the shipped policy applies while a provider declares none. */
export const DEFAULT_MAX_RETRIES = 5

/**
 * Whether a value is a plain record (not an array, not null).
 * @param value - the value to test.
 * @returns whether it can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read a non-negative integer, or undefined.
 * @param value - the stored value.
 * @returns the value when it is a non-negative integer.
 */
function nonNegativeInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

/**
 * Read a positive number, or undefined.
 * @param value - the stored value.
 * @returns the value when it is a finite number greater than zero.
 */
function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * Read a plain-record node at one settings path.
 *
 * The settings document is addressed by path, and a missing or mistyped step is
 * an ordinary state (a provider that declares nothing, a namespace still
 * loading), never an error: every caller wants `undefined` there, not a throw.
 * @param value - the document or subtree to walk.
 * @param path - the keys to walk.
 * @returns the record at the path, or undefined when any step is not a record.
 */
function nodeAtPath(value: unknown, path: readonly string[]): Record<string, unknown> | undefined {
  let node: unknown = value
  for (const key of path) {
    if (!isRecord(node)) return undefined
    node = node[key]
  }
  return isRecord(node) ? node : undefined
}

/**
 * Read one provider's retry configuration out of a settings namespace value.
 *
 * Reads the EFFECTIVE value (every layer merged, schema defaults applied), which
 * is what the card must show: the user is editing the number the executor will
 * actually spend, not the fragment their own layer happens to carry. The
 * USER layer is read separately ({@link resolveRetryPolicy}.declared) so the
 * card can tell "this provider states 10" apart from "this provider inherits 5".
 * @param value - the namespace's effective value.
 * @param scope - the provider's settings path inside that namespace.
 * @param user - the namespace's user layer, when the Host reports one.
 * @returns the two edited numbers plus what the provider itself declares.
 */
export function resolveRetryPolicy(
  value: unknown, scope: readonly string[], user?: unknown,
): RetryPolicyView {
  // Walk the provider's settings path first: the policy lives at
  // `providers.<provider>.retryPolicy`, not at the namespace root.
  const atScope = nodeAtPath(value, scope)
  const policy = atScope === undefined ? undefined : atScope['retryPolicy']
  const policyRecord = isRecord(policy) ? policy : undefined
  const backoffRaw = policyRecord === undefined ? undefined : policyRecord['backoff']
  const backoff = isRecord(backoffRaw) ? backoffRaw : undefined

  const mode = policyRecord?.['mode']
  const maxRetries = nonNegativeInt(policyRecord?.['maxRetries']) ?? DEFAULT_MAX_RETRIES
  const maxDelayMs = positiveNumber(backoff?.['maxDelayMs']) ?? DEFAULT_MAX_DELAY_MS
  const initialDelayMs = positiveNumber(backoff?.['initialDelayMs']) ?? DEFAULT_INITIAL_DELAY_MS
  const rawJitter = backoff?.['jitterRatio']
  const jitterRatio = typeof rawJitter === 'number' && Number.isFinite(rawJitter)
    ? Math.max(0, Math.min(rawJitter, 1))
    : DEFAULT_JITTER_RATIO

  // Does the route's OWN layer state a retry policy? A value inherited from the
  // deployment profile is not this provider's recorded choice, and only a
  // recorded one has anything for the card's reset to clear.
  const userScope = nodeAtPath(user, scope)
  const userPolicy = userScope === undefined ? undefined : userScope['retryPolicy']
  const declared = isRecord(userPolicy)

  return {
    // The executor treats a policy it cannot classify as normal mode; the card
    // shows the mode it will actually get.
    mode: mode === 'always' ? 'always' : 'normal',
    declared,
    maxRetries,
    maxDelayMs,
    initialDelayMs,
    jitterRatio,
    ...(policyRecord === undefined ? {} : { policy: policyRecord }),
  }
}

/**
 * The nominal wait before each retry, in milliseconds.
 *
 * The executor's own schedule without its random term: `initialDelayMs` doubled
 * per attempt and clamped to `maxDelayMs`. Only the FIRST `maxRetries` entries
 * are returned, so the curve always describes the budget being edited.
 * @param backoff - the resolved numbers.
 * @param maxRetries - how many waits the budget buys.
 * @returns one wait per retry, in order.
 */
export function retryWaitCurve(backoff: RetryBackoff, maxRetries: number): number[] {
  const waits: number[] = []
  // A cap of 0 or a negative budget would otherwise grow an enormous array for
  // a value the caller is about to reject anyway; the field caps bound the rest.
  const budget = Math.max(0, Math.min(Math.floor(maxRetries), MAX_RETRIES))
  for (let retry = 1; retry <= budget; retry += 1) {
    // Mirrors the executor's `Math.min(retry - 1, 1024)` exponent guard, so a
    // large budget cannot overflow into Infinity before the clamp applies.
    const exponent = Math.min(retry - 1, 1024)
    const exponential = Math.min(backoff.initialDelayMs * 2 ** exponent, backoff.maxDelayMs)
    waits.push(exponential)
  }
  return waits
}

/**
 * Total nominal wait across the whole budget, in milliseconds.
 * @param waits - the curve from {@link retryWaitCurve}.
 * @returns the sum.
 */
export function totalWaitMs(waits: readonly number[]): number {
  return waits.reduce((sum, wait) => sum + wait, 0)
}

/**
 * Compress a duration for a label: `500ms`, `2s`, `1m30s`.
 * @param ms - the duration in milliseconds.
 * @returns the shortest exact-enough text.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 1_000) return `${Math.round(ms)}ms`
  const totalSeconds = ms / 1_000
  if (totalSeconds < 60) {
    return Number.isInteger(totalSeconds) ? `${totalSeconds}s` : `${totalSeconds.toFixed(1)}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds - minutes * 60)
  if (seconds === 60) return `${minutes + 1}m`
  return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`
}

/**
 * The shortest and longest the whole budget can take, given jitter.
 *
 * Jitter is symmetric (±`jitterRatio`) and applied per wait, so a total is not
 * simply scaled: the bound is the sum of the per-wait bounds. Reporting a range
 * is the honest option — a single number would be wrong on every run.
 * @param waits - the curve from {@link retryWaitCurve}.
 * @param jitterRatio - the symmetric fraction the executor multiplies by.
 * @returns the low and high totals in milliseconds.
 */
export function waitRange(waits: readonly number[], jitterRatio: number): { low: number; high: number } {
  const ratio = Number.isFinite(jitterRatio) ? Math.max(0, Math.min(jitterRatio, 1)) : 0
  let low = 0
  let high = 0
  for (const wait of waits) {
    low += wait * (1 - ratio)
    high += wait * (1 + ratio)
  }
  return { low, high }
}

/**
 * Validate a typed retry count.
 * @param raw - the typed text.
 * @returns the accepted count, or null when the text is not one.
 */
export function parseRetries(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < MIN_RETRIES || value > MAX_RETRIES) return null
  return value
}

/**
 * Validate a typed cap on one wait, in SECONDS (the unit the field shows).
 * @param raw - the typed text.
 * @returns the accepted cap in milliseconds, or null when the text is not one.
 */
export function parseMaxDelaySeconds(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null
  const seconds = Number(text)
  if (!Number.isFinite(seconds)) return null
  const ms = Math.round(seconds * 1_000)
  if (ms < MIN_MAX_DELAY_MS || ms > MAX_MAX_DELAY_MS) return null
  return ms
}

/**
 * Render a cap for the seconds field, without a trailing `.0`.
 * @param ms - the stored cap in milliseconds.
 * @returns the display text.
 */
export function formatMaxDelaySeconds(ms: number): string {
  const seconds = ms / 1_000
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
}

/**
 * The retry policy document to write for one provider.
 *
 * `initialDelayMs` and `jitterRatio` are carried through from what the provider
 * already resolves, because the settings write is a merge at the `retryPolicy`
 * path: stating only the two edited fields would leave the rest to the schema
 * defaults, silently resetting a deployment that had tuned the first wait or
 * the jitter. Writing the resolved value back is the only way an edit to one
 * field leaves the others exactly as they were.
 * @param view - the provider's resolved policy.
 * @param maxRetries - the edited retry count.
 * @param maxDelayMs - the edited cap in milliseconds.
 * @returns the object to set at `retryPolicy`.
 */
export function retryPolicyDocument(
  view: RetryPolicyView, maxRetries: number, maxDelayMs: number,
): RetryPolicyValue {
  const stored = view.policy?.['retryableCodes']
  const retryableCodes = Array.isArray(stored)
    ? stored.filter((code): code is string => typeof code === 'string')
    : undefined
  return {
    mode: view.mode,
    maxRetries,
    // Omitted rather than set to undefined: the schema would reject an explicit
    // null here, and an absent key is what `default(...)` fills.
    ...(retryableCodes === undefined || retryableCodes.length === 0 ? {} : { retryableCodes }),
    backoff: {
      initialDelayMs: Math.min(view.initialDelayMs, maxDelayMs),
      maxDelayMs,
      jitterRatio: view.jitterRatio,
    },
  }
}
