# Student roads, round 2 phase 1 (roads and Ask) — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 6 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/features/roads/model/match.ts:204`: criterion 63 is not met when her level is unanswered. A school leaver drawn to Design gets Perth's cyber Diploma with only a Field chip and no level chip |
| Branch | `feat/student-roads` at `39ea856` over `0c962da` · 89 files, +7435 −675 (generated files left out) · 2026-10-16 |
| Reviewed against | security · security-llm · security-web · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | other `.claude/skills` (not in the dispatch) |
| Failed to load | none |
| Read outside the diff | 8, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-llm.md`, `security-web.md`) | B | MEDIUM · `why.ts:84` · no comparative check | Code-check "better", "worse" in replies |
| Performance | A | LOW · `server/ask.ts:61` · ladder runs past the deadline | optional |
| CLAUDE.md | B | MEDIUM · `AnswersPanel.test.tsx:135` · element matchers | Assert textContent, never elements |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | — | — |
| fdd-architecture | A | LOW · `match-line.ts:8` · duplicated stay wording | optional |
| Criteria | C | HIGH · `match.ts:204` · 63 partly unmet | Name the level gap without a level answer |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 54 | ≥12 more two-year courses, full data, mock | `catalogue.test.ts:195` | covered |
| 55 | every pick has the board's shape | `compose.test.ts:89` | covered |
| 56 | course in her field, at an open level | `match.test.ts:120`, `road-for.test.ts:21` | covered |
| 57 | demo profiles keep hand-written text | `compose.test.ts:102` | covered |
| 58 | template text impersonal, catalogue only | `compose.test.ts:111` | covered (see `endings.ts` finding) |
| 59 | road home in her field, no PR claim | `match.test.ts:204`, `compose.test.ts:250` | covered |
| 60 | qualification gates the levels | `eligibility.test.ts:5`, `match.test.ts:130` | covered |
| 61 | Engineering needs a degree in engineering | `build.test.ts:201`, `conditions.test.ts:73` | covered |
| 62 | English met or not, the course's own score | `conditions.test.ts:16`, `build.test.ts:176` | covered |
| 63 | nearest road with a level chip | `match.test.ts:144` | partly: only when she stated a level |
| 64 | the why names the rule that chose the tile | `why.test.ts:160` | covered (alt-city: see finding) |
| 65 | an alternative says how it relates | `why.test.ts:234` | covered |
| 66 | no "(mock)", option wording or tag as the reason | `why.test.ts:350`, `server/why.test.ts` | covered |
| 67 | Ask on Flash-Lite | `server/ask.test.ts:201`, `:376` | covered |
| 68 | amounts read "AUD 30k a year" | `answer-lines.test.ts:10` | covered |
| 69 | an alternative cites her course's rows | `ask.test.ts:153` | covered |
| 70 | refusal → suggestions (+ counsellor line) | `TileAsk.test.tsx:139`, `ask.test.ts:246` | covered |
| 71–74 | own words | — | not in this branch |
| 75 | chips in plain words per key | `match-line.test.ts:26` | covered |
| 76–78 | real-Gemini check (roads part) | `scripts/ai-smoke-student.ts`, `recording.test.ts` | not run yet, needs the developer |
| 79 | student prompts stop at Flash | `client.test.ts:232`, `:250` | covered |
| 80 | overall deadlines, late answer ignored | `server/ask.test.ts:303`, `server/why.test.ts:268` | covered |
| 81 | STUDENT_AI_OFF end to end | `switch.test.ts:6`, `TileAsk.test.tsx:78`, server tests `:323`/`:287` | covered (layout: smoke 20; own-words box not in this branch) |
| 82 | budget row computed in code | `ask.test.ts:185` | covered |
| 83 | Devanagari amounts | — | not in this branch (plan R9) |
| 84–85 | labelled evaluation (Ask part) | `score.test.ts`, `scripts/ai-eval-student.ts` | scoring covered; live run not run yet, needs the developer |
| 86 | sweep ≥50% exact, all reachable | `match.test.ts:382` | covered |
| 87 | road gallery | `scripts/roads-gallery.ts` | covered by a run (54 sections = 54 picks) |
| 88 | warm-up | — | not built (R12b, outside this round) |
| 89 | Diploma named for its level, post-vocational 485 | `compose.test.ts:195`, `:217` | covered |
| 90–99 | Models page | — | not in this branch |
| 100 | exact score control, range refused | `ExactScore.test.tsx:43`, `QuestionScreen.test.tsx:191`, `AnswersPanel.test.tsx:126` | covered |
| 101 | stored as "PTE 58", read so | `english.test.ts:11`, `questions.test.ts:118` | covered |
| 102 | mock concordance, met or not, names her test | `conditions.test.ts:47` | covered |
| 103 | own words exact score | — | not in this branch |

Note: 88 belongs to this branch's range but R12b is not in this round's tasks. Before the PR, either build it or record that it moves.

## Read outside the diff
- `src/features/content/ai/client.ts:376-470`: the rung loop reads no index or ladder length. With no `maxTier` the ladder and the cache are exactly as before (risk 1, settled).
- `src/features/opening/model/impact.ts:150-186`: the English impact line contradicts `entry.ts` (finding below).
- `src/features/opening/model/answers-panel.ts:176-184`: `englishEffect` reads the badge value, which now has a "Not met: " prefix.
- `src/features/roads/model/why.ts:84`: `RANKING` has no comparatives.
- `src/features/road/components/RoadCard.tsx`: the why action was already `WhyAction | undefined`, so the AI-off wiring is typed.
- `src/features/opening/components/PersonForm.tsx`: the field classes are shared with `ExactScore` (2 uses, under the rule of three).
- `docs/student-ai-roads/road-gallery.md`: generated, 54 road sections.
- A scratch `bun` script over the pure modules (`roadFor`, `matchRoad`, `specById`, `whyFacts`) confirmed the alt-city reason, the High school + Design match and the Diploma endings quoted below.

## Findings, by file

### `src/features/roads/model/match.ts`

**HIGH · line 204 · criterion 63 without a level answer**
- What: `eligibleRoads` gates by level before the rules run, but a level chip only appears when she stated a level. A school leaver drawn to Design (or Engineering), or a Diploma holder in Data science, with no level answer gets `perth-tafe-cyber-stay` and only `Field: … (you picked Design)`.
- Why: criterion 63 says that when no course fits her qualification in her field, she gets the nearest road with a chip naming the level difference. Here she is never told her field exists only at a level she cannot enter.
- Rule: intent criterion 63 (and its 60/63 amendment) · a test would have caught it: yes, `match.test.ts:144` covers only `level: "Master's"` stated.
- Fix: when eligibility removed every road in her picked fields, add a `level` difference from the eligibility rule (for example "Level: Design is taught here only as a Master's (your qualification opens Diploma)"), and test it with no level answer. If the developer reads 63 as relative to her level answer only, record that in the intent.

**LOW · line 145 · regional chip wording**
- What: the chip reads "City: Melbourne (you said regional: Perth or Adelaide)", but she said "Regional", not those two cities.
- Why: criterion 75 asks for plain words about what she said. The city list is code's choice.
- Rule: criterion 75 · a test would have caught it: no, the test pins this wording.
- Fix: "(you said regional; the hint names Perth or Adelaide)" or similar.

### `src/features/roads/model/why.ts`

**MEDIUM · line 329 · alt-city gets a false reason**
- What: `chosenByOf` has no `alt-city` case, so it falls into `default` and returns `stayReason`. The alternative city's template reads "Beside your roadmap: you said you'd stay. Adelaide counts as regional…", and the model is given the same `chosenBy`.
- Why: the alternative city comes from the skeleton, not from her stay answer. "Gives alternatives false reasons" is a stated round-2 problem.
- Rule: criteria 64/65 (spirit), problem statement · a test would have caught it: yes, nothing asserts `alt-city`'s `chosenBy`.
- Fix: return `[]` for `alt-city`, and give it a `relation` such as "the other city on your board, Adelaide counts as regional". Add `alt-city` to the chosenBy tests.

**MEDIUM · line 84 · comparatives not code-checked**
- What: Ask now asks the model to compare two courses "fact by fact" (criterion 69). `rankingWords` only lists best, recommended, recommend, top, ranked and number one, so "better" or "worse" passes `askProblems`.
- Why: "never say one course is better" is now held by the prompt alone, on the call that invites comparisons. Criterion 85's zero-ranking bar uses the same list.
- Rule: `security-llm.md` §2 (model output validated in code), criterion 85 · a test would have caught it: yes, an `askProblems` case with "better".
- Fix: add judgement comparatives (better, worse, stronger, the right choice) to the check. Keep factual ones ("more in fees") allowed, and test both.

### `src/features/roads/model/endings.ts`

**MEDIUM · line 58 / 97 · staying ending contradicts the catalogue**
- What: on a staying Diploma road, `prEnding` builds the PR fork from occupation lists alone. `perth-tafe-cyber-stay` and `geelong-deakin-dip-business-stay` read "Two ways to PR from here, both through an employer", while their own 186 step says "It is not on the lists employers sponsor from". `adelaide-unisa-dip-it-stay` is labelled "· 491". All of this sits beside the course's catalogue line "A diploma alone does not lead to nomination".
- Why: composed text must be true to the catalogue (risk 2). Smoke step 15 shows this road.
- Rule: criterion 58, review risk 2 · a test would have caught it: yes, a test that a staying road's fork never offers an employer path for an unsponsored occupation, or that a Diploma's ending matches its `pr` line.
- Fix: when the course's `pr` line is a no-PR line, or the occupation is neither listed nor sponsored, compose a "no clear road to PR" ending (like Design's), with `prRoute` and the label to match.

### `src/features/opening/model/impact.ts`

**MEDIUM · line 164 · English line contradicts entry rules**
- What: `ENGLISH_MEETING_EVERY_COURSE` still says "IELTS 6.5" (now also an exact score's stored form) "meets the English requirement of every course in this preview". `entry.ts` gives six courses IELTS 7.0 (UTS cyber, data and business analytics, Swinburne, both Nursing).
- Why: in onboarding she is told she meets every course, then her card says "Not met: IELTS 7.0" (risk 5: every place an English answer is read).
- Rule: criterion 62/102 consistency · a test would have caught it: yes, compare the line with `entryOf` over the catalogue.
- Fix: derive the line from `entryOf` (the highest score asked, or how many courses she meets), or drop the "every course" claim.

### `src/features/opening/components/QuestionScreen.test.tsx`

**MEDIUM · line 202 · test bloat**
- What: "says the range and saves nothing" repeats `ExactScore.test.tsx:43`, the same message with nothing handed on. It also asserts with `getByText(...).toBeInTheDocument()`.
- Why: it is a repeated assertion. The wiring is already proven by the test at line 191.
- Rule: plugin quality rule (test bloat), CLAUDE.md "never elements" · a test would have caught it: n/a.
- Fix: delete the test.

### `src/features/road/components/AnswersPanel.test.tsx`

**MEDIUM · line 135, 142 · element assertions**
- What: the new test asserts `expect(getByRole('alert')).toHaveTextContent(...)` and `expect(within(rowOf(ENGLISH)).getByText('PTE 58')).toBeInTheDocument()`.
- Why: CLAUDE.md requires tests to compare strings, counts and attributes, never elements. A failing element matcher is the known trigger that took `bun test` past 29 GB.
- Rule: CLAUDE.md (capped.sh rule) · a test would have caught it: n/a.
- Fix: `expect(screen.getByRole('alert').textContent).toBe(...)` and `expect(rowOf(ENGLISH).textContent).toContain('PTE 58')`.

### `src/features/roads/server/ask.ts`

**LOW · line 61 (and `server/why.ts:51`) · ladder outlives the deadline**
- What: `Promise.race` returns at the deadline, but `generateJson` keeps going: a second rung (Flash), the call log and the cache write all happen after she was told it failed.
- Why: it spends model calls on an answer nobody reads (bounded at two attempts).
- Rule: `performance.md` §3, `security-llm.md` §3 (spend) · a test would have caught it: yes, assert the provider count after the deadline.
- Fix: pass an `AbortSignal` that the deadline aborts, or accept and note it.

### `src/features/roads/model/ask.ts`

**LOW · line 71 · Ask cannot say the entry score the card shows**
- What: `courseRows` has no IELTS or degree row, so "What IELTS score do I need?" is refused, while the course card shows "IELTS 7.0 overall". The eval case labels it refused to match.
- Why: the card and Ask disagree on one tile.
- Rule: criterion 62 consistency · a test would have caught it: no.
- Fix: add `courseConditions` rows to `courseRows`, then relabel that eval case on the developer's word, before the live run.

### `src/features/opening/model/answers-panel.ts`

**LOW · line 178 · preview reads "asks for Not met: …"**
- What: `englishEffect` quotes `road.badges.ielts.value`, which now begins "Not met: " when her saved score falls short. The preview then reads "it asks for Not met: IELTS 7.0 overall". An exact score below the requirement previews no effect at all.
- Why: wording bug and a silent preview.
- Rule: criterion 102 · a test would have caught it: yes.
- Fix: read the requirement from `courseConditions`, not the badge text.

### `src/features/roads/model/eligibility.ts`

**LOW · line 50 · fallback can go above her level**
- What: when no road is open to her and none is at or below her level, `eligibleRoads` returns every road, Master's included.
- Why: this contradicts "never above". It cannot happen with today's catalogue.
- Rule: criterion 60/63 amendment · a test would have caught it: yes, with a list of only Master's roads.
- Fix: return `below` even when it is empty and let `matchRoad` say there is no road, or keep it and note why.

### `src/features/road/model/match-line.ts`

**LOW · line 8 · duplicated wording and constants**
- What: the stay wording here duplicates `STAY_REASON` in `why.ts`, and `NOT_TAKEN` is redefined in `conditions.ts:20` and `scene.ts:265`.
- Why: one meaning, three places to drift.
- Rule: plugin quality rule (no duplicated logic) · a test would have caught it: no.
- Fix: export `NOT_TAKEN` once from `opening/model/questions` and reuse it. The stay wording can stay local if the two must differ.

### `src/features/roads/data/candidates.ts`

**LOW · line 9 · catalogue copy in the client bundle**
- What: the client entry now loads `courses.ts` (every course's claims and lines), plus occupations, fields and entry rules, on every board.
- Why: the bundle grows with the catalogue. There is no secret in it, and the developer accepted it (plan, point Q).
- Rule: `performance.md` §5 · a test would have caught it: `client.test.ts` pins only `roads.ts`.
- Fix: optional. Split the keys matching needs (field, level, city, years) from the claim text.

## Top 3 priority fixes
1. `match.ts:204`: give the level gap a chip when eligibility empties her field, with a test that has no level answer.
2. `endings.ts:58`: compose a no-PR ending for courses whose catalogue says no nomination, or whose occupation is neither listed nor sponsored.
3. `why.ts:329`: no stay reason on `alt-city`, and add comparatives to the ranking check (`why.ts:84`).

## Done well
- The shared model layer change is opt-in and small. `maxTier` filters the ladder only when set, `cache` defaults to on, and tests pin the unchanged ladder, the Flash ceiling and the single Flash-Lite attempt the scripts rely on.
- Every pick is built and checked against Priya's geometry through one shared `expectSound`. Hand-written specs come back verbatim, and `specById` resolves ids through a map, never by parsing.
- The facts are code's: the budget row, the counsellor and "Try one of these" lines are fixed strings, and wellbeing tags are filtered in both the why and Ask. The scripts guard provider, Pro cap, Lite model and `/student_roads` before any call, and count attempts from their start.

## Built but not asked for
- `Difference.because`, "which counts as regional too", for a road in another regional city: a reasonable extension of 75.
- The impact line for exact scores (`impact.ts`): supports 101, not asked for by name.

## Blind spots
- The tag-as-reason check only catches a tag's literal text in a "because" sentence. A paraphrase ("because your cousin is there" against a tag "Near family") passes. A model-output fixture set run through `whyProblems` would show how often.
- "Never that her answers chose it" on an alternative is enforced only by the prompt. A `whyProblems` line rejecting "you picked" or "you said" on beside tiles would make it code's.
- The STUDENT_AI_OFF wiring in the layout (`layout.tsx`) is checked only by smoke step 20, as the plan intends.
- 76–78 and 84–85 are proven only by the live runs, which have not happened yet.

---
Stack: TypeScript, Next.js (app router, server actions), React 19 client components, Tailwind 4, Bun test with happy-dom, Gemini through the app's own client. Passes applied shallowly: none. Copy was judged on the composed roads the scratch run and the tests produce, not on all 54 gallery sections.

## Fixes applied
_16 Oct 2026, on the developer's "fix all valid". Each behaviour fix was written test-first. Full suite 3390 pass, 0 fail (baseline 3378); DB tests by path against `student_roads` 14 pass; lint, type-check and build clean._

| Finding | Outcome | Commit |
| --- | --- | --- |
| HIGH · `match.ts:204` · 63 without a level answer | Fixed. When her qualification shaped the road (her field is taught only at levels it does not open, or no road is at a level it opens) the match carries a `qual` difference, level answered or not; the chip reads "Qualification: this road is a Diploma; Design is taught here only as a Master's, which your qualification does not open (you said High school)". Tested with no level answer: High school + Design, High school + Engineering, Diploma + Data science, and a Diploma holder in IT (no Bachelor's road exists). | `43b469c` |
| LOW · `match.ts:145` · regional chip wording | Fixed. "(you said regional, which points to Perth or Adelaide)"; career focus reads the same way. Smoke step 17 updated. | `b6ab68b` |
| MEDIUM · `why.ts:329` · alt-city false reason | Fixed. `alt-city` has no `chosenBy`; it gets a `relation` (the other city on her board, its regional status beside hers, the living-cost difference), and its template rests on the course's list status in that state. STUDENT_WHY says "that city or course" (`student_why.v5`). | `eea39c8` |
| MEDIUM · `why.ts:84` · comparatives not code-checked | Fixed. better, worse, stronger, weaker and "right choice" are ranking words (why, Ask and the evaluation's score read the one list); "more in fees" still passes. Both prompts say so (`student_ask.v3`). | `6193308` |
| MEDIUM · `endings.ts:58/97` · staying ending vs catalogue | Fixed. `stayingRoute` decides the way to PR once, for the ending and the candidate's label: none when the catalogue gives the course no clear road (PR score 0: the four Diplomas and Interaction Design) or no occupation is listed or sponsored there. Such a road keeps the 485's two ways under a "No clear road to PR" fork with the catalogue's reason, its label ends "· no clear PR", and its steps name no stay answer. Note: this also changes Melbourne's Interaction Design staying road, which read "2 ways to PR" through an employer while its card said "No clear road to permanent residency". Gallery regenerated, smoke step 15 updated. | `f0955b4`, `26c9e18` |
| MEDIUM · `impact.ts:164` · English line vs entry rules | Fixed. The line counts the courses her score meets from each course's own entry score (`englishReach`): "IELTS 6.5: meets the English score of 23 of the 29 courses in this preview · mock". | `776e823` |
| MEDIUM · `QuestionScreen.test.tsx:202` · test bloat | Fixed. The duplicated range test is deleted; `ExactScore.test.tsx` keeps criterion 100's range refusal. | `06a6db5` |
| MEDIUM · `AnswersPanel.test.tsx:135/142` · element assertions | Fixed. The test reads the alert's and the row's `textContent` and a null query. | `06a6db5` |
| LOW · `server/ask.ts:61`, `server/why.ts:51` · ladder outlives the deadline | Fixed. `generateJson` takes the caller's signal: once the deadline aborts it, the attempt in flight is aborted and no other rung starts (no call, log row or cache write). Without a signal the ladder is unchanged. | `a0ecb3f` |
| LOW · `model/ask.ts:71` · Ask cannot state the entry score | Fixed. A course's rows hold its entry conditions from the card's rule ("… entry: needs IELTS 7.0 (mock)", and the field degree where asked). The labelled case "What IELTS score do I need for this course?" is now answerable, changed on the developer's "fix all valid" before any live run. | `86b03e4` |
| LOW · `answers-panel.ts:178` · "asks for Not met: …" | Fixed. The course tile carries its IELTS score (`Tile.ielts`); the preview compares through `englishMeets` (moved to opening's `english.ts`, read by the course card too), so an exact score below it previews the broken condition, and the line reads "it asks for IELTS 7.0 overall". | `bd1db2a` |
| LOW · `eligibility.ts:50` · fallback above her level | Fixed. `eligibleRoads` returns her level or below even when empty; `matchRoad` then throws and `roadFor` draws the illustrative road. The why reads one road through `differencesFrom`. | `db8a27b` |
| LOW · `match-line.ts:8` · duplicated wording and constants | Fixed for the constant: `NOT_TAKEN` is defined once, in opening's `english.ts` (not `questions.ts`, which imports `english.ts`; that would be an import cycle), and every reader imports it. The stay wording stays local, as the finding allows: the chip says "(you said you're not sure)" where the why says "you said you might stay", and `match-line.ts` reads only the roads' client-safe API, while `STAY_REASON` sits in `why.ts`, which loads the catalogue. | `89d5ad1` |
| Follow-up (coordinator, from the report's concern) · a staying student on a no-clear-PR road got no Staying chip | Fixed. When she said Yes or Not sure and her road stays with no clear road to PR, the strip shows "Staying: this road has no clear road to PR (you said you'd stay)", and the match is no longer exact. In a tie, a stated Yes now prefers a staying road with a road to PR (after the open-entry rule). No demo profile's road changed and every candidate is still reachable; the sweep's exact share is 52.3% of the matchable answer sets (was 56.3%), all of the drop from the new chip (the tie rule alone moves it 0.0 points). Smoke step 15 updated. | "fix(roads): a staying student on a road with no clear PR is told so" |
| LOW · `candidates.ts:9` · catalogue copy in the client bundle | Left. Accepted at the plan review (plan-round2.md, R3's note on point Q): no secret in it, and the developer chose it over splitting the matching keys from the claim text. | — |

Open: criterion 88 (warm-up) is still unbuilt in this round, as the review's note says; 76–78 and 84–85 still need the developer's live runs.
