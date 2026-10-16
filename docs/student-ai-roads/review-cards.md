# Student AI roads, Part C (card details) — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 1 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | HIGH · `details.ts:85` · criterion 33 is built as a different thing: on-board courses are not marked, and an off-board list is labelled "Related to what you picked" |
| Branch | `feat/student-roads-cards` at `0fa77dd` over Part A `1e91c5f` · 9 files, +619 −2 · 15 Oct 2026 |
| Reviewed against | security · performance · security-web · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` · Industry `DESIGN.md` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | `security-llm.md` (no model code) · `vercel-composition-patterns` (not dispatched) |
| Failed to load | none |
| Read outside the diff | 6, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | LOW · `details.ts:117` · related list sent twice | optional |
| vercel-react-best-practices | A | LOW · `details.ts:117` · duplicate serialisation | optional |
| tailwind-v4-best-practices / Industry | A | — | — |
| fdd-architecture | A | LOW · `CardDetails.tsx:2` · road ↔ roads import cycle | follow-up, feature-wide |
| Criteria | C | HIGH · `details.ts:85` · criterion 33 done differently | mark the stack and alternative courses |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 29 | Course card lists majors/units and entry conditions | `details.test.ts:15`, `:24` | covered (see MEDIUM on the label) |
| 30 | Course-years card lists placements and part-time work, employers, demand | `details.test.ts:43`, `:58` | covered |
| 31 | 485 card lists graduate programs and occupations | `details.test.ts:65` | covered |
| 32 | 190/491/191 card says if the occupation is on that state's list | `details.test.ts:75`–`:120` | covered |
| 33 | Stack and alternative courses in related fields are marked "related to what you picked", with a definition | `details.test.ts:124` | done differently |
| 34 | Without branch 3, cards are as stories 1–4 leave them | — | not automatable (true by construction) |
| 1–28, 35–53 | — | — | not in this branch |

Criterion 34: holds by construction. `details` is optional all the way down, and the layout computes it only for matched or nearest roads.

## Read outside the diff
- `src/features/road/components/RoadBoard.tsx:251` — `why` is always defined and its `tileId` is the open card's tile, so `details[why.tileId]` cannot throw and keys the correct card.
- `src/features/roads/model/road-for.ts:15` — `spec` is null for `off` and `illustrative`, so neither Priya's road nor the switch-off road gets details (risk 3).
- `src/features/roads/data/occupations.ts:6` — `CITY_STATE` maps each course's city to its state. A fresh dump of all six roads gives correct WA/SA/VIC/TAS 190 and 491 lines, 186/482 tiles read employer sponsorship, and `melbourne-home` gets nothing (risk 1, holds).
- `src/features/roads/model/match.ts:27` — the field rule can lose to the stay rule, so a nearest road's `spec.field` can differ from her pick (for example Stay "No" + Cyber security lands on the Data road).
- `src/features/roads/data/types.ts:35` — `CourseSubjects.conditions` is an untyped list of strings, not specifically entry conditions.
- `src/features/engine/catalogue.ts:607` — `uow-cyber` exists and is the Geelong road's stack course. The new `subjects.ts` row fills the one gap, and its source is labelled mock (risk 2, holds).

## Findings, by file

### `src/features/roads/model/details.ts`

**HIGH · line 85 · criterion 33 done differently**
- What: `relatedFor` leaves out the road's own courses (`!own.has(c.id)`, line 89) and returns other catalogue courses from any city. Nothing marks the alternative course or the stack's rows, which are the courses criterion 33 names. Examples: on `perth-cyber` the alternative course (IT, Curtin) is in a related field but carries no mark, while its card and the "4 more in Perth" card both list "Master of Information Technology at UniSA" and "…at UTAS". On `hobart-it`, UniSA Cyber Security is a stack row, but the mark appears only in a separate list on the card.
- Why: the intent says the courses she looks at in the stack and the alternative course get the mark. Instead she gets a list of courses from other cities under a card about one city, with no city shown. On a nearest road the list follows `spec.field` (line 86), not her answer, so "Related to what you picked" can be untrue (Stay "No" + Cyber security shows courses related to Data).
- Rule: intent criterion 33 (the plan's C1 reading allows this, but the intent is the contract) · a test would have caught it: yes, a test asserting that `perth-cyber`'s alternative course and its related stack rows are marked.
- Fix: mark the alternative course, and each `stackRows` entry whose field is a neighbour of (or equal to) her answered field, with the field's definition. Take "what you picked" from her answers, not `spec.field`, or reword the label on nearest roads. Drop the off-board list, or give it its own label with each course's city.

**LOW · line 28 · status as an encoded string**
- What: `listStatus` joins its lines with `"; "` and appends `" · mock"`, and the only consumer splits on `"; "` and strips the suffix with a regex (`CardDetails.tsx:100`).
- Why: a string format is the contract between the model and the view, so an occupation name containing "; " would split wrongly (risk 4: works today, fragile).
- Rule: quality (no round-trip through a string) · a test would have caught it: no.
- Fix: return `listStatus: string[]` without the suffix (the section's source line already carries the mock tag), and update the test strings.

**LOW · line 74 · untested branch**
- What: the "is not on the employer-sponsored list" line has no test, and every occupation in the mock data is `employerSponsored: true`.
- Why: a sentence the student may read in future data has never been exercised.
- Rule: quality · a test would have caught it: yes, a fixture with `employerSponsored: false`.
- Fix: one case with a stub occupation, or accept it as unreachable today.

**LOW · line 117 · related list computed and sent twice**
- What: `alt-course` and `more-courses` each run `relatedFor`, so the RSC payload carries the same list twice (about 2–4 KB a board in total).
- Why: the cost grows with the catalogue's courses in neighbouring fields. It is small today, but each one is serialised twice.
- Rule: `vercel-react-best-practices` §server-dedup-props · a test would have caught it: no.
- Fix: settles itself with the HIGH fix. Otherwise send the list once per road.

### `src/features/roads/components/CardDetails.tsx`

**MEDIUM · line 54 · "To get in" over non-entry conditions**
- What: every `conditions` entry is labelled "To get in", but the catalogue's conditions include "A capstone project with an industry partner in the final year" (UTS Data Science) and "Supervised placement hours in the second year" (Swinburne).
- Why: the card makes a false claim about what admission needs, on a screen meant to help her judge a course.
- Rule: criterion 29 ("any entry condition") · a test would have caught it: no, a label.
- Fix: label the line "Conditions", or split the data into entry and course conditions and show only entry ones under "To get in".

**LOW · line 2 · road ↔ roads import cycle**
- What: `roads/components/CardDetails` imports `road/components/MockTag`, and `road/components/RoadCard` imports `roads/components/CardDetails`, both by internal path rather than through `index.ts`.
- Why: the two features depend on each other's internals. This follows Part A's own precedent (`MatchStrip`, `match-line`), so it is not new to this branch.
- Rule: `fdd-architecture` §Public API Boundary (the repo's existing practice is deep imports, which governs here) · a test would have caught it: no.
- Fix: a follow-up for the whole feature: move `MockTag` to `src/shared/components` (it is now used by both features) and export from `roads/index.ts`.

### `src/app/(app)/roadmaps/[id]/layout.tsx`

**LOW · line 39 · naming**
- What: `asks` means "the road is built from her answers" but reads as story 4's Ask, a different feature.
- Why: a reader merging branch B will take it for Ask's switch.
- Rule: quality (names say what things are) · a test would have caught it: no.
- Fix: rename to `fromAnswers`.

## Top 3 priority fixes
1. `details.ts:85` — mark the alternative course and the related stack rows; take "what you picked" from her answer.
2. `CardDetails.tsx:54` — stop calling course conditions entry conditions.
3. `details.ts:28` — return the list status as lines, not a joined string.

## Done well
- `listStatus` follows the tile's own visa (190 list, 491 list for the 491 and the 191, employer sponsorship for the 186 and the 482) in the course's own state. Tests pin WA, SA (mixed on and not on), VIC and the road home.
- The catalogue stays on the server: client components import `CardDetails` only as a type, the layout computes the map, and only matched or nearest roads get it.
- A data-integrity test (`details.test.ts:15`) caught that `uow-cyber` had no subjects, and the branch filled it with a mock-labelled row.

## Built but not asked for
- 186 and 482 employer-sponsorship lines on route tiles. Criterion 32 names only 190, 491 and 191, but the Sydney and Geelong roads' route tiles need it.
- `docs/student-ai-roads/smoke.md` covers all five branches and the build report, but lives only on this droppable branch. If C is dropped, the smoke test goes with it.

## Blind spots
- What the related mark means on a nearest road, where her field differs from the road's: only a test fed her answers (not the spec) would catch it.
- How the card reads at 360 px with up to three sections and a source line each: the developer's smoke test at 360 and 390 wide covers this, and no unit test should.
- Whether the mock occupation lists are plausible: open question 3, Nikhil's read.

---
Stack: TypeScript, React 19 / Next.js App Router (server layout, client components), Tailwind 4, bun:test. Passes applied shallowly: none.

## Fixes applied

Rebased onto Part A's fixes (`feat/student-roads` at `8560813`) first: `CardDetails.tsx` now lives in `src/features/road/components/` beside `MockTag`, the board and the card import the `CardDetails` type from `@/features/roads/client`, the layout imports `detailsByTile` from `@/features/roads` and reads the roadmap through `roadmapRoad`. Part A had already added a `uow-cyber` subjects row, so this branch's duplicate was dropped (Part A's kept). The smoke-doc commit dropped as identical.

| Finding | Fix |
| --- | --- |
| HIGH · `details.ts:85` · criterion 33 done differently | The alternative course's card, the stack's card and each stack row whose course is in a field one step from hers carry "Related to what you picked" with that field's name and definition (`relatedMark`). "What you picked" is her answers (`pickedFields` in `match.ts`: `field`, else `areas`, assumed answers unanswered), the road's field only when she picked none; a course in her own field is not marked. Stack rows in `roads.ts` now name their catalogue course (`courseId`), and `buildRoad` marks them on the server; the layout passes the roadmap's answers to `detailsByTile`. The cross-city list is gone from both the alternative and "more courses" cards. Tests: `match.test.ts` (pickedFields), `details.test.ts` (alternative and stack marked, her field over the road's, areas, the road's field as fallback, own field unmarked, more-courses adds nothing), `build.test.ts` (perth-cyber and hobart-it stack rows, every row's course exists). |
| MEDIUM · `CardDetails.tsx:54` · "To get in" | The line is labelled "Conditions"; the comment says why. |
| LOW · `details.ts:28` · status as an encoded string | `listStatus` is `string[]` without the " · mock" suffix (the section's source line carries the tag); the view maps the lines. Tests updated. |
| LOW · `details.ts:74` · untested branch | The lines are a pure `listLines(occupations, visa, state)`; a stub occupation with `employerSponsored: false` pins "is not on the employer-sponsored list". |
| LOW · `details.ts:117` · related list sent twice | Settled by the HIGH fix: each card carries at most one mark, no list. |
| LOW · `CardDetails.tsx:2` · road ↔ roads import cycle | Settled by the rebase: `CardDetails` and `MockTag` are both in the road feature, and the road feature imports the roads only through `@/features/roads/client` (type only here). |
| LOW · `layout.tsx:39` · naming | `asks` renamed `fromAnswers`. |
