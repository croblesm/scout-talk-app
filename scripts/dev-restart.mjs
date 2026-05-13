#!/usr/bin/env node
/**
 * Restart the Next.js dev server cleanly after a many-file drop from
 * /opsx-apply. Used between Step 4 and Step 5 of the demo (Tailwind v4
 * class scanner sometimes misses new classes on a hot reload).
 *
 * Kills by PORT (not by process name) so this script does NOT
 * self-terminate the way a shell `pkill -f 'next dev'` does (the npm
 * script's own shell has 'next dev' in its command line).
 *
 * Sequence:
 *   1. Find PIDs bound to :3000 via lsof. Kill -9 each.
 *   2. Also pkill 'next-server' (the worker) - safe because the script
 *      itself doesn't contain that string.
 *   3. Wait briefly for the kernel to release the port.
 *   4. rm -rf .next.
 *   5. Exec `npm run dev` in the foreground of this terminal.
 *
 * Usage: npm run dev:restart
 */
import { spawn, spawnSync } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'

function killByPort(port) {
  const lsof = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' })
  if (lsof.status !== 0 || !lsof.stdout.trim()) return []
  const pids = lsof.stdout.trim().split('\n').filter(Boolean)
  for (const pid of pids) {
    spawnSync('kill', ['-9', pid], { stdio: 'ignore' })
  }
  return pids
}

async function main() {
  console.log('[1/4] killing processes bound to :3000')
  const killed = killByPort(3000)
  if (killed.length) {
    console.log(`      killed PIDs: ${killed.join(', ')}`)
  } else {
    console.log('      none found on :3000')
  }

  console.log('[2/4] pkill next-server (the worker)')
  spawnSync('pkill', ['-f', 'next-server'], { stdio: 'ignore' })

  console.log('[3/4] waiting 800ms for port to release')
  await new Promise((r) => setTimeout(r, 800))

  if (existsSync('.next')) {
    console.log('[4/4] removing .next/ and starting fresh next dev')
    rmSync('.next', { recursive: true, force: true })
  } else {
    console.log('[4/4] .next/ already clean; starting fresh next dev')
  }

  // Exec npm run dev in the foreground of this terminal.
  const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
  // Forward Ctrl+C to the child so the operator can stop it cleanly.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
