# Feature Specification: TalkScout, CFP Finder for Dev Conferences

**Feature Branch**: `001-talkscout`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "TalkScout: a CFP finder for upcoming dev conferences. A speaker types a topic in plain English and the app returns the top 5 upcoming dev conferences whose CFP topics semantically match."

## User Scenarios & Testing *(mandatory)*

### User Story 1: Topic-Driven CFP Discovery (Priority: P1)

A speaker (working developer or developer advocate) wants to find conferences accepting talks on a specific topic. They type a natural-language description of the talk they want to give (up to 500 characters) into a single search input. The system embeds the query server-side, ranks events from a pre-seeded catalog of at least 80 upcoming dev conferences by cosine similarity against pre-computed embeddings, and returns the top 5 matches. Each result card shows the conference name, date range, location, first three topic tags, a CFP status pill, and a similarity score as an integer percentage. Vocabulary mismatch is handled semantically: a query like "agentic workflows for databases" surfaces relevant events even when their descriptions never contain the word "agentic."

**Why this priority**: This is the core value proposition. Without semantic search over a conference catalog, the product has no reason to exist.

**Independent Test**: Can be fully tested by seeding the catalog, typing a topic query, and verifying that semantically relevant conferences appear ranked by similarity, delivering the primary discovery value with no other features required.

**Acceptance Scenarios**:

1. **Given** the catalog is seeded with at least 80 upcoming events with embeddings computed, **When** a speaker types "agentic workflows for databases" and submits, **Then** the system returns up to 5 result cards ranked by descending similarity score, each showing conference name, date range, location, first 3 topic tags, CFP status pill, and similarity percentage.

2. **Given** the catalog is seeded, **When** a speaker types "type safety across the stack" and submits, **Then** the system returns up to 5 semantically relevant results, including events whose descriptions use related terms (e.g., "end-to-end type checking," "full-stack TypeScript") but not the exact query words.

3. **Given** the catalog is seeded, **When** a speaker types a query exceeding 500 characters, **Then** the system rejects the query with a typed `query-too-long` error and the UI displays a clear inline message explaining the character limit.

4. **Given** the catalog is seeded, **When** the embedding service is unreachable at query time, **Then** the system returns a typed `embedding-unavailable` error and the UI shows a friendly inline message (not a stack trace or generic error page).

5. **Given** the catalog is seeded and results are returned, **When** a speaker clicks a result card that has a CFP submission URL, **Then** the CFP submission page opens in a new browser tab (with `target="_blank"` and `rel="noopener noreferrer"`).

6. **Given** a result card has no CFP submission URL (null), **When** the speaker hovers over or clicks it, **Then** no hover affordance is shown, the cursor does not change to a pointer, and clicking is a no-op.

---

### User Story 2: CFP Urgency at a Glance (Priority: P2)

Each result card displays a color-coded CFP status pill so the speaker can instantly gauge urgency without reading dates. The pill has five mutually exclusive states with prescribed colors, and the most urgent state wins when date ranges overlap.

**Why this priority**: Urgency information transforms search results from a list of names into an actionable decision tool. It depends on US1's result cards existing but adds high value with minimal complexity.

**Independent Test**: Can be tested independently by rendering result cards with known CFP dates covering all five states and verifying correct pill color and label for each, including boundary values.

**Acceptance Scenarios**:

1. **Given** a conference has a CFP deadline more than 14 days away, **When** displayed as a result card, **Then** the pill shows "CFP open" in green.

2. **Given** a conference has a CFP deadline in exactly 14 days, **When** displayed as a result card, **Then** the pill shows "CFP closes in 14 days" in amber.

3. **Given** a conference has a CFP deadline between 4 and 14 days away (exclusive of boundaries), **When** displayed as a result card, **Then** the pill shows "CFP closes in N days" in amber.

4. **Given** a conference has a CFP deadline in exactly 3 days, **When** displayed as a result card, **Then** the pill shows "CFP closes in 3 days" in red.

