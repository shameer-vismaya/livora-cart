import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { CategoryService } from './category.service';

class CreateCategoryDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

@Controller('categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @UseGuards(KeycloakJwtGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Put(':id')
  @UseGuards(KeycloakJwtGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(KeycloakJwtGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.categories.deactivate(id);
  }
}
