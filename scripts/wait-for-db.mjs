#!/usr/bin/env node
// Polls the talkscout-mssql container's healthcheck status until it reports
// "healthy", then does a final TDS-level smoke query via sqlcmd. This is more
// reliable than a raw TCP socket probe: SQL Server starts accepting TCP
// connections before it can actually answer TDS logins, especially on
// Rosetta-emulated AMD64 on Apple Silicon.
//
// When run INSIDE a devcontainer (no docker CLI on PATH), this script exits 0
// immediately. The devcontainer's `depends_on.mssql.condition: service_healthy`
// already gates startup on the same healthcheck.

import { spawnSync } from 'node:child_process';
import net from 'node:net';

const CONTAINER = process.env.MSSQL_CONTAINER ?? 'talkscout-mssql';
const HOST = process.env.MSSQL_HOST ?? 'localhost';
const PORT = Number(process.env.MSSQL_PORT ?? 1433);
const TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS ?? 120_000);
const POLL_INTERVAL_MS = 2000;

function dockerAvailable() {
  const probe = spawnSync('docker', ['version', '--format', '{{.Client.Version}}'], { encoding: 'utf8' });
  return probe.status === 0;
}

function probeTcp() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    const cleanup = (ok) => { socket.removeAllListeners(); socket.destroy(); resolve(ok); };
    socket.once('connect', () => cleanup(true));
    socket.once('error', () => cleanup(false));
    socket.setTimeout(2000, () => cleanup(false));
  });
}

function getHealth() {
  const result = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', CONTAINER], {
    encoding: 'utf8',
  });
  return (result.stdout ?? '').trim();
}

function smokeQuery() {
  const result = spawnSync('docker', [
    'exec',
    CONTAINER,
    '/opt/mssql-tools18/bin/sqlcmd',
    '-S', 'localhost',
    '-U', 'sa',
    '-P', 'TalkScout!Demo2026',
    '-C',
    '-Q', 'SELECT 1',
    '-b',
    '-t', '5',
  ], { encoding: 'utf8' });
  return result.status === 0;
}

const started = Date.now();

if (!dockerAvailable()) {
  // Inside a devcontainer or any other docker-less environment.
  // Just probe TCP at the configured host (which compose DNS resolves to mssql).
  process.stdout.write(`waiting for ${HOST}:${PORT} `);
  while (Date.now() - started < TIMEOUT_MS) {
    if (await probeTcp()) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      process.stdout.write(` ready (${elapsed}s)\n`);
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  process.stdout.write('\n');
  console.error(`timed out after ${TIMEOUT_MS}ms`);
  process.exit(1);
}

// Host environment with docker CLI: poll the container healthcheck.
process.stdout.write(`waiting for ${CONTAINER} `);

while (Date.now() - started < TIMEOUT_MS) {
  const health = getHealth();
  if (health === 'healthy') {
    if (smokeQuery()) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      process.stdout.write(` ready (${elapsed}s)\n`);
      process.exit(0);
    }
  }
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
}

process.stdout.write('\n');
console.error(`timed out after ${TIMEOUT_MS}ms (last status: ${getHealth()})`);
process.exit(1);
