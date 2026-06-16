import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser, KeycloakJwtGuard } from '@livora/auth';
import { PrefsService } from './prefs.service';

class PrefsDto {
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
}

@Controller('prefs')
@UseGuards(KeycloakJwtGuard)
export class PrefsController {
  constructor(private readonly prefs: PrefsService) {}

  @Get('me')
  get(@CurrentUser() user: AuthUser) {
    return this.prefs.get(user.sub);
  }

  @Put('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: PrefsDto) {
    return this.prefs.update(user.sub, dto);
  }
}