5. **Given** a conference has a CFP deadline in 1 to 3 days (inclusive), **When** displayed as a result card, **Then** the pill shows "CFP closes in N days" in red.

6. **Given** a conference's CFP has not yet opened but has a known future open date, **When** displayed as a result card, **Then** the pill shows "CFP opens in N days" in blue.

7. **Given** a conference's CFP deadline has passed, **When** displayed as a result card, **Then** the pill shows "CFP closed" in muted gray.

8. **Given** a conference has no published CFP dates, **When** displayed as a result card, **Then** the pill shows "CFP info unavailable" in neutral gray.

---

### User Story 3: Repeatable Demo Reset (Priority: P1)

A presenter preparing a live demo or recording can run a single command (`npm run demo:reset`) to return the repository and database to a known-good, pre-recording state. This ensures every demo run is identical and eliminates "works on my machine" drift.

**Why this priority**: The entire feature is built for a demo recording. If the demo cannot be reliably reproduced, the other stories have no delivery vehicle.

**Independent Test**: Can be tested by dirtying local state (modifying data, changing files), running `npm run demo:reset`, and verifying the system returns to the exact pre-recording state with all services running and search-ready.

**Acceptance Scenarios**:

1. **Given** the Docker stack is stopped and no build cache exists, **When** a developer runs `npm run demo:reset`, **Then** the system is fully rebuilt and search-ready at `localhost:3000` within 90 seconds total.

2. **Given** the Docker stack is already running (warm stack), **When** a developer runs `npm run demo:reset`, **Then** embedding rebuild completes in under 60 seconds.

3. **Given** the working tree has uncommitted changes, **When** a developer runs `npm run demo:reset`, **Then** the command aborts immediately with a clear error message explaining the dirty working tree.

4. **Given** the pre-implement git tag is missing from the repository, **When** a developer runs `npm run demo:reset`, **Then** the command aborts immediately with a clear error message explaining the missing tag.

5. **Given** a successful `npm run demo:reset` completes, **When** a developer opens `localhost:3000` and types a scripted query, **Then** results appear within 3 seconds, confirming the system is fully operational.

---

### Edge Cases

- What happens when a query returns results but the top result has similarity below 0.55 and the margin between the 1st and 5th result is less than 0.05? The system shows an empty-state message indicating no strong matches were found.
- What happens when fewer than 5 events have computed embeddings? The margin condition (1st-to-5th gap < 0.05) is treated as not met, so results are always shown regardless of similarity score.
- What happens when the search input placeholder is cycling and the user focuses the field? Placeholder cycling pauses immediately on focus and resumes on blur if the field is still empty.
- What happens when a conference's CFP dates span a state boundary between search time and display time? The most-urgent state wins on overlap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a conference catalog of at least 80 upcoming events, each containing: name, dates (start/end), location, topic tags, description, CFP open date, CFP close date, CFP submission URL, a slug as a stable external identifier, and an internal surrogate ID.

- **FR-002**: System MUST provide repeatable, idempotent catalog ingestion gated by content hash. Re-running ingestion with unchanged source data produces no database mutations.

- **FR-003**: System MUST generate vector embeddings (dimension 768) for catalog entries and regenerate them only when the underlying content changes (detected via content hash comparison).

- **FR-004**: System MUST accept free-text search queries up to 500 characters and return the top 5 results ranked by cosine similarity with scores normalized to [0, 1]. The system MUST reject queries exceeding 500 characters with a typed `query-too-long` error. The system MUST return a typed `embedding-unavailable` error with a user-friendly inline message when the embedding service is unreachable. Database errors are out of scope for v1.

