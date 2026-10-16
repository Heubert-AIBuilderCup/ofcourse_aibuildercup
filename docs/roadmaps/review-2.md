# Roadmaps part 2 (the list, round 2) — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 3 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/app/(app)/road/page.tsx:18` · criterion 42's "never what `/road` opens" has no test, and smoke.md says it does |
| Branch | `feat/roadmaps-list-2` at `b541d39` over `origin/dev` (`80901b0`) · 33 files, +1716 −419 (reference files, bun.lock and snapshots not in the diff) · 2026-10-15 |
| Reviewed against | security · security-web · performance · CLAUDE.md + AGENTS.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing (braces, esbuild) · code clean (semgrep; one parse warning on a reference HTML file, not code) |
| Not applicable | security-llm.md (no model calls) |
| Failed to load | none |
| Read outside the diff | 6, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | B | MEDIUM · `actions.ts:96` · whole list read to count | let the repository say why |
| CLAUDE.md conventions | A | LOW · `ListBar.tsx:17` · states per call | optional |
| fdd-architecture | A | LOW · `board-facts.ts:31` · unused `hereWord` | optional |
| vercel-react-best-practices | A | — | — |
| Quality (tests, a11y) | B | MEDIUM · `RoadmapRow.tsx:64` · chips hidden from readers | describe by the chips |
| Criteria | C | HIGH · `road/page.tsx:18` · uncovered | test the `/road` choice |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 37 | Count of those out of the archive; the new lead | `RoadmapsPage.test.tsx:152`, `:176` | covered |
| 38 | Sort (3 orders); Cards/Table with `aria-pressed`, remembered | `RoadmapsPage.test.tsx:220`, `:256`, `:317`; `useListView.test.ts:18` | covered |
| 39 | Compact rows, glyph, last-opened mark, whole row opens | `RoadmapsPage.test.tsx:160`, the hrefs test; look manual | covered |
| 40 | Table columns, sortable headers with `aria-sort`, mark; phone stacking | `RoadmapsPage.test.tsx:268`, `:296`; phone manual | partly manual |
| 41 | Menus per state | `RoadmapsPage.test.tsx:336`, `:355`, `:365` | covered |
| 42 | Archive, toast, fold, restore; not counted, not copied, not `/road`'s | `RoadmapsPage.test.tsx:394`, `:409`, `:432`, `:605`; `roadmaps.test.ts:220`; `actions.test.ts:393` | `/road` uncovered |
| 43 | Progress and next from the board | `board-facts.test.ts:10` | covered |
| 44 | Sort labelled, buttons, focus back to "…" | `RoadmapsPage.test.tsx:376`, `:394` | covered |

40: smoke step 4 (phone) was not run, so the stacked table has not been seen at 390. 44: the shared Select instead of a native select was left as it is by decision and is not a finding.

## Read outside the diff
- `src/app/(app)/road/page.tsx`, `roadmaps/page.tsx`, `actions.ts` (grep) — `listRoadmaps` has three callers; each one filters archived roadmaps where the intent asks
- `src/features/opening/model/landing.ts:22`, `done/page.tsx:23` — `profile.finished` still counts archived roadmaps, which is right: it only gates landing
- `e2e/routes.e2e.ts:145` — `/road` is checked against a last roadmap, never an archived one
- `src/features/road/model/scene.ts:34` — `sessionFrom(choices, false)` reads her stored choices; the board shows first arrival on its first visit, the list does not (by design)
- `docs/roadmaps/reference/logic/roadmaps-2.js:128,153` — the last-opened mark (a just-made roadmap counts) and `aria-sort` "ascending" both follow the reference
- `src/shared/components/ui/button.tsx:15` — no pressed state in the variants

## Findings, by file

### `src/app/(app)/road/page.tsx`

**HIGH · line 18 · uncovered criterion**
- What: The rule that `/road` never opens an archived roadmap is an inline `find` in a page that has no test. smoke.md's "No need to click" credits it to `server/roadmaps.test.ts`, which never touches `/road`, and smoke step 3 does not check it either.
- Why: Criterion 42 and the binding decision call out `/road` by name, and nothing would catch a regression.
- Rule: uncovered acceptance criterion · a test would have caught it: yes, a pure unit test of the choice
- Fix: Move "the last opened out of the archive" into a pure `lastOpenedOut(roadmaps)` in `features/roadmaps/model/roadmap.ts` and test it there. Use it here and for `lastOpenedId` in `RoadmapsPage.tsx:99`, so the rule lives in one place, and correct the smoke.md line.

### `src/features/roadmaps/actions.ts`

**MEDIUM · lines 96, 122 · whole list read for a refusal message**
- What: Every delete and archive now loads all her roadmaps (up to 200 rows, with their answers and choices JSON) outside the lock, only to count the ones out of the archive. The repository then runs the same guard again in SQL under the lock.
- Why: The cost grows with her roadmap count and payload. The logic is duplicated, and when two requests race, the loser gets "We couldn't find that roadmap" instead of "Keep one roadmap out of the archive."
- Rule: `performance.md` §1 (loads whole records to use one field) · a test would have caught it: no
- Fix: Have `archiveRoadmap` and `softDeleteRoadmap` return why they refused (`'kept-one' | 'not-found' | true`, worked out inside the transaction), and map that to KEEP_ONE, ONLY_ONE or NOT_FOUND here. Then drop the pre-read.

### `src/features/roadmaps/components/RoadmapRow.tsx`

