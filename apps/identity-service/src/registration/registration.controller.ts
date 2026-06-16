import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegisterEmailDto } from './dto';

@Controller('auth')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterEmailDto) {
    return this.registration.registerEmail(dto);
  }
}
