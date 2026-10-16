# Student roads, Part A (`feat/student-roads`): Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 6 MEDIUM · 8 LOW

| | |
| --- | --- |
| Blocking | HIGH · `answers-panel.ts:8`: the opening model now loads the roads, and all six roads' copy ships to the board's client bundle |
| Blocking | HIGH · `e2e/your-road.e2e.ts:84`: the standing spec still opens Priya's tile. The intent says this blocks merging branch 1 |
| Branch | `feat/student-roads` at `0c9ecd5` over `origin/dev 1326aa9` · 61 files, +6060 −41 · 15 Oct 2026 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no package.json or lockfile change) · code N/A (semgrep not installed) |
| Not applicable | other `.claude/skills` (outside dispatch scope) · Industry `DESIGN.md` (two small blocks, judged against neighbours) |
| Failed to load | none |
| Read outside the diff | 12, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | B | MEDIUM · `roads/actions.ts:18` · no per-student limit | cap why calls per student |
| Performance | C | HIGH · `answers-panel.ts:8` · roads copy in client bundle | slim match keys only |
| CLAUDE.md | C | HIGH · `e2e/your-road.e2e.ts:84` · standing spec stale | update spec or switch off |
| fdd-architecture | C | HIGH · `answers-panel.ts:8` · opening ↔ roads cycle | inject road change from board |
| vercel-react-best-practices | B | MEDIUM · `learn/[lesson]/page.tsx:16` · roadmap fetched twice | `cache()` the roadmap read |
| tailwind-v4-best-practices | A | — | — |
| Criteria | B | MEDIUM · criterion 10 partly covered | loop demo profiles in test |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Six complete roads on the board's shape, figures mock | `build.test.ts:79`, `catalogue.test.ts:31` | covered |
| 2 | 3 cities, 3 fields, 190 / 491→191 / 186, one road home | `build.test.ts:173` | covered |
| 3 | Exact match draws that road, same shape | `road-for.test.ts:9`, `build.test.ts:79` | covered |
| 4 | Nearest road by stay, field, level, city hint | `match.test.ts:44` | covered |
| 5 | Says "closest", one chip per difference | `match-line.test.ts:13`, `match.test.ts:44` | covered |
| 6 | Over-budget chip states the gap, road unchanged | `build.test.ts:142`, `match.test.ts` "never reads the budget" | covered |
| 7 | No road → Priya's, illustrative line | `road-for.test.ts:44`, `match-line.test.ts:41` | covered |
| 8 | Switch off → Priya, no why, no AI call | `road-for.test.ts:32`, `server/why.test.ts:200` | covered |
| 9 | Old roadmap shows matched road, choices kept | `build.test.ts:102` | covered |
| 10 | Six profiles reach their road, why (fake), asks | `match.test.ts:32`, `server/why.test.ts:136`, `catalogue.test.ts:92` | partly covered |
| 11 | Preview names the new road | `road-change.test.ts:13`, `answers-panel.test.ts:194` | covered |
| 12 | Confirm draws new road, why written again | `useTileWhy.test.tsx:88` | covered |
| 13 | Cancel leaves road and answer | existing code, smoke step 4 | not automatable |
| 14 | Same road → "nothing moves" | `answers-panel.test.ts:201` | covered |
| 15 | City, course, PR tiles show why from answers and facts | `why.test.ts:32`, `server/why.test.ts:136`, `RoadBoard.test.tsx:812` | covered |
| 16 | Template while it is written | `useTileWhy.test.tsx:33` | covered |
| 17 | Failure keeps the template, no error | `server/why.test.ts:165,178`, `useTileWhy.test.tsx:54` | covered |
| 18 | Same answers → no new call | `server/why.test.ts:155`, `useTileWhy.test.tsx:74` | covered |
| 19 | No ranking words, no figure outside the catalogue | `why.test.ts:118`, `server/why.test.ts:165` | covered |
| 20 | No why on Point A, Australia, visas, years, 485, fork, stacks | `why.test.ts:16`, `build.test.ts:115`, `server/why.test.ts:186` | covered |
| A6 | `student_ask` table, `own_words` and `tags` columns | `student.test.ts:112`, `roadmaps.test.ts:196` (DB) | covered |
| 21–53 | Ask, cards, own words, posts, feed | — | not in this branch |

Criterion 1: the "labelled mock" half rests on the catalogue's sources and the board's existing mock tag. Nothing asserts it for the road copy. Criterion 10: only profile 1 goes through `writeWhy` on the fake provider. The other five are checked as templates (`why.test.ts:96`).

