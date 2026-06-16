import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  it('returns the profile for a keycloakId', async () => {
    const prisma = {
      userProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', keycloakId: 'kc1' }) },
    };
    const svc = new ProfileService(prisma as never);
    await expect(svc.getByKeycloakId('kc1')).resolves.toEqual({ id: 'p1', keycloakId: 'kc1' });
  });

  it('404s when profile missing', async () => {
    const prisma = { userProfile: { findUnique: jest.fn().mockResolvedValue(null) } };
    const svc = new ProfileService(prisma as never);
    await expect(svc.getByKeycloakId('nope')).rejects.toThrow(NotFoundException);
  });

  it('upserts from an event', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const svc = new ProfileService({ userProfile: { upsert } } as never);
    await svc.upsertFromEvent({ keycloakId: 'kc1', email: 'a@b.c', phone: null });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keycloakId: 'kc1' } }),
    );
  });
});
