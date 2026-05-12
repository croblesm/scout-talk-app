# TalkScout Demo Script (8 minutes)

The on-camera teleprompter is `demo/prompts.html`. This file is the timed version with speaker notes for rehearsal.

Times are wall-clock from when recording starts. The total budget is 8:00 with at least 30 seconds of buffer (SC-004).

## Pre-flight setup (BEFORE Step 1, off-camera)

`npm run demo:reset` does NOT start the dev server anymore. You start it manually in a foreground terminal so you have full control over it across the take.

Two terminals:

- **Terminal A**: `npm run demo:reset`. Wait for "Demo reset complete in Ns".
- **Terminal B** (new tab/split, Cmd+\\): `npm run dev`. Wait for `✓ Ready in Ns`.

Then open `http://localhost:3000`. You MUST see the placeholder ("Search UI lands when you run /opsx-propose and then /opsx-apply"). If not, the dev server has a problem — fix it before you touch Copilot Chat.

Why this design: the dev server is your BEFORE state on camera. Keeping it in a visible foreground terminal means you always know whether it is running, and Ctrl+C stops it cleanly. The previous script-managed background dev server caused recording-day grief (silent kills, no recovery path) and is gone.

Keep Terminal B alive through Steps 1, 2, 3, and 4. After `/opsx-apply` finishes (end of Step 4), Ctrl+C Terminal B and run `npm run dev:restart` there. That picks up the new Tailwind classes and gives you the AFTER state.

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

## 1:30 to 3:00, /opsx-propose (live)

> *Speaker notes: switch to GitHub Copilot Chat panel. Paste the slash command from prompts.html Card 3. Talk through it as files appear.*

Paste the full Card 3 prompt into GitHub Copilot Chat. The agent creates `openspec/changes/add-semantic-search-ui/` with three files: `proposal.md`, `design.md`, `tasks.md`. About 60 to 90 seconds.

Open `openspec/changes/add-semantic-search-ui/tasks.md` briefly. Scroll through the task list. Read aloud one or two tasks so the audience can see the spec is concrete and actionable.

> *Voiceover during the wait: "OpenSpec calls the unit of work a 'change.' The slash command takes my plain-English description, looks at the project context in config.yaml, and generates three artifacts in one shot: proposal, design, tasks. Watch the changes folder fill up."*

## 3:00 to 4:30, /opsx-apply (live)

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

> *Speaker notes — VERIFY before continuing (~5 seconds, off-camera-friendly): when /opsx-apply finishes, open `src/app/page.tsx`. It must start with `'use client'` and import SearchInput + EventCard. If you still see the placeholder paragraph ("Search UI lands when you run /opsx-propose and then /opsx-apply"), the agent skipped the page.tsx modification (this is the most common live failure). Paste this into the SAME Copilot Chat to recover:*
>
> ```
> You did not modify src/app/page.tsx. Per openspec/changes/add-semantic-search-ui/tasks.md, the placeholder Home component must be REPLACED with one that uses the new SearchInput and EventCard components and manages search state with useState. Apply that change now, then show me the diff.
> ```
>
> *Wait for the diff. Approve it. Then continue with the dev:restart below.*

> *Speaker notes — dev:restart (~5 seconds, off-camera-friendly): the auto-reloaded page at `localhost:3000` may render unstyled (plain serif heading, raw browser input). This is a Tailwind v4 hot-reload quirk on Apple Silicon when many class names are introduced in one drop. Go to Terminal B (the one running `npm run dev` from pre-flight setup), press Ctrl+C to stop the server, then in the SAME Terminal B run:*
>
> ```bash
> npm run dev:restart
> ```
>
> *This wipes `.next/` and starts a fresh dev server in the foreground of Terminal B. Tailwind re-scans every newly created file; the page hot-reloads with proper styling.*

> *Speaker notes — final check before Step 5: refresh `localhost:3000`. You should see the styled search input centered on the page, NOT the placeholder text. If still placeholder, redo the Verify step above.*

