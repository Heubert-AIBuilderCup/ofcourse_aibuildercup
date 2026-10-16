# Student AI roads, Part E (posts on the board, the way into the feed): Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 1 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | HIGH · `profile-from-answers.ts:14` · a "Not sure" answer preselects Nepal and Australia (criteria 50, 51) |
| Branch | `feat/student-roads-posts` at `f58fe2c` over `1e91c5f` (Part A tip) · 16 files, +760 −17 · 2026-10-15 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | security-llm.md (no model code) · tailwind-v4-best-practices (markup copies sibling section) · vercel-composition-patterns (not dispatched) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | B | MEDIUM · `server/tile-posts.ts:42` · live updates filtered in code | query live updates only |
| CLAUDE.md | A | — | — |
| vercel-react-best-practices | A | LOW · `layout.tsx:39` · sequential reads | optional |
| fdd-architecture | A | — | — |
| Criteria | C | HIGH · `profile-from-answers.ts:14` · assumed answers count | count stated answers only |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 44 | Course comics in "Posts and updates", up to 3 | `roads/model/tile-posts.test.ts:33` | covered |
| 45 | Institution updates, country empty or hers | `roads/model/tile-posts.test.ts:57`, `:70`; `roads/server/tile-posts.test.ts:70` | covered |
| 46 | Australia tile gets destination:AU posts | `roads/model/tile-posts.test.ts:98` | covered |
| 47 | Nothing linked, no section; city tiles none | `roads/model/tile-posts.test.ts:133` | covered |
| 48 | Without branch 5, cards unchanged | — | not automatable |
| 49 | "Feed" beside "Your roadmaps", opens /feed | `opening/components/AccountMenu.test.tsx:79` | covered |
| 50 | `where` Nepal/India preselects home chip, else not | `content/lib/profile-from-answers.test.ts:8`; `content/server/student-profile.test.ts:54` (DB) | contradicted for "Not sure" |
| 51 | Destination chip from her answer | `content/lib/profile-from-answers.test.ts:18`; `content/server/student-profile.test.ts:54` (DB) | contradicted for "Not sure" |
| 52 | Any filter key in URL, nothing preselected | `content/lib/profile-contract.test.ts` (existing, file untouched) | covered elsewhere |
| 53 | Nothing preselected for age | `content/lib/profile-from-answers.test.ts:24` | covered |

The section's on-screen half of 44–47 (the heading, the why lines, "See all in the feed", 360 px) is proven only by smoke step 12; 48 holds by construction (the layout passes `tilePosts` only for a matched or nearest road). The DB cases of `student-profile.test.ts` were not run in this review; they are on the `test:db` path (`src/features/content/server`).

## Read outside the diff
- `src/features/roadmaps/server/roadmaps.ts:115-160`: `listRoadmaps`/`getDraft` filter on `userId` and `deletedAt IS NULL`; order is `coalesce(last_opened_at, created_at) desc` (no NULLS-first trap); archived rows are included.
- `src/features/updates/server/updates.ts:43`: `listUpdates` returns the 50 most recently updated rows of every status (see MEDIUM).
- `src/features/updates/lib/update.ts:10`: statuses are `draft`, `in_review`, `live` only, so `status === 'live'` is the whole gate.
- `src/features/updates/lib/audience.ts:14` and `updates/students.json`: institutions are the engine's university short names, `homeCountry` is a country name ("Nepal"), the same form as `where`.
- `src/features/engine/catalogue.ts:332` and `roads/data/courses.ts:163`: road course ids share the engine's id space, so `FeedPost.courseId` matches.
- `src/features/content/lib/feed.ts:20-43`: `courseId` is non-null only on comics; the tag is `destination:AU`.
- `src/shared/lib/auth/gate.ts:1-5`: `FEED_PATH` comes from a client-safe module, already imported by client components.
- `src/app/(feed)/feed/page.tsx:28` (and `[id]`, `blog/[id]`): `loadStudentProfile(session.user.id)`, the id taken from the session.
- `src/features/opening/model/questions.ts:57-75,179-197`: `where` and `dest` offer "Not sure", which stores `where: 'Nepal'` and `dest: 'Australia'` with `state: 'assumed'`.

## Findings, by file

### `src/features/content/lib/profile-from-answers.ts`

