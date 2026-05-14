#!/usr/bin/env node
/**
 * Clean restart of the Next.js dev server in the CURRENT terminal.
 *
 * Used between Step 4 and Step 5 of the demo when /opsx-apply drops
 * many files at once and Tailwind v4 misses some new class names on
 * the hot reload.
 *
 * The operator is responsible for stopping the previous dev server
 * BEFORE running this. Stop it cleanly with Ctrl+C in whichever
 * terminal is running `next dev`.
 *
 * The previous version of this script killed by port (lsof + kill -9).
 * That was destructive inside VS Code dev containers: it terminated
 * VS Code's own port-forwarding agent on :3000, broke the dev
 * container connection, and required a full window reload. The script
 * no longer kills anything. If port :3000 is still bound, `npm run
 * dev` will fall back to :3001/:3002 and print a warning. That is a
 * signal to Ctrl+C the prior dev terminal and rerun this command.
 *
 * Sequence:
 *   1. rm -rf .next (so Tailwind re-scans every newly created file)
 *   2. exec `npm run dev` in the foreground of this terminal
 *
 * Usage:
 *   - Operator presses Ctrl+C in the terminal running `next dev`.
 *   - In the SAME terminal: `npm run dev:restart`.
 *   - When done: Ctrl+C to stop.
 */
import { spawn } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'

if (existsSync('.next')) {
  console.log('[1/2] removing .next/ for a clean Tailwind re-scan')
  rmSync('.next', { recursive: true, force: true })
} else {
  console.log('[1/2] no .next/ to remove')
}

console.log('[2/2] starting fresh next dev in this terminal')
const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig))
}
