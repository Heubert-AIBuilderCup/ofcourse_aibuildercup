# Onboarding steps 00–01 as one system: Implementation Plan

**Intent:** docs/student-opening-three-futures/intent.md (this is a UI pass on that slice; the original build's plan is plan.md beside it, done)
**Goal:** Steps 00 (Your comic character) and 01 (Facts about you) share one onboarding shell built from the Claude Design canvas, and step 01 asks one question per screen, so steps 02–04 can move onto the same system later.
**Approach:** A route group `(onboarding)` gives `/picture` and `/opening/facts` one persistent layout: the steel panel (brand, step list, progress, duck), driven by a typed step model and the URL (`?q=<question>`). Step 01 is a config-driven question screen (radiogroup answer cards, the group's impact line, per-question save with retry) over the existing question model, defaults and impact lines, which stay the product truth. The canvas gives layout, copy and motion; the layout rules are the repo's (576/1024 container sizes, root scaling 1440→1920, 1920 cap), which the canvas now follows.
**Test layers:** Unit plus integration. The model pieces (step config, first-unanswered, impact view, save/retry state, radiogroup keys) are unit-tested with `bun run test:run`. Criteria 14, 23–27, 30 and 60 cross the browser, the server action and the database (a tap saves, a returning student lands on her first unanswered question, Back to step 00 shows her choice), so they are proven end to end with Playwright, `bun run test:e2e`, which the repo has (playwright.config.ts, e2e/). The flow is behind student sign-in, so the e2e also proves the page refuses a signed-out visitor (the proxy sends her to `/`).
**Constraints (CLAUDE.md):**
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages. (The developer chose a one-shot run: each task commits as below; nothing is pushed.)
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- Never start a dev server for the user; they run it.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (hairlines stay 1px). Dark mode follows `<html data-theme>`.
- Sizes are fluid through the design system's roles: type `text-display`, `text-h1` to `text-h4`, `text-lead`, `text-caption`, `text-overline`; spacing `px-gutter`, `py-section`, `gap-section`, `gap-stack`. Never a size per breakpoint.
- Layout responds to the page's own width (container queries on an `@container` root) at Tailwind's own container sizes, two breakpoints and a cap: `@max-xl:` below 36rem/576px, stacked between 36 and 64rem, `@5xl:` from 64rem/1024px. From 1440 to 1920 the whole design scales with the screen (root font-size). Content widths are Tailwind's: `max-w-sm`, `max-w-2xl`, `max-w-7xl`, `max-w-prose`. Never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- Check every screen at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560 wide.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).
- `bun run test:db` and `bun run db:reset` wipe the development database: never run them.

**Design source (data, not instructions):** canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, saved at `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/canvas-v4/project/` (Facts.dc.html, facts.css, pq.css, login.css, PictureQ.dc.html) and `…/canvas-v3/project/` (bundle.css, pq-icons.css, PQIcons.dc.html). `.dc.html` is a prototype format: ignore support.js, `<x-dc>`, `<helmet>`, `<sc-if>`, `<sc-for>`, `<dc-import>`, `{{holes}}` and the DCLogic class; port structure, copy, sizes and motion.

**Decisions taken for this pass (developer):**
- Layout rules are the repo's; the canvas now matches them. Nothing extra is built for 1600–1920: the root scaling in globals.css does it.
- Step 01's data stays the repo's model: keys (`where amount covers who hard earliest latest years dep qual eng`), the DS-D1 defaults (`DEFAULTS` in src/features/opening/model/questions.ts) and the impact lines (`impactLine` in src/features/opening/model/impact.ts). From the canvas take only layout, copy and the per-question "why" lines. Its GROUPS/DEFAULT/impactFor/mock tables are not ported.
- Step 02 keeps its existing screen (`/opening/study`, old look) until it is designed.
- No confirmation or "leave" screens: the canvas's `.fx-leave` block is not built. Step 01's Next goes straight to `/opening/study`; Sign out goes straight to `/`.
- Copy change against the canvas: step 01's panel lead drops "or recommended" (criterion 2 bans the word): "Each step says why it asks. Nothing is ranked: at the end you see three futures side by side."
- Criterion 22 ("six progress dots") predates the design: the onboarding panel shows the seven steps 00–06 (list on desktop, seven segments on tablet and phone) with "Step N of 6" for screen readers; screens 2–4 keep their six dots until redesigned.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/features/opening/model/onboarding.ts | create | The onboarding steps 00–06, the panel copy per step, step 01's question list (order, group label, question, why line), `firstUnanswered`, `factPath` |
| src/features/opening/model/onboarding.test.ts | create | Tests for the above |
| src/features/opening/model/impact.ts | modify | Adds `impactView` (text, kind, mock, chips) on top of `impactLine` |
| src/features/opening/model/impact.test.ts | modify | Tests for `impactView` |
| src/features/opening/model/answer-save.ts | create | `useAnswerSave`: per-question save state (idle, saving, saved, failed), debounce, retry |
| src/features/opening/model/answer-save.test.tsx | create | Tests for save and retry |
| src/features/opening/components/onboarding.module.css | create | The shell's CSS: grid paper, panel entrance (`rise`, d1–d8), duck bob, reduced motion (moved from picture.module.css) |
| src/features/opening/components/OnboardingShell.tsx | create | The `@container` page, `split-page` grid, the panel beside `children` |
| src/features/opening/components/OnboardingPanel.tsx | create | The steel panel for the current step, from the pathname and `?q` |
| src/features/opening/components/OnboardingPanel.test.tsx | create | Panel per step: heading, Done/Now marks, badge, progress text |
| src/features/opening/components/AnswerCards.tsx | create | A question's options as a radiogroup of cards, roving tabindex, "Not sure" last |
| src/features/opening/components/AnswerCards.test.tsx | create | Radiogroup keyboard and selection |
| src/features/opening/components/OptionButtons.tsx | modify | Exports `labelOf`, so cards and buttons read options alike |
| src/features/opening/components/FactsScreen.tsx | create | Step 01: one question per screen, impact view, save note, error and retry, Back / Skip / Continue / Next, Sign out |
| src/features/opening/components/FactsScreen.test.tsx | create | Step 01 behaviour |
| src/features/opening/components/facts.module.css | create | Step 01 motion: question slide-in, impact rise, card press |
| src/features/opening/components/PictureQuestion.tsx | modify | Drops its own page, grid and panel; renders the main column only |
| src/features/opening/components/picture.module.css | modify | Keeps only the figure, choice, tick, spin and error CSS |
| src/features/opening/components/PictureQuestion.test.tsx | modify | Panel assertions move to OnboardingPanel.test.tsx |
| src/features/opening/components/OpeningScreen.tsx | modify | Screen 2's Back goes to step 01's last question |
| src/features/opening/components/OpeningScreen.test.tsx | modify | That Back link |
| src/features/opening/index.ts | modify | Exports `OnboardingShell`, `FactsScreen` |
| src/app/(app)/(onboarding)/layout.tsx | create | The onboarding layout: `OnboardingShell` |
| src/app/(app)/(onboarding)/picture/page.tsx | create (moved) | Step 00, moved from src/app/(app)/picture/page.tsx |
| src/app/(app)/(onboarding)/opening/facts/page.tsx | create | Step 01: marks the step, redirects to a valid `?q`, renders `FactsScreen` |
| e2e/helpers/student.ts | modify | Step 01 walk: one question per screen |
| e2e/opening.e2e.ts | modify | Step 01 assertions on the new screens |
| e2e/coins-and-return.e2e.ts | modify | Resume on step 01 at the first unanswered question |
| e2e/onboarding.e2e.ts | create | Shell, keyboard, Back to step 00, Sign out and return, signed-out refusal |

## Task 1: Commit the approved work in the tree
**Delivers:** nothing new; puts the developer-approved, uncommitted work (layout decision and page frame; step 00 from the design and Back from screen 1) into two commits before this plan's changes.
**Files:** the working tree as it is: CLAUDE.md, src/app/globals.css, src/design-systems/industry/DESIGN.md, src/design-systems/industry/theme.css, src/app/page.tsx, src/app/admin/sign-in/page.tsx, src/features/auth/components/SignInPanel.tsx, src/features/auth/components/StudentSignIn.tsx (layout); src/app/(app)/picture/page.tsx, src/features/opening/components/PictureQuestion.tsx, PictureQuestion.test.tsx, picture.module.css, OpeningScreen.tsx, OpeningScreen.test.tsx, e2e/opening.e2e.ts (step 00 and Back).
**Kind:** transcription
- [ ] Step 1: run the checks on the tree as it is — `bun run lint && bun run type-check && bun run test:run`; expected: lint "No fixes applied", no type errors, "0 fail".
- [ ] Step 2: commit the layout — `git add CLAUDE.md src/app/globals.css src/design-systems/industry/DESIGN.md src/design-systems/industry/theme.css src/app/page.tsx src/app/admin/sign-in/page.tsx src/features/auth/components/SignInPanel.tsx src/features/auth/components/StudentSignIn.tsx` then `git commit -m "feat(layout): Tailwind container breakpoints, 1440–1920 scaling and the split-page frame"`. The pre-commit hook runs lint-staged and type-check; expected: commit created.
- [ ] Step 3: commit step 00 — `git add "src/app/(app)/picture/page.tsx" src/features/opening/components/PictureQuestion.tsx src/features/opening/components/PictureQuestion.test.tsx src/features/opening/components/picture.module.css src/features/opening/components/OpeningScreen.tsx src/features/opening/components/OpeningScreen.test.tsx e2e/opening.e2e.ts` then `git commit -m "feat(onboarding): step 00 from the design, and Back from screen 1"`; expected: commit created and `git status --short` shows only `docs/student-opening-three-futures/plan-onboarding-ui.md` untracked (commit that file with step 00 if it is still untracked: `git add docs/student-opening-three-futures/plan-onboarding-ui.md` before the second commit).

## Task 2: The onboarding model
**Delivers:** criteria 2 (panel copy), 22 (the steps the panel shows), 23 (step 01's questions, in order), 60 (where a returning student lands on step 01).
**Files:** create src/features/opening/model/onboarding.ts, src/features/opening/model/onboarding.test.ts.
**Kind:** judgement
- [ ] Step 1: write the failing tests in `onboarding.test.ts` (pattern: src/features/opening/model/landing.test.ts). Assertions:
  - `FACT_QUESTIONS.map((q) => q.key)` equals `['where', 'amount', 'covers', 'who', 'hard', 'earliest', 'latest', 'years', 'dep', 'qual', 'eng']`.
  - `FACT_QUESTIONS[0]` has `group: ''`, `question: 'Where are you right now?'`, `itemId: 'where'`; `FACT_QUESTIONS[1]` has `group: 'Your budget per year'`, `question: 'Amount'`, `itemId: 'budget'`; `FACT_QUESTIONS[8]` has `group: ''`, `question: 'Anyone coming with you?'`.
  - every `FACT_QUESTIONS[i].why` is a non-empty string, and `FACT_QUESTIONS[0].why` is `"It decides whether you'd apply for a visa from home or from inside Australia, and which fees apply."`.
  - `firstUnanswered({})` is `'where'`; with `where` and `amount` answered (`{ value: …, state: 'stated' }`) it is `'covers'`; an answer with `state: 'assumed'` counts as answered; with all eleven answered it is `'eng'`.
  - `factPath('amount')` is `'/opening/facts?q=amount'`; `factIndex('amount')` is `1`; `factIndex('field')`, `factIndex('nope')` and `factIndex(null)` are `-1`.
  - `stepOfPath('/picture')` is `0`, `stepOfPath('/opening/facts')` is `1`, `stepOfPath('/opening/study')` is `null`.
  - `ONBOARDING_STEPS` equals `['Your comic character', 'Facts about you', "What you'd study", "Where and how you'd live", 'After you graduate', 'Three futures', 'Your attention']`.
  - `PANEL_COPY[0]` is `{ title: 'Before we start', lead: 'One optional question, then six short steps. Each step says why it asks, and “Not sure” is always a fine answer.' }`; `PANEL_COPY[1]` is `{ title: 'Six short steps', lead: 'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.' }`; neither contains "recommended" or "best" (criterion 2).
- [ ] Step 2: run it — `bun test src/features/opening/model/onboarding.test.ts`; expected: FAIL, "Cannot find module './onboarding'".
- [ ] Step 3: implement `onboarding.ts`. Pure, client-safe (no server imports). Interface, exactly:
  ```ts
  export const ONBOARDING_STEPS: readonly string[] // the seven titles above, step 00 first
  export type OnboardingStep = 0 | 1 // the steps built on the onboarding shell so far
  export const PANEL_COPY: Readonly<Record<OnboardingStep, { title: string; lead: string }>>
  export type FactQuestion = {
    key: QuestionKey
    itemId: string // the Item.id in SCREENS[0], whose impact line this question shows
    group: string // the item's title when the item asks more than one question, else ''
    question: string // the question's label, else the item's title
    why: string
  }
  export const FACT_QUESTIONS: readonly FactQuestion[]
  export const FACTS_PATH = '/opening/facts'
  export const STUDY_PATH = '/opening/study'
  export function factPath(key: QuestionKey): string
  export function factIndex(key: string | null | undefined): number
  export function firstUnanswered(answers: StoredAnswers): QuestionKey
  export function stepOfPath(pathname: string): OnboardingStep | null
  ```
  Build `FACT_QUESTIONS` from `SCREENS[0].items` (src/features/opening/model/questions.ts:62), so the order and the questions stay the model's; only the why lines are new, in a `WHY: Record<…>` keyed by question key, copy from the canvas's `WHY` (Facts.dc.html, the `const WHY` block) with the repo's keys and straight apostrophes:
  where "It decides whether you'd apply for a visa from home or from inside Australia, and which fees apply." · amount "It decides which cities stay open on each route. A rough number is fine." · covers "It tells me whether living costs come out of this amount or sit on top of it." · who "It shapes how each route shows the money a visa asks you to have." · hard "A hard limit closes cities above it. Roughly keeps them open, marked as a stretch." · earliest "It sets the first intake each route can show." · latest "With your earliest start, it decides which intakes stay open." · years "It decides which course lengths each route shows." · dep "Who comes along changes the living costs on each route." · qual "It decides which course levels you can enter." · eng "It decides whether a route needs an English course or a pathway first."
  `firstUnanswered`: the first key of `FACT_QUESTIONS` with `answers[key] === undefined`; all answered: the last key. (A question left blank reads as its DS-D1 default, assumed, everywhere downstream already: `isAssumed` and `effective` in questions.ts:266–274, so Skip stores nothing.)
- [ ] Step 4: run it — `bun test src/features/opening/model/onboarding.test.ts`; expected: PASS.
- [ ] Step 5: commit — `git add src/features/opening/model/onboarding.ts src/features/opening/model/onboarding.test.ts && git commit -m "feat(onboarding): the onboarding steps and step 01's question list"`.

## Task 3: The impact view
**Delivers:** criteria 3 (a mock figure is labelled mock), 24, 25, 26, 27 (the line's text, unchanged, now with its kind).
**Files:** modify src/features/opening/model/impact.ts, src/features/opening/model/impact.test.ts.
**Kind:** judgement
- [ ] Step 1: add failing tests to `impact.test.ts` (its existing `describe` style). Assertions:
  - `impactView('budget', { amount: { value: 36, state: 'stated' } }, null)` equals `{ text: "About AUD 36k a year. Tell me if it's a hard limit.", kind: 'plain', mock: false, chips: [] }`.
  - `impactView('budget', { amount: { value: 30, state: 'assumed' } }, null)` equals `{ text: "Not sure: I'll assume “AUD 30k” and show it as a chip you can change.", kind: 'assume', mock: false, chips: [] }`.
  - with `amount` and `covers` both `state: 'assumed'` (covers' value `'Fees only'`, its default), `.chips` equals `['Fees only']` and `.kind` is `'assume'`.
  - `impactView('dep', { dep: { value: 'Partner', state: 'stated' } }, null)` is `{ text: "Family isn't covered in this preview yet, so every route shows costs for you alone.", kind: 'limit', mock: false, chips: [] }`; the same for `'Partner and children'`; `'No one'` gives `kind: 'plain'`.
  - `impactView('level', { level: { value: "Master's", state: 'stated' } }, null)` equals `{ text: "Master's: 18 months to 2 years, building on your degree", kind: 'plain', mock: true, chips: [] }` (the line ends with `MOCK`, impact.ts:30, which the view strips into `mock: true`).
  - `impactView('where', {}, null)` is `null`; `impactView('nope', {}, null)` is `null`.
  - For every item, `impactView(...)?.text` plus `' · mock'` when `mock` equals `impactLine(...)` (one check over a few answer sets, so the view never changes a line).
- [ ] Step 2: run it — `bun test src/features/opening/model/impact.test.ts`; expected: FAIL, "impactView is not a function" (or not exported).
- [ ] Step 3: implement in impact.ts, beside `impactLine` (impact.ts:285):
  ```ts
  export type ImpactKind = 'plain' | 'assume' | 'limit'
  export type ImpactView = { text: string; kind: ImpactKind; mock: boolean; chips: string[] }
  export function impactView(itemId: string, answers: StoredAnswers, relative: Relative | null): ImpactView | null
  ```
  It calls `impactLine` and never writes copy of its own. `mock`: the line ends with `MOCK`; `text` is the line without it. `kind`: `'assume'` when the line came from `notSureLine` (the same visible-assumed-question test `impactLine` uses; compute it once and share it, not twice); `'limit'` when `itemId === 'dep'` and `answers.dep` is stated `'Partner'` or `'Partner and children'`; else `'plain'`. `chips`: only with `kind: 'assume'`, the item's other visible questions answered "Not sure" after the first, each as `assumedText(key, DEFAULTS[key])` (impact.ts:35), in the item's order.
- [ ] Step 4: run it — `bun test src/features/opening/model/impact.test.ts`; expected: PASS.
- [ ] Step 5: commit — `git add src/features/opening/model/impact.ts src/features/opening/model/impact.test.ts && git commit -m "feat(onboarding): the impact line's kind, mock tag and assumed chips"`.

## Task 4: Save and retry, per question
**Delivers:** the save behaviour of criteria 25–27 and 60 (every tap is saved, a failure keeps the answer and offers Try again).
**Files:** create src/features/opening/model/answer-save.ts, src/features/opening/model/answer-save.test.tsx.
**Kind:** judgement
- [ ] Step 1: write the failing tests with `renderHook`, `act` and `waitFor` from `@testing-library/react` (happy-dom is preloaded, test/setup/happydom.ts; real timers, the debounce is short). The action is a `mock(async () => ({ ok: true }))` from `bun:test`. Assertions:
  - `statusOf('amount')` is `'idle'` before any save.
  - after `save('amount', 36)`: `statusOf('amount')` is `'saving'` at once; the action is not called before `SAVE_DEBOUNCE_MS`; then it is called once with `{ amount: 36 }`, and `statusOf('amount')` becomes `'saved'`.
  - `save('amount', 30)` then `save('amount', 36)` within the debounce: the action is called once, with `{ amount: 36 }`.
  - `save('amount', 36)` and `save('covers', 'Fees only')`: two calls, one per key.
  - the action resolving `{ ok: false, error: 'x' }`: status `'failed'`; then `retry('amount')`: status `'saving'` at once, the action called again with `{ amount: 36 }` without waiting for the debounce, and `'saved'` when it resolves `{ ok: true }`.
  - the action rejecting: status `'failed'`.
  - a result that comes back after a newer `save` for the same key has started does not change that key's status.
  - unmounting before the debounce: the action is never called.
- [ ] Step 2: run it — `bun test src/features/opening/model/answer-save.test.tsx`; expected: FAIL, "Cannot find module './answer-save'".
- [ ] Step 3: implement `answer-save.ts` (`'use client'` is not needed in a hook module; it is only imported by client components):
  ```ts
  export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'
  export const SAVE_DEBOUNCE_MS = 300
  export type SaveAnswers = (patch: Partial<Record<QuestionKey, AnswerValue>>) => Promise<ActionResult>
  export function useAnswerSave(saveAnswersAction: SaveAnswers): {
    statusOf: (key: QuestionKey) => SaveStatus
    save: (key: QuestionKey, raw: AnswerValue) => void
    retry: (key: QuestionKey) => void
  }
  ```
  `raw` is what the tap gave (an option, or `NOT_SURE`), as `saveAnswersAction` takes it (src/features/opening/actions.ts: `saveAnswersAction(patch)` parses each entry with `parseAnswer` and returns `ActionResult`, never throws; a network failure still rejects the call, so catch it). One timer and one sequence number per key in refs; status in state. Clear every timer on unmount.
- [ ] Step 4: run it — `bun test src/features/opening/model/answer-save.test.tsx`; expected: PASS.
- [ ] Step 5: commit — `git add src/features/opening/model/answer-save.ts src/features/opening/model/answer-save.test.tsx && git commit -m "feat(onboarding): save each answer as it is tapped, with retry"`.

## Task 5: The onboarding shell and panel, with step 00 moved onto it
**Delivers:** criteria 2 and 22 on the panel; the shared layout steps 01–04 will use. Step 00 must look exactly as it does now.
**Files:** create src/features/opening/components/onboarding.module.css, OnboardingShell.tsx, OnboardingPanel.tsx, OnboardingPanel.test.tsx, src/app/(app)/(onboarding)/layout.tsx; move src/app/(app)/picture/page.tsx to src/app/(app)/(onboarding)/picture/page.tsx (`git mv`); modify PictureQuestion.tsx, picture.module.css, PictureQuestion.test.tsx, src/features/opening/index.ts.
**Kind:** judgement
- [ ] Step 1: before changing anything, take step 00's "before" screenshots: a temporary spec `e2e/zz-shots.e2e.ts` (deleted at the end of Task 9) using `newStudent` and `skipSplash` from e2e/helpers/student.ts, `test.use({ reducedMotion: 'reduce' })`, viewport heights 900 (1080 from 1920), `fullPage: true`, at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920, 2560, for `/picture` with nothing chosen and with Female chosen; `SHOT_LABEL=before bun run test:e2e -- e2e/zz-shots.e2e.ts --reporter=line`, saved under `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/onb/<label>/`.
- [ ] Step 2: write the failing `OnboardingPanel.test.tsx` (mock `next/navigation` as PictureQuestion.test.tsx:12 does, with `usePathname` and `useSearchParams` returning the case's path and `new URLSearchParams(…)`; next/image needs the happy-dom URL set, PictureQuestion.test.tsx:19–24). Assertions:
  - `/picture`: `heading level 2 'Before we start'`; the lead text from `PANEL_COPY[0]`; `list 'Your steps'` has 7 items, item 0 has `aria-current="step"` and text `'00Your comic characterNow · optional'`, no item contains "Done"; `'Step 0 of 6.'`; `'Now: Your comic character · optional'`; `'Next: Facts about you'`; `'From off course to “Of Course!”'`.
  - `/opening/facts` with `q=amount`: `heading level 2 'Six short steps'`; item 0 contains "Done"; item 1 has `aria-current="step"` and contains `'Now · 2/11'`; `'Step 1 of 6.'`; `'Now: 01 Facts about you · 2 of 11'`; `'Next: What you'd study'`; the panel's text does not contain "recommended".
  - `/opening/facts` with no `q`: item 1 contains `'Now · 1/11'`.
- [ ] Step 3: run it — `bun test src/features/opening/components/OnboardingPanel.test.tsx`; expected: FAIL, "Cannot find module './OnboardingPanel'".
- [ ] Step 4: implement.
  - `OnboardingPanel` (client): the `Panel` function now in PictureQuestion.tsx (its `aside`, brand, side text, step list, compact progress, duck dock: PictureQuestion.tsx `function Panel`), generalised: `const step = stepOfPath(usePathname()) ?? 0`, `const index = factIndex(useSearchParams().get('q'))` (`-1` reads as the first question). Copy from `PANEL_COPY[step]` and `ONBOARDING_STEPS`. Steps before `step` show a check (Lucide `Check`, 0.75rem) and "Done" in the badge column (canvas `.pq-done-mark`: text-micro, uppercase, `text-panel-foreground/70`) and the row at `text-panel-foreground/82`; the current step keeps `aria-current="step"` and the badge (step 0: "Now · optional"; step 1: `Now · ${index + 1}/${FACT_QUESTIONS.length}`). Segments: done `bg-panel-accent/55`, now `bg-panel-accent`, later `bg-panel-foreground/22`. Progress text: step 0 as today; step 1 `<sr>Step 1 of 6. </sr>Now: 01 Facts about you · ${n} of 11` / `Next: What you'd study`. The `aside` keeps `aria-label="Getting started"`; the `ol` is `aria-label="Your steps"`. On the side-by-side layout the panel is sticky at full height (canvas facts.css `.fx-layout > .pq-side{position:sticky;top:0;height:100vh;align-self:start}`): `@5xl:sticky @5xl:top-0 @5xl:h-dvh @5xl:self-start` (with `@max-5xl:` the band is static, as now).
  - `OnboardingShell({ children })`: the page and grid PictureQuestion renders today (PictureQuestion.tsx: the outer `@container` div and the `split-page … [--split-panel:5/12] @max-5xl:grid-cols-1 @max-5xl:grid-rows-[auto_1fr]` grid), the panel, and the main column div with its padding classes (the div right after `<Panel />`) holding `children`. The content wrapper (`mx-auto flex w-full max-w-2xl flex-col gap-6 @max-xl:gap-4.5`) stays in each step, since each step sets its own gap.
  - `onboarding.module.css`: move from picture.module.css every rule the panel and page use (the page class, `grid`, `onPanel`, `duck` and its bob, `rise` and `d1`–`d8`, and their reduced-motion rules); picture.module.css keeps the choices, figures, tick, spin, error and their motion. One definition each: nothing duplicated across the two files.
  - `src/app/(app)/(onboarding)/layout.tsx`: `export default function OnboardingLayout({ children }: LayoutProps<'/'>)` returns `<OnboardingShell>{children}</OnboardingShell>` (the `(app)` layout above it already requires a student). Verified: route groups leave the URL as it is, and groups must not resolve to the same path (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md, "Conflicting paths"); `/picture` and, in Task 7, `/opening/facts` are unique, and a static segment takes precedence over `src/app/(app)/opening/[step]`. A layout persists across navigations between its pages, so the panel does not re-render or replay its entrance moving from 00 to 01.
  - `PictureQuestion`: returns only its content wrapper (hello, question, choices, note, error, actions, status); `Panel` and the page/grid/main wrappers go. Export `OnboardingShell` from src/features/opening/index.ts.
  - PictureQuestion.test.tsx: the "shows where she is" test moves into OnboardingPanel.test.tsx (above); the rest stays and passes.
- [ ] Step 5: run — `bun test src/features/opening/components/ && bun run type-check`; expected: PASS, no type errors.
- [ ] Step 6: `SHOT_LABEL=after` the same shots; compare each pair with Python PIL (`ImageChops.difference(a, b).getbbox() is None`, run with `python3 -I`); expected: every width identical. A difference is a bug in this task: fix it, re-shoot.
- [ ] Step 7: commit — `git add -A src/features/opening "src/app/(app)" && git commit -m "refactor(onboarding): one shell and panel for the onboarding steps"` (the temporary spec stays out: never `git add e2e/zz-shots.e2e.ts`).

## Task 6: Answer cards, a radiogroup
**Delivers:** criteria 23 (every step 01 question answers by cards), 26 ("Not sure" on every question, last); the keyboard and screen-reader behaviour the developer asked for.
**Files:** create src/features/opening/components/AnswerCards.tsx, AnswerCards.test.tsx; modify src/features/opening/components/OptionButtons.tsx (export `labelOf`, one definition of how an option reads).
**Kind:** judgement
- [ ] Step 1: write the failing `AnswerCards.test.tsx` (render with `questionOf('amount')` and `questionOf('dep')` from model/questions; `onAnswer = mock(() => {})`). Assertions:
  - `getByRole('radiogroup', { name: 'Amount' })` (labelled by a test `<h1 id>`), with radios in order `'AUD 24k', 'AUD 30k', 'AUD 36k', 'AUD 42k', 'Not sure'`.
  - nothing answered: no radio has `aria-checked="true"`; the first radio has `tabIndex 0`, every other `-1`.
  - clicking `'AUD 36k'` calls `onAnswer(36)`.
  - `answer={{ value: 36, state: 'stated' }}`: `'AUD 36k'` is `aria-checked="true"` with `tabIndex 0`, the others `-1`; clicking it again calls nothing.
  - `answer={{ value: 30, state: 'assumed' }}`: `'Not sure'` is checked (not `'AUD 30k'`).
  - keyboard on the checked `'AUD 36k'`: `ArrowRight` and `ArrowDown` call `onAnswer(42)` and move focus to `'AUD 42k'`; from `'Not sure'`, `ArrowRight` wraps to `onAnswer(24)`; `ArrowLeft`/`ArrowUp` go back one; `Home` gives `24`, `End` gives `'Not sure'` (the string `NOT_SURE`).
  - the grid class follows the card count: 4 cards (`dep`: 3 options and Not sure) have the two-column class; 5 or more the three-column class.
- [ ] Step 2: run it — `bun test src/features/opening/components/AnswerCards.test.tsx`; expected: FAIL, "Cannot find module './AnswerCards'".
- [ ] Step 3: implement:
  ```tsx
  export function AnswerCards(props: {
    question: Question // a single-choice question ('chips' or 'select'); 'multi' is not used on step 01
    labelledBy: string // the id of the h1 that asks it
    answer: StoredAnswer | undefined
    onAnswer: (raw: AnswerValue) => void
  }): JSX.Element
  ```
  A `div role="radiogroup" aria-labelledby` holding one `button type="button" role="radio" aria-checked` per option, labels by `labelOf` (OptionButtons.tsx, now exported), then "Not sure" when `question.notSure`. Checked: a stated answer equal to the option; "Not sure" when the answer is assumed. Roving tabindex and keys as the canvas's `key()` handler (Facts.dc.html, `key(e, f, list, i)`), which picks as it moves. Cards from facts.css `.fx-card` in the repo's terms, no Blueprint corner marks: `relative flex min-h-16 items-center gap-2.5 py-3 pr-10 pl-4 text-left font-heading text-h4 font-semibold border` (hairline, `border-border`), hover `hover:not-aria-checked:border-foreground/40 hover:not-aria-checked:bg-foreground/4`, checked `aria-checked:border-accent-700 aria-checked:bg-accent-100 aria-checked:text-accent-800 aria-checked:inset-ring aria-checked:inset-ring-accent-700` (step 00's chosen style, PictureQuestion.tsx), focus `focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary`; "Not sure" `border-dashed font-sans text-base font-medium text-muted-foreground aria-checked:border-solid` with a 1.25rem circled "?" (`aria-hidden`); a tick badge `aria-hidden` (picture.module.css `.tick`, reused by import, not copied) at `absolute top-1/2 right-3 -translate-y-1/2`, scaled in when checked. Grid: `grid gap-3 mt-1`, 4 cards `grid-cols-2`, else `grid-cols-3`; phone `@max-xl:gap-2.5` and `@max-xl:grid-cols-1` for 4 or fewer cards, else `@max-xl:grid-cols-2`; phone cards `@max-xl:min-h-14 @max-xl:text-lg`. Touch targets are at least 2.75rem (min-h-14).
- [ ] Step 4: run it — `bun test src/features/opening/components/AnswerCards.test.tsx`; expected: PASS.
- [ ] Step 5: commit — `git add src/features/opening/components/AnswerCards.tsx src/features/opening/components/AnswerCards.test.tsx src/features/opening/components/OptionButtons.tsx && git commit -m "feat(onboarding): answer cards as a keyboard radiogroup"`.

## Task 7: Step 01, one question per screen
**Delivers:** criteria 14 (Start opens step 01), 23, 24, 25, 26, 27, 30 (Back keeps answers), 60 (a returning student lands on her first unanswered question).
**Files:** create src/features/opening/components/FactsScreen.tsx, FactsScreen.test.tsx, facts.module.css, src/app/(app)/(onboarding)/opening/facts/page.tsx; modify src/features/opening/components/OpeningScreen.tsx, OpeningScreen.test.tsx, src/features/opening/index.ts.
**Kind:** judgement
- [ ] Step 1: write the failing `FactsScreen.test.tsx`. Mock `next/navigation` (`useRouter` with `push`, `useSearchParams` returning the case's `q`, `usePathname` `'/opening/facts'`) and spy `window.history.pushState`; the action is a `mock` resolving `{ ok: true }`; mock `@/shared/lib/auth/client` `signOut`. Assertions:
  - `q=amount`: text `'Facts about you · 2 of 11'`; group label `'Your budget per year'`; `heading level 1 'Amount'`; the why line `'It decides which cities stay open on each route. A rough number is fine.'`; `radiogroup 'Amount'`; buttons `'Back'` and `'Skip'`; link `"Leave the rest for now: go to What you'd study"` with `href '/opening/study'`; a `'Sign out'` button; the note `'“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later.'`; no impact line.
  - tap `'AUD 36k'`: `'About AUD 36k a year. Tell me if it's a hard limit.'` shows at once; the forward button reads `'Continue'`; the note reads `'Saving…'`, then (waitFor) `'Saved. Tap another answer to change it.'`; the action was called with `{ amount: 36 }`.
  - tap `'Not sure'` on `q=amount`: `"Not sure: I'll assume “AUD 30k” and show it as a chip you can change."`.
  - `q=dep`, tap `'Partner'`: `"Family isn't covered in this preview yet, so every route shows costs for you alone."`, and no textbox appears.
  - a mock line shows the tag: with `answers` holding `latest` stated (`'Jul 2027'`) on `q=latest`, the impact shows the text `'mock'` as its own element, and the line's text has no trailing `' · mock'`.
  - `q=where`, `'Back'`: `push('/picture')`. `q=amount`, `'Back'`: `pushState` to `'/opening/facts?q=where'`. `'Continue'` after a tap: `pushState` to `'/opening/facts?q=covers'`; `'Skip'` with nothing tapped: the same, and the action not called.
  - `q=eng`: the forward button reads `"Next: What you'd study"` and calls `push('/opening/study')`; no "Leave the rest" link.
  - a refused save (`{ ok: false, error: 'x' }`): alert `"We couldn't save that. Your answer is still here. Check your connection and try again."` with a `'Try again'` button; the tapped radio stays checked; `'Try again'` calls the action again with the same patch.
  - after `'Continue'`, the new `heading level 1` has focus (rerender with the next `q`).
- [ ] Step 2: run it — `bun test src/features/opening/components/FactsScreen.test.tsx`; expected: FAIL, "Cannot find module './FactsScreen'".
- [ ] Step 3: implement.
  - `FactsScreen({ answers, relative, saveAnswersAction })` (client): props as `OpeningScreen`'s (OpeningScreen.tsx:90–102), with `saveAnswersAction: SaveAnswers` from Task 4. The current question is `factIndex(useSearchParams().get('q'))`, `0` when `-1`. Answers in local state; a tap parses with `parseAnswer(key, raw)` (questions.ts:309), sets the answer, and calls `save(key, raw)` from `useAnswerSave`; a tap on the checked card does nothing (AnswerCards). Navigation: before the first question `router.push('/picture')`; after the last `router.push(STUDY_PATH)`; otherwise `window.history.pushState(null, '', factPath(next))`, which syncs with `useSearchParams` (verified: node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:345–347), then scroll to the top if the screen's top is above the viewport. Skip stores nothing (Task 2's note).
  - Layout, in the content wrapper `mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4` (canvas `.fx .pq-content`): a top row `flex min-h-11 items-center justify-between gap-4` with the kicker (`text-overline uppercase text-accent-700`, `Facts about you · <b class="font-medium text-muted-foreground">N of 11</b>`) and the existing `SignOutButton` (src/features/auth/components/SignOutButton.tsx; it signs out and replaces to `/`); then the question block, keyed by the question so it remounts and its children slide in (facts.module.css): group label (`text-lead text-muted-foreground`, only when `group`), `h1` (`id`, `tabIndex={-1}`, `font-heading text-h1 font-semibold tracking-[-0.015em] outline-none`, focused with `preventScroll` whenever the question changes after the first render), the why line (`max-w-prose leading-relaxed text-muted-foreground`), `AnswerCards`, the impact (an `aria-live="polite"` wrapper; only once this question is answered, `impactView(item.itemId, answers, relative)`: `flex items-start gap-2.5 border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3` with a Lucide icon, `border-dashed` for `assume`, `border-neutral-600 bg-neutral-100` for `limit`; text, then for `mock` ` · ` and a `<span>mock</span>` tag (canvas `.fx-mock`: `text-micro uppercase tracking-wide border border-dashed border-neutral-500 px-1.5 text-muted-foreground`); chips under it, each `<b>Assumed</b>` and the value, canvas `.fx-chip`), then the save status: `failed`: the alert (step 00's error block, PictureQuestion.tsx, plus a `Try again` outline button calling `retry(key)`), else the note in a `role="status"` paragraph with an icon (LoaderCircle spinning while saving, Check when saved, Info idle) and the copy above; then, except on the last question, the "Leave the rest for now" `Link` (`text-caption font-medium text-accent-700 min-h-11 self-start`); then the actions as step 00's (`flex justify-between`, the same phone sticky bar classes as PictureQuestion's actions): `Back` (outline, `@max-xl:flex-none @max-xl:min-w-24`), and the forward button: last question `"Next: What you'd study"` (strong), answered `Continue` (strong), else `Skip` (outline); arrow icons as step 00.
  - `facts.module.css`: the question block's children slide in (`fx-in`: from `opacity:0; translateY(0.625rem)`, 0.55s, `--ease-out` from onboarding.module.css or restated once, staggered 0, .05, .1, .15, .2s by child), the impact rises in when its text changes (key it by the text), the checked card presses (`fx-tap` 0.4s); all inside `@media (prefers-reduced-motion: no-preference)`.
  - The page `src/app/(app)/(onboarding)/opening/facts/page.tsx`: `export default async function FactsPage({ searchParams }: PageProps<'/opening/facts'>)`; `requireStudent()`; `getProfile` and `markStep(user.id, 'facts')` together (as src/app/(app)/opening/[step]/page.tsx does); when `q` is not a step 01 key (`factIndex` is `-1`), `redirect(factPath(firstUnanswered(profile.answers)))`; else render `FactsScreen` with the profile's answers and relative and `saveAnswersAction` from src/features/opening/actions.ts. `PageProps<'/opening/facts'>` is generated by Next's typegen once the route exists; run `bun run build` (or `bun run type-check` after a build) to confirm both `/opening/facts` and `/opening/[step]` are listed.
  - OpeningScreen.tsx: screen 2's Back goes to step 01's last question, `factPath('eng')` (from Task 2), so she lands on her answers rather than on the first unanswered one; OpeningScreen.test.tsx's `show(1)` Back href becomes `'/opening/facts?q=eng'`.
  - Export `FactsScreen` from src/features/opening/index.ts.
- [ ] Step 4: run — `bun run test:run && bun run type-check && bun run build`; expected: "0 fail", no type errors, the build lists `/opening/facts`.
- [ ] Step 5: commit — `git add -A src/features/opening "src/app/(app)" && git commit -m "feat(onboarding): step 01, one question per screen"`.

## Task 8: End-to-end on the new step 01
**Delivers:** the integration proof of criteria 14, 22, 24–27, 30, 60 and the signed-out refusal; the existing walks updated for one question per screen.
**Files:** modify e2e/helpers/student.ts, e2e/opening.e2e.ts, e2e/coins-and-return.e2e.ts; create e2e/onboarding.e2e.ts.
**Kind:** judgement
- [ ] Step 1: e2e/helpers/student.ts. Add a step 01 tap that goes to the question by URL: a local `FACT_KEYS: Record<string, string>` from the question as the screen asks it to its key (`'Where are you right now?': 'where'`, `Amount: 'amount'`, `'It covers': 'covers'`, `'Who pays': 'who'`, `'Is this a hard limit, or roughly?': 'hard'`, `'Earliest start': 'earliest'`, `"Latest you'd accept": 'latest'`, `"Most years you'd give it": 'years'`, `'Anyone coming with you?': 'dep'`, `'Last qualification': 'qual'`, `'English test': 'eng'`) and `export async function answerFact(page: Page, [question, option]: Tap)`: `page.goto('/opening/facts?q=' + FACT_KEYS[question])`, click `page.getByRole('radiogroup', { name: question }).getByRole('radio', { name: option, exact: true })`, expect it `aria-checked="true"` and the text `'Saved. Tap another answer to change it.'` visible. `answerOpening` (student.ts:65) answers `facts` with `answerFact`, then `page.goto('/opening/study')` and walks the remaining three screens as now (its local `SCREENS` drops the facts entry). `PRIYA` is unchanged.
- [ ] Step 2: e2e/opening.e2e.ts, for both sizes. After Start: URL `/\/opening\/facts\?q=where$/` and `heading level 1 'Where are you right now?'` within 3 s (criterion 14 keeps its timing); `getByText('Facts about you · 1 of 11')`; `getByText('Step 1 of 6.')` replaces `getByLabel('Step 1 of 6')` (criterion 22, the panel). The Back to step 00 block stays (URL `/picture`, Female pressed, Start). Then on `where`: tap `'Nepal'` → `'Nepal: visa required · study fees apply'` within 300 ms; tap `'Australia (on a visa)'` → `/^In Australia: you may apply onshore/` within 300 ms and the Nepal line gone (criteria 24, 25). `Continue` → `?q=amount`: `'AUD 36k'` → `"About AUD 36k a year. Tell me if it's a hard limit."` within 300 ms; `'Not sure'` → the assume line and `profileOf(email).answers.amount` polls to `{ value: 30, state: 'assumed' }` (criterion 26). `answerFact` on `'Anyone coming with you?'`/`'Partner'` → the family line, no textbox, `answers.dep` `{ value: 'Partner', state: 'stated' }` (criterion 27). The rest of the spec (screens 2–4, Back keeps answers, futures) stays, with step 02's Back now landing on `/opening/facts?q=eng` with `'English test'` as the heading; then go to `?q=amount` and `'Not sure'` is still checked (criterion 30).
- [ ] Step 3: e2e/coins-and-return.e2e.ts (lines 100–160): the returning student who answered `Amount` lands, after signing in again, on `/opening/facts?q=where` (her first unanswered question, criterion 60); on `?q=amount`, `'AUD 36k'` is `aria-checked="true"`; replace `tap(…, ['Amount', …])` with `answerFact`.
- [ ] Step 4: e2e/onboarding.e2e.ts, new:
  - keyboard only: on `?q=covers`, focus the radiogroup's first radio with Tab from the h1, `ArrowRight` checks `'Fees and living'` and `profileOf` polls to it stated; `End` checks `'Not sure'`; `Home` checks `'Fees only'`.
  - Sign out on step 01: `'Sign out'` → URL `/`; `devLogin` the same email → the app lands on `/opening/facts?q=<her first unanswered question>` with her answers kept.
  - a signed-out visit to `/opening/facts` does not show step 01: the sign-in page (`'Continue with Google'`) shows instead.
  - step 00's Start opens step 01 with the panel showing step 00 "Done" and `'Now · 1/11'` (desktop 1280 wide).
  - at 1920×1080, step 01's `h1` computed `font-size` is `56px` (the 1440 design's 42px at 4/3), proving the wide scaling.
- [ ] Step 5: run — `bun run test:e2e -- --reporter=line`; expected: all pass (a dev server on 3000 is reused; never start or stop one).
- [ ] Step 6: commit — `git add e2e/helpers/student.ts e2e/opening.e2e.ts e2e/coins-and-return.e2e.ts e2e/onboarding.e2e.ts && git commit -m "test(onboarding): step 01 end to end"`.

## Task 9: Visual check against the canvas
**Delivers:** the developer's "matches the canvas boards" check, at every width CLAUDE.md lists.
**Files:** e2e/zz-shots.e2e.ts (temporary, from Task 5; deleted here); no product file unless a difference is fixed.
**Kind:** judgement
- [ ] Step 1: extend the temporary spec to shoot, at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560: step 00 nothing chosen, one chosen, save failed (route the server action's POST to fail with `page.route`); step 01 nothing answered (`?q=where`), partly answered (`?q=latest` after `amount`, `covers`, `hard` answered), "Not sure" on `?q=amount`, Partner on `?q=dep`, save failed on `?q=hard`. `SHOT_LABEL=final`.
- [ ] Step 2: look at every shot and compare with the canvas's CSS (facts.css, pq.css) and boards at 390, 768, 1440 and 1920: card grid columns per count and width, card heights (4rem; 3.5rem on phones), the impact line's three styles and the mock tag, the note's three states, the sticky phone actions, the panel's Done/Now marks and segments, the sticky panel on the side-by-side layout. Fix any difference in the task's files; re-shoot.
- [ ] Step 3: delete `e2e/zz-shots.e2e.ts`; run `bun run lint && bun run type-check && bun run test:run && bun run test:e2e -- --reporter=line && bun run build`; expected: all clean. Commit fixes, if any: `git commit -m "fix(onboarding): match the canvas at <widths>"`. List the shot paths and any difference left in the task report.

## Integration
`bun run test:e2e -- --reporter=line` (Playwright, playwright.config.ts; a dev server on port 3000 is reused, dev login per CLAUDE.md). The specs: e2e/opening.e2e.ts (criteria 14, 22, 24–27, 30), e2e/coins-and-return.e2e.ts (60), e2e/onboarding.e2e.ts (keyboard, Sign out and return, the signed-out refusal, wide scaling). The rest of the suite must stay green: it walks the opening through `answerOpening`.

## Criteria coverage
This pass touches the criteria below; every other criterion keeps the tests it has, untouched.
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 2 | 2, 5 | onboarding.test.ts (`PANEL_COPY` has no "recommended"); OnboardingPanel.test.tsx (panel text) |
| 3 | 3, 7 | impact.test.ts (`mock: true` for a mock line); FactsScreen.test.tsx (the mock tag) |
| 14 | 7, 8 | e2e/opening.e2e.ts (step 01 within 3 s of Start) |
| 22 | 5, 8 | OnboardingPanel.test.tsx (steps, segments, "Step 1 of 6."); e2e/opening.e2e.ts. Design change: seven steps 00–06 on the onboarding panel; screens 2–4 keep six dots |
| 23 | 2, 6, 7 | onboarding.test.ts (eleven questions in order); AnswerCards.test.tsx; FactsScreen.test.tsx |
| 24 | 7, 8 | e2e/opening.e2e.ts (Nepal vs Australia lines) |
| 25 | 3, 7, 8 | FactsScreen.test.tsx (line at once); e2e/opening.e2e.ts (within 300 ms) |
| 26 | 3, 6, 7, 8 | impact.test.ts (assume kind, chips); e2e/opening.e2e.ts (stored assumed default) |
| 27 | 3, 7, 8 | impact.test.ts (limit kind); FactsScreen.test.tsx; e2e/opening.e2e.ts |
| 30 | 7, 8 | OpeningScreen.test.tsx (step 02 Back to `?q=eng`); e2e/opening.e2e.ts |
| 60 | 2, 7, 8 | onboarding.test.ts (`firstUnanswered`); e2e/coins-and-return.e2e.ts; e2e/onboarding.e2e.ts (Sign out and return) |
| Save and retry (developer) | 4, 7 | answer-save.test.tsx; FactsScreen.test.tsx |
| Keyboard radiogroup (developer) | 6, 8 | AnswerCards.test.tsx; e2e/onboarding.e2e.ts |
| Signed-out refusal | 8 | e2e/onboarding.e2e.ts |
| Wide desktop (developer) | 8, 9 | e2e/onboarding.e2e.ts (56px h1 at 1920); Task 9 shots |
