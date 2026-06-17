import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { StoreAdminService } from './store-admin.service';

class ReasonDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller('admin/stores')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('admin')
export class StoreAdminController {
  constructor(private readonly admin: StoreAdminService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.admin.listByStatus(status ?? 'pending');
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.admin.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.admin.transition(id, 'rejected', dto.reason);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.admin.transition(id, 'suspended', dto.reason);
  }
}
