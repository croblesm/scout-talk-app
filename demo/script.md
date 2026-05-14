# TalkScout Demo Script (~8.75 minutes, fits 10-min slot)

The on-camera teleprompter is `demo/prompts.html`. This file is the timed version with speaker notes for rehearsal.

Times are wall-clock from when recording starts. Live content runs ~8:45; the 10-minute slot leaves ~1:15 buffer for pacing and pauses (SC-004).

## Pre-flight setup (BEFORE Step 1, off-camera)

`npm run demo:reset` does NOT start the dev server anymore. You start it manually in a foreground terminal so you have full control over it across the take.

Two terminals:

- **Terminal A**: `npm run demo:reset`. Wait for "Demo reset complete in Ns".
- **Terminal B** (new tab/split, Cmd+\\): `npm run dev`. Wait for `✓ Ready in Ns`.

Then open `http://localhost:3000`. You MUST see the placeholder ("Search UI lands when you run /opsx-propose and then /opsx-apply"). If not, the dev server has a problem — fix it before you touch Copilot Chat.

Why this design: the dev server is your BEFORE state on camera. Keeping it in a visible foreground terminal means you always know whether it is running, and Ctrl+C stops it cleanly. The previous script-managed background dev server caused recording-day grief (silent kills, no recovery path) and is gone.

Keep Terminal B alive through Steps 1, 2, 3, and 4. After `/opsx-apply` finishes (end of Step 4), manually restart the dev server in Terminal B: Ctrl+C → `rm -rf .next` → `npm run dev`. Three commands typed by hand. That picks up the new Tailwind classes and gives you the AFTER state. No helper script — earlier `npm run dev:restart` killed by port and tore down VS Code's port-forwarding agent in dev containers.

## 0:00 to 0:30, Hook

> *Speaker notes: smile, voice up. Look at camera, not at screen. Open with the problem statement.*

"I am Carlos Robles, Principal PM for SQL developer experiences at Microsoft. Every developer who speaks at conferences hits the same problem: where should I submit this talk? Listings sites organize events by date and region, never by topical fit. Today I want to show you how I built TalkScout, a CFP finder that takes a plain-English description of a talk and returns the upcoming conferences whose CFP topics match. End to end. Inside VS Code. In the next eight minutes."

## 0:30 to 1:30, The pitch and the architecture

> *Speaker notes: this is the thesis beat. Everything in steps 3-11 is a demonstration of one of the five tools mentioned here. Audience needs the frame before the rest works.*

1. Open `openspec/specs/architecture.md`. Press `Cmd+K V` to open the side-by-side Markdown preview. **Scroll to top.**

2. Read the "What this stack gives you" paragraph aloud:

   > *"A semantic-search application end-to-end inside VS Code. No separate vector database. No cloud embedding API. No SQL string literals in TypeScript. Five tools, each doing one job."*

3. Cursor moves down to the five-tool table. Read each row, one breath per row:

   > *"SQL Server 2025 stores both relational and vector data, native. No Pinecone/Qdrant + Postgres dual setup. Ollama runs on my Mac, free, no API keys. Prisma is the typed bridge so the TypeScript stays clean. The MSSQL extension lets me inspect vectors live in the IDE. And GitHub Copilot with OpenSpec drives the build itself."*

4. Cursor moves down to the search hot path Mermaid diagram:

   > *"Here's the flow. Browser to Server Action. The action branches into Ollama for the embedding and Prisma for the loaded SQL. They converge in SQL Server, where VECTOR_DISTANCE ranks the top five. That comes back through Prisma to the UI."*

5. Briefly switch to `openspec/config.yaml`, scroll to `context:`. Three architectural rules, read fast:

   > *"All T-SQL only in prisma/sql/. Embeddings in Node, not T-SQL. Containers capped at 2 GB / 2 CPUs."*

6. End the segment with the setup for the next step:

   > *"The search UI does not exist yet. The placeholder page at localhost:3000 says so. Next, I propose adding it as an OpenSpec change."*

## 1:30 to 2:30, Foundation plan — the BEFORE state

> *Speaker notes: open `file:///Users/carlos/scout-talk-app/demo/foundation-slide.html` in the host browser. Also briefly flash `docs/plan.md` in VS Code so the audience sees the plan is a real file in the repo, not slide-only. Click-to-advance pacing.*

The honesty beat. Read once, then advance the slide:

> *"Quick honesty beat. Everything I just showed you — the schema, the migrations, the embedding pipeline, the 91 seeded rows — that did not come from OpenSpec. I scaffolded it from a one-page plan I wrote at the start. Here is that plan. Then I will tell you why I stopped writing plans and switched to OpenSpec for everything after this point."*

