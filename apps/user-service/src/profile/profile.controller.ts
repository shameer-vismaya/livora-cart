import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser, KeycloakJwtGuard } from '@livora/auth';
import { ProfileService } from './profile.service';

class UpdateProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
}

@Controller('profile')
@UseGuards(KeycloakJwtGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.profiles.getByKeycloakId(user.sub);
  }

  @Put('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateByKeycloakId(user.sub, dto);
  }
}
