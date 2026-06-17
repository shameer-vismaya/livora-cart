import { z } from 'zod';
import { loadEnv } from '@livora/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().default('catalog-service'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  KEYCLOAK_URL: z.string().url().default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().default('livora'),
  JWT_AUDIENCE: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  // S3/MinIO (Plan 05)
  S3_ENDPOINT: z.string().default('http://minio:9000'),
  S3_BUCKET: z.string().default('livora-catalog'),
  S3_ACCESS_KEY: z.string().default('livora'),
  S3_SECRET_KEY: z.string().default('livora_dev_pw'),
  S3_PUBLIC_BASE_URL: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;
export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return loadEnv(EnvSchema, source);
}
