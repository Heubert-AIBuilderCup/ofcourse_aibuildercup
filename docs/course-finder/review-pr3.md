# Course finder PR 3, what changes — Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 7 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | HIGH · `compare.ts:51` · career row has no sample pay (criterion 26) |
| | HIGH · `finder/actions.ts:132` · Compare refuses the 26 courses whose id is over 64 characters (criterion 27) |
| Branch | `feat/course-compare` at `69cf4f5` over `feat/course-detail` (`e2b1498`) · 42 files, +1502 −114 · 17 Oct 2026 |
| Reviewed against | security · performance · security-web · CLAUDE.md · industry `DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies clean (no dependency change) · code N/A (not installed) |
| Not applicable | `security-llm.md` (no prompt or tool change) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `roadmaps/actions.ts:239` · pin bypasses compare switch | gate pin on `compareOn` |
| Performance | A | LOW · `feed-updates.ts:8` · catalogue loaded on feed | optional |
| fdd-architecture | B | MEDIUM · `CardDetails.tsx:4` · road and finder import each other | move WhatChanges out of finder |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | — | — |
| CLAUDE.md, DESIGN.md | B | MEDIUM · `FinderPanel.tsx:82` · compare flow untested | add FinderPanel compare tests |
| Criteria | C | HIGH · `compare.ts:51` · no sample pay | add pay; raise id cap |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 25 | Switch off: tiles as today | `finder/actions.test.ts:384` | covered (action); tiles manual |
| 26 | Board comparison: money, time, PR, career, subjects, city | `finder/model/compare.test.ts:33`, `:168` | partial: no sample pay |
| 27 | "Compare with my roadmap" on a found course | `finder/actions.test.ts:340` | covered; fails for 26 courses |
| 28 | PR route and work rights equal the road's | `finder/model/compare.test.ts:154` | covered |
| 29 | Start a new roadmap with the course pinned, source unchanged | `roadmaps/actions.test.ts:649`, `RoadBoard.test.tsx:1406`, `roads/model/road-for.test.ts:98` | covered |
| 30 | Pinned course never offered by matching | `finder/model/road-courses.test.ts:70` | covered |

Criterion 28 is tested for a found course only. Nothing checks that `alternativeForCity` picks the road the other-city tile leads to. Criterion 29's "source unchanged" against the database is in `roadmaps/server/roadmaps.test.ts:196`. That file is not in `test:db`, and smoke-pr3 says it hangs, so that half has not been run.

## Read outside the diff
- `src/features/roadmaps/server/roadmaps.ts:397` — `createRoadmap` writes `choices` only from its argument. A grep finds no other write to `roadmap.choices`, so the pin survives every write path.
- `src/features/road/model/match-line.ts:42` — `'pinned'` gives no match line. The layout's `built` and `rematch` are the only other readers of `kind`. Both handle it.
- `src/features/roads/client.ts` — the browser reads road keys only. No `'use client'` module resolves a course or imports `road-courses`. `server-only` and the empty default keep the catalogue out of the bundle.
- `src/features/finder/actions.ts:31` — `idSchema` caps ids at 64. A catalogue scan found 26 of 479 finder ids are longer, up to 74.
- `src/features/roads/data/types.ts:39` — `JobMarketRow` has `payLowK` and `payHighK`, so the pay the career row leaves out is available.
- `package.json:16` — `test:db` runs no `src/features/roadmaps/server` test.
- `src/features/roads/data/roads.ts:209`, `model/build.ts:121` — `gains` and `costs` are passed through as optional. A scan of the 29 road courses found none with an empty side, so their trade-off text is unchanged.
- `src/features/roads/model/conditions.ts:56`, `model/build.ts:128` — nothing reads `Entry.sample`.
- `src/features/finder/components/FinderPanel.test.tsx` — it has no compare test.
- `src/features/finder/components/CourseDetail.tsx:1` — imports `@/features/road/client`, so finder and road depend on each other.

## Findings, by file

### `src/features/finder/model/compare.ts`

**HIGH · line 51 · criterion 26, career row**
- What: the career row shows each job with its openings but no pay. Criterion 26 asks for "the jobs, with sample pay and openings for that city". `jobMarketFor` already returns `payLowK` and `payHighK`.
- Why: an acceptance criterion is only half met. The plan's task 18 dropped pay, but the intent is the contract.
- Rule: intent criterion 26 · a test would have caught it: yes, the career test at `compare.test.ts:86` pins the text without pay.
- Fix: add the range to the line, for example `ICT Security Specialist · AUD 85–110k · 310 openings in Perth (sample)`, and update the test.

### `src/features/finder/actions.ts`

**HIGH · line 132 · course id cap**
- What: `compareCourseAction` parses `courseId` with `idSchema` (max 64). 26 finder course ids run 65–74 characters, so "Compare with my roadmap" on those cards says "Not found".
- Why: criterion 27 fails for about 5% of the courses the finder can return.
- Rule: intent criterion 27 · a test would have caught it: yes, one that compares the longest catalogue id.
- Fix: give course ids their own schema with max 80, matching `pinSchema` and `pinId`. The same 64 cap at `:101` refuses those courses' "why" too. That one comes from PR 1.

### `src/features/roadmaps/actions.ts`

**MEDIUM · line 239 · pin not behind the compare switch**
- What: `createRoadmapAction` accepts and stores a pin whatever `COMPARE_ON` says. `/roadmaps/new?from=…&pin=…` (`new/page.tsx:63`) also draws a pinned draft with the switch off.
- Why: the switch is the way to turn this part off in production. With it off, a pinned roadmap can still be made by URL or by calling the action directly.
- Rule: `security.md` §8 (a path that bypasses a switch) · intent "Each part has its own switch" · a test would have caught it: yes, a refusal with `COMPARE_ON` unset, beside `roadmaps/actions.test.ts:680`.
- Fix: refuse a new pin when `compareOn(process.env)` is false, in the action and in `pinFor`. Existing pinned roadmaps keep drawing their pin.

**MEDIUM · line 239 (with `new/page.tsx:63`) · a stale pin blocks copying**
- What: without `?pin=`, the draft takes `source.choices.pinned` unchecked. If the pinned course has left the catalogue (a rebuild re-slugs or drops near-duplicates), the board falls back to the matched road. Create then sends the stale pin, and `pinOf` refuses it with "Not found".
- Why: once the catalogue is regenerated, that roadmap can never be copied, and the error does not say why.
- Rule: `security.md` §6 (stored data is checked on arrival) · a test would have caught it: yes, a copy of a roadmap whose stored pin is unknown.
- Fix: in the page, keep the source's pin only if `pinFor(source.choices.pinned.courseId)` resolves. Otherwise draft unpinned.

**LOW · line 217 · duplicated pin check**
- What: `pinOf` here and `pinFor` in `new/page.tsx:17` both test known, pinnable and own city.
- Why: the two rules can drift, and the page's copy has no test.
- Rule: Quality, duplicated logic · a test would have caught it: no.
- Fix: export one `pinOf(courseId, cityId?)` from `finder/model/compare.ts` and use it in both places.

### `src/features/finder/components/FinderPanel.tsx`

**MEDIUM · line 82 · compare flow has no test**
- What: the compare flow has behaviour that no test pins:
  - an earlier answer is dropped through `latest`;
  - a thrown action becomes "Couldn't compare right now";
  - Back to results restores the results;
  - with no `compare` prop the button is hidden (criterion 25 in the finder).
- Why: CLAUDE.md asks for test-first unit tests on components with behaviour. `FinderPanel.test.tsx` exists and covers none of this.
- Rule: CLAUDE.md "Test the brain" · a test would have caught it: n/a, the test is what is missing.
- Fix: add cases to `FinderPanel.test.tsx` for the hidden button, the stale answer, the error and Back to results. Compare strings and counts, never elements.

**LOW · line 109 · focus and live region**
- What: Compare and Back to results swap the whole panel, so focus falls to the body. The `role="status"` region at `:258` is mounted together with "Comparing…", so screen readers may not announce it.
- Why: keyboard and screen-reader users lose their place.
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, `document.activeElement` after the swap.
- Fix: focus the PanelHead title on entering, and the pressed card's button on Back. Keep the status region mounted in both views.

### `src/features/roadmaps/server/roadmaps.ts`

**MEDIUM · line 349 · the pin-keeping merge is never run**
- What: the `jsonb ||` merge that keeps the pin through board saves is tested only in `roadmaps.test.ts:196`. `test:db` does not run that file, and smoke-pr3 says it hangs locally. The "31 pass" claim covers the finder's database tests, not this one.
- Why: a regression in this SQL would silently unpin roadmaps, and nothing that runs would catch it.
- Rule: Quality (tests assert behaviour) · a test would have caught it: the test exists but never runs.
- Fix: find out why the file hangs, then add `src/features/roadmaps/server` to `test:db`. At least run it once against the temporary container before merging.

### `src/features/roads/server/why.ts`

**MEDIUM · line 39 · why on a pinned road**
- What: on a pinned roadmap, the "why" for a tile is written from `match`, the road her answers matched. It can name another city's rules ("Perth: where the person you know lives") for a Sydney course she pinned herself.
- Why: the student is shown a wrong explanation of why a tile is on her road. Smoke-pr3 lists this as open, decision 2.
- Rule: intent constraint "Rules decide, the model explains" (ADR-087) · a test would have caught it: yes, `why.test.ts`'s pinned case could assert that the facts carry no differences that belong to another road.
- Fix: for `kind === 'pinned'`, pass a "you chose this course" fact and leave out the match's differences. Or set `whyEnabled` to false for pinned roads until Nikhil decides.

### `src/features/finder/components/WhatChanges.tsx`

**MEDIUM · line 28 · figures without a sample label**
- What: the money row shows fees and living costs, which for a finder course are generated, with no "sample" or "mock" label. Only career openings say "(sample)". Every `CardDetails` `Section` ends in "Source: … · mock".
- Why: DS-R5 requires every generated figure to be labelled. In the finder's Compare view, the cards that carried "sample data" are gone.
- Rule: intent constraint DS-R5 · a test would have caught it: no, a convention.
- Fix: end the section with the same Source line and `MockTag` that `Section` uses, or a "sample data" tag.

### `src/features/road/components/CardDetails.tsx`

**MEDIUM · line 4 · road and finder import each other**
- What: `road` now imports `finder/components/WhatChanges`, while `finder/CourseDetail` imports `road/client` and `FinderPanel` imports `road/components/PanelHead`. The comment here works around the cycle this creates through `finder/client`.
- Why: the two features now depend on each other. Deep imports are common in this repo, so this is not HIGH, but the next change is likely to close a runtime cycle.
- Rule: `fdd-architecture` §2 public API boundary · a test would have caught it: no.
- Fix: `WhatChanges` takes only rows and strings, so move it to `road/components` (or `shared/components`) and have the finder import it through `road/client`.

### `src/features/roads/data/entry.ts`

**LOW · line 14 · `sample` flag never read**
- What: `Entry.sample` is set for finder courses, but `conditions.ts` and `build.ts` read only `ielts`. The badge shows "IELTS 6.5" as plainly as a road course's figure.
- Why: smoke-pr3 step 4 says the badge "reads a sample IELTS". The value is the sample one, but nothing labels it.
- Rule: `fdd-architecture` YAGNI · DS-R5 · a test would have caught it: no.
- Fix: label the badge and condition when `sample` is set, or remove the field.

### `src/features/updates/server/feed-updates.ts`

**LOW · line 8 · catalogue on every feed load**
- What: the side-effect import parses the 1.4 MiB catalogue on the feed and roadmaps-list routes, whatever the switches and even when no roadmap is pinned.
- Why: it adds to cold starts, which are already over 2 s (overnight.md item 7). The cost grows with catalogue size.
- Rule: `performance.md` §5 · a test would have caught it: no.
- Fix: acceptable for now. Later, load the fallback lazily on the first `f-` lookup.

### `docs/course-finder/overnight.md`

**LOW · line 12 · stale run report**
- What: it says PR 3 stopped at task 17 with three decisions waiting. This branch resolves those decisions and finishes tasks 18–20.
- Why: a reader of the PR gets the wrong state.
- Rule: a comment that no longer matches · a test would have caught it: no.
- Fix: update the PR 3 row and items 11–13, or leave the file out of the PR.

## Top 3 priority fixes
1. `src/features/finder/model/compare.ts:51` — add the sample pay range to the career row (criterion 26).
2. `src/features/finder/actions.ts:132` — give course ids an 80-character schema, so all 479 courses can be compared.
3. `src/features/roadmaps/actions.ts:239` — refuse a new pin with `COMPARE_ON` off, and drop a stale stored pin in the draft.

## Done well
- The catalogue registers on the server only. `road-courses.ts` is `server-only`, and `course-fallback.ts` defaults to empty, so a client import fails the build instead of shipping 1.4 MiB.
- The pin cannot be written from the board. `boardChoicesSchema` strips it from the request, and the update merges the stored pin back in the same statement.
- `createRoadmapAction` re-checks a pin on the server (known, two-year, its own city), and tests cover each refusal: unknown, one-year, wrong city, malformed.

## Built but not asked for
- `docs/course-finder/overnight.md`: a run report committed to the repo.
- Pinned roads in the feed (`feed-updates.ts`), Ask and the "why". No criterion names them, but each is needed so a pinned board is consistent.

## Blind spots
- The id cap: a test that runs `compareCourseAction` over the longest catalogue id would have caught it.
- Pay: no test states criterion 26's career contents. An assertion on the row text would have caught it.
- The 29 road courses' trade-off text is unchanged today (checked by a script), but no test pins it. A test over `COURSES` and `EXTRA_COURSES` asserting both sides would.
- Criterion 28 for the other-city tile: no test ties `alternativeForCity` to the road the tile's swap draws.
- Not verified here: smoke-pr3's type-check, lint, full suite and build. Run `bun run type-check`, `bun run test:run`, `bun run build`, and the roadmaps database test, before merging.

---
Stack: TypeScript, Next.js App Router (server components, server actions), React 19 client components, Drizzle on Postgres (jsonb), zod 4, Tailwind 4, bun test with happy-dom. Passes applied shallowly: none. The bundle check rests on `server-only` and the import graph, not on a build.

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed in `48b0942` (and PR 1 `9c83d7a` for the same id cap in the why action): both HIGHs, all seven MEDIUMs, and four LOWs. Left, as the reviewer advises: the LOW at `updates/server/feed-updates.ts:8` (catalogue loaded on every feed load), acceptable for now and lazy-loaded later. `roadmaps/server/roadmaps.test.ts` no longer hangs (the test awaited a rejection in a way that stalled the connection) and is now in `test:db`.
