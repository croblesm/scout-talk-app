# Claude Code Prompt: TalkScout — AI-Powered Dev Conference Session Finder

## Project Context

I am Carlos Robles, Principal PM for SQL developer experiences at Microsoft. I am building a 6-minute demo for the Data Exposed YouTube channel, scheduled to record Monday, May 11, 2026. The demo showcases an end-to-end AI application built entirely from VS Code using:

- **MSSQL extension for VS Code** with GitHub Copilot integration (mirroring what the VS Code team showcases for the PostgreSQL extension via the `@pgsql` agent)
- **VS Code Agents** (the new feature in VS Code Insiders) to orchestrate scaffolding through spec-driven development
- **SQL Server 2025** with native vector data types and the `AI_GENERATE_EMBEDDINGS`, `AI_GENERATE_CHUNKS`, and `VECTOR_DISTANCE` functions
- **Prisma ORM** for type-safe database access from Node.js using `$queryRawTyped` (TypedSQL)
- **Next.js with TypeScript** for the frontend semantic search UI
- **Qwen3 Embedding API** (via DashScope, OpenAI-compatible endpoint) as the embedding model

The audience is professional developers. The demo must be tight, visually compelling, and avoid showing raw T-SQL on screen wherever possible. ORM-first.

## Spec-Driven Approach with GitHub Spec Kit

I am using GitHub Spec Kit for this project. Drive the workflow through the standard Spec Kit slash commands in this exact order, and pause for my approval after each phase before moving to the next:

1. `/constitution` — establish project principles (TypeScript-first, ORM-first, no raw T-SQL in app code, demo recordability)
2. `/specify` — define WHAT we are building and WHY (the user-facing semantic search experience)
3. `/clarify` — surface and resolve any underspecified areas before planning
4. `/plan` — define tech stack, architecture, and HOW we will build it
5. `/tasks` — break the plan into ordered, testable tasks
6. `/analyze` — cross-check spec, plan, and tasks for consistency before any code is written
7. `/implement` — execute the tasks in order

Do not skip steps. Do not write implementation code before `/implement`. Treat the spec as the source of truth.

## What to Build

A semantic dev conference session finder called **TalkScout**.

### User Story (one sentence)

A developer types a natural-language description of what they want to learn ("how teams are using agents to triage production incidents") and gets back the top 5 most semantically relevant talks from a curated catalog of recent dev conferences.

### Functional Requirements

1. Catalog of approximately 200 talks from real public dev conferences (Microsoft Build, Microsoft Ignite, KubeCon, AWS re:Invent, GitHub Universe, JSConf, PyCon, RustConf, DockerCon, React Conf, GopherCon, DjangoCon, FabCon, SQLCon). Seed data provided as JSON.
2. Each talk has: id, title, speaker name, conference, year, track, and a 3-4 sentence abstract.
3. On seed, each talk's abstract is chunked and embedded using `AI_GENERATE_CHUNKS` and `AI_GENERATE_EMBEDDINGS`, invoked through Prisma TypedSQL files. Embedding logic does not appear in TypeScript application code.
4. Search endpoint accepts a natural-language query, generates an embedding for it server-side via the same SQL Server function, performs vector similarity search using `VECTOR_DISTANCE`, and returns the top 5 results with similarity scores.
5. Next.js frontend with a single search input, talk cards showing title, speaker, conference badge, year, track tag, abstract snippet, and similarity score as a percentage. Clean modern UI.
6. Entire stack runs locally against SQL Server 2025 in a Docker container.

### Seed Data Guidance

The seed dataset must include talks where the abstract uses different vocabulary than common search terms. This is what makes the semantic search demo land. Example pairings to engineer into the seed:

- Search "agentic workflows in databases" should surface talks titled around "autonomous AI tooling," "MCP servers," "self-driving query planners," even if they never use the word "agentic."
- Search "how to make Postgres faster" should surface talks about query planning, indexing strategies, and connection pooling, even if they never use the word "faster."
- Search "type safety across the stack" should surface tRPC, end-to-end TypeScript, and contract-driven API talks.

Include at least 3-5 such "vocabulary mismatch" examples in the seed to guarantee the demo has obvious magic moments.

### Non-Functional and Demo Requirements

