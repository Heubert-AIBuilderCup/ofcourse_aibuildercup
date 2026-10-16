# Story 15, the Models page: the review fixes (85e0c5f..dd284f3) — Code Review

**Approve.** 0 CRITICAL · 0 HIGH · 0 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/admin-model-settings` at `dd284f3` over `85e0c5f` · 16 files, +704 −173 (7 commits) · 2026-10-16 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (none added) · code N/A (semgrep not installed) |
| Not applicable | vercel-composition-patterns (not in dispatch) · criteria outside 90–99 (not this branch) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | A | LOW · `settings.ts:49` · a transient failure held 30 s | optional |
| CLAUDE.md | A | — | — |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | — | — |
| fdd-architecture | A | LOW · `config.ts:4` · comment overstates its readers | optional |
| Criteria | A | — | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 90 | page lists use cases, tiers, source, last error | `ModelsScreen.test.tsx:101`, `:172` | covered |
| 91 | student and signed-out refused | `actions.test.ts:75`, `:82` | covered (actions); page by the shared guard |
| 92 | admin sees no Test/Change/Reset, actions refuse | `ModelsScreen.test.tsx:84`, `actions.test.ts:98` | covered |
| 93 | Test: exactly one live call; Test all student calls | `test-call.test.ts:129`, `:138`, `:218`, `client.test.ts:906`, `:924` | covered |
| 94 | known models only, save after a passing test, next call | `actions.test.ts:148`, `:182`, `settings.test.ts:198` | covered |
| 95 | allowed tiers only; student never Pro; art image only | `actions.test.ts:198`, `ModelsScreen.test.tsx:122` | covered |
| 96 | 404/403 retried once on env model, logged, red mark | `client.test.ts:793`, `:823`, `:834`, `store-backed.test.ts:103`, `settings.test.ts:173` | covered |
| 97 | Reset with confirmation clears every choice | `actions.test.ts:226`, `settings.test.ts:135`, `ModelsScreen.test.tsx:225` | covered |
| 98 | log: who, when, what, old, new; last 20 | `settings.test.ts:109`, `:184`, `ModelsScreen.test.tsx:246` | covered |
| 99 | nothing saved: as before | `client.test.ts:731` | covered |

Criterion 96's retry is now refused with the daily limit when the failed call took the last slot (`client.test.ts:834`, `:847`, `:1053`): "caps respected" (93) wins over "retried once", which is the right reading. The tests were not re-run here; the pass counts are the fix commit's claim.

## Each finding of the first review, verified
| Finding | Verdict |
| --- | --- |
| fallback outside the cap (`client.ts:575`, 709, 797) | Resolved. Pro, image and search retries each `reserve` a slot of their own with `fallback: 'env-default'` and settle it; a refused slot returns `DAILY_LIMIT`; the first slot is always settled before. No path calls the provider without a slot on a capped tier, and no slot is left unsettled beyond the pre-existing throw-before-settle case. |
| failed reads not remembered | Resolved, with LOW 1 below. |
| failing mark lands on the new model | Resolved: `where key = tier:<t> and value = <failed model>` (`settings.ts:140`); every `reportFailing` passes the saved model it called; the override Test never marks. |
| phantom second rung | Resolved: `req.model` makes the ladder `[start]` (`client.ts:555`); `test-call.test.ts:167` asserts one row. |
| a Test climbs the ladder | Resolved: `once` limits the ladder to `[start]` and skips the fallback in JSON and image; the Test client wraps both methods, and the check cases call only `generateJson` on the `ai` they are given. |
| tier list and limits repeated | Resolved: `TIERS`, `Tier` and `ERROR_MAX` from `config.ts`, `OFF_TIER` from `test-call.ts`. LOW 4 on its comment. |
| page errors without the table | Resolved: `lastChanges` caught to `unavailable`; no Change, no Reset, Test stays; `smoke.md` matches. |
| choice seeded once | Resolved: `ChangePicker` keyed on the saved value; `revalidatePath('/admin/models')` after every save and reset brings the new value. |
| `gap-8` between blocks | Resolved: `gap-block`, from `--spacing-block` (`globals.css:44`). |

## Read outside the diff
- `src/features/content/ai/client.ts:487-545` — `attempt` settles a reserved id or records its own row, never both: no double row, no leaked slot.
- `src/features/content/ai/client.ts:539` — the one 429 wait sits inside `attempt`; it makes no second call (risk 2).
- `src/features/content/ai/client.ts:143` — `settingsFor` unchanged: the fake provider never reads the table (risk 4).
- grep of `once:` and `model:` passed to `generateJson`/`generateImage` in `src` — only `test-call.ts`; every other caller runs the same ladder as before (risk 1, criterion 99).
- `src/features/roads/evals/check-cases.ts:47`, `:78` — cases call `ai.generateJson` on the injected `ai`, so the `once` wrapper reaches them.
- `src/app/globals.css:44` — `--spacing-block` exists, so `gap-block` generates (risk 6).
- `src/features/admin/models/actions.ts:61` — `revalidatePath` after save, tier and reset: the keyed pickers remount (risk 6).
- `src/features/content/ai/settings.ts:101` — `save` empties the memory, so a successful save is never served stale on that instance (risk 4).
- `src/features/content/ai/settings.test.ts:91` — `beforeEach` resets, so the database block reads afresh after the no-database test.

## Findings, by file

### `src/features/content/ai/settings.ts`

**LOW · line 49 · a transient read failure is held for 30 seconds**
- What: any failed read, not only a missing table, is remembered as "no settings" for the full TTL. On that instance every call ignores the saved models for 30 s, and the page, whose `lastChanges` may succeed a moment later, shows every tier from the environment with Change enabled.
- Why: in story 15's own scenario (a saved model rescuing a broken environment model) one database blip sends 30 s of calls to the broken model; before this fix it cost one call.
- Rule: `performance.md` §6 (what a cached value depends on) · a test would have caught it: no, the behaviour is as specified.
- Fix: remember a failure for a shorter window (say 5 s), or only an undefined-table error (Postgres `42P01`), keeping 30 s for good reads.

### `src/features/content/ai/settings.test.ts`

**LOW · line 27 · the test leaves the memory stamped in the future**
- What: the last read is made at `start + ttl + 1`, about 100 TTLs ahead, then `setSystemTime()` restores the clock; `Date.now() - memory.at` is negative, so that empty value reads as fresh until something empties the memory.
- Why: harmless today (the database block's `beforeEach` resets), but a later test in the same bun process that reads the real settings would get the empty copy.
- Rule: quality (test isolation) · a test would have caught it: no.
- Fix: treat a negative age as stale in `readSettings` (`age < 0 || age >= SETTINGS_TTL_MS`), which also guards a clock stepping back.

### `src/features/content/ai/client.ts`

**LOW · line 539 · a one-attempt call still waits on a 429**
- What: with `once` or a per-call model there is no next attempt, but a 429 still sleeps up to 5 s before the Test reports failed.
- Why: a superadmin waits up to 5 s for a result already known, and "Test all student calls" can add 5 s per case.
- Rule: `performance.md` §3 · a test would have caught it: yes, a `once` call with a 429 asserting `sleep` was not called.
- Fix: skip the wait when the call is single (`req.once || req.model !== undefined`).

### `src/features/content/ai/config.ts`

**LOW · line 4 · comment names readers that do not import it**
- What: "the one list the client, the settings and the Models page read": `client.ts` does not import `TIERS`, and `schema.ts:394` keeps its own literal list for the check constraint.
- Why: the next reader trusts there is one list when there are two.
- Rule: fdd-architecture (one source per rule), naming drift · a test would have caught it: no.
- Fix: say "the settings, the actions and the Models page", or import `TIERS` into the schema's check.

## Top 3 priority fixes
1. `src/features/content/ai/settings.ts:49` — hold a failed read briefly, or only for a missing table.
2. `src/features/content/ai/settings.ts:45` — treat a negative age as stale.
3. `src/features/content/ai/client.ts:539` — no 429 wait on a single-attempt call.

## Done well
- The cap fix keeps one shape everywhere: `slot()` in the ladder and the same `reserve`/`settle` pair in search and image, with `fallback` stored at reservation, so the fallback row is counted, settled and labelled like any call; a database test proves it at the last slot and with room for both.
- `once` and a per-call model collapse the ladder to `[start]` at one point, with the recording's budget of one kept as a second guard; the tests assert requests and rows, not mocks.
- The page fails open without new state: `unavailable` derives from the log read and gates Change and Reset through one `canChange`, while the server actions keep their own checks.

## Built but not asked for
- nothing

## Blind spots
- A read that starts before a save and ends after it stores the pre-save settings for 30 s on that instance. This predates the branch; a settings test with a slow first read and an interleaved save would catch it.
- The page with the table missing, and at 360 wide: smoke only (`smoke.md`).

---
Stack: TypeScript, Next.js App Router (server component page, server actions), React client component, Tailwind 4, Drizzle on Postgres, @google/genai on Vertex, bun test with happy-dom. Passes applied shallowly: none; tests were not re-run, and whether bun shares one module registry across test files (LOW 2's reach) was not checked.

## Fixes applied

All 4 LOW findings, each test-first (RED seen before the code).

| Finding | Fix |
| --- | --- |
| `settings.ts:49` a transient read failure held for 30 s | A failed read is remembered for `FAILED_READ_TTL_MS` (5 s); a good read keeps 30 s. Test: failure remembered for 5 s, re-read after. |
| `settings.test.ts:27` memory stamped in the future | `readSettings` treats a negative age (a clock stepped back) as stale. Test: a read stamped after now is read again. |
| `client.ts:539` a one-attempt call waits on a 429 | `single` (`once` or a per-call model) is defined before `attempt` and skips the 429 wait. Test: `once` and a per-call model on a 429 never call `sleep`. |
| `config.ts:4` comment overstates its readers | The comment now names the settings, the actions and the Models page. |

Checks: settings and client tests 62 pass; DB tests settings 11 pass and store-backed 6 pass; full suite 3454 pass, 0 fail (3452 baseline plus 2 new tests); lint, type-check and `bun run build` clean. With no settings saved every call behaves as before.
