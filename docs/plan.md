# TalkScout — Plan

A CFP finder. The user types a plain-English description of a talk; the app returns the upcoming conferences whose CFP topics semantically match. End to end inside VS Code. No external vector store, no cloud embedding API.

## Stack

| Layer | Choice |
|---|---|
| Database | SQL Server 2025, native `VECTOR(768)` + `VECTOR_DISTANCE` |
| Embeddings | Ollama on the host, `nomic-embed-text` (768-dim) |
| ORM | Prisma 7 with `@prisma/adapter-mssql` |
| SQL boundary | All T-SQL in `prisma/sql/*.sql`, loaded once at module load |
| UI | Next.js 15 Server Action + three React components |

## Data model

One table, `Event`. Relational columns plus a native vector column:

```prisma
model Event {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  topics       String   @db.NVarChar(Max)
  cfpOpenDate  DateTime?
  cfpCloseDate DateTime?
  embedding    Unsupported("VECTOR(768)")?
  // ...
}
```

`Unsupported("VECTOR(768)")` carries the column through Prisma migrations. The `CAST(... AS VECTOR(768))` happens in T-SQL.

## Seed

1. Read `data/events.json` (91 conferences, curated).
2. Content-hash each row; skip embedding if the hash is unchanged.
3. Batch through `embedBatch()` against host Ollama.
4. `MERGE` into `Event` via `prisma/sql/upsertEvents.sql`.

## Search

A Server Action `searchEvents(query)`:

1. Embed the query via Ollama (768-dim).
2. Run `prisma/sql/searchEvents.sql` with the query vector and a top-N limit.
3. Return the ranked rows to the React page.

Three components render the result: `SearchInput`, `EventCard`, `CfpStatusPill`. The page composition replaces the placeholder in `src/app/page.tsx`.
