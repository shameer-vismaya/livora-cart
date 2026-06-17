import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { StoreController } from './store/store.controller';
import { StoreService } from './store/store.service';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, MetricsController, StoreController],
  providers: [PrismaService, OutboxService, StoreService],
})
export class AppModule {}
