# Implementation Plan: TalkScout

**Branch**: `001-talkscout` | **Date**: 2026-05-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-talkscout/spec.md`

## Summary

A Next.js 15 + Prisma TypeScript app that semantically ranks upcoming dev conferences for CFP submission. Embeddings are generated in Node via the `ollama` npm package against host Ollama (Metal-accelerated on Apple Silicon). SQL Server 2025 stores `VECTOR(768)` columns natively and ranks at search time with `VECTOR_DISTANCE`. Catalog is seeded from a committed dev.events HTML fixture; no live network on the demo path. The whole stack resets in under 90 seconds for repeatable recording.

## Technical Context

**Language/Version**: TypeScript 5.x strict (Node.js 22 LTS)
**Primary Dependencies**: Next.js 15 App Router, React 19, Prisma 6.x with `previewFeatures = ["typedSql"]`, Tailwind CSS, shadcn/ui, `ollama` npm package
**Storage**: SQL Server 2025 (`mcr.microsoft.com/mssql/server:2025-latest`) in Docker, AMD64 emulated on M-series Macs, capped at 2 GB / 2 CPUs
**Testing**: `npm run typecheck`, `npm run build`, manual rehearsal stopwatch for SC-001/SC-003/SC-004. No unit test runner is installed; pure functions like `cfp-status` are verified by exercising them in scratch scripts against documented boundary tables (see D3 acceptance). This is appropriate for an 8-minute demo project; if the codebase grows post-demo, vitest is the recommended addition.
**Target Platform**: Local developer laptop (macOS Apple Silicon primary), Docker Desktop or OrbStack
**Project Type**: Web application (single Next.js deployable, single Prisma schema)
**Performance Goals**: First search result < 3s on warm stack (SC-001); cold demo reset < 90s (SC-003)
**Constraints**: 2 GB SQL Server memory cap; no cloud API keys; no T-SQL strings in `src/`; demo fits 8 min (SC-004)
**Scale/Scope**: 80 to 200 catalog entries (lower bound from FR-001; upper bound is the budget at which the FR-009 60s embedding budget was validated); single-page UI; 3 custom components (`SearchInput`, `EventCard`, `CfpStatusPill`) plus shadcn primitives (`Input`, `Card`, `Badge`, `Button`)

## Constitution Check

| Principle | Compliance |
|---|---|
| I. TypeScript-First | ✅ TS strict everywhere; no `.js` in `src/` |
| II. ORM-First | ✅ All SQL in `prisma/sql/` (2 files); embedding via Node, not T-SQL |
| III. Demo Recordability | ✅ `npm run demo:reset`; 8-min budget; only `searchEvents.sql` and `upsertEvents.sql` on screen |
| IV. Local-First + Quotas | ✅ Single mssql container, 2 GB / 2 CPU; host Ollama; no cloud keys |
| V. Determinism | ✅ Committed `data/dev-events.html` fixture; content-hash-gated re-embed |
| VI. Style | ✅ No em-dashes, no "I've", Conventional Commits, terse comments |
| VII. Spec Kit | ✅ Phases not skipped; this plan follows `/speckit.specify` and `/speckit.clarify` |

## Project Structure

### Documentation (this feature)

```text
specs/001-talkscout/
├── spec.md          # /speckit.specify + /speckit.clarify
├── plan.md          # this file (/speckit.plan)
├── tasks.md         # /speckit.tasks
└── (research notes folded into plan.md)
```

### Source Code (repository root)

```text
.
├── docker-compose.yml
├── prisma/
│   ├── schema.prisma
│   ├── sql/
│   │   ├── upsertEvents.sql
│   │   └── searchEvents.sql
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   ├── parse-dev-events.ts
│   ├── fetch-dev-events.ts        # --live, off-demo
│   ├── demo-reset.ts
│   ├── wait-for-db.mjs
│   └── smoke-test.sql
├── data/
│   ├── dev-events.html            # committed fixture
│   ├── events.json                # parsed
│   └── queries.md                 # scripted queries + expected top results
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── SearchInput.tsx
│   │   ├── EventCard.tsx
│   │   ├── CfpStatusPill.tsx
│   │   └── ui/                    # shadcn primitives
│   └── lib/
│       ├── db.ts
│       ├── embed.ts               # Ollama wrapper
│       └── cfp-status.ts          # pure date → pill state
└── demo/
    ├── prompts.html
    └── script.md
