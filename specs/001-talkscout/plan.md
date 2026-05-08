# Implementation Plan: TalkScout

**Branch**: `001-talkscout` | **Date**: 2026-05-08 | **Spec**: [specs/001-talkscout/spec.md](spec.md)
**Input**: Feature specification from `specs/001-talkscout/spec.md`

## Summary

TalkScout is a semantic CFP (Call for Papers) finder for developer conferences. A speaker types a topic in plain English and the app returns the top 5 upcoming dev conferences whose CFP topics semantically match, ranked by cosine similarity against pre-computed 768-dimension embeddings. The system uses Next.js 15 with Server Actions, Prisma 6 with $queryRawUnsafe against SQL Server 2025 (VECTOR(768) native type), and host-side Ollama (nomic-embed-text) for embedding generation.

## Technical Context

**Language/Version**: TypeScript 5.x strict (Node.js 22 LTS)
**Primary Dependencies**: Next.js 15 App Router (Server Actions), React 19, Tailwind CSS v4, shadcn/ui, Prisma 6.x with $queryRawUnsafe and $executeRawUnsafe (SQL files loaded at runtime via src/lib/sql.ts because Prisma TypedSQL does not support the sqlserver provider), ollama npm package
**Storage**: SQL Server 2025 (mcr.microsoft.com/mssql/server:2025-latest) in Docker, AMD64 emulated on Apple Silicon via Rosetta, capped at 2 GB memory and 2 CPUs, MSSQL_MEMORY_LIMIT_MB=1800
**Testing**: `npm run typecheck`, `npm run build`, manual rehearsal stopwatch for SC-001/SC-003/SC-004. No unit test runner installed. Pure functions verified via scratch scripts against documented boundary tables.
**Target Platform**: Local development (macOS Apple Silicon), browser at localhost:3000
**Project Type**: Web application (single Next.js process, no separate API server)
**Performance Goals**: First search result under 3s (SC-001), demo:reset cold start under 90s (SC-003), embedding rebuild under 60s warm (SC-003), full demo recording under 8 minutes (SC-004)
**Constraints**: SQL Server container capped at 2 GB / 2 CPUs, embeddings via host Ollama (Metal acceleration), no cloud API keys, offline-capable demo
**Scale/Scope**: Single user (demo presenter), 80+ conference catalog, 5 results per query, 1 page UI

### Architecture

**Search hot path**: Browser submits query to Next.js Server Action (`src/app/actions.ts`). Server Action calls `embed(query)` (ollama npm package against host Ollama) to produce a 768-dim vector, then calls `prisma.$queryRawUnsafe(SEARCH_EVENTS_SQL, JSON.stringify(vector), 5)` where `SEARCH_EVENTS_SQL` is a string constant loaded from `prisma/sql/searchEvents.sql` at module load by `src/lib/sql.ts`. The SQL casts the JSON array to VECTOR(768) and ranks via `VECTOR_DISTANCE('cosine', embedding, ...)`. Returns top 5. Return shapes are typed manually using `Pick<Event, ...>` style helpers.

**Ingest path** (off the hot path, runs at seed time): `scripts/parse-dev-events.ts` parses `data/dev-events.html` (committed fixture) to `data/events.json`. `prisma/seed.ts` reads events.json, computes a content hash for each entry, batch-embeds via `embedBatch`, and MERGEs into SQL Server via `prisma.$executeRawUnsafe(UPSERT_EVENTS_SQL, ...)` where `UPSERT_EVENTS_SQL` is loaded from `prisma/sql/upsertEvents.sql` at module load by `src/lib/sql.ts`. Embeddings updated only when content hash changes.

### UI Components

