// The tracer behind OTEL_ENABLED=1 (SR5): spans, Next's own and the gen_ai ones, go to Cloud Trace
// in batches. The exporter authenticates with Application Default Credentials (the service account
// on Cloud Run) and finds the project from them, so no key or id lives here. An export that cannot
// reach Google drops its spans; the request it traced has already been answered.

import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

export function startTracing(): void {
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'ofcourse' }),
    spanProcessors: [new BatchSpanProcessor(new TraceExporter())],
  })
  provider.register()
}
