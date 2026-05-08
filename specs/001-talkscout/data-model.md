# Data Model: TalkScout

**Feature**: 001-talkscout | **Date**: 2026-05-08

## Entities

### Event

The central entity representing a developer conference in the catalog.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `String` (cuid) | PK, auto-generated | Internal surrogate identifier |
| `slug` | `String` | Unique, upsert key | Stable external identifier derived from source data |
| `name` | `String` | Required | Conference display name |
| `startDate` | `DateTime` | Required | Conference start date |
| `endDate` | `DateTime` | Required | Conference end date |
| `locationCity` | `String?` | Nullable | City name (null for virtual-only events) |
| `locationCountry` | `String?` | Nullable | Country name (null for virtual-only events) |
| `isVirtual` | `Boolean` | Default: false | Whether the event is virtual-only or has a virtual option |
| `topics` | `String` (NVarChar(Max)) | Required | Comma-separated topic tags in a single column |
| `description` | `String` (NVarChar(Max)) | Required | Full event description used for embedding generation |
| `cfpOpenDate` | `DateTime?` | Nullable | Date the CFP opens for submissions |
| `cfpCloseDate` | `DateTime?` | Nullable | Date the CFP closes for submissions |
| `cfpUrl` | `String?` | Nullable | URL for CFP submission page |
| `contentHash` | `String` (Char(64)) | Required | SHA-256 hash of semantic content fields for change detection |
| `embedding` | `Unsupported("VECTOR(768)")?` | Nullable | 768-dimension vector embedding from nomic-embed-text |
| `ingestedAt` | `DateTime` | Default: now() | Timestamp of first ingestion |
| `updatedAt` | `DateTime` | Auto-updated | Timestamp of last update |

**Table mapping**: `@@map("Event")`

### Prisma Schema (existing)

```prisma
model Event {
  id              String                       @id @default(cuid())
  slug            String                       @unique
  name            String
  startDate       DateTime
  endDate         DateTime
  locationCity    String?
  locationCountry String?
  isVirtual       Boolean                      @default(false)
  topics          String                       @db.NVarChar(Max)
  description     String                       @db.NVarChar(Max)
  cfpOpenDate     DateTime?
  cfpCloseDate    DateTime?
  cfpUrl          String?
  contentHash     String                       @db.Char(64)
  embedding       Unsupported("VECTOR(768)")?
  ingestedAt      DateTime                     @default(now())
  updatedAt       DateTime                     @updatedAt

  @@map("Event")
}
```

## Relationships

This is a single-entity model. There are no foreign key relationships. The Event entity is self-contained.

## Validation Rules

| Rule | Field(s) | Enforcement |
|------|----------|-------------|
| Slug uniqueness | `slug` | Database unique constraint via `@unique` |
| Content hash format | `contentHash` | SHA-256 hex string, exactly 64 characters, enforced by `@db.Char(64)` |
| Date ordering | `startDate`, `endDate` | Application-level: endDate >= startDate (validated during ingestion) |
| CFP date ordering | `cfpOpenDate`, `cfpCloseDate` | Application-level: if both present, cfpCloseDate >= cfpOpenDate |
| Topics format | `topics` | Application-level: comma-separated, whitespace-trimmed during display |
| Query length | (search input) | Application-level: max 500 characters, rejected with typed `query-too-long` error |
| Embedding dimension | `embedding` | Database-level: VECTOR(768) type enforces exactly 768 dimensions |

## State Transitions

### CFP Status State Machine

The CFP status is a derived property computed at render time by `src/lib/cfp-status.ts`. It is not stored in the database. The function takes `cfpOpenDate`, `cfpCloseDate`, and the current date as inputs.

```
                    ┌─────────────────────┐
                    │   cfpOpenDate and    │
                    │   cfpCloseDate both  │──── null ────▶ "unavailable" (zinc-neutral)
                    │   present?           │
                    └─────────┬────────────┘
                              │ at least one present
                              ▼
                    ┌─────────────────────┐
                    │   now < cfpOpenDate? │──── yes ─────▶ "opens-in-N" (sky)
                    └─────────┬────────────┘
                              │ no
                              ▼
                    ┌─────────────────────┐
                    │   now > cfpCloseDate?│──── yes ─────▶ "closed" (zinc-muted)
                    └─────────┬────────────┘
                              │ no (CFP is currently open)
                              ▼
                    ┌─────────────────────┐
                    │   daysRemaining > 14 │──── yes ─────▶ "open" (emerald)
                    └─────────┬────────────┘
                              │ no
                              ▼
                    ┌─────────────────────┐
                    │   daysRemaining > 3  │──── yes ─────▶ "closes-in-N" (amber)
                    └─────────┬────────────┘
                              │ no (1 <= N <= 3)
                              ▼
                        "closes-in-N" (red)
```

**Boundary values**: N=14 renders amber. N=3 renders red. N=0 (deadline is today) renders red. Most-urgent state wins when date ranges overlap.

## Content Hash Computation

The content hash is a SHA-256 digest of the concatenation of semantic fields that affect embedding quality:

```
hash = sha256(name + description + topics + startDate + endDate + locationCity + locationCountry)
```

When the hash matches the stored value, the embedding is not recomputed. This makes re-ingestion idempotent (FR-002) and keeps warm resets fast (SC-003).

## TypedSQL Interfaces

### searchEvents.sql

**Input**: JSON-serialized vector array (string), result limit (number)
**Output**: Rows with event fields plus similarity score (float, 0-1 range)
**Operation**: Casts JSON array to VECTOR(768), computes `VECTOR_DISTANCE('cosine', embedding, cast_vector)`, orders by ascending distance, returns top N with similarity as `1 - distance`

### upsertEvents.sql

**Input**: All Event fields including embedding as VECTOR(768)
**Output**: Affected row count
**Operation**: SQL Server MERGE on slug as the match key. Inserts new events, updates existing events where contentHash differs.
