#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend/app/api"
uv tool run --from ruff==0.1.15 ruff check --config pyproject.toml .
