import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { DemoController } from './demo/demo.controller';
import { OutboxService } from './outbox/outbox.service';
import { JwksProvider } from './auth/jwks.provider';
import { KeycloakJwtGuard } from './auth/keycloak-jwt.guard';
import { EventConsumer } from './consumer/event.consumer';

@Module({
  controllers: [HealthController, DemoController],
  providers: [
    PrismaService,
    OutboxService,
    JwksProvider,
    KeycloakJwtGuard,
    EventConsumer,
  ],
})
export class AppModule {}
