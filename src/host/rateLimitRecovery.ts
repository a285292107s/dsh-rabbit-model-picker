export const RECOVERED_CODE = 'RATE_LIMIT'

export interface ProviderFailure {
  readonly message: string
  readonly code: string
  readonly [key: string]: unknown
}

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

function statusBlocksPromotion(status: unknown): boolean {
  if (typeof status !== 'number' || !Number.isFinite(status)) return false
  if (status === 429 || status === 408) return false
  if (status >= 500) return false
  return true
}

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
