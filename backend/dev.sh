#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"
echo "[dev] Backend one-click dev starting with SQLite..."

if [[ ! -d .venv ]]; then
  echo "[dev] Creating virtualenv at .venv"
  python -m venv .venv
fi
echo "[dev] Activating virtualenv"
source .venv/bin/activate

if [[ -f requirements.txt ]]; then
  echo "[dev] Installing Python dependencies"
  python -m pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
fi

if [[ -f alembic.ini ]]; then
  echo "[dev] Applying DB migrations (alembic upgrade head)"
  export DATABASE_URL="sqlite:///./dev.db"
  alembic upgrade head || echo "[dev] Alembic migration failed; continuing"
fi

echo "[dev] Starting Uvicorn on http://localhost:8001 (reload)"
export DATABASE_URL="sqlite:///./dev.db"
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

