# Course finder stack, delta since the final review — Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 2 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | HIGH · `CourseDetail.tsx:27` · criterion 24's heading is gone from found cards · HIGH · `deploy-checklist.md:9-12` · PR 3 conflicts with update-topics in the planned merge order |
| Branch | `feat/course-compare` at `9a2befc` over `12554e9` · 41 files, +2,600 −262 (38 read in the diff, +961 −153; `catalogue.ts` and `raw/*.json` checked by script) · 17 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · industry `DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies N/A (not installed; no package or lockfile change) · code N/A (not installed) |
| Not applicable | `security-llm.md` (no prompt or model change) · criteria 31–39 (PRs 4, 5 unbuilt) |
| Failed to load | none |
| Read outside the diff | 11 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | LOW · `FinderPanel.tsx:179` · line omits explanations | optional |
| Performance | A | — | — |
| fdd-architecture | A | — | — |
| vercel-react-best-practices | A | — | — |
| CLAUDE.md (git, tests) | B | MEDIUM · stack history · co-author trailers | reword five commit messages |
| Honesty of the data | A | LOW · `field-occupations.ts:27` · nurse on informatics | optional |
| Criteria | C | HIGH · `CourseDetail.tsx:27` · criterion 24 heading | keep the heading words |
| Merge readiness | C | HIGH · `deploy-checklist.md:9` · conflict with update-topics | rebase PR 3, keep the pin |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Switch off: no Find section (lazy panel) | `RoadBoard.test.tsx` (Find courses) | covered |
| 2 | Prefill, as amended | `seed.test.ts` (unchanged) | covered, amended in intent |
| 5 | Combines, Fits both, route from primary only (amended) | `build.test.ts:127-174`, `search.test.ts:50-88`, `FinderPanel.test.tsx:71-90`, `catalogue.test.ts:94-203` | covered |
| 8 | No match, plus none passing her filters | `useFinder.test.ts:123` | covered |
| 9 | Failure with one 5 s retry, as amended | `actions.test.ts` (unchanged) | covered, amended in intent |
| 12 | Q1–Q3 in the top three | `eval.md` (intersections run) | manual, rank 1 each |
| 13 | Negatives, cooking with 3 content words | `queries.test.ts:29`, `eval.md` | covered and manual |
| 14 | 16 of 20 held-out | `eval.md` | manual, 19 of 20 |
| 15 | No shared topic words, as amended | `queries.test.ts` | covered |
| 17 | Visa and PR lines by rule | `catalogue.test.ts:185`, `build.test.ts:161` | covered |
| 23 | Fields near and jobs, by subject | `detail.test.ts:58-100`, `CourseDetail.test.tsx:20` | covered |
| 24 | Jobs under "Job market (sample data)" | `FinderPanel.test.tsx:163` now asserts "Information technology roles" | contradicted on found cards |
| 29, 30 | Pin wording true for tile pins | `road-for.test.ts:110`, `why.test.ts:256` | covered |

Raw edits touched `field`, `graphField` and, on the four security rows, `niche` (not only the first two). The generated catalogue differs from the reviewed one in exactly the 14 pinned courses plus the new `fields` key; no description changed.

## Read outside the diff
- `roads/data/fields.ts:252-311` — edge kinds are `is-a`, `combines`, `related`; `isBroad` keeps only the eight FieldIds (risk 2).
- `.heubert/intersections-pr1.md:24,37` — the brief counts `combines` and `is-a`, and defines `fitsBoth` over fields (risk 2, 3).
- `roads/model/match.ts:53-114` — `pickedFields` reads stated answers only; "IT and computing" reaches `it` and `cyber` (risk 3).
- Script over `catalogue.ts`, tip against `12554e9` — 14 courses differ; 72 have two or more subjects, none only `it`+`cyber`; `fields[0]` equals `Course.field` for all 479 (risks 3, 4).
- `git diff` of `raw/*.json` — two further `it`→`health` rows are near-duplicates the build drops (risk 4).
- `scripts/finder-seed.ts:37,73-113` — the embedding text is name and description; the upsert rewrites `field`, `graph_field`, `niche` on kept rows, so the no-embed reseed leaves `course_doc` consistent (risk 4).
- `finder/model/compare.ts:48-61`, `finder/server/road-courses.ts` — What changes and pinned roads read `occupationsFor`, the primary codes only (risk 1).
- `roads/data/occupations.ts` (224213, 254499, 272399) — Health Information Manager alone gives the informatics routes; psychology codes are on no list (risk 1).
- `git merge-tree` of `feat/update-topics` with each stack tip — PR 1 and PR 2 merge clean; PR 3 conflicts in `updates/server/feed-updates.ts` and its test (risk 6).
- `finder/server/search.ts:62-63` — keyword search is `plainto_tsquery` (every word), so the pitch's "a keyword search would never have found it" holds for her text.
- Focused runs at the tip: the 9 changed finder test files, 69 pass 0 fail; `RoadBoard`, `road-for`, `why` tests, 137 pass 0 fail.

## Findings, by file

### `src/features/finder/components/CourseDetail.tsx`

**HIGH · line 27 · criterion 24's heading dropped on found cards**
- What: each jobs section on a found card is titled `<Subject> roles`, so "Job market (sample data)" no longer appears there; the test that pinned it (`FinderPanel.test.tsx:163`) was rewritten to assert the new title. Criterion 23 puts found cards in scope, and the intent was not amended.
- Why: the contract says the sample figures sit under that heading. The "OfCourse sample data" source line still shows, so no figure is unlabelled, but the criterion as written now fails.
- Rule: criterion 24, done differently without an amendment · a test would have caught it: it did, and was changed.
- Fix: title each group `${g.name} roles · job market (sample data)` and restore the assertion, or have Nikhil amend criterion 24.

**LOW · line 31 · the caveat does not say which subject the route follows**
- What: the non-primary caveat reads "Roles in Cyber security may need your degree assessed for that field." Nothing on a Find card says the visa, work rights and PR follow Psychology.
- Why: a student who sees cyber roles with Hobart openings can still assume a cyber route. No screen states a non-primary route, so this is an omission, not a false claim (risk 1 holds).
- Rule: amended criterion 5 ("visa, work rights and PR follow its primary discipline only") · a test would have caught it: no, wording.
- Fix: "Your visa and PR route follow Psychology. Roles in Cyber security may need your degree assessed for that field."

### `docs/course-finder/deploy-checklist.md`

**HIGH · lines 9-12 · PR 3 conflicts with update-topics in this merge order**
- What: the checklist merges `feat/update-topics` first, then the stack. `feat/course-compare` then conflicts in `updates/server/feed-updates.ts` (`feedRoadmap`) and its test. Update-topics' version calls `roadFor` without `pinned`; PR 3's adds it.
- Why: GitHub refuses the merge until resolved. Taking update-topics' side silently drops the pin, so a pinned roadmap's feed reads the matched road's institutions and topics.
- Rule: risk 6, ready to merge · a test would have caught it: no; nothing tests a pinned roadmap in the topics feed.
- Fix: after update-topics lands, rebase PR 3 on main. Keep update-topics' shape (`courseTopics`, `interestTopics`, `hasRoad`) with `pinned: r.choices.pinned`, add a feed test for a pinned finder course, and say so in the checklist.

### Commit history (`origin/main..feat/course-compare`)

**MEDIUM · 5 commits · co-author trailers**
- What: `35ecaa1`, `9b5d876`, `260722c`, `ee348b5` and `cf09133` end with `Co-Authored-By`. The stack is 53 commits, not yet squashed per PR.
- Why: CLAUDE.md forbids co-author text, and a GitHub squash merge copies the trailers into main.
- Rule: CLAUDE.md §Git · a test would have caught it: no.
- Fix: squash each PR into one Conventional Commit without trailers before pushing.

### `src/features/road/components/CardDetails.test.tsx`

**MEDIUM · line 37 · repeated assertion**
- What: "take the level the exported sections are given" asserts `['H4', 'H4']` for the two sections at h4. `FinderPanel.test.tsx:168` asserts the same tags through the real path, `CourseDetail` in a card.
- Why: two tests pin one behaviour, so one change breaks both.
- Rule: CLAUDE.md "test the brain, not the beauty"; test bloat · a test would have caught it: n/a.
- Fix: delete it. Keep line 24's h2 default, which guards the board.

### `src/features/finder/server/search.ts`

**LOW · line 44 · "Fits both" counts fields, not her interests**
- What: `fitsBoth` is true when two of the course's fields are among `pickedFields`. One area, "IT and computing", reaches both `it` and `cyber`. No course is only `it`+`cyber` today (checked), and "both" also shows for a student with three areas.
- Why: a future `it`+`cyber` intersection would tell a one-interest student it fits "both your interests".
- Rule: amended criterion 5 ("more than one of her interests") · a test would have caught it: yes, a hit with fields `it`, `cyber` and the one area.
- Fix: count her stated areas (or her one field) that reach any of the course's fields, and require two.

### `src/features/finder/data/field-occupations.ts`

**LOW · line 27 · health informatics now lists Registered Nurse**
- What: the seven informatics courses take every `health` code, so their Health roles include Registered Nurse and Community Worker. The three cyberpsychology courses, a TAFE diploma among them, list Psychologists nec.
- Why: those are jobs the courses do not lead to. The routes are still right (224213 alone gives them; psychology is on no list), so only the career lines overstate.
- Rule: intent constraint "rules decide" (its facts must be true); pre-existing per-field rule, newly applied here · a test would have caught it: no.
- Fix: follow-up: an occupation list per niche graph field (informatics → 224213, IT codes), with the broad field as the fallback.

### `src/features/finder/components/FinderPanel.tsx`

**LOW · line 179 · the line under the box leaves out the explanations**
- What: "What you type here is sent to Google's AI to find courses." Her text also goes to the model that writes each why, as the privacy page now says.
- Why: the in-place notice is narrower than what happens.
- Rule: `security.md` §4 · a test would have caught it: no.
- Fix: "…sent to Google's AI to find courses and explain them."

### `docs/course-finder/review-final.md`

**LOW · line 207 · Applied names pre-restack commits**
- What: it cites `d7a2d71` and `c5bdd2d`; on the branches they are `260722c` and `cf09133`. It also omits the lazy panel fix (`RoadBoard.tsx:61`).
- Why: anyone following the record lands on commits that are not in the pull requests.
- Rule: a comment that no longer matches · a test would have caught it: no.
- Fix: replace both hashes and add the lazy panel.

### `docs/hackathon/pitch.md`

**LOW · lines 95, 120 · two claims wider than the eval**
- What: "negatives never return Cyberpsychology" rests on two negatives; "fewer than three words never searches" is three content words.
- Why: judges read the deck as measured results.
- Rule: eval honesty · a test would have caught it: no.
- Fix: "both negatives keep Cyberpsychology out of the top 3"; "fewer than three content words".

## Top 3 priority fixes
1. `src/features/finder/components/CourseDetail.tsx:27` — keep "job market (sample data)" in each group's title and restore the assertion, or amend criterion 24.
2. `docs/course-finder/deploy-checklist.md:9-12` — rebase PR 3 after update-topics, keep `pinned` in `feedRoadmap`, add the pinned-feed test.
3. Stack history — squash each PR without the five `Co-Authored-By` trailers.

## Done well
- The subjects rule is one pure function. `build.test.ts` pins every edge case (related ignored, `is-a` counted, non-FieldIds dropped, primary first), and `catalogue.test.ts` pins the 14 reclassified courses and their primary-field routes against the committed file.
- Every road surface follows the primary only. Compare, pinned roads and the board read `occupationsFor`; only the Find card's fold shows other subjects, with a caveat.
- The final-review fixes are real and tested: the none-fit message, focus on open and on close (three openers, plus a fallback when the opener is gone), the lazy panel, h4 sections and the honest pin wording.

## Built but not asked for
- "Subjects:" per hit in the engine room (`FinderPanel.tsx:340`).
- The pitch rework: scene 2 moved off the removed `/futures`, and the deck slides.

## Blind spots
- The update-topics merge: a feed test with a pinned finder course would catch a dropped `pinned`.
- `bun run type-check`, `bun run lint`, the full suite and `bun run test:db` were not run here. Run them on each of the three branch tips after the squash (the pre-commit hook ran type-check per commit).
- `fitsBoth` with one two-field area: a `subjectsOf` test with fields `it`, `cyber` and only "IT and computing".
- Eval and the seeded `course_doc` are taken from `eval.md`; production is first seeded at deploy (checklist step 4).
- The Combines line and tag were judged from code; check them at 360 and 1440 in the smoke test.

---
Stack: TypeScript, Next.js App Router (server actions, `next/dynamic`), React 19 client components, Tailwind 4, Drizzle on Postgres with pgvector, Bun test with happy-dom. Passes applied shallowly: none in code; the live eval and pitch figures were taken from the docs, not rerun.

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed: PR 1 `f7c9d4a` ("Fits both" counts her interests; health informatics leads to Health Information Manager and IT roles, rebuilt by rules, reseeded with nothing re-embedded, eval unchanged; the line under the Find box says "find courses and explain them"), PR 2 `2217da2` (found cards keep "Job market (sample data)" beside each subject; "Your visa and PR route follow <Primary>." once on combined courses; repeated test deleted), PR 3 `e12d074` (review-final hashes; two pitch claims narrowed). The merge-order HIGH is fixed by stacking update-topics on top of PR 3, with the feed reader keeping both the topics and the pin. The co-author trailers go when each branch is squashed before the push. None judged invalid.
