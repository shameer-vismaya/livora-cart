import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { DemoController } from './demo/demo.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { EventConsumer } from './consumer/event.consumer';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, DemoController, MetricsController],
  providers: [PrismaService, OutboxService, EventConsumer],
})
export class AppModule {}
