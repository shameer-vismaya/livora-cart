import { Injectable, Logger } from '@nestjs/common';
import { loadAppEnv } from '../config';

/**
 * MSG91 OTP sender (India, DLT-compliant). In non-production, or when no auth key
 * is configured, the code is logged instead of sent so dev/host-without-keys works.
 */
@Injectable()
export class Msg91Client {
  private readonly logger = new Logger(Msg91Client.name);
  private readonly env = loadAppEnv();

  async sendOtp(phone: string, code: string): Promise<void> {
    if (this.env.NODE_ENV !== 'production' || !this.env.MSG91_AUTH_KEY) {
      this.logger.warn(`[DEV] OTP for ${phone} = ${code} (MSG91 not invoked)`);
      return;
    }
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', this.env.MSG91_OTP_TEMPLATE_ID ?? '');
    url.searchParams.set('mobile', phone);
    url.searchParams.set('otp', code);
    if (this.env.MSG91_SENDER_ID) url.searchParams.set('sender', this.env.MSG91_SENDER_ID);
    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey: this.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`MSG91 send failed: ${res.status} ${await res.text()}`);
    }
  }
}
