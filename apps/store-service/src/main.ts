import { telemetry } from './telemetry.bootstrap';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { collectDefaultMetrics } from 'prom-client';
import { AppModule } from './app.module';
import { loadAppEnv } from './config';

async function bootstrap(): Promise<void> {
  const env = loadAppEnv();
  collectDefaultMetrics({ prefix: 'livora_' });
  process.on('unhandledRejection', (reason) => {
    new Logger('Process').error(`Unhandled rejection: ${String(reason)}`);
  });

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(
    `store-service listening on :${env.PORT} (telemetry=${telemetry.enabled})`,
  );

  const shutdown = async () => {
    await app.close();
    await telemetry.shutdown();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
void bootstrap();
