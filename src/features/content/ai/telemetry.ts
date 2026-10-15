import 'server-only'
import { type Attributes, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import type { CallPurpose } from './client'

// One Gemini call as a span in Cloud Trace (SR5) and a line in Cloud Logging (SR6). Only what the
// call was for and how it went: never the prompt, the answer, the source, a fact or who asked.

export type Outcome = 'ok' | 'invalid' | 'failed'
/** Token counts from the response's usageMetadata; the fake provider reports none. */
export type Usage = { inputTokens?: number; outputTokens?: number }
export type CallInfo = CallPurpose & { model: string; cached: boolean; attempt: number }

export type GenAiSpan = {
  setUsage(usage: Usage): void
  /** Overrides the default: ok when the function resolves, failed when it throws. */
  setOutcome(outcome: Outcome): void
}

const NO_SPAN: GenAiSpan = { setUsage() {}, setOutcome() {} }

function usageAttributes(usage: Usage): Attributes {
  const out: Attributes = {}
  if (usage.inputTokens !== undefined) out['gen_ai.usage.input_tokens'] = usage.inputTokens
  if (usage.outputTokens !== undefined) out['gen_ai.usage.output_tokens'] = usage.outputTokens
  return out
}

/**
 * Runs one provider attempt inside a `gen_ai <use case>` span. With tracing off (OTEL_ENABLED is
 * not '1', the default and always in tests) it only runs the function. A failure is recorded by
 * its error type, never its message, which can quote the request.
 */
export async function withGenAiSpan<T>(
  info: CallInfo,
  run: (span: GenAiSpan) => Promise<T>,
): Promise<T> {
  if (process.env.OTEL_ENABLED !== '1') return run(NO_SPAN)
  const attributes: Attributes = {
    'gen_ai.operation.name': 'generate_content',
    'gen_ai.request.model': info.model,
    'ofcourse.use_case': info.useCase,
    'ofcourse.tier': info.tier,
    'ofcourse.prompt_version': info.promptVersion,
    'ofcourse.cached': info.cached,
    'ofcourse.attempt': info.attempt,
  }
  return trace
    .getTracer('ofcourse')
    .startActiveSpan(
      `gen_ai ${info.useCase}`,
      { kind: SpanKind.CLIENT, attributes },
      async (span) => {
        let outcome: Outcome = 'ok'
        const handle: GenAiSpan = {
          setUsage: (usage) => span.setAttributes(usageAttributes(usage)),
          setOutcome: (next) => {
            outcome = next
          },
        }
        try {
          return await run(handle)
        } catch (err) {
          outcome = 'failed'
          span.setAttribute('error.type', err instanceof Error ? err.name : 'unknown')
          span.setStatus({ code: SpanStatusCode.ERROR })
          throw err
        } finally {
          span.setAttribute('ofcourse.outcome', outcome)
          span.end()
        }
      },
    )
}

/** One structured line per finished call, which Cloud Logging parses from stdout (SR6). */
export function logAiCall(row: CallInfo & Usage & { outcome: Outcome; ms: number }): void {
  console.log(
    JSON.stringify({
      severity: 'INFO',
      event: 'ai_call',
      use_case: row.useCase,
      tier: row.tier,
      model: row.model,
      prompt_version: row.promptVersion,
      cached: row.cached,
      outcome: row.outcome,
      attempt: row.attempt,
      ms: row.ms,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
    }),
  )
}
