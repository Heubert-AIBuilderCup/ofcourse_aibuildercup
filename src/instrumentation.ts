// Runs once when the server starts (Next's instrumentation convention). Tracing is off unless
// OTEL_ENABLED=1, and only on the Node runtime: the SDK and the Cloud Trace exporter are imported
// here and nowhere else, so with tracing off they never load (SR5).

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OTEL_ENABLED === '1') {
    const { startTracing } = await import('./instrumentation.node')
    startTracing()
  }
}
