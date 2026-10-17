# Course finder stack (PR 1 finder, PR 2 course detail, PR 3 what changes): final review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 4 MEDIUM · 9 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/course-compare` at `cbabdba` over `origin/main` (`9317bda`) · 142 files, +76,335 −201 (about 63k of it generated: `catalogue.ts`, `raw/*.json`, the 0025 snapshot) · 17 Oct 2026 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · industry `DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed; the local pre-commit secret hook passed) · dependencies 0 new, 2 pre-existing · code N/A (not installed) |
| Not applicable | criteria 31–39 (PRs 4, 5 unbuilt) |
| Failed to load | none |
| Read outside the diff | 11, listed below |

Pre-existing, not this branch: `braces` (high) and `esbuild` (moderate) in `bun audit`. `bun.lock` is untouched; `package.json` gained scripts only.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | B | MEDIUM · `privacy/page.tsx:99` · feelings promise | scope the promise to onboarding |
| Performance | A | LOW · `feed-updates.ts:8` · catalogue on cold start | optional |
| fdd-architecture | B | MEDIUM · `RoadBoard.tsx:569` · focus lost | focus the box, return on Close |
| vercel-react-best-practices | A | LOW · `RoadBoard.tsx:7` · panel always shipped | optional |
| tailwind-v4-best-practices, DESIGN.md | A | — | — |
| Quality (CLAUDE.md) | B | MEDIUM · `useFinder.ts:99` · silent empty result | a message and a test |
| Criteria | B | MEDIUM · `intent.md:83` · four criteria unamended | amend the intent |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Switch off: no Find section | `RoadBoard.test.tsx` (Find courses), `finder/actions.test.ts` | covered |
| 2 | Box prefilled from study words and field | `finder/model/seed.test.ts`, `RoadBoard.test.tsx` | covered, as amended |
| 3 | Up to ten by similarity, with score and "sample data" | `finder/server/search.db.test.ts` | covered (data); card manual |
| 4 | Only courses passing level, destination, budget | `finder/model/filters.test.ts`, `useFinder.test.ts` | covered |
| 5 | Wildcard with definition | `search.db.test.ts` | covered (data); tag manual |
| 6 | Why checked (quote, figures, ranking), else template | `finder/model/why.test.ts`, `finder/server/why.test.ts`, `useFinder.test.ts` | covered |
| 7 | Results within 2 s, warm | — | not automatable |
| 8 | Under the floor: no cards, the message | `finder/server/search.test.ts`, `useFinder.test.ts` | covered |
| 9 | Fails or slow: "Couldn't search right now" | `finder/actions.test.ts` (timeout, retry) | covered, as amended |
| 10 | Limit says when she can search again | `finder/actions.test.ts` | covered |
| 11 | Logs hold outcome and timings, not her text | `finder/actions.test.ts` | covered |
| 12 | Q1–Q3 in the top three | `finder:eval` (`eval.md`) | manual, as amended |
| 13 | Negatives keep Cyberpsychology out | `finder:eval` | manual |
| 14 | 16 of 20 held-out; README states it | `finder:eval`, README | manual (19 of 20) |
| 15 | No shared content words | `finder/evals/queries.test.ts` | covered, as amended |
| 16 | Catalogue limits | `finder/data/catalogue.test.ts`, `finder/data/schema.test.ts` | covered |
| 17 | Visa and PR lines by rule | `catalogue.test.ts`, `finder/model/build.test.ts` | covered |
| 18 | Near-duplicates removed and counted | `finder/model/dedupe.test.ts`, build report | covered |
| 19 | Engine room contents | `useFinder.test.ts`, `search.db.test.ts` | covered (data); display manual |
| 20 | Keyword search beside meaning | `search.db.test.ts` | covered (data) |
| 21 | README "How it scales" | README | met (read) |
| 22 | Detail switch off: cards as today | `roads/model/details.test.ts`, `FinderPanel.test.tsx` | covered |
| 23 | Fields near and jobs on every course card | `details.test.ts`, `finder/server/detail.test.ts`, `FinderPanel.test.tsx` | covered |
| 24 | Job market (sample data), no employer | `roads/data/job-market.test.ts`, `FinderPanel.test.tsx` | covered |
| 25 | Compare switch off: tiles as today | `FinderPanel.test.tsx`, `finder/actions.test.ts` | covered; tiles manual |
| 26 | Board comparison rows | `finder/model/compare.test.ts` | covered |
| 27 | Compare with my roadmap on a found course | `finder/actions.test.ts`, `FinderPanel.test.tsx` | covered |
| 28 | PR route and work rights equal the road's | `compare.test.ts` (alternativeForCourse) | covered |
| 29 | New roadmap pinned, source unchanged | `roadmaps/actions.test.ts`, `roadmaps/server/roadmaps.test.ts`, `RoadBoard.test.tsx`, `compare.test.ts` (draftPin) | covered |
| 30 | Pinned course never offered by matching | `finder/model/road-courses.test.ts` | covered |
| 40 | Six demo roads unchanged | `roads/model/match.test.ts:58` (elsewhere) | covered |
| 41 | One switch off, the others work | — | manual |

