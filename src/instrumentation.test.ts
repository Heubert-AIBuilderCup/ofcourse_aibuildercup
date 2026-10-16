// register() starts the tracer only on the Node runtime with OTEL_ENABLED=1 (SR5); the SDK is
// replaced, so no exporter is built and nothing reaches Cloud Trace.

import { afterEach, describe, expect, it, mock } from 'bun:test'

const startTracing = mock(() => {})
mock.module('./instrumentation.node', () => ({ startTracing }))

const { register } = await import('./instrumentation')

const saved = { OTEL_ENABLED: process.env.OTEL_ENABLED, NEXT_RUNTIME: process.env.NEXT_RUNTIME }
function env(values: { OTEL_ENABLED?: string; NEXT_RUNTIME?: string }) {
  for (const key of ['OTEL_ENABLED', 'NEXT_RUNTIME'] as const) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
}

afterEach(() => {
  startTracing.mockClear()
  env(saved)
})

describe('register', () => {
  it('starts the tracer on the Node runtime when OTEL_ENABLED is 1', async () => {
    env({ OTEL_ENABLED: '1', NEXT_RUNTIME: 'nodejs' })
    await register()
    expect(startTracing).toHaveBeenCalledTimes(1)
  })

  it('starts nothing when tracing is off, set to anything else, or on the edge runtime', async () => {
    for (const values of [
      { NEXT_RUNTIME: 'nodejs' },
      { OTEL_ENABLED: 'true', NEXT_RUNTIME: 'nodejs' },
      { OTEL_ENABLED: '1', NEXT_RUNTIME: 'edge' },
    ]) {
      env(values)
      await register()
    }
    expect(startTracing).not.toHaveBeenCalled()
  })
})
