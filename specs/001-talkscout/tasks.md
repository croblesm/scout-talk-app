# Tasks: TalkScout

**Input**: Design documents from `/specs/001-talkscout/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/server-actions.md, quickstart.md

**Tests**: No unit test runner installed. Verification is via `npm run typecheck`, `npm run build`, and manual rehearsal against documented queries (SC-001, SC-002). No test tasks are generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Next.js project**: `src/`, `prisma/`, `scripts/`, `data/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Seed data pipeline and SQL files that all user stories depend on

> The project skeleton already exists: package.json, docker-compose.yml, Prisma schema with Event model, initial migration, `src/lib/db.ts`, `src/lib/embed.ts`, `src/lib/sql.ts`, `src/lib/utils.ts`, shadcn/ui primitives (Input, Card, Badge, Button), `scripts/wait-for-db.mjs`, `scripts/smoke-test.sql`, layout, globals.css, and `.env.example`. These tasks create the remaining shared assets.

- [ ] T001 Create the dev-events HTML fixture at data/dev-events.html with at least 80 conference entries containing name, dates, location, topics, description, and CFP dates
- [ ] T002 Create the documented queries reference at data/queries.md with scripted demo queries ("agentic workflows for databases", "type safety across the stack") and their expected top results
- [ ] T003 Create the ingest script at scripts/parse-dev-events.ts that parses data/dev-events.html into data/events.json with all Event fields plus computed slug

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database layer, embedding pipeline, and seed logic that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create the prisma/sql/ directory and add prisma/sql/searchEvents.sql implementing VECTOR_DISTANCE cosine ranking with JSON-array-to-VECTOR(768) cast, accepting query vector (string) and limit (int), returning event fields plus similarity as 1 minus distance
- [ ] T005 [P] Create prisma/sql/upsertEvents.sql implementing SQL Server MERGE on slug as match key, inserting new events and updating existing events where contentHash differs, accepting all Event fields including embedding as VECTOR(768)
- [ ] T006 Verify src/lib/sql.ts loads SEARCH_EVENTS_SQL and UPSERT_EVENTS_SQL constants from prisma/sql/ at module load via fs.readFileSync. This file replaces Prisma TypedSQL which does not support the sqlserver provider. No `npx prisma generate --sql` step is needed.
- [ ] T007 Create the database seed script at prisma/seed.ts that reads data/events.json, computes SHA-256 content hashes, batch-embeds via embedBatch from src/lib/embed.ts, and upserts into SQL Server via prisma.$executeRawUnsafe(UPSERT_EVENTS_SQL, ...) with content-hash gating to skip unchanged entries

**Checkpoint**: Foundation ready. Database can be seeded with embedded conferences. SQL files are loaded at runtime via src/lib/sql.ts and invoked through $queryRawUnsafe / $executeRawUnsafe. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 -- Topic-Driven CFP Discovery (Priority: P1) MVP

**Goal**: A speaker types a topic and gets the top 5 semantically matching conferences ranked by cosine similarity, each showing name, date range, location, topic tags, CFP status pill, and similarity percentage.

**Independent Test**: Seed the catalog, open localhost:3000, type "agentic workflows for databases", and verify 5 result cards appear ranked by similarity within 3 seconds.

### Implementation for User Story 1

