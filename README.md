# TalkScout

A semantic search app for finding upcoming dev conferences whose CFP topics match a talk you want to give. Built end to end inside VS Code with OpenSpec, GitHub Copilot, the MSSQL VS Code extension, Prisma raw queries, and SQL Server 2025's native vector data type.

This repo is the source artifact for an 8-minute Data Exposed YouTube demo. It is also a working app you can run locally or in a fully-isolated dev container.

## Prerequisites

You need three things on your host before the dev container or the manual quickstart will work end to end:

### 1. Docker

[Docker Desktop](https://www.docker.com/products/docker-desktop/), [OrbStack](https://orbstack.dev/) (recommended on Apple Silicon for speed), or [Rancher Desktop](https://rancherdesktop.io/). Verify with:

```bash
docker --version
docker compose version
```

### 2. Ollama (host install, NOT containerized)

TalkScout uses [Ollama](https://ollama.com) on the host (not inside a container) to embed search queries. Apple Silicon's Metal acceleration is host-only and produces embeddings roughly 5 to 10 times faster than the CPU-bound Linux container variant. The dev container reaches host Ollama at `http://host.docker.internal:11434`.

#### 1. Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download from https://ollama.com/download
```

#### 2. Start Ollama

Start the Ollama server in a dedicated terminal and **keep it running**:

```bash
ollama serve
```

> [!IMPORTANT]
> The Ollama server must be running before you can pull models or use the AI service. On systems without systemd (e.g., GitHub Codespaces), you must start it manually each time.

#### 3. Pull the required model

In a **new terminal** (while `ollama serve` is still running):

```bash
ollama pull nomic-embed-text   # Embedding model (768-dimensional)
```

#### 4. Verify

```bash
ollama list
# Expected: a row containing "nomic-embed-text"

curl -s http://localhost:11434/api/tags | grep nomic-embed-text
# Expected: a JSON line mentioning the model
```

### 3. (Optional) Node.js 22.13+

Only needed if you skip the dev container and use [Quickstart (manual)](#quickstart-manual) instead. The dev container ships with Node 22 already.

```bash
# via nvm (recommended; includes the version this repo expects)
nvm install 22
nvm use 22
node --version
# v22.x.x
```

## One-click setup

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/croblesm/scout-talk-app)

Click the badge above (or clone and run **"Dev Containers: Reopen in Container"** in VS Code). Works on Apple Silicon (ARM, Rosetta-emulated mssql), Intel Macs, Linux, and Windows. About 3 minutes to first `npm run dev`.

The dev container ships with:

- Node.js 22 + npm + tsx + git (`mcr.microsoft.com/devcontainers/typescript-node:22-bookworm`, multi-arch)
- Docker CLI wired to your **host's** Docker daemon (the `docker-outside-of-docker` feature mounts the host socket). Running `docker compose up` from inside the container launches SQL Server on the host as a sibling container.
- VS Code extensions auto-installed: MSSQL, GitHub Copilot, GitHub Copilot Chat, Prisma, Tailwind, ESLint, Prettier, Docker, OpenSpec
- `postCreateCommand` runs `npm install && npx prisma generate`

Ollama still runs on your **host**, not in the container. The dev container reaches it via `OLLAMA_HOST=http://host.docker.internal:11434`. This keeps Metal acceleration on Apple Silicon (roughly 5 to 10 times faster than CPU-bound Linux Ollama) and avoids the broken zstd extraction in older Ollama dev container features.

> [!IMPORTANT]
> Complete the [Ollama section of Prerequisites](#2-ollama-host-install-not-containerized) **before** you open the dev container. The container assumes `ollama serve` is already running on your host with `nomic-embed-text` pulled.

After the container opens, follow the [Quick Start (in the container)](#quick-start-in-the-container) steps to start SQL Server, run migrations, and seed the catalog.

## Quick Start (in the container)

After **"Dev Containers: Reopen in Container"** finishes and you see a terminal in VS Code, run these in order. About 90 seconds total.

```bash
# 1. Start SQL Server 2025 on the host's Docker daemon (the dev container uses
#    docker-outside-of-docker so this is the same SQL Server you'd run on the host)
docker compose up -d
node scripts/wait-for-db.mjs

# 2. Apply migrations and seed the catalog (91 events with embeddings via host Ollama)
cp .env.example .env
npx prisma migrate deploy
npm run db:seed

# 3. Start the dev server
npm run dev
```

Open `http://localhost:3000`. Type a search like "agentic workflows for databases" and you should see 5 ranked results within a few seconds.

## What you need

| Requirement | Why |
|---|---|
| Apple Silicon Mac (M1/M2/M3/M4) | Optimal Ollama performance via Metal acceleration |
| OrbStack or Docker Desktop | Runs SQL Server 2025 in a Linux container (AMD64 emulation) |
| Node.js 22 LTS | Required by Next.js 15 and Prisma 6 |
| npm 10+ | Bundled with Node 22 |
| [Ollama](https://ollama.com) on the host | Generates embeddings (CPU-bound in containers, Metal-accelerated on the host) |
| [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) | Drives the spec-driven workflow. Used as `npx openspec` from this repo (no global install needed). |
| [GitHub Copilot in VS Code](https://github.com/features/copilot) | For the live demo segment. Optional for normal development. |
| [GitHub Copilot CLI](https://docs.github.com/copilot/github-copilot-in-the-cli) | Optional. Used for the demo cameo at 6:30. |
| [MSSQL VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-mssql.mssql) | Connects to the SQL Server container and runs query editor demos |

## Dev container (recommended for first-time users)

The dev container packages the Node.js workspace (correct version) and every VS Code extension this project uses. The Docker CLI inside the container is wired to your **host's** Docker daemon (`docker-outside-of-docker`), so `docker compose up` launches SQL Server 2025 on the host as a sibling container — no nested Docker, no double emulation. Ollama also stays on the host (Metal acceleration). Both are reached from inside the container at `host.docker.internal`.

### Open in GitHub Codespaces (cloud, no local install)

Click the **Open in GitHub Codespaces** badge at the top of this README, or:

```
https://codespaces.new/croblesm/scout-talk-app?quickstart=1
```

The first launch takes 3 to 5 minutes (image pull + post-create). Subsequent launches are instant. Codespaces forwards port 3000 to a public URL once `npm run dev` is running.

### Open in local Dev Containers (Docker Desktop / OrbStack / Rancher Desktop)

Prerequisites: Docker (or OrbStack on Apple Silicon), VS Code, the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).

1. Make sure you completed the [Ollama section of Prerequisites](#2-ollama-host-install-not-containerized) so `ollama serve` is running on your host with `nomic-embed-text` pulled.
2. Click the **Open in Dev Containers** badge at the top of this README, OR clone the repo locally and run **"Dev Containers: Reopen in Container"** from the VS Code command palette.
3. The first build pulls the workspace image. About 2 minutes. The post-create command then runs `npm install && npx prisma generate`.
4. Follow [Quick Start (in the container)](#quick-start-in-the-container) to bring up SQL Server, migrate, seed, and start the dev server.

### What's inside the dev container

| Component | Why | Notes |
|---|---|---|
| `workspace` | Node 22 + npm + tsx + git | Multi-arch (`mcr.microsoft.com/devcontainers/typescript-node:22-bookworm`). Native on ARM and x86. |
| `docker-outside-of-docker` feature | Mounts the host's `/var/run/docker.sock` into the container, so the `docker` CLI talks to your host's Docker daemon | Avoids the Docker-in-Docker / containerd 2.3 boot bug on Apple Silicon. Faster too (no nested VM). |
| Host Ollama (not in container) | Embeddings server (nomic-embed-text, 768-dim) | Reached at `host.docker.internal:11434`. Metal-accelerated on Apple Silicon. Install on the host once via [Prerequisites](#2-ollama-host-install-not-containerized). |

SQL Server runs as a **sibling container on the host's Docker** (launched by `docker compose up -d` from inside the dev container — the project's root `docker-compose.yml` is the one source of truth). The container is `platform: linux/amd64`, 2 GB / 2 CPU quota, runs under Rosetta on Apple Silicon. The dev container joins the same Docker network (`talkscout_default`, created automatically by `initializeCommand`), so the database is reached by container name: `talkscout-mssql:1433` (already wired in `DATABASE_URL`). This works the same way on Docker Desktop, OrbStack, and Codespaces.

> [!NOTE]
> When you add a connection in the **MSSQL VS Code extension** from inside the dev container, set the **Server** field to just `talkscout-mssql` (no port, no comma). The extension's connection wizard does not parse the SQL Server `host,port` shorthand the same way `.NET SqlClient` does, and the default port 1433 is correct for this project. Username `sa`, password `TalkScout!Demo2026`, **Trust server certificate** ON. If your VS Code Settings Sync carried over an older profile pointing at `localhost,1433` (or `host.docker.internal,1433`), edit it or add a new profile.

VS Code extensions installed automatically: MSSQL, GitHub Copilot, GitHub Copilot Chat, Prisma, Tailwind CSS IntelliSense, ESLint, Prettier, Docker, OpenSpec.

### Files driving the dev container

```text
.devcontainer/
└── devcontainer.json         # VS Code config: image, features, ports, extensions, env vars
```

A single file. SQL Server is defined in the project's root `docker-compose.yml` (the same one used by the manual quickstart) and brought up from inside the container via Docker-in-Docker.

To customize, edit `.devcontainer/devcontainer.json` and rebuild with **"Dev Containers: Rebuild Container"**.

## Quickstart (manual)

If you'd rather not use the dev container, set up locally on your host:

```bash
# 1. Clone, install, env
git clone <this-repo> && cd scout-talk-app
npm install
cp .env.example .env

# 2. Start the SQL Server container (2 GB / 2 CPU quota; auto-pulls the image)
npm run db:up

# 3. Pull the embedding model into host Ollama
ollama pull nomic-embed-text

# 4. Apply migrations and seed the catalog (parses the dev.events fixture,
#    embeds entries via host Ollama, MERGEs into SQL Server)
npm run db:migrate
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open `http://localhost:3000`. Try the search input. You should see results within a few seconds.

If anything fails, see [Troubleshooting](#troubleshooting).

### After the first run

Once the project is set up and the `pre-implement` git tag is present locally (it ships with the repo, so a fresh clone gets it from `git fetch --tags`), the fastest way to return to a known-good state is:

```bash
npm run demo:reset
```

This rewinds the working tree to `pre-implement`, tears down and recreates the Docker volume, re-applies migrations, re-seeds, and starts the dev server. About 90 seconds. Useful for re-rehearsing the demo or recovering after a botched experiment. Aborts loudly if the `pre-implement` tag is missing or `docker compose` is not available.

## Day-to-day commands

```bash
npm run dev              # Next.js dev server on :3000
npm run typecheck        # tsc --noEmit
npm run build            # production build (static optimization)
npm run db:up            # docker compose up -d (idempotent)
npm run db:down          # docker compose down (preserves the data volume)
npm run db:seed          # re-ingest events.json and embed any changed rows
npm run db:reset         # drop + recreate DB, re-seed (destructive)
npm run ingest           # parse data/dev-events.html → data/events.json
npm run ingest:live      # re-fetch dev.events (off-demo path)
npm run demo:reset       # tear down everything and rebuild from the
                         # `pre-implement` git tag, ending with a working
                         # app on :3000 in under 90 seconds
```

## Project layout

```text
.devcontainer/
└── devcontainer.json     # VS Code dev container config (image, features, ports, extensions, env)
openspec/
├── config.yaml           # Project context + architectural rules + UI rules
├── specs/architecture.md # Mermaid architecture diagrams (search hot path + ingest)
├── changes/              # One subdirectory per proposed change (created by /opsx-propose)
└── specs/                # Long-lived specifications (architecture.md, etc.)
.github/
├── prompts/opsx-*.prompt.md   # /opsx-propose, /opsx-apply, /opsx-explore, /opsx-archive
└── skills/openspec-*/SKILL.md # Skill definitions backing the prompts
prisma/
├── schema.prisma         # Event model with VECTOR(768) column (no datasource.url; Prisma 7)
├── sql/                  # The ONLY place T-SQL lives in this repo
│   ├── upsertEvents.sql
│   └── searchEvents.sql
├── migrations/           # Generated by `prisma migrate dev`
└── seed.ts               # `import 'dotenv/config'` + PrismaMssql adapter
prisma.config.ts          # Prisma 7 config (datasource url for migrate)
src/
├── app/                  # Next.js 15 App Router (page, layout, Server Action)
├── components/           # SearchInput, EventCard, CfpStatusPill + shadcn ui/
└── lib/                  # db.ts (Prisma singleton + adapter), embed.ts (Ollama), sql.ts, cfp-status.ts
data/
├── dev-events.html       # Committed fixture (do not regenerate during recording)
├── events.json           # Parsed catalog (91 entries)
└── queries.md            # Scripted demo queries with expected top results
demo/
├── prompts.html          # The on-camera operator teleprompter
├── architecture-slide.html    # Intro/outro architecture slide (dark, click-to-advance)
├── walkthrough-slide.html     # Closing recap of the 12 demo steps
└── script.md             # 8-minute timed rehearsal script
scripts/
├── smoke-test.sql        # Verifies VECTOR(768) and VECTOR_DISTANCE work
├── wait-for-db.mjs       # Waits for SQL Server (uses docker healthcheck on host, TCP probe in container)
├── parse-dev-events.ts   # HTML fixture → events.json
├── fetch-dev-events.ts   # Live re-capture (off-demo)
└── demo-reset.ts         # The repeatable-demo entry point
docker-compose.yml        # Top-level (host setup): just SQL Server (when you don't use the devcontainer)
```

## Demo day procedure

This is the operator playbook for recording. Practice it once before each recording session.

### Before the camera rolls (one time, ~5 minutes)

```bash
# 1. Confirm the environment is in the expected state
ollama list | grep -q nomic-embed-text || ollama pull nomic-embed-text
docker compose ps                        # mssql should be `healthy`
git describe --tags                      # should report `pre-implement` or later

# 2. Open the project in VS Code with the right panes ready
code .
# In VS Code:
#   - Open GitHub Copilot Chat panel (Cmd+Ctrl+I)
#   - Open the integrated terminal (Ctrl+`)
#   - Open the MSSQL extension; ensure the `talkscout` connection is registered
#   - Open demo/prompts.html in a separate browser window on a second monitor
```

### Between takes (every retake, ~90 seconds)

```bash
npm run demo:reset
```

This script:
1. Verifies the working tree is clean (aborts loudly if not)
2. Verifies the `pre-implement` git tag exists (aborts if missing)
3. Resets the working tree to that tag (`git reset --hard pre-implement`)
4. Tears down Docker (`docker compose down -v`) and removes `.next/`
5. Brings the SQL Server container back up
6. Applies migrations and re-seeds
7. Starts `npm run dev` in the background

When it exits, `localhost:3000` is live and you can hit Record.

### During the take

Drive the demo from `demo/prompts.html`. Each card has the voiceover, the prompt or command to type, an "Expected" block, and a "Show:" hint telling you which pane the camera should be on. Copy buttons let you paste the exact text into GitHub Copilot Chat or the terminal without typos.

The two live `/opsx-*` segments (`/opsx-propose` at 1:30, `/opsx-apply` at 3:00) are the only places where the agent runs unattended. Everything else is you driving.

### After the recording

Tag the commit before stopping:

```bash
git tag pre-recording-$(date +%Y%m%d)
```

This preserves the exact state that aired, so a future bug report can be reproduced.

## Architecture summary

```
Browser ──► Next.js Server Action (src/app/actions.ts)
            │
            ├─► embed(query) ─► host Ollama (Metal-accelerated, 768-dim)
            │
            └─► prisma.$queryRawUnsafe(SEARCH_EVENTS_SQL, JSON.stringify(vector), 5)
                │
                └─► SQL Server 2025
                    └─► VECTOR_DISTANCE('cosine', embedding, CAST(@P1 AS VECTOR(768)))
                        TOP 5 ORDER BY similarity DESC
```

Embeddings are produced in Node, not in T-SQL. The original brief considered using SQL Server's `AI_GENERATE_EMBEDDINGS` and `EXTERNAL MODEL`, but those required HTTPS-only external endpoints and a Caddy proxy with a CA imported into the mssql container. The cost was not visible on camera, so we chose the simpler path. See `openspec/config.yaml` for the full architectural rules.

## Troubleshooting

| Symptom | Probable cause | Fix |
|---|---|---|
| `npm run db:up` hangs at "waiting for SQL Server" | Apple Silicon Rosetta first-boot is slow | Wait up to 90 seconds. If it never becomes healthy, run `docker logs talkscout-mssql` and look for missing AMD64 emulation. |
| `npm run db:seed` errors with "Cannot connect to ollama" | Host Ollama is not running | `ollama serve &` on the host. Verify `curl http://localhost:11434/api/tags`. |
| `npm run db:seed` errors with "embedding service returned 404" | Model not pulled | `ollama pull nomic-embed-text` |
| First search takes 8+ seconds | Ollama cold start | Trigger a dummy embed first: `curl http://localhost:11434/api/embed -d '{"model":"nomic-embed-text","input":"warmup"}'`. After that, searches return in under 3 seconds (SC-001). |
| `prisma migrate dev` fails with "table exists" | Stale state from a prior run | `npm run db:reset` (destructive) |
| `/opsx-apply` does nothing in GitHub Copilot Chat | OpenSpec prompts not loaded | Verify `.github/prompts/opsx-*.prompt.md` exist; reload the VS Code window |
| Search returns 0 results | Embeddings never computed | `SELECT COUNT(*) FROM Event WHERE embedding IS NULL` in the MSSQL extension; if non-zero, re-run `npm run db:seed` |

## Spec, plan, tasks, principles

The project is driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec). The on-disk artifacts are:

- [`openspec/config.yaml`](./openspec/config.yaml): project context and per-artifact rules consumed by every `/opsx-*` command (the OpenSpec equivalent of a constitution + architecture rules in one place)
- `openspec/changes/<change-name>/proposal.md`: what + why for an open change (created by `/opsx-propose`)
- `openspec/changes/<change-name>/design.md`: how, including architecture and decisions
- `openspec/changes/<change-name>/tasks.md`: ordered implementation steps for `/opsx-apply`

The slash commands that produced these files are real and live in `.github/prompts/`. They run in GitHub Copilot Chat (inside VS Code) or the GitHub Copilot CLI.

## License

This repository is a demo artifact. Use any code in it freely.
