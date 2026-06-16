import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * Telemetry bootstrap for Livora services.
 *
 * When enabled, starts the OpenTelemetry NodeSDK with auto-instrumentations
 * (HTTP/Nest/Express, KafkaJS, pg) and OTLP exporters for traces + metrics.
 * The KafkaJS instrumentation propagates W3C trace context across the message
 * boundary, so an order's full path is ONE trace (ARCHITECTURE.md §10).
 *
 * Disabled (no OTLP endpoint) → a no-op, so unit tests and local runs without a
 * collector are unaffected.
 */
export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  /** OTLP collector base endpoint, e.g. http://otel-collector:4318. */
  otlpEndpoint?: string;
  /** Force-enable/disable; defaults to enabled when otlpEndpoint is set. */
  enabled?: boolean;
}

export interface Telemetry {
  readonly serviceName: string;
  readonly enabled: boolean;
  shutdown(): Promise<void>;
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const enabled = options.enabled ?? options.otlpEndpoint != null;

  if (!enabled || !options.otlpEndpoint) {
    return {
      serviceName: options.serviceName,
      enabled: false,
      async shutdown() {
        /* no-op */
      },
    };
  }

  const base = options.otlpEndpoint.replace(/\/$/, '');
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? '0.0.1',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  return {
    serviceName: options.serviceName,
    enabled: true,
    async shutdown() {
      await sdk.shutdown();
    },
  };
}
