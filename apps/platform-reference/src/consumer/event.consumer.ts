import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka, Producer } from 'kafkajs';
import { PrismaService } from '../prisma/prisma.service';
import { loadAppEnv } from '../config';

/**
 * Idempotent Kafka consumer for the demo outbox topic.
 *
 * Effectively-once: each event's id is recorded in `processed_events` in the
 * SAME transaction as applying the effect, so a duplicate delivery is a no-op.
 * After N failed attempts a message is routed to the DLQ instead of blocking the
 * partition. See ARCHITECTURE.md §2.
 */
@Injectable()
export class EventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumer.name);
  private readonly env = loadAppEnv();
  private readonly kafka = new Kafka({
    clientId: this.env.SERVICE_NAME,
    brokers: this.env.KAFKA_BROKERS.split(','),
  });
  private readonly consumer: Consumer = this.kafka.consumer({
    groupId: this.env.KAFKA_CONSUMER_GROUP,
  });
  private readonly producer: Producer = this.kafka.producer();
  private static readonly MAX_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.env.DEMO_TOPIC,
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString() ?? '{}';
        let attempts = Number(message.headers?.['x-attempts']?.toString() ?? '0');
        try {
          const event = JSON.parse(raw) as { eventId?: string; payload?: unknown };
          if (!event.eventId) throw new Error('event missing eventId');
          await this.applyOnce(event.eventId, event.payload);
        } catch (err) {
          attempts += 1;
          this.logger.warn(
            `apply failed (attempt ${attempts}): ${(err as Error).message}`,
          );
          if (attempts >= EventConsumer.MAX_ATTEMPTS) {
            await this.toDlq(raw, (err as Error).message);
          } else {
            // Re-publish to the same topic with an incremented attempt counter.
            await this.producer.send({
              topic: this.env.DEMO_TOPIC,
              messages: [
                { value: raw, headers: { 'x-attempts': String(attempts) } },
              ],
            });
          }
        }
      },
    });
    this.logger.log(`Consuming ${this.env.DEMO_TOPIC}`);
  }

  /** Apply the effect and record the event id in one transaction (dedup). */
  private async applyOnce(eventId: string, payload: unknown): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const already = await tx.processedEvent.findUnique({ where: { eventId } });
      if (already) {
        this.logger.debug(`duplicate event ${eventId} ignored`);
        return;
      }
      // ---- effect goes here (idempotent within the txn) ----
      this.logger.log(`applied event ${eventId} payload=${JSON.stringify(payload)}`);
      await tx.processedEvent.create({ data: { eventId } });
    });
  }

  private async toDlq(raw: string, reason: string): Promise<void> {
    await this.producer.send({
      topic: this.env.DEMO_DLQ_TOPIC,
      messages: [{ value: raw, headers: { 'x-dlq-reason': reason } }],
    });
    this.logger.error(`routed poison message to DLQ: ${reason}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}
