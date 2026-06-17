import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { StoreController } from './store/store.controller';
import { StoreProfileController } from './store/store-profile.controller';
import { StoreService } from './store/store.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { StoreAdminController } from './admin/store-admin.controller';
import { StoreAdminService } from './admin/store-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [
    HealthController,
    MetricsController,
    StoreController,
    StoreProfileController,
    StoreAdminController,
  ],
  providers: [PrismaService, OutboxService, StoreService, KeycloakAdminService, StoreAdminService],
})
export class AppModule {}
