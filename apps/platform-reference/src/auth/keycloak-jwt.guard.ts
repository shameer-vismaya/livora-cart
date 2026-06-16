import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import type { Request } from 'express';
import { JwksProvider } from './jwks.provider';
import { extractBearerToken, toAuthUser } from './auth.helpers';

/**
 * Validates a Keycloak-issued RS256 JWT against the realm JWKS, checks issuer +
 * audience, and attaches the principal to `req.user`. Applied to protected
 * routes; health endpoints stay public.
 */
@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  private readonly logger = new Logger(KeycloakJwtGuard.name);

  constructor(private readonly jwks: JwksProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req.headers['authorization']);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks.keySet, {
        issuer: this.jwks.issuer,
        audience: this.jwks.audiences,
      });
      (req as Request & { user?: unknown }).user = toAuthUser(payload);
      return true;
    } catch (err) {
      this.logger.warn(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
