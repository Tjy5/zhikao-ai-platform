#!/usr/bin/env bash
set -euo pipefail

PORT="${BACKEND_PORT:-8001}"
DATABASE_URL="${JDBC_DATABASE_URL:-jdbc:sqlite:./dev.db}"
CORS_ORIGINS="${BACKEND_CORS_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000}"

cd "$(dirname "$0")"

command -v java >/dev/null 2>&1 || {
  echo "Java 21 is required and java was not found on PATH." >&2
  exit 1
}

MVN="./mvnw"
if [[ ! -x "$MVN" ]]; then
  if command -v mvn >/dev/null 2>&1; then
    MVN="mvn"
  else
    echo "Maven wrapper or Maven 3.9+ is required." >&2
    exit 1
  fi
fi

export BACKEND_PORT="$PORT"
export JDBC_DATABASE_URL="$DATABASE_URL"
export BACKEND_CORS_ORIGINS="$CORS_ORIGINS"
export APP_SECRET_KEY="${APP_SECRET_KEY:-dev-only-change-me}"
export MODEL_SETTINGS_ENCRYPTION_KEY="${MODEL_SETTINGS_ENCRYPTION_KEY:-dev-only-model-settings-key-change-me}"

if [[ "${SKIP_TESTS:-false}" != "true" ]]; then
  "$MVN" test
fi

"$MVN" spring-boot:run
