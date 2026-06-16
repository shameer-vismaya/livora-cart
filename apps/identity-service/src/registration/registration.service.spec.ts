import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  it('creates a Keycloak user, assigns role, and emits UserRegistered in a txn', async () => {
    const kc = {
      createUser: jest.fn().mockResolvedValue('kc-123'),
      assignRealmRole: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = { publishWithin: jest.fn().mockResolvedValue(undefined) };
    const tx = { identityUser: { create: jest.fn().mockResolvedValue({ id: 'u-1' }) } };
    const prisma = { $transaction: jest.fn().mockImplementation((fn) => fn(tx)) };

    const svc = new RegistrationService(
      prisma as never,
      outbox as never,
      kc as never,
    );

    const res = await svc.registerEmail({ email: 'a@b.c', password: 'password1' });

    expect(kc.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c', password: 'password1' }),
    );
    expect(kc.assignRealmRole).toHaveBeenCalledWith('kc-123', 'customer');
    expect(tx.identityUser.create).toHaveBeenCalled();
    expect(outbox.publishWithin).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'user.registered', aggregateId: 'kc-123' }),
    );
    expect(res).toEqual({ userId: 'u-1', keycloakId: 'kc-123' });
  });
});
