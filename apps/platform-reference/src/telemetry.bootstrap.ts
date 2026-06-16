// IMPORTANT: this module must be imported FIRST (before NestJS, pg, kafkajs) so
// OpenTelemetry auto-instrumentation can patch those modules as they load.
import { createTelemetry } from '@livora/observability';
import { loadAppEnv } from './config';

const env = loadAppEnv();

export const telemetry = createTelemetry({
  serviceName: env.SERVICE_NAME,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
