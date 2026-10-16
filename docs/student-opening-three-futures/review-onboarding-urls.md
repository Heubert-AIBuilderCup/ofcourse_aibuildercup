# Onboarding steps 00–01, late commits (Start fix, criterion 25, short-window panel, /onboarding URLs) — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 1 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/onboarding-steps-00-01` at `5785818` over `da1b3b4` · 11 commits, 42 files, +1349 −171 · 2026-10-08 |
| Reviewed against | security · security-web · performance · CLAUDE.md · AGENTS.md · PRODUCT.md · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean (gitleaks, 0) · dependencies N/A (no manifest or lockfile change) · code clean (semgrep p/owasp-top-ten, baseline `da1b3b4`, 0) |
| Not applicable | `security-llm.md` (no model code) · `tailwind-v4` skill (one class swap) |
| Failed to load | none |
| Read outside the diff | 10 — listed below |

The dispatch said 12 commits; the diff file and `git log da1b3b4..HEAD` hold 11.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md / PRODUCT.md (Student URLs) | B | MEDIUM · `onboarding/page.tsx:13` · resume rule | resume from the landing rule |
| `vercel-react-best-practices` | A | — | — |
| `fdd-architecture` | A | LOW · `e2e/helpers/student.ts:6` · URLs from product code | optional |
| Quality | A | LOW · `impact.ts:124` · line ignores the tap | optional |
| Criteria | A | — | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 14 | pick or skip sets the character; Start opens step 01 within 3 s | `student-opening-three-futures.e2e.ts:263`, `:277` · `onboarding.e2e.ts:102` · `opening.e2e.ts:21` | covered |
| 22 | the panel shows the step she is on | `student-opening-three-futures.e2e.ts:290`, `:582`, `:598` · `OnboardingPanel.test.tsx:48` · `onboarding.test.ts:142` | covered |
| 25 | an impact line within 300 ms of any answer | `student-opening-three-futures.e2e.ts:348` · `impact.test.ts:181`, `:271` | covered |
| 30 | Back shows earlier answers as left | `student-opening-three-futures.e2e.ts:407`, `:429`, `:446` · `FactsScreen.test.tsx:142` | covered |
| 60 | partway return opens where she left, answers kept | `student-opening-three-futures.e2e.ts:471` · `coins-and-return.e2e.ts:91`, `:123` · `onboarding.e2e.ts:42` | covered |
| 62 | Back from the futures, change an answer, futures redraw | `coins-and-return.e2e.ts:155` · `FuturesScreen.test.tsx:341` | covered |

The e2e for 25 taps each question's first option; the remaining options are covered by `impact.test.ts` ("every line she can see" plus the new in-between cases).