## 3:30 to 4:30, Marquee 1: GitHub Copilot Chat edits searchEvents.sql

> *Speaker notes: open `prisma/sql/searchEvents.sql` so it is the active file. In GitHub Copilot Chat, attach the file as context (paperclip or `#searchEvents.sql`). Agent mode on.*

Read aloud: "Eight lines. SQL Server 2025 has a native VECTOR(768) data type and a VECTOR_DISTANCE function. The query embedding arrives as a JSON array and is cast to a vector in place. Now watch GitHub Copilot Chat take an instruction in plain English and edit this file directly."

In the chat input, type:

> The search keeps returning events whose CFP is already closed or has not opened yet. Filter the search SQL so it only returns events with an open CFP right now.

Press Enter. Wait for the diff.

Expected: GitHub Copilot opens the file, shows a diff, and adds two conditions to the WHERE clause along these lines:

```sql
AND cfpOpenDate <= GETDATE()
AND cfpCloseDate >= GETDATE()
```

Accept the change. Say: "Plain English in. Working SQL out. The file is the only place T-SQL lives in this project, and the agent respected that."

> *Speaker notes: undo the change before moving on (Cmd+Z) so the file is clean for the next take.*

## 4:30 to 5:00, Clean TypeScript moment

> *Speaker notes: open actions.ts. Hover the searchEvents import.*

Open `src/app/actions.ts`. Read aloud: "A handful of lines of business logic. One embed call, one parameterized query via prisma.$queryRawUnsafe. The .sql file is loaded once at module load by src/lib/sql.ts and passed in. Application code never sees a T-SQL string."

Hover the import for `SEARCH_EVENTS_SQL` from `@/lib/sql`. Show the inferred type briefly, then close.

## 5:00 to 5:30, Marquee 2: MSSQL extension query editor

> *Speaker notes: switch to MSSQL VS Code extension panel. The talkscout connection should already be saved.*

Click the connect icon on the saved `talkscout` connection. Open a new query window.

Paste:

```sql
SELECT TOP 3
    name,
    topics,
    LEFT(CAST(embedding AS NVARCHAR(MAX)), 80) + '...' AS embedding_preview,
    VECTORPROPERTY(embedding, 'Dimensions') AS dims
FROM Event
ORDER BY name;
```

Press F5. Read aloud: "Three rows. The embedding column is real, dimension 768, just sitting there in SQL Server. No extension. No external service. Native."

## 5:30 to 6:00, Magic moment 1

> *Speaker notes: switch to the browser at localhost:3000. The page should be clean. Click into the search input.*

Type: `agentic workflows for databases`

Press Enter. Wait roughly 1 to 2 seconds for results to render.

Read the top result name aloud. Then say: "The word 'agentic' is not in the title. Not in the topics. Not in the description. The embedding model and SQL Server's vector distance figured out this is what I meant."

## 6:00 to 6:30, Magic moment 2

> *Speaker notes: clear the input. The placeholder should resume cycling.*

Type: `type safety across the stack`

Press Enter. Wait for results.

Read the top result name aloud. Say: "Same trick, different topic. Vocabulary mismatch handled by semantic search."

## 6:30 to 7:30, Schema Designer via GitHub Copilot Chat (agent mode)

> *Speaker notes: GitHub Copilot Chat panel must be in Agent mode. The MSSQL extension must be loaded with the talkscout connection. Skip if running short.*

Paste into GitHub Copilot Chat (agent mode, natural language; the agent picks the right tool):

```
Open the Schema Designer for the Event table in the talkscout database.
```

The agent picks the MSSQL extension's Schema Designer tool on its own and invokes it. The visual table view opens, showing the `Event` columns including the `VECTOR(768)` embedding column. Linger 10 to 20 seconds.

Say:

> *"GitHub Copilot drove the spec. The same agent generated the code. The same agent wrote the SQL filter. And the same agent opened the Schema Designer for me. One assistant, every surface in this demo."*

## 7:30 to 8:30, Marquee 3: same agentic primitive, deployment layer

> *Speaker notes: stay on the Copilot Chat panel. Switch to branch `002-azure-deploy` (or whichever branch carries the saved deploy transcript). Scroll to the saved `/opsx-apply add-azure-deployment` exchange. Use the scrollbar smoothly so the audience can read.*

Say, as the transcript scrolls:

> *"OpenSpec drove the local build. The same primitive (the agent reads context, proposes, applies, I approve) works for infrastructure too. I ran this before tape rolled because a cold cloud deploy takes about five minutes. Let me scroll the chat so you can see what happened."*

Highlight task 0 in `openspec/changes/add-azure-deployment/tasks.md`: `/plugin install azure@claude-plugins-official`. Say:

> *"Task zero is the plugin install. The agent picks up the OpenSpec change, sees it needs Azure skills, and installs them. Then it generates the Bicep, the Dockerfile, and the deploy plan. I approve each gate."*

Scroll past the `azure-prepare` → `azure-validate` → `azure-deploy` chain. Pause on the final live URL output. Say:

> *"Five minutes later, `azd up` finishes. Container Apps environment, Azure SQL Database on the free offer, an Ollama sidecar running the same `nomic-embed-text` model that runs on my Mac. Zero dollars on free-tier resources. No Azure OpenAI quota required."*

## 8:30 to 9:15, Marquee 4: same app, in Azure

> *Speaker notes: switch to the browser tab with the cloud URL. The DB was pre-warmed before tape so this is fast. If you forgot to pre-warm, the first query may take 30-60 seconds while the free-tier serverless DB resumes — keep talking.*

Click into the search input. Type: `type safety across the stack`. Press Enter.

Wait for results. Read the top result aloud. Say:

> *"Same UI, same searches, same SQL Server vectors (now Azure SQL Database on the free offer), same embedding model (now running as a Container Apps sidecar instead of on my Mac). Different host, identical code."*

Then close the laptop lid metaphorically:

> *"Two agentic flows. OpenSpec for the code, Azure skills for the platform. Both natural language, both inside VS Code, both backed by my repo's source of truth."*

## 9:15 to 9:45, Wrap

> *Speaker notes: back to camera. Voice up. Smile.*

"That is TalkScout. Spec-driven local development and agent-driven cloud deployment, end to end inside VS Code, in about ten minutes. SQL Server 2025 stored the vectors. Prisma kept the TypeScript clean. GitHub Copilot, with OpenSpec, drove the build. The same agent, with Azure skills, drove the deploy. Repo and links are below. Thanks for watching."

End recording.

## Notes for the operator (not for camera)

- If the live `/opsx-apply` (Steps 3-4) runs over time, cut to a saved screenshot of the Explorer panel showing all generated files, then to the running app. Better to skip the marquee GitHub Copilot in SQL moment than to overrun.
- If a primary search query fails to surface its expected top during a take, the backup queries are in `data/queries.md`. Pick whichever stays on-message.
- After each take, run `npm run demo:reset` and wait for the "Demo reset complete" message before starting the next take. **Note: `demo:reset` does NOT touch the cloud stack.** The Azure deploy was provisioned once off-camera (see `demo/azure-deploy-runbook.md`) and is shared across all takes. Pre-warm the cloud URL by hitting `/` a few times 5 minutes before tape so the free-tier SQL DB does not cold-resume on camera.
- If the cloud URL 500s on the live search during the take, fall back to a saved screenshot of the cloud app showing prior results, and narrate over it. Better to show a still than a broken UI.
- If the Azure beat needs to be cut entirely (e.g., 002-azure-deploy did not make the merge gate), record from the `001-talkscout` branch and end at 8:00 as in the original 8-min cadence.
