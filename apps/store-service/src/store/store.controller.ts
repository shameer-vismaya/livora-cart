import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { StoreService } from './store.service';
import { ApplyStoreDto } from './dto';

@Controller('stores')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('store_owner', 'admin')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  @Post()
  @HttpCode(201)
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyStoreDto) {
    return this.stores.apply(user.sub, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthUser) {
    return this.stores.listMine(user.sub);
  }

  @Get('me/:id')
  getMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stores.getMine(user.sub, id);
  }
}
