
import { recoverRateLimitFailure } from './host/rateLimitRecovery.ts'
import type { ProviderFailure } from './host/rateLimitRecovery.ts'

interface RequestErrorPayload {
  failure: ProviderFailure
  readonly retryPolicy?: unknown
}

interface HostContext {
  on(
    event: 'agent/request-error',
    listener: (payload: RequestErrorPayload, next: () => unknown) => unknown,
    options: { readonly prepend: boolean },
  ): unknown
}

/**
 * Registered with `prepend: true`, i.e. as the WATERFALL's outermost layer: the
 * promoted code has to be on the payload before the shipped retry executor reads it.
 * `next()` is always called, so the chain continues exactly as it would otherwise.
 */
export function apply(ctx: HostContext): void {
  ctx.on(
    'agent/request-error',
    (payload, next) => {
      const recovered = recoverRateLimitFailure(payload.failure, payload.retryPolicy)
      if (recovered !== null) payload.failure = recovered
      return next()
    },
    { prepend: true },
  )
}
