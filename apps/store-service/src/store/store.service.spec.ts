import { StoreService } from './store.service';

describe('StoreService', () => {
  it('apply creates a pending store and emits store.submitted', async () => {
    const tx = { store: { create: jest.fn().mockResolvedValue({ id: 's1', slug: 'shop-abc123' }) } };
    const prisma = { $transaction: jest.fn().mockImplementation((fn) => fn(tx)) };
    const outbox = { publishWithin: jest.fn().mockResolvedValue(undefined) };
    const svc = new StoreService(prisma as never, outbox as never);

    const res = await svc.apply('owner-1', { name: 'My Shop' });

    expect(tx.store.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerKeycloakId: 'owner-1', status: 'pending' }) }),
    );
    expect(outbox.publishWithin).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'store.submitted', aggregateId: 's1' }),
    );
    expect(res).toEqual({ id: 's1', slug: 'shop-abc123' });
  });

  it('getMine 404s for a store the user does not own', async () => {
    const prisma = { store: { findUnique: jest.fn().mockResolvedValue({ id: 's1', ownerKeycloakId: 'other' }) } };
    const svc = new StoreService(prisma as never, {} as never);
    await expect(svc.getMine('owner-1', 's1')).rejects.toThrow('Store not found');
  });
});
