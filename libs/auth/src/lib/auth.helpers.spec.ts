import {
  extractBearerToken,
  extractRealmRoles,
  extractStoreIds,
  hasRealmRole,
  toAuthUser,
} from './auth.helpers';

describe('auth.helpers', () => {
  it('extracts bearer token case-insensitively', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('reads realm roles and store ids', () => {
    const payload = {
      realm_access: { roles: ['customer', 'admin'] },
      stores: ['s1', 's2'],
    } as never;
    expect(extractRealmRoles(payload)).toEqual(['customer', 'admin']);
    expect(hasRealmRole(payload, 'admin')).toBe(true);
    expect(extractStoreIds(payload)).toEqual(['s1', 's2']);
  });

  it('handles single-string and missing stores claim', () => {
    expect(extractStoreIds({ stores: 's1' } as never)).toEqual(['s1']);
    expect(extractStoreIds({} as never)).toEqual([]);
  });

  it('maps payload to auth user', () => {
    const user = toAuthUser({
      sub: 'u1',
      preferred_username: 'tester',
      email: 'a@b.c',
      realm_access: { roles: ['customer'] },
      stores: ['s1'],
    } as never);
    expect(user).toEqual({
      sub: 'u1',
      username: 'tester',
      email: 'a@b.c',
      roles: ['customer'],
      storeIds: ['s1'],
    });
  });
});
