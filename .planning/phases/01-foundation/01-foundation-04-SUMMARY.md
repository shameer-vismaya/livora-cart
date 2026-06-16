---
phase: 01-foundation
plan: 04
subsystem: observability
tags: [opentelemetry, prometheus, grafana, tempo, tracing, metrics]
requires: [plan-01, plan-02, plan-03]
provides: [otel-sdk, observability-stack, metrics-endpoint, tracing]
affects: [all-future-services]
tech-stack:
  added:
    - "@opentelemetry/sdk-node@0.219"
    - "@opentelemetry/auto-instrumentations-node@0.77"
    - prom-client@15
    - otel/opentelemetry-collector-contrib@0.110
    - prom/prometheus@2.54
    - grafana/tempo@2.6
    - grafana/grafana@11.2
  patterns: [otlp-pipeline, trace-context-propagation, auto-instrumentation, provisioned-grafana]
key-files:
  created:
    - infra/observability/otel-collector-config.yaml
    - infra/observability/prometheus.yml
    - infra/observability/tempo.yaml
    - infra/observability/grafana/datasources.yaml
    - infra/observability/grafana/dashboards/platform-overview.json
    - apps/platform-reference/src/telemetry.bootstrap.ts
    - apps/platform-reference/src/metrics/metrics.controller.ts
  modified:
    - libs/observability/src/lib/telemetry.ts
    - apps/platform-reference/src/main.ts
    - apps/platform-reference/src/app.module.ts
    - docker-compose.yml
completed: 2026-06-16
status: complete
verified: local (lint+test+build green incl. OTel SDK; runtime traces on host)
---

# Phase 1 Plan 04: Observability Baseline Summary

A lightweight OTel pipeline: services export OTLP to a Collector that fans traces to Tempo and metrics to Prometheus, visualized in an auto-provisioned Grafana. `@livora/observability` now starts a real NodeSDK with auto-instrumentation so an order's path (HTTP→pg→Kafka) is one trace.

## What was built
- **Collector / Prometheus / Tempo / Grafana** added to compose. Collector receives OTLP (4317/4318) → Tempo (traces) + Prometheus exporter (8889). Prometheus scrapes the collector + `platform-reference:3000/metrics`. Grafana auto-provisions both datasources and a "Platform Overview" dashboard.
- **`@livora/observability.createTelemetry`** now starts `NodeSDK` with `getNodeAutoInstrumentations()` (http/nest/express/pg/kafkajs), OTLP trace + metric exporters, and service resource attrs. KafkaJS instrumentation propagates W3C trace context across the message boundary. No-op when no OTLP endpoint.
- **`telemetry.bootstrap.ts`** imported first in `main.ts` so instrumentation patches modules before they load. **`/metrics`** via prom-client (+ default `livora_` metrics).

## Verification (local, real)
- `nx run-many -t lint test build` ✓ — 4 projects, including the OTel SDK wiring compiling and the observability lib tests (enabled/disabled/shutdown) still green.
- All observability YAML + dashboard JSON validated.
- Runtime (single end-to-end trace in Tempo, metrics in Grafana) deferred to the Ubuntu host.

## Decisions Made
- **OTLP→Collector→Prometheus/Tempo** (not direct service→backends) — one egress point, swappable backends.
- **prom-client `/metrics` AND OTLP metrics** — direct scrape + OTLP both available; redundant but convenient for dev.
- **Grafana anonymous viewer enabled** for frictionless local dashboards (lock down in Cloud/DevSecOps phase).

## Deviations from Plan
- **Added `@opentelemetry/sdk-metrics`** explicitly (PeriodicExportingMetricReader import) — transitive but not directly resolvable under pnpm. Rule 3.
- Used OTel 2.x API (`resourceFromAttributes`, `ATTR_SERVICE_NAME`) matching installed 0.219/2.x packages.

## ⚠️ To verify on host
- Authenticated `/demo/echo` request → one continuous trace (Kong→service→pg→Kafka→consumer) in Grafana/Tempo.
- Prometheus target `platform-reference` UP; Grafana "Platform Overview" renders.