Click through the slide as you talk: Goal → Stack Choices (SQL Server 2025, Ollama, Prisma 7, prisma/sql boundary) → Data Model (one table, `Unsupported("VECTOR(768)")` carries the column, CAST happens in T-SQL) → Seed Pipeline (events.json, content-hash gated, MERGE through the SQL file).

Reveal the closing "pivot" card. Read it aloud:

> *"The next layer is the search UI. I want it built agentically. Plain-English proposal in, spec out, agent applies it, I approve. That is what OpenSpec gives me — and it starts on the next slide."*

Switch back to VS Code, into the Agents chat panel. Step 4 is the on-ramp.

## 2:30 to 3:45, /opsx-propose (live)

> *Speaker notes: switch to GitHub Copilot Chat panel. Paste the slash command from prompts.html Card 3. Talk through it as files appear.*

Paste the full Card 3 prompt into GitHub Copilot Chat. The agent creates `openspec/changes/add-semantic-search-ui/` with three files: `proposal.md`, `design.md`, `tasks.md`. About 60 to 90 seconds.

Open `openspec/changes/add-semantic-search-ui/tasks.md` briefly. Scroll through the task list. Read aloud one or two tasks so the audience can see the spec is concrete and actionable.

> *Voiceover during the wait: "OpenSpec calls the unit of work a 'change.' The slash command takes my plain-English description, looks at the project context in config.yaml, and generates three artifacts in one shot: proposal, design, tasks. Watch the changes folder fill up."*

## 3:45 to 5:15, /opsx-apply (live)

> *Speaker notes: this is the centerpiece. Make sure the Explorer panel is visible alongside the chat panel.*

Type into GitHub Copilot Chat: `/opsx-apply add-semantic-search-ui`

What appears, in roughly this order. **Approve each one as it appears in the diff panel — do not click past anything:**
- 🆕 `src/lib/cfp-status.ts`
- 🆕 `src/app/actions.ts`
- 🆕 `src/components/cfp-status-pill.tsx`
- 🆕 `src/components/event-card.tsx`
- 🆕 `src/components/search-input.tsx`
- ✏️ `src/app/page.tsx` (MODIFIED — the placeholder is REPLACED; needs its own approval gate, easy to miss)

Expected total time: 60 to 120 seconds. While files appear, narrate: "The agent is reading tasks.md and creating exactly the files it lists. No more, no less. The page.tsx is the wiring layer; that is what makes the UI show up."

> *Speaker notes — VERIFY 1: page.tsx replaced (~5 seconds): open `src/app/page.tsx`. It must start with `'use client'` and import SearchInput + EventCard. If you still see the placeholder paragraph, paste this into the SAME Copilot Chat to recover:*
>
> ```
> You did not modify src/app/page.tsx. Per openspec/changes/add-semantic-search-ui/tasks.md, the placeholder Home component must be REPLACED with one that uses the new SearchInput and EventCard components and manages search state with useState. Apply that change now, then show me the diff.
> ```

> *Speaker notes — VERIFY 2: actions.ts has only async exports (~5 seconds): open `src/app/actions.ts`. It must start with `'use server'`. Every export must be `export async function` OR `export type`/`export interface`. NO `export const`, NO `export default {...}`, NO exported schemas. If the dev-server logs show `A "use server" file can only export async functions, found object`, paste this into the SAME Copilot Chat:*
>
> ```
> The build is failing with: "A 'use server' file can only export async functions, found object" at src/app/actions.ts. Move any non-async-function export (constant, object, schema, default export) out of src/app/actions.ts into src/lib/types.ts. Keep actions.ts containing only 'use server' and `export async function searchEvents(...)`. Update imports in src/app/page.tsx and any component that consumed the moved export. Then show me the diff for all three files.
> ```
>
> *Wait for the diff. Approve it. Then continue with the manual dev restart below.*

> *Speaker notes — manual dev restart (~10 seconds, off-camera-friendly): the auto-reloaded page at `localhost:3000` may render unstyled (plain serif heading, raw browser input). Tailwind v4 hot-reload quirk on Apple Silicon when many class names land at once. In Terminal B (running `npm run dev`), three commands typed by hand:*
>
> ```bash
> # 1. Ctrl+C to stop the dev server, wait for prompt
> rm -rf .next
> npm run dev
> ```
>
> *No helper script. Earlier we had `npm run dev:restart` that killed by port; inside a VS Code dev container it killed VS Code's own port-forwarding agent and broke the session. Manual is safer.*

> *Speaker notes — final check before Step 5: refresh `localhost:3000`. You should see the styled search input centered on the page, NOT the placeholder text. If still placeholder, redo the Verify step above.*

## 5:15 to 5:45, First live search — discover the closed-CFP problem

