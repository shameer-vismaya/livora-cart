# Livora Cart — developer & deployment shortcuts.
# Local stack uses docker-compose.yml (+ override). Production deploy uses the
# scripts in deploy/ (see deploy/README.md). DevSecOps/K8s is a later phase.

SHELL := /bin/bash
COMPOSE := docker compose
ENV_FILE ?= .env

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ───────────────────────────── Local stack ─────────────────────────────
.PHONY: up
up: ## Start the full local infra stack (detached)
	$(COMPOSE) --env-file $(ENV_FILE) up -d

.PHONY: down
down: ## Stop the stack (keep volumes)
	$(COMPOSE) --env-file $(ENV_FILE) down

.PHONY: reset
reset: ## Stop the stack and DELETE all volumes (destructive)
	$(COMPOSE) --env-file $(ENV_FILE) down -v

.PHONY: ps
ps: ## Show service status
	$(COMPOSE) ps

.PHONY: logs
logs: ## Tail logs (use s=<service> for one service)
	$(COMPOSE) logs -f $(s)

.PHONY: config
config: ## Render the merged compose config (validation)
	$(COMPOSE) --env-file $(ENV_FILE) config >/dev/null && echo "compose config OK"

# ─────────────────────────────── CDC seed ───────────────────────────────
.PHONY: seed
seed: ## Register the Debezium outbox connector (idempotent)
	@bash deploy/register-connector.sh

# ──────────────────────────────── Deploy ────────────────────────────────
.PHONY: provision
provision: ## Provision Docker + host prep on the current Ubuntu host
	@bash deploy/provision-ubuntu.sh

.PHONY: deploy
deploy: ## Build/pull, start stack, migrate, register CDC, health-check (on host)
	@bash deploy/deploy.sh

.PHONY: deploy-remote
deploy-remote: ## Provision+deploy to $$DEPLOY_HOST over SSH
	@bash deploy/deploy.sh --remote

.PHONY: health
health: ## Run the stack health check
	@bash deploy/healthcheck.sh

.PHONY: smoke
smoke: ## Post-deploy smoke test (Phase 1 spine)
	@bash deploy/smoke-test.sh
