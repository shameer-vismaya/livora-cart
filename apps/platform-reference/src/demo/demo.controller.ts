import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assertIdempotencyKey, makeDomainEvent } from '@livora/contracts';
import { KeycloakJwtGuard } from '../auth/keycloak-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

/**
 * Protected demo endpoints (JWT required). `POST /demo/echo` proves the
 * transactional-outbox pattern + idempotency-key replay.
 */
@Controller('demo')
@UseGuards(KeycloakJwtGuard)
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Get('echo')
  echo() {
    return { ok: true, at: new Date().toISOString() };
  }

  @Post('echo')
  @HttpCode(202)
  async createEcho(
    @Body() body: { message?: string },
    @Headers('idempotency-key') idempotencyKeyRaw?: string,
  ) {
    if (!idempotencyKeyRaw) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const idempotencyKey = assertIdempotencyKey(idempotencyKeyRaw);
    const message = body?.message ?? 'hello';

    // Replay a stored response if this key was already processed.
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return existing.responseJson;
    }

    const eventId = randomUUID();
    const aggregateId = randomUUID();

    // Aggregate write + outbox event + idempotency record — ONE transaction.
    const response = await this.prisma.$transaction(async (tx) => {
      await tx.demoAggregate.create({ data: { id: aggregateId, message } });

      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId,
          type: 'demo.echoed',
          aggregateType: 'demo',
          aggregateId,
          payload: { message },
        }),
      );

      const resp = { eventId, aggregateId, accepted: true };
      await tx.idempotencyRecord.create({
        data: { key: idempotencyKey, responseJson: resp },
      });
      return resp;
    });

    return response;
  }
}
