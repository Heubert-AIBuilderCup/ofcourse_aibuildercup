# Step 04, After you graduate: one question per screen — Implementation Plan

**Intent:** docs/onboarding-after/intent.md
**Goal:** Step 04 asks its four questions one per screen at `/onboarding/after/<question>` on the onboarding shell, reusing `QuestionScreen`, and its last button opens `/futures`.
**Approach:** The per-step model (`QUESTION_STEPS` in `onboarding.ts`) gains step 4 from `SCREENS[3]`, as step 03 was added from `SCREENS[2]`; the questions, answers and lines in `questions.ts` and `impact.ts` already match the canvas and do not change. `QuestionScreen` learns step 4's wording (its last button and "Leave the rest" read "show me three futures") and two idle notes keyed by question. The old step 04 page (`[step]/page.tsx`, `OpeningScreen`) is removed.
**Test layers:** Unit only (`bun test <files>` per task; `bun run test:run` once at the end by the controller). No stored data changes shape and the write path (`saveAnswersAction`) is unchanged; the new pages sit under `src/app/(app)` behind `requireStudent`, as steps 02 and 03's, so no access path is added. Criterion 11 is a screenshot check by the controller. No e2e (CLAUDE.md: only when asked).
**Constraints:** CLAUDE.md in full; in short: Bun only; server actions return `ActionResult` and never throw; Tailwind 4 semantic tokens, container-query variants (`@max-xl:`, `@5xl:`), type/spacing roles, `size-icon*` for icons, no arbitrary values; student URLs as slugs, keys never in a URL; "test the brain, not the beauty" (no tests for pages or styles); never `bun run test:db`, `bun run db:reset`, `bun run test:e2e`, or a dev server; read `src/design-systems/industry/DESIGN.md` before UI work and `node_modules/next/dist/docs` before Next.js code; commit after each task with Conventional Commits, never a co-author line.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/features/opening/model/onboarding.ts` (+ test) | modify | Step 4 in the model: slugs, whys, back, labels, forward to `/futures`, panel copy, `stepOfPath` |
| `src/features/opening/components/OnboardingPanel.tsx` (+ test) | modify (test only, unless the step 4 case needs code) | Panel's step 04 state |
| `src/features/opening/model/landing.ts` (+ test) | check | Resume lands on `/onboarding/after` (unchanged rule, now a redirect) |
| `src/features/opening/components/QuestionScreen.tsx` (+ test) | modify | Step 4's last button, "Leave the rest" wording, idle notes for stay and settle, the last button's width |
| `src/app/(app)/onboarding/(shell)/after/page.tsx` | create | Redirect to her first open question |
| `src/app/(app)/onboarding/(shell)/after/[question]/page.tsx` | create | Step 04's question page |
| `src/app/(app)/onboarding/[step]/page.tsx`, `src/features/opening/components/OpeningScreen.tsx` (+ test) | delete | The old step 04 screen |
| `src/features/opening/index.ts` | modify | Drop `OpeningScreen` |
| `PRODUCT.md` | modify | URL map: step 04's slugs; resume bullet names after |

## Task 1: The rules — step 04 in the step model and the panel
**Delivers:** criteria 1 (slugs, unknown slug), 2, 3, 7 (Back, forward targets, step 03's links in), 8, 9 (the rule).
**Files:** modify `src/features/opening/model/onboarding.ts`, `src/features/opening/model/onboarding.test.ts`, `src/features/opening/components/OnboardingPanel.test.tsx` (and `OnboardingPanel.tsx` only if a test shows it needs a change); check `src/features/opening/model/landing.test.ts`.
**Kind:** judgement

Read first: `onboarding.ts` (all; step 03 at lines 160-189 and 249-268 is the pattern), `questions.ts:183-200` (`SCREENS[3]`: stay, focus, earn, settle; stay and settle have `notSure: false`), `OnboardingPanel.tsx:20-60` (the band's words come from `ONBOARDING_STEPS[state + 1]`), the step 03 tests in `onboarding.test.ts` and `OnboardingPanel.test.tsx:139-150`.

- [ ] Step 1: write the failing tests, beside step 03's:
  - `QUESTION_STEPS[4].questions.map((q) => [q.key, q.slug])` equals `[['stay','stay'], ['focus','focus'], ['earn','earning'], ['settle','long-term']]`; each `why` is exactly intent criterion 3's line; each `question` is `SCREENS[3]`'s label (e.g. settle "Settle long-term, or come home eventually? (optional)").
  - `QUESTION_STEPS[4]`: `title` "After you graduate", `path` "/onboarding/after", `back` "/onboarding/living/climate", `nextName` "Three futures", `lastLabel` "Show me three futures", `leaveLabel` "Leave the rest for now: show me three futures".
  - `QUESTION_STEPS[1..3]` have no `lastLabel`/`leaveLabel` (their screens keep "Next: <nextName>" and "Leave the rest for now: go to <nextName>").
  - `questionBySlug(4, 'earning')?.key === 'earn'`; `questionBySlug(4, 'earn') === null` (a key is not a slug).
  - `askedQuestions(4, {})` is all four, in order, whatever the answers.
  - `firstOpenQuestion(4, {})` is `'stay'`; with stay and focus stored, `'earn'`; with all four stored, `'settle'`.
  - `forwardPath(3, answers)` is `'/onboarding/after'`; `forwardPath(4, answers)` is `'/futures'`.
  - `stepOfPath('/onboarding/after') === 4` and `stepOfPath('/onboarding/after/focus') === 4`.
  - `stepProgress('/onboarding/after/earning', {})` is `{ question: 3, total: 4 }`.
  - `PANEL_COPY[4]` equals `PANEL_COPY[3]`.
  - Panel at `/onboarding/after/focus`: 00 to 03 read Done, 04 is current with "Now · 2/4"; the band reads "Now: 04 After you graduate · 2 of 4" and "Next: Three futures"; "Step 4 of 6." is in the document; five segments have `data-lit="true"`.
- [ ] Step 2: run — `bun test src/features/opening/model/onboarding.test.ts src/features/opening/components/OnboardingPanel.test.tsx`; expected: FAIL (no step 4).
- [ ] Step 3: implement.
  - `OnboardingStep = 0 | 1 | 2 | 3 | 4`, `QuestionStep = 1 | 2 | 3 | 4`; `PANEL_COPY[4] = SIX_STEPS`.
  - `export const AFTER_PATH` (now exported) and `export const FUTURES_PATH = '/futures'`.
  - An `AFTER` record like `LIVING` (`Record<'stay' | 'focus' | 'earn' | 'settle', Pick<StepQuestion, 'why' | 'slug'>>`) with the slugs and whys above.
  - The step config type gains two optional fields: `lastLabel?: string` (the last question's forward button; default `Next: ${nextName}`) and `leaveLabel?: string` ("Leave the rest" link; default `Leave the rest for now: go to ${nextName}`). Step 4 sets both; the screen (task 2) reads them with those defaults.
  - `QUESTION_STEPS[4]`: built from `SCREENS[3]` as step 3 is (`group: ''`, `opensWithLine: false`, `question: question.label || item.title`), `back: \`${LIVING_PATH}/${LIVING.climate.slug}\``.
  - `forwardPath`: step 1 as today; step 2 `LIVING_PATH`; step 3 `AFTER_PATH`; step 4 `FUTURES_PATH`. Update its doc comment.
  - `stepOfPath`: `AFTER_PATH` and anything under it is 4.
  - Update the file's header comment (steps 01 to 04, `SCREENS[0]` to `SCREENS[3]`) and `QuestionScreen`-facing comments that say "steps 01 to 03" in this file.
  - `landing.ts` needs no change: `onboardingResumePath` already returns `/onboarding/after` for a student who left from step 04 or has seen her futures, and the bare page (task 2) redirects. Confirm `landing.test.ts` still passes.
