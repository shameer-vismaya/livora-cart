import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeDomainEvent } from '@livora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { KeycloakAdminService } from '../keycloak/keycloak-admin.service';
import { RegisterEmailDto } from './dto';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);
  // Read only what we need (no full env validation in the constructor, so unit
  // tests can `new` this without a complete environment).
  private readonly defaultRole = process.env.DEFAULT_CUSTOMER_ROLE ?? 'customer';

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly kc: KeycloakAdminService,
  ) {}

  async registerEmail(dto: RegisterEmailDto): Promise<{ userId: string; keycloakId: string }> {
    // Create the Keycloak user (throws ConflictException on duplicate) + role.
    const keycloakId = await this.kc.createUser({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      // Dev: mark verified so direct-grant login works immediately. PROD TODO:
      // send a real verification email and flip this to false.
      emailVerified: true,
    });
    await this.kc.assignRealmRole(keycloakId, this.defaultRole);

    // Persist local mirror + emit UserRegistered in one transaction.
    const eventId = randomUUID();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.identityUser.create({
        data: { keycloakId, email: dto.email, status: 'active' },
      });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId,
          type: 'user.registered',
          aggregateType: 'user',
          aggregateId: keycloakId,
          payload: { keycloakId, email: dto.email, phone: null },
        }),
      );
      return user;
    });

    this.logger.log(`registered ${dto.email} (kc=${keycloakId})`);
    return { userId: result.id, keycloakId };
  }
}
