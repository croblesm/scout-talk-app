# Server Actions Contract: TalkScout

**Feature**: 001-talkscout | **Date**: 2026-05-08

## Overview

TalkScout exposes its functionality through Next.js 15 Server Actions defined in `src/app/actions.ts`. There is no separate API server or REST endpoint. The browser invokes Server Actions directly via React's form/action mechanism.

## Actions

### `searchEvents(query: string)`

Performs semantic search over the conference catalog.

**Input**:
- `query`: string, 1-500 characters, free-text topic description

**Output** (success):
```typescript
{
  success: true;
  data: Array<{
    id: string;
    slug: string;
    name: string;
    startDate: Date;
    endDate: Date;
    locationCity: string | null;
    locationCountry: string | null;
    isVirtual: boolean;
    topics: string;          // comma-separated
    cfpOpenDate: Date | null;
    cfpCloseDate: Date | null;
    cfpUrl: string | null;
    similarity: number;      // 0-1 float, displayed as Math.round(score * 100)%
  }>;
}
```

**Output** (error):
```typescript
{
  success: false;
  error: {
    type: "query-too-long" | "embedding-unavailable";
    message: string;  // user-friendly message for inline display
  };
}
```

**Behavior**:
1. Validates query length (max 500 characters). Returns `query-too-long` error if exceeded.
2. Calls `embed(query)` to generate a 768-dim vector via host Ollama. Returns `embedding-unavailable` error if Ollama is unreachable.
3. Calls `prisma.$queryRawUnsafe(SEARCH_EVENTS_SQL, JSON.stringify(vector), 5)` where `SEARCH_EVENTS_SQL` is loaded from `prisma/sql/searchEvents.sql` by `src/lib/sql.ts`. Results are typed manually via `Pick<Event, ...>` helpers.
4. Applies empty-state logic: if top result similarity < 0.55 AND gap between 1st and 5th result < 0.05, returns empty array. If fewer than 5 results, the margin condition is not evaluated (results are always returned).
5. Returns up to 5 results ranked by descending similarity.

**Performance**: First result under 3 seconds from submission (SC-001) with warm embedding service.

## Error Types

| Type | Trigger | User-Facing Message |
|------|---------|-------------------|
| `query-too-long` | Query exceeds 500 characters | "Query must be 500 characters or fewer." |
| `embedding-unavailable` | Ollama unreachable or model not loaded | "Search is temporarily unavailable. Please ensure Ollama is running." |

## Notes

- Database errors are out of scope for v1 (FR-004). They will surface as unhandled exceptions.
- The Server Action is the only interface between client and server. No REST endpoints, no GraphQL.
- The `description` field is intentionally excluded from the search response to keep payloads small. It is only used for embedding generation at ingest time.
