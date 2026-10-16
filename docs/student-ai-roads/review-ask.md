# Student AI roads, Part B (Ask) — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 4 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/student-roads-ask` at `fac87a4` over `1e91c5f` (Part A's tip) · 19 files, +1560 −17 · 2026-10-15 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | tailwind-v4-best-practices (not loaded: TileAsk's classes checked against CLAUDE.md's token rules and the card's existing classes) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | B | MEDIUM · `server/ask.ts:50` · cap race | Reserve the row under a lock |
| Performance | A | — | — |
| CLAUDE.md | B | MEDIUM · `TileAsk.test.tsx:91` · test bloat | Delete the repeated test |
| vercel-react-best-practices | A | — | — |
| fdd-architecture | A | LOW · `RoadCard.tsx:6` · deep import | optional |
| Criteria | B | MEDIUM · `model/ask.ts:166` · her figures refused | Count her answers' figures too |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1–20 | Roads, re-matching, why | — | not in this branch |
| 21 | 3 or 4 suggested questions | `model/ask.test.ts:62`, `TileAsk.test.tsx:55` | covered |
| 22 | Suggested answer, its source, no call | `TileAsk.test.tsx:55` | covered |
| 23 | Typed: rows and her answers only, cited, mock | `server/ask.test.ts:157`, `TileAsk.test.tsx:73` | covered, done differently |
| 24 | No data: the exact refusal | `server/ask.test.ts:180`, `model/ask.test.ts:181` | covered |
| 25 | Instruction attempts still follow the rules | `server/ask.test.ts:201` | covered, narrowly |
| 26 | Daily cap message; suggested still work | `server/ask.test.ts:214`, `asks.test.ts:81`, `TileAsk.test.tsx:98` | covered |
| 27 | Logged; never a web search | `asks.test.ts:66`, `server/ask.test.ts:269` | covered |
| 28 | Failure: could not answer now | `server/ask.test.ts:233`, `TileAsk.test.tsx:113` | covered |
| 29–53 | Cards, own words, posts, feed | — | not in this branch |

Criterion 23 refuses any figure that comes from her own answers, though the criterion lets the reply use her answers (finding below). Criterion 25's test passes because of the ranking-word check, which the "best" test already proves; the question text never reaches the stubbed provider's logic. The three unit files ran here (45 pass). `asks.test.ts` needs the database and was not run here.

## Read outside the diff
- `src/shared/lib/db/schema.ts:558` — `student_ask` cascades on the user and the roadmap; the `(user_id, day)` index backs `countAsksToday`.
- `src/shared/lib/auth/as-student.ts:21` — the user comes from the session, non-students are refused, and errors are logged rather than thrown.
- `src/features/roadmaps/server/roadmaps.ts:99,163` — `getRoadmap` filters on her id, finished and not deleted, so ownership is enforced.
- `src/features/roadmaps/server/roadmaps.ts:189` — deleting a roadmap only sets `deletedAt`, so its ask rows stay.
- `src/features/roads/model/road-for.ts:26,37` — the switch and the illustrative fallback give `spec: null`, so `askTile` refuses on the server too.
- `src/features/content/ai/client.ts:130,305-462` — the flash, flash, pro ladder with a 12 s timeout per rung; the cache key includes DATA; the `ai_call` row holds no prompt data.
- `src/features/content/ai/prompts.ts:55` — DATA goes in fenced JSON after `INJECTION_RULE` in the user turn.
- `src/features/content/ai/calls.ts:40` — the advisory-lock reserve pattern that the student cap does not follow.
- `src/features/road/components/RoadBoard.tsx:339,375`, `PhoneRoad.tsx:104` — each RoadCard is keyed by its tile, so TileAsk's state resets per tile; the phone's inline card gets the ask for `scene.here`.
- `git grep` at `1e91c5f` — 164 cross-feature imports already reach into another feature's internals.

## Findings, by file

### `src/features/roads/server/ask.ts`

**MEDIUM · line 50 · daily cap bypassed by parallel requests**
- What: `countAsksToday` runs before the model call and `recordAsk` runs after it, with up to three rungs of 12 s between them and no lock. Parallel questions from one student all read the same count and all go through.
- Why: the per-student cap is the only bound on flash spend for Ask. Rejected answers climb to Pro, and Pro's daily cap is shared with the admin tools, so one student scripting the action can use up the admins' Pro budget for the day.
- Rule: `security.md` §8, `security-llm.md` §3 (spend limits on every loop that calls a model) · a test would have caught it: no, nothing fires concurrent asks against the database
- Fix: reserve the slot before the call, as `calls.ts:40-70` does. In one transaction, take `pg_advisory_xact_lock(hashtext('student_ask:' || user || ':' || day))`, count, insert a placeholder row, then update its reply and outcome after the call. Add a DB test that fires cap+5 parallel asks with a slow fake and expects exactly cap answers.

### `src/features/roads/model/ask.ts`

