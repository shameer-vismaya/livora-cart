import { ProductService } from './product.service';

describe('ProductService tenant scoping', () => {
  it('get() only matches within the store (cross-store -> 404)', async () => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new ProductService(prisma as never, { publishWithin: jest.fn() } as never);
    await expect(svc.get('storeB', 'p-of-A')).rejects.toThrow('Product not found');
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-of-A', storeId: 'storeB' } }),
    );
  });

  it('list() always filters by storeId', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]) } };
    const svc = new ProductService(prisma as never, { publishWithin: jest.fn() } as never);
    await svc.list('storeA');
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'storeA' } }),
    );
  });

  it('create rejects an invalid GST rate', async () => {
    const svc = new ProductService({} as never, { publishWithin: jest.fn() } as never);
    await expect(svc.create('s1', { title: 'x', gstRatePct: 7 })).rejects.toThrow(/gstRatePct/);
  });
});
