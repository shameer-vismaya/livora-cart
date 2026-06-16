import { Module } from '@nestjs/common';
import { JwksProvider } from './jwks.provider';
import { KeycloakJwtGuard } from './keycloak-jwt.guard';
import { RolesGuard } from './roles.guard';
import { StoreScopeGuard } from './store-scope.guard';

/** Import into a service's AppModule to use the Livora auth guards. */
@Module({
  providers: [JwksProvider, KeycloakJwtGuard, RolesGuard, StoreScopeGuard],
  exports: [JwksProvider, KeycloakJwtGuard, RolesGuard, StoreScopeGuard],
})
export class AuthModule {}