- **Recordability**: every step from `/specify` through `/implement` must produce visible artifacts (markdown files, code files) suitable for showing on screen.
- **Speed**: cold start to first search result must be under 10 seconds on my machine.
- **Visual polish**: the frontend should look like a real product, not a developer sandbox. Use Tailwind, shadcn/ui components, and a thoughtful layout. Each talk card should feel scannable, with clear hierarchy.
- **No T-SQL on screen** during the demo recording. All embedding and vector calls go through Prisma TypedSQL files (`prisma/sql/*.sql`) so the call site in TypeScript looks like `prisma.$queryRawTyped(searchTalks(query))`.

## Tech Stack (Lock This In)

| Layer | Choice | Reason |
|---|---|---|
| Database | SQL Server 2025 (Docker, `mcr.microsoft.com/mssql/server:2025-latest`) | Native VECTOR type, `AI_GENERATE_EMBEDDINGS`, `AI_GENERATE_CHUNKS`, `VECTOR_DISTANCE` |
| Embedding model | Qwen3-Embedding-0.6B via DashScope API (OpenAI-compatible endpoint) | Open-source aligned, fast, cheap, modern |
| External model registration | `CREATE EXTERNAL MODEL` in SQL Server pointing at DashScope | Keeps embedding logic server-side, called via `AI_GENERATE_EMBEDDINGS` |
| ORM | Prisma with `previewFeatures = ["typedSql"]` | Type-safe access to native SQL Server functions without raw strings in app code |
| Backend | Next.js 15 App Router, Server Actions | Single deployable, no separate API server |
| Frontend | React 19, Tailwind CSS, shadcn/ui | Modern, polished, demo-ready |
| Language | TypeScript everywhere, strict mode | |
| Package manager | pnpm | |
| Runtime | Node.js 22 LTS | |

## Project Structure (Target)

```
talkscout/
├── .specify/                   # Spec Kit artifacts
│   ├── constitution.md
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
├── prisma/
│   ├── schema.prisma
│   ├── sql/                    # TypedSQL files, the ONLY place raw SQL lives
│   │   ├── seedTalks.sql
│   │   ├── chunkAndEmbed.sql
│   │   └── searchTalks.sql
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── page.tsx            # Search UI
│   │   ├── layout.tsx
│   │   └── actions.ts          # Server Action calling Prisma TypedSQL
│   ├── components/
│   │   ├── SearchInput.tsx
│   │   ├── TalkCard.tsx
│   │   ├── ConferenceBadge.tsx
│   │   └── ui/                 # shadcn primitives
│   └── lib/
│       └── db.ts               # Prisma client singleton
├── docker-compose.yml          # SQL Server 2025
├── data/
│   └── talks.json              # 200-talk seed dataset
├── demo/                       # Demo-day artifacts
│   ├── prompts.html            # Scrollable card-based demo guide
│   └── script.md               # Spoken script with timestamps
├── .env.example
├── package.json
└── README.md
```

## Demo Recording Artifacts (CRITICAL)

In addition to the working app, generate these demo-support files. Match the format described below exactly. I have used this format in past demos and it works well for live recording.

### `demo/prompts.html` — Format Specification

A self-contained, single-file HTML document. Scrollable card-based layout (NOT slides). Designed to be displayed on a second monitor or picture-in-picture during recording, with each card containing a step's voiceover and the exact prompts or commands to copy into the VS Code Agents chat or the terminal.

**Required structure:**

```
<title>: TalkScout — AI-Powered Conference Session Finder

H1: 🤖 TalkScout — Building an AI-Powered Conference Session Finder

H2: 🎬 Scenario Introduction
- 1-2 paragraphs framing what we are building and why
- Voiceover paragraph in italic gray styling

H2: 🚀 Step-by-Step Walkthrough
- One <div class="card"> per demo step
- Each card contains:
  - H3 with emoji and step number, e.g. "🔹 Step 1: Bootstrap the project with Spec Kit"
  - Voiceover paragraph (italic gray) for the spoken script
  - <pre> block with the exact prompt or command to copy
  - Copy button (top-right corner of pre block)
  - Optional "Expected response" or "Expected output" block
  - Optional "📌 Show:" hint for what to display on screen

H2: 🎯 What We Accomplished
- Bulleted checklist of accomplishments with ✅ emojis

H2: 🎯 Closing Statement
- Voiceover paragraph for the wrap-up
- Bulleted "Key takeaways"

H2: 📚 Resources
- Links to README, GitHub repo, SQL Server 2025 docs, Spec Kit docs

H2: 🙏 Thank You
```

