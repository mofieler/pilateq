#!/usr/bin/env node
/**
 * Production server starter for pilatesOS.
 *
 * Runs migrations first, then starts the Next.js standalone server. This is
 * used as the Dockerfile CMD so migrations still run even if a PaaS (e.g.
 * Coolify) replaces the ENTRYPOINT with its own init.
 *
 * The migration step is idempotent thanks to the advisory lock in
 * migrate-with-lock.mjs, so it is safe if the Dockerfile ENTRYPOINT already ran
 * migrations before this script is invoked.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In the Docker image the migration dependencies are installed in
// /app/migrate/node_modules, so we must run the copy there, not the one in
// /app/scripts which cannot resolve dotenv/drizzle-orm/postgres. Locally the
// /app/migrate directory does not exist, so fall back to the script in scripts/.
const CONTAINER_MIGRATE_SCRIPT = path.resolve(__dirname, '..', 'migrate', 'run.mjs');
const LOCAL_MIGRATE_SCRIPT = path.resolve(__dirname, 'migrate-with-lock.mjs');
const MIGRATE_SCRIPT = fs.existsSync(CONTAINER_MIGRATE_SCRIPT)
  ? CONTAINER_MIGRATE_SCRIPT
  : LOCAL_MIGRATE_SCRIPT;
const SERVER_SCRIPT = path.resolve(__dirname, '..', 'server.js');

function log(message) {
  console.log(`[start ${new Date().toISOString()}] ${message}`);
}

async function runMigrations() {
  return new Promise((resolve, reject) => {
    log(`Running migrations using ${MIGRATE_SCRIPT}...`);
    const child = spawn('node', [MIGRATE_SCRIPT], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      if (code === 0) {
        log('Migrations completed.');
        resolve();
      } else {
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    log('Starting Next.js server...');
    const child = spawn('node', [SERVER_SCRIPT], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      resolve(code);
    });

    child.on('error', reject);
  });
}

try {
  await runMigrations();
  const exitCode = await startServer();
  process.exit(exitCode ?? 0);
} catch (err) {
  log(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
