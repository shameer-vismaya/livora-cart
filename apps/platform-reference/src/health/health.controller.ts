import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness/readiness probes. Public (no JWT) so Kong/Docker/K8s can probe them.
 * - /health/live  : process is up (cheap)
 * - /health/ready : dependencies reachable (DB)
 * - /health       : aggregate
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        message: (err as Error).message,
      });
    }
  }

  @Get()
  async health() {
    return this.ready();
  }
}
