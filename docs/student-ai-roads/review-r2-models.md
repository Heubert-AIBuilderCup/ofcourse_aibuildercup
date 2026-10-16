# Story 15, the Models page (M1–M4): Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 5 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/admin-model-settings` at `85e0c5f` over `fc2bd8d` · 24 files, +4980 −158 (22 reviewed, +2734 −158, the migration meta left out as generated) · 2026-10-16 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` · `industry/DESIGN.md` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (none added) · code N/A (semgrep not installed) |
| Not applicable | vercel-composition-patterns (not in dispatch) · story 1–14, 16 criteria (not this branch) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | B | MEDIUM · `client.ts:575` · fallback outside the cap | reserve or reuse the slot |
| CLAUDE.md | A | LOW · `page.tsx:26` · page errors without table | correct the deploy note |
| vercel-react-best-practices | A | LOW · `ModelsScreen.tsx:327` · stale choice state | optional |
| tailwind-v4 + DESIGN.md | A | LOW · `ModelsScreen.tsx:126` · `gap-8` between blocks | optional |
| fdd-architecture | B | MEDIUM · `actions.ts:25` · tier list ×3 | export one `TIERS` |
| Criteria | B | MEDIUM · `test-call.ts:143` · Test climbs the ladder | one rung per Test |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 90 | page lists use cases, tiers, source, last error | `ModelsScreen.test.tsx:101`, `:172` | covered |
| 91 | student and signed-out refused | `actions.test.ts:75`, `:82` | covered (actions); page by the shared guard |
| 92 | admin sees no Test/Change/Reset, actions refuse | `ModelsScreen.test.tsx:84`, `actions.test.ts:98` | covered |
| 93 | Test: one live call, cache off, result line; Test all student calls | `test-call.test.ts:104`, `ModelsScreen.test.tsx:128`, `:201` | covered, done differently (finding) |
| 94 | known models only, save after a passing test, next call | `actions.test.ts:148`, `:182`, `client.test.ts:775`, `settings.test.ts:150` | covered |
| 95 | allowed tiers only; student never Pro; art image only | `models.test.ts:51`, `actions.test.ts:198`, `client.test.ts:765`, `ModelsScreen.test.tsx:122` | covered |
| 96 | 404/403 retried once on env model, logged, red mark | `client.test.ts:793`, `settings.test.ts:115`, `ModelsScreen.test.tsx:172` | covered (mark can land on the wrong model, finding) |
| 97 | Reset with confirmation clears every choice | `actions.test.ts:226`, `settings.test.ts:102`, `ModelsScreen.test.tsx:190` | covered |
| 98 | log: who, when, what, old, new; last 20 | `settings.test.ts:76`, `:136`, `ModelsScreen.test.tsx:211` | covered |
| 99 | nothing saved: as before | `client.test.ts:731`, `:867`, `:879`, `:985` | covered |

Criterion 91's page path is guarded by the proxy (`/admin/:path*`), the console layout's `requireBoard` and the page's `requireAdmin`, the same as `/admin/users`; no test names `/admin/models` (CLAUDE.md: pages get no unit tests, no new e2e unless asked). Criterion 93's "8 calls" are 5 here (`CHECK_CASES` on this branch) and become 8 at the merge with own words, as the plan says. `settings.test.ts` runs only with `DB_TESTS=1`.

