import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface KycInput {
  gstin?: string;
  pan?: string;
  bankAccount?: string;
  ifsc?: string;
}

function mask(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  private async profileId(keycloakId: string): Promise<string> {
    const p = await this.prisma.userProfile.findUnique({ where: { keycloakId } });
    if (!p) throw new NotFoundException('Profile not found');
    return p.id;
  }

  async upsert(keycloakId: string, dto: KycInput) {
    const profileId = await this.profileId(keycloakId);
    const rec = await this.prisma.kycReference.upsert({
      where: { profileId },
      create: { profileId, ...dto, status: 'pending' },
      update: { ...dto },
    });
    return this.toResponse(rec);
  }

  async get(keycloakId: string) {
    const profileId = await this.profileId(keycloakId);
    const rec = await this.prisma.kycReference.findUnique({ where: { profileId } });
    if (!rec) throw new NotFoundException('KYC not found');
    return this.toResponse(rec);
  }

  private toResponse(rec: {
    gstin: string | null;
    pan: string | null;
    bankAccount: string | null;
    ifsc: string | null;
    status: string;
  }) {
    return {
      gstin: rec.gstin,
      pan: mask(rec.pan),
      bankAccount: mask(rec.bankAccount),
      ifsc: rec.ifsc,
      status: rec.status,
    };
  }
}
