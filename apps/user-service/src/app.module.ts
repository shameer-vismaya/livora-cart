import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { ProfileController } from './profile/profile.controller';
import { ProfileService } from './profile/profile.service';
import { UserRegisteredConsumer } from './consumer/user-registered.consumer';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, MetricsController, ProfileController],
  providers: [PrismaService, ProfileService, UserRegisteredConsumer],
})
export class AppModule {}
