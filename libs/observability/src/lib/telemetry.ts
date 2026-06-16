/**
 * Telemetry bootstrap for Livora services.
 *
 * NOTE: Plan 01 ships the typed surface + a no-op fallback so libs/services can
 * depend on it today without pulling the OpenTelemetry SDK. Plan 04
 * (Observability baseline) replaces the body of `createTelemetry` with the real
 * `@opentelemetry/sdk-node` wiring (OTLP exporter, auto-instrumentations,
 * W3C trace-context propagation across the Kafka boundary).
 */
export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  /** OTLP collector endpoint, e.g. http://otel-collector:4318. */
  otlpEndpoint?: string;
  /** When false, telemetry is disabled (useful for unit tests). */
  enabled?: boolean;
}

export interface Telemetry {
  readonly serviceName: string;
  readonly enabled: boolean;
  /** Flush + shut the SDK down on graceful termination. */
  shutdown(): Promise<void>;
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const enabled = options.enabled ?? options.otlpEndpoint != null;

  // TODO(plan-04): initialize @opentelemetry/sdk-node here when `enabled`.
  // const sdk = new NodeSDK({ ... }); sdk.start();

  return {
    serviceName: options.serviceName,
    enabled,
    async shutdown(): Promise<void> {
      // TODO(plan-04): await sdk.shutdown();
    },
  };
}