**Required styling:**

- Font family: `'Segoe UI', sans-serif`
- Default theme: light. Background `#f8f9fa`, body padding `2rem`.
- Theme toggle button fixed at `top: 1rem; right: 2rem`. Background `#4f46e5`, white text, rounded.
- Cards: white background, `border-radius: 8px`, subtle box shadow, `border-left: 6px solid #4f46e5`, padding `1rem`, margin-bottom `1.5rem`.
- `<pre>` blocks: dark background `#282c34`, light text `#f8f8f2`, padding `1rem`, rounded.
- Copy buttons: `#4f46e5` background, white text, floated right under each pre block.
- `.voiceover` class: italic, color `#555`, used for spoken script paragraphs.
- Inline `<code>` tags: light gray background, monospace font.
- Dark mode (toggle): background `#1e1e1e`, cards `#2e2e2e` with `#90cdf4` left border, pre blocks `#111`.
- Toast notification at bottom-center on copy: "📋 Copied to clipboard!" with fade in/out.

**Required interactivity:**

- `toggleTheme()` function adding/removing `.dark` class on body.
- `copyToClipboard(id)` function that copies `<pre>` text and shows the toast for 2 seconds.

### Demo Steps to Include in `prompts.html`

Generate cards for these steps in order. Each card must have a voiceover paragraph and the exact text to type into the VS Code Agents chat or the terminal.

1. **Setup recap** (no command, just voiceover): "Environment is ready. Docker is running with SQL Server 2025. Prisma and pnpm are installed. The Spec Kit project has been initialized. Let's start by defining the spec."
2. **Run `/constitution`** with the prompt to establish project principles.
3. **Run `/specify`** with the TalkScout user story and functional requirements.
4. **Run `/clarify`** to surface any open questions, then resolve them.
5. **Run `/plan`** with the tech stack table from this brief.
6. **Run `/tasks`** to generate the ordered task list.
7. **Run `/analyze`** to verify consistency.
8. **Run `/implement`** and let the VS Code Agent scaffold the project (show files appearing in the explorer).
9. **Open `prisma/sql/searchTalks.sql`** to show the TypedSQL file using `VECTOR_DISTANCE` and `AI_GENERATE_EMBEDDINGS`. Voiceover: explain that this is the only place raw SQL lives.
10. **Open `src/app/actions.ts`** to show the call site: `prisma.$queryRawTyped(searchTalks(query))`. Voiceover: emphasize how clean the application code is.
11. **Run `pnpm db:seed`** to seed 200 talks and generate embeddings. Show the progress in the terminal.
12. **Open the app at `localhost:3000`**. Type the search "agentic workflows in databases" and show the top 5 results. Voiceover: point out that the top result does not contain the word "agentic" anywhere in its title or abstract.
13. **Run a second search**: "type safety across the stack." Voiceover: highlight how it surfaces tRPC, end-to-end TypeScript talks even when phrasing differs.
14. **Wrap-up card**: voiceover for the closing statement.

### `demo/script.md`

A 6-minute timed script in markdown with sections for:

- 0:00–0:30 Hook and setup
- 0:30–1:30 Spec Kit `/specify` and `/plan` walkthrough
- 1:30–3:00 VS Code Agent scaffolds the project
- 3:00–4:30 Show TypedSQL files, Prisma schema, the call site in `actions.ts`
- 4:30–5:30 Run the seed, watch embeddings populate, run two live searches
- 5:30–6:00 Wrap, takeaways, links

Include speaker notes in italics under each section. Match the writing constraints below.

## Constraints and Preferences

- **No em-dashes** in any generated documentation, comments, or scripts. Use commas, periods, or parentheses.
- **No "I've"** contractions. Write "I have" instead. This applies to README, script, demo HTML voiceovers, and any narrative text.
- Short, direct sentences in all docs.
- Conversational tone in code comments. Slightly more polished tone in the README and demo script.
- All commit messages should follow Conventional Commits.

## What I Need From You Right Now

Start by running `/constitution` and proposing the project constitution based on the principles above. Wait for my approval before moving to `/specify`. After each Spec Kit phase, pause and let me review the artifact before proceeding to the next.

When you reach `/implement`, work in small, testable increments. Run `pnpm typecheck` and `pnpm build` after each major change. Surface any decision points instead of guessing.

If anything in this brief is ambiguous, raise it during `/clarify`, not before.

Let's begin.
