import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { CategoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';
import { BrandController } from './brand/brand.controller';
import { BrandService } from './brand/brand.service';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, MetricsController, CategoryController, BrandController],
  providers: [PrismaService, OutboxService, CategoryService, BrandService],
})
export class AppModule {}
