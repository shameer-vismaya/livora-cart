import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { OtpService } from './otp.service';
import { TokenService } from '../token/token.service';

class OtpRequestDto {
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'phone must be 10-15 digits' })
  phone!: string;
}

class OtpVerifyDto {
  @IsString()
  @Matches(/^[0-9]{10,15}$/)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  @Post('request')
  @HttpCode(202)
  async request(@Body() dto: OtpRequestDto) {
    await this.otp.requestOtp(dto.phone);
    return { sent: true };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: OtpVerifyDto) {
    const phone = await this.otp.verifyOtp(dto.phone, dto.code);
    return this.tokens.issueForVerifiedPhone(phone);
  }
}
