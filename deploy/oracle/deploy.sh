#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "$(git branch --show-current)" != 'testing/oracle' ]]; then
  echo 'Deploy from testing/oracle.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Deploy a clean checkout so the release tag identifies the deployed code.' >&2
  exit 1
fi
if [[ ! -f deploy/oracle/.env ]]; then
  echo 'Copy deploy/oracle/.env.example to deploy/oracle/.env and configure it first.' >&2
  exit 1
fi
export IMAGE_TAG
IMAGE_TAG="$(git rev-parse HEAD)"
docker_command=(docker)
if [[ "${ORACLE_DOCKER_SUDO:-false}" == 'true' ]]; then
  docker_command=(sudo --preserve-env=IMAGE_TAG docker)
fi
compose=("${docker_command[@]}" compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml -f deploy/oracle/micro.yml)
"${compose[@]}" config --quiet
# Load the tested linux/amd64 images from CI before running this script.
for service in backend frontend; do
  "${docker_command[@]}" image inspect "intelli-factory-testing-${service}:${IMAGE_TAG}" > /dev/null
done
"${compose[@]}" up -d --wait db
mkdir -p deploy/oracle/backups
chmod 700 deploy/oracle/backups
umask 077
backup="deploy/oracle/backups/$(date -u +%Y%m%dT%H%M%SZ)-before-${IMAGE_TAG}.dump"
"${compose[@]}" exec -T db pg_dump -U intelli -d intelli_factory -Fc > "$backup"
# A new one-off job runs on every release, including repeated deployments.
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 backend
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 frontend
"${compose[@]}" ps
printf 'Deployed release %s; database backup: %s\n' "$IMAGE_TAG" "$backup"
