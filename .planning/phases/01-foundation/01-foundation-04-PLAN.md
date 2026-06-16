---
phase: 01-foundation
plan: 04
type: execute
wave: 3
depends_on: [01, 02, 03]
autonomous: true
files_modified:
  - infra/observability/otel-collector-config.yaml
  - infra/observability/prometheus.yml
  - infra/observability/tempo.yaml
  - infra/observability/grafana/datasources.yaml
  - infra/observability/grafana/dashboards/platform-overview.json
  - docker-compose.yml
  - libs/observability/src/index.ts
  - libs/observability/src/telemetry.ts
must_haves:
  truths:
    - "A request through Kong to the reference service produces ONE end-to-end trace in Grafana/Tempo"
    - "Service metrics (HTTP, Kafka consumer) are scraped by Prometheus and visible in Grafana"
  artifacts:
    - "OTel Collector + Prometheus + Tempo + Grafana in Compose"
    - "@livora/observability createTelemetry() wiring the OTel NodeSDK"
    - "Grafana provisioned datasources + a starter dashboard"
  key_links:
    - "service OTLP export -> OTel Collector -> Tempo (traces) + Prometheus (metrics)"
    - "trace context propagation Kong -> service -> Kafka headers (single trace)"
    - "Grafana datasource provisioning -> dashboards render without manual setup"
---

<objective>
Add a lightweight, local observability baseline so every service emits traces and metrics from day one. Intentionally minimal — full SLO/alerting and the DevSecOps stack are deferred.

Purpose: Make the order SAGA (future phases) traceable end-to-end; satisfy NFR-OBS-01/02 at dev scale.
Output: OTel Collector + Prometheus + Tempo + Grafana in Compose, the `@livora/observability` SDK wired, and a starter dashboard.
</objective>

<context>
@.planning/research/ARCHITECTURE.md
@.planning/phases/01-foundation/CONTEXT.md
@.planning/phases/01-foundation/01-foundation-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Observability stack in Compose (OTel Collector, Prometheus, Tempo, Grafana)</name>
  <files>infra/observability/otel-collector-config.yaml, infra/observability/prometheus.yml, infra/observability/tempo.yaml, infra/observability/grafana/datasources.yaml, infra/observability/grafana/dashboards/platform-overview.json, docker-compose.yml</files>
  <action>Add to docker-compose.yml (pinned tags): otel/opentelemetry-collector-contrib, prom/prometheus, grafana/tempo, grafana/grafana. OTel Collector config: receive OTLP (grpc 4317 / http 4318), export traces to Tempo and metrics to Prometheus (via prometheus exporter / remote write). Prometheus config scrapes the collector and the reference service `/metrics`. Tempo config: local storage backend. Grafana: provision datasources (Prometheus + Tempo) and auto-load a starter dashboard `platform-overview.json` (panels: HTTP request rate/latency p50/p95, Kafka consumer lag/applied-events, service up). Keep resource limits modest (this is dev/single-host).</action>
  <verify>`make up` → Grafana (`localhost:$GRAFANA_PORT`) loads with Prometheus + Tempo datasources healthy and the platform-overview dashboard present (no manual config).</verify>
  <done>Observability services healthy in Compose; Grafana auto-provisioned with datasources + dashboard.</done>
</task>

<task type="auto">
  <name>Task 2: Wire @livora/observability OTel SDK into the reference service</name>
  <files>libs/observability/src/index.ts, libs/observability/src/telemetry.ts</files>
  <action>Implement `createTelemetry(serviceName)` in `@livora/observability` using `@opentelemetry/sdk-node` with auto-instrumentations (HTTP/Nest, KafkaJS, pg), OTLP exporter pointed at the collector (`OTEL_EXPORTER_OTLP_ENDPOINT` from `@livora/config`), resource attributes (service.name, service.version), and W3C trace-context propagation so a trace started at the HTTP edge continues across the Kafka produce/consume (inject/extract trace headers in the outbox payload/Kafka headers — coordinate with Plan 03's consumer). Initialize it at the top of `apps/platform-reference/src/main.ts`. Add a `/metrics` Prometheus endpoint to the service.</action>
  <verify>Send an authenticated `/demo/echo` request, then in Grafana/Tempo search the trace: it spans Kong→service HTTP→Postgres→Kafka produce→consumer apply as ONE trace; Prometheus shows the service `up` and HTTP metrics.</verify>
  <done>One continuous trace per request visible in Tempo; service metrics scraped by Prometheus.</done>
</task>

</tasks>

<verification>
- End-to-end trace (edge → service → DB → Kafka → consumer) is a single trace in Tempo.
- Prometheus scrapes service metrics; Grafana dashboard renders them.
- Stack stays lightweight (dev/single-host appropriate).
</verification>

<success_criteria>
- [ ] OTel/Prometheus/Tempo/Grafana in Compose, auto-provisioned
- [ ] @livora/observability SDK wired into reference service
- [ ] Single end-to-end trace + service metrics visible
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-04-SUMMARY.md` documenting the OTLP endpoints, how services adopt `createTelemetry()`, and the dashboard location.
</output>
