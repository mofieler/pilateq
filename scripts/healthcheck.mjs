#!/usr/bin/env node
/**
 * Container healthcheck for Coolify.
 *
 * Called by the Dockerfile HEALTHCHECK. Exits 0 when /api/health returns 200,
 * otherwise exits 1. Using a small Node script avoids relying on wget/curl
 * being present or correctly resolving under a non-root user on Alpine.
 */
import http from 'http';

const PORT = process.env.PORT || 3000;
// Connect to loopback explicitly; HOSTNAME is 0.0.0.0 (listen-all) and is not
// suitable as a client target on every runtime.
const HOST = '127.0.0.1';
const PATH = '/api/health';

const req = http.get(`http://${HOST}:${PORT}${PATH}`, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.setTimeout(5000, () => {
  req.destroy();
  process.exit(1);
});
