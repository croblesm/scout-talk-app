# Specification Analysis Report

**Feature**: TalkScout (CFP Finder for Dev Conferences)
**Artifacts Analyzed**: `spec.md`, `plan.md`, `tasks.md`, `constitution.md`
**Date**: 2026-05-07

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | **MEDIUM** | tasks.md (B3) | B3 acceptance requires `npx prisma generate` but never mentions `prisma migrate dev` to create the initial migration. C4 (`db:seed`) and E2 (`demo:reset` via `db:reset`) depend on `prisma/migrations/` existing. No task explicitly produces the migration files. | Add migration creation to B3 acceptance: "Initial migration created via `npx prisma migrate dev --name init`; `prisma/migrations/` contains the migration." |
| C2 | Coverage | **MEDIUM** | tasks.md (E2) | E2 (`demo-reset.ts`) acceptance says it "ends with a working app on `localhost:3000`" but does not mention starting `npm run dev`. Plan's Definition of Done says "`npm run demo:reset` **followed by** `npm run dev`" (two commands). The script and the DoD disagree on whether the dev server is auto-started. | Align E2 acceptance with plan DoD. Either the script starts the dev server (and acceptance says so) or the acceptance says "ends with a seeded database ready for `npm run dev`". |
| I1 | Inconsistency | **MEDIUM** | tasks.md | Task numbering skips E1 (Group E jumps from D7 to E2). This suggests a deleted task. If E1 was intentionally removed, the gap is harmless but confusing for traceability. | Renumber E2 to E1, or add a note explaining the gap (e.g., "E1 was folded into E2"). |
| I2 | Inconsistency | **LOW** | plan.md:L214, spec dir | Plan references "see U2 in `analysis.md`" for database error handling rationale. `analysis.md` is not a standard speckit artifact and is not referenced in the spec or tasks. Creates a hidden dependency. | Inline the rationale into plan.md (one sentence) or remove the cross-reference. |
| U1 | Underspec | **MEDIUM** | spec.md (FR-005), tasks.md | FR-005 specifies placeholder cycling "when empty and unfocused" and D4 faithfully implements this. However, neither spec nor tasks define the **submission mechanism**: Does the user press Enter? Click a button? Both? The plan's `actions.ts` shows a `search()` Server Action but no UI trigger is specified. | Add to spec or D4/D6: "User submits query by pressing Enter in the search input. No separate submit button." (or whichever interaction is intended). |
| U2 | Underspec | **LOW** | spec.md, tasks.md | FR-005 says cards show "the first 3 comma-separated items of the `topics` field." No task acceptance verifies this specific truncation rule. D5 says "card renders all fields per plan.md UI Notes" but the 3-topic limit is in the spec, not the plan's UI Notes. | Add explicit acceptance check to D5: "Topics display shows at most 3 items, trimmed." |
| U3 | Underspec | **LOW** | plan.md, tasks.md (D5) | D5 acceptance requires dark mode verification ("toggle macOS system preference; cards and pills must remain legible"), but dark mode is not a functional requirement in spec.md. It is plan-originated scope with no corresponding FR or SC. | Either add a brief FR or non-functional note in spec.md acknowledging dark mode, or remove the dark-mode verification from D5 (cosmetic for demo). |
| A1 | Ambiguity | **LOW** | spec.md:L53 (FR-004) | FR-004 specifies error handling for "embedding service unreachable" but the `query-too-long` error variant (`> 500 chars`) first appears in plan.md/tasks.md, not in spec.md. The spec only says "up to 500 characters" without defining what happens on violation. | Add to FR-004: "Queries exceeding 500 characters MUST return `{ ok: false, error: 'query-too-long' }` without calling the embedding service." (The plan and tasks already implement this; the spec should match.) |
| A2 | Ambiguity | **LOW** | spec.md:L55 (FR-006) | FR-006 uses "N > 14 days remaining" for "CFP open" but does not define what "remaining" means when `cfpOpenDate` is in the past. The intent (days until `cfpCloseDate`) is clear from context and the D3 boundary table resolves it, but the spec phrasing is ambiguous in isolation. | No action required; D3's boundary table is the authoritative reference. Optionally, add one clarifying sentence to FR-006. |

