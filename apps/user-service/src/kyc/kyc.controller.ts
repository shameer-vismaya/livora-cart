import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AuthUser, CurrentUser, KeycloakJwtGuard, Roles, RolesGuard } from '@livora/auth';
import { KycService } from './kyc.service';

class KycDto {
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'invalid GSTIN',
  })
  gstin?: string;

  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'invalid PAN' })
  pan?: string;

  @IsOptional() @IsString() bankAccount?: string;

  @IsOptional()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'invalid IFSC' })
  ifsc?: string;
}

@Controller('kyc')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('store_owner')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('me')
  get(@CurrentUser() user: AuthUser) {
    return this.kyc.get(user.sub);
  }

  @Put('me')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: KycDto) {
    return this.kyc.upsert(user.sub, dto);
  }
}