```

## Architecture

### Search hot path

```
Browser ─► Server Action ─┬─► embed(query) via host Ollama (Metal)
                          └─► prisma.$queryRawTyped(searchEvents(vector))
                              ├─► CAST(@P1 AS VECTOR(768))
                              └─► VECTOR_DISTANCE('cosine', embedding, ...) TOP 5
```

### Ingest path (off the hot path)

```
data/dev-events.html ─► scripts/parse-dev-events.ts ─► data/events.json
                                                          │
                                                          ▼
                                          prisma/seed.ts:
                                            for each entry: hash content
                                            for changed entries: embedBatch via Ollama
                                            push JSON (with embeddings) ──▶
                                          prisma/sql/upsertEvents.sql (MERGE)
```

## Data Model

`prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["typedSql"]
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model Event {
  id              String                       @id @default(cuid())
  slug            String                       @unique
  name            String
  startDate       DateTime
  endDate         DateTime
  locationCity    String?
  locationCountry String?
  isVirtual       Boolean                      @default(false)
  topics          String                       // comma-separated; small dataset
  description     String                       @db.NVarChar(Max)
  cfpOpenDate     DateTime?
  cfpCloseDate    DateTime?
  cfpUrl          String?
  contentHash     String                       // sha256 of (description + topics)
  embedding       Unsupported("VECTOR(768)")?
  ingestedAt      DateTime                     @default(now())
  updatedAt       DateTime                     @updatedAt

  @@map("Event")
}
```

`Unsupported("VECTOR(768)")` lets Prisma migrate the column and exposes it to TypedSQL while keeping it out of the generated client surface.

## TypedSQL Files (the only T-SQL in the repo)

### `prisma/sql/upsertEvents.sql`
A `MERGE` from a JSON parameter (`@P1 NVARCHAR(MAX)`) into `dbo.Event`. Each entry includes the pre-computed embedding as a JSON array of 768 floats (cast to `VECTOR(768)` server-side via `CAST(JSON_VALUE(...) AS VECTOR(768))`). On match, updates only when `contentHash` differs.

### `prisma/sql/searchEvents.sql` (the on-camera SQL file)

```sql
-- @param {String} $1:queryEmbeddingJson
-- @param {Int}    $2:limit
SELECT TOP (@P2)
  id, slug, name, startDate, endDate, locationCity, locationCountry,
  isVirtual, topics, description, cfpOpenDate, cfpCloseDate, cfpUrl,
  1.0 - VECTOR_DISTANCE('cosine', embedding,
    CAST(@P1 AS VECTOR(768))) AS similarity
FROM Event
WHERE embedding IS NOT NULL
ORDER BY similarity DESC;
```

Eight lines. The on-camera "look how clean SQL Server 2025's vector story is" beat: a native `VECTOR(768)` column, a one-call `VECTOR_DISTANCE`, ranked top-N.

## Embedding helper (`src/lib/embed.ts`)

```ts
import { Ollama } from 'ollama'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST })
const MODEL = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text'

export async function embed(input: string): Promise<number[]> {
  const { embeddings } = await ollama.embed({ model: MODEL, input })
  return embeddings[0]
}

export async function embedBatch(inputs: string[]): Promise<number[][]> {
  const { embeddings } = await ollama.embed({ model: MODEL, input: inputs })
  return embeddings
}
```

## Application call site (`src/app/actions.ts`)

```ts
'use server'
import { searchEvents } from '@prisma/client/sql'
import { prisma } from '@/lib/db'
import { embed } from '@/lib/embed'

