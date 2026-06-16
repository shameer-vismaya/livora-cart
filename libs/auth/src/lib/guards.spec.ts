import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { StoreScopeGuard } from './store-scope.guard';
import type { AuthUser } from './auth.helpers';

function ctxWith(user: Partial<AuthUser>, params: Record<string, string> = {}): ExecutionContext {
  const req = { user, params };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(ctxWith({ roles: [] }))).toBe(true);
  });

  it('allows when user has a required role', () => {
    const reflector = { getAllAndOverride: () => ['admin'] } as unknown as Reflector;
    expect(
      new RolesGuard(reflector).canActivate(ctxWith({ roles: ['customer', 'admin'] })),
    ).toBe(true);
  });

  it('denies (403) when role missing', () => {
    const reflector = { getAllAndOverride: () => ['admin'] } as unknown as Reflector;
    expect(() =>
      new RolesGuard(reflector).canActivate(ctxWith({ roles: ['customer'] })),
    ).toThrow(ForbiddenException);
  });
});

describe('StoreScopeGuard', () => {
  const scoped = { getAllAndOverride: () => ({ param: 'storeId' }) } as unknown as Reflector;

  it('passes through when route is not store-scoped', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new StoreScopeGuard(reflector).canActivate(ctxWith({ roles: [] }))).toBe(true);
  });

  it('admin bypasses store scope', () => {
    expect(
      new StoreScopeGuard(scoped).canActivate(
        ctxWith({ roles: ['admin'], storeIds: [] }, { storeId: 's9' }),
      ),
    ).toBe(true);
  });

  it('allows when store matches the principal scope', () => {
    expect(
      new StoreScopeGuard(scoped).canActivate(
        ctxWith({ roles: ['store_owner'], storeIds: ['s1', 's2'] }, { storeId: 's2' }),
      ),
    ).toBe(true);
  });

  it('denies (403) when store not in scope', () => {
    expect(() =>
      new StoreScopeGuard(scoped).canActivate(
        ctxWith({ roles: ['store_owner'], storeIds: ['s1'] }, { storeId: 's9' }),
      ),
    ).toThrow(ForbiddenException);
  });
});
