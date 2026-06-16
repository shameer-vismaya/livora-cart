/**
 * Idempotency key supplied by clients on write APIs so retries do not
 * double-apply (double charge / double order). See ARCHITECTURE.md §2.
 */
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isIdempotencyKey(value: string): value is IdempotencyKey {
  return IDEMPOTENCY_KEY_RE.test(value);
}

export function assertIdempotencyKey(value: string): IdempotencyKey {
  if (!isIdempotencyKey(value)) {
    throw new Error(
      `Invalid Idempotency-Key: must match ${IDEMPOTENCY_KEY_RE} (8-128 url-safe chars)`,
    );
  }
  return value;
}
