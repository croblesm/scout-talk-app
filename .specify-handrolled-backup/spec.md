# Feature Specification: TalkScout (CFP Finder for Dev Conferences)

**Feature Branch**: `001-talkscout`
**Created**: 2026-05-07
**Status**: Clarified, Plan-Ready
**Input**: User description: "Help speakers find upcoming dev conferences whose topics match a talk they want to give, with CFP status surfaced so they know what to act on."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Topic-driven CFP discovery (Priority: P1)

A working developer or developer advocate has a topic in mind and wants a short, ranked list of upcoming dev conferences worth submitting that talk to.

**Why this priority**: This is the entire reason the product exists. Without it, there is no demo and no value. P1.

**Independent Test**: Type a natural-language topic into the search input and confirm the top 5 results are upcoming conferences whose topics semantically match the input, with CFP status visible on each result card.

**Acceptance Scenarios**:

1. **Given** the catalog is seeded with at least 80 upcoming events, **When** the user types "agentic workflows for databases" and submits, **Then** the top result is an event whose name, description, and top 3 topic tags do NOT contain the word "agentic" (proving semantic match, not keyword match).
2. **Given** the catalog is seeded, **When** the user types "type safety across the stack" and submits, **Then** the top result surfaces a tRPC, end-to-end TypeScript, or contract-driven event.
3. **Given** the user types a query that matches no event well, **When** they submit, **Then** an empty state appears with the user's query echoed and a suggestion to broaden phrasing.

### User Story 2 - CFP urgency at a glance (Priority: P2)

The user can tell, from the result card alone, whether the CFP is open, closing soon, opening soon, closed, or has no published dates.

**Why this priority**: Without urgency, the speaker has to click into every result. This is a usability multiplier on User Story 1.

**Independent Test**: Render result cards for events with each of the five CFP states and confirm the pill text and color match the spec.

**Acceptance Scenarios**:

1. **Given** an event whose CFP closes in 2 days, **When** the card renders, **Then** the pill reads "CFP closes in 2 days" with red urgency styling.
2. **Given** an event with no published CFP dates, **When** the card renders, **Then** the pill reads "CFP info unavailable" with neutral gray styling and the event still appears in results.

### User Story 3 - Repeatable demo (Priority: P1)

The presenter can run `npm run demo:reset` and arrive at a known-good state in under 90 seconds, ready for the next take.

**Why this priority**: The demo is the only deliverable. Repeatability is the demo's existence guarantee. P1 alongside Story 1.

**Acceptance Scenarios**:

1. **Given** a partially completed previous take, **When** the presenter runs `npm run demo:reset`, **Then** within 90 seconds the database is reseeded, the dev server is up, and a search returns the documented top result for both primary scripted queries.
2. **Given** the working tree is dirty, **When** the presenter runs `npm run demo:reset`, **Then** the script aborts with a clear error rather than discarding uncommitted changes.

## Functional Requirements *(mandatory)*

