import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'livora:roles';

/** Require at least one of the given realm roles. Use with RolesGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
