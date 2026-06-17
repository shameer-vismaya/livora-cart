import { StoreAdminService } from './store-admin.service';

describe('StoreAdminService', () => {
  it('approve sets approved, emits store.approved, and scopes the owner', async () => {
    const tx = { store: { update: jest.fn().mockResolvedValue({ id: 's1', ownerKeycloakId: 'owner-1' }) } };
    const prisma = {
      store: { findUnique: jest.fn().mockResolvedValue({ id: 's1', ownerKeycloakId: 'owner-1' }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const outbox = { publishWithin: jest.fn().mockResolvedValue(undefined) };
    const kc = { addStoreToUser: jest.fn().mockResolvedValue(undefined) };
    const svc = new StoreAdminService(prisma as never, outbox as never, kc as never);

    await svc.approve('s1');

    expect(tx.store.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'approved' } });
    expect(outbox.publishWithin).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'store.approved', aggregateId: 's1' }),
    );
    expect(kc.addStoreToUser).toHaveBeenCalledWith('owner-1', 's1');
  });

  it('approve 404s for unknown store', async () => {
    const prisma = { store: { findUnique: jest.fn().mockResolvedValue(null) } };
    const svc = new StoreAdminService(prisma as never, {} as never, {} as never);
    await expect(svc.approve('nope')).rejects.toThrow('Store not found');
  });
});
