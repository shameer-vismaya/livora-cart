#!/usr/bin/env bash
# Provision a fresh Ubuntu host (22.04 / 24.04) to run the Livora Cart stack.
# Installs Docker Engine + Compose plugin and applies the minimal host prep the
# stack needs. Idempotent: safe to re-run. NOT a DevSecOps hardening pass.
set -euo pipefail

log() { printf '\033[36m[provision]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[provision] WARN:\033[0m %s\n' "$*"; }

# Use sudo only if we are not already root.
SUDO=''
if [ "$(id -u)" -ne 0 ]; then
  SUDO='sudo'
fi

if ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  warn "This script targets Ubuntu. Detected a different distro — proceeding may fail."
fi

# ── Docker install (official APT repo) ────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  log "Docker already installed: $(docker --version)"
else
  log "Installing Docker prerequisites..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg gettext-base python3

  log "Adding Docker's official GPG key + repository..."
  $SUDO install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

  log "Installing Docker Engine + Compose plugin..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

log "Enabling + starting the Docker service..."
$SUDO systemctl enable docker >/dev/null 2>&1 || true
$SUDO systemctl start docker || true

# Add the invoking user to the docker group (effective on next login).
if [ -n "${SUDO_USER:-}" ] || [ "$(id -u)" -ne 0 ]; then
  TARGET_USER="${SUDO_USER:-$USER}"
  if ! id -nG "$TARGET_USER" | grep -qw docker; then
    log "Adding '$TARGET_USER' to the docker group (re-login to take effect)..."
    $SUDO usermod -aG docker "$TARGET_USER" || true
  fi
fi

# ── Host prep the stack needs ─────────────────────────────────────────────
# Tools used by deploy.sh (envsubst from gettext-base; python3 for JSON).
log "Ensuring deploy tooling (gettext-base, python3)..."
$SUDO apt-get install -y gettext-base python3 >/dev/null 2>&1 || \
  warn "could not install gettext-base/python3 — connector registration may be skipped."

# OpenSearch requires a higher vm.max_map_count.
log "Setting vm.max_map_count=262144 (OpenSearch requirement)..."
echo 'vm.max_map_count=262144' | $SUDO tee /etc/sysctl.d/99-livora-opensearch.conf >/dev/null
$SUDO sysctl -p /etc/sysctl.d/99-livora-opensearch.conf >/dev/null 2>&1 || true

# Docker log rotation so disks don't fill.
log "Configuring Docker log rotation..."
$SUDO mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }' \
    | $SUDO tee /etc/docker/daemon.json >/dev/null
  $SUDO systemctl restart docker || true
fi

# Basic firewall: allow SSH + the Kong proxy port only (best-effort, non-fatal).
if command -v ufw >/dev/null 2>&1; then
  log "Configuring ufw (allow SSH + Kong proxy ${KONG_PROXY_PORT:-8000})..."
  $SUDO ufw allow OpenSSH >/dev/null 2>&1 || true
  $SUDO ufw allow "${KONG_PROXY_PORT:-8000}/tcp" >/dev/null 2>&1 || true
fi

log "Done. Verify with: docker --version && docker compose version"
log "If you were added to the docker group, log out and back in (or run: newgrp docker)."