- **FR-005**: System MUST render a UI consisting of:
  - A single search input field with an indigo-to-purple gradient border (linear-gradient 90deg from #4f46e5 to #7c3aed, 2px width, 3px on focus)
  - A placeholder that cycles through 5 example queries every 4 seconds (instant text replacement) while the input is empty AND unfocused; pauses on focus; resumes on blur if still empty
  - Ranked result cards showing: conference name, date range, location, first 3 topic tags (comma-separated, whitespace-trimmed), CFP status pill, and similarity score as an integer percentage (Math.round(score * 100), no decimals)
  - Cards with a non-null CFP URL open it in a new tab on click (`target="_blank"`, `rel="noopener noreferrer"`)
  - Cards with a null CFP URL show no hover affordance, no cursor pointer, and clicking is a no-op

- **FR-006**: System MUST display a CFP status pill on each result card in one of five states with explicit colors:
  - **Green**: "CFP open" (more than 14 days remaining)
  - **Amber**: "CFP closes in N days" (3 < N ≤ 14)
  - **Red**: "CFP closes in N days" (1 ≤ N ≤ 3)
  - **Blue**: "CFP opens in N days" (CFP not yet open)
  - **Muted gray**: "CFP closed" (deadline has passed)
  - **Neutral gray**: "CFP info unavailable" (no published dates)
  - Boundary at N=14 renders amber; boundary at N=3 renders red
  - Most-urgent state wins when date ranges overlap

- **FR-007**: System MUST show an empty-state message when the top result's similarity score is below 0.55 AND the margin between the 1st and 5th result is less than 0.05. If fewer than 5 embedded events exist, the margin condition is treated as not met (results are always shown).

- **FR-008**: System MUST handle vocabulary mismatch semantically. Queries using terms absent from event descriptions (e.g., "agentic") still surface events with semantically related content. This is an inherent property of embedding-based search, not a keyword expansion mechanism.

- **FR-009**: System MUST provide a `npm run demo:reset` command that returns the repository and database to a known-good pre-recording state. On a warm Docker stack, embedding rebuild MUST complete in under 60 seconds. The command MUST abort loudly if the working tree is dirty or the pre-implement git tag is missing.

### Key Entities

- **Conference**: Represents an upcoming developer conference. Key attributes: name, slug (stable external identifier), internal ID (surrogate), start date, end date, location, description, topic tags, CFP open date, CFP close date, CFP submission URL.

- **Embedding**: Represents a vector representation of a conference's semantic content. Key attributes: associated conference, embedding vector (768 dimensions), content hash (for change detection).

- **Search Query**: Represents a speaker's natural-language topic input. Key attributes: query text (up to 500 characters), resulting embedding vector, timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The first search result appears in under 3 seconds from query submission, measured with a freshly booted application process and a warm embedding service (pre-warmed from catalog seeding).

- **SC-002**: Both scripted demo queries ("agentic workflows for databases" and "type safety across the stack") return their documented top result consistently on every run against the seeded catalog.

- **SC-003**: Running `npm run demo:reset` from a cold stack (containers stopped, no build cache) to a search-ready browser at `localhost:3000` completes in under 90 seconds total, of which embedding rebuild accounts for no more than 60 seconds.

- **SC-004**: The complete demo recording fits within an 8-minute window with at least 30 seconds of buffer remaining.

## Out of Scope

- User accounts and authentication
- Saved searches or search history
- Notifications (email, push, or in-app)
- Submitting CFPs from inside the application
- Past / historical conferences
- Session-level search (searching within a conference's sessions)
- Mobile-specific or responsive layout optimizations
- Multi-language query support

## Assumptions

- dev.events conference listings are stable enough to scrape once and commit as a static fixture; the demo never depends on a live fetch from dev.events at runtime.
- Topic tags provided by the source data are a reasonable semantic basis for matching against speaker queries.
- The developer running the demo locally has Docker (or OrbStack) and Ollama installed and available on their machine.
- The 768-dimension embedding model is available locally via Ollama and does not require external API calls or network access during the demo.
- The seeded catalog of 80+ events provides sufficient diversity of topics to demonstrate meaningful semantic search differentiation between queries.
