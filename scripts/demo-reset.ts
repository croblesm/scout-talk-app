/**
 * Restore the repo and database to the pre-implement state, ready for a
 * clean recording take. Aborts loudly on any prerequisite failure.
 *
 * Sequence:
 *   1. Verify the `pre-implement` git tag exists.
 *   2. Verify (or warn about) working tree state.
 *   3. Kill any running next dev / next-server process and free :3000.
 *   4. git switch + reset --hard + clean -fd; wipe openspec/changes/*.
 *   5. docker compose down -v && up -d, wait for SQL Server health.
 *   6. prisma migrate deploy.
 *   7. npm run db:seed.
 *
 * NOTE: this script does NOT start the dev server. The operator runs
 * `npm run dev` manually in a foreground terminal after demo-reset
 * finishes. The script-controlled background dev server caused
 * recording-day grief: it could be killed accidentally, it streamed
 * logs into the operator terminal, and recovering it required knowing
 * the right pkill incantation. Foreground dev is explicit, visible,
 * and Ctrl+C cleanly stops it.
 *
 * Usage: npm run demo:reset
 *
 * Target wall clock under 60 seconds (no dev-server wait).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const TAG = 'pre-implement'
const BRANCH = '001-talkscout'

function run(cmd: string, args: string[], opts: { allowFail?: boolean } = {}): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8' })
  if (result.status !== 0 && !opts.allowFail) {
    process.stderr.write(result.stderr ?? '')
    throw new Error(`command failed: ${cmd} ${args.join(' ')}`)
  }
  return (result.stdout ?? '').trim()
}

async function runWithRetry(cmd: string, args: string[], retries = 3, delayMs = 3000): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = spawnSync(cmd, args, { encoding: 'utf8' })
    if (result.status === 0) return (result.stdout ?? '').trim()
    if (attempt === retries) {
      process.stderr.write(result.stderr ?? '')
      throw new Error(`command failed after ${retries} attempts: ${cmd} ${args.join(' ')}`)
    }
    console.warn(`  attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms...`)
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error('unreachable')
}

function reportDirtyState(): boolean {
  const status = run('git', ['status', '--porcelain'])
  if (status.length === 0) return false
  console.warn('working tree has uncommitted changes (likely from a previous practice take):')
  console.warn(status.split('\n').slice(0, 12).map((s) => `  ${s}`).join('\n'))
  if (status.split('\n').length > 12) console.warn(`  ... (and more)`)
  console.warn('')
  console.warn('demo-reset will discard ALL of these and reset to the pre-implement tag.')
  console.warn('If you have work you want to keep, abort now (Ctrl+C). Continuing in 3 seconds.')
  return true
}

function checkTagExists() {
  const tags = run('git', ['tag', '--list', TAG])
  if (tags !== TAG) {
    console.error(`git tag "${TAG}" not found.`)
    console.error('Create it at the appropriate commit before running demo-reset.')
    process.exit(2)
  }
}

async function main() {
  const startedAt = Date.now()

  console.log(`[1/6] verifying ${TAG} tag`)
  checkTagExists()

  console.log('[2/6] checking working tree')
  const wasDirty = reportDirtyState()
  if (wasDirty) await new Promise((r) => setTimeout(r, 3000))

  console.log('[3/6] killing any running dev server (frees :3000)')
  // pkill returns 1 when no process matches; allowFail keeps us running.
  // We kill next-server (the worker) by name. We do NOT pkill -f 'next dev'
  // because that pattern can self-match a shell whose command line contains
  // the literal string 'next dev'.
  run('pkill', ['-f', 'next-server'], { allowFail: true })
  // Belt and suspenders: anything still bound to port 3000.
  const lsofResult = spawnSync('lsof', ['-ti', ':3000'], { encoding: 'utf8' })
  if (lsofResult.status === 0 && lsofResult.stdout.trim()) {
    const pids = lsofResult.stdout.trim().split('\n')
    console.log(`       killing PIDs on :3000 → ${pids.join(', ')}`)
    run('kill', ['-9', ...pids], { allowFail: true })
  } else {
    console.log('       no processes on :3000')
  }
  await new Promise((r) => setTimeout(r, 500))

  console.log(`[4/6] git switch ${BRANCH} && reset --hard ${TAG} && clean -fd`)
  run('git', ['switch', BRANCH])
  run('git', ['reset', '--hard', TAG])
  run('git', ['clean', '-fd'])

  // openspec/changes/<change-name>/ is created live on camera by /opsx-propose.
  // Delete any stale change directories so each take starts with no change.
  const changesDir = resolve(ROOT, 'openspec/changes')
  if (existsSync(changesDir)) {
    for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'archive') {
        const target = resolve(changesDir, entry.name)
        rmSync(target, { recursive: true, force: true })
        console.log(`       removed stale openspec/changes/${entry.name}`)
      }
    }
  }

  // Wipe .next so the next manual `npm run dev` rebuilds Tailwind cleanly.
  if (existsSync(resolve(ROOT, '.next'))) {
    rmSync(resolve(ROOT, '.next'), { recursive: true, force: true })
    console.log('       removed stale .next/')
  }

  console.log('[5/6] docker compose down -v && up -d (with wait)')
  run('docker', ['compose', 'down', '-v'])
  run('docker', ['compose', 'up', '-d'])
  run('node', ['scripts/wait-for-db.mjs'])

  console.log('[6/6] prisma migrate deploy && db:seed')
  await runWithRetry('npx', ['prisma', 'migrate', 'deploy'], 3, 3000)
  await runWithRetry('npm', ['run', 'db:seed'], 2, 2000)

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n  Demo reset complete in ${elapsed}s.\n`)
  console.log('  NEXT STEP (you do this manually):')
  console.log('    npm run dev')
  console.log('')
  console.log('  Wait for "Ready in Ns", then open http://localhost:3000.')
  console.log('  You must see the placeholder ("Search UI lands when you run')
  console.log('  /opsx-propose and then /opsx-apply") BEFORE you proceed to')
  console.log('  Step 1 of the demo. This is your on-camera "before" state.')
  console.log('')
  console.log('  After /opsx-apply finishes, stop this dev server (Ctrl+C),')
  console.log('  then run `npm run dev:restart` from a fresh terminal to get')
  console.log('  Tailwind to re-scan the new files.\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
