// The Gemini span and log line (SR5, SR6): an in-memory exporter, never Cloud Trace.

import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'

mock.module('server-only', () => ({}))

const { logAiCall, withGenAiSpan } = await import('./telemetry')

const exporter = new InMemorySpanExporter()
const INFO = {
  useCase: 'extract',
  tier: 'flash',
  promptVersion: 'extract.v3',
  model: 'gemini-flash',
  cached: false,
  attempt: 2,
} as const

beforeAll(() => {
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
  )
})
afterEach(() => {
  exporter.reset()
  delete process.env.OTEL_ENABLED
})
afterAll(() => {
  trace.disable()
})

describe('withGenAiSpan', () => {
  it('runs the function and records nothing while tracing is off', async () => {
    const value = await withGenAiSpan(INFO, async (span) => {
      span.setUsage({ inputTokens: 1, outputTokens: 2 })
      return 'answer'
    })
    expect(value).toBe('answer')
    expect(exporter.getFinishedSpans()).toHaveLength(0)
  })

  it('records one gen_ai span with the SR5 attributes and the outcome', async () => {
    process.env.OTEL_ENABLED = '1'
    const value = await withGenAiSpan(INFO, async (span) => {
      span.setUsage({ inputTokens: 120, outputTokens: 45 })
      return 'answer'
    })
    expect(value).toBe('answer')
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].name).toBe('gen_ai extract')
    expect(spans[0].attributes).toEqual({
      'gen_ai.operation.name': 'generate_content',
      'gen_ai.request.model': 'gemini-flash',
      'gen_ai.usage.input_tokens': 120,
      'gen_ai.usage.output_tokens': 45,
      'ofcourse.use_case': 'extract',
      'ofcourse.tier': 'flash',
      'ofcourse.prompt_version': 'extract.v3',
      'ofcourse.cached': false,
      'ofcourse.attempt': 2,
      'ofcourse.outcome': 'ok',
    })
  })

  it('records the outcome the call reports, such as an invalid answer', async () => {
    process.env.OTEL_ENABLED = '1'
    await withGenAiSpan(INFO, async (span) => span.setOutcome('invalid'))
    expect(exporter.getFinishedSpans()[0].attributes['ofcourse.outcome']).toBe('invalid')
  })

  it('records a failure by its error type, never its message, and rethrows', async () => {
    process.env.OTEL_ENABLED = '1'
    const err = Object.assign(new Error('quota for user-77 on "my pasted essay"'), {
      name: 'ApiError',
    })
    await expect(
      withGenAiSpan(INFO, async () => {
        throw err
      }),
    ).rejects.toBe(err)
    const [span] = exporter.getFinishedSpans()
    expect(span.attributes['ofcourse.outcome']).toBe('failed')
    expect(span.attributes['error.type']).toBe('ApiError')
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.status.message).toBeUndefined()
    expect(span.events).toHaveLength(0)
    expect(JSON.stringify(span.attributes)).not.toContain('pasted essay')
  })
})

describe('logAiCall', () => {
  it('writes one JSON line Cloud Logging parses, with the SR6 fields', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      logAiCall({
        ...INFO,
        outcome: 'ok',
        ms: 812,
        inputTokens: 120,
        outputTokens: 45,
      })
      expect(log).toHaveBeenCalledTimes(1)
      const line = log.mock.calls[0][0] as string
      expect(line).not.toContain('\n')
      expect(JSON.parse(line)).toEqual({
        severity: 'INFO',
        event: 'ai_call',
        use_case: 'extract',
        tier: 'flash',
        model: 'gemini-flash',
        prompt_version: 'extract.v3',
        cached: false,
        outcome: 'ok',
        attempt: 2,
        ms: 812,
        input_tokens: 120,
        output_tokens: 45,
      })
    } finally {
      log.mockRestore()
    }
  })

  it('writes null token counts when the provider reports none', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      logAiCall({ ...INFO, outcome: 'failed', ms: 30_000 })
      expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
        outcome: 'failed',
        input_tokens: null,
        output_tokens: null,
      })
    } finally {
      log.mockRestore()
    }
  })
})
