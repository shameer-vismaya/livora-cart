import { z } from 'zod';
import { loadEnv } from '@livora/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().default('store-service'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  KEYCLOAK_URL: z.string().url().default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().default('livora'),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().default('identity-admin'),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().default('identity-admin-dev-secret'),
  JWT_AUDIENCE: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;
export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return loadEnv(EnvSchema, source);
}
