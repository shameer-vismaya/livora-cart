import { z } from 'zod';
import { loadEnv } from '@livora/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().default('platform-reference'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  KAFKA_CONSUMER_GROUP: z.string().default('platform-reference'),
  DEMO_TOPIC: z.string().default('livora.demo.events'),
  DEMO_DLQ_TOPIC: z.string().default('livora.demo.events.DLQ'),
  KEYCLOAK_URL: z.string().url().default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().default('livora'),
  // Comma-separated accepted audiences. Empty = don't enforce `aud` (Keycloak
  // public-client direct-grant tokens have no aud without an audience mapper).
  JWT_AUDIENCE: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return loadEnv(EnvSchema, source);
}
