import { z } from 'zod';
import { loadEnv } from '@livora/config';

/**
 * Auth-related env shared by every service that validates Keycloak JWTs.
 * Services just set these vars; the guard/provider read them here.
 */
const AuthEnvSchema = z.object({
  KEYCLOAK_URL: z.string().url().default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().default('livora'),
  // Empty = don't enforce `aud` (Keycloak public-client tokens carry no aud).
  JWT_AUDIENCE: z.string().default(''),
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;

export function loadAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  return loadEnv(AuthEnvSchema, source);
}
