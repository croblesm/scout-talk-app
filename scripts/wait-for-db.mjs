#!/usr/bin/env node
// Polls the talkscout-mssql container's healthcheck status until it reports
// "healthy", then does a final TDS-level smoke query via sqlcmd. This is more
// reliable than a raw TCP socket probe: SQL Server starts accepting TCP
// connections before it can actually answer TDS logins, especially on
// Rosetta-emulated AMD64 on Apple Silicon.

import { spawnSync } from 'node:child_process';

const CONTAINER = process.env.MSSQL_CONTAINER ?? 'talkscout-mssql';
const TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS ?? 120_000);
const POLL_INTERVAL_MS = 2000;

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
