#!/usr/bin/env bash
set -euo pipefail
repo="${1:?Repository path required}"
release="${2:?Release SHA required}"
archive="${3:?Image archive required}"
checksum="${4:?Archive SHA256 required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
[[ "$checksum" =~ ^[0-9a-f]{64}$ ]]
[[ "$repo" = /* && "$archive" = /* ]]
cd "$repo"
exec 9>/tmp/intelli-factory-deploy.lock
flock -n 9 || { echo 'Another release is running.' >&2; exit 1; }
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Refusing to change a dirty deployment checkout.' >&2
  exit 1
fi
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
git fetch origin production
if [[ "$(git rev-parse origin/production)" != "$release" ]]; then
  echo 'Release is no longer the production tip; refusing a stale deployment.' >&2
  exit 1
fi
# Both images are the artifacts tested by this workflow, never rebuilt on the VM.
gunzip -c "$archive" | sudo -n docker load
git checkout -B production "$release"
ORACLE_DOCKER_SUDO=true bash deploy/oracle/deploy.sh
rm -f "$archive"