## Read outside the diff
- `src/features/road/components/RoadBoard.tsx:432`: the phone's own card is `cardFor(road, scene, null)`, so its `tileId: scene.here` matches its template (risk 1 settled).
- `src/app/(app)/roadmaps/new/page.tsx:29`: the only `getRoad()` left is the from-scratch draft, as planned. Every other caller now goes through `roadFor`.
- `src/features/road/model/scene.ts:289-297`: `applyAnswers` writes "Over budget by AUD Xk", so the gap figure in criterion 6 exists.
- `src/features/opening/index.ts:13-23`: the opening barrel exports `effectOf`, which `AnswersPanel` (client) imports.
- `PersonForm.tsx`, `AreaChecks.tsx` at `1326aa9`: the engine catalogue was already in the client bundle. What is new there is `roads/data/roads.ts` (about 40 KB of source).
- `src/features/opening/model/answers-panel.ts:99-106`: the person row cannot be edited, so no preview is missing for it.
- `src/features/roadmaps/server/roadmaps.ts:53,117-165,358`: every `Roadmap` goes through `toRoadmap`. All the literal fixtures were updated. A copy does not carry `ownWords` or `tags` (a question for Part D).
- `src/features/engine/catalogue.ts`: the 12 road courses' `feeK` values match the copy's figures today.
- `src/shared/lib/auth/as-student.ts:19-33`: the student comes from the session, the role is checked, and nothing is thrown.
- `src/features/content/ai/config.ts:45-63`: daily caps exist only for pro, image and search. Lite and flash have none.
- `src/features/content/ai/client.ts:76-88,326-337`: the call log stores no data. The cache key hashes the prompt, which includes her answers. It has no user id, which is correct here.
- `e2e/your-road.e2e.ts:84`: opens `?tile=data-science-uwa-perth`, an id that no matched road has.

## Findings, by file

### `src/features/opening/model/answers-panel.ts`

**HIGH · line 8 · boundary and bundle**
- What: the opening's model imports `roads/model/road-change` → `match` → `ROADS`. That brings all six roads' slot copy into `effectOf`, which the opening barrel exports to the client `AnswersPanel`.
- Why: the file's own header says "the opening never loads the road's code". It also creates an opening ↔ roads cycle (`match.ts` imports `opening/model/questions`), and about 40 KB of card copy reaches every board visitor even though the built road already arrives as props.
- Rule: `fdd-architecture` §2 public API boundary · `performance.md` §5 · a test would have caught it: no, nothing measures the bundle or the import graph
- Fix: have the road feature pass the road change into `effectOf` as a function (`rematch: { change: (after) => string | null }`). Have `matchRoad` read a slim `ROAD_KEYS` (id, label, stays, field, level, cityId), so the slot copy stays on the server.

### `e2e/your-road.e2e.ts`

**HIGH · line 84 · standing spec left on Priya's road**
- What: the spec opens Priya's `data-science-uwa-perth` tile. With the switch on, no matched road has that tile, and this branch neither updates the spec nor runs Playwright with `STUDENT_ROADS_OFF=1`.
- Why: intent open question 2 says this "blocks merging branch 1". CLAUDE.md also says standing specs are updated when a change alters what they cover.
- Rule: CLAUDE.md §Commands (standing specs) · a test would have caught it: yes, `bun run test:e2e`, which was not run
- Fix: get Nikhil's decision. Then either update the spec to a demo profile's road or set `STUDENT_ROADS_OFF: '1'` in the server env that `playwright.config.ts` starts.

### `src/features/roads/hooks/useTileWhy.ts`

**MEDIUM · line 58 · client key omits her answers**
- What: the key is `roadmapId:tileId:template`. Saving an answer that leaves the template the same (level, budget, where…) keeps the old model text for the rest of the page's life, while the server now writes from new data.
- Why: the model's text can quote an answer she has just changed ("you said Master's"), which runs against the intent behind criterion 18.
- Rule: `performance.md` §6 (the key must include what the value depends on). Not CRITICAL because the stale text is her own and stays on her own roadmap · a test would have caught it: yes, a hook case that changes the answers and keeps the template
- Fix: add an answers fingerprint to the key (have the board pass a hash of `answers`), or clear that roadmap's entries in `asked` when answers are saved.

### `src/features/roads/actions.ts`

