# Tasks: TalkScout

**Branch**: `001-talkscout` | **Plan**: [plan.md](./plan.md)

Ordered, testable tasks derived from `plan.md`. Each task names its acceptance check. Conventional Commit prefix suggested per task. Tasks within a group can run in any order; groups are sequential.

## Group A. Infrastructure (smoke-test gated)

- [x] **A1.** `chore: add docker-compose for mssql (host Ollama, AMD64 platform pin, 2GB/2CPU quotas)`
  Acceptance: `docker compose up -d` brings mssql healthy; `docker inspect` confirms 2 GB / 2 CPU quotas; host Ollama serves on `localhost:11434` with `nomic-embed-text` pulled.
- [x] **A2.** `chore: smoke-test VECTOR(768) and VECTOR_DISTANCE`
  Acceptance: `scripts/smoke-test.sql` runs cleanly: `VECTOR(768)` cast works, `VECTORPROPERTY` returns 768, `VECTOR_DISTANCE` returns smaller distance for the related pair than the unrelated one.
- [x] **A3.** `chore: add .env.example and wait-for-db helper`
  Acceptance: `.env.example` documents `DATABASE_URL`, `OLLAMA_HOST`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`. `scripts/wait-for-db.mjs` polls until SQL Server accepts a TDS connection.

## Group B. Project Bootstrap

- [ ] **B1.** `chore: scaffold Next.js 15 + TS strict + Tailwind`
  Acceptance: `npm run dev` serves a default page; `npm run typecheck` and `npm run build` pass.
- [ ] **B2.** `chore: install shadcn/ui and seed primitives`
  Acceptance: `components.json` exists; `Input`, `Card`, `Badge`, `Button` primitives are present in `src/components/ui/`.
- [ ] **B3.** `chore: add Prisma with typedSql preview feature`
  Acceptance: `prisma/schema.prisma` exists with `previewFeatures = ["typedSql"]` and the `Event` model from `plan.md`. `npx prisma generate` succeeds. **Initial migration created via `npx prisma migrate dev --name init`; `prisma/migrations/` contains the `init` migration** (without this, C4 `db:seed` will fail with "table does not exist"). `src/lib/db.ts` exports a singleton `prisma` client (avoids "too many clients" on Next.js dev hot-reload).
- [ ] **B4.** `chore: install ollama npm package and add embed.ts`
  Acceptance: `src/lib/embed.ts` exposes `embed(text)` and `embedBatch(texts)` against host Ollama. A 4-line ad-hoc Node script can embed "hello" and print a length-768 number array.

## Gate B5. Tagging Gate (between Group B and Group C)

- [ ] **B5.** `chore: tag pre-implement (proactively, end of Group B)`
  Acceptance: tag is created BEFORE any Group C, D, or E work begins, on the commit that closes Group B (last B-group commit). Run `git tag pre-implement HEAD` at that point. Verify with `git show pre-implement --stat` that no `prisma/sql/`, `src/app/page.tsx`, `src/app/actions.ts`, or `src/components/` files exist at that commit. If you reach Group C without having tagged, hard-stop, walk back, and tag at the last clean Group-B commit. **This is a hard gate: no C-group task may begin until B5 is complete.**

## Group C. Data Pipeline

- [ ] **C1.** `feat(data): commit dev.events HTML fixture and fetch-live helper`
  Acceptance: `data/dev-events.html` exists, captured once with topical events spanning the listed conferences. `scripts/fetch-dev-events.ts` exists for opt-in re-capture (used only off-demo via `npm run ingest:live`); it overwrites `data/dev-events.html` from the live site and is never on the recording path.
- [ ] **C2.** `feat(ingest): parse fixture to events.json`
  Acceptance: `npm run ingest` produces `data/events.json` with ≥ 80 entries; each entry validated against a Zod schema.
- [ ] **C3.** `feat(sql): add prisma/sql/upsertEvents.sql`
  Acceptance: MERGE from JSON parameter where each entry includes the pre-computed embedding as a JSON array of 768 floats. Updates `embedding` only when `contentHash` changed. Returns inserted/updated/unchanged counts.
- [ ] **C4.** `feat(seed): orchestrate embed-then-upsert`
  Acceptance: `npm run db:seed` reads `events.json`, computes `contentHash` for each entry, batch-embeds via `embedBatch()`, and MERGEs in one shot. Cold cache run < 60s. Rerun on unchanged data < 5s and reports 0 changes. **Time the embedding-only phase (`embedBatch` calls, excluding parse and MERGE)** with `console.time('embed')` and confirm < 60s on a warm Docker stack (FR-009 sub-budget verification).
- [ ] **C5a.** `feat(data): tune seed so demo queries land`
  Concrete actions: open `data/dev-events.html` (or augment with synthetic entries appended to the fixture); for each of the 5 scripted queries, ensure at least one event exists whose description and topic tags semantically match the query intent without using the query's literal keywords. Edit descriptions/tags to nudge embeddings toward the intended top results. Re-run `npm run db:seed` and confirm.
  Acceptance: 2 primary + 3 backup queries each return their intended top result on a fresh seed.
- [ ] **C5b.** `docs: write data/queries.md`
  Acceptance: `data/queries.md` lists all 5 queries with expected top result for each. After `db:seed`, manually invoking the search Server Action returns the documented top for both primaries on two consecutive runs. Verify all 3 backup queries also return a plausible top result (even if not the documented one), so they are usable as live fallbacks during recording.

## Group D. Search and UI

- [ ] **D1.** `feat(sql): add prisma/sql/searchEvents.sql`
  Acceptance: accepts a query embedding as a JSON array string (`@P1`) and limit (`@P2`). Casts to `VECTOR(768)` in-place and ranks via `VECTOR_DISTANCE('cosine', ...)`. Returns top N rows by similarity desc; never SELECTs `embedding`.
- [ ] **D2.** `feat(api): add Server Action src/app/actions.ts`
  Acceptance: embeds the query via `embed()`, then calls `prisma.$queryRawTyped(searchEvents(JSON.stringify(vector), 5))`. Returns `{ ok: true, results }` on success. Rejects queries > 500 chars (per FR-004) with `{ ok: false, error: 'query-too-long' }`. **On Ollama unreachable (connection refused, timeout, or 5xx), catches the error and returns `{ ok: false, error: 'embedding-unavailable' }` (per FR-004); `page.tsx` renders a friendly "Search is temporarily unavailable. Try again in a moment." message.** `SearchInput` enforces `maxLength={500}` at the DOM level. No SQL strings in the file.
- [ ] **D3.** `feat(lib): add cfp-status.ts pure function`
  Acceptance: pure function maps `(cfpOpenDate, cfpCloseDate, today)` to one of the five pill states from FR-006: `open`, `closing-soon` (with N), `opening-soon` (with N), `closed`, `unavailable`. Returns a discriminated union including the urgency tier (`green`/`amber`/`red`/`muted`/`neutral`). Manual verification (no test runner installed for demo scope): exercise the function in a 30-line scratch script with all five branches plus explicit boundary inputs and confirm outputs match this table:

  | Input | Expected state | Tier |
  |---|---|---|
  | open in past, close in 30d | open | green |
  | open in past, close in 15d | open | green |
  | open in past, close in 14d | closing-soon (N=14) | amber |
  | open in past, close in 4d | closing-soon (N=4) | amber |
  | open in past, close in 3d | closing-soon (N=3) | red |
  | open in past, close in 0d (today) | closing-soon (N=0) | red |
  | open in 5d, close in 30d | opening-soon (N=5) | blue |
  | open in past, close in past | closed | muted |
  | both null | unavailable | neutral |
- [ ] **D4.** `feat(ui): SearchInput with placeholder cycling`
  Acceptance: large input with `maxLength={500}` enforced at the DOM level, gradient border (per `plan.md` UI Notes). Placeholder cycles through the 5 scripted queries every 4 s **only when the input is empty AND unfocused**. Cycling pauses on focus and resumes when blurred while the input is empty. When the user has typed anything, the placeholder never overwrites their input.
- [ ] **D5.** `feat(ui): EventCard + CfpStatusPill`
  Acceptance: card renders all fields per `plan.md` "UI Notes" section. Pill colors map to states per FR-006 and the Tailwind classes documented in `plan.md` (green for open, amber/red by N threshold for closes-in-N, blue for opens-in-N, muted gray for closed, neutral gray for unavailable). Similarity % is `Math.round(score * 100)`, no decimals. When `cfpUrl` is non-null, clicking the card opens that URL in a new tab (`target="_blank" rel="noopener noreferrer"`). When `cfpUrl` is null, the card has no hover affordance, no cursor pointer, and click is a no-op (per FR-005). **Verify visual rendering in both light and dark modes** (toggle macOS system preference; cards and pills must remain legible in both).
- [ ] **D6.** `feat(ui): wire page.tsx to Server Action`
  Acceptance: typing a query and submitting renders results within 3 s after `npm run dev` on a process that just booted, given Ollama has been warmed by a prior `db:seed` (per SC-001).
- [ ] **D7.** `feat(ui): empty state per FR-007`
  Acceptance: implements the dual-condition logic from FR-007. Verify three cases: (1) "zzz qwerty" returns top score < 0.55 AND tight margin → empty state with query echoed; (2) a query that returns a top score of ~0.60 with the same tight margin → results render (NOT empty state), proving the AND logic; (3) catalog with < 5 entries → results render even if scores are low (proves the "fewer than 5" guard).

## Group E. Repeatability

- [ ] **E1.** `feat(scripts): add demo-reset.ts`
  Acceptance: `npm run demo:reset` runs end-to-end in < 90 s and ends with a seeded database AND a started Next.js dev server reachable at `localhost:3000` (SC-003). The script must auto-start `npm run dev` as its final step (in the background or in a detached child process) so the presenter does not need to run a second command. **Starting precondition: containers stopped (`docker compose down -v`), no Next.js build cache (`.next/` removed).** Aborts loudly if working tree is dirty or `pre-implement` tag is missing.

## Group F. Demo Assets

- [ ] **F1.** `docs: write demo/prompts.html`
  Format spec (explicit): single-file HTML, font `'Segoe UI', sans-serif`, light theme by default (`#f8f9fa` body bg, `2rem` body padding), theme toggle button fixed at `top: 1rem; right: 2rem` (`#4f46e5` bg, white text, rounded). Cards: white bg, `border-radius: 8px`, subtle shadow, `border-left: 6px solid #4f46e5`, `1rem` padding, `1.5rem` margin-bottom. `<pre>` blocks: `#282c34` bg, `#f8f8f2` text, `1rem` padding, rounded. Copy buttons: `#4f46e5` bg, white text, top-right-corner-floated, calling `copyToClipboard(id)`. `.voiceover` class: italic, color `#555`. Dark mode: body `#1e1e1e`, cards `#2e2e2e` with `#90cdf4` left border, pre blocks `#111`. Toast at bottom-center on copy: "📋 Copied to clipboard!", fade in/out 2s. JS: `toggleTheme()` toggles `.dark` on body. Cards reference `/speckit.*` slash commands (the prefixed names). Each live-segment card has the exact prompt to paste into Copilot Chat (e.g. `/speckit.analyze`, `/speckit.implement`).
  Acceptance: open `demo/prompts.html` in a browser; theme toggles; clicking a copy button puts the pre's text on the clipboard and shows the toast for ~2s; both `/speckit.analyze` and `/speckit.implement` cards exist with their prompts.