## Read outside the diff
- `src/shared/lib/auth/gate.ts:31` — `underPrefix` matches `/onboarding` and its sub-paths only; `safeNextPath` accepts the new prefix and nothing wider.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:238` — `next.config` redirects run before the proxy, so dropping `/picture` and `/opening` from the matcher leaves nothing unguarded.
- `src/app` route tree — nothing is left under `/picture` or `/opening`; every `(app)` page, including the two new resume pages, calls `requireStudent`.
- `src/app/(app)/layout.tsx:11` — the `(app)` layout's `requireStudent` refuses admins on every onboarding page; `canUseStudentApp` is unit-tested (`access.test.ts:218`).
- `src/shared/types/student.ts:49` — `OPENING_STEPS`; every `lastStep` value `landingPath` can return resolves to a real route (`facts` through the resume page, study/living/after through `[step]`).
- `src/app/(app)/start/page.tsx:10` — the only caller of `landingPath`.
- `src/features/opening/model/questions.ts:103` — earliest, latest and years options; every earliest and years value gets a line, and every latest value is in `INTAKES`.
- `src/features/opening/model/impact.ts:316` — `impactLine` still returns the "Not sure" line first, then the item's line; that path is unchanged.
- `src/features/opening/components/FactsScreen.tsx:90` — the line shows only once the current question is answered, so the new budget and timing lines never appear on an unanswered screen.
- grep for `'/opening` and `'/picture` in `src` and `e2e` — only the redirect tests remain.

## Findings, by file

### `src/app/(app)/onboarding/page.tsx`

**MEDIUM · line 13 · resume rule**
- What: once step 00 is answered, `/onboarding` always goes to step 01 (`factPath(firstUnanswered(answers))`) and ignores `lastStep` and `seenFutures`. A student on step 03 with step 01 complete lands on the English test question, while `/` (`landingPath`) sends the same student to `/onboarding/living`.
- Why: PRODUCT.md and CLAUDE.md say `/onboarding` resumes where she left off. There are now two resume rules for one student, and they disagree.
- Rule: CLAUDE.md "Student URLs", PRODUCT.md "The student flow", Quality (duplicated logic) · a test would have caught it: yes, `/onboarding` for a student whose `lastStep` is `study`. `onboarding.e2e.ts:261` covers only steps 00–01.
- Fix: derive the resume from `landingPath`'s rule: step 00 until answered, the step she left for study/living/after, else her first unanswered fact. Decide whether a student who has seen the futures goes to step 04 or to `/futures`, and add that case to the e2e.

### `src/features/opening/model/impact.ts`

**LOW · line 124 · line ignores the tap**
- What: when Earliest start is answered and Latest is skipped, every "Most years" option shows the earliest-start line ("From Feb 2027. Tell me the latest you'd accept."), so 2, 3 and "4 or more" read the same.
- Why: criterion 25 holds because a line appears, but the line does not say what this tap did.
- Rule: intent criterion 25 (its purpose) · a test would have caught it: no, `impact.test.ts:283` asserts this order.
- Fix: optional. Speak of the question just answered, or join both ("From Feb 2027, up to 2 years: …").

### `src/features/opening/model/impact.test.ts`

**LOW · line 181 · test name**
- What: the title says the amount is asked for when "covers, who or the limit is stated". With the limit stated, the limit line shows instead, as the next test asserts.
- Why: the name describes a case the body does not test and the code does not do.
- Rule: Quality (names say what things are) · a test would have caught it: no, a name.
- Fix: drop "or the limit" from the title.

### `e2e/helpers/student.ts`

**LOW · line 6 · URLs from product code**
- What: the e2e helper and `student-opening-three-futures.e2e.ts:2` build step 01 URLs from the model's `FACT_SLUGS`, so these end-to-end tests follow a slug rename instead of catching it.
- Why: the slugs are a public contract (PRODUCT.md). `onboarding.test.ts` pins all eleven literally and several specs use literal URLs, so the gap is small, but the e2e process now loads product modules.
- Rule: `fdd-architecture` §2 public API boundary (applied by analogy to tests outside `src`) · a test would have caught it: n/a.
- Fix: put a literal question-to-slug map in the helper, copied from PRODUCT.md.

### `src/features/opening/components/FactsScreen.tsx`

**LOW · line 53 · duplicated parsing**
- What: `FactsScreen.tsx:53` and `OnboardingPanel.tsx:39` both read the question with `factIndex(pathname.split('/').pop())`, while the model already owns `stepOfPath`.
- Why: if the URL shape changes, two components must change together. Two uses are under the rule of three, so this is optional.
- Rule: `fdd-architecture` §5 · a test would have caught it: no, a convention.
- Fix: add `factIndexOfPath(pathname)` beside `stepOfPath` in `model/onboarding.ts`.

## Top 3 priority fixes
1. `src/app/(app)/onboarding/page.tsx:13` — resume from the same rule as `landingPath`, and add an e2e for a student on step 02–04.
2. `src/features/opening/model/impact.test.ts:181` — correct the test title.
3. `e2e/helpers/student.ts:6` — use literal slugs in the e2e.

## Done well
- Every new path is guarded at all three layers: redirects (which run before the proxy), the proxy matcher and `APP_PATHS` kept in step, and `requireStudent` on each page. `gate.test.ts` pins the new prefixes and that the retired ones are no longer app paths. `[step]` refuses everything except study, living and after, and a key is never accepted as a slug (`factKey('hard')` is null).
- The impact additions only add lines: each new branch replaces what used to be `null`. The tests pin the old lines next to the new ones, and the "Not sure first" order is kept.
- `usePathname` replaces `useSearchParams` in both client components, and the panel's `h-dvh` → `min-h-dvh` change comes with short-window and tall-window e2e tests. The loader tests now release the database lock once the loader is seen, not after a fixed 2 s.

## Built but not asked for
- Nothing beyond the 8 Oct decision. `PRODUCT.md`, `e2e/README.md` and the manual checklist are documentation.

## Blind spots
- Native browser Back and reload across the question URLs that `pushState` creates (the 8 Oct rationale) are untested; every e2e uses the in-app Back button. A Playwright test with `page.goBack()` and `page.reload()` on `/onboarding/facts/amount` would cover it.
- An unknown slug is a soft 404 (status 200 inside the loading boundary, as `/opening/<x>` was before). No test checks the status. This is harmless for signed-in pages.
- No e2e signs in an admin and opens `/onboarding/*`. The refusal rests on the `(app)` layout's `requireStudent` and the unit test of `canUseStudentApp`.
- Route precedence (the static `facts` and `character` inside `(shell)` against `[step]`) is reasoned from Next's static-before-dynamic rule and confirmed only indirectly by the e2e visits. It was not run here.

---
Stack: TypeScript, Next.js App Router (route groups, dynamic segments, `next.config` redirects, proxy), React 19 client components (`usePathname`, `history.pushState`), Tailwind CSS 4 (one class), Bun test + happy-dom, Playwright. Passes applied shallowly: none. The routing and `pushState` points are reasoned from the Next docs and the code, not run.

## Fixes applied (2026-10-08)
- MEDIUM · `onboarding/page.tsx` — `/onboarding` now calls `onboardingResumePath` (model/landing.ts), which `landingPath` also uses for everything before the futures: step 00 until answered; study, living or after where she left; her first unanswered question from step 00 or 01; step 04 (`/onboarding/after`) once she has reached the futures. `landing.test.ts` covers every `lastStep` and the seen-futures case; `onboarding.e2e.ts` adds a student left on step 02. `/onboarding/facts` keeps its own facts-only redirect, since a student who skipped step 00 must still reach step 01 there.
- LOW · `impact.ts` — with Latest unanswered, Earliest and Years together name both ("From Feb 2027, up to 2 years. Tell me the latest you'd accept."); the ordering test now expects that.
- LOW · `impact.test.ts` — the amount test's title no longer mentions the limit.
- LOW · `e2e/helpers/student.ts` — a literal question → slug map from PRODUCT.md and `factUrl(question)`; the spec uses it, and no e2e file imports from `src/`.
- LOW · `FactsScreen.tsx`, `OnboardingPanel.tsx` — both read the question with `factIndexOfPath(pathname)` from model/onboarding.ts, unit-tested beside `stepOfPath`.
