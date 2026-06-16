// Telemetry first — starts the OTel SDK before instrumented libs are required.
import { telemetry } from './telemetry.bootstrap';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { collectDefaultMetrics } from 'prom-client';
import { AppModule } from './app.module';
import { loadAppEnv } from './config';

async function bootstrap(): Promise<void> {
  const env = loadAppEnv();
  collectDefaultMetrics({ prefix: 'livora_' });

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(
    `platform-reference listening on :${env.PORT} (telemetry=${telemetry.enabled})`,
  );

  const shutdown = async () => {
    await app.close();
    await telemetry.shutdown();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
