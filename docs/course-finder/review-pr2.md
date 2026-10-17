# Course finder PR 2: course detail — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 4 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/course-detail` at `3214b3d` over `feat/course-finder` (`dcaa5bd`) · 12 files, +521 −14 · 2026-10-17 |
| Reviewed against | security · performance · security-web · CLAUDE.md · industry DESIGN.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies clean (no dependency change) · code N/A (not installed) |
| Not applicable | security-llm (no prompt changed) |
| Failed to load | none |
| Read outside the diff | 8, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| fdd-architecture | B | MEDIUM · `roads/model/details.ts:8` · roads↔finder cycle | move job market into roads |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices / DESIGN.md | A | — | — |
| Quality | B | MEDIUM · `finder/server/search.ts:64` · switch path untested | one test, on and off |
| Criteria | B | MEDIUM · `roads/model/details.ts:158` · 23 read narrowly | confirm or extend scope |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 22 | Switch off: every course card as today | `roads/model/details.test.ts:249` | covered (data); render manual |
| 23 | Fields one step away, defined, and jobs, on a found card and a board course card | `roads/model/details.test.ts:226`, `finder/model/detail.test.ts:14,27` | partly covered |
| 24 | Sample openings and AUD pay for the city under "Job market (sample data)", no employer or provider | `finder/data/job-market.test.ts:41`, `roads/model/details.test.ts:244` | covered (data); heading manual |

Note: 23 is covered for the road's own course tile only. The found-course half has data (`courseDetail`) but its wiring in `search.ts` has no test, and `CourseDetail` has no consumer until task 13 builds `FinderPanel` (no panel exists on either branch). For 22, the off render is the same text: `Source: {source} ·` defaults to the old words, `markets` is empty and `fieldsNear` is undefined. The SSR HTML gains React's `<!-- -->` text separators, so it is the same on screen but not byte for byte.

## Read outside the diff
- `src/features/roads/index.ts:23` · `layout.tsx:70`: `detailsByTile` has one caller (the board layout), and `cardDetails` has none outside its file (risk 1 settled).
- `src/features/roads/client.ts`: exports `CardDetails` as a type only, so `details.ts` and `job-market.ts` never reach the browser through it (risk 2).
- `src/features/finder/server/search.ts:16`: the only importer of `model/detail.ts`, which is server-only. `FINDER_EXTRAS` stays on the server (risk 2).
- `src/features/engine/index.ts`, `engine/catalogue.ts:1-3`: `CITIES` comes from the 25 KB mock catalogue, which is client-safe by design. The board already ships it through `roads/client` → `road-change` → `candidates.ts:8` / `match.ts:11`, so the import adds no bytes (risk 2).
- `src/features/road/components/CardDetails.tsx:141-155`: the new sections sit after "Occupations it leads to", as the plan says.
- `src/features/finder/components/`: no `FinderPanel`. `CourseDetail` is unused (risk 3, criterion 23).
- grep for cross-feature component imports: only one precedent, `admin/components/AdminChrome.tsx:3` (risk 3).
- grep of the finder tests for `COURSE_DETAIL_ON`: none of them cover `search.ts`.

## Findings, by file

### `src/features/roads/model/details.ts`

**MEDIUM · line 8 · feature dependency cycle**
- What: `roads/model/details.ts` imports `jobMarketFor` from `finder/data/job-market` and `JobMarketRow` from `finder/model/types`, while `finder/model/detail.ts:6` imports `fieldsNear` back from this file. `road/components/CardDetails.tsx:3` and `finder/components/CourseDetail.tsx:1` close the same loop on the UI side.
- Why: until now roads did not depend on finder. Two features that import each other can no longer be removed or switched apart (criterion 41), and the next change in either one ripples into the other.
- Rule: `fdd-architecture` §2 public API boundary and §5 shared infrastructure · a test would have caught it: no, it is structural.
- Fix: the job market is keyed by occupation code, like `OCCUPATIONS`, so move `job-market.ts` and `JobMarketRow` to `roads/data/`. Finder then imports them from roads the way it already imports occupations, and every dependency runs one way: finder → roads/road.

**MEDIUM · line 158 · criterion 23 read narrowly**
- What: only the `course` slot gets `courseDetailFor`. The `alt-course` and `stack-course` tiles are course cards on the board too, and with the switch on they show no fields near and no jobs.
- Why: the criterion says "a course card on the board". The plan narrowed this to the road's own course tile, but the intent is the contract, and story 3 compares exactly those other-course tiles.
- Rule: criteria pass, done differently from the criterion · a test would have caught it: yes, an alt-course case in `details.test.ts`.
- Fix: get Nikhil's reading. If he means every course card, run `courseDetailFor` with each slot's course id and its own city. Otherwise record the narrower reading in the intent.

### `src/features/roads/model/details.test.ts`

**LOW · line 255 · fragile string check**
- What: `expect(today).not.toContain('market')` searches the whole JSON. Any catalogue text with "marketing" in it would fail the test for no real reason.
- Why: the test would break on a content change, not on a regression.
- Rule: quality, tests assert behaviour · a test would have caught it: n/a.
- Fix: assert `Object.values(byTile).every((d) => !('fieldsNear' in d) && !d.occupations?.some((o) => 'market' in o))`.

