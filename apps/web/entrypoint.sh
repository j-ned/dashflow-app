#!/bin/sh
set -e

echo "[entrypoint] Running database schema push..."
npx drizzle-kit push --force --config=drizzle.config.ts
echo "[entrypoint] Schema push complete."

echo "[entrypoint] Starting server..."
exec node dist/index.js