**MEDIUM · line 166 · figures from her own answers are refused**
- What: `askProblems` only allows figures found in the rows. A reply that uses her budget ("your AUD 24k budget covers Perth's AUD 21k") fails on every rung and becomes "I don't have that in our data."
- Why: criterion 23 lets the reply use her answers, and `whyProblems` already allows their figures. Asking "Can I afford it?" is one of the most likely questions, and the reply would wrongly say the data cannot answer it. smoke.md item 5 asks for a decision that the intent has already made.
- Rule: intent criterion 23 · a test would have caught it: yes, an answered case whose reply quotes an answer's figure
- Fix: pass `facts.answers` into `askProblems` and add `numbersIn(answer)` to `known`, as `whyProblems` does. Add that case to `ask.test.ts` and `server/ask.test.ts`.

### `src/features/roads/server/ask.test.ts`

**MEDIUM · line 201 · the criterion-25 test repeats the ranking test**
- What: the stubbed provider ignores the question, so this test runs the same path and assertion as "refuses when every rung calls something best" (line 187) with different words in the question.
- Why: it reports criterion 25 as proven while testing nothing that line 187 does not already test. The real defence (the question only inside fenced DATA, after `INJECTION_RULE`) is never asserted.
- Rule: CLAUDE.md "test the brain" (test bloat) · a test would have caught it: n/a
- Fix: make it assert the defence. Capture `req.user` and `req.system` in the stub, then check that the injection text appears only inside the DATA block and never in `system` or the instruction, and that `INJECTION_RULE` comes before DATA.

### `src/features/roads/components/TileAsk.test.tsx`

**MEDIUM · line 91 · repeated pass-through test**
- What: "shows the refusal as it came" checks that a non-answered reply's text renders, which "when the model failed" (line 113) already checks through the same branch.
- Why: it is a second test for the same rendering of passed-in data.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a
- Fix: delete it.

### `src/features/roads/actions.ts`

**LOW · line 18 · the question is unbounded at the edge, and its bound is defined three times**
- What: `questionSchema` is `z.string()`. The 300 limit lives in `server/ask.ts:24`, again in `TileAsk.tsx:20`, and in the tests.
- Why: §2 asks for validation at the edge with one definition, and the copies can drift.
- Rule: `security.md` §2 · a test would have caught it: no
- Fix: use `z.string().trim().min(1).max(ASK_QUESTION_MAX)`, with the constant in one dependency-free module (see the next finding).

### `src/features/roads/components/TileAsk.tsx`

**LOW · line 25 · ASK_FAILED copied into the client**
- What: the failure message is copied so the catalogue stays out of the browser bundle. The reason holds (`model/ask.ts` imports the whole catalogue), and `TileAsk.test.tsx:128` pins the two together.
- Why: it is still two sources for the same text.
- Rule: quality, duplicated logic · a test would have caught it: yes, it does
- Fix: move `NO_DATA`, `ASK_FAILED`, `ASK_CAPPED` and the 300 limit into a leaf `model/ask-words.ts` with no imports, used by both the server code and TileAsk.

### `src/features/roads/server/asks.ts`

**LOW · line 21 · personal free text, retention unnamed**
- What: each row stores her question (up to 300 characters of free text) and the reply. Rows cascade when her account or the roadmap is hard-deleted, but stay when she deletes a roadmap (soft delete only), and `ai_cache` keeps the reply under a hash of her question with no link to her account.
- Why: §4 and §6 ask that a new store of personal data say who reads it and what deletion leaves behind.
- Rule: `security.md` §4, §6 · `security-llm.md` §5 · a test would have caught it: no
- Fix: in the PR, name `student_ask` as personal data read by admin Insights, and decide whether soft-deleted roadmaps' asks are purged.

### `src/features/road/components/RoadCard.tsx`

**LOW · line 6 · cross-feature internals**
- What: `RoadCard` imports `@/features/roads/components/TileAsk`, the layout imports `@/features/roads/model/ask` and `data/types`, and `TileAsk` imports `@/features/road/components/MockTag`.
- Why: `fdd-architecture` §2 requires imports through `index.ts`. The repo already does this 164 times at the base and CLAUDE.md does not require the index, so project practice wins here.
- Rule: `fdd-architecture` §2 · a test would have caught it: no, a convention
- Fix: optional. Export them from `roads/index.ts` only if the project adopts the rule, and keep catalogue-free paths out of that index.

## Top 3 priority fixes
1. `src/features/roads/server/ask.ts:50` — reserve the ask under an advisory lock before the model call.
2. `src/features/roads/model/ask.ts:166` — allow figures from her answers, as the why check does.
3. `src/features/roads/server/ask.test.ts:201` — assert that the question stays inside DATA; delete `TileAsk.test.tsx:91`.

