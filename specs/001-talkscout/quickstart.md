# Quickstart: TalkScout

**Feature**: 001-talkscout | **Date**: 2026-05-08

## Prerequisites

- **Node.js 22 LTS** (with npm)
- **Docker** (Docker Desktop or OrbStack) with AMD64 emulation support
- **Ollama** installed on the host with `nomic-embed-text` model pulled

## First-Time Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url> && cd scout-talk-app
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env if needed (defaults work for local development)

# 3. Pull the embedding model (if not already available)
ollama pull nomic-embed-text

# 4. Start SQL Server and wait for healthy
npm run db:up

# 5. Run database migrations
npm run db:migrate

# 6. Parse source data and seed the database (includes embedding generation)
npm run ingest
npm run db:seed

# 7. Start the development server
npm run dev
# Open http://localhost:3000
```

## Demo Reset (Repeatable State)

```bash
# Returns repo and database to known-good pre-recording state
npm run demo:reset

# This command:
# - Aborts if working tree is dirty
# - Aborts if pre-implement git tag is missing
# - Resets git to the pre-implement tag
# - Starts Docker stack (if not running)
# - Runs migrations
# - Seeds database (re-embeds only changed entries)
# - Builds and starts the app
```

**Cold start target**: Under 90 seconds total.
**Warm start target**: Embedding rebuild under 60 seconds.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (see .env.example) | SQL Server connection string |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint (host-side) |

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:up` | Start SQL Server container |
| `npm run db:down` | Stop SQL Server container |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed database with events and embeddings |
| `npm run ingest` | Parse dev-events.html to events.json |
| `npm run demo:reset` | Full demo reset |

## Verification

After setup, verify the system works:

1. Open http://localhost:3000
2. Type "agentic workflows for databases" in the search input
3. Results should appear within 3 seconds
4. The top result should match the documented expected result in `data/queries.md`
