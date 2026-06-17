import { ProductService } from './product.service';

// withTenant just runs the callback with the same mock acting as the tx client.
function prismaWith(model: Record<string, unknown>) {
  const base = { product: model } as Record<string, unknown>;
  return { ...base, withTenant: (_s: string, fn: (tx: unknown) => unknown) => fn(base) };
}

describe('ProductService tenant scoping', () => {
  it('get() only matches within the store (cross-store -> 404)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = prismaWith({ findFirst });
    const svc = new ProductService(prisma as never, { publishWithin: jest.fn() } as never);
    await expect(svc.get('storeB', 'p-of-A')).rejects.toThrow('Product not found');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-of-A', storeId: 'storeB' } }),
    );
  });

  it('list() always filters by storeId', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = prismaWith({ findMany });
    const svc = new ProductService(prisma as never, { publishWithin: jest.fn() } as never);
    await svc.list('storeA');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId: 'storeA' } }));
  });

  it('create rejects an invalid GST rate', async () => {
    const svc = new ProductService({} as never, { publishWithin: jest.fn() } as never);
    await expect(svc.create('s1', { title: 'x', gstRatePct: 7 })).rejects.toThrow(/gstRatePct/);
  });
});
