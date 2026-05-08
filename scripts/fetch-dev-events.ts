/**
 * Fetches the dev.events conference listing HTML and overwrites
 * data/dev-events.html. NEVER on the demo path. Run only when
 * we want to recapture the fixture (e.g., between recording cycles).
 *
 * Usage: npm run ingest:live
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const URL = 'https://dev.events/'
const OUTPUT = resolve(process.cwd(), 'data/dev-events.html')

async function main() {
  console.warn('WARNING: this overwrites the committed fixture.')
  console.warn('Press Ctrl+C within 3 seconds to abort.')
  await new Promise((r) => setTimeout(r, 3000))

  console.log(`fetching ${URL}`)
  const res = await fetch(URL, {
    headers: { 'user-agent': 'TalkScout/1.0 (offline fixture refresh)' },
  })
  if (!res.ok) {
    throw new Error(`dev.events returned HTTP ${res.status}`)
  }
  const html = await res.text()
  await writeFile(OUTPUT, html, 'utf8')
  console.log(`wrote ${html.length} bytes to ${OUTPUT}`)
  console.log('NOTE: the fixture format may have changed. Re-validate with `npm run ingest`.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