- [ ] Step 4: run — `bun test src/features/opening src/shared` and `bun run type-check`; expected: PASS (fix any exhaustive `Record<QuestionStep, …>` or `Record<PanelState, …>` the type change breaks).
- [ ] Step 5: commit — `feat(onboarding): step 04 in the step model and the panel`.

## Task 2: The screen, the pages, and the old step 04 removed
**Delivers:** criteria 1 (pages, 404), 4, 5, 6, 7, 9 (bare page), 10; 11 is checked by the controller afterwards.
**Files:** modify `src/features/opening/components/QuestionScreen.tsx`, `src/features/opening/components/QuestionScreen.test.tsx`; create `src/app/(app)/onboarding/(shell)/after/page.tsx`, `src/app/(app)/onboarding/(shell)/after/[question]/page.tsx`; delete `src/app/(app)/onboarding/[step]/page.tsx`, `src/features/opening/components/OpeningScreen.tsx`, `src/features/opening/components/OpeningScreen.test.tsx`; modify `src/features/opening/index.ts`, `PRODUCT.md`.
**Kind:** judgement

Read first: `QuestionScreen.tsx` (all) and its step 03 tests, `AnswerCards.tsx` (a question with `notSure: false` lists its options as they are, so stay's "Not sure" is an ordinary card with no "?" mark: nothing to change), `src/app/(app)/onboarding/(shell)/living/page.tsx` and `living/[question]/page.tsx` (the pattern for the two pages), task 1's diff (`git show HEAD`), `src/design-systems/industry/DESIGN.md`.
Design: the renders in `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/design-04/` (`grad-<state>-<width>.png`; states `live` = stay unanswered, `stay-no`, `focus-unsure`, `last` = long-term with three answered, `save-failed` = earning failed; widths 390, 768, 1440, 1920). The canvas draws the panel #0077ed; the app's light panel is #0062c4 by Jenish's later decision (commit 7ff2929), so the panel colour is not a difference to fix. Markup and copy: `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/Grad.dc.html` (lines 85-178 and its script); styles: `…/project/facts.css` line 169-175 (the "Step 04" block: the last button "Show me three futures" has a minimum width of 13rem side by side, none on a phone). The question screen is step 03's, unchanged in look.

- [ ] Step 1: write the failing tests (behaviour only), beside step 03's in `QuestionScreen.test.tsx`:
  - step 4 at `/onboarding/after/stay`: the kicker reads "After you graduate · 1 of 4"; the cards are Yes, Not sure, No; the idle note reads "“Not sure” is a real answer here. Skip, and I'll use it."; Back pushes `/onboarding/living/climate`; the link "Leave the rest for now: show me three futures" points at `/futures`.
  - tapping stay's Not sure saves `stay` as "Not sure" stated (not assumed) and shows "Not sure: PR counts, but no route seals." with no Assumed chip; the forward reads Continue.
  - at `/onboarding/after/focus`, tapping Not sure shows "Not sure: I'll assume “Career-focused” and show it as a chip you can change." and the Assumed chip.
  - at `/onboarding/after/long-term`: "4 of 4", cards Settle long-term and Come home eventually with no Not sure, idle note "Optional. Skip, and it's left blank.", no "Leave the rest" link, the forward button reads "Show me three futures", is the strong variant even unanswered, and pushes `/futures`.
  - step 3's climate still reads "Optional. Skip, and it's left out." and its last button "Next: After you graduate" pushes `/onboarding/after` (existing tests may already hold this; keep them passing).
- [ ] Step 2: run — `bun test src/features/opening/components/QuestionScreen.test.tsx`; expected: FAIL (wording and notes).
- [ ] Step 3: implement.
  - `QuestionScreen`: read `lastLabel` and `leaveLabel` from `QUESTION_STEPS[step]` with the defaults task 1 names. Idle notes keyed by question for the two step 04 exceptions: `stay` "“Not sure” is a real answer here. Skip, and I'll use it." (stay has `notSure: false`, so `notesFor` would otherwise give the optional note) and `settle` "Optional. Skip, and it's left blank."; every other question keeps today's `notesFor`. The last button on step 4 takes a minimum width of 13rem side by side (`min-w-52`), none on a phone (`@max-xl:min-w-0`), as facts.css's `.gr .gr-show`; nothing else in the look changes. Update the component's doc comment (steps 01 to 04).
  - `(shell)/after/page.tsx`: as `living/page.tsx`: `redirect(questionPath(4, firstOpenQuestion(4, answers)))` (no person on step 04).
  - `(shell)/after/[question]/page.tsx`: as `living/[question]/page.tsx`: unknown slug `notFound()`; `markStep(user.id, 'after')`; `<QuestionScreen step={4} relative={profile.relative} saveAnswersAction={saveAnswersAction} />` (no person action: step 04 never asks her person). Run `bunx next typegen` before type-check so `PageProps<'/onboarding/after/[question]'>` exists.
  - Delete `[step]/page.tsx` (its only step, after, is now a page of its own; `/onboarding/<anything else>` was already a 404 there and stays one), `OpeningScreen.tsx` and its test; remove its export from `index.ts`. Then remove any module only it imported (check `OptionButtons`, `Progress` and `questions.ts` exports with grep: `AnswerCards`, `ChipEditor`, `FuturesScreen` and `CoinsScreen` still use some of them, so keep what they import). Check `next.config.ts`'s retired `/opening/after` redirect still lands on a page (`/onboarding/after`).
  - `PRODUCT.md`: the 04 row reads "After you graduate, one question per screen | `/onboarding/after/<question>`: `stay`, `focus`, `earning`, `long-term`"; the resume bullet names after with facts, study and living ("her first unanswered question when that step is facts, study, living or after"; a bare step list adds `/onboarding/after`).
- [ ] Step 4: run — `bun test src/features/opening`, `bunx next typegen`, `bun run type-check`, `bun run lint`; expected: PASS.
- [ ] Step 5: commit — `feat(onboarding): step 04 one question per screen`.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 slugs, marks step, 404 | 1, 2 | `onboarding.test.ts` (slugs, key is not a slug); pages: smoke test |
| 2 order, n of 4 | 1, 2 | `onboarding.test.ts` (`askedQuestions`); `QuestionScreen.test.tsx` (kicker) |
| 3 why lines | 1 | `onboarding.test.ts` |
| 4 cards, stay's Not sure real, defaults | 2 | `QuestionScreen.test.tsx` |
| 5 lines | 2 | `QuestionScreen.test.tsx` (stay Not sure, focus Not sure); the others are today's `impact.test.ts` |
| 6 notes | 2 | `QuestionScreen.test.tsx` |
| 7 Back, forward, Leave, links in | 1, 2 | `onboarding.test.ts` (`forwardPath`); `QuestionScreen.test.tsx` |
| 8 panel | 1 | `OnboardingPanel.test.tsx` |
| 9 resume | 1, 2 | `onboarding.test.ts` (`firstOpenQuestion(4, …)`); `landing.test.ts` (unchanged); bare page: smoke test |
| 10 old page removed, docs, suite | 2 | PRODUCT.md; `bun run test:run` once at the end |
| 11 boards | — | Not automatable: screenshots at 390, 768, 1440, 1920, both themes, by the controller |
