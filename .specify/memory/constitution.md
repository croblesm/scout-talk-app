<!--
  Sync Impact Report
  ==================
  Version change: (new) → 1.0.0
  Modified principles: none (initial ratification)
  Added sections: Core Principles (I-VII), Governance
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible
      (Constitution Check section present; gates derived at plan time)
    - .specify/templates/spec-template.md ✅ compatible
      (no constitution-specific sections required)
    - .specify/templates/tasks-template.md ✅ compatible
      (phase structure aligns with Spec Kit ordering principle)
  Follow-up TODOs: none
-->

# TalkScout Constitution

## Core Principles

### I. TypeScript-First (NON-NEGOTIABLE)

All application code is TypeScript in `strict` mode. No JavaScript files in `src/`. No `any` without a justification on the same line. Types come from Prisma (including TypedSQL) wherever a database value crosses into the app.

**Rationale:** Type safety from the schema all the way to the React component is the demo's payoff. Loose typing anywhere undermines the ORM-first principle below.

### II. ORM-First (NON-NEGOTIABLE)

The TypeScript application code never contains T-SQL string literals. Every database call goes through Prisma. When a query needs SQL Server 2025 features that Prisma's query builder cannot express (notably `VECTOR_DISTANCE`, the `VECTOR(768)` data type, and `MERGE` upserts), it lives in a TypedSQL file under `prisma/sql/` and is invoked via `prisma.$queryRawTyped(...)`. The call site in TypeScript reads as one line.

`prisma/sql/` is the only place raw SQL exists in the repository.

Embedding generation is **not** a database concern. Embeddings are produced in Node via the `ollama` npm package and pushed into SQL Server as `VECTOR(768)` values. We do not use `CREATE EXTERNAL MODEL`, `AI_GENERATE_EMBEDDINGS`, or `AI_GENERATE_CHUNKS`. Those proved fragile (HTTPS-only external endpoints, undocumented function signatures) and are not on the demo path.

### III. Demo Recordability (NON-NEGOTIABLE)

Every step of the build produces a visible artifact (markdown, SQL, TypeScript, or UI) suitable for showing on screen. The recording fits in eight minutes with comfortable pauses. The recording is repeatable: a single command (`npm run demo:reset`) returns the repository and the database to a known-good pre-recording state, so any take can be retaken without manual cleanup.

No raw T-SQL is shown on camera except inside `prisma/sql/searchEvents.sql` and `prisma/sql/upsertEvents.sql`, which are the deliberate "look how the SQL stays in one place" beats.

### IV. Local-First, Cloud-Optional

The full stack runs locally: SQL Server 2025 in Docker, host-side Ollama for embeddings. No cloud API keys are required to run the demo. Ollama runs on the host (not in a container) because Apple Silicon's Metal acceleration is significantly faster than CPU-bound Linux containers for embedding generation.

**Container resource quotas (NON-NEGOTIABLE):** every SQL Server container in this project is capped at 2 GB memory and 2 CPUs (matching the developer's existing `sql_copilot` baseline). The internal `MSSQL_MEMORY_LIMIT_MB` is set to 1800 to leave headroom under the cgroup. An unbounded SQL Server container can absorb half the laptop's RAM and ruin the recording.

### V. Determinism Over Cleverness

Seed data is checked in. Ingest reads from a committed fixture by default; live network fetches are an opt-in flag, never the demo path. Embedding generation is gated on a content hash so re-runs are idempotent and fast. Test queries used in the recording are written down in `data/queries.md` with their expected top results.

### VI. Style Constraints

No em-dashes in any generated documentation, comment, commit message, or script. Use commas, periods, or parentheses. No "I've" contraction; write "I have". Sentences are short and direct. Commit messages follow Conventional Commits.

### VII. Spec Kit Is the Source of Truth

The `.specify/` and `specs/` directories drive the project. The order is `/speckit.constitution` → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`. Phases are not skipped. Implementation never runs ahead of `/speckit.tasks`. When the spec and the code disagree, the spec is corrected first, then the code is brought into alignment.

## Governance

The constitution may be amended only between recordings. An amendment is a commit that edits this file with a one-paragraph rationale in the commit message. Amendments are not made on demo day. All `/speckit.plan` and `/speckit.tasks` outputs must verify compliance with the principles above before code is written.

**Version**: 1.0.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
