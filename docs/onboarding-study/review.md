# Step 02, What you'd study: one question per screen — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 3 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/onboarding-study` at `9058150` over `origin/dev` (`43e8b05`) · 41 files, +2090 −229 (incl. 2 uncommitted doc edits) · 2026-10-09 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · Industry tokens (`theme.css`, grep) |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing · code clean |
| Not applicable | `security-llm.md` (no model calls) · other `.claude/skills` (not in dispatch) |
| Failed to load | none |
| Read outside the diff | 12, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | B | MEDIUM · `(shell)/layout.tsx:13` · profile read twice | `cache()` around `getProfile` |
| vercel-react-best-practices | B | MEDIUM · `(shell)/layout.tsx:11` · shell streams behind a read | flush the shell first |
| tailwind-v4-best-practices | A | — | — |
| CLAUDE.md | A | LOW · `AreaChecks.tsx:113` · size per breakpoint | optional |
| Quality and accessibility | B | MEDIUM · `AreaChecks.tsx:74` · refusal outside a live region | persistent live region |
| Criteria | A | 1 not automatable · e2e unrun | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | own URL per question, marks step, unknown slug 404 | `onboarding.test.ts:245` · `onboarding-study.e2e.ts:30,145` | covered |
| 2 | field or areas only after their answer, then in order | `onboarding.test.ts:351` · `QuestionScreen.test.tsx:267` | covered |
| 3 | kicker "n of N", changes at once | `QuestionScreen.test.tsx:267` · `onboarding.test.ts:431` | covered |
| 4 | group label above, heading, why lines | `onboarding.test.ts:276,300` · `QuestionScreen.test.tsx:280` | covered |
| 5 | cards, Not sure last, assumed default | `QuestionScreen.test.tsx:240,280` · `impact.test.ts:88` | covered |
| 6 | " · " join, "any field", opening lines | `impact.test.ts:35,397` · `QuestionScreen.test.tsx:280,307` | covered |
| 7 | six checkbox cards, count, notes, no Not sure | `AreaChecks.test.tsx:39,62,114` | covered |
| 8 | fourth refused, others full, message goes | `AreaChecks.test.tsx:93` · `onboarding-study.e2e.ts:82` | covered |
| 9 | last area removed clears the answer | `actions.test.ts:118` · `profile.test.ts:105` · `QuestionScreen.test.tsx:307` | covered |
| 10 | notes idle, saving, saved, failed | `QuestionScreen.test.tsx:213,307` | covered |
| 11 | Back, Skip/Continue, Next, Leave | `QuestionScreen.test.tsx:240,267,328` · `onboarding-study.e2e.ts:21` | covered |
| 12 | step 01 into step 02; step 03 Back | `QuestionScreen.test.tsx:192,199` · `OpeningScreen.test.tsx:298` | covered |
| 13 | panel on step 02 | `OnboardingPanel.test.tsx:117,131` | covered |
| 14 | focus to heading, Tab, menu | `QuestionScreen.test.tsx:225` · `AreaChecks.test.tsx:39` | covered |
| 15 | matches the boards, both themes | manual (smoke.md) | not automatable |
| 16 | bare step and a question not asked | `onboarding.test.ts:378` · `QuestionScreen.test.tsx:293` · `onboarding-study.e2e.ts:128` | covered |
| 17 | `/`, `/onboarding`, `/opening/study` | `onboarding-study.e2e.ts:149` · `onboarding.e2e.ts:316,373` | covered |
| 18 | docs list the slugs; suites pass | `PRODUCT.md:19` · unit run | partly verified |

Unit suite run for this review: 776 pass, 0 fail, 77 skipped; `type-check` and `lint` clean. Criterion 14's focus test is step 01's, over the same code path. `profile.test.ts:105` runs only with `DB_TESTS=1` (skipped in `test:run`); its SQL was checked as text instead. The e2e specs for 1, 8, 11, 16 and 17 exist; the two edited in `048e349` are unrun and the full suite has not run (Playwright now runs on request).

## Read outside the diff
- `src/features/opening/server/profile.ts:28-38` — the clear SQL runs only in the UPDATE; `ensureRow` inserts `{ userId }` alone.
- `grep saveAnswers(` — one caller (`actions.ts:79`); drizzle prints `("answers" || $1::jsonb) - $2::text - $3::text`, keys bound (scratch script, run from the repo root and removed; tree unchanged).
- `src/features/opening/server/profile.ts:40` — `getProfile` is a plain async function, no React `cache`.
- `(shell)/welcome/page.tsx:13`, `character/page.tsx:12`, `facts/page.tsx:9` — every shell page reads the profile too.
- `src/app/(app)/loading.tsx`, `(shell)/loading.tsx` — the shell sits between two Suspense boundaries.
- `grep OnboardingPanel|useOnboardingAnswers` — only rendered inside `OnboardingShell`; no provider-less consumer.
- `src/features/opening/components/AnswerCards.tsx` — uses the same `@max-xl:` phone sizes as `AreaChecks`.
- `src/proxy.ts:43`, `src/shared/lib/auth/gate.test.ts:24-27` — `/onboarding/:path*` gated and tested; pages call `requireStudent`.
- `src/features/opening/model/landing.ts:17-23` — a step 02 return lands on `/onboarding/study`, which redirects.
- `src/features/opening/model/impact.ts:6-9` — the engine barrel is already in the client bundle; `AreaChecks` adds nothing.
- `src/design-systems/industry/theme.css:57,67,138,148` — `accent-*` and `neutral-*` flip in dark.
- `git show --stat 048e349` — touched `onboarding-study.e2e.ts` and `onboarding.e2e.ts`, both unrun since.

