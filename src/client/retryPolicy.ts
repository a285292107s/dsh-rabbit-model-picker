
import type { RetryBackoff, RetryPolicyValue, RetryPolicyView } from './contract.ts'

export const MIN_RETRIES = 0

export const MAX_RETRIES = 60

export const MIN_MAX_DELAY_MS = 500

export const MAX_MAX_DELAY_MS = 60_000

export const DEFAULT_INITIAL_DELAY_MS = 500

export const DEFAULT_MAX_DELAY_MS = 10_000

export const DEFAULT_JITTER_RATIO = 0.1

export const DEFAULT_MAX_RETRIES = 5

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function nodeAtPath(value: unknown, path: readonly string[]): Record<string, unknown> | undefined {
  let node: unknown = value
  for (const key of path) {
    if (!isRecord(node)) return undefined
    node = node[key]
  }
  return isRecord(node) ? node : undefined
}

export function resolveRetryPolicy(
  value: unknown, scope: readonly string[], user?: unknown,
): RetryPolicyView {
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

  const userScope = nodeAtPath(user, scope)
  const userPolicy = userScope === undefined ? undefined : userScope['retryPolicy']
  const declared = isRecord(userPolicy)

  return {
    mode: mode === 'always' ? 'always' : 'normal',
    declared,
    maxRetries,
    maxDelayMs,
    initialDelayMs,
    jitterRatio,
    ...(policyRecord === undefined ? {} : { policy: policyRecord }),
  }
}

export function retryWaitCurve(backoff: RetryBackoff, maxRetries: number): number[] {
  const waits: number[] = []
  const budget = Math.max(0, Math.min(Math.floor(maxRetries), MAX_RETRIES))
  for (let retry = 1; retry <= budget; retry += 1) {
    const exponent = Math.min(retry - 1, 1024)
    const exponential = Math.min(backoff.initialDelayMs * 2 ** exponent, backoff.maxDelayMs)
    waits.push(exponential)
  }
  return waits
}

export function totalWaitMs(waits: readonly number[]): number {
  return waits.reduce((sum, wait) => sum + wait, 0)
}

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

// Jitter is ±jitterRatio PER WAIT in the executor, so a total is the sum of per-wait bounds
// rather than a scaled number. The summary's "longest total" shows `high`, the end that
// answers "how long can this take".
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

export function parseRetries(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < MIN_RETRIES || value > MAX_RETRIES) return null
  return value
}

export function parseMaxDelaySeconds(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null
  const seconds = Number(text)
  if (!Number.isFinite(seconds)) return null
  const ms = Math.round(seconds * 1_000)
  if (ms < MIN_MAX_DELAY_MS || ms > MAX_MAX_DELAY_MS) return null
  return ms
}

export function formatMaxDelaySeconds(ms: number): string {
  const seconds = ms / 1_000
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
}

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
    ...(retryableCodes === undefined || retryableCodes.length === 0 ? {} : { retryableCodes }),
    // `initialDelayMs` / `jitterRatio` are carried through from the resolved view because the
    // write merges at `retryPolicy`: stating only the two edited fields would silently reset them.
    backoff: {
      initialDelayMs: Math.min(view.initialDelayMs, maxDelayMs),
      maxDelayMs,
      jitterRatio: view.jitterRatio,
    },
  }
}
