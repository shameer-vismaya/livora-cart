import { z } from 'zod';
import { loadEnv } from '@livora/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().default('user-service'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  KAFKA_CONSUMER_GROUP: z.string().default('user-service'),
  USER_REGISTERED_TOPIC: z.string().default('livora.user.events'),
  KEYCLOAK_URL: z.string().url().default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().default('livora'),
  JWT_AUDIENCE: z.string().default(''),
  GEOCODING_PROVIDER: z.string().default('google'),
  GEOCODING_API_KEY: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;
export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return loadEnv(EnvSchema, source);
}
