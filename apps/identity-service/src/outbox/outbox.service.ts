import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { DomainEvent } from '@livora/contracts';

@Injectable()
export class OutboxService {
  async publishWithin<T>(tx: Prisma.TransactionClient, event: DomainEvent<T>): Promise<void> {
    await tx.outbox.create({
      data: {
        id: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        traceparent: event.traceparent ?? null,
      },
    });
  }
}