**HIGH · line 14 · "Not sure" counts as her answer**
- What: `profileFromAnswers` reads `answers.where?.value` and `answers.dest?.value` and ignores `state`. "Not sure" on either question stores the assumed defaults `Nepal` and `Australia` (`questions.ts:181,197`), so a student who never said where she is from opens `/feed` with the Nepal chip and Australia preselected.
- Why: criterion 50 says any answer other than Nepal or India preselects nothing, and 51 takes the chip from her destination answer. An assumed default is not her answer. The same assumed `where` reaches `layout.tsx:38`, so updates aimed at Nepal students show on her tiles too.
- Rule: criteria 50, 51 · a test would have caught it: yes, a case with `{ value: 'Nepal', state: 'assumed' }`. Every test uses `stated`.
- Fix: count only `state === 'stated'` in `profileFromAnswers` and in the layout's `where`, and add the assumed case to `profile-from-answers.test.ts`. If Nikhil decides assumed answers should count (smoke.md "Needs a decision" 1, raised there for matching only), update the criterion instead.

**LOW · line 18 · loads every roadmap to read one**
- What: `loadStudentProfile` (`server/student-profile.ts:18`) calls `listRoadmaps`, which returns up to `LIST_MAX` full roadmaps (answers, choices, own words, archived ones included) for every feed page view, and uses only the first row's answers.
- Why: performance §1, a read that loads whole records to use one field. It is bounded by her roadmap count, so the cost is small.
- Rule: `performance.md` §1 · a test would have caught it: no.
- Fix: optional. Use a one-row query with the same order, and settle smoke.md decision 7 (archived) in the same query.

### `src/features/roads/server/tile-posts.ts`

**MEDIUM · line 42 · live updates taken from the admin list**
- What: `listUpdates()` returns the 50 most recently updated `admin_update` rows of every status, and the loader keeps the live ones in code (`liveUpdate`, line 22).
- Why: once more than 50 drafts or in-review rows have been edited since a live update, that update silently disappears from every board. Each board render also pulls admin drafts into the student path; they are dropped before serialisation, so nothing leaks. The cost grows with the admin's working set, not with live content.
- Rule: `performance.md` §1 (a filter the store could do first) · a test would have caught it: no, the fakes return every row with no limit.
- Fix: add `listLiveUpdates()` to `updates/server/updates.ts` with `where(eq(adminUpdate.status, 'live'))`, like `latestLiveUpdate` beside it, selecting only institution, title, body and audience. Keep the status check in the model as the second gate.

### `src/app/(app)/roadmaps/[id]/layout.tsx`

**LOW · line 39 · two reads awaited after the roadmap**
- What: `loadTilePosts` starts only after `getRoadmap` resolves. `listLive` and `listUpdates` do not depend on the roadmap; only the filter that follows them does.
- Why: every board render adds one sequential round trip, including `listLive`'s joins, on the path that paints the board.
- Rule: `vercel-react-best-practices` `async-parallel` · a test would have caught it: no.
- Fix: optional. Start the two reads beside `getRoadmap` and filter once `result.kind` is known; they are wasted only when the switch is off.

### `src/features/roads/components/TilePosts.tsx`

**LOW · line 17 · update key is its title**
- What: the key is `${kind}:${href ?? title}`, and updates have `href: null` because `LiveUpdate` (`model/tile-posts.ts:12`) drops the row's `id`. Two live updates from one institution with the same title share a key.
- Why: React warns, and on a re-render it may reuse the wrong row.
- Rule: React list keys · a test would have caught it: yes, a component test with two same-titled updates. It is not worth adding; carrying the id fixes it.
- Fix: carry `id` through `LiveUpdate` and `TilePost`, and key on `${kind}:${id}`.

### `src/features/roads/server/tile-posts.test.ts`

**LOW · line 75 · fixtures use market ids as countries**
- What: the updates' `homeCountry` and the `where` passed in are `'NP'`/`'IN'`. In real data both are country names ("Nepal"), as `model/tile-posts.test.ts:70` has them.
- Why: the test passes, but it documents the wrong contract for the next reader.
- Rule: quality, names that say what things are · a test would have caught it: n/a.
- Fix: use `'Nepal'` and `'India'`.

