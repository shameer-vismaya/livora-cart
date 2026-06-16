import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { RegistrationController } from './registration/registration.controller';
import { RegistrationService } from './registration/registration.service';
import { OtpController } from './otp/otp.controller';
import { OtpService } from './otp/otp.service';
import { Msg91Client } from './otp/msg91.client';
import { OtpRedisProvider } from './otp/redis.provider';
import { TokenService } from './token/token.service';
import { GuestController } from './guest/guest.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    HealthController,
    MetricsController,
    RegistrationController,
    OtpController,
    GuestController,
  ],
  providers: [
    PrismaService,
    OutboxService,
    KeycloakAdminService,
    RegistrationService,
    OtpService,
    Msg91Client,
    OtpRedisProvider,
    TokenService,
  ],
})
export class AppModule {}
