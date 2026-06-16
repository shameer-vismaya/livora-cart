import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { STORE_SCOPE_KEY } from './store-scope.decorator';
import type { AuthUser } from './auth.helpers';

/**
 * ABAC: store-staff/owners may only act within their own store(s); admin bypasses.
 * Reads the store id from the configured route param and the principal's
 * `storeIds` claim (set by KeycloakJwtGuard from the JWT `stores` claim).
 */
@Injectable()
export class StoreScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<{ param: string }>(
      STORE_SCOPE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!opts) return true; // not store-scoped

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; params: Record<string, string> }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No authenticated principal');
    if (user.roles.includes('admin')) return true; // platform admin bypass

    const storeId = req.params?.[opts.param];
    if (storeId && user.storeIds.includes(storeId)) return true;
    throw new ForbiddenException('Store scope denied');
  }
}
