import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DomainEvent } from '@livora/contracts';

/**
 * Writes domain events to the transactional outbox WITHIN an existing Prisma
 * transaction, so the aggregate change and the event are atomic (no dual-write).
 * Debezium streams the outbox table to Kafka. See ARCHITECTURE.md §2.
 */
@Injectable()
export class OutboxService {
  /**
   * @param tx   an active Prisma transaction client
   * @param event the domain event to enqueue
   */
  async publishWithin<T>(
    tx: Prisma.TransactionClient,
    event: DomainEvent<T>,
  ): Promise<void> {
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
