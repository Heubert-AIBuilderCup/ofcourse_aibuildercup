# Student roads, round 2 phase 1: the fixes after review r2 — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 1 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/features/opening/model/impact.ts:17`: the opening's model now imports `@/features/roads/client`, which breaks the boundary that says "the opening's model loads nothing of the roads" |
| Branch | `feat/student-roads` at `99a8d3d` over `39ea856` (the first r2 review's base) · 46 files, +929 −218 · 2026-10-16 |
| Reviewed against | security · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | security-web (browser code: an import swap only) · tailwind-v4 (no styling changed) · other skills (not in the dispatch) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-llm.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md | A | LOW · `impact.test.ts:355` · TOEFL case dropped | optional |
| vercel-react-best-practices | A | — | — |
| fdd-architecture | C | HIGH · `impact.ts:17` · opening loads the roads | Pass the reach in |
| Criteria | B | MEDIUM · `why.ts:465` · alt-city implies a PR path | Keep list facts off no-PR roads |

Fixes checked against the diff, not the table: all 13 resolve their finding. 63 now carries a `qual` chip with or without a level answer (probed on High school + Design, Engineering or Data science, and on a Diploma holder in IT). `eligibleRoads` no longer falls back above her level. The no-clear-PR ending and label agree through `stayingRoute`. The comparatives are in the one `RANKING` list, and the prompts are bumped to `student_why.v5` and `student_ask.v3`. The ladder stops on the caller's signal, and nothing changes without one. Ask's course rows come from `courseConditions`. The preview reads `Tile.ielts`. `NOT_TAKEN` is defined once. The test changes keep each criterion covered. Three of the fixes brought in the new findings below.

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 56 | course in her field, at an open level | `match.test.ts:139`, `road-for.test.ts:37` | covered |
| 58 | template text true to the catalogue | `compose.test.ts:188`, `:216` | covered (alt-city: see finding) |
| 59 | road home in her field, no PR claim | `compose.test.ts:294` | covered |
| 60 | qualification gates, never above | `eligibility.test.ts:5`, `match.test.ts:181`, `:188` | covered |
| 62 | English met or not, course's own score | `answers-panel.test.ts:183`, `build.test.ts:192`, `impact.test.ts:336` | covered |
| 63 | nearest road with a level chip | `match.test.ts:139`, `:164` | covered |
| 64 | the why names the rule | `why.test.ts:196`, `:240` | covered |
| 65 | an alternative says how it relates | `why.test.ts:269` | covered |
| 69 | Ask may cite both courses' rows | `ask.test.ts:116` | covered |
| 75 | chips in plain words per key | `match-line.test.ts:25`, `:52` | covered |
| 79 | student prompts stop at Flash | `server/ask.test.ts:378`, `server/why.test.ts:369` | covered |
| 80 | deadline, late answer ignored, no retry | `client.test.ts:306`, `server/ask.test.ts:303`, `server/why.test.ts:268` | covered |
| 84–85 | labelled evaluation (Ask part) | `evals/ask-cases.ts:37` | scoring covered; live run needs the developer |
| 86 | sweep ≥50% exact, all reachable | `match.test.ts:503` | covered (run: 52.3% of 24,624, none unreached) |
| 100 | exact score, range refused | `ExactScore.test.tsx:43`, `AnswersPanel.test.tsx:126` | covered |
| 102 | met or not, names her test | `answers-panel.test.ts:183` | covered |

Note: the other criteria are as the first review left them, and the fixes did not touch them: 71–74, 83, 90–99 and 103 are not in this branch, 88 is unbuilt, and 76–78 need the live run. The relabelled Ask case (`ask-cases.ts:37`, now answerable) rests on the developer's word. Nothing in the diff shows Nikhil skimmed the case file, which the 84/85 amendment asks for before the live run.

## Read outside the diff
- `src/features/content/ai/client.ts:384-460`: the caller's abort is checked before `reserve`, so no Pro slot is taken. An aborted attempt is logged and recorded once, with no cache write. With no signal the code path is unchanged (risk 3, settled).
- `src/features/roads/model/road-for.ts:33`: catches the new throw from `matchRoad` and draws the illustrative road.
- `src/features/roads/model/road-change.ts:14`: does not catch it (LOW below).
- `src/features/roads/model/why.ts:286`: `stayReason` drops "you said you'd stay" when a `stay` difference exists, so a no-clear-PR road's city why names no rule (blind spot).
- `src/features/roads/model/why.ts:224`: the alt-city list fact is among the model's facts, so the template and the model agree.
- `src/features/roads/client.test.ts:40`: the boundary pin walks `answers-panel.ts` only, so it missed `impact.ts`.
- `src/features/roads/model/ask.ts:72`: subject conditions and the new entry rows sit side by side and do not contradict each other.
- `src/features/roads/data/fields.ts:105`: "better" in a field definition. It feeds only `details.ts`, never model data, so the new ranking word cannot refuse it.
- `src/features/roads/model/endings.ts:243` with `why.ts:350`: home roads also carry `prRoute: 'none'`, and the chosenBy guard checks `stays`.
- Scratch runs: `match.test.ts` under `capped.sh` (42 pass, sweep 52.3%, none unreached); six changed suites (323 pass); the import graph from `impact.ts` (11 roads modules, `courses.ts` among them); `whyTemplate` for alt-city on four roads; `matchRoad` on nine answer sets.

## Findings, by file

### `src/features/opening/model/impact.ts`

**HIGH · line 17 · opening loads the roads**
- What: the English line imports `englishReach` from `@/features/roads/client`. From the onboarding question screen, that pulls in 11 roads modules: the client barrel, `entry.ts`, `courses.ts` (every course's claims and lines), `candidates.ts`, `match.ts` and `occupations.ts`.
- Why: the codebase states the rule twice ("the opening's model loads nothing of the roads" in `roads/client.test.ts`, and "the opening never loads … the roads'" in `answers-panel.ts`). The board passes its re-match rule in for exactly this reason. Now opening and roads depend on each other, and the onboarding bundle carries the catalogue copy.
- Rule: `fdd-architecture` §2 (public API boundary), the repo's own pinned boundary, `performance.md` §5 · a test would have caught it: yes, but `client.test.ts:40` walks `answers-panel.ts` alone.
- Fix: pass the reach in as the board passes its rule (the screen's server parent computes `englishReach` and hands down the counts or a function), and widen the pin to walk every file under `opening/model`.

### `src/features/roads/model/why.ts`

**MEDIUM · line 465 · alt-city template implies a PR path**
- What: the alt-city template now ends with the course's first occupation's list status in the other state. On `perth-tafe-cyber-stay` it reads "ICT Support Technician is on SA's 491 list." beside a fork that says "No clear road to permanent residency from here: a diploma alone does not lead to nomination". `adelaide-unisa-dip-it-stay` reads the same way for Tasmania.
- Why: this brings back, in the why, the contradiction the staying-ending fix removed. Next to her road, a 491 list reads as a way to PR that the catalogue denies (risk 2).
- Rule: criterion 58 (true to the catalogue), 65 · a test would have caught it: yes, an alt-city template on each `prRoute: 'none'` road asserting no list or visa claim.
- Fix: on a road whose `prRoute` is `'none'` (staying or home), give alt-city its regional or living fact, or the course's own PR line, instead of a list fact.

**LOW · line 412 · regional relation reads two ways**
- What: when neither city is regional it reads "Sydney does not count as regional for visas, like Melbourne", which can be read as Melbourne counting.
- Why: criterion 65's relation should be plain at a glance.
- Rule: criterion 65 wording · a test would have caught it: no, the test pins this wording.
- Fix: "Neither Sydney nor Melbourne counts as regional for visas" (and "Both … count" when both do).

### `src/features/opening/model/answers-panel.ts`

**LOW · line 193 · "no longer met" when it never was**
- What: `englishEffect` reads only the new value. A student whose saved PTE 50 already falls short and who changes to PTE 52 is told the condition is "no longer met". The new test pins this case (`answers-panel.test.ts:183`, "whose saved answer already falls short").
- Why: the preview describes a change that does not happen.
- Rule: criterion 102 consistency · a test would have caught it: the test asserts the wrong wording.
- Fix: compare the saved answer too. If it already fell short, say "is still not met" or nothing.

### `src/features/roads/model/road-change.ts`

**LOW · line 14 · new throw path unguarded**
- What: `matchRoad` now throws when no road is at her level or below. `roadFor` catches it, but `roadChange`, which runs in the board's "Your answers" preview, does not.
- Why: today's catalogue cannot reach it (Diplomas exist for every gated qualification). Phase 2's catalogue could, and then the panel would crash.
- Rule: `security.md` §8 / quality (errors surfaced, not swallowed) · a test would have caught it: yes, `roadChange` with a roads list that leaves none.
- Fix: return null from `roadChange` when either match throws, or have `matchRoad` return a "none" kind instead of throwing.

### `src/features/opening/model/impact.test.ts`

**LOW · line 355 · TOEFL case dropped**
- What: the test named "reads PTE and TOEFL through their mock IELTS equivalent" asserts PTE only. The TOEFL 85 line was removed.
- Why: the name claims coverage it no longer has. The TOEFL table is still tested in `english.test.ts`, so no criterion is lost.
- Rule: quality (names that say what things are) · a test would have caught it: n/a.
- Fix: restore the TOEFL 85 assertion, or rename the test.

## Top 3 priority fixes
1. `impact.ts:17`: stop the opening importing the roads. Pass the reach in and widen the boundary pin in `client.test.ts`.
2. `why.ts:465`: no occupation-list fact on the alt-city template of a no-clear-PR or home road.
3. `answers-panel.ts:193`: say "still not met" (or nothing) when the saved answer already fell short.

## Done well
- `stayingRoute` decides the way to PR once, for the ending, the candidate label and matching. A test proves every candidate label ends as its composed road does, and the no-PR test checks every post-485 slot for any visa or PR claim.
- The deadline fix is minimal and safe in the shared layer: one `aborted` check before `reserve` and `AbortSignal.any` only when a signal is given. The server tests now send a late invalid answer, which proves no second rung starts.
- The 63 fix is tested without a level answer across four answer sets. The tie rule is tested alone. The sweep still clears its floor (52.3%), and every candidate is still reachable.

## Built but not asked for
- The Staying chip "this road has no clear road to PR" and the stay-Yes tie preference (coordinator follow-up). They are true to the catalogue and in the spirit of 75, but no criterion names them. They also cost 4 points of the sweep, leaving 2.3 points above the 50% floor.

## Blind spots
- On a no-clear-PR road, the city tile's why now names no rule: the `stay` difference silences `stayReason`, and the course's place is not a rule `chosenByOf` names for a city. Criterion 64 holds only in that an empty `chosenBy` is the existing design. A test of the city why for a school leaver who said Yes would show it.
- `qualReason` joins several areas into one subject ("Design and Engineering is taught …"). Nothing tests a two-area school leaver whose areas are all Master's-only.
- The new ranking words are code-checked, but other judgements ("ideal", "smarter", "more suitable") still rest on the prompt. A fixture set of model replies run through `askProblems` would show the gap.
- 76–78 and 84–85 are proven only by the live runs, which have not happened yet.

---
Stack: TypeScript, Next.js app router (server modules, client hooks), React 19 tests with Bun test and happy-dom, Gemini through the app's own `generateJson` client. Passes applied shallowly: none. Copy was judged on scratch runs over the pure modules (four roads, nine answer sets), not on the regenerated gallery.

## Fixes applied

All six findings fixed on `feat/student-roads`, each test-first (the test failed for the reason named, then passed).

| Finding | Commit | Fix | Test |
| --- | --- | --- | --- |
| HIGH · `impact.ts:17` opening loads the roads | `49a1098` | The roads' `englishReach` is gone; the roads' server API exports `englishScores()` (each course's IELTS score, plain data). The four onboarding pages pass it to `QuestionScreen` (`englishScores` prop), and `impactLine` / `impactView` take it and count her reach themselves. `impact.ts` now loads nothing of the roads. | `roads/client.test.ts`: the guard walks every non-test file in `opening/model` and `QuestionScreen.tsx`. It failed on `impact.ts` (11 roads modules) before the fix. |
| MEDIUM · `why.ts:465` alt-city implies a PR path | `ba7adfd` | On a road whose `prRoute` is `'none'` (no clear road to PR, or a road home), the city and other-city facts carry no occupation-list fact. The other city's template line is then its living cost ("Living costs in Adelaide about AUD 20k a year"), not a list. | `why.test.ts`: every candidate with `prRoute: 'none'`, both city slots. No fact and no template line names a list, a subclass or PR, and the template passes `whyProblems`. |
| LOW · `why.ts:412` regional relation reads two ways | `c58af8a` | "Melbourne does not count as regional for visas; neither does Sydney" and "Adelaide counts as regional for visas; so does Perth". | `why.test.ts` pins both wordings. |
| LOW · `answers-panel.ts:193` "no longer met" when it never was | `f8fae13` | `englishEffect` reads her saved answer too. If it already fell short, the line says the condition "is still not met". | `answers-panel.test.ts`: saved PTE 50 to PTE 52 reads "still not met"; saved "Not taken yet" kept reads "still not met"; saved IELTS 7.0 to PTE 52 still reads "no longer met". |
| LOW · `road-change.ts:14` new throw path unguarded | `2961b19` | `roadChange` takes the road list (default: the candidates) and returns null when either match throws. | `road-change.test.ts`: a Master's-only list and a school leaver. `matchRoad` throws, `roadChange` returns null both ways. |
| LOW · `impact.test.ts:355` TOEFL case dropped | `6a609ae` | Restored TOEFL 85 (about IELTS 6.5, 23 of 29) and added TOEFL 40 (below every course). | It passes on the existing code: it restores coverage, not a behaviour change. |

Checks: full unit suite 3395 pass, 0 fail (baseline 3392 plus 3 new tests). The database suites run by path against `student_roads` all pass: `asks.test.ts` 5, `student-profile.test.ts` 4, `updates.test.ts` 5. Lint, type-check and `bun run build` are clean.

Follow-up, asked for by the coordinator after the six: `fix(roads): the course tile on a road with no way to PR cites no list either`. On a road whose `prRoute` is `'none'`, the course, alt-course and stack-course tiles keep their occupation and drop its list status, in both the facts sent to the model and the template. The Diploma road's course why now reads "Diploma of Information Technology at UniSA College leads to ICT Support Technician." It no longer adds "on SA's 491 list", so nothing sits against the fork's "no clear road to PR". Ask's course rows (`courseFacts`) still carry the lists. The test over every no-clear-PR pick now covers all five city and course slots. It failed on the course facts first ("Data Scientist is on no VIC list" on `melbourne-home`), then passed. Full suite 3395 pass, 0 fail; lint and type-check clean.