## Findings, by file

### `src/app/(app)/onboarding/(shell)/layout.tsx`

**MEDIUM · line 13 · profile read twice per request**
- What: The layout now calls `getProfile`, and so does every shell page (welcome, character, facts, facts/[question], study, study/[question]); `getProfile` is not cached, so a load or refresh runs two identical SELECTs.
- Why: Double the database reads on every shell page load, growing with traffic.
- Rule: `performance.md` §2 (same value fetched twice) · `server-cache-react` · a test would have caught it: no.
- Fix: Wrap `getProfile` in React `cache()` (per-request dedupe); the page's concurrent `markStep` does not touch what either reader uses.

**MEDIUM · line 11 · the shell now streams behind a database read**
- What: An async layout puts the whole shell inside the `(app)/loading.tsx` boundary's streamed segment, so on a cold load the panel no longer paints before the page, which `(shell)/loading.tsx` was built for. On a first visit the `theme-os` cookie refresh can race that stream and leave the shell's copy in a hidden `div#S:0`; `e2e/onboarding.e2e.ts:267-271` scopes a locator around the duplicate instead of reporting it.
- Why: Slower first paint, a duplicate (hidden) shell in the DOM, and tests quietly shaped around a product defect.
- Rule: `performance.md` §5 (critical path) · `async-suspense-boundaries` · a test would have caught it: yes, an e2e counting `aside[aria-label="Getting started"]` (hidden included) after a first visit.
- Fix: Let the shell flush without the profile (pass the un-awaited promise and `use()` it only where the count and the screen need it). Set `theme-os` on the client so a first visit does not refresh mid-stream.

### `src/features/opening/components/AreaChecks.tsx`

**MEDIUM · line 74 · refusal status mounted with its text**
- What: The refusal `<p role="status">` is inserted already filled. No live region exists before the tap, and `data-full` is not exposed to assistive tech.
- Why: Screen readers often skip a live region that arrives with its content, so a refused fourth tap can be silent. `QuestionScreen` keeps its live region rendered for exactly this reason.
- Rule: accessibility (live regions must exist before they change) · a test would have caught it: yes, an assertion that the refusal lands in a container rendered before the tap.
- Fix: Keep an always-rendered `aria-live="polite"` wrapper and render the refusal text inside it, as `QuestionScreen` does for its note.

**LOW · lines 54, 113, 131 · sizes per breakpoint**
- What: `@max-xl:gap-2.5`, `@max-xl:min-h-14 py-2.5 pr-10 pl-3`, `@max-xl:size-5 right-2.5`.
- Why: CLAUDE.md says "Never a size per breakpoint". `AnswerCards` does the same, so the house idiom and the rule disagree.
- Rule: CLAUDE.md "Sizes are fluid" · a test would have caught it: no, a convention.
- Fix: Settle the rule (allow phone compaction, or move it into a role) rather than change this component alone.

### `src/features/opening/model/onboarding.ts`

**LOW · line 287 · two rules for the question a URL shows**
- What: For a URL naming a question that is not asked (e.g. `/study/field` after "Suggest me", level open), `stepProgress` counts question 1, but `QuestionScreen.tsx:82-84` shows her first open question ("2 of 4").
- Why: The server-rendered panel reads "Now · 1/4" against the kicker's "2 of 4" until the `replaceState` effect runs.
- Rule: quality (duplicated logic) · a test would have caught it: yes, a `stepProgress` case at `/study/field` with know "Suggest me".
- Fix: Put one model function behind both: the named question if asked, else `firstOpenQuestion`.

### `src/app/(app)/onboarding/(shell)/study/[question]/page.tsx`

**LOW · line 11 · comment overstates the refresh case**
- What: "A refresh in that window must not send her back" (also `QuestionScreen.tsx:80-81`) holds only for `router.refresh()`, since the provider ignores new props. A hard reload before the 300 ms save lands still sends her to her first open question.
- Why: The next reader will trust a guarantee the code does not give.
- Rule: LOW, a comment that does not match · a test would have caught it: no.
- Fix: Say "a `router.refresh()` (the theme cookie)".

