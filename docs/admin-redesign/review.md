# Admin redesign (round 2) — Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 3 MEDIUM · 8 LOW

| | |
| --- | --- |
| Blocking | HIGH · five standing e2e specs still use retired copy and will fail · HIGH · `e2e/content-roles.e2e.ts:217` refusal check now passes vacuously |
| Branch | `feat/admin-redesign` at `58fe75b` + uncommitted tree over `0e71e54` (main) · 76 files (3 untracked), +3064 −1058 · 2026-10-27 |
| Reviewed against | security · security-web · performance · CLAUDE.md · DESIGN.md (Industry) · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `vercel-composition-patterns (SKILL.md)` · `fdd-architecture (SKILL.md, import rules only)` |
| Scans | secrets clean (commits, working tree, untracked) · dependencies N/A (no manifest or lockfile change) · code clean (semgrep p/owasp-top-ten, 0 results) |
| Not applicable | security-llm.md (no prompts or model calls) |
| Failed to load | none |
| Read outside the diff | 10 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | LOW · `Board.tsx:240` · quadratic hang check | optional |
| CLAUDE.md (tests, e2e) | C | HIGH · `e2e/content-roles.e2e.ts:217` · vacuous refusal | update the five stale specs |
| DESIGN.md / `tailwind-v4-best-practices` | A | LOW · `StageRail.tsx:53` · marks off the rules | optional |
| `fdd-architecture` | B | MEDIUM · `BoardBand.tsx:4` · deep cross-feature import | import through the admin index |
| `vercel-react-best-practices` | A | — | — |
| `vercel-composition-patterns` | A | — | — |
| Quality | B | MEDIUM · `UsersList.tsx:39` · table classes copied three ways | one shared hairline-table module |
| Criteria | A | 0 uncovered; look-only items manual | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1a | One bar: duck, brand, tabs, AI tag, toggle, account | `AdminChrome.test.tsx` (AI tag), smoke 1, 3 | covered / manual layout |
| 1b | Account shows real role, never a capability | `AdminChrome.test.tsx:47` | covered |
| 1c | Shared page header on every screen | manual (verified in diff: every console page) | not automatable |
| 2a | Band counts viewer's own posts in 3 stages | `board.test.ts` "count of the viewer's own posts", `Board.test.tsx` "the band" | covered |
| 2b | Pressing a number sets Mine and lights the column | `Board.test.tsx` "sets Assignee to Mine…" | covered (done differently, see note) |
| 2c | Type switch, filters, Clear filters unchanged | `Board.test.tsx` "the filters" | covered |
| 2d | Numbered columns with subs | `board.test.ts` subs, `Board.test.tsx` numbering | covered |
| 2e | Locked gate tile with its `title` | `Board.test.tsx` first test | covered |
| 2f | Four-line cards, versions count, socials hang, no ↳ | `board.test.ts` versions/parentId, `Board.test.tsx` | covered |
| 2g | Dashed "Not rendered yet" before the gate | manual | not automatable |
| 2h | First run with no posts | `Board.test.tsx` "a board with no posts at all" | covered |
| 2i | Live card: accent border, Live line | manual | not automatable |
| 3a | "Start from" option cards, same behaviour | `SourceForm.test.tsx:270`, `:277` | covered |
| 3b | "What happens next" panel | manual | not automatable |
| 3c | Make post disabled until a source | `SourceForm.test.tsx:142` | covered |
| 4a | Rail shows done, current, upcoming | `StageRail.test.tsx`, `Workbench.test.tsx:319` | covered |
| 4b | Stage, tabs, sticky bar restyled, behaviour unchanged | existing `Workbench.test.tsx` | covered / manual look |
| 4c | Real Checks list restyled | manual | not automatable |
| 5a | Users band, table, filters, two areas | `UsersList.test.tsx` band tests | covered |
| 5b | Role tags, dashed capability tags | `UsersList.test.tsx` "Editor and Reviewer tags" | covered |
| 5c | Type roles, container query, `styles.ts` deleted | verified in diff | not automatable |
| 6a | Last test column | `ModelsScreen.test.tsx` new tests | covered |
| 6b | Band: not tested / n tested / failures | `ModelsScreen.test.tsx` new tests | covered |
| 6c | Results only in page state | `ModelsScreen.test.tsx` "opens the band on Not tested yet" | covered |
| 6d | "Falling back" tag loses `rounded-md` | verified in diff | not automatable |
| 7a | Comic gaps and Insights bands | `InsightsTable.test.tsx` new tests; Insights manual | covered / manual |
| 7b | Hairline tables, no "+" marks, bars | `InsightsTable.test.tsx` bar widths | covered / manual |
| 7c | Updates preview is the student card | existing `UpdatesScreen.test.tsx` preview region | covered |
| 7d | Page styles drop zone uses the existing upload | `PageStyles.test.tsx` new tests | covered |
| 7e | Filled badges and `bg-muted` fills become hairlines | `SourcePane.test.tsx:327`; rest manual | covered / manual |

