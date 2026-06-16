---
phase: 01-foundation
plan: 05
type: execute
wave: 4
depends_on: [02, 03, 04]
files_modified:
  - deploy/provision-ubuntu.sh
  - deploy/deploy.sh
  - deploy/healthcheck.sh
  - deploy/.env.production.example
  - docker-compose.prod.yml
  - deploy/README.md
  - Makefile
autonomous: false
user_setup:
  - service: ubuntu-host
    why: "A target Ubuntu server (or VM) is required to run the deploy script against; only the user can provide/host it."
    env_vars:
      - name: DEPLOY_HOST
        source: "Your Ubuntu server IP/hostname (SSH access)"
      - name: DEPLOY_USER
        source: "SSH user with sudo on the Ubuntu host"
must_haves:
  truths:
    - "Running deploy on a FRESH Ubuntu host installs Docker Engine + Compose plugin"
    - "The script builds/pulls images, starts the full stack, and waits for health to pass"
    - "Re-running the script updates the deployment idempotently (pull, up -d, no data loss)"
  artifacts:
    - "deploy/provision-ubuntu.sh (Docker install + host prep)"
    - "deploy/deploy.sh (build/pull, compose up, migrate, health-wait)"
    - "docker-compose.prod.yml (prod overrides: no dev mounts, restart policies, ports bound to localhost/reverse-proxy)"
    - "deploy/.env.production.example + deploy/README.md"
  key_links:
    - "apt Docker repo + GPG key -> docker-ce + docker-compose-plugin install on Ubuntu"
    - "compose base + prod override -> stack starts with production settings"
    - "healthcheck.sh polling -> deploy fails loudly if any service unhealthy"
---

<objective>
Deliver a one-command path to deploy the Livora Cart stack onto a single Ubuntu host with Docker — the owner's explicit Phase 1 ask. This is the interim deployment story until the later Kubernetes/DevSecOps phase.

Purpose: Get the codebase running on a real Ubuntu server quickly, reproducibly, without manual setup.
Output: `deploy/provision-ubuntu.sh`, `deploy/deploy.sh`, `docker-compose.prod.yml`, `.env.production.example`, and a README runbook.
</objective>

<context>
@.planning/research/STACK.md
@.planning/phases/01-foundation/CONTEXT.md
@.planning/phases/01-foundation/01-foundation-02-SUMMARY.md
@.planning/phases/01-foundation/01-foundation-03-SUMMARY.md
@.planning/phases/01-foundation/01-foundation-04-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ubuntu provisioning script + production compose override</name>
  <files>deploy/provision-ubuntu.sh, docker-compose.prod.yml, deploy/.env.production.example</files>
  <action>Write `deploy/provision-ubuntu.sh` (bash, `set -euo pipefail`, idempotent, Ubuntu 22.04/24.04): detect non-root + use sudo; `apt-get update`; install prerequisites (ca-certificates, curl, gnupg); add Docker's official APT repo + GPG key; install `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`; enable+start the docker service; add `$USER` to the `docker` group; set basic host hardening that is NOT devsecops-heavy (enable ufw allowing only SSH + the reverse-proxy port, set vm.max_map_count for OpenSearch via sysctl, configure Docker log rotation in /etc/docker/daemon.json). Make it safe to re-run. Author `docker-compose.prod.yml` overriding the base compose: remove dev source mounts, set `restart: unless-stopped` on all services, bind infra admin ports to 127.0.0.1 only, set resource limits, and read all secrets from `.env.production`. Author `deploy/.env.production.example` documenting every required variable with placeholders (no real secrets).</action>
  <verify>`bash -n deploy/provision-ubuntu.sh` (syntax) + `shellcheck deploy/provision-ubuntu.sh` pass; `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` renders without error.</verify>
  <done>Provision script lints clean and the merged prod compose config is valid.</done>
</task>

<task type="auto">
  <name>Task 2: Deploy + healthcheck scripts and runbook</name>
  <files>deploy/deploy.sh, deploy/healthcheck.sh, deploy/README.md, Makefile</files>
  <action>Write `deploy/deploy.sh` (bash, `set -euo pipefail`): accept env (`ENV_FILE` default `.env.production`); pull latest code if run on-host (optional `git pull`); `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV_FILE" pull` then `... build` (for the platform-reference image) then `... up -d`; run DB migrations (`prisma migrate deploy` inside the service container); register the Debezium connector (curl to Connect REST, idempotent — skip if exists); then call `deploy/healthcheck.sh`. Write `deploy/healthcheck.sh` that polls each service's health (compose `ps` health status + HTTP probes for Kong `/status`, Keycloak `/health/ready`, reference `/health`, Grafana, OpenSearch `_cluster/health`) with a timeout and clear pass/fail exit code. Add a `--remote` mode to deploy.sh that rsyncs the repo to `$DEPLOY_USER@$DEPLOY_HOST` and runs provision+deploy over SSH. Add Makefile targets `provision`, `deploy`, `deploy-remote`, `health`. Write `deploy/README.md`: step-by-step runbook (local VM and remote host), prerequisites, env setup, rollback (`down` + previous image tag), and a note that K8s/DevSecOps is a later phase.</action>
  <verify>`shellcheck deploy/deploy.sh deploy/healthcheck.sh` pass; `bash -n` on both; dry-run `deploy/healthcheck.sh` against a locally-running `make up` stack exits 0.</verify>
  <done>Deploy + healthcheck scripts lint clean and healthcheck passes against the local stack; README runbook complete.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 3: Verify deploy on a real Ubuntu host</name>
  <action>Provide an Ubuntu 22.04/24.04 host (cloud VM, local VM, or WSL2 Ubuntu) and run `make provision` then `make deploy` (or `make deploy-remote` with DEPLOY_HOST/DEPLOY_USER set). Confirm the stack comes up healthy and the reference service answers through Kong with a Keycloak JWT.</action>
  <verify>On the host: `docker compose ps` shows all services healthy; `curl http://<host>:<kong>/reference/health` → 200; authenticated `/reference/demo/echo` → 202.</verify>
  <done>The full stack runs on a real Ubuntu host via the scripts; reference endpoint reachable and healthy.</done>
</task>

</tasks>

<verification>
- Scripts lint (shellcheck) clean and merged prod compose config is valid.
- Healthcheck passes against the local stack.
- (Checkpoint) Stack verified running on a real Ubuntu host.
</verification>

<success_criteria>
- [ ] provision-ubuntu.sh installs Docker + preps host idempotently
- [ ] deploy.sh builds/pulls, starts stack, migrates, registers CDC, health-waits
- [ ] docker-compose.prod.yml with restart policies + locked-down ports
- [ ] README runbook (local + remote) complete
- [ ] Verified on a real Ubuntu host
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-05-SUMMARY.md` with the exact deploy commands, host prerequisites, ports, and rollback steps.
</output>