### `src/features/opening/components/OpeningScreen.tsx`

**LOW · line 134 · dead arm and nested ternary**
- What: The screen now serves only living (index 2) and after (3), so the `FACTS_BACK_PATH` arm (line 28) cannot be reached.
- Why: This change orphaned it; the nested ternary hides that.
- Rule: CLAUDE.md "remove what your changes made unused" · a test would have caught it: no.
- Fix: `const back = index === 2 ? STUDY_BACK_PATH : stepPath(index - 1)`, and drop `FACTS_BACK_PATH` if nothing else uses it.

### `src/features/opening/index.ts`

**LOW · line 31 · unused export**
- What: `isVisible` is exported for the study page's redirect, which `048e349` removed; nothing outside the feature imports it.
- Why: It widens the feature's public API for no caller.
- Rule: CLAUDE.md surgical changes · a test would have caught it: no.
- Fix: Drop the export.

### `CLAUDE.md`

**LOW · line 16 · uncommitted process change**
- What: The `test:e2e` rule rewrite and the `smoke.md` edits are only in the working tree. The rewrite is a process change no criterion asked for, and it contradicts `plan.md`'s "full suite once before the push".
- Why: A PR built from the branch's commits ships neither edit.
- Rule: CLAUDE.md Git (one semantic commit each) · a test would have caught it: no.
- Fix: Commit the rule change on its own (`docs:`) or drop it, and commit `smoke.md` with the step 02 docs.

## Top 3 priority fixes
1. `src/features/opening/server/profile.ts:40` — wrap `getProfile` in React `cache()`.
2. `src/app/(app)/onboarding/(shell)/layout.tsx:11` — let the shell flush before the profile read; stop the first-visit theme refresh racing the stream.
3. `src/features/opening/components/AreaChecks.tsx:74` — render the refusal inside an always-present live region.

## Done well
- The clear is safe: keys are allowlisted by `isQuestionKey` before they reach SQL, the merge is bracketed, and there is one bound `- $n::text` per key (checked as text).
- Step 01 is unchanged by construction: `QUESTION_STEPS[1]` is derived from the model, the `FACT_*` exports sit on top of it, and every step 01 test is kept.
- A question that is not asked is judged with the answers on screen, so the theme refresh cannot bounce her; `QuestionScreen.test.tsx:293` pins a single `replaceState`.

## Built but not asked for
- CLAUDE.md's `test:e2e` rule rewritten (uncommitted).
- `isVisible` exported from the feature index, with no caller.

## Pre-existing, not this branch
- `braces` ≤3.0.3 (high, GHSA-vfj7-8cjw-p6xm) and `esbuild` ≤0.24.2 (moderate, GHSA-67mh-4wv8-2f99); this branch changes no dependency.

## Blind spots
- The hidden `S:0` shell: nothing asserts a single shell in the DOM after a first visit; an e2e counting the landmark, hidden included, would catch it.
- Browser Back into the shell (e.g. from `/onboarding/living`) likely restores the layout's cached first-load answers into the provider. Step 01's page props already had this problem, but the stale answers now feed the panel and both steps. Unverified; an e2e with `page.goBack()` after answering would show it.
- The clearing write: run `DB_TESTS=1 bun test src/features/opening/server/profile.test.ts` before merge (skipped in `test:run`).
- The refusal announcement: only a screen-reader pass, or an assertion on the live container, would catch it.

---
Stack: TypeScript, React 19, Next.js App Router (route groups, typed `PageProps`), Tailwind 4 with container queries, Drizzle ORM on Postgres jsonb, Bun test with happy-dom and Testing Library, Playwright. Passes applied shallowly: Next's streaming and router-cache behaviour was judged from the code, not observed (no dev server, no Playwright, per the dispatch).

## Applied — 2026-10-09 (developer: "fix them")
Fixed in `52cc745`: `getProfile` cached per request; `theme-os` written by the browser, so a first visit no longer refreshes the route mid-stream (the trigger for the hidden `div#S:0` copy); AreaChecks' refusal inside an always-rendered live region; `shownQuestion` as the one rule for the panel and the screen; the two comments corrected; OpeningScreen's dead arm removed; the `isVisible` export dropped.
Left, with the reason:
- The async layout itself (MEDIUM, second half): the shell still waits for one indexed profile read before it streams. The alternative (`use()` of an un-awaited promise in the panel and the screen) moves suspension into both and could not be checked in a browser in this run (e2e runs only on request now). With the refresh trigger gone and the read cached, it is a follow-up, not a fix.
- Sizes per breakpoint in AreaChecks (LOW): the same phone compaction as AnswerCards, the house idiom; the rule and the idiom are to be settled in CLAUDE.md, not in one component.
- CLAUDE.md uncommitted (LOW): moot; it goes into the branch's commit at the push, with the developer's approval.
