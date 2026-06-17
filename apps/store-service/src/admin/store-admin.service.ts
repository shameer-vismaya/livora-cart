import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeDomainEvent } from '@livora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { KeycloakAdminService } from '../keycloak/keycloak-admin.service';

@Injectable()
export class StoreAdminService {
  private readonly logger = new Logger(StoreAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly kc: KeycloakAdminService,
  ) {}

  listByStatus(status = 'pending') {
    return this.prisma.store.findMany({ where: { status }, orderBy: { createdAt: 'desc' } });
  }

  async approve(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.store.update({ where: { id: storeId }, data: { status: 'approved' } });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId: randomUUID(),
          type: 'store.approved',
          aggregateType: 'store',
          aggregateId: storeId,
          payload: { storeId, ownerKeycloakId: s.ownerKeycloakId },
        }),
      );
      return s;
    });

    // Grant the owner a `stores` claim covering this store (powers @StoreScope).
    await this.kc.addStoreToUser(updated.ownerKeycloakId, storeId);
    this.logger.log(`store ${storeId} approved; owner ${updated.ownerKeycloakId} scoped`);
    return updated;
  }

  async transition(storeId: string, status: 'rejected' | 'suspended', reason?: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.store.update({ where: { id: storeId }, data: { status } });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId: randomUUID(),
          type: `store.${status}`,
          aggregateType: 'store',
          aggregateId: storeId,
          payload: { storeId, ownerKeycloakId: s.ownerKeycloakId, reason: reason ?? null },
        }),
      );
      return s;
    });
  }
}
