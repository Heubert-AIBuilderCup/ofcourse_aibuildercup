// Runs once when the server starts (Next's instrumentation convention). Tracing is off unless
// OTEL_ENABLED=1, and only on the Node runtime: the SDK and the Cloud Trace exporter are imported
// here and nowhere else, so with tracing off they never load (SR5). With the finder on, its
// embedding client is warmed here, not awaited, so the first search does not pay for it; with the
// finder off its module never loads.

import { finderOn } from './features/finder/switch'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OTEL_ENABLED === '1') {
    const { startTracing } = await import('./instrumentation.node')
    startTracing()
  }
  if (process.env.NEXT_RUNTIME === 'nodejs' && finderOn(process.env)) {
    const { warmUp } = await import('./features/finder/server/embed')
    warmUp(process.env)
  }
}
