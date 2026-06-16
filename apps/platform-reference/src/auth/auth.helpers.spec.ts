import {
  extractBearerToken,
  extractRealmRoles,
  hasRealmRole,
  toAuthUser,
} from './auth.helpers';

describe('auth.helpers', () => {
  it('extracts bearer token case-insensitively', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
  });

  it('reads realm roles from realm_access', () => {
    const payload = { realm_access: { roles: ['customer', 'admin'] } } as never;
    expect(extractRealmRoles(payload)).toEqual(['customer', 'admin']);
    expect(hasRealmRole(payload, 'admin')).toBe(true);
    expect(hasRealmRole(payload, 'driver')).toBe(false);
  });

  it('returns empty roles when absent', () => {
    expect(extractRealmRoles({} as never)).toEqual([]);
  });

  it('maps payload to auth user', () => {
    const user = toAuthUser({
      sub: 'user-1',
      preferred_username: 'testcustomer',
      email: 'a@b.c',
      realm_access: { roles: ['customer'] },
    } as never);
    expect(user).toEqual({
      sub: 'user-1',
      username: 'testcustomer',
      email: 'a@b.c',
      roles: ['customer'],
    });
  });
});
