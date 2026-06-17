import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { ProductModerationService } from './product-moderation.service';

class ReasonDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller('admin/products')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('admin')
export class ProductModerationController {
  constructor(private readonly moderation: ProductModerationService) {}

  @Get()
  list() {
    return this.moderation.listForReview();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.moderation.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.moderation.reject(id, dto.reason);
  }
}
