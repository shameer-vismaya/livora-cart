import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { BrandService } from './brand.service';

class CreateBrandDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() logoUrl?: string;
}

@Controller('brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  list() {
    return this.brands.list();
  }

  @Post()
  @UseGuards(KeycloakJwtGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Put(':id')
  @UseGuards(KeycloakJwtGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: CreateBrandDto) {
    return this.brands.update(id, dto);
  }
}