## Read outside the diff
- `src/features/content/ai/client.ts:159` — ladders: `pro` is `['pro','pro']`, `flash` is `['flash','flash','pro']`; settled what an override Test's second rung does.
- `src/features/content/ai/recording.ts:24` — the budget refuses inside `provider.json`, after `generateJson` has reserved and before it records a failed row.
- `src/features/content/ai/calls.ts:40` — a cap counts every non-cached row of the tier (or the search use cases) that day, failed rows included.
- `src/features/roads/evals/check-cases.ts:53` — the student check cases pass `cache: false`.
- `src/features/content/ai/config.ts`, `src/shared/lib/site.ts` — no imports; the client screen's value imports are client-safe (risk 6 settled).
- `src/features/content/ai/vertex.ts` — no catch; the `ApiError` and its numeric `status` reach `isModelUnavailable` unchanged.
- grep of `fallback` across `src` — no reader branches on `ai_call.fallback` values; `'env-default'` breaks no consumer.
- `src/app/admin/(console)/layout.tsx:17`, `src/proxy.ts:71`, `src/shared/lib/auth/session.ts:77` — page guard chain for criterion 91.
- `src/features/admin/hooks/useAdminAction.ts` — toasts and refreshes; the screen's inline-error `useRun` is a different shape, not duplication.
- `src/app/admin/(console)/users/page.tsx` — pages import feature internals (`@/features/admin/users/actions`); the new page follows the repo's pattern.

Unverified: whether `getSession()` refuses a suspended superadmin inside the actions (the proxy validates suspension on `/admin/*` requests, which server action POSTs pass through).

## Findings, by file

### `src/features/content/ai/client.ts`

**MEDIUM · line 575 (also 709, 797) · fallback outside the cap**
- What: when a saved Pro, image or search model 404s, the reserved row is settled as failed and the retry on the environment's model is written as a second row through `record()`, with no reservation. The comment says the retry "stays within the slot reserved for it"; it does not.
- Why: caps count every non-cached row (`calls.ts:53`), so each such call takes two slots, and at the last slot the retry runs with no cap check and goes one over (more under concurrency); risk 1's "caps still counted by tier" holds only loosely.
- Rule: `performance.md` §3, `security-llm.md` §3 (spend limits) · a test would have caught it: yes, a call log at `cap - 1` with a 404 saved model, asserting the retry is refused or reuses the slot.
- Fix: reserve a slot for the retry and return `DAILY_LIMIT` when refused, or keep one row: log the 404 attempt through `logCall` only and settle the reserved row with the environment's model and `fallback: 'env-default'`. Correct the comment either way.

**LOW · line 317 · failed reads are not remembered**
- What: with the table missing (or the database refusing), every AI call runs a failing `select` and prints a warning; nothing remembers the failure for the 30-second window.
- Why: in the deploy window the deploy note allows, every student and admin call pays a failed round trip and a log line.
- Rule: `performance.md` §2 · a test would have caught it: no, behaviour is correct, only repeated.
- Fix: in `settings.ts`, on a failed read keep the empty settings in `memory` for the TTL.

### `src/features/content/ai/settings.ts`

**MEDIUM · line 117 · the failing mark lands on the new model**
- What: `markFailing(tier, error)` updates `tier:<tier>` whatever model it now holds. An instance still on its 30-second copy, or a call in flight across a save, that 404s on the old model marks the newly saved model as failing.
- Why: right after the superadmin fixes a broken model (the scenario story 15 exists for), the page shows a red "Falling back" on the healthy replacement until it is saved again.
- Rule: criterion 96 · a test would have caught it: yes, save model A, call `markFailing` for a call that ran on B, expect no mark.
- Fix: pass the failed model and add `and value = <that model>` to the `where`; `client.ts` already knows it at the `reportFailing` call.

### `src/features/admin/models/test-call.ts`

**MEDIUM · line 143, 195 · an override Test runs a phantom second rung**
- What: the pinned spec for a Flash or Pro probe keeps its ladder's second rung (`['flash','flash']`, `['pro','pro']`). When the first attempt fails, `generateJson` moves on, reserves a Pro slot (on `pro`), and records a failed `ai_call` row under the saved or environment model, before the recording budget of 1 refuses the provider.
- Why: a failing Pro probe in `saveTierModelAction` takes two Pro slots for one live call (risk 4), and the call log shows a failure on a model that was never called, which skews the Insights figures.
- Rule: `performance.md` §2, criterion 93 · a test would have caught it: yes, assert `rows.length === 1` in the failing override test at `test-call.test.ts:145`.
- Fix: let a call with `req.model` stop after its first rung in `client.ts`, or give `pinned()` a one-rung spec, so the budget is never what stops it.

