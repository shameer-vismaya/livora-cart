import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PrefsInput {
  push?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  email?: boolean;
}

@Injectable()
export class PrefsService {
  constructor(private readonly prisma: PrismaService) {}

  private async profileId(keycloakId: string): Promise<string> {
    const p = await this.prisma.userProfile.findUnique({ where: { keycloakId } });
    if (!p) throw new NotFoundException('Profile not found');
    return p.id;
  }

  async get(keycloakId: string) {
    const profileId = await this.profileId(keycloakId);
    return this.prisma.notificationPref.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
  }

  async update(keycloakId: string, dto: PrefsInput) {
    const profileId = await this.profileId(keycloakId);
    return this.prisma.notificationPref.upsert({
      where: { profileId },
      create: { profileId, ...dto },
      update: { ...dto },
    });
  }
}