- [ ] T008 [US1] Create the cfp-status utility at src/lib/cfp-status.ts exporting a pure function that takes cfpOpenDate, cfpCloseDate, and current date and returns the pill state (open/closes-in-N/opens-in-N/closed/unavailable) with color (emerald/amber/red/sky/zinc-muted/zinc-neutral) per the state machine in data-model.md
- [ ] T009 [US1] Create the searchEvents Server Action at src/app/actions.ts implementing the contract from contracts/server-actions.md: validate query length (max 500, typed query-too-long error), call embed() for 768-dim vector, call prisma.$queryRawUnsafe(SEARCH_EVENTS_SQL, ...) with results typed manually via Pick<Event, ...>, apply empty-state threshold (top similarity < 0.55 AND 1st-to-5th gap < 0.05), return typed success/error response
- [ ] T010 [P] [US1] Create the CfpStatusPill component at src/components/CfpStatusPill.tsx rendering a color-coded badge using the cfp-status utility with the five states and six visual color variants (emerald, amber, red, sky, zinc-muted, zinc-neutral)
- [ ] T011 [P] [US1] Create the EventCard component at src/components/EventCard.tsx displaying conference name, date range, location, first 3 comma-separated topic tags, CfpStatusPill, and similarity percentage (Math.round(score * 100)). Cards with non-null cfpUrl link to new tab (target="_blank", rel="noopener noreferrer"). Cards with null cfpUrl show no hover affordance and no pointer cursor
- [ ] T012 [US1] Create the SearchInput component at src/components/SearchInput.tsx with indigo-to-purple gradient border (linear-gradient 90deg #4f46e5 to #7c3aed, 2px width, 3px on focus), placeholder cycling through 5 scripted query examples every 4s while empty and unfocused, pausing on focus, resuming on blur if still empty
- [ ] T013 [US1] Update the main page at src/app/page.tsx to compose SearchInput, call searchEvents Server Action on submit, render result EventCards in a ranked list, display inline error messages for query-too-long and embedding-unavailable, and show the empty-state message when no strong matches are found

**Checkpoint**: User Story 1 is fully functional. A speaker can type a topic, see ranked results with similarity scores, and click through to CFP pages. Core value proposition is delivered.

---

## Phase 4: User Story 2 -- CFP Urgency at a Glance (Priority: P2)

**Goal**: Each result card displays a color-coded CFP status pill so the speaker can instantly gauge urgency without reading dates.

**Independent Test**: Verify result cards show the correct pill color and label for all five CFP states by examining events with known CFP dates in the seeded catalog, including boundary values (N=14 renders amber, N=3 renders red).

### Implementation for User Story 2

> The CfpStatusPill component and cfp-status utility are created in US1 (T008, T010). This phase verifies boundary correctness and completes integration.

- [ ] T014 [US2] Create a boundary verification scratch script at scripts/verify-cfp-boundaries.ts that exercises the cfp-status function against the documented boundary table (N=14 amber, N=3 red, N=0 red, future open date sky, past close date zinc-muted, null dates zinc-neutral) and prints pass/fail for each case
- [ ] T015 [US2] Verify EventCard renders CfpStatusPill with correct props by confirming cfpOpenDate and cfpCloseDate are passed through from the Server Action response in src/components/EventCard.tsx

**Checkpoint**: User Stories 1 AND 2 are both independently functional. CFP urgency is visible at a glance on every result card.

---

## Phase 5: User Story 3 -- Repeatable Demo Reset (Priority: P1)

**Goal**: A presenter runs `npm run demo:reset` to return the repository and database to a known-good, pre-recording state, ready for a demo at localhost:3000.

**Independent Test**: Dirty the local state, run `npm run demo:reset`, open localhost:3000, type a scripted query, and verify results appear within 3 seconds.

### Implementation for User Story 3

- [ ] T016 [P] [US3] Create the live fetch script at scripts/fetch-dev-events.ts that downloads the dev.events conference listing HTML to data/dev-events.html (opt-in via npm run ingest:live, never on the demo path)
- [ ] T017 [US3] Create the demo reset script at scripts/demo-reset.ts that: (1) checks for dirty working tree and aborts with clear message, (2) checks for pre-implement git tag and aborts if missing, (3) resets git to the tag, (4) runs db:up, (5) runs db:migrate, (6) runs ingest and db:seed (re-embeds only changed entries via content hash), (7) runs next build and next start, targeting cold start under 90s and warm embedding rebuild under 60s
- [ ] T018 [US3] Create the demo recording script at demo/script.md with step-by-step instructions for the 8-minute demo recording, referencing the scripted queries from data/queries.md

**Checkpoint**: All three user stories are independently functional. The demo can be reset, recorded, and replayed reliably.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T019 [P] Update README.md with project overview, prerequisites, quickstart steps, npm script reference, and architecture summary
- [ ] T020 Run npm run typecheck and fix any TypeScript errors across the entire codebase
- [ ] T021 Run npm run build and fix any Next.js build errors
- [ ] T022 Run the full quickstart.md verification sequence: db:up, db:migrate, ingest, db:seed, dev, then search "agentic workflows for databases" and confirm results appear within 3 seconds

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately.
- **Foundational (Phase 2)**: Depends on T001 and T003 (events.json must exist for seed). BLOCKS all user stories.
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion.
  - US1 and US3 can proceed in parallel (different files, independent concerns).
  - US2 depends on US1 completion (T008, T010 create the pill component and utility it validates).
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: Depends on US1 (T008, T010) for the cfp-status utility and CfpStatusPill component. Verifies and extends those artifacts.
- **User Story 3 (P1)**: Can start after Foundational (Phase 2). Independently testable. T016 and T017 touch different files than US1.

### Within Each User Story

- Utility/library code before components (T008 before T010, T011)
- Server Action before page integration (T009 before T013)
- Components before page composition (T010, T011, T012 before T013)

### Parallel Opportunities

- T004 and T005 can run in parallel (different SQL files)
- T010 and T011 can run in parallel (different component files)
- US1 and US3 can run in parallel after Phase 2 (no file overlap)
- T016 and T017 are in different files but T017 depends on seeding infrastructure
- T019, T020, T021 touch independent concerns in Phase 6

---

## Parallel Example: User Story 1

```text
# After T008 (cfp-status utility) and T009 (Server Action) are done:
Task T010: "Create CfpStatusPill component in src/components/CfpStatusPill.tsx"
Task T011: "Create EventCard component in src/components/EventCard.tsx"

# These two components are in different files and can be built simultaneously.
# T012 (SearchInput) can also run in parallel with T010/T011.
```

## Parallel Example: Cross-Story

```text
# After Phase 2 (Foundational) is complete:
Developer A: User Story 1 (T008-T013) -- search UI and Server Action
Developer B: User Story 3 (T016-T018) -- demo reset and recording script

# US1 and US3 have zero file overlap and can proceed simultaneously.
# US2 (T014-T015) must wait for US1 completion.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007)
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Type "agentic workflows for databases" at localhost:3000. Results in under 3 seconds.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational (T001-T007) -- database seeded, embeddings computed
2. Add User Story 1 (T008-T013) -- semantic search works end-to-end (MVP)
3. Add User Story 2 (T014-T015) -- CFP urgency pills verified at boundaries
4. Add User Story 3 (T016-T018) -- demo reset is repeatable
5. Polish (T019-T022) -- README, typecheck, build, quickstart validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 (T008-T013)
   - Developer B: User Story 3 (T016-T018)
3. After US1 completes: Developer A pivots to US2 (T014-T015)
4. Team completes Polish together (T019-T022)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- No test tasks generated (no unit test runner installed per plan.md)
- Verification is via typecheck, build, and manual rehearsal per quickstart.md
