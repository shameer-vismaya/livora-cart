import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { Msg91Client } from './msg91.client';

/** Minimal Redis surface so the service is unit-testable with a fake. */
export interface OtpStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export const OTP_STORE = 'OTP_STORE';

interface OtpRecord {
  hash: string;
  attempts: number;
}

const TTL_SECONDS = 300; // 5 min
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    @Inject(OTP_STORE) private readonly store: OtpStore,
    private readonly msg91: Msg91Client,
  ) {}

  private key(phone: string): string {
    return `otp:${phone}`;
  }

  private hash(phone: string, code: string): string {
    return createHash('sha256').update(`${phone}:${code}`).digest('hex');
  }

  async requestOtp(phone: string): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const record: OtpRecord = { hash: this.hash(phone, code), attempts: 0 };
    await this.store.set(this.key(phone), JSON.stringify(record), 'EX', TTL_SECONDS);
    await this.msg91.sendOtp(phone, code);
  }

  /** Returns the verified phone on success; throws on invalid/expired/too-many. */
  async verifyOtp(phone: string, code: string): Promise<string> {
    const raw = await this.store.get(this.key(phone));
    if (!raw) throw new BadRequestException('OTP expired or not requested');
    const record = JSON.parse(raw) as OtpRecord;

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.store.del(this.key(phone));
      throw new HttpException('Too many attempts; request a new OTP', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (this.hash(phone, code) !== record.hash) {
      record.attempts += 1;
      await this.store.set(this.key(phone), JSON.stringify(record), 'EX', TTL_SECONDS);
      throw new BadRequestException('Invalid OTP');
    }

    await this.store.del(this.key(phone));
    return phone;
  }
}