2b: the press also switches the type tab to All (`BoardBand.tsx:41`). The brief asks only for Assignee = Mine. This is deliberate, tested and arguably needed, because the counts span every tab. It still goes beyond the brief and should be stated in the PR.

## Read outside the diff
- `src/app/admin/(console)/users/page.tsx:14` — the only caller of `getUsers`; it passes the new counts through.
- `src/features/admin/users/server.test.ts:124` — DB test asserts `onlineNow` only; `accounts`/`staff` untested.
- `src/app/admin/(console)/board/page.tsx:19` — the only `boardView` caller; passes the full session user, so the first name reaches the band.
- `grep fromLine|linkedLines` — no caller of the removed fields remains (the hits are the roadmaps' own `fromLine`).
- `src/app/(feed)/feed/page.tsx`, `FeedList.tsx` — `UpdateCard` is the student feed's card. The brief names its lines 29 and 39, so the student-facing change is in scope. Say so in the PR.
- `src/app/globals.css:52-58`, `motion.module.css:20` — `size-icon-xs/md` and `--container-cap` exist; `motion.grid` paints `--panel`.
- `src/features/content/lib/steps.ts:15,29` — Outline is a real step, so the eight "What happens next" steps match the product.
- `src/shared/lib/db/index.ts:8-16` — placeholder URL, lazy client: spreading the real store into mocks opens no connection.
- `src/shared/hooks/useMenuKeys.ts:7-46` — arrows, Home/End, Escape (focus back) and Tab handled for the account menu.
- `grep e2e/` for retired copy — five stale specs (below); `git grep` on main: no feature imported `@/features/admin` before this branch.

## Findings, by file

### `e2e/content-roles.e2e.ts`

**HIGH · line 217 · refusal asserts nothing**
- What: `getByRole('link', { name: '+ New feed post' }).toHaveCount(0)` checks that an admin without the editor capability is refused. The link is now named "New feed post", so this check passes whatever the page shows.
- Why: a role-refusal check that cannot fail gives false confidence. The unit test `Board.test.tsx` "offers no new feed post to an admin without a capability" is now the only guard.
- Rule: CLAUDE.md (standing specs updated when a change alters what they cover) · severity table "a test that asserts nothing" · a test would have caught it: no, it is the test.
- Fix: name the link `'New feed post'` (exact).

**HIGH · line 116 and four other specs · stale e2e**
- What: these specs still target retired UI. `content-roles.e2e.ts:116` clicks "+ New feed post". `user-management.e2e.ts:253` waits for `/^\d+ online now$/`, but the band now reads "N people online". `content-feed-post.e2e.ts:633` uses the region "Live in feed · exported", which is now "Live". `dark-mode/dark-mode.e2e.ts:322` expects an admin "Sign out" button beside the toggle, but Sign out is now a menu item.
- Why: the redesign claims "no behaviour change", and the e2e suite is the evidence for that claim. These specs will fail, and the brief's smoke list does not cover them.
- Rule: CLAUDE.md "standing specs under e2e/ are updated only when a change alters what they cover" · a test would have caught it: yes, `bun run test:e2e` (not run on this branch).
- Fix: update the five locators, as was done for `admin-sign-in` and `content-submission`. Then ask for an e2e run. For dark-mode AC4, open the account menu and assert the `Sign out` menuitem.

### `src/features/content/components/BoardBand.tsx`

**MEDIUM · line 4 · deep cross-feature import**
- What: content, insights and updates now import admin internals: `@/features/admin/components/AdminBand` (here, `InsightsTable.tsx:3`, `InsightsOverview.tsx:3`) and `.../AdminPageHeader` (`UpdatesScreen.tsx:6`). `AdminBand` is not exported from `features/admin/index.ts`.
- Why: before this branch no feature imported admin. It now has four new edges that bypass its public API. Under the skill's rule of three, the band belongs in shared.
- Rule: `fdd-architecture` §API boundary, §Shared (rule of three). The repo already has deep imports elsewhere, so MEDIUM, not HIGH · a test would have caught it: no, a convention.
- Fix: export `AdminBand` (and `BandStat`) from `features/admin/index.ts` and import from `@/features/admin` everywhere. Or move both components to `src/shared/components/`.

### `src/features/admin/components/UsersList.tsx`

**MEDIUM · lines 39-45, 556 · hairline table copied three ways**
- What: `tableWrap/table/th/tr/td` are copied verbatim in `ModelsScreen.tsx:35-40`. `insights/components/classes.ts:9` builds a third version of the same table. The dashed empty box is repeated in `ModelsScreen.tsx:303` and `Board.tsx:232`, and `filterLabel` duplicates `BoardFilters.tsx`'s label.
- Why: three copies of one design element will drift apart at the next restyle.
- Rule: Quality, repetition (three or more) · a test would have caught it: no.
- Fix: put one admin hairline-table and empty-state class module next to `tag` in `src/shared/components/classes.ts` (or in admin) and import it in all three places.

**LOW · line 155 · duplicated initials**
- What: `initials()` here and `initialsOf()` in `AdminAccount.tsx:14` do the same job.
- Why: two helpers for one rule.
- Rule: Quality, duplicated logic · a test would have caught it: no.
- Fix: keep one, exported from admin `lib/`.

### `src/features/admin/users/server.ts`

**MEDIUM · lines 93-94 · new counts untested against the database**
- What: `accounts` and `staff` (`count(*) filter (where role in ('admin','superadmin'))`) are new SQL with no DB test. `server.test.ts:124` asserts only `onlineNow`.
- Why: the brief requires that every number on screen comes from the real data. Right now only the props are tested, not the query.
- Rule: Quality, tests assert behaviour · a test would have caught it: yes, a `DB_TESTS` case.
- Fix: in `server.test.ts:124`, assert `accounts >= 2` and that `staff` counts a seeded admin but not a user, whatever the filters.

### `src/features/content/lib/board.ts`

**LOW · line 341 · a market variant counts as a second post**
- What: `mine` filters `ordered`, which includes the market item, and that item carries its feed post's owner. A post with a Nepal version therefore counts twice in "n of your posts need you".
- Why: the title says posts but counts cards. This matches what the Mine filter shows, but overstates the count.
- Rule: Quality, names say what things are · a test would have caught it: yes, a `boardView` case with a market variant.
- Fix: skip `kind === 'market'` in `mine`, or retitle the count as cards.

### `src/features/content/components/Board.tsx`

**LOW · line 240 · hang check per card in render**
- What: `column.items.slice(0, i).some(...)` runs once for each card, so the cost grows with the square of the cards in a column.
- Why: small today. `boardView` already places each social version right after its parent, so it could compute this once.
- Rule: `performance.md` §2 · a test would have caught it: no.
- Fix: set a `hangs` flag in `boardView`.

**LOW · whole file · grown to 470 lines**
- What: `FirstRun`, `Gate` and `Card` joined the board, doubling the file.
- Why: one file now holds four responsibilities.
- Rule: Quality, one responsibility · a test would have caught it: no.
- Fix: move `FirstRun` and `Card` into their own files.

### `src/features/content/components/StageRail.tsx`

**LOW · lines 53, 58 · marks off the Industry rules**
- What: the rail uses a 1.5px border and a `Check` icon at `strokeWidth={2.5}`. The same patterns appear in `CheckResults.tsx:76,106` and `SourceForm.tsx:669`.
- Why: DESIGN.md says icons are never thicker than 1.5. CLAUDE.md allows px only for 1px hairlines and icon sizes. The student loader (`RoadmapLoader.tsx:61`) set this precedent.
- Rule: DESIGN.md Rules · CLAUDE.md rem-not-px · a test would have caught it: no.
- Fix: use `strokeWidth={1.5}` and `border` or `border-2`, or record the loader's exception in DESIGN.md.

### `src/features/admin/models/components/ModelsScreen.tsx`

**LOW · line 243 · wrong header scope**
- What: the "For the team" / "For students" group heading uses `scope="colgroup"`.
- Why: it heads a row group (`tbody`), so screen readers pair it with the wrong cells.
- Rule: `security-web.md` n/a; accessibility · a test would have caught it: no.
- Fix: `scope="rowgroup"`.

### `src/features/content/lib/workflow.ts`

**LOW · line 140 · comment no longer matches**
- What: the comment still names the board's column "Live in feed · exported".
- Why: that column is now "Live".
- Rule: Quality · a test would have caught it: no.
- Fix: say "Live".

### `src/features/content/components/steps/SourcePane.test.tsx`

**LOW · lines 327-332 · asserts a style class**
- What: the updated test pins `border-border` on the paragraph row.
- Why: by the repo's own rule, tests cover behaviour, not looks. The pattern predates this branch; the branch only re-pinned it.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a.
- Fix: assert the used paragraph by an attribute (e.g. `data-used`), or drop the class checks.

## Top 3 priority fixes
1. `e2e/content-roles.e2e.ts:116,217`, `user-management.e2e.ts:253`, `content-feed-post.e2e.ts:633`, `dark-mode/dark-mode.e2e.ts:322` — move to the new copy and the account menu.
2. `src/features/admin/users/server.test.ts:124` — assert `accounts` and `staff` against the database.
3. `src/features/admin/index.ts` — export `AdminBand`, import both admin components via the index, and share the hairline-table classes.

## Done well
- The band's numbers are pure and tested at both levels: `boardView.mine` ignores the filters, and the waiting count is held back from admins, with a test for each role.
- Models lifts each row's result into screen state and derives the band during render (no effect). Not tested, passed and failed each have a test.
- The new controls stay accessible. The account menu reuses `useMenuKeys`, the option cards keep real radios, the drop zone feeds the existing upload with "Choose files" as the keyboard path, and phone stages use `aria-pressed`. Commit 4110e0d also stops `mock.module` fakes leaking between test files.

## Built but not asked for
- A "Cancel" link back to the board on New feed post (`SourceForm.tsx`).
- The band press also resets the type tab to All (`BoardBand.tsx:41`).
- A count in the Ideas caption ("N suggested ideas (mock)").
- On phones: one stage at a time with stage buttons, and the filters behind a "Filters · n" toggle. Probably from the 390 artboard; not verifiable here.
- Models' "For" column replaced by group heading rows.
- Commit 4110e0d (test-suite leak fixes): outside the brief, but a separate commit with its own purpose.

## Blind spots
- The stale e2e specs: no unit test sees them. A grep of `e2e/` for retired copy, or `bun run test:e2e` when asked, would catch them.
- Look and responsiveness (`@max-7xl` hiding, the stacked board, the phone stage switch, dark mode) can be checked only with screenshots at 390/1024/1440/1920 against the round 2 artboards. Not checked here.
- Lint and type-check were not run (smoke claims them). Recommend `bun run lint && bun run type-check` before the PR.

## Fixes (2026-10-27)
The developer asked for every finding to be fixed; all 13 were judged valid and all are fixed, uncommitted, beside parts 2–4.
- e2e (both HIGH): `content-roles` uses "New feed post" (exact) for the click and the refusal; `user-management` waits for "N people online"; `content-feed-post` uses the "Live" region; dark-mode AC4 checks the toggle sits before the account button, no separate Sign out button, and Sign out as a menu item. Edited, **not run** (e2e runs only on request).
- Cross-feature import: `AdminBand` and `AdminPageHeader` are imported through `@/features/admin` (the index pulls server code only as types).
- Hairline table, empty box and filter label: one set in `src/shared/components/classes.ts`, used by Users, Models, Insights, the board filters and the empty column; `insights/components/classes.ts` deleted.
- `getUsers` counts: a `DB_TESTS` case in `server.test.ts` (accounts +2, staff +1 for a new admin and an editor-and-reviewer user). Written, **not run** (Postgres stopped).
- One `initialsOf` in `src/features/admin/lib/initials.ts`, tested.
- `boardView.mine` skips market variants; `boardView` marks the cards that hang under their post; both tested first.
- `FirstRun` and `Card` moved to `BoardFirstRun.tsx` and `BoardItemCard.tsx`; `Board.tsx` is 288 lines.
- Marks: `strokeWidth={1.5}`, 1px or 2px borders (the current step keeps a 2px ring).
- Models group heading `scope="rowgroup"`; `workflow.ts` comment says "Live"; `SourcePane.test.tsx` asserts `data-used`.

Checked after the fixes: lint clean, type-check clean, `bun run test:run` 0 fail.

---
Stack: TypeScript, React 19, Next.js App Router (server and client components), Tailwind CSS 4 with container queries, Drizzle on Postgres, Bun test with happy-dom and Testing Library, Playwright. Passes applied shallowly: visual fidelity to the round 2 canvas (no artboard access); e2e and type-check not run.
