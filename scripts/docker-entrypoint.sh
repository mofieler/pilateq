#!/bin/sh
set -e

# Runtime migration runner. Uses a dedicated node_modules layer in /app/migrate
# so drizzle-orm is resolvable without bloating the standalone runner image.
echo "[entrypoint] Running database migrations..."
node /app/migrate/run.mjs

# Hand over to the application (use command provided by Coolify or Dockerfile CMD)
exec "$@"
