import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { loadAppEnv } from '../config';

/**
 * Consumes UserRegistered (from identity-service via Debezium → Kafka) and
 * creates the user profile, idempotently (eventId from a Kafka header recorded
 * in processed_events within the same transaction → effectively-once).
 */
@Injectable()
export class UserRegisteredConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserRegisteredConsumer.name);
  private readonly env = loadAppEnv();
  private readonly kafka = new Kafka({
    clientId: this.env.SERVICE_NAME,
    brokers: this.env.KAFKA_BROKERS.split(','),
  });
  private readonly consumer: Consumer = this.kafka.consumer({
    groupId: this.env.KAFKA_CONSUMER_GROUP,
    allowAutoTopicCreation: true,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
  ) {}

  async onModuleInit(): Promise<void> {
    const admin = this.kafka.admin();
    try {
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
        topics: [{ topic: this.env.USER_REGISTERED_TOPIC, numPartitions: 1 }],
      });
    } catch (err) {
      this.logger.warn(`topic pre-create skipped: ${(err as Error).message}`);
    } finally {
      await admin.disconnect().catch(() => undefined);
    }

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.env.USER_REGISTERED_TOPIC, fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const eventId = message.headers?.['eventId']?.toString();
        if (!eventId) {
          this.logger.warn('message missing eventId header; skipping');
          return;
        }
        try {
          const payload = JSON.parse(message.value?.toString() ?? '{}') as {
            keycloakId?: string;
            email?: string | null;
            phone?: string | null;
          };
          if (!payload.keycloakId) throw new Error('payload missing keycloakId');
          await this.applyOnce(eventId, payload);
        } catch (err) {
          this.logger.error(`failed to apply ${eventId}: ${(err as Error).message}`);
        }
      },
    });
    this.logger.log(`Consuming ${this.env.USER_REGISTERED_TOPIC}`);
  }

  private async applyOnce(
    eventId: string,
    payload: { keycloakId?: string; email?: string | null; phone?: string | null },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const seen = await tx.processedEvent.findUnique({ where: { eventId } });
      if (seen) {
        this.logger.debug(`duplicate ${eventId} ignored`);
        return;
      }
      await tx.userProfile.upsert({
        where: { keycloakId: payload.keycloakId as string },
        create: {
          keycloakId: payload.keycloakId as string,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
        },
        update: { email: payload.email ?? undefined, phone: payload.phone ?? undefined },
      });
      await tx.processedEvent.create({ data: { eventId } });
      this.logger.log(`profile upserted for ${payload.keycloakId} (event ${eventId})`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
