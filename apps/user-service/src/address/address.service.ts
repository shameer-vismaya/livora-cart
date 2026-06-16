import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GEOCODING_PROVIDER, GeocodingProvider } from '../geocoding/geocoding.provider';

export interface AddressDtoInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
  ) {}

  private async profileId(keycloakId: string): Promise<string> {
    const p = await this.prisma.userProfile.findUnique({ where: { keycloakId } });
    if (!p) throw new NotFoundException('Profile not found');
    return p.id;
  }

  async list(keycloakId: string) {
    return this.prisma.userAddress.findMany({ where: { profileId: await this.profileId(keycloakId) } });
  }

  async create(keycloakId: string, dto: AddressDtoInput) {
    const profileId = await this.profileId(keycloakId);
    const { lat, lon } = await this.geocoder.geocode(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({ where: { profileId }, data: { isDefault: false } });
      }
      return tx.userAddress.create({
        data: {
          profileId,
          label: dto.label,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country ?? 'IN',
          lat,
          lon,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(keycloakId: string, id: string, dto: AddressDtoInput) {
    const profileId = await this.profileId(keycloakId);
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.profileId !== profileId) throw new ForbiddenException('Not your address');
    const { lat, lon } = await this.geocoder.geocode(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({ where: { profileId }, data: { isDefault: false } });
      }
      return tx.userAddress.update({
        where: { id },
        data: { ...dto, country: dto.country ?? 'IN', lat, lon },
      });
    });
  }

  async remove(keycloakId: string, id: string) {
    const profileId = await this.profileId(keycloakId);
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.profileId !== profileId) throw new ForbiddenException('Not your address');
    await this.prisma.userAddress.delete({ where: { id } });
    return { deleted: true };
  }
}
