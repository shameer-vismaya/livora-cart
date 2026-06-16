import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { RegistrationController } from './registration/registration.controller';
import { RegistrationService } from './registration/registration.service';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, MetricsController, RegistrationController],
  providers: [PrismaService, OutboxService, KeycloakAdminService, RegistrationService],
})
export class AppModule {}