**MEDIUM · line 64 (and `RoadmapTable.tsx:130`) · row content hidden from screen readers**
- What: The row's link takes `aria-label={r.name}`, and the chips, "From onboarding · Opened today" and, in the table, "New" are now inside that link. Only the line and Point B in cards, and only `from` in the table, are reached through `aria-describedby`.
- Why: A screen reader announces the label and skips the link's content, so which answers differ, and when it was opened, are lost. In part 1 the chips sat outside the link.
- Rule: fdd-architecture §Accessibility · a test would have caught it: yes, an accessible-description assertion
- Fix: Give the chips list and the from/opened line ids and add them to `describedBy` in both views (the table's New tag too). Or drop `aria-label` and let the content name the link.

**LOW · lines 48, 149 · a list inside a button**
- What: An archived row's restore `<Button>` wraps `DiffChips`, a `<ul>`. The same happens in the table's name cell.
- Why: A button takes phrasing content only, so this is invalid HTML and the list's semantics are dropped.
- Rule: HTML content model (button holds phrasing content) · a test would have caught it: no
- Fix: Render the chips as spans inside the restore button, or place them outside `RowOpen` when the row is archived.

### `src/features/roadmaps/components/RoadmapTable.tsx`

**LOW · line 42 · `aria-sort` direction**
- What: "Last opened" says `ascending` while it lists the most recent first, which is descending by date.
- Why: A screen reader states the wrong direction. The reference does the same thing.
- Rule: WAI-ARIA `aria-sort` · a test would have caught it: no, `RoadmapsPage.test.tsx:296` pins the current value
- Fix: Use `descending` for `opened`, and update the test.

### `src/features/roadmaps/components/ListBar.tsx`

**LOW · line 17 · pressed and hover states per call**
- What: The view switch's pressed look (`aria-pressed:bg-brand …`) and the hover overrides on the table headers and the restore row (`hover:bg-transparent`, `RoadmapTable.tsx:48`, `RoadmapRow.tsx:52`) are class strings at each call site.
- Why: The project's rule is that Button owns its states, so one change reaches every button.
- Rule: shared components own behaviour (CLAUDE.md shared Button; the team's standing rule) · a test would have caught it: no
- Fix: If a pressed square comes up a second time, make it a Button variant. Optional here.

### `src/features/road/model/board-facts.ts`

**LOW · line 31 · unused output**
- What: `hereWord` is computed, typed and tested, but nothing reads it.
- Why: It is speculative surface. The plan named it, but no criterion uses it.
- Rule: fdd-architecture §YAGNI · a test would have caught it: no
- Fix: Drop it until a screen shows it, or keep it as the plan's and accept this.

### `src/features/roadmaps/model/roadmap.test.ts`

**MEDIUM · line 36 · test bloat**
- What: The test asserts that the `SORTS` constant equals the same literal. The Sort tests in `RoadmapsPage.test.tsx:220` already choose each label on screen.
- Why: It pins data, not behaviour, and repeats coverage that already exists.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a
- Fix: Delete the test.

### `src/features/roadmaps/server/roadmaps.test.ts`

**LOW · line 264 · test order dependence**
- What: "two archives sent at once" uses user `g`, takes `[kept]` from an earlier test's state, and needs exactly one roadmap out of the archive before it starts.
- Why: Run alone, or after an earlier test changes, it fails or passes for the wrong reason.
- Rule: quality, isolated tests · a test would have caught it: n/a
- Fix: Give it its own user (`k`) and make both roadmaps inside it.

## Top 3 priority fixes
1. `road/page.tsx:18` — a pure `lastOpenedOut` with a unit test, shared with `RoadmapsPage.tsx:99`; correct smoke.md.
2. `RoadmapRow.tsx:64`, `RoadmapTable.tsx:130` — describe each row by its chips and from/opened line.
3. `actions.ts:96,122` — the repository returns the refusal reason; drop the pre-read.

## Done well
- The archive guard reuses delete's lock (`lockHers`) and a shared `anotherOut`, scoped by `userId` on every query. It is pinned by database tests for another student's id, a deleted row, the last one out, two concurrent archives, and delete beside archived roadmaps.
- `useListView` uses `useSyncExternalStore` with a server snapshot, so there is no effect and no hydration mismatch. A stored value is validated before use, and refused storage is tested by making the `localStorage` getter itself throw.
- The table is real markup: a caption, `th scope="col"` and `scope="row"`, header buttons, and a phone stacking that is only CSS (`attr(data-k)`) behind the page's own container query.

## Built but not asked for
- `hereWord` in `boardFacts` (the plan named it; no criterion or screen uses it).

## Blind spots
- Phone stacking of the table (criterion 40) has not been looked at yet; smoke step 4 is still to run.
- Screen-reader output of a row: only a description assertion (`toHaveAccessibleDescription`) would catch the hidden chips.
- The page's `next` fallback ("Pick a course in …", `roadmaps/page.tsx`) is untested, and with the current fixture no roadmap reaches it.

---
Stack: TypeScript, Next.js (App Router, server actions), React 19 client components, Drizzle on Postgres, Tailwind 4 with CSS modules, bun test with happy-dom. Passes applied shallowly: none; the look at each width was not judged (no screenshots were in scope).

## Outcome (15 Oct 2026)
Fixed in `50c7cee` (`fix(roadmaps): the review's findings on the list`): `lastOpenedOut` in the model decides what `/road` opens and which row the list marks (tested); archive and delete decide their refusal inside the transaction and the actions no longer read the whole list; a row's chips, from/opened line and the table's New tag reach its link through `aria-describedby`; the `SORTS` literal test is gone; no list inside the restore button; "Last opened" sorts `descending`; `hereWord` dropped; the two-archives test owns its data. Left, deliberately: the view switch's pressed and hover classes at their one call site (a variant when a second use comes). Note: a refused delete reads `hasArchived` outside the transaction to pick its message, so a race could show the other of the two messages (harmless).
Verified: `bun run test:run` 976 pass, 0 fail; database tests 16 pass; type-check and lint clean.
