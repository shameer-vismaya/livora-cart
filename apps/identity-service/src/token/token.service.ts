import { Injectable, Logger } from '@nestjs/common';
import { KeycloakAdminService } from '../keycloak/keycloak-admin.service';
import { loadAppEnv } from '../config';

export interface IssuedToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Mints Keycloak tokens for a verified principal via the token-exchange grant
 * (impersonation by the identity-admin service-account client).
 *
 * HOST REQUIREMENT: Keycloak must run with `--features=token-exchange` and the
 * identity-admin client must be allowed to impersonate (admin-fine-grained-authz).
 * The compose keycloak command enables the feature; fine-grained permission is
 * granted in the realm/admin console (documented in the plan summary).
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly env = loadAppEnv();

  constructor(private readonly kc: KeycloakAdminService) {}

  /** Ensure a Keycloak user exists for the phone, then issue a token for them. */
  async issueForVerifiedPhone(phone: string): Promise<IssuedToken> {
    let userId = await this.kc.findUserId({ phone });
    if (!userId) {
      userId = await this.kc.createUser({ phone, emailVerified: false });
      await this.kc.assignRealmRole(userId, this.env.DEFAULT_CUSTOMER_ROLE);
    }
    return this.exchangeForUser(userId);
  }

  /** token-exchange: identity-admin impersonates the target user. */
  async exchangeForUser(userId: string): Promise<IssuedToken> {
    const res = await fetch(
      `${this.env.KEYCLOAK_URL}/realms/${this.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          client_id: this.env.KEYCLOAK_ADMIN_CLIENT_ID,
          client_secret: this.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
          requested_subject: userId,
          requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          audience: 'livora-web',
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`token-exchange failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as IssuedToken;
  }
}
