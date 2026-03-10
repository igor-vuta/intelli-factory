#!/bin/bash
# Format Python files using Ruff

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend/app/api"

cd "$BACKEND_DIR" || exit 1

# Activate virtualenv
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
else
  echo "Error: virtualenv not found at $BACKEND_DIR/.venv"
  echo "Run: python3 -m venv .venv && pip install -q fastapi uvicorn deap numpy pydantic pydantic-settings python-multipart ruff"
  exit 1
fi

# Run Ruff format and fix
echo "Formatting Python files..."
python3 -m ruff format .

echo "Checking and fixing violations..."
python3 -m ruff check . --fix