**MEDIUM · line 18 · no per-student limit on model calls**
- What: `roadWhyAction` sends a model call for every new set of saved answers × 8 tiles, and the ladder can climb up to pro. Lite and flash have no cap, and pro's cap is shared with the admin.
- Why: one scripted student can run up unbounded lite and flash spend and use up the pro calls the admin's tools depend on.
- Rule: `security.md` §8 · `security-llm.md` §3 (rate and spend limits) · a test would have caught it: no
- Fix: count `student_why` calls per user per day (the `student_ask` pattern, or `reserve` with a per-user use case), or keep the student ladder on lite and flash under a cap of its own.

### `src/features/roads/server/why.test.ts`

**MEDIUM · line 136 · criterion 10 partly covered**
- What: only demo profile 1 goes through `writeWhy` on the fake provider. Profiles 2–6 are checked as templates only, and no test ties each profile's city and course to its suggested asks.
- Why: the six profiles are what the demo relies on, and criterion 10 names all three parts for each of them.
- Rule: criterion 10 · a test would have caught it: yes, the fix
- Fix: loop over `DEMO_PROFILES`: for each one, `writeWhy` on its road's course tile returns `source: 'model'`, and `asksFor` its city and course is non-empty.

### `src/app/(app)/roadmaps/[id]/learn/[lesson]/page.tsx`

**MEDIUM · line 16 · roadmap read twice per request**
- What: the page reads the roadmap again (`getRoadmap`, then `roadFor`) after the layout has already done both. `route/[routeId]/page.tsx:16` does the same.
- Why: every lesson or route view makes two identical queries and builds the road twice. The smoke file already lists this.
- Rule: `performance.md` §2 · `vercel-react-best-practices` `server-cache-react` · a test would have caught it: no
- Fix: wrap `getRoadmap` (or a `roadOf(userId, id)`) in React `cache()` so the layout and the page share one read.

### `src/features/roads/data/roads.ts`

**MEDIUM · line 296 · catalogue figures typed twice**
- What: `stackCourse({ feeK })` is typed by hand six times even though `stackCourseId` is known. Twelve course guides and the city lines repeat "About AUD Nk" figures that the catalogue holds. Only the course tile's `fees` is tested.
- Why: a catalogue edit leaves the cards showing old figures, and nothing would catch it.
- Rule: Quality (no duplicated logic) · repetition of three or more · a test would have caught it: yes, a test that compares every "AUD Nk" in a course's copy with its `feeK`
- Fix: take `feeK` from `courseById(spec.stackCourseId)` in `buildRoad`, and build the fee and living phrases from the catalogue in the helpers.

**LOW · line 668 · superlatives in the copy**
- What: Sydney's copy says "The biggest job market in Australia" and "The highest rents in the country".
- Why: the product ranks nothing (PRODUCT.md). Criterion 19 covers only the why text, but these lines read as rankings.
- Rule: intent §Constraints · a test would have caught it: no
- Fix: state the figures alone ("about 2,600 data job ads last quarter").

### `src/features/road/components/RoadBoard.tsx`

**MEDIUM · line 10 · road ↔ roads deep imports**
- What: the board imports `roads/components/MatchStrip`, `roads/hooks/useTileWhy` and `roads/model/match-line`. `RoadCard.tsx:6` does the same. `MatchStrip` and the roads' model import `road/components/MockTag` and `road/model/*` in return.
- Why: the two features now depend on each other's internals, where the board until now used only `@/features/opening` and `@/features/roadmaps` through their indexes.
- Rule: `fdd-architecture` §2 and §3 · a test would have caught it: no
- Fix: move the client pieces (`MatchStrip`, `useTileWhy`, `MatchLine`) into `features/road`, so `roads` stays data and server, or export them from a client-safe `roads` index.

### `src/features/road/components/RoadCard.tsx`

**LOW · line 135 · "Why it's on your roadmap" on tiles that are not**
- What: the alternative city, the alternative course and the stack course get the heading and "On your roadmap because…", while their own card says "Another city on the map: swap it onto your roadmap".
- Why: the two lines contradict each other on the same card.
- Rule: Quality (names say what things are) · a test would have caught it: no
- Fix: say "Why it's on your board" for the alternative and stack slots, or limit `WHY_SLOTS` to the tiles on her road.

### `src/features/roads/model/why.ts`

**LOW · line 256 · `whyProblems` misses spelled-out figures**
- What: the number check reads digits only, so "five years" or "thirty thousand" passes. Places and courses that are not in the facts are not checked either.
- Why: criterion 19 ("never states a figure that is not in the catalogue") rests on the prompt alone for these cases.
- Rule: `security-llm.md` §2 (validate output) · a test would have caught it: yes, a case with "five years"
- Fix: map number words to digits before the check, or refuse number words that are not in the facts.

