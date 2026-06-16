import { OtpService, OtpStore } from './otp.service';

class FakeStore implements OtpStore {
  private map = new Map<string, string>();
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.map.set(k, v);
    return 'OK';
  }
  async del(k: string) {
    this.map.delete(k);
    return 1;
  }
}

describe('OtpService', () => {
  let store: FakeStore;
  let sent: { phone: string; code: string } | null;
  let svc: OtpService;

  beforeEach(() => {
    store = new FakeStore();
    sent = null;
    const msg91 = { sendOtp: async (phone: string, code: string) => { sent = { phone, code }; } };
    svc = new OtpService(store, msg91 as never);
  });

  it('verifies a correct OTP and consumes it', async () => {
    await svc.requestOtp('919999999999');
    expect(sent).not.toBeNull();
    const phone = await svc.verifyOtp('919999999999', sent!.code);
    expect(phone).toBe('919999999999');
    // consumed: a second verify with the same code now fails (expired/not requested)
    await expect(svc.verifyOtp('919999999999', sent!.code)).rejects.toThrow();
  });

  it('rejects a wrong OTP', async () => {
    await svc.requestOtp('919999999999');
    const wrong = sent!.code === '000000' ? '111111' : '000000';
    await expect(svc.verifyOtp('919999999999', wrong)).rejects.toThrow('Invalid OTP');
  });

  it('rejects when no OTP was requested', async () => {
    await expect(svc.verifyOtp('910000000000', '123456')).rejects.toThrow(
      'OTP expired or not requested',
    );
  });

  it('locks out after too many attempts', async () => {
    await svc.requestOtp('919999999999');
    const wrong = sent!.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(svc.verifyOtp('919999999999', wrong)).rejects.toThrow();
    }
    await expect(svc.verifyOtp('919999999999', wrong)).rejects.toThrow(/Too many attempts/);
  });
});
