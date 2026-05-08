# Scripted Demo Queries

Every query below is exercised at recording time. Two are primary (on camera). Three are backups, held in reserve in case the seed shifts between rehearsal and tape and the primaries regress. Each query lists the query string, the intended top result (verified after `npm run db:seed` against the search Server Action), and a one-line "why this lands" note explaining the vocabulary-mismatch hook.

## Primary queries (on camera)

### Q1. agentic workflows for databases

**Top result observed (current seed):** `AI Engineer Summit London 2026` (slug: `ai-eng-summit-london-2026`), similarity ~0.65. Runner-up: `KubeCon + CloudNativeCon North America 2026`.
**Why this lands:** the AI Engineer Summit London description uses "autonomous AI tooling, MCP server design, agent orchestration patterns, self-driving query planners". The word "agentic" appears nowhere in the title, topics, or description. The KubeCon NA runner-up surfaces because of "stateful workloads" plus the database-related tags. Acceptable alternates: `AI Engineer World's Fair 2026` (`aiengworldsfair-2026`), `Incident Response Summit 2026` (`incident-response-summit-2026`).

### Q2. type safety across the stack

**Top result observed (current seed):** `State of TypeScript Summit 2026` (slug: `state-of-typescript-2026`), similarity ~0.54.
**Why this lands:** the description names "TypeScript 6 features, end-to-end inference patterns across client and server, contract-driven API design". The phrase "type safety" appears nowhere in the description. Acceptable alternates: `tRPC Conf 2026` (`trpc-conf-2026`), `JSConf EU 2026` (`jsconf-eu-2026`), `Next.js Conf 2026` (`nextjs-conf-2026`).

## Backup queries (held in reserve)

### Q3. talking about Postgres performance

**Top result observed (current seed):** `Velocity London 2026` (`velocity-london-2026`), similarity ~0.61. Note: this query has weaker semantic separation in the current seed because several events use "performance" verbatim. PostgresConf NYC ranks lower than expected. Use Q4 or Q5 as backups instead during recording. Reserved for emergency use only; consider tuning before relying on it.

### Q4. building reliable AI evaluation pipelines

**Top result expected:** `LLMs in Production Summit 2026` (slug: `llms-in-prod-2026`).
**Why this lands:** description names "building reliable evaluation pipelines, regression detection, prompt-injection defense, and quality observability for inference workloads" almost verbatim. Alternates: `Data Science Salon NYC 2026` (`data-science-salon-2026`), `Databricks Data + AI Summit 2026` (`databricks-data-ai-summit-2026`), `AI Engineer World's Fair 2026` (`aiengworldsfair-2026`).

### Q5. running databases on Kubernetes at scale

**Top result expected:** `KubeCon + CloudNativeCon North America 2026` (slug: `kubecon-cloudnativecon-na-2026`).
**Why this lands:** description names "running databases at scale on Kubernetes operators, persistent volumes, backup, and storage-layer optimizations" almost verbatim. Alternates: `Cassandra Summit 2026` (`cassandra-summit-2026`), `KubeCon + CloudNativeCon Europe 2026` (`kubecon-cloudnativecon-eu-2026`).

## Verification procedure

After every `npm run db:seed`, run each primary query through the search Server Action (or via a scratch script that imports `embed` and `prisma.$queryRawUnsafe(SEARCH_EVENTS_SQL, ...)`) and confirm the top result matches one of the expected slugs above. If the top result is something else, the seed has drifted and either a content edit or a re-seed is required before recording.

The two primaries (Q1 and Q2) are the on-camera moments. The three backups are warm spares. Never use a query not on this list during recording.
