import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { AuthUser, CurrentUser, KeycloakJwtGuard } from '@livora/auth';
import { AddressService } from './address.service';

class AddressDto {
  @IsOptional() @IsString() label?: string;
  @IsString() line1!: string;
  @IsOptional() @IsString() line2?: string;
  @IsString() city!: string;
  @IsString() state!: string;
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a 6-digit Indian PIN' })
  pincode!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

@Controller('address')
@UseGuards(KeycloakJwtGuard)
export class AddressController {
  constructor(private readonly addresses: AddressService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.addresses.create(user.sub, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddressDto) {
    return this.addresses.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.remove(user.sub, id);
  }
}
