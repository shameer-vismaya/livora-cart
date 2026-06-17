import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@livora/auth';

/**
 * Resolve the effective storeId for a request. Admins may act on any store
 * ('*' sentinel for RLS bypass when needed); store_owner/staff must have the
 * store in their `stores` claim, else 403.
 */
export function resolveStoreId(user: AuthUser, requestedStoreId: string): string {
  if (user.roles.includes('admin')) return requestedStoreId;
  if (user.storeIds.includes(requestedStoreId)) return requestedStoreId;
  throw new ForbiddenException('Not scoped to this store');
}

export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes('admin');
}
