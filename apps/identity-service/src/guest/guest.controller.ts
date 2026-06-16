import { Controller, HttpCode, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { KeycloakAdminService } from '../keycloak/keycloak-admin.service';
import { TokenService } from '../token/token.service';

/**
 * Guest checkout: provisions an ephemeral guest user and returns a short-lived
 * token so an unauthenticated visitor can complete a guest order.
 */
@Controller('auth/guest')
export class GuestController {
  constructor(
    private readonly kc: KeycloakAdminService,
    private readonly tokens: TokenService,
  ) {}

  @Post()
  @HttpCode(200)
  async guest() {
    const guestId = `guest_${randomUUID()}`;
    const userId = await this.kc.createUser({
      email: `${guestId}@guest.livora.local`,
      firstName: 'Guest',
      emailVerified: false,
    });
    await this.kc.assignRealmRole(userId, 'customer');
    const token = await this.tokens.exchangeForUser(userId);
    return { guest: true, ...token };
  }
}