**MEDIUM · line 143 · a Test climbs the ladder (criterion 93)**
- What: a Test without an override runs with `MAX_ATTEMPTS = 6`: a use case on Flash whose answer fails validation retries, then reaches Pro, and the row shows "Passed on <pro model>".
- Why: criterion 93 asks for exactly one live call, and the Test is the health check for that use case's tier; passing on Pro hides that its own tier failed. The plan reads "one call" as one `generateJson` and accepts Pro, but the intent is the contract.
- Rule: criterion 93 · a test would have caught it: yes, `test-call.test.ts:129` already shows three requests for one Test.
- Fix: pin the Test to the use case's start tier with one rung (as the override path should be), or have Nikhil amend criterion 93 to the plan's reading.

### `src/features/admin/models/actions.ts`

**MEDIUM · line 25 · the tier list and limits repeated**
- What: `['lite','flash','pro','image']` is declared in `actions.ts:25`, `settings.ts:23` and `ModelsScreen.tsx:39`; `ERROR_MAX = 500` in `recording.ts:12`, `test-call.ts:88`, `settings.ts:18`; the `OFF_TIER` text in `actions.ts:22` and `test-call.ts:91`.
- Why: a fifth tier, or a change to criterion 93's 500 characters, has to be found in three places, and the copies can drift.
- Rule: fdd-architecture (KISS, one source per rule) · a test would have caught it: no, a convention.
- Fix: export `TIERS` and the 500-character limit once from `config.ts` or `models.ts` (both client-safe), and import them.

### `src/app/admin/(console)/models/page.tsx`

**LOW · line 26 · the deploy note understates a missing table**
- What: `readSettings()` and `lastChanges()` are awaited without a catch, so the page errors when `ai_setting` is missing; `smoke.md:212` says only that the page "cannot save".
- Why: whoever deploys out of order reads the note and expects a working read-only page.
- Rule: CLAUDE.md (deploy order) · a test would have caught it: no, a deploy-order state.
- Fix: say in `smoke.md` that the page errors until the migration has run, or catch on the page and show an empty state with a line saying the migration is pending.

### `src/features/admin/models/components/ModelsScreen.tsx`

**LOW · line 327, 416 · choice seeded once from props**
- What: `useState(tier)` and `useState(model)` keep the first value; after Reset or a save elsewhere the select still shows the old pick and its Change button turns on.
- Why: a stale choice one click from being saved again.
- Rule: vercel-react-best-practices `rerender-derived-state` · a test would have caught it: yes, rerender with new settings and read the select's value.
- Fix: key each row on its current tier or model so its state restarts when the server's value changes.

**LOW · line 126 · `gap-8` between page blocks**
- What: the three cards are spaced with `gap-8`; DESIGN.md names `gap-block` between blocks. Sibling admin screens also use the fixed scale.
- Why: the page's block spacing does not follow the fluid roles from 1440 up.
- Rule: `industry/DESIGN.md` (page spacing from the roles) · a test would have caught it: no, a convention.
- Fix: `gap-block` on the outer column.

## Top 3 priority fixes
1. `src/features/content/ai/client.ts:575` — reserve or reuse the cap slot for the fallback retry, and correct the comment.
2. `src/features/content/ai/settings.ts:117` — mark failing only when the row still holds the model that failed.
3. `src/features/admin/models/test-call.ts:143` — one rung per Test and per probe: no phantom Pro slot, and criterion 93's one live call.

## Done well
- Criterion 99 is pinned by comparison, not by assertion of a guess: the same calls with and without empty settings must give the same requests, rows and cache keys; the read is time-boxed (300 ms, injectable), errors fall open, and the fake provider never reads the table.
- The student ceiling is enforced three times: the actions refuse a tier outside `allowedTiers`, `readSettings` drops rows the rules no longer allow, and `startTier` re-checks `allowedTiers` and `maxTier`, so a stored value cannot lift a student call to Pro.
- Migration 0024 is additive only: two tables, set-null keys, safe before the code. Every action validates `unknown` input with zod, checks `canManageModels` from `access.ts`, and returns `ActionResult` without throwing.

