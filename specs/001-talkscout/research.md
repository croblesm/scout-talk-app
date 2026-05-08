# Research: TalkScout

**Feature**: 001-talkscout | **Date**: 2026-05-08

## Overview

Technical context was provided verbatim by the user. No NEEDS CLARIFICATION items were identified during Technical Context evaluation. This research document consolidates best-practice findings and rationale for the key technology decisions.

## R-001: SQL Server 2025 VECTOR(768) on Apple Silicon

**Decision**: Use SQL Server 2025 native VECTOR(768) type with AMD64 emulation via Rosetta in Docker, capped at 2 GB memory / 2 CPUs.

**Rationale**: SQL Server 2025 provides native vector storage and VECTOR_DISTANCE for cosine similarity ranking, eliminating the need for an external vector database. The VECTOR(768) type is first-class, supporting index-friendly distance operations. Phase 1 smoke test (scripts/smoke-test.sql) has already validated VECTOR(768) literal cast, VECTORPROPERTY returning 768 dimensions, and VECTOR_DISTANCE returning correct relative distances.

**Alternatives considered**:
- pgvector on PostgreSQL: Mature vector extension but would require switching the entire database stack away from the demo's SQL Server 2025 focus.
- Dedicated vector DB (Qdrant, Pinecone): Adds infrastructure complexity and a cloud dependency, violating Principle IV (Local-First).
- In-memory cosine similarity in Node: Would not demonstrate SQL Server 2025 capabilities, the primary demo point.

## R-002: Embedding Model Selection (nomic-embed-text via Ollama)

**Decision**: Use nomic-embed-text (768-dim) via host-side Ollama, invoked from Node using the ollama npm package.

**Rationale**: nomic-embed-text produces 768-dimension embeddings, matching SQL Server 2025's VECTOR(768) type. Running on the host via Ollama leverages Apple Silicon Metal acceleration (5-10x faster than CPU-bound containers). The ollama npm package provides a clean TypeScript API. Embeddings are produced in Node, not in T-SQL, honoring Constitution Principle II (ORM-First).

**Alternatives considered**:
- OpenAI text-embedding-3-small: Requires cloud API key, violating Principle IV (Local-First).
- SQL Server AI_GENERATE_EMBEDDINGS: Requires CREATE EXTERNAL MODEL with HTTPS endpoints. Proved fragile (undocumented function signatures). Not on the demo path per Constitution Principle II.
- Ollama in Docker container: CPU-only in Linux containers on Apple Silicon. 5-10x slower than host Metal acceleration.

## R-003: Prisma Raw SQL with Runtime-Loaded SQL Files

**Decision**: Use Prisma 6.x with `$queryRawUnsafe` and `$executeRawUnsafe`. SQL files at `prisma/sql/upsertEvents.sql` and `prisma/sql/searchEvents.sql` are loaded at module load by `src/lib/sql.ts` via `fs.readFileSync` into named string constants (`SEARCH_EVENTS_SQL`, `UPSERT_EVENTS_SQL`). The embedding column uses `Unsupported("VECTOR(768)")` so Prisma can migrate the schema while keeping the column out of the generated client surface. Return shapes are typed manually using `Pick<Event, ...>` style helpers.

**Rationale**: Prisma's TypedSQL preview feature only supports postgresql, cockroachdb, mysql, and sqlite providers. It does not support sqlserver. The runtime-loader pattern preserves Constitution Principle II: all T-SQL lives in exactly two `.sql` files under `prisma/sql/`, and only file paths and constant names appear in TypeScript code. The `Unsupported` column type allows Prisma to create and migrate the table without generating client-side types for a column it cannot natively represent.

**Alternatives considered**:
- Prisma TypedSQL (`$queryRawTyped`): Would provide compile-time type generation for `.sql` files, but the preview feature does not support the sqlserver provider. Attempted and confirmed unsupported.
- Raw `prisma.$queryRaw` with inline template literals: Would place T-SQL strings in TypeScript files, violating Principle II.
- Drizzle ORM: Less mature SQL Server support. Would require rewriting the schema definition.
- Direct mssql/tedious driver: Bypasses ORM entirely, losing type safety and violating Principle II.

## R-004: Content Hash Gating for Idempotent Ingestion

**Decision**: Each event gets a SHA-256 content hash computed from its semantic fields (name, description, topics, dates, location). Embeddings are regenerated only when the hash changes. Upsert uses SQL Server MERGE keyed on slug.

**Rationale**: Content hash comparison makes re-ingestion idempotent and fast (FR-002). Embedding generation is the expensive operation; skipping unchanged entries keeps `demo:reset` under the 60-second warm-stack target (SC-003). The MERGE statement in `upsertEvents.sql` handles insert-or-update in a single atomic operation.

**Alternatives considered**:
- Timestamp-based change detection: Fragile when source data is re-parsed from a static fixture (timestamps would always change).
- Delete-and-reinsert: Wastes embedding computation on unchanged entries. Would not meet the 60-second warm target.

## R-005: Demo Reset Strategy

**Decision**: `npm run demo:reset` runs `scripts/demo-reset.ts` which: (1) checks for dirty working tree (aborts if dirty), (2) checks for pre-implement git tag (aborts if missing), (3) resets git to the tag, (4) brings up Docker stack via `db:up`, (5) runs migrations via `db:migrate`, (6) seeds the database (which re-embeds only changed entries). Total cold-start target: under 90 seconds.

**Rationale**: The entire feature exists to support a repeatable demo recording (Constitution Principle III). The dirty-tree and tag checks prevent accidental state loss. Content-hash gating on embeddings makes warm resets fast.

**Alternatives considered**:
- Docker volume snapshot restore: Faster but fragile across Docker/OrbStack versions and not portable.
- SQL Server database backup/restore: Adds complexity and a large binary file to the repo.

## R-006: CFP Status Pill Logic

**Decision**: Pure function `cfp-status.ts` computes pill state from cfpOpenDate, cfpCloseDate, and current date. Five mutually exclusive states with prescribed colors. Most-urgent state wins on overlap. Boundary: N=14 renders amber, N=3 renders red.

**Rationale**: Deterministic pure function with no dependencies. Can be verified by exercising against a boundary table in a scratch script. The state machine is simple enough that a truth table covers all cases.

**Alternatives considered**:
- Server-side computation in the SQL query: Would embed business logic in T-SQL, violating Principle II.
- Client-side date library (date-fns, dayjs): Adds a dependency for simple day-difference arithmetic. Native Date subtraction suffices.

## R-007: Search Result Empty-State Threshold

**Decision**: Show empty-state message when top result similarity < 0.55 AND the gap between 1st and 5th result < 0.05. If fewer than 5 embedded events exist, the margin condition is treated as not met (results are always shown).

**Rationale**: The dual condition prevents false empty states. A low top score alone might be acceptable if results are well-separated (the query is niche but matches exist). A narrow margin alone might occur with a good top match (all results are relevant). Both conditions together indicate genuinely poor matches. The fewer-than-5 escape hatch prevents empty states during development with sparse data.

**Alternatives considered**:
- Single threshold (top score only): Would hide results that are low-scoring but clearly differentiated.
- No threshold: Would always show results even for nonsensical queries, degrading perceived quality.
