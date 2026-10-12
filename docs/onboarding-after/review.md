# Step 04, After you graduate: one question per screen — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 1 MEDIUM · 3 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/onboarding-after` at `440cb93` over `7ff2929` · 17 files, +510 −401 · 2026-10-09 |
| Reviewed against | security · performance · security-web (applies: components) · CLAUDE.md · `industry DESIGN.md` · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean · dependencies N/A (package.json, bun.lock unchanged) · code clean (semgrep p/owasp-top-ten, baseline 7ff2929) |
| Not applicable | security-llm.md (no model calls) · tailwind skill (not requested) |
| Failed to load | none |
| Read outside the diff | 9 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md (test the brain, not the beauty) | B | MEDIUM · `onboarding.test.ts:390` · test bloat | delete the repeated test |
| industry DESIGN.md | A | — | — |
| vercel-react-best-practices | A | — | — |
| fdd-architecture | A | LOW · `QuestionScreen.tsx:384` · step check in view | width from the model |
| Criteria | A | 1 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | own URL per question; 404 on unknown slug | `onboarding.test.ts:453`, `:201` | covered (rules); page manual |
| 2 | order of four; "n of 4" kicker | `onboarding.test.ts:397`, `QuestionScreen.test.tsx:536`, `:567` | covered |
| 3 | why lines | `onboarding.test.ts:416` | covered |
| 4 | answer cards; stay's Not sure ordinary; defaults | `QuestionScreen.test.tsx:536`, `:548`, `:557`, `:567`; `impact.test.ts:30` | covered |
| 5 | today's answer lines | `impact.test.ts:478`, `:677`, `:697` (elsewhere) | covered |
| 6 | notes; stay and long-term idle | `QuestionScreen.test.tsx:536`, `:567` | covered |
| 7 | Back, Skip/Continue, last button, Leave, links in | `QuestionScreen.test.tsx:536`, `:567`, `:400`, `:218`; `onboarding.test.ts:639`, `:644` | covered |
| 8 | panel on step 04 | `OnboardingPanel.test.tsx:154` | covered |
| 9 | `/onboarding/after` resumes | `onboarding.test.ts:608`; `landing.test.ts:80` | covered (rules); redirect page manual |
| 10 | old page removed; PRODUCT.md; suite | diff; `bun test` of the 4 touched suites: 140 pass | covered |
| 11 | matches the Grad and GR boards | manual | not automatable |

Rows 1 and 9: the two pages (`notFound`, `markStep`, the bare-step redirect) have no unit test, by CLAUDE.md's rule that pages get none. They copy step 03's pages line for line, and the smoke test covers them. Row 4: focus and earning card order are unchanged `questions.ts` data and are not asserted on screen. Row 10: the whole suite was not run here. The smoke file's "831 pass" is not verified.

## Read outside the diff
- `next.config.ts:11` — `/opening/after` still redirects to `/onboarding/after`, which now resolves to `(shell)/after/page.tsx`.
- `src/app/(app)/onboarding/` — only `page.tsx` and `(shell)/` remain. No other route depended on `[step]`.
- `src/features/opening/model/landing.ts:19` — resume returns `/onboarding/after`, the new bare page. `landing.test.ts:80-90` unchanged and passing.
- `src/` grep `OpeningScreen` — no remaining import. `Progress`/`SCREEN_COUNT` are still used by CoinsScreen and FuturesScreen. `OptionButtons` is still used by AnswerCards and ChipEditor. `OPENING_STEPS` is still used by landing.ts. Nothing left orphaned.
- `src/` grep `Record<QuestionStep|OnboardingStep|PanelState>` — only `PANEL_COPY`, extended in the diff. `forwardPath`/`stepOfPath` handle 4. There is no other switch on the step.
- `questions.ts` options counted (with Not sure appended) — only `settle` has exactly two. PersonForm's `RELATIONSHIPS` has five, so the grid change touches long-term alone.
- `src/proxy.ts:41`, `src/shared/lib/auth/gate.ts:26` — `/onboarding/:path*` and the `/onboarding` prefix already cover `/onboarding/after/*`.
- `src/features/opening/server/profile.ts:45` — `getProfile` is `React.cache`d, so the layout and the page share one read per request.
- `living/[question]/page.tsx` — the new pages follow its pattern (slug check, `requireStudent`, parallel `getProfile` + `markStep`).

## Findings, by file

### `src/features/opening/model/onboarding.test.ts`

