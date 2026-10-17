/**
 * Host half of `dsh-rabbit-model-picker`.
 *
 * Two jobs, and only one of them is UI:
 *
 * 1. THE COMPOSER MODEL SEAT is pure browser UI over services another plugin
 *    already provides (`modelDirectories` owns the catalog and the selection
 *    RPC), so it needs no Host-side registration at all.
 * 2. RATE-LIMIT WORDING RECOVERY runs here, on the agent loop's
 *    `agent/request-error` extension point. It exists because one class of
 *    provider failure reaches the loop with a code no policy retries, so the
 *    retry card's settings were never consulted; that case is described in full
 *    in `host/rateLimitRecovery.ts`. This file is only the wiring.
 *
 * WHY `prepend`. The shipped executor (`@deepseek-ai/dsh-llm-retry`) also
 * listens on `agent/request-error`, and it decides from `failure.code` against
 * the provider's `retryableCodes`. A waterfall runs its listeners
 * outermost-first, and a listener that does not call `next()` vetoes the rest of
 * the chain, so this listener must sit in FRONT of the executor to hand it a
 * code it will accept; registering alongside it would run after the decision had
 * already been made and the failure abandoned.
 *
 * WHY IT ONLY REPLACES THE FAILURE FIELD. `next()` is always returned, so every
 * failure this module does not own reaches the executor exactly as it arrived,
 * and `{ kind: 'retry' }` is never returned directly: the wait, the budget, the
 * per-session counter and the conversation's 「等待重试模型请求」 row must all
 * stay the executor's — and therefore the retry card's — single answer.
 *
 * SCOPE. Registered on the plugin's own (untagged) context, so
 * `@deepseek-ai/dsh-scope` admits it globally: one composition observes every
 * agent under it, subagents included. No service is injected because the loop's
 * error path is an event, not a service.
 *
 * @module dsh-rabbit-model-picker
 */

import { recoverRateLimitFailure } from './host/rateLimitRecovery.ts'
import type { ProviderFailure } from './host/rateLimitRecovery.ts'

/**
 * The fields this listener reads from `agent/request-error`.
 *
 * `failure` is mutable on purpose: the dispatched payload is a shallow copy made
 * by the agent's dispatcher, so replacing the field reaches the rest of the
 * waterfall without touching the loop's own `finish.failure`.
 */
interface RequestErrorPayload {
  failure: ProviderFailure
  readonly retryPolicy?: unknown
}

/** The one context capability this plugin uses. */
interface HostContext {
  on(
    event: 'agent/request-error',
    listener: (payload: RequestErrorPayload, next: () => unknown) => unknown,
    options: { readonly prepend: boolean },
  ): unknown
}

/**
 * Host plugin entry point.
 * @param ctx - the plugin's context.
 */
export function apply(ctx: HostContext): void {
  ctx.on(
    'agent/request-error',
    (payload, next) => {
      const recovered = recoverRateLimitFailure(payload.failure, payload.retryPolicy)
      if (recovered !== null) payload.failure = recovered
      // Always delegate: a failure this module does not own must reach the
      // shipped executor unchanged, and a promoted one must be retried by it.
      return next()
    },
    { prepend: true },
  )
}