---

## Coverage Summary

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| FR-001 (catalog 80+ entries) | ✅ | C1, C2 | C2 validates >= 80 via Zod |
| FR-002 (repeatable ingest) | ✅ | C1, C2, C3, C4 | Idempotency checked in C4 rerun |
| FR-003 (embeddings, hash-gated) | ✅ | B4, C4 | Content hash in C4 acceptance |
| FR-004 (search + error handling) | ✅ | D2, D4 | 500-char limit + Ollama error |
| FR-005 (UI cards + placeholders) | ✅ | D4, D5, D6 | Placeholder cycling in D4, card fields in D5 |
| FR-006 (CFP pill states) | ✅ | D3, D5 | Full boundary table in D3 |
| FR-007 (empty state) | ✅ | D7 | Three verification cases |
| FR-008 (vocabulary mismatch) | ✅ | C5a, C5b | 2 primary + 3 backup queries |
| FR-009 (reset + embed < 60s) | ✅ | C4, E2 | C4 times embed phase explicitly |
| SC-001 (first search < 3s) | ✅ | D6, G1 | Warm Ollama assumption documented |
| SC-002 (scripted query results) | ✅ | C5a, C5b, G1 | Verified in rehearsal |
| SC-003 (cold reset < 90s) | ✅ | E2, G1 | Cold-stack precondition in G1 |
| SC-004 (8-min demo fit) | ✅ | F2, G1 | Timed sections in F2; stopwatch in G1 |

---

## Constitution Alignment

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ Compliant | All `src/` is `.ts`/`.tsx`. `scripts/wait-for-db.mjs` is `.mjs` but lives outside `src/` (permitted). |
| II. ORM-First | ✅ Compliant | SQL only in `prisma/sql/` (2 files). No T-SQL in `src/`. |
| III. Demo Recordability | ✅ Compliant | `demo:reset`, 8-min budget, rehearsals G1/G2. |
| IV. Local-First + Quotas | ✅ Compliant | Docker 2GB/2CPU, host Ollama, no cloud keys. |
| V. Determinism | ✅ Compliant | Committed fixture, content-hash gating, `queries.md`. |
| VI. Style | ✅ Compliant | Conventional Commits in task prefixes; no em-dashes observed. |
| VII. Spec Kit Order | ✅ Compliant | analyze runs after tasks; phases sequential. |

**No constitution violations detected.**

---

## Unmapped Tasks

All 28 tasks map to at least one requirement, user story, or constitution principle. Infrastructure tasks (A1-A3, B1-B5) support multiple FRs indirectly. Documentation tasks (F1-F3) support SC-004 and Constitution III. No orphaned tasks.

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Functional Requirements | 9 |
| Total Success Criteria | 4 |
| Total Buildable Requirements | 13 |
| Total Tasks | 28 |
| Coverage % | **100%** (13/13 requirements have >= 1 task) |
| Critical Issues | **0** |
| High Issues | **0** |
| Medium Issues | **3** (C1, C2, I1) |
| Low Issues | **5** (I2, U1, U2, U3, A1, A2) |
| Ambiguity Count | 2 |
| Duplication Count | 0 |

---

## Next Actions

**No CRITICAL or HIGH issues found.** The spec-plan-tasks triad is well-aligned and ready for implementation.

**Recommended before implementation (MEDIUM items):**

1. **C1** - Add Prisma migration creation step to task B3 acceptance criteria (prevents a "table does not exist" failure at C4).
2. **C2** - Clarify whether `demo-reset.ts` auto-starts the dev server or stops before it (align E2 with plan DoD).
3. **I1** - Renumber E2 to E1 or annotate the gap for traceability.

**Optional improvements (LOW items):**

- **A1** - Spec FR-004 should explicitly define the `query-too-long` error (plan and tasks already implement it; spec is the gap).
- **U1** - Define the search submission mechanism (Enter key? Button?) in spec or tasks.
- **U2/U3** - Minor acceptance-criteria tightening for topic truncation and dark mode provenance.

All LOW items are safe to defer. You may proceed to implementation after addressing the three MEDIUM findings.