- **shadcn primitives**: Input, Card, Badge, Button
- **Custom components** (3):
  - `SearchInput`: Indigo-to-purple gradient border (linear-gradient 90deg #4f46e5 to #7c3aed, 2px width, 3px on focus), placeholder cycles through 5 scripted query examples every 4s while empty and unfocused, pauses on focus
  - `EventCard`: Conference result card with name, date range, location, first 3 topic tags, CFP status pill, similarity percentage. Cards with non-null cfpUrl open in new tab; cards with null cfpUrl show no hover affordance
  - `CfpStatusPill`: Color-coded pill (emerald=open, amber=closes-in-N where N>3, red=closes-in-N where N<=3, sky=opens-in-N, zinc-muted=closed, zinc-neutral=unavailable)

### npm Scripts

| Script | Command |
|--------|---------|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `typecheck` | `tsc --noEmit` |
| `db:up` | `docker compose up -d && node scripts/wait-for-db.mjs` |
| `db:down` | `docker compose down` |
| `db:migrate` | `prisma migrate deploy` |
| `db:seed` | `tsx prisma/seed.ts` |
| `db:reset` | `prisma migrate reset --force && npm run db:seed` |
| `ingest` | `tsx scripts/parse-dev-events.ts` |
| `ingest:live` | `tsx scripts/fetch-dev-events.ts && npm run ingest` |
| `demo:reset` | `tsx scripts/demo-reset.ts` |

### Risk Register

| Risk | Mitigation |
|------|------------|
| Host Ollama not running | `demo:reset` checks Ollama health before proceeding, aborts with clear message |
| Ollama cold start latency | Catalog seeding pre-warms the model; search queries hit a warm model |
| dev.events HTML drift | Source HTML committed as fixture; `ingest:live` is opt-in, never the demo path |
| Prisma TypedSQL unsupported for sqlserver | TypedSQL preview feature does not support the sqlserver provider. Runtime-loader pattern (`src/lib/sql.ts`) loads `.sql` files via `fs.readFileSync` into named constants, invoked via `$queryRawUnsafe` / `$executeRawUnsafe`. Constitution Principle II is preserved: no SQL string literals in TypeScript, only file paths and constant names |
| Return type safety without TypedSQL | Without TypedSQL compile-time generation, return shapes are typed manually using `Pick<Event, ...>` style helpers. Verified by `npm run typecheck` |
| Pre-implement tag drift | `demo:reset` verifies tag exists before proceeding |
| VECTOR(768) cast from JSON-array string | Smoke test (scripts/smoke-test.sql) validates the cast works on this SQL Server build |
| AMD64 emulation slow first connection | `wait-for-db.mjs` retries with healthcheck; compose healthcheck has 30s start_period |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. TypeScript-First (NON-NEGOTIABLE) | PASS | All application code is TypeScript strict. No JS files in `src/`. Types flow from Prisma schema to React components. SQL return shapes typed manually via `Pick<Event, ...>` helpers since TypedSQL does not support sqlserver. |
| II. ORM-First (NON-NEGOTIABLE) | PASS | No T-SQL string literals in TypeScript. All DB calls go through Prisma. SQL Server 2025 features (VECTOR_DISTANCE, VECTOR(768), MERGE) live in `.sql` files under `prisma/sql/` loaded at runtime by `src/lib/sql.ts` and invoked via `prisma.$queryRawUnsafe(...)` / `prisma.$executeRawUnsafe(...)`. Only file paths and constant names appear in TypeScript code. Embeddings produced in Node via ollama npm package, not via T-SQL AI functions. |
| III. Demo Recordability (NON-NEGOTIABLE) | PASS | Every step produces a visible artifact. Recording fits in 8 minutes. `npm run demo:reset` returns to known-good state. Raw T-SQL shown only inside `prisma/sql/searchEvents.sql` and `prisma/sql/upsertEvents.sql`. |
| IV. Local-First, Cloud-Optional | PASS | Full stack runs locally. SQL Server 2025 in Docker, host-side Ollama. No cloud API keys. Container capped at 2 GB / 2 CPUs with MSSQL_MEMORY_LIMIT_MB=1800. |
| V. Determinism Over Cleverness | PASS | Seed data committed. Ingest reads from committed fixture. Live fetch is opt-in. Embeddings gated on content hash. Test queries documented in `data/queries.md`. |
| VI. Style Constraints | PASS | All em-dashes removed from spec.md, plan.md, and tasks.md. No contractions. Short direct sentences. Conventional Commits. |
| VII. Spec Kit Is the Source of Truth | PASS | `.specify/` and `specs/` directories drive the project. Phase order respected. Implementation follows `/speckit.tasks`. |

**Gate result: PASS. No violations. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-talkscout/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── server-actions.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
docker-compose.yml
.env.example
package.json
tsconfig.json
README.md

prisma/
├── schema.prisma
├── seed.ts
├── sql/
│   ├── upsertEvents.sql
│   └── searchEvents.sql
└── migrations/

scripts/
├── parse-dev-events.ts
├── fetch-dev-events.ts
├── demo-reset.ts
├── wait-for-db.mjs
└── smoke-test.sql

data/
├── dev-events.html
├── events.json
└── queries.md

src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── actions.ts
│   └── globals.css
├── components/
│   ├── SearchInput.tsx
│   ├── EventCard.tsx
│   ├── CfpStatusPill.tsx
│   └── ui/
└── lib/
    ├── db.ts
    ├── embed.ts
    ├── sql.ts
    └── cfp-status.ts

demo/
├── prompts.html
└── script.md
```

**Structure Decision**: Single Next.js 15 project. No separate backend; Server Actions handle all server-side logic within the same process. UI components live under `src/components/` with shadcn primitives in `src/components/ui/`. Database logic is fully encapsulated by Prisma (client in `src/lib/db.ts`, SQL loaded at runtime by `src/lib/sql.ts` from `prisma/sql/`). Embedding logic in `src/lib/embed.ts`. Ingest and demo tooling in `scripts/`. Static seed data in `data/`.

## Complexity Tracking

> No constitution violations detected. This section is intentionally empty.