## Done well
- The access path is tight. `asStudent` and `getRoadmap` (hers, finished, alive), the tile checked against `ASK_SLOTS` and the switch re-checked on the server all run before any model call. The action tests prove a non-student, a non-owner, a bad id and an empty question make no call.
- The model is kept on a short leash: `generateJson` only (with a spy proving `searchJson` is never called), a strict schema, citations limited to the ids given, figures limited to the rows, ranking words rejected, an exact refusal string, and a clear rule separating refused from failed.
- The why checks were refactored surgically (`rankingWords`, `numbersIn`, `courseFacts`, `answerLines`) so Ask reuses one rule set. The rule that every road's city and course tiles have 3–4 asks is tested, and the catalogue gap it exposed was fixed (`uow-cyber`).

## Built but not asked for
- Nothing beyond the criteria. `docs/student-ai-roads/smoke.md` is the handover document for all five branches.

## Blind spots
- An injected question that gets the model to make claims not in the data, with no figures and no ranking words, still passes `askProblems` when it cites a real row. Only an evaluation run against real Gemini with adversarial questions would catch this.
- Figures written as words ("twenty-one thousand") get past the figure check. A unit case in `ask.test.ts` would pin whichever behaviour is chosen.
- The cap under concurrency needs a database test with parallel calls. `asks.test.ts` itself was not run in this review; run it by path with `DB_TESTS=1` before the PR.

---
Stack: TypeScript, Next.js (App Router, server actions), React client components, Drizzle on Postgres, Zod, Gemini via the project's Vertex layer, bun test with happy-dom. Passes applied shallowly: none.

## Fixes applied

Branch rebased onto Part A's fixed tip (`feat/student-roads` at `7194e03`) first; the line numbers above are from before the rebase. `TileAsk` now lives in `src/features/road/components/` beside the other board pieces Part A moved there.

| Finding | Status | Commit |
| --- | --- | --- |
| MEDIUM · `server/ask.ts:50` · daily cap bypassed by parallel requests | Fixed. `reserveAsk` counts and inserts her row in one transaction under `pg_advisory_xact_lock(hashtext('student_ask:<user>:<day>'))`, before the model call; the row reads `failed` (with `ASK_FAILED`) until `settleAsk` writes the reply and outcome, so a call that never returns is logged as what she saw. `recordAsk` and `countAsksToday` are gone. DB test: cap + 5 reservations sent at once give exactly cap slots and cap rows (it gave 8 of 8 without the lock). | `c4e65b2` |
| MEDIUM · `model/ask.ts:166` · figures from her own answers are refused | Fixed. `askProblems(v, facts)` takes the rows and her answers and allows figures from both, as `whyProblems` does. Cases in `ask.test.ts` and `server/ask.test.ts`. `smoke.md` item 5 now says it is decided. | `4da17cc` |
| MEDIUM · `server/ask.test.ts:201` · the criterion-25 test repeats the ranking test | Fixed. The test captures `system` and `user`: the injection text is never in `system` or before DATA, appears once inside the fenced DATA block, and the instruction and the DATA rule come before it. Checked by moving `INJECTION_RULE` after DATA in `buildPrompt`: the test fails. | `2bf897e` |
| MEDIUM · `TileAsk.test.tsx:91` · repeated pass-through test | Fixed. Deleted. | `2bf897e` |
| LOW · `actions.ts:18` · the question is unbounded at the edge | Fixed. `z.string().trim().min(1).max(ASK_QUESTION_MAX)`; `askTile` and the box read the same constant. | `5452287` |
| LOW · `TileAsk.tsx:25` · ASK_FAILED copied into the client | Fixed. `NO_DATA`, `ASK_FAILED`, `ASK_CAPPED`, `ASK_QUESTION_MAX` and `AskReply` live in `model/ask-words.ts` (no imports), used by the server and, through `roads/client.ts`, by the card. | `5452287` |
| LOW · `server/asks.ts:21` · personal free text, retention unnamed | Left, as instructed: how long `student_ask` rows are kept, and whether a soft-deleted roadmap's asks are purged, is the developer's product decision. For the PR: `student_ask` holds her question and the reply (personal data), is read by admin Insights, cascades on a hard delete of her account or the roadmap, and stays on a soft delete; `ai_cache` keeps the reply under a hash of the question. | — |
| LOW · `RoadCard.tsx:6` · cross-feature internals | Fixed with Part A's entry points. The board (`RoadBoard`, `RoadCard`, `TileAsk` and its test) imports the roads only through `@/features/roads/client`; `TileAsk` is inside the road feature, so `MockTag` is a local import. The layout takes `ASK_SLOTS`, `suggestedAsks` and `TileAsk` from `@/features/roads`; its `actions` and `server/roadmap-road` imports stay deep, as Part A's do. | `5452287` |

Also fixed, outside the findings: `askFacts` takes her roadmap tags and gives the model only those with `wellbeing: false` (ADR-088: wellbeing statements are for support content only). Pinned in `ask.test.ts`. Commit `e8fbec5`.

Not changed here, as it is Part A's file: `server/why.ts` still passes every tag, wellbeing ones included, to the why prompt (`roadmap.tags.map((t) => t.text)`), so the same rule needs applying there.