export async function search(query: string) {
  if (query.length > 500) return { ok: false as const, error: 'query-too-long' as const }
  let vector: number[]
  try {
    vector = await embed(query)
  } catch {
    return { ok: false as const, error: 'embedding-unavailable' as const }
  }
  const results = await prisma.$queryRawTyped(searchEvents(JSON.stringify(vector), 5))
  return { ok: true as const, results }
}
```

Compact business logic with the FR-004 error contract: one embed call inside try/catch, one typed query, no SQL strings in app code. Database errors are intentionally not caught here (they propagate as a 500, acceptable for demo scope; see U2 in `analysis.md`).

## npm Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "db:up": "docker compose up -d && node scripts/wait-for-db.mjs",
  "db:migrate": "prisma migrate deploy",
  "db:seed": "tsx prisma/seed.ts",
  "db:reset": "prisma migrate reset --force && npm run db:seed",
  "ingest": "tsx scripts/parse-dev-events.ts",
  "ingest:live": "tsx scripts/fetch-dev-events.ts && npm run ingest",
  "demo:reset": "tsx scripts/demo-reset.ts"
}
```

## UI Notes

- shadcn primitives: `Input`, `Card`, `Badge`, `Button`. Everything else hand-rolled with Tailwind.
- **Search input gradient border:** indigo-to-purple, `linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)`, 2px width, 3px on focus. Matches the `#4f46e5` accent used in `demo/prompts.html`.
- **Placeholder cycling:** every 4s while the input is empty and unfocused, cycle through the 5 scripted query examples from `data/queries.md`.
- **CFP pill colors** (Tailwind classes):
  - "CFP open" (>14d): `bg-emerald-100 text-emerald-700` / dark `bg-emerald-900/30 text-emerald-300`
  - "CFP closes in N", N > 3: `bg-amber-100 text-amber-700`
  - "CFP closes in N", N ≤ 3: `bg-red-100 text-red-700`
  - "CFP opens in N": `bg-sky-100 text-sky-700`
  - "CFP closed": `bg-zinc-100 text-zinc-500`
  - "CFP info unavailable": `bg-zinc-50 text-zinc-400`
- **Similarity %**: integer rounding via `Math.round(score * 100)`. No decimals.
- **Dark mode**: CSS variables, system-preference responsive, no in-app toggle (the `demo/prompts.html` artifact has its own toggle for the teleprompter; the app does not).

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Host Ollama not running before `npm run dev` | Medium | `npm run dev` script pre-checks Ollama health on `OLLAMA_HOST`; aborts with a clear error if not reachable |
| Ollama cold start adds latency on first search | Low | `db:seed` exercises the embedding model end-to-end, leaving Ollama warm. SC-001 explicitly assumes Ollama is warm (see spec.md). No separate boot-time warmup needed in the Next.js process. |
| dev.events HTML changes between fixture capture and recording | Low | Fixture is committed; `--live` is never the demo path |
| Prisma TypedSQL doesn't return `Unsupported` columns | Low | Cast `embedding` away in the SELECT; never return it to TS |
| Repeatability: `pre-implement` git tag drifts | Low | `demo:reset` checks the tag exists and aborts loudly otherwise |
| `VECTOR(768)` cast from JSON-array string fails | Low | Smoke test verified the cast works; if SQL Server requires varbinary instead, `embed.ts` adapts |
| AMD64 emulation slow on first connection | Expected | Rosetta caches; first connection ≤ 60s, subsequent fast |

## Smoke Test Status

The Phase 1 smoke test (`scripts/smoke-test.sql`) passed: `VECTOR(768)` literal cast works, `VECTORPROPERTY` returns 768, `VECTOR_DISTANCE('cosine', ...)` returns sensible distances. Greenlight for `/speckit.implement`.

## Definition of Done

- `npm run demo:reset` followed by `npm run dev` produces a working app in under 90 seconds (SC-003).
- Both scripted queries return their intended top result (SC-002).
- `npm run typecheck` and `npm run build` pass.
- `demo/prompts.html` and `demo/script.md` complete, rehearsed once end-to-end (SC-004).
