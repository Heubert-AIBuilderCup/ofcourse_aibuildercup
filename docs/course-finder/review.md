# Course finder, PR 1 (`feat/course-finder`) — Code Review

**Request changes.** 2 CRITICAL · 2 HIGH · 7 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | CRITICAL `evals/queries.ts:20` criterion 12 fails (Q2 has no field, eval exits 1) · CRITICAL `evals/queries.test.ts:16` criterion 15 fails, all three checks skipped · HIGH `actions.ts:58` criterion 9: a search over 2 s is not refused, and nothing tests it · HIGH `actions.ts:57` criterion 11: a search logs no outcome or timing |
| Branch | `feat/course-finder` at `a3b0aef` over `origin/main` (`4e474c8`) · 74 files, +71377 −17 (52,853 of them in the generated `catalogue.ts`, plus about 11k in `raw/*.json`) · 17 Oct 2026 |
| Reviewed against | security · security-llm · performance · CLAUDE.md · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed; the local pre-commit hook passed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | security-web.md (no browser code) · task 13 display (not built) |
| Failed to load | none |
| Read outside the diff | 12, listed below |

The 2 pre-existing dependency advisories have nothing to do with this branch and do not count toward the decision: `braces` (high) and `esbuild` (moderate). `bun.lock` is untouched, and `package.json` only gained scripts.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-llm.md`) | B | MEDIUM · `server/embed.ts:79` · cross-student query cache | key the cache per student, hashed |
| Performance | B | MEDIUM · `server/search.ts:56` · unindexed full-text predicate | index it, or justify the scan |
| CLAUDE.md (test the brain) | B | MEDIUM · `roads/data/occupations.test.ts:13` · tautological test | delete the two bloat tests |
| `fdd-architecture` | B | MEDIUM · `src/features/finder/` · no `index.ts` public API | add `finder/index.ts` |
| Criteria | C | CRITICAL · criteria 12 and 15 fail | amend the intent, or fix the data |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Switch off: no Find section | `switch.test.ts:5`, `actions.test.ts:118` | logic covered; display not built |
| 2 | Prefill from own words plus field or areas | `model/seed.test.ts:18` | done differently; display not built |
| 3 | Up to ten, by similarity, with score and sample label | `server/search.db.test.ts:84` | logic covered; display not built |
| 4 | Only courses passing level, destination, budget | `model/filters.test.ts`, `search.db.test.ts:96` | covered |
| 5 | Wildcard with definition | `search.db.test.ts:112` | logic covered; display not built |
| 6 | Why checked: quote, figures, ranking; template | `model/why.test.ts`, `server/why.test.ts` | logic covered; display not built |
| 7 | Within 2 s, warm | — | not automatable (after deploy) |
| 8 | Under the floor: no cards, the message | `search.db.test.ts:122` | logic covered; message not built |
| 9 | Fails or takes over 2 s: "Couldn't search right now" | `actions.test.ts:155` (failure only) | partly uncovered |
| 10 | Limit says when she can search again | `actions.test.ts:138` | covered |
| 11 | Logs hold outcome and timings, not her text | `actions.test.ts:155`, `server/why.test.ts:75` | partly uncovered |
| 12 | Q1, Q2, Q3 in the top three | `bun run finder:eval` (manual) | contradicted (Q2) |
| 13 | Negatives keep Cyberpsychology out | `finder:eval` (manual) | covered (manual) |
| 14 | At least 16 of 20 held-out; README states it | `finder:eval` (manual), README | covered (17 of 20) |
| 15 | No demo query shares a content word with its course | `evals/queries.test.ts` (all skipped) | contradicted |
| 16 | Catalogue limits | `data/catalogue.test.ts`, `data/schema.test.ts` | covered |
| 17 | Visa and PR lines by rule | `model/build.test.ts` | covered for fixtures (see MEDIUM) |
| 18 | Near-duplicates removed and counted | `model/dedupe.test.ts`, build report | covered |
| 19 | Engine room data | `search.db.test.ts`, `server/why.test.ts` | logic covered; display not built |
| 20 | Keyword search beside meaning | `search.db.test.ts:106` | logic covered; display not built |
| 21 | README "How it scales" | README | covered (manual read) |

Notes on criteria 2 and 12–15:
- **Criterion 2.** The seed comes from her non-wellbeing study-step tag quotes, never from the raw own-words text. That differs from the criterion's wording, deliberately: the plan chose it so the privacy page's promise holds. The intent should say so.
- **Criteria 12–15.** The `finder:eval` figures are taken from `eval.md`. I could not rerun them, because the eval needs the live model. I did recompute criterion 15 on the committed catalogue, and it matches `eval.md`'s table exactly.

## Read outside the diff
- `src/shared/lib/auth/as-student.ts:20` — refuses signed-out users and non-students; its catch logs `err.cause`, which is not her text on these paths.
- `src/features/roadmaps/server/roadmaps.ts:230` — `getRoadmap` filters by `hers(userId, id)`, so another student's roadmap is refused.
- `src/app/(public)/privacy/page.tsx:95` — the feelings promise; `finderSeedText` keeps wellbeing tags and raw `ownWords` out.
- `src/features/content/ai/client.ts:79` — `CallLog.record` stores no prompt data, so the why's call log holds none of her text.
- `src/features/content/ai/models.ts:27` — the `student_` prefix caps `student_finder_why` at lite and flash.
- grep for `Record<UseCase` — 4 exhaustive maps (LISTED, SPECS, FakeAnswers, ModelsScreen tiers), all enforced by tsc.
- grep for `features/finder` and `'use client'` — nothing outside the feature imports it, and nothing in it is client code, so `catalogue.ts` reaches only the server.
- `.heubert/held-out.json` — the 20 entries match `HELD_OUT_QUERIES` exactly, text and expectations in order.
- grep of `raw/*.json` and `GENERATE.md` — none of the demo or negative phrases appears.
- `migrations/meta/_journal.json` — 0025's `when` is the newest and matches the undo file.
- `roads/data/fields.ts` grep — no behavioural-economics field, so Q2 cannot pass. Confirmed.
- `roads/model/{course-words,details,why}.ts` — every caller of `relatedFields` compares broad ids, and the new niche edges add no broad-to-broad link, so existing boards are unchanged.

## Findings, by file

### `src/features/finder/evals/queries.ts`

**CRITICAL · line 20 · criterion 12 contradicted**
- What: Q2 expects `behavioural-economics`, which no field in the graph has. `finder:eval` exits 1 in both recorded runs.
- Why: an acceptance criterion of this PR fails, and the plan's own stop rule says a failing eval stops PR 1 at task 14.
- Rule: intent criterion 12 · a test would have caught it: yes, the eval did.
- Fix: Nikhil decides and the intent records it. Either replace Q2 with a query for a field that exists, or add the field by hand and say that it was added by hand. Then rerun `finder:eval` and update `eval.md` and README.

### `src/features/finder/evals/queries.test.ts`

**CRITICAL · line 16 · criterion 15 contradicted, every check skipped**
- What: all three demo-query checks are `test.skip`. Q1's top hit, "Master of Cyber Psychology", shares "why" and "people" with the query. Q3's top hit shares "apps". I recomputed this against the catalogue and it matches `eval.md`.
- Why: the criterion exists to prove that the demo hits come from meaning; the rank-1 Q1 hit is exactly the course that shares words.
- Rule: intent criterion 15; a skipped test asserts nothing · a test would have caught it: yes, and it was skipped.
- Fix: amend the criterion (for example, "people" and "why" become stopwords, recorded in the intent) or regenerate those descriptions without steering. Then un-skip the tests.

### `src/features/finder/actions.ts`

**HIGH · line 58 · criterion 9: a slow search is not refused**
- What: the 2 s limit (`AbortSignal.timeout`, `server/search.ts:27`) covers only the embedding call. The two database queries, and the whole of a cached search, have no limit. No test covers a search that takes too long.
- Why: a 1.9 s embedding followed by a slow query returns results late instead of "Couldn't search right now", which contradicts the criterion's second half.
- Rule: intent criterion 9 · `performance.md` §3 · a test would have caught it: yes, a `searchCourses` mock that never resolves.
- Fix: race `searchCourses` against `SEARCH_TIMEOUT_MS` in the action and map a timeout to `SEARCH_FAILED`. Test it with the never-resolving mock.

**HIGH · line 57 · criterion 11: a search logs no outcome or timing**
- What: a successful search, a nothing-close result and a limit refusal leave no record at all. A failure logs only the error name. The embedding call bypasses the AI call log.
- Why: the criterion asks for the outcome and the timings in the logs. Without them nobody can measure criterion 7 or tell failures apart in production.
- Rule: intent criterion 11 · `security-llm.md` §5 · a test would have caught it: yes, a spy on the log for a successful search.
- Fix: log one line per search in the action, for example `[finder.search] results|nothing-close|limit|failed ms=… cached=…`, with no text. Assert it in `actions.test.ts`.

**LOW · line 53 · wrong message when the roadmap lookup fails**
- What: a database error in `getRoadmap` escapes to `asStudent`, which answers "Could not save. Please try again."
- Why: criterion 9 wants "Couldn't search right now" when the search fails.
- Rule: intent criterion 9 · a test would have caught it: yes.
- Fix: move the `getRoadmap` call inside the `try`.

**LOW · line 87 · shadowed name**
- What: `const text = finderWhyTemplate(...)` shadows the `text` parameter.
- Why: the reader has to check which `text` the code means.
- Rule: naming · a test would have caught it: no.
- Fix: rename it to `template`.

### `src/features/finder/server/embed.ts`

**MEDIUM · line 79 · her text kept in a cache shared across students**
- What: the query cache is one module-level `Map` for every student, keyed by her raw text (up to 500 entries). `cached: true` (line 88) then tells another student that someone on this instance typed exactly the same words.
- Why: personal text stays in plaintext in process memory, and the engine room's "cached" flag becomes a small cross-student oracle.
- Rule: `security.md` §4 · a test would have caught it: no, nothing asserts the cache is per student.
- Fix: key the cache by `sha256(userId + text)`, or by a hash of the text per student, so "cached" only ever reflects her own searches.

### `src/features/finder/server/search.ts`

**MEDIUM · line 56 · full-text predicate with no index**
- What: every search runs `to_tsvector(name || description)` over every row, and nothing says why a scan is acceptable. The vector scan's reason is in `schema.ts`; this one has none.
- Why: the cost grows linearly with catalogue rows, re-parsing every description on each search, and README promises scale.
- Rule: `performance.md` §4 · a test would have caught it: no.
- Fix: add a generated `tsvector` column with a GIN index in 0025, or a comment that an exact scan is accepted below 1,000 rows.

**LOW · line 75 · model name worked out in three places**
- What: the "fake, else `GEMINI_EMBEDDING_MODEL`, else `EMBED_MODEL`" rule is repeated here, in `scripts/finder-seed.ts:33` and in `scripts/finder-eval.ts`.
- Why: if the copies drift, seeded rows and search results name different models.
- Rule: duplicated logic · a test would have caught it: no.
- Fix: export `embedModelName()` from `embed.ts`.

### `scripts/finder-seed.ts`

**MEDIUM · line 66 · the embedding retry and worker pool are written three times**
- What: `tooMany`, `embedOne` and the four-worker loop appear here (66–90), in `scripts/finder-build.ts:62–84`, and as a third pool in `embed.ts:69`.
- Why: three copies of the backoff logic diverge silently.
- Rule: repetition (three or more) · a test would have caught it: no.
- Fix: one `embedAll(texts, task, { retries, onProgress })` in `embed.ts`, used by both scripts.

### `src/features/finder/data/catalogue.test.ts`

**MEDIUM · line 11 · nothing re-checks the committed catalogue's visa and PR lines**
- What: `catalogue.ts` freezes `lines.work`, `lines.pr` and `route` as they were on build day. `build.test.ts` checks the rules only on fixtures.
- Why: when a state list or `workRightsLine` changes, the 479 committed courses keep the old lines, which contradicts criterion 17 ("equal what the existing rules give").
- Rule: intent criterion 17 · a test would have caught it: yes, one that recomputes them.
- Fix: for every `FINDER_COURSES` row, assert that `lines.work.text` equals `workRightsLine(...)` and that `route` matches `routeFor(...)`.

### `src/features/roads/data/occupations.test.ts`

**MEDIUM · line 13 · a test that cannot fail**
- What: it compares `routeFor(occupationsFor(id), city, courseById(id)?.prScore)` with `stayingRoute(id, city)`, and `stayingRoute` is now exactly that expression.
- Why: test bloat. It does not pin the pre-refactor behaviour; the existing road tests and the identical diff do.
- Rule: CLAUDE.md, "test the brain" · a test would have caught it: no.
- Fix: delete this test. Keep `routeFor([], …)` only if it adds something.

### `src/features/finder/server/course-doc.db.test.ts`

**MEDIUM · line 60 · a test of pgvector itself**
- What: it checks that ordering by `cosineDistance` puts the axis-0 row first. That is the extension's behaviour, and `search.db.test.ts:84` already asserts the same ordering through the real query.
- Why: test bloat that adds a database round trip.
- Rule: CLAUDE.md, "test the brain"; the severity table's "test bloat" · a test would have caught it: no.
- Fix: delete this test. Keep the "extension installed" check, or fold it into `search.db.test.ts`.

### `src/features/finder/`

**MEDIUM · no `index.ts` · no public API for a new feature**
- What: the new feature has no `index.ts`, so task 13's `layout.tsx` and the board will reach into `actions`, `model/seed` and `switch` directly. The internal imports the finder makes into roads and opening follow the repo's own habit (349 such imports elsewhere), so they are not counted.
- Why: FDD rule 2. Without an index, task 13 can import `model/why.ts` into the client, and that file pulls in `roads/model/why.ts` and `courseById`. Once PR 3 adds the `FINDER_COURSES` fallback to `courseById`, that path also carries the 1.4 MiB catalogue.
- Rule: `fdd-architecture` §2 · a test would have caught it: no.
- Fix: add `finder/index.ts` (server: the actions, `finderOn`, `finderSeedText`) and `finder/client.ts` (types only), matching `roads/index.ts` and `roads/client.ts`.

### `src/features/finder/model/config.ts`

**LOW · line 9 · the floor was fitted on the held-out set**
- What: `FINDER_FLOOR` is the midpoint between the held-out hits and the nonsense strings, and the held-out score is then reported at that same floor.
- Why: the 20 queries are no longer fully held out. The effect is conservative (19 hits fell to 17), but README calls them "queries the catalogue never saw".
- Rule: eval honesty · a test would have caught it: no.
- Fix: say so in `eval.md` and README, or fit the floor on a separate set.

### `src/features/finder/data/catalogue.ts`

**LOW · Biome skips the file**
- What: at 1.4 MiB the file is over Biome's limit, so `bun run lint` warns and never checks it.
- Why: lint is not clean, and future edits to the file go unlinted.
- Rule: CLAUDE.md (Biome) · a test would have caught it: no.
- Fix: add it to `files.ignore` in `biome.json`, with a comment.

### `docs/course-finder/deploy-checklist.md`

**LOW · line 95 · a smoke step that cannot pass**
- What: step 6 tells Nikhil to expect Behavioural Economics in Q2's top three.
- Why: the step fails by design until criterion 12 is resolved.
- Rule: a doc that no longer matches · a test would have caught it: no.
- Fix: update it together with the Q2 decision.

### `src/features/finder/server/why.test.ts`

**LOW · line 119 · repeats the spec's literals**
- What: `toMatchObject({ tier: 'lite', maxTier: 'flash', temperature: 0.2, … })` re-states the constants. The cap is already pinned by `models.test.ts`.
- Why: minor test bloat.
- Rule: test bloat · a test would have caught it: no.
- Fix: keep the example and schema checks and drop the `toMatchObject`.

## Top 3 priority fixes
1. `evals/queries.ts:20`, `evals/queries.test.ts:16` — get Nikhil's decision on Q2 and criterion 15, record it in the intent, rerun the eval and un-skip the tests.
2. `actions.ts:58` — put a single 2 s deadline around the whole search, and test it with a mock that never resolves.
3. `actions.ts:57` — log one text-free line per search (outcome, ms, cached) and assert it.

## Done well
- **Privacy where it matters.** The seed never reads `ownWords` or wellbeing tags. The why runs with `cache: false`, and a test checks the store stays empty. The failure log prints only `err.name`, and a test feeds it an error whose message and cause hold her text. SQL takes her text only as a bound parameter.
- **Access is tested, not assumed.** Both actions are covered for signed-out users, non-students, another student's roadmap, a malformed id, the switch off, `STUDENT_AI_OFF`, text that is empty or too long, and the hourly limit.
- **The eval is honest.** The held-out set is verbatim from an isolated agent, the brief and raw data contain none of the demo queries, and `eval.md` reports its failures instead of tuning past them.

## Built but not asked for
- `courseDetailOn` and `compareOn` (`switch.ts`) exist for PRs 2 and 3, and nothing in PR 1 uses them.
- 213 of the 479 catalogue courses last one year. With no switch, the finder can show them before PR 5 (one-year courses) lands; the intent does not forbid this.

## Blind spots
- **Cold start.** The GoogleGenAI client and its credentials load on the first call, inside the 2 s limit (`embed.ts:42`). `finder-eval.ts:94` warms up before timing, so the eval cannot see this. Only a timed test of the first search on a fresh Cloud Run instance would show it.
- **Not run here.** `docker build` with the new `bun build` step for `dist/finder-seed.js`, plus type-check, lint and the suites, which `smoke.md` reports as passing. Run `docker build -t ofcourse .` before deploying.
- **Wellbeing tags are decided by a model.** A misread clause would land in the seed and be sent to the models. Only an eval of the own-words reading on feelings text would catch it.
- **When all ten nearest courses fail her filters**, the search returns `results` with no card to show. Task 13 needs a message for that case, and `useFinder.test.ts` should cover it.
- **The search limit is per instance.** It is counted in process memory, so on more than one Cloud Run instance it multiplies. This is a known pattern, shared with `why-limit.ts`.

---
Stack: TypeScript, Bun, Next.js server actions, Drizzle ORM on Postgres with pgvector, `@google/genai` (Vertex AI embeddings and Gemini), Docker and Cloud Run. Passes applied shallowly: performance of pgvector at scale (judged by row count, not measured); the live eval figures, taken from `eval.md` because they need the real model.

## Applied (17 Oct 2026)

Nikhil decided the two CRITICALs (Q2 swapped to actuarial studies; criterion 15 narrowed through a separate common-words list) and said "fix all valid". Fixed in `88dd1a5`, `0260d03` and `a2506b5`: both HIGHs (the whole search under the limit with one 5 s retry; one log line per search without her text), every MEDIUM (the search.ts:56 index finding answered with a comment, as an exact scan below 1,000 rows follows ADR-117) and every LOW. Also from his decisions: fewer than 3 content words answers "nothing close" without a search, the floor is 0.5, a warm-up call runs at server start, and Biome excludes the generated catalogue. None judged invalid. After the fixes `finder:eval` exits 0: Q1, Q2 and Q3 each rank first, the negatives pass, held-out 19 of 20.
