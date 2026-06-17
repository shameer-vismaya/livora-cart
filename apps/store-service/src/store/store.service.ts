import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeDomainEvent } from '@livora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { ApplyStoreDto } from './dto';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async apply(ownerKeycloakId: string, dto: ApplyStoreDto) {
    const base = slugify(dto.name) || 'store';
    const slug = `${base}-${randomUUID().slice(0, 6)}`;
    const eventId = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ownerKeycloakId,
          name: dto.name,
          slug,
          description: dto.description,
          gstin: dto.gstin,
          status: 'pending',
        },
      });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId,
          type: 'store.submitted',
          aggregateType: 'store',
          aggregateId: store.id,
          payload: { storeId: store.id, ownerKeycloakId, name: store.name },
        }),
      );
      this.logger.log(`store application ${store.id} (${slug}) by ${ownerKeycloakId}`);
      return store;
    });
  }

  listMine(ownerKeycloakId: string) {
    return this.prisma.store.findMany({ where: { ownerKeycloakId } });
  }

  async getMine(ownerKeycloakId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerKeycloakId !== ownerKeycloakId) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}
