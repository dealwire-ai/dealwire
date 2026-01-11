// MUST be imported first - initializes OpenTelemetry before NestJS
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize Prometheus exporter (exposes /metrics endpoint)
// The server starts automatically when the exporter is created
const prometheusExporter = new PrometheusExporter({
  port: 9464, // Different port from API
});

// Create OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'analyzer-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Auto-instruments: HTTP, Express, fs, etc.
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Too noisy
      },
    }),
  ],
});

// Start SDK
sdk.start();
console.log('🔍 OpenTelemetry initialized');
console.log('📊 Prometheus metrics server started on port 9464');

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((error: unknown) => console.error('Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
});
