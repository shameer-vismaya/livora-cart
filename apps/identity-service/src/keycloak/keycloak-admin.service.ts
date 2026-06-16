import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { loadAppEnv } from '../config';

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Thin Keycloak Admin REST client using a confidential service-account client
 * (client_credentials). Caches the admin token and refreshes on expiry.
 */
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly env = loadAppEnv();
  private cached?: CachedToken;

  private base(): string {
    return `${this.env.KEYCLOAK_URL}/admin/realms/${this.env.KEYCLOAK_REALM}`;
  }

  private async adminToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now + 5000) return this.cached.token;
    const res = await fetch(
      `${this.env.KEYCLOAK_URL}/realms/${this.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.env.KEYCLOAK_ADMIN_CLIENT_ID,
          client_secret: this.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
        }),
      },
    );
    if (!res.ok) throw new Error(`Keycloak admin token failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.cached = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return json.access_token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.adminToken()}`,
      'Content-Type': 'application/json',
    };
  }

  /** Find a user by exact email or phone attribute; returns keycloakId or null. */
  async findUserId(params: { email?: string; phone?: string }): Promise<string | null> {
    const headers = await this.authHeaders();
    if (params.email) {
      const res = await fetch(
        `${this.base()}/users?email=${encodeURIComponent(params.email)}&exact=true`,
        { headers },
      );
      const arr = (await res.json()) as Array<{ id: string }>;
      if (arr.length) return arr[0].id;
    }
    if (params.phone) {
      const res = await fetch(
        `${this.base()}/users?q=phone:${encodeURIComponent(params.phone)}`,
        { headers },
      );
      const arr = (await res.json()) as Array<{ id: string }>;
      if (arr.length) return arr[0].id;
    }
    return null;
  }

  /** Create a user; returns the new keycloakId. Throws ConflictException on duplicate. */
  async createUser(input: {
    email?: string;
    phone?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
  }): Promise<string> {
    const headers = await this.authHeaders();
    const body: Record<string, unknown> = {
      enabled: true,
      email: input.email,
      username: input.email ?? input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerified: input.emailVerified ?? false,
      attributes: input.phone ? { phone: [input.phone] } : undefined,
    };
    if (input.password) {
      body['credentials'] = [{ type: 'password', value: input.password, temporary: false }];
    }
    const res = await fetch(`${this.base()}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (res.status === 409) throw new ConflictException('User already exists');
    if (!res.ok) throw new Error(`Keycloak createUser failed: ${res.status} ${await res.text()}`);
    const location = res.headers.get('location') ?? '';
    const id = location.split('/').pop();
    if (!id) {
      const found = await this.findUserId({ email: input.email, phone: input.phone });
      if (found) return found;
      throw new Error('Could not resolve created user id');
    }
    return id;
  }

  /** Assign a realm role to a user by role name. */
  async assignRealmRole(userId: string, roleName: string): Promise<void> {
    const headers = await this.authHeaders();
    const roleRes = await fetch(`${this.base()}/roles/${encodeURIComponent(roleName)}`, { headers });
    if (!roleRes.ok) throw new Error(`Keycloak role lookup failed: ${roleRes.status}`);
    const role = (await roleRes.json()) as { id: string; name: string };
    const res = await fetch(`${this.base()}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });
    if (!res.ok) throw new Error(`Keycloak role assignment failed: ${res.status} ${await res.text()}`);
  }
}