**MEDIUM · line 390 · test bloat**
- What: "keeps the default labels on steps 01 to 03" asserts that two optional config fields are `undefined`. The labels it stands for are already asserted as rendered text by the step 01–03 screen tests (`NEXT`, `LEAVE`, `STUDY_NEXT`, `STUDY_LEAVE`, and `QuestionScreen.test.tsx:400`).
- Why: it pins a data shape, not behaviour. It fails if a step sets the label to its own default, and it repeats assertions made elsewhere.
- Rule: CLAUDE.md "test the brain, not the beauty" and the review's test-bloat rule (repeats another test's assertion) · a test would have caught it: n/a
- Fix: delete the test. The `lastLabel`/`leaveLabel` lines at 386-387 are likewise repeated by `QuestionScreen.test.tsx:536`/`:567` and could go too.

### `src/features/opening/components/QuestionScreen.tsx`

**LOW · line 384 · step number in the view**
- What: `last && step === 4 && 'min-w-52'` hardcodes step 4 in the component. Every other step 04 difference (`lastLabel`, `leaveLabel`) was moved into `QUESTION_STEPS`.
- Why: a fifth step, or a relabelled one, has to know about this branch. The width follows the long label, not the step number.
- Rule: fdd-architecture KISS / explicit predictability · a test would have caught it: no, a look
- Fix: key the width on `lastLabel` being set, or leave it as it is with a comment. It is optional.

### `src/features/opening/components/QuestionScreen.test.tsx`

**LOW · line 578 · style assertion**
- What: `expect(show).toHaveClass('bg-brand')` asserts a colour class to stand for "the strong variant even unanswered".
- Why: the `last || answered` logic is unchanged by this branch. A theme or token rename breaks the test while the behaviour stays the same.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a
- Fix: drop the line. The look is checked against the boards.

### `src/features/opening/model/onboarding.ts`

**LOW · line 220 · duplicated constant**
- What: `FUTURES_PATH` is now exported here, but `CoinsScreen.tsx:31` keeps its own copy and `landing.ts:31` a literal `'/futures'`.
- Why: there are now two names for one path. The removed OpeningScreen held the third copy, so the count is unchanged.
- Rule: quality, no duplicated logic · a test would have caught it: no
- Fix: as a follow-up, import the model's constant in CoinsScreen and landing.ts.

## Top 3 priority fixes
1. `src/features/opening/model/onboarding.test.ts:390` — delete the repeated default-labels test.
2. `src/features/opening/components/QuestionScreen.test.tsx:578` — drop the `bg-brand` class assertion.
3. `src/features/opening/components/QuestionScreen.tsx:384` — take the last button's width from the model, not `step === 4` (optional).

## Done well
- Step 04 extends the existing model (`QUESTION_STEPS[4]` from `SCREENS[3]`, `AFTER` slugs). The pages copy step 03's, so a new step adds rules and no new screen code. The net change removes about 170 lines.
- The old route, the screen and its export were removed cleanly. The retired redirect, the resume rule and the proxy all still land on a page.
- The behaviour tests cover the step's real exceptions: stay's Not sure stored as stated with no chip, the key-is-not-a-slug check, and the panel count.

## Built but not asked for
- Nothing outside the criteria. The two-column grid for two answers (`AnswerCards.tsx:71`) came from the board check under criterion 11 and touches only long-term.

## Blind spots
- The two new pages (`notFound` for an unknown slug, `markStep('after')`, the bare-step redirect) are checked only by the smoke test. A Playwright pass over `/onboarding/after`, `/onboarding/after/nope` and a resume from `/onboarding` would pin them. The e2e helpers (`e2e/helpers/student.ts`) still walk the old screen and will fail until they are updated, which the intent puts out of scope.
- Criterion 11 (the boards at four widths, two themes) is only checked with screenshots.

---
Stack: TypeScript, React 19, Next.js App Router (server pages, client components), Tailwind 4, bun test with happy-dom. Passes applied shallowly: none. Type-check and the full suite were not run here; run `bun run type-check` and `bun run test:run` before the PR.

## Fixes applied

- MEDIUM, default-label config test and rendered-label assertions removed: fixed in 7992a9d
- LOW, step 04 button width keyed on a custom last label, not the step number: fixed in 7992a9d
- LOW, `bg-brand` class assertion dropped from the step 04 test: fixed in 7992a9d
- LOW, `FUTURES_PATH` imported from the model in CoinsScreen and landing: fixed in 7992a9d
