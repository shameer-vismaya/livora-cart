import { makeDomainEvent } from './events';
import { assertIdempotencyKey, isIdempotencyKey } from './idempotency';

describe('contracts', () => {
  it('makeDomainEvent sets occurredAt and preserves fields', () => {
    const evt = makeDomainEvent({
      eventId: 'order-1-v1',
      type: 'order.confirmed',
      aggregateType: 'order',
      aggregateId: 'order-1',
      payload: { total: 100 },
    });
    expect(evt.eventId).toBe('order-1-v1');
    expect(evt.aggregateId).toBe('order-1');
    expect(typeof evt.occurredAt).toBe('string');
    expect(evt.payload).toEqual({ total: 100 });
  });

  it('validates idempotency keys', () => {
    expect(isIdempotencyKey('abc12345')).toBe(true);
    expect(isIdempotencyKey('short')).toBe(false);
    expect(() => assertIdempotencyKey('bad key!')).toThrow();
    expect(assertIdempotencyKey('valid-key-1234')).toBe('valid-key-1234');
  });
});
