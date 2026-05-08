/**
 * Seed pipeline: read events.json, compute content hash per entry,
 * batch-embed via host Ollama, MERGE into SQL Server via the
 * upsertEvents.sql TypedSQL file.
 *
 * Re-running on unchanged data is a no-op (content-hash gated).
 */
import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { embedBatch } from '../src/lib/embed'
import { UPSERT_EVENTS_SQL } from '../src/lib/sql'

type EventInput = {
  slug: string
  name: string
  startDate: string
  endDate: string
  locationCity: string | null
  locationCountry: string | null
  isVirtual: boolean
  topics: string
  description: string
  cfpOpenDate: string | null
  cfpCloseDate: string | null
  cfpUrl: string | null
}

type EventForUpsert = EventInput & {
  contentHash: string
  embedding: number[] | null
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function embeddingInput(e: EventInput): string {
  return `${e.name}\n\nTopics: ${e.topics}\n\n${e.description}`
}

function contentHashInput(e: EventInput): string {
  return `${e.description}\n\n${e.topics}`
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set (see .env.example)')
  }
  const adapter = new PrismaMssql(databaseUrl)
  const prisma = new PrismaClient({ adapter })
  try {
    const eventsPath = resolve(process.cwd(), 'data/events.json')
    const raw = await readFile(eventsPath, 'utf8')
    const events: EventInput[] = JSON.parse(raw)
    console.log(`loaded ${events.length} events from ${eventsPath}`)

    const hashed = events.map((e) => ({ ...e, contentHash: sha256Hex(contentHashInput(e)) }))

    const existing = await prisma.event.findMany({ select: { slug: true, contentHash: true } })
    const existingMap = new Map(existing.map((row) => [row.slug, row.contentHash]))

    const needsEmbed = hashed.filter((e) => existingMap.get(e.slug) !== e.contentHash)
    console.log(`${needsEmbed.length} events need (re)embedding; ${hashed.length - needsEmbed.length} unchanged`)

    let embeddings: number[][] = []
    if (needsEmbed.length > 0) {
      console.time('embed')
      embeddings = await embedBatch(needsEmbed.map(embeddingInput))
      console.timeEnd('embed')
    }

    const embedBySlug = new Map<string, number[]>()
    needsEmbed.forEach((e, i) => {
      const v = embeddings[i]
      if (v) embedBySlug.set(e.slug, v)
    })

    const payload: EventForUpsert[] = hashed.map((e) => ({
      ...e,
      embedding: embedBySlug.get(e.slug) ?? null,
    }))

    console.time('upsert')
    await prisma.$executeRawUnsafe(UPSERT_EVENTS_SQL, JSON.stringify(payload))
    console.timeEnd('upsert')

    const totalRows = await prisma.event.count()
    console.log(
      `done: ${totalRows} rows total, ${needsEmbed.length} (re)embedded, ${hashed.length - needsEmbed.length} unchanged`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
