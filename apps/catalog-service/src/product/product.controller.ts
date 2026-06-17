import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import {
  AuthUser,
  CurrentUser,
  KeycloakJwtGuard,
  Roles,
  RolesGuard,
  StoreScope,
  StoreScopeGuard,
} from '@livora/auth';
import { ProductService } from './product.service';
import { resolveStoreId } from '../tenant/tenant.util';

class CreateProductDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() hsnCode?: string;
  @IsOptional() @IsInt() gstRatePct?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
}
class VariantDto {
  @IsString() sku!: string;
  @IsInt() mrpPaise!: number;
  @IsInt() pricePaise!: number;
}

@Controller('stores/:storeId/products')
@UseGuards(KeycloakJwtGuard, RolesGuard, StoreScopeGuard)
@Roles('store_owner', 'store_staff', 'admin')
@StoreScope({ param: 'storeId' })
export class ProductController {
  constructor(private readonly products: ProductService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string) {
    return this.products.list(resolveStoreId(user, storeId));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string, @Param('id') id: string) {
    return this.products.get(resolveStoreId(user, storeId), id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string, @Body() dto: CreateProductDto) {
    return this.products.create(resolveStoreId(user, storeId), dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.update(resolveStoreId(user, storeId), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string, @Param('id') id: string) {
    return this.products.remove(resolveStoreId(user, storeId), id);
  }

  @Post(':id/variants')
  addVariant(
    @CurrentUser() user: AuthUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() dto: VariantDto,
  ) {
    return this.products.addVariant(resolveStoreId(user, storeId), id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string, @Param('id') id: string) {
    return this.products.submitForReview(resolveStoreId(user, storeId), id);
  }
}
