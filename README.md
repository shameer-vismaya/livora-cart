# Livora Cart

Production-grade, multi-vendor commerce marketplace (India). Flutter clients +
NestJS/TypeScript microservices. See [`.planning/`](.planning/) for the full
vision, research, requirements, and roadmap.

## Monorepo

Nx + pnpm workspace.

| Path | Purpose |
|---|---|
| `libs/contracts` | Shared event/DTO contracts (`@livora/contracts`) |
| `libs/config` | Typed zod-based env loader (`@livora/config`) |
| `libs/observability` | OpenTelemetry bootstrap (`@livora/observability`) |
| `apps/*` | Services (added per roadmap phase) |
| `infra/` | Docker Compose stack + service configs (Phase 1) |
| `deploy/` | Ubuntu Docker deployment scripts (Phase 1) |

## Prerequisites

- Node >= 20, pnpm >= 9
- Docker + Docker Compose (for the infra stack / deployment — Phase 1)

## Common commands

```bash
pnpm install          # install workspace deps
pnpm build            # nx run-many -t build
pnpm lint             # nx run-many -t lint
pnpm test             # nx run-many -t test
pnpm graph            # project graph
```

## Infrastructure & deployment

```bash
make up               # bring the full local stack up (Docker Compose)
make down             # stop the stack
make deploy           # deploy to the configured Ubuntu host (see deploy/README.md)
```

> Phase 1 is re-scoped to a Docker Compose stack + an Ubuntu deploy script.
> Kubernetes/EKS, GitOps, and the DevSecOps CI/CD pipeline are a later phase.
