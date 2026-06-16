import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { loadAuthEnv } from './auth.env';

/**
 * Cached remote JWKS for the Keycloak realm. jose caches keys and handles
 * rotation, so guards verify RS256 tokens without pinning a key.
 */
@Injectable()
export class JwksProvider {
  private readonly env = loadAuthEnv();
  private readonly jwks = createRemoteJWKSet(
    new URL(
      `${this.env.KEYCLOAK_URL}/realms/${this.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    ),
  );

  get keySet() {
    return this.jwks;
  }

  get issuer(): string {
    return `${this.env.KEYCLOAK_URL}/realms/${this.env.KEYCLOAK_REALM}`;
  }

  get audiences(): string[] {
    return this.env.JWT_AUDIENCE
      ? this.env.JWT_AUDIENCE.split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : [];
  }
}
