/**
 * Base shape for every domain event published via the transactional outbox.
 * See .planning/research/ARCHITECTURE.md §2 (Outbox + Idempotency).
 *
 * `eventId` is the deterministic dedup key consumers record in their inbox
 * (processed_events) table to achieve effectively-once processing.
 */
export interface DomainEvent<TPayload = unknown> {
  /** Globally unique, deterministic event id (aggregate id + version recommended). */
  eventId: string;
  /** Event type, e.g. "order.confirmed". */
  type: string;
  /** Bounded-context aggregate this event belongs to, e.g. "order". */
  aggregateType: string;
  /** Id of the aggregate instance. Used as the Kafka partition key for ordering. */
  aggregateId: string;
  /** ISO-8601 timestamp when the event occurred. */
  occurredAt: string;
  /** W3C trace context for end-to-end tracing across the Kafka boundary. */
  traceparent?: string;
  /** Event-specific payload. */
  payload: TPayload;
}

/** Helper to build a DomainEvent with required invariants set. */
export function makeDomainEvent<T>(
  params: Omit<DomainEvent<T>, 'occurredAt'> & { occurredAt?: string },
): DomainEvent<T> {
  return {
    ...params,
    occurredAt: params.occurredAt ?? new Date().toISOString(),
  };
}
