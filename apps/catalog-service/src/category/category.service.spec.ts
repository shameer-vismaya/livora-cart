import { CategoryService } from './category.service';

describe('CategoryService', () => {
  it('creates a root category with a materialized path', async () => {
    const prisma = { category: { create: jest.fn().mockImplementation(({ data }) => ({ id: 'c1', ...data })) } };
    const svc = new CategoryService(prisma as never);
    const c = await svc.create({ name: 'Grocery' });
    expect(c.slug).toBe('grocery');
    expect(c.path).toBe('/grocery');
  });

  it('nests under a parent path', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', path: '/grocery' }),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'c2', ...data })),
      },
    };
    const svc = new CategoryService(prisma as never);
    const c = await svc.create({ name: 'Snacks', parentId: 'p1' });
    expect(c.path).toBe('/grocery/snacks');
  });
});