> *Speaker notes: switch to the browser tab on localhost:3000. The styled UI from Step 4 should be alive. Click into the search input.*

Type: `agentic workflows for databases`

Press Enter. Wait 1-2 seconds for results to render.

Read the top result aloud. Then point at the CFP-status pills:

> *"Five conferences ranked by semantic match. But look at these pills — some of these CFPs are already closed. I cannot submit to those. The search needs to filter on the CFP window."*

Note the closed-CFP result you pointed at; that is what Step 6 will fix.

## 5:45 to 6:15, Marquee 1: GitHub Copilot Chat fixes searchEvents.sql

> *Speaker notes: open `prisma/sql/searchEvents.sql` so it is the active file. In GitHub Copilot Chat, attach the file as context (paperclip or `#searchEvents.sql`). Agent mode on.*

Read aloud: "This is the only SQL file in the entire project. Eight lines. SQL Server 2025 has a native VECTOR(768) data type and a VECTOR_DISTANCE function. Watch GitHub Copilot Chat take a plain-English instruction and edit this file directly to fix what we just saw."

In the chat input, type:

> The search keeps returning events whose CFP is already closed or has not opened yet. Filter the search SQL so it only returns events with an open CFP right now.

Press Enter. Wait for the diff.

Expected: Copilot adds two conditions to the WHERE clause:

```sql
AND cfpOpenDate <= GETDATE()
AND cfpCloseDate >= GETDATE()
```

Accept the change. Say: "Plain English in. Working SQL out. The file is the only place T-SQL lives in this project, and the agent respected that."

## 6:15 to 6:45, Marquee 2: MSSQL Schema Designer

> *Speaker notes: switch to the MSSQL VS Code extension panel. The saved `talkscout` connection (Server `talkscout-mssql`, sa, TalkScout!Demo2026) should already be there.*

Right-click the `Event` table → **Schema Designer**. The visual table view opens showing the `Event` columns: id, slug, name, dates, topics, and the `embedding` column typed as `VECTOR(768)` alongside the relational fields. Linger 10-15 seconds.

Say:

> *"One table. Relational columns and a native 768-dim vector column side by side in SQL Server 2025. No external vector store, no syncing two systems."*

## 6:45 to 7:15, Re-run the search — the fix worked + the magic moment

> *Speaker notes: switch back to the browser at localhost:3000. Clear the input.*

Type: `agentic workflows for databases` (same query as Step 5).

Press Enter.

Read the top result aloud. Then say:

> *"Same query, same database, but the agent's SQL fix is live. The closed-CFP results are gone. And while we are here, notice something else: the word 'agentic' is not in any of these titles or descriptions. The embedding model and SQL Server's vector distance figured out what I meant."*

Expected: every result has a CFP-open pill. Top result is tagged with topics like "AI agents", "MCP", or "autonomous tooling".

## 7:15 to 7:45, Clean TypeScript moment

> *Speaker notes: open actions.ts. Hover the SEARCH_EVENTS_SQL import.*

Open `src/app/actions.ts`. Read aloud: "A handful of lines of business logic. One embed call, one parameterized query via prisma.$queryRawUnsafe. The .sql file is loaded once at module load by src/lib/sql.ts and passed in. Application code never sees a T-SQL string."

Hover the import for `SEARCH_EVENTS_SQL` from `@/lib/sql`. Show the inferred type briefly, then close.

## 7:45 to 8:45, Wrap

> *Speaker notes: switch to the browser tab with `file:///Users/carlos/scout-talk-app/demo/walkthrough-slide.html` for the closing recap. Voice up. Smile.*

"That is TalkScout. I started with a one-page plan — that got me a typed schema, a 768-dim vector column, and a seeded database. From there, I switched to OpenSpec, and every change since has been: propose in plain English, agent generates the spec, agent applies it, I approve. Spec-driven semantic search end to end inside VS Code Insiders. SQL Server 2025 stored the vectors. Prisma kept the TypeScript clean. GitHub Copilot in agent mode, with OpenSpec, drove the build — one agent, every surface in this demo. Repo and links are below. Thanks for watching."

End recording.

## Notes for the operator (not for camera)

- If the live `/opsx-apply` (Steps 3-4) runs over time, cut to a saved screenshot of the Explorer panel showing all generated files, then to the running app. Better to skip the marquee SQL beat than to overrun.
- If a primary search query fails to surface its expected top during a take, the backup queries are in `data/queries.md`. Pick whichever stays on-message.
- After each take, run `npm run demo:reset` and wait for the "Demo reset complete" message before starting the next take.
- Azure deployment was tabled for this demo; the off-camera prep and on-camera Step 10/11 cards moved to `demo/prompts-azure.html` (gitignored). Revive when you're ready to extend.