**LOW · line 143 · visa read from the tile id**
- What: `visaOfTile` parses the subclass from the id's last three digits, and the road home's tiles silently fall back to the 485's facts.
- Why: renaming a tile id changes which facts the model gets, with no error.
- Rule: Quality · a test would have caught it: no
- Fix: put `visa: VisaId` on the PR slots of the spec.

### `src/features/roads/server/why.ts`

**LOW · line 38 · her answers' text kept in the shared cache**
- What: the model's why, written from her answers (and her tags, once Part D writes them), is stored in `ai_cache` with no owner and no expiry.
- Why: deleting her account leaves that text behind. Once wellbeing tags arrive this becomes personal data.
- Rule: `security.md` §4 and §6 · a test would have caught it: no
- Fix: record the decision. Before Part D, leave tags out of the cached data or give student entries a TTL.

### `src/features/roads/model/match.ts`

**LOW · line 167 · test fixtures in production code**
- What: `DEMO_PROFILES` and the `stated` and `relativeAt` helpers sit in `match.ts`, are repeated in `match.test.ts`, and now ship to the client with the matcher. The `ROAD_CITY_IDS` and `ROAD_COURSE_IDS` lists in `asks.ts:17` are typed by hand instead of read from `ROADS`.
- Why: the same data lives in three places.
- Rule: Quality (no duplicated logic) · a test would have caught it: no
- Fix: move the profiles to `model/demo-profiles.ts`, and derive the ask subjects from `ROADS`.

**LOW · line 52 · assumed answers read as "you said"**
- What: matching counts answers stored as `assumed`, so a chip can say "you said …" for a default she never picked (smoke decision 1).
- Why: the chip in criterion 5 claims words she did not say.
- Rule: criterion 5 · a test would have caught it: yes, an assumed answer giving no chip
- Fix: get Nikhil's decision, then skip `state: 'assumed'` in `text()` or word the chip differently.

### `src/features/content/ai/fake.ts`

**LOW · line 683 · the fake breaks the prompt's own rule**
- What: the fake's why ends with "Your answers put this on your road.", but the prompt requires "your roadmap".
- Why: a demo run on `AI_PROVIDER=fake` shows the wording the product avoids.
- Rule: Quality · a test would have caught it: yes, running `build.test.ts`'s "your road" check on the fake's output
- Fix: say "your roadmap".

## Top 3 priority fixes
1. `answers-panel.ts:8`: inject the road change from the board, and match on slim road keys so the copy stays on the server.
2. `e2e/your-road.e2e.ts:84`: take the open-question-2 decision, then update the spec or run e2e with the switch off.
3. `roads/actions.ts:18`: cap student why calls per user per day.

## Done well
- `roadFor` is small and pure, with one switch, and both fallbacks are tested. Every caller that has a roadmap now goes through it, and the 32-combination scene test pins criterion 9 by construction.
- The model path is guarded end to end. The action uses `asStudent` and `getRoadmap` ownership with bounded ids, `generateJson` is never the search path, `whyProblems` re-checks cached hits, a template stands behind every failure, and tests prove that a refusal makes no model call.
- The migration is purely additive: one new table with its index and foreign keys, and two nullable columns. `toRoadmap` safe-parses both new columns, and a DB test covers that.

## Built but not asked for
- Why text on the alternative city, the alternative course, the stack course and the 186/482 and road-home steps. Criterion 15 names city, course and 190/491/191 tiles. The plan widened it.

## Blind spots
- Client bundle size: no build was run. A `next build` bundle report for `/roadmaps/[id]` would show what `ROADS` adds.
- Whether the model's why names a place, course or job that is not in the facts: a check of its nouns against `data.facts`.
- The DB suite (`roadmaps.test.ts`) was not run here. The smoke file reports it hangs on this machine, as it does on `dev`.
- The e2e suite was not run. `your-road.e2e.ts` will fail with the switch on.

---
Stack: TypeScript, Next.js 16 App Router (server components, server actions, `after`), React 19 client components, Drizzle on Postgres, zod 4, Vertex Gemini through the repo's AI layer, Bun tests with happy-dom, Tailwind 4. Passes applied shallowly: performance §5 (bundle impact judged from the import graph, not measured); markup judged against `RoadHeader` and `RoadmapRow`, not Industry `DESIGN.md`.

## Fixes applied

Nikhil's instruction: fix all valid. Each finding, in the order above.

