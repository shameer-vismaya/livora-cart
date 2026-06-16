import { Module } from '@nestjs/common';
import { AuthModule } from '@livora/auth';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { ProfileController } from './profile/profile.controller';
import { ProfileService } from './profile/profile.service';
import { UserRegisteredConsumer } from './consumer/user-registered.consumer';
import { AddressController } from './address/address.controller';
import { AddressService } from './address/address.service';
import { GEOCODING_PROVIDER } from './geocoding/geocoding.provider';
import { GoogleGeocodingProvider } from './geocoding/google-geocoding.provider';
import { KycController } from './kyc/kyc.controller';
import { KycService } from './kyc/kyc.service';
import { PrefsController } from './prefs/prefs.controller';
import { PrefsService } from './prefs/prefs.service';

@Module({
  imports: [AuthModule],
  controllers: [
    HealthController,
    MetricsController,
    ProfileController,
    AddressController,
    KycController,
    PrefsController,
  ],
  providers: [
    PrismaService,
    ProfileService,
    UserRegisteredConsumer,
    AddressService,
    KycService,
    PrefsService,
    { provide: GEOCODING_PROVIDER, useClass: GoogleGeocodingProvider },
  ],
})
export class AppModule {}
