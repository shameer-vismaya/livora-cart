import { Controller, Get, UseGuards } from '@nestjs/common';
import { KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { PrismaService } from '../prisma/prisma.service';

/** Admin-only endpoint — demonstrates + verifies RBAC live (admin 200 / others 403). */
@Controller('admin')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  listUsers() {
    return this.prisma.identityUser.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, keycloakId: true, email: true, phone: true, status: true, createdAt: true },
    });
  }
}
