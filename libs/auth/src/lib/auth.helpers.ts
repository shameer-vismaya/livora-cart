import type { JWTPayload } from 'jose';

/** Extract a bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/** Keycloak places realm roles under `realm_access.roles`. */
export function extractRealmRoles(payload: JWTPayload): string[] {
  const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
  return realmAccess?.roles ?? [];
}

export function hasRealmRole(payload: JWTPayload, role: string): boolean {
  return extractRealmRoles(payload).includes(role);
}

/** Store ids the principal is scoped to (set as a custom Keycloak claim). */
export function extractStoreIds(payload: JWTPayload): string[] {
  const stores = payload['stores'];
  if (Array.isArray(stores)) return stores.map(String);
  if (typeof stores === 'string' && stores.length > 0) return [stores];
  return [];
}

/** Minimal authenticated principal attached to the request. */
export interface AuthUser {
  sub: string;
  username?: string;
  email?: string;
  roles: string[];
  storeIds: string[];
}

export function toAuthUser(payload: JWTPayload): AuthUser {
  return {
    sub: String(payload.sub),
    username: payload['preferred_username'] as string | undefined,
    email: payload['email'] as string | undefined,
    roles: extractRealmRoles(payload),
    storeIds: extractStoreIds(payload),
  };
}
