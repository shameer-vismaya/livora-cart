import { AddressService } from './address.service';

describe('AddressService', () => {
  it('geocodes and persists a new address (default toggles others off)', async () => {
    const geocoder = { geocode: jest.fn().mockResolvedValue({ lat: 12.9, lon: 77.5 }) };
    const created = { id: 'a1', lat: 12.9, lon: 77.5 };
    const tx = {
      userAddress: {
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const prisma = {
      userProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const svc = new AddressService(prisma as never, geocoder as never);

    const res = await svc.create('kc1', {
      line1: '1 MG Rd',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      isDefault: true,
    });

    expect(geocoder.geocode).toHaveBeenCalled();
    expect(tx.userAddress.updateMany).toHaveBeenCalledWith({
      where: { profileId: 'p1' },
      data: { isDefault: false },
    });
    expect(tx.userAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ profileId: 'p1', lat: 12.9, lon: 77.5, isDefault: true }),
      }),
    );
    expect(res).toEqual(created);
  });
});
