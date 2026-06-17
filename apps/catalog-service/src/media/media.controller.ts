import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IsString } from 'class-validator';
import {
  AuthUser,
  CurrentUser,
  KeycloakJwtGuard,
  Roles,
  RolesGuard,
  StoreScope,
  StoreScopeGuard,
} from '@livora/auth';
import { S3Service } from './s3.service';
import { ProductService } from '../product/product.service';
import { resolveStoreId } from '../tenant/tenant.util';

class PresignDto {
  @IsString() contentType!: string;
}

@Controller('stores/:storeId/products/:productId/media')
@UseGuards(KeycloakJwtGuard, RolesGuard, StoreScopeGuard)
@Roles('store_owner', 'store_staff', 'admin')
@StoreScope({ param: 'storeId' })
export class MediaController {
  constructor(
    private readonly s3: S3Service,
    private readonly products: ProductService,
  ) {}

  @Post('presign')
  async presign(
    @CurrentUser() user: AuthUser,
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: PresignDto,
  ) {
    const sid = resolveStoreId(user, storeId);
    await this.products.get(sid, productId); // ownership / 404
    const ext = dto.contentType.split('/')[1] ?? 'bin';
    const key = `products/${sid}/${productId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.s3.presignPut(key, dto.contentType);
    await this.products.addImage(sid, productId, this.s3.publicUrl(key));
    return { uploadUrl, key, publicUrl: this.s3.publicUrl(key) };
  }
}
