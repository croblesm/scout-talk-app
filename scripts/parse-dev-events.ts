/**
 * Parse data/dev-events.html into data/events.json.
 * Each <article class="event"> becomes one entry.
 *
 * Usage: npm run ingest
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { load } from 'cheerio'
import { z } from 'zod'

const EventSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locationCity: z.string().nullable(),
  locationCountry: z.string().nullable(),
  isVirtual: z.boolean(),
  topics: z.string().min(1),
  description: z.string().min(1),
  cfpOpenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cfpCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cfpUrl: z.string().url().nullable(),
})

type Event = z.infer<typeof EventSchema>

const root = resolve(process.cwd())
const FIXTURE = resolve(root, 'data/dev-events.html')
const OUTPUT = resolve(root, 'data/events.json')

function nullable(s: string | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  return trimmed.length === 0 ? null : trimmed
}

async function main() {
  const html = await readFile(FIXTURE, 'utf8')
  const $ = load(html)
  const events: Event[] = []
  const seenSlugs = new Set<string>()

  $('article.event').each((_, el) => {
    const $el = $(el)
    const slug = ($el.attr('data-slug') ?? '').trim()
    if (!slug) {
      console.warn('skipping article without data-slug')
      return
    }
    if (seenSlugs.has(slug)) {
      console.warn(`duplicate slug ${slug}, skipping`)
      return
    }
    seenSlugs.add(slug)

    const name = $el.find('h2.name').text().trim()
    const $dates = $el.find('.dates')
    const startDate = ($dates.attr('data-start') ?? '').trim()
    const endDate = ($dates.attr('data-end') ?? startDate).trim()
    const $loc = $el.find('.location')
    const isVirtual = ($loc.attr('data-virtual') ?? 'false').toLowerCase() === 'true'
    const topics = $el.find('.topics').text().trim()
    const description = $el.find('.description').text().trim().replace(/\s+/g, ' ')
    const $cfp = $el.find('.cfp')

    const candidate = {
      slug,
      name,
      startDate,
      endDate,
      locationCity: nullable($loc.attr('data-city')),
      locationCountry: nullable($loc.attr('data-country')),
      isVirtual,
      topics,
      description,
      cfpOpenDate: nullable($cfp.attr('data-open')),
      cfpCloseDate: nullable($cfp.attr('data-close')),
      cfpUrl: nullable($cfp.attr('data-url')),
    }

    const parsed = EventSchema.safeParse(candidate)
    if (!parsed.success) {
      console.error(`invalid event ${slug}:`, parsed.error.flatten())
      return
    }
    events.push(parsed.data)
  })

  if (events.length < 80) {
    throw new Error(`expected at least 80 events, parsed ${events.length}`)
  }

  await writeFile(OUTPUT, JSON.stringify(events, null, 2) + '\n', 'utf8')
  console.log(`parsed ${events.length} events -> ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