## Built but not asked for
- Search use cases limited to Flash (`models.ts:20`) and a fallback on search: not in criterion 95, but they follow from `searchJson` always running on Flash. Nothing else.

## Blind spots
- The cap at its last slot with a broken saved model: a database test through `dbCallLog` at `cap - 1`.
- A save racing a call on another instance: a settings test that marks failing after a new save.
- `/admin/models` refused for a student or editor: no test names the path; an entry in `e2e/routes.e2e.ts` would, when asked for.
- The page with the table missing, and the tables at 360 wide: smoke only.

---
Stack: TypeScript, Next.js App Router (server component page, server actions), React client component, Tailwind 4, Drizzle with a Postgres migration, @google/genai on Vertex, bun test with happy-dom. Passes applied shallowly: none; the 30-second memory's sharing between Next's action and render layers was not checked (the TTL bounds it).

## Fixes applied

Nikhil's instruction: fix all valid. Each finding, in the order above.

| Finding | Outcome |
| --- | --- |
| MEDIUM · `client.ts:575` (709, 797) · fallback outside the cap | Fixed in `66daf1f`. The retry on the environment's model reserves a slot of its own (Pro, image, or the search cap), written with `fallback: 'env-default'` and settled like any reserved call (`CallLog.reserve` takes the fallback). At the last slot the retry is not made and the call returns the daily limit. Unit tests at `cap - 1` for Pro, image and search; a database test through `dbCallLog` at the last slot and with room for both. The comment is corrected. |
| LOW · `client.ts:317` · failed reads not remembered | Fixed in `a984ed6`. `readSettings` fails open itself: a failed read reads as no settings, warns once, and is kept in memory for the same 30 seconds as a good one. A test that runs without a database pins one select and one warning per 30 seconds. |
| MEDIUM · `settings.ts:117` · the failing mark lands on the new model | Fixed in `c62ca96`. `markFailing(tier, model, error)` updates the row only while it still holds the model that failed; the client passes the model it called. A database test saves A then B and marks A: no mark on B. |
| MEDIUM · `test-call.ts:143, 195` · an override Test runs a phantom second rung | Fixed in `8b3bdcd`. A call with a per-call model makes one attempt on its start tier, so nothing is reserved or logged beyond it; the failing override test asserts one row. |
| MEDIUM · `test-call.ts:143` · a Test climbs the ladder | Fixed in `8b3bdcd`, keeping criterion 93 as written. `generateJson` and `generateImage` take `once`: one attempt on the start tier, no retry, no climb, no fallback. The Test's client makes every call once, "Test all student calls" included, and reports the model called. A saved model not found still gets the red mark. |
| MEDIUM · `actions.ts:25` · tier list and limits repeated | Fixed in `b9f1642`. `TIERS` (with `Tier` derived from it) and `ERROR_MAX` are exported once from `config.ts`, `OFF_TIER` from `test-call.ts`; the actions, settings, recording and screen import them. |
| LOW · `page.tsx:26` · the deploy note understates a missing table | Fixed in `8e4ace0`. The page catches a failed log read and passes `unavailable`: the screen lists the environment's models under "The model settings cannot be read…", with no Change or Reset (Test stays). `smoke.md` says so. |
| LOW · `ModelsScreen.tsx:327, 416` · choice seeded once | Fixed in `8e4ace0`. The select and its Change button are one `ChangePicker`, keyed by its row on the saved value, so a save or reset starts it again while the row's Test and "Saved" lines stay. Tested by rerendering with new settings. |
| LOW · `ModelsScreen.tsx:126` · `gap-8` between blocks | Fixed in `8e4ace0`: `gap-block`. |

Checks after the fixes: `bun run test:run` 3452 pass, 0 fail; the database suites `settings.test.ts` (10 pass) and `store-backed.test.ts` (6 pass); `bun run lint`, `bun run type-check` and `bun run build` clean. No live Gemini call was made.
