import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert a profile from an inbound UserRegistered event (idempotent caller). */
  async upsertFromEvent(input: {
    keycloakId: string;
    email?: string | null;
    phone?: string | null;
  }): Promise<void> {
    await this.prisma.userProfile.upsert({
      where: { keycloakId: input.keycloakId },
      create: {
        keycloakId: input.keycloakId,
        email: input.email ?? null,
        phone: input.phone ?? null,
      },
      update: { email: input.email ?? undefined, phone: input.phone ?? undefined },
    });
  }

  async getByKeycloakId(keycloakId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { keycloakId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateByKeycloakId(keycloakId: string, input: UpdateProfileInput) {
    await this.getByKeycloakId(keycloakId); // 404 if missing
    return this.prisma.userProfile.update({
      where: { keycloakId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
    });
  }
}