## Top 3 priority fixes
1. `src/features/content/lib/profile-from-answers.ts:14`: count only `stated` answers (and the layout's `where`), with a test.
2. `src/features/roads/server/tile-posts.ts:42`: read live updates with a `status = 'live'` query, not the admin's 50-row list.
3. `src/features/roads/components/TilePosts.tsx:17`: carry the update id and key on it.

## Done well
- The loader takes its reads as an injected `sources` argument rather than module mocks, and a failure of either read logs and returns `{}`, so a failing feed never breaks the board. Both failure paths are tested.
- Update rows are mapped field by field into `LiveUpdate`, with the status checked in both the loader and the model. The client receives only title, body and why for an update, and a relative `/feed/<id>` for a post.
- `loadStudentProfile` reuses the session-scoped, deletion-aware roadmap reads and leaves `profile-contract.ts` (the Clear rule) untouched. A DB test proves another student's roadmaps never count, and the AccountMenu tests follow the new item through order and arrow keys.

## Built but not asked for
- Nothing in code. `docs/student-ai-roads/smoke.md` carries the cross-branch smoke test and build report.

## Blind spots
- The section on screen (heading, why lines, "See all in the feed", 360 px) is checked only by smoke step 12. That is right per CLAUDE.md, but a wrong `tileId` mapping in `RoadBoard` (`posts = tilePosts?.[why.tileId]`) would show only there.
- No test joins the admin form's real values (institution short names, country names) with the roads catalogue. It was verified by reading; a model test that uses `INSTITUTIONS` and `HOME_COUNTRIES` would pin it.
- The DB cases were not run here; run `DB_TESTS=1 DATABASE_URL=… bun test src/features/content/server/student-profile.test.ts` before merging.

---
Stack: TypeScript, Next.js App Router (server layout, client components), React 19, Drizzle on Postgres, bun:test with happy-dom. Passes applied shallowly: none. Cross-feature deep imports (`@/features/content/server/store`, `@/features/roadmaps/server/roadmaps`) were not raised against fdd-architecture §2, because the repo imports server modules this way throughout, the existing layout included.

## Fixes applied

Rebased first onto Part A's fixed tip (`feat/student-roads` at `8560813`): the smoke-doc commit dropped as already applied; `TilePosts.tsx` moved to `src/features/road/components` beside the other board pieces; the board's client components take the `TilePost` type from the client-safe `src/features/roads/client.ts` (a type export only, so `client.test.ts` still holds); the layout reads the roadmap and its road through Part A's `roadmapRoad`.

| Finding | What was done |
| --- | --- |
| HIGH · `profile-from-answers.ts:14` · "Not sure" counts as her answer | Fixed in `1488940`. Only a `stated` `where` or `dest` counts: an assumed one gives `homeMarket` null and no destination, the rule Part A uses for matching. Test: `profile-from-answers.test.ts`, the assumed case. The layout's `where` is fixed in `da19cf1`: `herCountry` (`roads/model/tile-posts.ts`) gives null for an assumed `where`, so an update aimed at one country is hidden as when she has not answered. Tests: `roads/model/tile-posts.test.ts`, `herCountry`. |
| LOW · `student-profile.ts:18` · loads every roadmap to read one | Fixed in `a3590df`. `lastOpenedAnswers` (`roadmaps/server/roadmaps.ts`) reads one row's answers in `listRoadmaps`' order (the order is now one shared constant). Archived roadmaps still count: smoke.md decision 7 stays open. The DB cases of `student-profile.test.ts` pass (4). |
| MEDIUM · `tile-posts.ts:42` · live updates taken from the admin list | Fixed in `da19cf1`. `listLiveUpdates` (`updates/server/updates.ts`) reads `status = 'live'` only, at most 50, with only id, status, institution, title, body and audience; the loader keeps the status check as the second gate. A DB case in `updates/server/updates.test.ts` pins it; it was not run here (only `student-profile.test.ts` was run against the database). |
| LOW · `layout.tsx:39` · two reads awaited after the roadmap | Fixed in `da19cf1`. `readTileFeed` reads nothing of her roadmap, so the layout starts it in the same `Promise.all` as the profile and `roadmapRoad`, unless the roads are switched off; the tiles are then filled by the pure `tilePosts`. |
| LOW · `TilePosts.tsx:17` · update key is its title | Fixed in `da19cf1`. `LiveUpdate` and `TilePost` carry the row's id; the key is `${kind}:${id}`. |
| LOW · `tile-posts.test.ts:75` · fixtures use market ids as countries | Fixed in `da19cf1`. The fixtures use `'Nepal'` and `'India'`; the loader's test now pins that it keeps live updates whatever country they are for (the country filter is the model's, tested there). |

Checks after the fixes: `bun run test:run` 3113 pass, 505 skip, 0 fail; `DB_TESTS=1 … bun test src/features/content/server/student-profile.test.ts` 4 pass; `bun run lint`, `bun run type-check` and `bun run build` clean.
