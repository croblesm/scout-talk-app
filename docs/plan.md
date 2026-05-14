# TalkScout — Foundation plan

This is the one-page plan I wrote before starting. It locks in the data layer, the embedding pipeline, and the SQL boundary — the parts I want done before any agent gets involved. The search UI itself comes later, and not from a plan like this: as an OpenSpec change.

## Goal

Build a CFP finder that takes a plain-English description of a talk and returns the upcoming conferences whose CFP topics match. End to end inside VS Code. No external vector store, no cloud embedding API.

## Stack choices (and why)

| Layer | Choice | Why |
|---|---|---|
| Database | SQL Server 2025 (container, local) | Native `VECTOR(768)` data type and `VECTOR_DISTANCE` function. One database for both the relational rows and the embeddings. |
| Embeddings | Ollama on the host, `nomic-embed-text` (768-dim) | Free, no API key, no data egress. Apple Silicon Metal acceleration is host-only. |
| ORM / driver | Prisma 7 with `@prisma/adapter-mssql` | Typed bridge from TypeScript to SQL. Schema migrations live in the repo. |
| SQL boundary | All T-SQL in `prisma/sql/*.sql`, loaded once at module load | Application TypeScript never holds a SQL string literal. One file per query. |

## Data model

One table, `Event`. Relational columns for the bookkeeping (slug, name, dates, location, topics, CFP window, contentHash) and one native vector column for the embedding:

```prisma
model Event {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  startDate       DateTime
  endDate         DateTime
  topics          String   @db.NVarChar(Max)
  description     String   @db.NVarChar(Max)
  cfpOpenDate     DateTime?
  cfpCloseDate    DateTime?
  contentHash     String   @db.Char(64)
  embedding       Unsupported("VECTOR(768)")?
  // ...
}
```

`Unsupported("VECTOR(768)")` is how Prisma carries the vector column through migrations without trying to type it in client code. The actual `CAST(... AS VECTOR(768))` happens in T-SQL.

## Seed pipeline

1. Read `data/events.json` (91 events curated by hand).
2. For each event, compute a `contentHash` over the natural fields. Skip embedding if the hash matches what is already in the DB.
3. Batch the new/changed events through `embedBatch()` against host Ollama (`nomic-embed-text`, 768-dim). Returns one float[768] per event.
4. `MERGE` into `Event` via `prisma/sql/upsertEvents.sql`. The MERGE casts the JSON-encoded embedding to `VECTOR(768)` inside T-SQL. Re-running on unchanged data is a no-op.

## SQL boundary

`src/lib/sql.ts` reads `prisma/sql/*.sql` once at module load and exports the contents as named string constants (`SEARCH_EVENTS_SQL`, `UPSERT_EVENTS_SQL`). Application code passes those constants to `prisma.$queryRawUnsafe` / `$executeRawUnsafe` with bound parameters. No T-SQL anywhere in `.ts` files.

Why not Prisma TypedSQL? TypedSQL does not support the `sqlserver` provider as of Prisma 7.x. The load-at-startup pattern is the SQL Server workaround.

## What this gets me

A seeded local stack with 91 events, each with a 768-dim embedding, queryable by `VECTOR_DISTANCE` against the user's embedded query. The placeholder page at `src/app/page.tsx` is intentionally inert — the search UI is the next layer, and the first layer I want delivered agentically.

## Next

Add the search UI: a server action that embeds a query, runs the ranked search, and returns the top five; the React components that render results; the wiring in `page.tsx` that replaces the placeholder.

**I want this next layer to be agentic.** Instead of writing the components by hand, I want to propose the change in plain English, let an agent generate the spec (proposal + design + tasks), review it, then have the same agent apply it. That is what OpenSpec is for. From here on, every change is a `/opsx-propose` followed by an `/opsx-apply`.
