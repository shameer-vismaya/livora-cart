import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { StoreService } from './store.service';

class ProfileDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
}
class HoursItem {
  @IsInt() @Min(0) @Max(6) day!: number;
  @IsString() openTime!: string;
  @IsString() closeTime!: string;
  @IsOptional() closed?: boolean;
}
class HoursDto {
  @IsArray() hours!: HoursItem[];
}
class ZoneItem {
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsNumber() radiusKm?: number;
  @IsOptional() @IsNumber() centerLat?: number;
  @IsOptional() @IsNumber() centerLon?: number;
}
class ZonesDto {
  @IsArray() zones!: ZoneItem[];
}

@Controller('stores')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('store_owner', 'admin')
export class StoreProfileController {
  constructor(private readonly stores: StoreService) {}

  @Put(':id/profile')
  profile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProfileDto) {
    return this.stores.updateProfile(user.sub, id, dto);
  }

  @Put(':id/hours')
  hours(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HoursDto) {
    return this.stores.setHours(user.sub, id, dto.hours);
  }

  @Put(':id/zones')
  zones(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ZonesDto) {
    return this.stores.setDeliveryZones(user.sub, id, dto.zones);
  }
}