| Finding | Outcome |
| --- | --- |
| HIGH · `answers-panel.ts:8` · boundary and bundle | Fixed in `8dfa445`. `effectOf` takes the board's re-match rule as a callback (`RoadChangeOf`), so the opening model imports nothing of the roads. Matching reads `ROAD_KEYS` (id, label, stays, field, level, city); `ROADS` takes each road's key from there. The board imports only `roads/client.ts`; `roads/client.test.ts` walks the import graph and pins both rules. Checked in the build: no road card copy in `.next/static`, only the keys. |
| HIGH · `e2e/your-road.e2e.ts:84` · standing spec on Priya's road | Fixed in `a3ef45f` without touching the spec: the server Playwright starts runs with `STUDENT_ROADS_OFF=1`, until the matched roads get their own spec (intent, open question 2). A reused dev server keeps its own environment. Playwright was not run. |
| MEDIUM · `useTileWhy.ts:58` · key omits her answers | Fixed in `6985f82`. The key adds a fingerprint of her saved answers (order-independent); the board passes `roadmap.answers`. |
| MEDIUM · `roads/actions.ts:18` · no per-student limit | Fixed in `dfc5457`. `roads/server/why-limit.ts` counts whys per student with the repo's `rateLimiter` (60 an hour, in memory, per instance). Over it she gets the template, never an error, and the model is not called; ownership is still checked. |
| MEDIUM · `server/why.test.ts:136` · criterion 10 partly covered | Fixed in `218f06a`. Every demo profile goes through `writeWhy` on the fake (`source: 'model'`), and its city and course have asks. |
| MEDIUM · `learn/[lesson]/page.tsx:16` · roadmap read twice | Fixed in `8f88919`. `roads/server/roadmap-road.ts` wraps the read and the build in React `cache()`; the layout and the lesson and route pages share it. |
| MEDIUM · `roads.ts:296` · catalogue figures typed twice | Fixed in `4179380`. Fees and living costs in the copy come from the catalogue (`data/figures.ts`); the stack course names its catalogue course instead of a fee. A test pins every "AUD Nk" in a road's course and city copy to the catalogue; a snapshot of all six roads before and after was identical. |
| LOW · `roads.ts:668` · superlatives | Fixed in `4179380`. Sydney's lines state the figures alone; a test refuses superlatives in any road's copy. |
| MEDIUM · `RoadBoard.tsx:10` · road ↔ roads deep imports | Fixed in `8dfa445`. `MatchStrip`, `useTileWhy` and `matchLine` live in the road feature (`matchLine` exported from its index); the board's one import from roads is `@/features/roads/client`. `roads` still reads `road/model` types and Priya's fixture to build a `Road`. |
| LOW · `RoadCard.tsx:135` · "on your roadmap" on tiles that are not | Fixed in `218f06a`. Another city, another course and the stack's course are titled "Why it's on your board" and their template starts "Beside your roadmap"; the model is told where the tile is (`DATA.tile.on`, prompt `student_why.v3`). |
| LOW · `why.ts:256` · spelled-out figures | Fixed in `218f06a`. `whyProblems` reads number words ("five years", "thirty-three thousand") as figures; a lone "one" is left out, as it is mostly not a figure. |
| LOW · `why.ts:143` · visa read from the tile id | Fixed in `218f06a`. Each way-to-stay slot names its visa (`visa` on the slot copy, the 485 on the road home's); a renamed tile keeps its facts. |
| LOW · `server/why.ts:38` · her answers' text in the shared cache | Left, by decision: the cache is what criterion 18 relies on (the same answers make no new call). Before Part D writes tags, leave the wellbeing tags out of the cached data or give student entries a TTL. |
| LOW · `match.ts:167` · test fixtures in production code | Fixed in `8dfa445`. The profiles and their helpers are in `model/demo-profiles.ts`, which `match.test.ts` reuses; the asks' cities and courses are read from `ROADS`. That added the Wollongong cyber course (the Geelong road's stack course, missing from the typed list) its subjects and asks, and dropped `ecu-data`, which is on no road. |
| LOW · `match.ts:52` · assumed answers read as "you said" | Fixed in `99b735c`. An answer stored as assumed counts as unanswered in every rule and difference. |
| LOW · `fake.ts:683` · the fake says "your road" | Fixed in `218f06a`. A test runs the "your road" check on the fake's output. |

Checks after the fixes: `bun run test:run` 3092 pass, 0 fail; `bun run lint`, `bun run type-check` and `bun run build` clean.
