/**
 * Restore the LOCAL repo and database to the azure-pre-implement state on
 * branch 002-azure-deploy, ready for a clean recording take of the cloud
 * beat.
 *
 * IMPORTANT: this script does NOT touch the deployed Azure resources.
 * The cloud stack is provisioned once off-camera (see
 * demo/azure-deploy-runbook.md) and stays live across retakes. Tearing
 * it down between takes would force a 5-minute cold redeploy and
 * defeat the rewind use case.
 *
 * Sequence:
 *   1. Verify the working tree is clean (or fail with a clear message).
 *   2. Verify the `azure-pre-implement` git tag exists.
 *   3. Verify we are on (or can switch to) 002-azure-deploy.
 *   4. Kill stale next dev processes; free :3000.
 *   5. git reset --hard azure-pre-implement; git clean -fd.
 *   6. docker compose down -v && up -d, wait for health.
 *   7. prisma migrate deploy.
 *   8. npm run db:seed.
 *   9. Start `next dev` in the background and wait for /api health.
 *  10. Pre-warm the cloud URL if AZURE_LIVE_URL env var is set.
 *
 * Usage: npm run azure:reset
 *
 * Target wall clock under 90 seconds (matches demo:reset SLA).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const TAG = 'azure-pre-implement'
const BRANCH = '002-azure-deploy'
const CLOUD_URL = process.env.AZURE_LIVE_URL?.trim()

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
  console.warn(`azure-reset will discard ALL of these and reset to the ${TAG} tag.`)
  console.warn('If you have work you want to keep, abort now (Ctrl+C). Continuing in 3 seconds.')
  return true
}

function checkTagExists() {
  const tags = run('git', ['tag', '--list', TAG])
  if (tags !== TAG) {
    console.error(`git tag "${TAG}" not found.`)
    console.error('Create it at the appropriate commit before running azure-reset:')
    console.error(`  git tag ${TAG}`)
    console.error(`  git push origin ${TAG}`)
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

async function preWarmCloud() {
  if (!CLOUD_URL) {
    console.log('       (AZURE_LIVE_URL not set; skipping cloud pre-warm)')
    return
  }
  console.log(`       pre-warming cloud at ${CLOUD_URL}`)
  try {
    await fetch(CLOUD_URL, { method: 'GET' })
    await new Promise((r) => setTimeout(r, 1500))
    await fetch(CLOUD_URL, { method: 'GET' })
    console.log('       cloud URL responded (warm)')
  } catch (err) {
    console.warn(`       cloud pre-warm failed (continuing): ${(err as Error).message}`)
  }
}

async function main() {
  const startedAt = Date.now()

  console.log(`[1/8] verifying ${TAG} tag`)
  checkTagExists()

  console.log('[2/8] checking working tree')
  const wasDirty = reportDirtyState()
  if (wasDirty) await new Promise((r) => setTimeout(r, 3000))

  console.log('[3/8] killing any stale next dev processes and freeing :3000')
  run('pkill', ['-f', 'next dev'], { allowFail: true })
  run('pkill', ['-f', 'next-server'], { allowFail: true })
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

  // openspec/changes/add-azure-deployment/ is created live on camera by
  // /opsx-propose. Delete any stale agent-generated directory so each take
  // starts with no change.
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

  console.log('[4/8] docker compose down -v && up -d (with wait)')
  if (existsSync(resolve(ROOT, '.next'))) {
    rmSync(resolve(ROOT, '.next'), { recursive: true, force: true })
  }
  run('docker', ['compose', 'down', '-v'])
  run('docker', ['compose', 'up', '-d'])
  run('node', ['scripts/wait-for-db.mjs'])

  console.log('[5/8] prisma migrate deploy')
  await runWithRetry('npx', ['prisma', 'migrate', 'deploy'], 3, 3000)

  console.log('[6/8] db:seed')
  await runWithRetry('npm', ['run', 'db:seed'], 2, 2000)

  console.log('[7/8] starting Next.js dev server')
  const dev = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    detached: true,
  })
  dev.unref()
  await waitForHttp('http://localhost:3000', 60_000)

  console.log('[8/8] cloud pre-warm')
  await preWarmCloud()

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n  Azure reset complete in ${elapsed}s.`)
  console.log('  Local:  http://localhost:3000')
  if (CLOUD_URL) {
    console.log(`  Cloud:  ${CLOUD_URL}  (pre-warmed; deployed stack untouched)`)
  } else {
    console.log('  Cloud:  unchanged; set AZURE_LIVE_URL to enable auto-pre-warm.')
  }
  console.log('  The dev server runs in the background. Stop it with: pkill -f "next dev"\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
