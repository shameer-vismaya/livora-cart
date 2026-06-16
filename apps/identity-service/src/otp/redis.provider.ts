import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { OTP_STORE } from './otp.service';
import { loadAppEnv } from '../config';

/** Provides an ioredis client as the OTP store. */
export const OtpRedisProvider: Provider = {
  provide: OTP_STORE,
  useFactory: () => new Redis(loadAppEnv().REDIS_URL),
};