### `src/features/finder/server/search.ts`

**MEDIUM · line 64 · switch path untested**
- What: the hits get `detail` only when `courseDetailOn(process.env)` is true. No test covers either branch: hits carrying `detail` when on, or no `detail` key when off.
- Why: this is the only path that carries the found-course half of criteria 23 and 24, and its off state is criterion 22 for finder cards.
- Rule: plan task 16 Step 1, test-first · a test would have caught it: yes, the search's database test with the env set and unset.
- Fix: add two cases to the finder search test (the same mocked-repository pattern PR 1 uses): `COURSE_DETAIL_ON=1` gives `hits[0].detail.jobs.length > 0`, and unset gives `'detail' in hits[0] === false`.

### `src/features/finder/model/types.ts`

**MEDIUM · line 80 · repeated shapes, no exported type**
- What: `{ name: string; definition: string }` is written out four times: `types.ts:81`, `details.ts` (the `CardDetails.fieldsNear` type and the `fieldsNear` return type) and the `FieldsNearSection` props. The job shape is written three times: `types.ts:82`, the `details.ts` occupations item and `CardDetails.tsx` `type Job`.
- Why: the shapes are one concept. A change to one copy will not reach the others, and only some copies will fail type-check.
- Rule: severity table, repetition (three or more) and missing type exports · a test would have caught it: no.
- Fix: export `FieldNear` and `CourseJob` once, beside `JobMarketRow` in its new home (see the first finding), and use them in all four places.

**LOW · lines 70, 80 · comments past the wrap**
- What: the doc comments at `types.ts:70` (118 chars) and `:80` (110), and at `CardDetails.tsx:98` (122), run past the files' 100-column wrap.
- Why: the files' style wraps comments, and Biome does not reflow them.
- Rule: LOW, style drift · a test would have caught it: no.
- Fix: wrap them.

### `src/features/finder/components/CourseDetail.tsx`

**LOW · line 1 · deep import of another feature's component**
- What: `CourseDetail` imports `FieldsNearSection` and `JobMarketSection` from `@/features/road/components/CardDetails`, a file `road` does not export.
- Why: this is road's internal file, and only one other feature in the repo does this (`AdminChrome.tsx:3`). Models are deep-imported across features throughout the repo, so the norm here is loose, and once the cycle above is fixed the dependency is one-way.
- Rule: `fdd-architecture` §2 public API boundary · a test would have caught it: no.
- Fix: export the two sections from a client-safe road entry, as `roads/client.ts` does for roads, and import them from there.

### `src/features/finder/model/detail.ts`

**LOW · line 7 · no server-only guard on the 1.5 MB catalogue**
- What: `detail.ts` sits in `model/`, which the repo treats as pure and client-safe, yet it loads all of `FINDER_EXTRAS` (1.5 MB). Its header comment is the only thing that keeps it on the server.
- Why: today only `search.ts` imports it, but one future import from a client card would ship the whole catalogue to the browser.
- Rule: `performance.md` §5, `vercel-react-best-practices` `bundle-conditional` · a test would have caught it: no, the build would.
- Fix: move it to `finder/server/` with `import 'server-only'`, and mock `server-only` in its test as `embed.test.ts` does.

## Top 3 priority fixes
1. `src/features/roads/model/details.ts:8`: move `job-market.ts` and `JobMarketRow` into `roads/data/` to break the roads↔finder cycle.
2. `src/features/finder/server/search.ts:64`: test that hits carry `detail` with the switch on, and no `detail` key with it off.
3. `src/features/roads/model/details.ts:158`: settle with Nikhil whether the other-course and stack-course cards get the detail too.

## Done well
- Criterion 22 is guarded where it counts: an optional third argument whose off path is pinned by comparing `JSON.stringify` of both calls. The `Section` default keeps the old source line word for word.
- The job-market data cannot name an employer: the test pins the row's keys. The labels say sample three times over: the heading, `Source: OfCourse sample data` and the mock tag. No figure comes from a model.
- The UI stays inside the system: text roles (`text-caption`, `text-overline`), semantic colours, the fixed scale for internal spacing, no px or arbitrary values, and a native `<details>`/`<summary>` for the expandable part.

## Built but not asked for
- Nothing. `CourseDetail` is asked for (task 16) and is unused only until task 13.

## Blind spots
- The two new sections on a board card (order, wrapping of "N openings · AUD X–Yk starting · City" at 360 wide) are checked only by smoke steps 2–3. A screenshot at the ten widths is the check.
- `CourseDetail` has never rendered inside a card. Its `<h2>` section titles may sit at the wrong heading level once `FinderPanel` places it. Check this at task 13.

---
Stack: TypeScript, React 19 / Next.js App Router (server layout, client card components), Tailwind 4, Bun test. Passes applied shallowly: none. The bundle-size judgement rests on reading the import graph, not on a build.

## Applied (17 Oct 2026)

Nikhil decided criterion 23 covers every course card on the board, and said "fix all valid". Fixed in `05ec9c2`: every finding (both MEDIUMs on structure, the switch-path tests, criterion 23 on every course tile, and all LOWs), and CourseDetail placed in the Find cards. None judged invalid.