"As amended": 2 (tag quotes, not raw own words, for the privacy promise), 9 (2 s, then one 5 s retry: Nikhil's decision 3), 12 (Q2 on actuarial studies) and 15 (topic words only) follow Nikhil's 17 Oct decisions, recorded in `review.md` and `eval.md` but not in `intent.md` (MEDIUM below); 13's "I love cooking" stops at the word-count gate and never reaches the model.

## Read outside the diff
- `git grep "roadFor("` — every caller outside tests passes `choices.pinned` and imports `finder/server/road-courses`; only `roads/evals/check-cases.ts` does neither, with no roadmap (risk 2).
- grep of `'use client'` files — only `RoadBoard.tsx:7` imports finder, through `finder/client` (panel and types); no client module reaches `finder/data/catalogue` (risk 2).
- `roadmaps/server/roadmaps.ts:343-428` — `createRoadmap` and `saveChoices` are the only writers of `choices`; no other copy path carries a pin (risk 5).
- `content/ai/prompts.ts:33,66` — DATA goes in a fenced JSON block after the injection rule, so her Find text is content, not instruction (`security-llm.md` §1).
- `.heubert/cf-fix1-brief.md:8` — the one 5 s retry is Nikhil's decision 3, not an implementer's choice (criterion 9).
- `opening/model/questions.ts:81-82`, `engine/catalogue.ts` `livingK` — budget options top out at 42k and living runs 20–28k (the empty-result MEDIUM).
- `roads/server/why-limit.ts:8` — `WHY_PER_HOUR` 60 also caps the finder's model calls, at three per search.
- `finder/server/search.db.test.ts:99` — the detail switch is tested on and off (PR 2 fix verified).
- `origin/main` migrations end at `0024_ai_setting`; 0025 is free.
- `roads/model/match.test.ts:58` — the demo-profile test exists and matching reads no finder course (criterion 40).
- `opening/components/OwnWordsBox.tsx:129` — `text-base` on a textarea is the repo's pattern, so the Find box's is not a finding.

## Findings, by file

### `src/features/finder/components/useFinder.ts`

**MEDIUM · line 99 · all ten fail, nothing said**
- What: when every one of the ten nearest courses fails a filter, the result is `results` with no card and `message` null, so the panel shows only a closed "How this was found".
- Why: this is common. Budget options stop at 42k and living costs run 20–28k, so a student who said "Fees and living" can pass no Master's at all (fees from 26k); she searches and sees a blank panel.
- Rule: Quality, errors surfaced, not swallowed (PR 1 review's blind spot, still open) · a test would have caught it: yes, a `useFinder` case with ten failing hits.
- Fix: when `shown` is empty, set a message such as "None of the closest courses fit your level, budget or destination; How this was found lists them", and test it.

### `src/features/road/components/RoadBoard.tsx`

**MEDIUM · line 569 · focus lost when Find opens and closes**
- What: the column's "Find courses" button unmounts as it opens the panel, and `closeFind` (line 299) moves no focus, so focus falls to the body both ways and never reaches the box.
- Why: a keyboard or screen-reader user loses her place on every open and close. The compare swap inside the panel handles focus; the entry point does not.
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, `document.activeElement` after Find courses and after Close.
- Fix: focus the textarea (or the panel title through `titleRef`) when Find opens, and return focus to the opener on Close; add both assertions to `RoadBoard.test.tsx`.

**LOW · line 7 · the panel ships with the finder off**
- What: `RoadBoard` imports `FinderPanel` statically, so every board bundle carries the panel, `useFinder` and the compare view whether `finder` is set or not.
- Why: small today, but it reaches every student for a part that is off by default.
- Rule: `vercel-react-best-practices` `bundle-conditional` · `performance.md` §5 · a test would have caught it: no.
- Fix: optional: load the panel with `next/dynamic` when `finder` is set.

### `src/app/(public)/privacy/page.tsx`

**MEDIUM · line 99 · the feelings promise and the Find box**
- What: the page promises that what she writes about how she feels is "never sent to the models that write explanations". Yet whatever she types into Find goes, as typed, to the embedding model and to `student_finder_why`, which writes an explanation. Only the prefill drops wellbeing tags.
- Why: the published promise is broader than what the code keeps.
- Rule: `security.md` §4, known risk 3 · a test would have caught it: no.
- Fix: scope the promise to the onboarding own-words boxes and say that Find sends what she types, or add one line under the Find box saying so.

### `docs/course-finder/intent.md`

**MEDIUM · lines 71, 83, 86, 92 · the contract is not amended**
- What: criteria 2, 9, 12 and 15 still read as first written (raw own words, failure past 2 s, Q2 Behavioural Economics, every content word). The code follows Nikhil's 17 Oct decisions: tag quotes, one 5 s retry, Q2 on actuarial studies, topic words only.
- Why: the intent is the contract a reviewer checks the PR against. As it stands, four criteria read as contradicted. PR 1's review asked that "the intent records it".
- Rule: criteria pass, done differently · a test would have caught it: no.
- Fix: amend the four criteria with each decision and its date.

### `src/features/roads/model/why.ts`

**LOW · line 363 · "from Find courses" on every pin**
- What: a pinned road's why says "you chose this course in <city> from Find courses". A pin also comes from the board's other-city and other-course tiles, through "Start a new roadmap from it".
- Why: a student who pinned from a board tile reads a reason that is not true.
- Rule: intent constraint "rules decide, the model explains" (its facts must be true) · a test would have caught it: yes, a why on a road pinned to a road course.
- Fix: say "you chose this course" without naming where, or store where the pin came from.

### `src/features/roads/model/details.ts`

**LOW · line 9 · roads imports a finder type**
- What: `CardDetails.compare` is typed with `Comparison` from `finder/model/types`, so roads depends on finder again, after PR 2 moved the job market into roads to break that edge.
- Why: the import is type-only, so there is no runtime cycle, but the boundary runs both ways again.
- Rule: `fdd-architecture` §2 · a test would have caught it: no.
- Fix: move `CompareRow` and `Comparison` to `roads/data/types.ts` beside `CourseJob`, and have finder import them from there.

### `src/features/finder/components/FinderPanel.tsx`

**LOW · line 7 · deep import of road's PanelHead**
- What: `PanelHead` comes from `@/features/road/components/PanelHead`, while the panel's other road pieces come through `road/client`.
- Why: it reaches into another feature's internals, the one place this stack still does.
- Rule: `fdd-architecture` §2 · a test would have caught it: no.
- Fix: export `PanelHead` from `road/client.ts` and import it there.

**LOW · line 50 · SampleTag copies MockTag**
- What: `SampleTag` redraws `MockTag`'s dashed tag by hand with other words.
- Why: two copies of one tag drift apart; plan task 13 said to use `MockTag`.
- Rule: Quality, duplicated logic · a test would have caught it: no.
- Fix: give `MockTag` a label prop and draw "sample data" with it.

### `src/features/road/components/CardDetails.tsx`

**LOW · line 36 · h2 sections inside an h3 card**
- What: in a found card, whose title is an h3 (`FinderPanel.tsx:239`), `CourseDetail` draws `JobMarketSection` and `FieldsNearSection`, whose titles are h2.
- Why: heading navigation reads those sections as siblings of the panel's title. This was PR 2's blind spot, and it is now confirmed.
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, a heading-level check on a found card.
- Fix: give `Section` a heading level: h2 on the board, h4 inside a found card.

### `src/features/updates/server/feed-updates.ts`

**LOW · line 8 · the catalogue is parsed on every server entry**
- What: this side-effect import, and the same one in `roadmaps/actions.ts`, `roadmaps/page.tsx`, `roads/server/ask.ts`, `why.ts` and `roadmap-road.ts`, parses the 1.4 MiB catalogue on each cold start, with every switch off.
- Why: cold-start cost grows with the catalogue. PR 3's record accepts it for now.
- Rule: `performance.md` §5 · a test would have caught it: no.
- Fix: follow-up: register the fallback lazily on the first `f-` lookup.

### `src/features/finder/evals/queries.ts`

**LOW · line 19 · Q2 is not independent of the held-out set**
- What: the new Q2 was written after the held-out results were recorded, and it paraphrases held-out query 13 ("working out the odds of things going wrong and putting a dollar figure on it").
- Why: Q2's rank 1 proves less than it appears to. `eval.md` says the cooking negative never reaches the model, but says nothing on this.
- Rule: eval honesty · a test would have caught it: no.
- Fix: say so in `eval.md`; optionally give the cooking negative a sentence of three content words.

### `docs/course-finder/deploy-checklist.md`

**LOW · lines 16, 89 · a checklist for PR 1 only**
- What: it merges `feat/student-tweaks` and `feat/update-topics` into `dev` and switches on `FINDER_ON` only. `COURSE_DETAIL_ON`, `COMPARE_ON` and PRs 2 and 3 are missing. `overnight.md` still says the Find panel is held and the held-out score is 17 of 20.
- Why: the runbook does not match the stack being merged.
- Rule: a doc that no longer matches · a test would have caught it: no.
- Fix: add the two switches with their rollback and today's merge order; update `overnight.md` or leave it out of the PR.

## Top 3 priority fixes
1. `src/features/finder/components/useFinder.ts:99`: say something when every nearest course fails her filters, and test it.
2. `src/app/(public)/privacy/page.tsx:99`: make the feelings promise match what the Find box sends.
3. `src/features/road/components/RoadBoard.tsx:569`: move focus into Find on open, and back to the opener on Close.

## Done well
- The 1.4 MiB catalogue stays on the server. One `server-only` module registers the fallback, every `roadFor` caller passes the pin and imports that module, and the browser gets only the panel and types.
- The pin's write paths hold. `boardChoicesSchema` strips a pin from board saves, the `jsonb ||` merge keeps the stored pin in the same statement (now run by `test:db`), `pinOf` is the one check for both the draft and Create, and a new pin needs the compare switch while a copy keeps its own.
- Privacy and limits are tested, not assumed. Each search writes one text-free log line, tests feed her words through an error's message and cause, the query cache is keyed by a hash of student and text, the why runs uncached, and all four actions refuse strangers, other students' roadmaps and a switch that is off.

## Built but not asked for
- Run records in the PR: `overnight.md`, the three `smoke*.md` files and the three earlier reviews.
- Pinned roads in the feed, Ask and the why, and sample IELTS figures for finder courses. No criterion names them, but a pinned board needs them to be consistent.

## Blind spots
- The empty-result case and focus on Find: a `useFinder` test with ten failing hits, and `document.activeElement` checks in `RoadBoard.test.tsx`, would have caught both.
- `docker build` with the new `bun build` of `scripts/finder-seed.ts` (it bundles `@google/genai`) was not run here. Build the image and run the seed job once against a scratch database before deploying.
- The UI was judged from the code at the CLAUDE.md widths, not from screenshots. Take screenshots at 360, 768, 1024, 1440 and 2560 of the Find panel, a found card with detail and What changes.
- Criterion 28 for the other-city tile: nothing ties `alternativeForCity` to the road that tile's swap draws.
- Cold start: the warm-up loads the embedding client, but the first request still parses the catalogue; criterion 7 is measured warm only.

---
Stack: TypeScript, Next.js App Router (server components, server actions, instrumentation), React 19 client components, Tailwind 4, Drizzle ORM on Postgres with pgvector, zod 4, `@google/genai` (Vertex embeddings and Gemini), Bun test with happy-dom, Docker on Cloud Run. Passes applied shallowly: pgvector performance (judged by row count), bundle size (judged from the import graph, not a build), the live eval (taken from `eval.md`) and the widths (judged from the code).

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed: PR 1 `f048b55` (empty-filter message, focus on open and close, privacy wording plus a line under the Find box, intent criteria 2, 9, 12, 13 and 15 amended, PanelHead through road/client, MockTag label, a negative with 3 content words, Q2 independence noted in eval.md, deploy checklist for all three switches, the Find panel lazy-loaded with `next/dynamic` in RoadBoard.tsx), PR 2 `911a0fa` (heading levels), PR 3 `978b8dc` (pin wording, CompareRow and Comparison moved to roads, overnight.md). Left, judged deliberate: the LOW at feed-updates.ts:8 (catalogue parsed on each server entry), a follow-up for lazy registration, as in review-pr3.
