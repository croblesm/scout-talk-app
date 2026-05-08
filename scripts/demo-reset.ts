/**
 * Restore the repo and database to the pre-implement state, ready for a
 * clean recording take. Aborts loudly on any prerequisite failure.
 *
 * Sequence:
 *   1. Verify the working tree is clean (or fail with a clear message).
 *   2. Verify the `pre-implement` git tag exists.
 *   3. git reset --hard pre-implement.
 *   4. docker compose down -v, then up -d, wait for health.
 *   5. prisma migrate deploy.
 *   6. npm run db:seed.
 *   7. Start `next dev` in the background and wait for /api health.
 *
 * Usage: npm run demo:reset
 *
 * Target wall clock under 90 seconds (SC-003).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
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

async function waitForHttp(url: string, timeoutMs = 60_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`timed out waiting for ${url}`)
}

async function main() {
  const startedAt = Date.now()

  console.log(`[1/7] verifying ${TAG} tag`)
  checkTagExists()

  console.log('[2/7] checking working tree')
  const wasDirty = reportDirtyState()
  if (wasDirty) await new Promise((r) => setTimeout(r, 3000))

  console.log('[3/7] killing any stale next dev processes and freeing :3000')
  // pkill returns 1 when no process matches; allowFail: true keeps us running
  run('pkill', ['-f', 'next dev'], { allowFail: true })
  run('pkill', ['-f', 'next-server'], { allowFail: true })
  // Belt and suspenders: anything still bound to port 3000
  const lsofResult = spawnSync('lsof', ['-ti', ':3000'], { encoding: 'utf8' })
  if (lsofResult.status === 0 && lsofResult.stdout.trim()) {
    const pids = lsofResult.stdout.trim().split('\n')
    console.log(`       killing PIDs still on :3000 → ${pids.join(', ')}`)
    run('kill', ['-9', ...pids], { allowFail: true })
  }
  await new Promise((r) => setTimeout(r, 500))

  console.log(`       git switch ${BRANCH} && reset --hard ${TAG} && clean -fd`)
  run('git', ['switch', BRANCH])
  run('git', ['reset', '--hard', TAG])
  run('git', ['clean', '-fd'])

  // openspec/changes/<change-name>/ is created live on camera by /opsx:propose.
  // Delete any stale change directories so each take starts with no change.
  const changesDir = resolve(ROOT, 'openspec/changes')
  if (existsSync(changesDir)) {
    const { readdirSync } = require('node:fs')
    for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'archive') {
        const target = resolve(changesDir, entry.name)
        rmSync(target, { recursive: true, force: true })
        console.log(`       removed stale openspec/changes/${entry.name}`)
      }
    }
  }

  console.log('[4/7] docker compose down -v && up -d (with wait)')
  if (existsSync(resolve(ROOT, '.next'))) {
    rmSync(resolve(ROOT, '.next'), { recursive: true, force: true })
  }
  run('docker', ['compose', 'down', '-v'])
  run('docker', ['compose', 'up', '-d'])
  run('node', ['scripts/wait-for-db.mjs'])

  console.log('[5/7] prisma migrate deploy')
  await runWithRetry('npx', ['prisma', 'migrate', 'deploy'], 3, 3000)

  console.log('[6/7] db:seed')
  await runWithRetry('npm', ['run', 'db:seed'], 2, 2000)

  console.log('[7/7] starting Next.js dev server')
  const dev = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    detached: true,
  })
  dev.unref()
  await waitForHttp('http://localhost:3000', 60_000)

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n  Demo reset complete in ${elapsed}s. Open http://localhost:3000.`)
  console.log('  The dev server runs in the background. Stop it with: pkill -f "next dev"\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