- **FR-001**: System MUST maintain a catalog of upcoming dev conferences with at least 80 entries, each containing: a stable identifier (the `slug`, derived from the event name; this is the upsert key for ingest), an internal surrogate `id`, name, start/end dates, location (city, country, or "virtual"), topic tags, description, CFP open date, CFP close date, CFP submission URL.
- **FR-002**: System MUST provide a repeatable ingest job that reads a public source (committed HTML fixture from dev.events) and upserts entries into the catalog. Re-running ingest on unchanged source data MUST be a no-op.
- **FR-003**: System MUST generate a vector embedding for each catalog entry from its description and topic tags. Embeddings MUST regenerate only when the source content changes (gated by a content hash).
- **FR-004**: System MUST accept a free-text query of up to 500 characters, generate an embedding for it, and rank catalog entries by semantic similarity, returning the top 5 with similarity scores in [0, 1]. If the embedding service is unreachable, the search action MUST return a typed `{ ok: false, error: 'embedding-unavailable' }` result and the UI MUST render a friendly inline message ("Search is temporarily unavailable. Try again in a moment.") rather than a stack trace or unhandled exception. Database connectivity failures are out of scope for v1 error handling and may propagate as unhandled (acceptable for demo scope; the database is local Docker, not a real-world dependency).
- **FR-005**: UI MUST present one search input and the ranked results as cards showing: conference name, date range, location, the first 3 comma-separated items of the `topics` field (by position, no ranking; whitespace trimmed), CFP status pill, similarity score as an integer percentage (rounded to nearest whole number, no decimals, e.g. 0.8347 renders as "83%"). The search input MUST cycle its placeholder text through example queries every 4 seconds when empty and unfocused, to suggest the kind of phrasing TalkScout handles well. Cards with a non-null `cfpUrl` MUST open it in a new tab on click. Cards with a null `cfpUrl` MUST be visually marked non-interactive (no hover affordance, no cursor pointer) and clicking is a no-op.
- **FR-006**: System MUST render the CFP status pill in one of five states with explicit colors. Boundary values are inclusive on the more-urgent side (the most urgent matching state wins): "CFP open" when **N > 14** days remaining (**green**); "CFP closes in N days" when **3 < N ≤ 14** (**amber**) or **N ≤ 3** (**red**); "CFP opens in N days" when open is in the future (**blue**); "CFP closed" when close is in the past (**gray, muted**); "CFP info unavailable" when no open/close dates are published (**neutral gray**).
- **FR-007**: System MUST show an empty state when the top result's similarity score is below 0.55 AND its margin over the 5th result is less than 0.05. **If fewer than 5 embedded events exist** (catalog under-seeded, or all matches filtered out), the margin condition is treated as not met and results are shown as-is (no empty state). The empty state MUST echo the user's query and suggest broader phrasing.
- **FR-008**: System MUST surface relevant events even when the user's wording does not appear verbatim in the event description. The recording demonstrates this with at least two scripted queries whose top result contains none of the query's keywords.
- **FR-009**: A single command MUST reset the catalog to the committed seed and rebuild embeddings. On a warm Docker stack, embedding rebuild MUST complete in under 60 seconds (this is the embedding sub-budget within SC-003's 90-second cold-stack total).

## Success Criteria *(mandatory)*

- **SC-001**: First search result is under 3 seconds. "First" here means: Next.js process freshly booted, Ollama already warm (from `db:seed`, which exercised the embedding model). The app does not need to handle an Ollama cold start within the 3-second budget.
- **SC-002**: Both scripted vocabulary-mismatch queries return their documented top result on every run.
- **SC-003**: From `npm run demo:reset` (cold stack: containers down, no cache) to a search-ready browser at `localhost:3000`, total wall-clock time is under 90 seconds (of which embedding rebuild is ≤ 60 seconds, per FR-009).
- **SC-004**: The full demo, including narration, fits in 8 minutes with at least 30 seconds of buffer.

## Out of Scope (this iteration)

User accounts, saved searches, notifications, submitting CFPs from inside TalkScout, past conferences or session-level search, mobile-specific layout (desktop only is acceptable for the recording), multi-language queries.

## Assumptions

- The dev.events listings source is stable enough to scrape once and commit a fixture; the demo never depends on a live fetch.
- The set of topic tags in the source is a reasonable basis for semantic matching without manual taxonomy work.
- A developer running this locally has Docker (or OrbStack) and Ollama available.

## Clarifications (resolved)

### CFP urgency thresholds (FR-006)
- Green when N > 14, amber when 3 < N ≤ 14, red when N ≤ 3. Boundary at N=14 is amber; boundary at N=3 is red. The most urgent state wins on overlap.

### Empty-state similarity floor (FR-007)
- Relative floor: top result < 0.55 AND margin to #5 < 0.05. A fixed threshold breaks when the embedding model changes scale.

### Virtual events under location-flavored queries
- No location filtering in v1. All events compete on semantic match alone. Location is shown on the card; users filter visually.

### Conference series with multiple regional instances
- Show each instance as a separate result. KubeCon EU and KubeCon NA have different CFP dates and different review committees, so they are different opportunities.

### Events with no published CFP dates
- Include in results. Render the "CFP info unavailable" pill in neutral gray. Topical fit is independent of CFP metadata quality.

### Scripted demo queries (FR-008)
- **Primary (on camera):** "agentic workflows for databases" and "type safety across the stack"
- **Backups (held in reserve):** "talking about Postgres performance", "building reliable AI evaluation pipelines", "running databases on Kubernetes at scale"

### Embedding model and dimension
- `nomic-embed-text` via host Ollama, 768-dim. Schema declares `Unsupported("VECTOR(768)")`.

### Embedding generation location
- In Node via the `ollama` npm package. Not in T-SQL via `AI_GENERATE_EMBEDDINGS` (rejected after smoke-test friction with HTTPS-only external endpoints).