- [ ] **F2.** `docs: write demo/script.md (8-min timed)`
  Acceptance: sections at 0:00, 0:30, 1:30, 3:30, 5:00, 6:30, 7:30; speaker notes in italics; constraint compliance (no em-dashes, no "I've").
- [ ] **F3.** `docs: write README.md`
  Acceptance: 5-minute read; quickstart in 4 commands; links to constitution, spec, plan; explains the demo flow at a high level.

## Group G. Verification

- [ ] **G1.** End-to-end rehearsal #1.
  Acceptance: **Starting precondition: `docker compose down -v` completed, `.next/` deleted (true cold stack).** Run `demo:reset`, stopwatch it (must be < 90s, SC-003). Run both primary queries; confirm expected top results. Idle 5 minutes, then time the next search (must be < 3s, SC-001). Run the full demo end-to-end with stopwatch (must fit 8 min with ≥ 30s buffer, SC-004). Verify abort-on-dirty: leave a stray file in `src/`, run `demo:reset`, confirm it refuses; clean up; re-run; confirm success. Observe placeholder cycling for 12s (3 cycles) on the empty input to confirm the 4s interval (FR-005).
- [ ] **G2.** End-to-end rehearsal #2.
  Acceptance: Same as G1 from a fresh terminal session. Note any drift; if drift exists, freeze the tag and stop changing things.
- [ ] **G3.** `chore: final commit at tag pre-recording`
  Acceptance: clean tree, all checks green, ready for May 11.

## Critical Path

A1 → A2 (gate, passed) → B1, B2, B3, B4 (parallel) → **B5 (tagging gate)** → C1 → C2 → C3 → C4 → C5a → C5b → D1 → D2/D3 (parallel) → D4/D5 (parallel) → D6 → D7 → E1 → F1/F2/F3 (parallel) → G1 → G2 → G3.

## Out of Scope (reaffirmed)

No auth, no scheduled ingest, no past-session search, no CFP submission flow, no mobile layout, no multi-language, no analytics. v1 ships exactly what's above.
