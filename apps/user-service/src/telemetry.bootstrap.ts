import { createTelemetry } from '@livora/observability';
import { loadAppEnv } from './config';

const env = loadAppEnv();
export const telemetry = createTelemetry({
  serviceName: env.SERVICE_NAME,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
