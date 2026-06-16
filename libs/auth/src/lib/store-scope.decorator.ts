import { SetMetadata } from '@nestjs/common';

export const STORE_SCOPE_KEY = 'livora:storeScope';

export interface StoreScopeOptions {
  /** Route param holding the store id (default 'storeId'). */
  param?: string;
}

/** ABAC: restrict the route to the principal's store scope. Use with StoreScopeGuard. */
export const StoreScope = (options: StoreScopeOptions = {}) =>
  SetMetadata(STORE_SCOPE_KEY, { param: options.param ?? 'storeId' });
