import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createTelemetry } from '@livora/observability';
import { AppModule } from './app.module';
import { loadAppEnv } from './config';

async function bootstrap(): Promise<void> {
  const env = loadAppEnv();

  // Telemetry is a no-op until Plan 04 wires the OTel SDK; calling it here keeps
  // the integration point stable.
  const telemetry = createTelemetry({
    serviceName: env.SERVICE_NAME,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`platform-reference listening on :${env.PORT} (telemetry=${telemetry.enabled})`);

  const shutdown = async () => {
    await app.close();
    await telemetry.shutdown();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
