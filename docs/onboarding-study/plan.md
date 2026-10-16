# Step 02, What you'd study: one question per screen — Implementation Plan

**Intent:** docs/onboarding-study/intent.md
**Goal:** Step 02 asks one question per screen at `/onboarding/study/<question>` on the onboarding shell, the way step 01 does, with the areas as up to three checkboxes.
**Approach:** Step 01's one-question screen (`FactsScreen`) becomes a screen for any question step, driven by a per-step definition in the onboarding model (its questions, slugs, why lines, which questions are asked for her answers, and where Back, Next and "Leave the rest" go). The shell holds her answers in one client state, fed by the layout on load, so the panel can count "n of N" for step 02 (N depends on her first answer) correctly from the first paint and live as she taps. The areas get a checkbox-card component; removing the last area clears the stored answer through the existing save action, which learns that `null` means "clear".
**Test layers:** Unit plus integration. Criteria 2–10, 13, 14 and 16's rule are pure model or component behaviour and get unit tests first (`bun run test:run`). Criteria 1, 11, 12, 16, 17 and 18 cross the browser, the server and the database (a URL that marks the step and redirects, links between steps 01, 02 and 03, a cleared answer that stays cleared after a reload, `/` and `/onboarding` landing for a returning student), so they are proven end to end with Playwright (`bun run test:e2e`, focused specs while building; the full suite once before the push). The access path is unchanged (the new pages sit under `src/app/(app)` behind `requireStudent`, as step 01's do); the save action keeps its refusal tests, and a `null` patch from a non-student is refused like any other patch. Criterion 15 (matches the boards) is checked in screenshots, not asserted. The clearing write is covered by the database test in `src/features/opening/server/profile.test.ts`, run by path (`DB_TESTS=1 bun test src/features/opening/server/profile.test.ts`, which reads `DATABASE_URL` from `.env` through Bun; never `bun run test:db`).
**Constraints:**
- `bun install` (Bun only; npm/pnpm/yarn are refused)
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (two exceptions: hairlines stay 1px, and icons keep their px size through `size-icon-sm` / `size-icon` / `size-icon-lg`, so they do not grow with the 1440→1920 scaling). Dark mode follows `<html data-theme>`.
- Sizes are fluid through the design system's roles: type `text-display`, `text-h1` to `text-h4`, `text-lead`, `text-caption`, `text-overline`; spacing `px-gutter`, `py-section`, `gap-section`, `gap-stack`. Never a size per breakpoint.
- Layout responds to the page's own width (container queries on an `@container` root) … `@max-xl:` below 36rem/576px (phones: one column, 1rem side gutter, sticky actions), stacked between 36 and 64rem, `@5xl:` from 64rem/1024px (side by side). … never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- Student URLs (the map is in PRODUCT.md): onboarding lives at `/onboarding/<step>` with named steps, never numbers … one URL per screen with the question as a readable slug segment … a bare step (`/onboarding/facts`) opens its first unanswered question. Internal keys never appear in a URL: slugs map to keys in src/features/opening/model/onboarding.ts.
- `bun run test:run` — unit and component tests … Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none.
- `bun run test:db` — **wipes the development database** (never run it; never `bun run db:reset`).
- `bun run test:e2e` — Playwright against a dev server it starts itself on 3000 … the full suite runs once before a push, focused specs during fixes.
- Never commit or push without explicit approval (the developer approved this plan including each task's commit step). Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg. Never add co-author text to commit messages.
- Never start a dev server for the user; they run it.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- Read node_modules/next/dist/docs before writing Next.js code (AGENTS.md).

## Files

| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/features/opening/model/onboarding.ts | modify | The question steps (01 and 02): their questions, slugs, why lines, which are asked, paths and navigation; the panel's progress; panel copy |
| src/features/opening/model/onboarding.test.ts | modify | Tests for the above |
| src/features/opening/model/impact.ts | modify | Areas joined with " · "; the field's assumption reads "any field" |
| src/features/opening/model/impact.test.ts | modify | Tests for the two copy changes |
| src/features/opening/actions.ts | modify | `saveAnswersAction`: a `null` value clears that answer |
| src/features/opening/actions.test.ts | modify | Tests for clearing |
| src/features/opening/server/profile.ts | modify | `saveAnswers` removes the keys a patch clears |
| src/features/opening/server/profile.test.ts | modify | Database test for clearing |
| src/features/opening/model/answer-save.ts | modify | `SaveAnswers` and `save` accept `null` (clear) |
| src/features/opening/model/answer-save.test.tsx | modify | A cleared answer is saved as `null` |
| src/features/opening/model/onboarding-answers.tsx | create | The shell's answers: provider and hook |
| src/features/opening/model/onboarding-answers.test.tsx | create | Tests for the provider |
| src/features/opening/components/OnboardingShell.tsx | modify | Takes her answers, wraps the page in the provider |
| src/app/(app)/onboarding/(shell)/layout.tsx | modify | Reads her answers once per load and gives them to the shell |
| src/features/opening/components/OnboardingPanel.tsx | modify | Step 02 state from the model's progress |
| src/features/opening/components/OnboardingPanel.test.tsx | modify | Step 02 panel tests |
| src/features/opening/components/QuestionScreen.tsx | create (from FactsScreen.tsx, `git mv`) | One question per screen for steps 01 and 02 |
| src/features/opening/components/QuestionScreen.test.tsx | create (from FactsScreen.test.tsx, `git mv`) | Its tests, step 01's kept and step 02's added |
| src/features/opening/components/AreaChecks.tsx | create | The areas as checkbox cards, the count, the notes, the refusal |
| src/features/opening/components/AreaChecks.test.tsx | create | Its tests |
| src/app/(app)/onboarding/(shell)/facts/[question]/page.tsx | modify | Renders `QuestionScreen` for step 01 |
| src/app/(app)/onboarding/(shell)/study/page.tsx | create | Bare step 02: on to her first open question |
| src/app/(app)/onboarding/(shell)/study/[question]/page.tsx | create | A step 02 question; unknown slug 404; a question not asked redirects |
| src/app/(app)/onboarding/[step]/page.tsx | modify | Only living and after now |
| src/features/opening/components/OpeningScreen.tsx | modify | Back from step 03 opens `/onboarding/study/length` |
| src/features/opening/index.ts | modify | Exports |
| e2e/helpers/student.ts | modify | Step 02 answered one question per screen in `answerOpening`; a `studyUrl` helper |
| e2e/onboarding-study.e2e.ts | create | Step 02's browser criteria |
| e2e/opening.e2e.ts, e2e/onboarding.e2e.ts, e2e/coins-and-return.e2e.ts, e2e/futures.e2e.ts, e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts, e2e/dark-mode/dark-mode.e2e.ts | modify | Flows that pass through step 02 |
| PRODUCT.md, CLAUDE.md | modify | Step 02's slugs |

## Task 1: The model — step 02's questions, slugs, order and the panel's progress
**Delivers:** acceptance criteria 1 (slugs), 2, 3, 4 (why lines, group labels), 6 (copy), 13 (panel copy and progress), 16 (the rule).
**Files:** modify `src/features/opening/model/onboarding.ts`, `src/features/opening/model/onboarding.test.ts`, `src/features/opening/model/impact.ts`, `src/features/opening/model/impact.test.ts`.
**Kind:** judgement — several functions over one model; the plan gives the interface and the assertions.

Read first: `src/features/opening/model/onboarding.ts` (all of it), `src/features/opening/model/questions.ts:39-60, 125-162, 265-290` (`PARTICULAR`, `DRAWN_TO_AREAS`, `SCREENS[1]`, `effective`, `isVisible`), `src/features/opening/model/impact.ts:35-43, 166-184`.

The interface (other tasks import exactly these names from `../model/onboarding`):

```ts
/** The steps built on the onboarding shell so far. */
export type OnboardingStep = 0 | 1 | 2
/** The steps that ask one question per screen. */
export type QuestionStep = 1 | 2

export type StepQuestion = {
  key: QuestionKey
  /** The Item.id in SCREENS whose impact line this question shows. */
  itemId: string
  /** Shown above the question, else ''. */
  group: string
  /** The screen's heading. */
  question: string
  why: string
  /** Its URL segment, as PRODUCT.md lists it. */
  slug: string
  /** Shows its item's line before it is answered (the field and the areas: the line asks for them). */
  opensWithLine: boolean
}

export const STUDY_PATH: string            // already exists: '/onboarding/study'
export const LIVING_PATH: string           // new: '/onboarding/living'

/** Per question step: the kicker's title, its questions in order, and its base path. */
export const QUESTION_STEPS: Readonly<Record<QuestionStep, {
  title: string
  path: string
  questions: readonly StepQuestion[]
  /** Where Back goes from the step's first question. */
  back: string
  /** The next step's name, for "Next: …" on the last question and "Leave the rest for now: go to …". */
  nextName: string
}>>

export function questionPath(step: QuestionStep, key: QuestionKey): string
/** The step's question a slug names, else null (a key is not a slug). */
export function questionBySlug(step: QuestionStep, slug: string | null | undefined): StepQuestion | null
/** The step's question a URL names (its last segment), else null. */
export function questionOfPath(step: QuestionStep, pathname: string): StepQuestion | null
/** The questions asked for these answers, in order (isVisible from questions.ts). */
export function askedQuestions(step: QuestionStep, answers: StoredAnswers): StepQuestion[]
/** Her first asked question with no stored answer, else the last asked. */
export function firstOpenQuestion(step: QuestionStep, answers: StoredAnswers): QuestionKey
/** Where leaving a step forward goes: step 01 → step 02's first open question; step 02 → LIVING_PATH. */
export function forwardPath(step: QuestionStep, answers: StoredAnswers): string
/** The panel's count on a question step: the question's place among those asked, and how many are asked; null elsewhere (and 1 when the URL names no asked question). */
export function stepProgress(pathname: string, answers: StoredAnswers): { question: number; total: number } | null
```

Values:
- `QUESTION_STEPS[1]`: title `'Facts about you'`, path `FACTS_PATH`, questions = today's `FACT_QUESTIONS` with `slug` from `FACT_SLUGS` and `opensWithLine: false`, back `PICTURE_PATH`, nextName `"What you'd study"`.
- `QUESTION_STEPS[2]`: title `"What you'd study"`, path `STUDY_PATH`, back `factPath('eng')` (`'/onboarding/facts/english'`), nextName `"Where and how you'd live"`, questions in this order (key, itemId, group, question, slug, opensWithLine, why):
  - `know`, `'know'`, `''`, `'Do you know what you want to study?'`, `'know'`, false, `'It sets how wide your futures start: one field, a few areas, or every field in this preview.'`
  - `field`, `'know'`, `PARTICULAR`, `'Which field?'`, `'field'`, true, `'Your futures are drawn from courses in this field. You can change it on each one.'`
  - `areas`, `'know'`, `DRAWN_TO_AREAS`, `'Pick up to three'`, `'areas'`, true, `'Courses from each area you pick show side by side, so you can compare them.'`
  - `level`, `'level'`, `''`, `'Study level'`, `'level'`, false, `'It sets the course length and entry each future is built on.'`
  - `learn`, `'learn'`, `''`, `'How you like to learn'`, `'learning'`, false, `"It shapes what each future is drawn around. It doesn't put one above another."`
  - `length`, `'length'`, `''`, `"Course length you'd prefer"`, `'length'`, false, `'Length changes the cost, and how long you could work in Australia after you finish.'`
  Take the question texts and item ids from `SCREENS[1]` where they match (as `FACT_QUESTIONS` does from `SCREENS[0]`), and write the group, slug and why per key as above; keys never appear in a URL.
- Keep step 01's existing exports working, defined over the new ones: `FACT_QUESTIONS` (= `QUESTION_STEPS[1].questions`), `FACT_SLUGS`, `factPath`, `factKey`, `firstUnanswered` (= `firstOpenQuestion(1, answers)`). `factIndex` and `factIndexOfPath` stay for now (task 3 removes them if nothing uses them).
- `stepOfPath`: `STUDY_PATH` and anything under `STUDY_PATH/` → `2`; everything else as today.
- `PANEL_COPY`: add step `2` with the same title and lead as steps `0` and `1` (`'Six short steps'`, `'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.'`). The canvas's "ranked or recommended" is not taken: DS-R1 forbids the word "recommended" on any screen, and the existing test `never ranks (criterion 2)` in `onboarding.test.ts` must keep passing. `welcome` unchanged. `PanelState` stays `OnboardingStep | 'welcome'`.

In `impact.ts`:
- the areas line joins with `' · '`: `'IT and computing · Data · Design: courses across them show side by side.'` (was `listJ`);
- `assumedText('field', …)` reads `'any field'`, so `notSureLine('field')` is `'Not sure: I'll assume “any field” and show it as a chip you can change.'`. Nothing else changes.

- [ ] Step 1: write the failing tests, beside the existing ones, in `onboarding.test.ts` (and update the existing `stepOfPath` expectations to the new value):
  - `QUESTION_STEPS[2].questions.map(q => q.slug)` is `['know','field','areas','level','learning','length']`; the keys are `['know','field','areas','level','learn','length']`; each `why` is the string above; `group` is `''`, `"Something particular"`, `"A few areas I'm drawn to"`, `''`, `''`, `''`.
  - `askedQuestions(2, {})` keys are `['know','level','learn','length']`; with `know` stated `'Something particular'` they are `['know','field','level','learn','length']`; with `"A few areas I'm drawn to"` `['know','areas','level','learn','length']`; with `know` assumed (`{ value: 'Suggest me', state: 'assumed' }`) the four again.
  - `firstOpenQuestion(2, {})` is `'know'`; with `know` stated "Suggest me" it is `'level'`; with know "Something particular" it is `'field'`; with every asked question answered it is `'length'`; a stored field left over after know changed to "Suggest me" is not counted (`{ know: Suggest me, field: …, level, learn, length }` → `'length'`, and with level missing → `'level'`).
  - `questionPath(2, 'learn')` is `'/onboarding/study/learning'`; `questionBySlug(2, 'learning')?.key` is `'learn'`; `questionBySlug(2, 'learn')` is `null`; `questionBySlug(2, undefined)` is `null`; `questionOfPath(2, '/onboarding/study/areas')?.key` is `'areas'`; `questionOfPath(2, '/onboarding/study')` is `null`.
  - `forwardPath(1, {})` is `'/onboarding/study/know'`; with know "Suggest me" stated it is `'/onboarding/study/level'`; `forwardPath(2, {})` is `'/onboarding/living'`.
  - `stepProgress('/onboarding/study/know', {})` is `{ question: 1, total: 4 }`; `stepProgress('/onboarding/study/areas', { know: DRAWN_TO_AREAS stated })` is `{ question: 2, total: 5 }`; `stepProgress('/onboarding/study/length', { know: PARTICULAR stated })` is `{ question: 5, total: 5 }`; `stepProgress('/onboarding/facts/amount', {})` is `{ question: 2, total: 11 }`; `stepProgress('/onboarding/character', {})` and `stepProgress('/onboarding/welcome', {})` are `null`.
  - `stepOfPath('/onboarding/study')` and `stepOfPath('/onboarding/study/level')` are `2`; `stepOfPath('/onboarding/living')` stays `null`.
  - `PANEL_COPY[2]` equals `PANEL_COPY[1]`.
  - Step 01 is unchanged: the existing `FACT_QUESTIONS`, `factPath`, `factKey`, `firstUnanswered` tests still pass untouched; add one assertion that every step 01 question carries its `FACT_SLUGS` slug.
  In `impact.test.ts`, change the two expectations at `impact.test.ts:383-398` to the `' · '` form (`'Data · Business: …'`, `'IT and computing · Data · Design: …'`) and add `expect(notSureLine('field')).toBe('Not sure: I'll assume “any field” and show it as a chip you can change.')`.
- [ ] Step 2: run — `bun test src/features/opening/model/onboarding.test.ts src/features/opening/model/impact.test.ts`; expected: FAIL (the new names are not exported; the copy differs).
- [ ] Step 3: implement in `onboarding.ts` and `impact.ts` as specified. Keep the module pure and client-safe (it is imported by client components). Follow the file's existing style: a doc comment per export, `Readonly` records.
- [ ] Step 4: run — `bun test src/features/opening/model` then `bun run test:run` and `bun run type-check`; expected: PASS. Fix any other test that pinned the old areas line (search: `grep -rn "courses across them" src e2e`), changing only the expected copy.
- [ ] Step 5: commit — `feat(onboarding): step 02's questions, slugs and order in the onboarding model`

## Task 2: Clearing an answer — `null` in a save means "as if never given"
**Delivers:** acceptance criterion 9 (the stored side: removing the last area clears her areas answer).
**Files:** modify `src/features/opening/actions.ts`, `src/features/opening/actions.test.ts`, `src/features/opening/server/profile.ts`, `src/features/opening/server/profile.test.ts`, `src/features/opening/model/answer-save.ts`, `src/features/opening/model/answer-save.test.tsx`.
**Kind:** judgement — three layers, each small.

Read first: `src/features/opening/actions.ts:55-75`, `src/features/opening/actions.test.ts:1-60, 102-157`, `src/features/opening/server/profile.ts:28-37, 69-76`, `src/features/opening/server/profile.test.ts:1-75`, `src/features/opening/model/answer-save.ts` (all), `src/features/opening/model/answer-save.test.tsx:1-60`.

The interface:
- `answer-save.ts`: `export type SaveAnswers = (patch: Partial<Record<QuestionKey, AnswerValue | null>>) => Promise<ActionResult>`; `save(key: QuestionKey, raw: AnswerValue | null)`. The `latest` map holds `AnswerValue | null`; `run` still returns early only when nothing is stored for the key (`undefined`), so a `null` is sent like any value; `retry` and `flush` work unchanged for it.
- `actions.ts` `saveAnswersAction(patch)`: an entry whose value is `null` clears that key (the key must still be a `QuestionKey`, else the whole patch is refused as today); every other entry parses as today. It calls `saveAnswers(userId, answers, cleared)` and returns `{ ok: true, answers }` (only the set answers, as today). A patch that is only clears is valid. Refusals (signed out, not a student) are unchanged and come before anything is saved.
- `server/profile.ts` `saveAnswers(userId: string, patch: StoredAnswers, cleared: readonly QuestionKey[] = []): Promise<void>`: merges the patch as today, then removes each cleared key in the same `update`, with Postgres `jsonb - text` once per key. Verified in `node_modules/drizzle-orm/sql/sql.js:93-100`: a JS array interpolated into `sql\`\`` expands to `(a, b)`, so never interpolate `cleared` as an array; build one chunk per key and join them, e.g. `sql.join(cleared.map((key) => sql\` - ${key}::text\`))` appended after the merge expression (drizzle 0.45.3; `sql.join(chunks, separator?)` is declared at `node_modules/drizzle-orm/sql/sql.d.ts:165`). With no cleared keys the SQL is exactly today's.

- [ ] Step 1: write the failing tests:
  - `actions.test.ts` (beside "saves a stated answer…"): `saveAnswersAction({ areas: null })` as a student returns `{ ok: true, answers: {} }` and calls `saveAnswers` with `('student-1', {}, ['areas'])`; `saveAnswersAction({ amount: 36, areas: null })` calls it with `('student-1', { amount: { value: 36, state: 'stated' } }, ['areas'])`; `{ nonsense: null }` is refused with `INVALID` and saves nothing (add it to the refusal list). Update the existing `toHaveBeenCalledWith('student-1', {…})` assertions to expect the third argument `[]`. The access tests (signed out, admin) stay as they are and already cover a refused caller.
  - `profile.test.ts` (inside the existing `describe.skipIf(!enabled)` block, using one of its own `sp-t-` accounts): save `{ areas: { value: ['Data'], state: 'stated' }, level: { value: "Master's", state: 'stated' } }`, then `saveAnswers(uid, {}, ['areas'])`; `getProfile(uid).answers` is `{ level: { value: "Master's", state: 'stated' } }`; clearing a key that is not stored leaves the answers as they are.
  - `answer-save.test.tsx`: `save('areas', null)` calls the action after the debounce with `{ areas: null }` and ends `saved`; `retry('areas')` after a failed clear sends `{ areas: null }` again.
- [ ] Step 2: run — `bun test src/features/opening/actions.test.ts src/features/opening/model/answer-save.test.tsx`; expected: FAIL (the third argument and the null handling are missing). Then `DB_TESTS=1 bun test src/features/opening/server/profile.test.ts` (Bun reads `DATABASE_URL` from `.env`; the development Postgres must be up — if it is not, say so in the report and do not start it); expected: FAIL on the new test.
- [ ] Step 3: implement as specified. The action's doc comment says a `null` clears the answer.
- [ ] Step 4: run — the same three commands, then `bun run test:run` and `bun run type-check`; expected: PASS. Never run `bun run test:db` or `bun run db:reset`.
- [ ] Step 5: commit — `feat(onboarding): clear an answer by saving null`

## Task 3: The shell holds her answers; the panel shows step 02
**Delivers:** acceptance criterion 13 (the panel on step 02, counted live), and the shared answers tasks 5 and 6 build on.
**Files:** create `src/features/opening/model/onboarding-answers.tsx`, `src/features/opening/model/onboarding-answers.test.tsx`; modify `src/features/opening/components/OnboardingShell.tsx`, `src/app/(app)/onboarding/(shell)/layout.tsx`, `src/features/opening/components/OnboardingPanel.tsx`, `src/features/opening/components/OnboardingPanel.test.tsx`, `src/features/opening/model/onboarding.ts` (remove `factIndex`/`factIndexOfPath` if nothing uses them any more, with their tests).
**Kind:** judgement — a client context, a server layout and the panel.

Why: step 02's count ("n of N") depends on her first answer, which she can change on screen without a page load, and the panel lives in the layout, apart from the screen. One client state for her answers, held by the shell and fed by the layout on each load, lets the panel and the screen read the same answers: right in the server-rendered HTML, and live as she taps.

Read first: `src/features/opening/components/OnboardingShell.tsx`, `src/app/(app)/onboarding/(shell)/layout.tsx`, `src/features/opening/components/OnboardingPanel.tsx` (all), `src/features/opening/components/OnboardingPanel.test.tsx` (all), `src/app/(app)/onboarding/(shell)/facts/page.tsx` (how a page reads the profile), `src/shared/lib/auth/session.ts:1-45` (`requireStudent` is per-render cached through React `cache`, so the layout and the page share one session lookup).

The interface:
```ts
// src/features/opening/model/onboarding-answers.tsx — 'use client'
/** Her answers for the onboarding shell: the layout's on load, then every tap the screen makes. */
export function OnboardingAnswersProvider(props: { answers: StoredAnswers; children: ReactNode }): JSX.Element
/** The shell's answers and their setter; throws outside an OnboardingAnswersProvider. */
export function useOnboardingAnswers(): readonly [StoredAnswers, Dispatch<SetStateAction<StoredAnswers>>]
```
- The provider keeps the answers in `useState(props.answers)`; a later `answers` prop (a `router.refresh()`) does not overwrite what she has tapped since.
- `OnboardingShell({ answers, children }: { answers: StoredAnswers; children: ReactNode })` wraps everything it renders in the provider (the shell stays a server component; the provider is the client boundary).
- `(shell)/layout.tsx` becomes `async`: `const { user } = await requireStudent()`, `const { answers } = await getProfile(user.id)` (import from `@/features/opening/server/profile`, as the pages do), and renders `<OnboardingShell answers={answers}>`. Next.js keeps a shared layout across navigation between its pages, so the layout's read happens once per load into the shell, not per question; the provider's state is what the screen and panel share meanwhile (verify the layout behaviour in `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` or the nearest layouts doc, and cite it in your report).
- `OnboardingPanel` reads `const [answers] = useOnboardingAnswers()` and `stepProgress(pathname, answers)` (task 1) instead of `factIndexOfPath`. For a question step `s` (1 or 2) with progress `{ question, total }`: the badge reads `Now · ${question}/${total}`; the band reads `Now: ${'0' + s} ${ONBOARDING_STEPS[s]} · ${question} of ${total}` and `Next: ${ONBOARDING_STEPS[s + 1]}`; screen readers keep `Step ${s} of 6.`. Step 00 and the welcome are unchanged. 00 and 01 read Done on step 02; three segments lit.

- [ ] Step 1: write the failing tests:
  - `onboarding-answers.test.tsx`: a consumer inside the provider reads the given answers; calling the setter re-renders a second consumer with the new answers (the panel and the screen share them); `useOnboardingAnswers()` outside a provider throws.
  - `OnboardingPanel.test.tsx`: `renderAt(path, answers = {})` now wraps the panel in `OnboardingAnswersProvider`. New cases: at `/onboarding/study/know` with `{}`: items 00 and 01 contain "Done", item 02 has `aria-current="step"` and "Now · 1/4", the band reads "Now: 02 What you'd study · 1 of 4" and "Next: Where and how you'd live", "Step 2 of 6." is present, segments `{ all: 7, lit: 3 }`; at `/onboarding/study/areas` with `know` stated "A few areas I'm drawn to": "Now · 2/5" and "… · 2 of 5". The existing step 00, step 01 and welcome cases keep passing unchanged (step 01's "Now · 2/11" now comes from `stepProgress`).
- [ ] Step 2: run — `bun test src/features/opening/model/onboarding-answers.test.tsx src/features/opening/components/OnboardingPanel.test.tsx`; expected: FAIL (no provider module; no step 02 state).
- [ ] Step 3: implement as specified. `FactsScreen` still takes its `answers` prop in this task (task 5 moves it onto the provider), so the step 01 page needs no change here.
- [ ] Step 4: run — the same, then `bun run test:run` and `bun run type-check`; expected: PASS.
- [ ] Step 5: commit — `feat(onboarding): the shell holds her answers; the panel counts step 02`

## Task 4: The areas as checkbox cards
**Delivers:** acceptance criteria 7, 8, and 9's screen side (removing the last area reports a clear).
**Files:** create `src/features/opening/components/AreaChecks.tsx`, `src/features/opening/components/AreaChecks.test.tsx`; modify `src/features/engine/index.ts` (export `AREA_FIELDS`).
**Kind:** judgement — one component, matched to the design.

Read first: `src/features/opening/components/AnswerCards.tsx` (the card's classes, the tick, the focus ring: reuse its look), `src/features/opening/model/questions.ts:17-27, 291-302` (`Question`, the 1–3 areas rule), `src/features/engine/catalogue.ts:770-783` (`AREA_FIELDS`: Health, Engineering and Design carry `substitutedFrom`), `src/design-systems/industry/DESIGN.md`.
Design: the canvas's "Step 02 · What you'd study: the one multi-select" block in `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/canvas-v10/project/facts.css` (`.sd-count`, `.sd-pips`, `.sd-check`, `.sd-label`, `.sd-note`, `.sd-box`, `.is-full`, `.sd-refuse`, and the phone rules under `@container (max-width: 575.98px)`) and the renders in `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/design-02/` (`study-areas-two-1440.png`, `study-areas-two-390.png`, `study-areas-refused-390.png`, `study-areas-refused-1440.png`; open them). Translate the design's px/rem to the repo's semantic tokens and roles (CLAUDE.md); never copy its hex colours.

The interface:
```tsx
export function AreaChecks(props: {
  question: Question            // questionOf('areas')
  labelledBy: string            // the id of the h1 that asks it
  answer: StoredAnswer | undefined
  /** The areas now chosen, in the order she chose them; null when she removed the last one. */
  onAnswer: (raw: AnswerValue | null) => void
}): JSX.Element
```
Renders, in order:
1. A count line, `aria-live="polite"`, with an id: three marks (`aria-hidden`), the chosen ones filled with the accent, then the text "n of 3 chosen".
2. When a fourth tap was refused: `<p role="status">` with an info icon (lucide `Info`, `size-icon-sm`, `aria-hidden`) and "Three is the most for now. Tap one you've chosen to make room." (neutral style: the impact line's "limit" look in `QuestionScreen`/`FactsScreen`, `border-neutral-600 bg-neutral-100`).
3. A `role="group"` labelled by `labelledBy` and described by the count line's id: one `<button type="button" role="checkbox" aria-checked>` per option, in three columns, two on a phone (`grid-cols-3 @max-xl:grid-cols-2`, as the renders show at 1440, 768 and 390), each holding the area's name and, when `AREA_FIELDS[area]?.substitutedFrom` is set, a smaller note "Nearest field used for now" under it; on the right an empty square box that fills with the accent and a tick when checked (not the radio card's tick badge).
Behaviour:
- A tap on an unchecked area with fewer than three chosen adds it at the end and calls `onAnswer(next)`; a tap on a checked area removes it and calls `onAnswer(next)`, or `onAnswer(null)` when none is left.
- A tap on an unchecked area while three are chosen calls nothing, changes nothing, and shows the refusal; the refusal goes when she removes an area. It is component state, so it also goes when the question unmounts.
- While three are chosen, every unchecked card reads as full: `data-full` on it, muted text, the box dashed. Full cards stay focusable and pressable (the refusal is the answer), never `disabled`.
- Every card is in the tab order; Space and Enter press it (native button). No "Not sure" (the question has none).
- A stored answer that is not a 1–3 list (e.g. `undefined`) reads as none chosen.

- [ ] Step 1: write the failing tests in `AreaChecks.test.tsx` (pattern: `AnswerCards`' own tests, if present, or `FactsScreen.test.tsx`'s render helpers): the group is labelled by the heading and lists six checkboxes in model order; with `['IT and computing', 'Data']` stored, those two are `aria-checked="true"` and the count reads "2 of 3 chosen"; a tap on Business calls `onAnswer(['IT and computing', 'Data', 'Business'])`; a tap on Data calls `onAnswer(['IT and computing'])`; with only `['Data']` stored, a tap on Data calls `onAnswer(null)`; with three stored, a tap on Business calls nothing, shows the refusal text in a status, and Business has `data-full`; then a tap on a checked area calls `onAnswer` with two and the refusal is gone; Health, Engineering and Design each contain "Nearest field used for now", IT and computing, Business and Data do not; with nothing stored the count reads "0 of 3 chosen".
- [ ] Step 2: run — `bun test src/features/opening/components/AreaChecks.test.tsx`; expected: FAIL (no module).
- [ ] Step 3: implement as specified, with semantic classes only, container-query variants only, `size-icon*` for icons, motion only under `motion-safe:`.
- [ ] Step 4: run — the same, then `bun run test:run`, `bun run type-check`, `bun run lint`; expected: PASS.
- [ ] Step 5: commit — `feat(onboarding): the areas as checkbox cards, up to three`

## Task 5: One question screen for steps 01 and 02, and step 02's pages
**Delivers:** acceptance criteria 1, 2, 3, 4, 5, 6 (on screen), 9 (screen side), 10, 11, 12, 14, 16 (pages); step 01 keeps every behaviour it has.
**Files:** `git mv src/features/opening/components/FactsScreen.tsx src/features/opening/components/QuestionScreen.tsx` and `git mv src/features/opening/components/FactsScreen.test.tsx src/features/opening/components/QuestionScreen.test.tsx`, then modify both; modify `src/features/opening/index.ts`, `src/app/(app)/onboarding/(shell)/facts/[question]/page.tsx`, `src/app/(app)/onboarding/[step]/page.tsx`, `src/features/opening/components/OpeningScreen.tsx`; create `src/app/(app)/onboarding/(shell)/study/page.tsx`, `src/app/(app)/onboarding/(shell)/study/[question]/page.tsx`.
**Kind:** judgement — the screen is the slice's heart; match the design.

Read first: `src/features/opening/components/FactsScreen.tsx` and its test (all), `src/features/opening/components/AnswerCards.tsx`, `src/features/opening/components/AreaChecks.tsx` (task 4), `src/features/opening/model/onboarding.ts` (task 1's `QUESTION_STEPS`, `askedQuestions`, `questionOfPath`, `questionPath`, `forwardPath`), `src/features/opening/model/onboarding-answers.tsx` (task 3), `src/features/opening/model/answer-save.ts` (task 2: `save(key, null)`), the pages under `src/app/(app)/onboarding/(shell)/facts/`, `src/app/(app)/onboarding/[step]/page.tsx`, `src/features/opening/components/OpeningScreen.tsx:26-30, 130-135`.
Design: renders in `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/design-02/` (`study-live-*`, `study-field-*`, `study-not-sure-*`, `study-save-failed-*`, `study-areas-two-*` at 390, 768, 1440, 1920; open the 1440 and 390 ones at least). The question screen is step 01's, unchanged in look; what step 02 adds is the group label above a follow-up (the existing `item.group` line), the areas' component, and its notes.

The interface:
```tsx
/** Onboarding step 01 or 02: one question per screen, named by the URL's last segment. */
export function QuestionScreen(props: {
  step: QuestionStep
  relative: Relative | null
  saveAnswersAction: SaveAnswers
}): JSX.Element
```
Her answers come from `useOnboardingAnswers()` (task 3), not from a prop; the pages no longer pass `answers`.

Behaviour, over today's `FactsScreen` (keep everything it does; change only this):
- The definition is `QUESTION_STEPS[step]`; the questions asked are `askedQuestions(step, answers)`, recomputed on every render, so the count and the next question follow her first answer at once. The current question is `questionOfPath(step, pathname)`, else the first asked; its place `index` is its position among those asked (0 when not among them).
- Kicker: `${title} · ${index + 1} of ${asked.length}`.
- Focus moves to the heading when the current question's key changes (not on first render), as today.
- A `'multi'` question (`questionOf(key).control`) renders `AreaChecks`; any other renders `AnswerCards`. `answer(raw: AnswerValue | null)`: `null` removes the key from the answers (state and `save(key, null)`); anything else parses and saves as today.
- The impact line shows when the question has a stored answer, or when `opensWithLine` is true (field and areas: "Particular: pick the field.", "Pick up to three areas." until she picks), from `impactView(item.itemId, answers, relative)` as today.
- The note on a `'multi'` question: idle "Pick one, two or three. Skip, and I'll start wide, with every field in this preview.", saved "Saved. Tap an area again to remove it."; on others today's notes. Saving and failed as today.
- Back: on the first asked question `leave(QUESTION_STEPS[step].back)`; else `go` to the previous asked question. Forward: on the last asked question it reads `Next: ${nextName}` and leaves to `forwardPath(step, answers)`; else it reads Continue (answered) or Skip and goes to the next asked question. "Leave the rest for now: go to ${nextName}" on every question but the last, `href={forwardPath(step, answers)}`, flushing waiting saves. `go(key)` pushes `questionPath(step, key)` with `window.history.pushState`, as today (Next.js syncs `usePathname` with `pushState`: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` or the linking doc's "window.history" section — verify and cite).
- Step 01's copy is unchanged by construction: title "Facts about you", nextName "What you'd study", back `/onboarding/character`.

Pages:
- `(shell)/facts/[question]/page.tsx`: renders `<QuestionScreen step={1} relative={profile.relative} saveAnswersAction={saveAnswersAction} />`; everything else as today.
- `(shell)/study/page.tsx` (new, as `facts/page.tsx`): `redirect(questionPath(2, firstOpenQuestion(2, answers)))`.
- `(shell)/study/[question]/page.tsx` (new, as `facts/[question]/page.tsx`): `questionBySlug(2, question)` or `notFound()`; `requireStudent()`; `Promise.all([getProfile(user.id), markStep(user.id, 'study')])`; when `!isVisible(q.key, profile.answers)`, `redirect(questionPath(2, firstOpenQuestion(2, profile.answers)))`; else `<QuestionScreen step={2} … />`. Doc comment as the facts page's.
- `[step]/page.tsx`: serves only `living` and `after` now (study is a page of its own, as facts is).
- `OpeningScreen.tsx`: Back from step 03 (`living`) opens `questionPath(2, 'length')` (`/onboarding/study/length`); step 04's Back stays `/onboarding/living`.
- `index.ts`: export `QuestionScreen` (drop `FactsScreen`), `firstOpenQuestion`, `questionBySlug`, `questionPath` from the model, and `isVisible` from questions.
- New routes need their generated `PageProps` types: run `bunx next typegen` before `bun run type-check` (documented in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md:104`; it starts no server).

- [ ] Step 1: write the failing tests in `QuestionScreen.test.tsx`: rename the subject to `QuestionScreen step={1}`, wrap renders in `OnboardingAnswersProvider` with the answers each test used to pass, and keep all thirteen step 01 tests passing unchanged in what they assert. Add step 02 tests (pathname `/onboarding/study/<slug>`):
  - at `know` with `{}`: kicker "What you'd study · 1 of 4", heading "Do you know what you want to study?", the why line, four radios plus "Not sure", Back leaves to `/onboarding/facts/english` (router `push`), forward reads Skip, "Leave the rest for now: go to Where and how you'd live" links to `/onboarding/living`.
  - at `know`, tapping "Something particular" makes the kicker "1 of 5", shows the know line "Particular: pick the field.", saves `{ know: 'Something particular' }` (after the debounce, as step 01's tests wait for it), and Continue pushes `/onboarding/study/field` via `pushState`.
  - at `field` with know stated "Something particular": "Something particular" shows above the heading "Which field?", and "Particular: pick the field." shows before any tap; "Not sure" shows "Not sure: I'll assume “any field” and show it as a chip you can change."
  - at `areas` with know "A few areas I'm drawn to": the group "Pick up to three" has six checkboxes, the idle note is "Pick one, two or three. Skip, and I'll start wide, with every field in this preview.", "Pick up to three areas." shows; tapping Data saves `{ areas: ['Data'] }` and then the note reads "Saved. Tap an area again to remove it." and the line "Data: courses across them show side by side."; tapping Data again saves `{ areas: null }`, the forward button reads Skip and the count "0 of 3 chosen".
  - at `length` with know "Suggest me": kicker "4 of 4", forward reads "Next: Where and how you'd live" and pushes `/onboarding/living`; no "Leave the rest" link.
  - step 01's last question's forward now pushes `/onboarding/study/know` with `{}` answers (it pushed `/onboarding/study`), and `/onboarding/study/level` when know is stated "Suggest me".
- [ ] Step 2: run — `bun test src/features/opening/components/QuestionScreen.test.tsx`; expected: FAIL.
- [ ] Step 3: implement the screen, the pages, the exports and the OpeningScreen Back as specified. Run `bunx next typegen`.
- [ ] Step 4: run — `bun run test:run`, `bun run type-check`, `bun run lint`; expected: PASS. Fix `OpeningScreen.test.tsx` only where it pinned step 03's Back to `/onboarding/study`.
- [ ] Step 5: commit — `feat(onboarding): step 02 one question per screen on the onboarding shell`

## Task 6: The browser flows through step 02, and the URL map
**Delivers:** acceptance criteria 1, 8 and 9 (stored), 11, 12, 16, 17, 18 end to end; 18's docs.
**Files:** modify `e2e/helpers/student.ts`, `e2e/opening.e2e.ts`, `e2e/onboarding.e2e.ts`, `e2e/coins-and-return.e2e.ts`, `e2e/futures.e2e.ts`, `e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts`, `e2e/dark-mode/dark-mode.e2e.ts` (only if it fails); create `e2e/onboarding-study.e2e.ts`; modify `PRODUCT.md`, `CLAUDE.md`.
**Kind:** judgement — end-to-end tests run against the product, and fixed from what each run shows.

Read first: `e2e/README.md`, `e2e/helpers/student.ts` and `e2e/helpers/db.ts` (all), `e2e/onboarding-welcome.e2e.ts` (the newest spec, for the house style), `playwright.config.ts`, then each spec's passage that walks step 02: `e2e/opening.e2e.ts:100-120`, `e2e/onboarding.e2e.ts:285-365`, `e2e/coins-and-return.e2e.ts:130-210`, `e2e/futures.e2e.ts:140-150`, `e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts:405-425`, `e2e/dark-mode/dark-mode.e2e.ts:625-650`. What changed on screen (tasks 1–5): step 02 is one question per screen at `/onboarding/study/<slug>` (`know`, `field`, `areas`, `level`, `learning`, `length`) with step 01's cards (a radiogroup named by the heading; Back is a button, not a link), the areas a group "Pick up to three" of checkboxes, the forward button on step 02's last question "Next: Where and how you'd live", "Leave the rest for now: go to Where and how you'd live" elsewhere; `/onboarding/study` redirects to her first open question; step 03's Back opens `/onboarding/study/length`; step 01's Next and Leave link open step 02's first open question (`/onboarding/study/know` for a new student).

Running: Playwright starts its own dev server on 3000 when none is running and reuses one that is (`playwright.config.ts`); never start one yourself any other way. Run focused specs only: `bunx playwright test <files>`; the full suite is run once by the controller before the push.

- [ ] Step 1: `e2e/helpers/student.ts`: add a written-out map from step 02's questions to their slugs (as `FACT_SLUGS` is, so a renamed slug breaks the tests) — "Do you know what you want to study?" `know`, "Which field?" `field`, "Pick up to three" `areas`, "Study level" `level`, "How you like to learn" `learning`, "Course length you'd prefer" `length` — with `studyUrl(question)` and `answerStudy(page, [question, option])`: open the question's URL, tap the option (a card in the radiogroup; for "Pick up to three", the checkbox whose name starts with the area, in the group "Pick up to three"), and wait for the saved note ("Saved. Tap another answer to change it." / "Saved. Tap an area again to remove it."). `answerOpening` answers `answers.study` with `answerStudy`, then opens `/onboarding/living` and walks only living and after with the old screen's links as today. `PRIYA.study` keeps its four taps (know, field, level, learning) in that order.
- [ ] Step 2: write `e2e/onboarding-study.e2e.ts` (each test makes its own student with `newStudent` and deletes it in `finally`, as the other specs do):
  1. "step 02 asks one question per screen, in the order her first answer sets" (1280×800): a new student who skipped step 00 (`startOnboarding`, Skip) opens `/onboarding/study` and lands on `/onboarding/study/know`; `lastStep` polls to `'study'`; the kicker reads "What you'd study · 1 of 4", the panel's current step is "What you'd study" with "Now · 1/4"; tapping "Something particular" makes it "1 of 5"; Continue opens `/field` with "Something particular" above the heading "Which field?"; tap "Data science"; Continue to `/level`, Back to `/field` (her choice still checked), Continue, Continue to `/learning`, Skip to `/length`, whose forward button "Next: Where and how you'd live" opens `/onboarding/living`; the old screen's Back link there opens `/onboarding/study/length`; from `/onboarding/study/know`, Back opens `/onboarding/facts/english`.
  2. "the areas: up to three, a fourth refused, the last one removed clears her answer" (390×844): from `/onboarding/study/know` tap "A few areas I'm drawn to", Continue to `/areas`; tap IT and computing, Data and Health: "3 of 3 chosen", stored `areas` polls to `{ value: ['IT and computing', 'Data', 'Health'], state: 'stated' }`; tap Business: "Three is the most for now. Tap one you've chosen to make room." shows and the stored value is unchanged; remove the three: stored `areas` polls to `undefined`; reload: "0 of 3 chosen" and the forward button reads Skip.
  3. "coming back: the bare step, a question not asked, an unknown slug, and /" (1280×800): a student who skipped step 00 and answered `know` "Suggest me" (`answerStudy`): `/onboarding/study` lands on `/onboarding/study/level`; `/onboarding/study/field` lands there too; `/onboarding/study/nope` shows "This page could not be found."; `/` lands on `/onboarding/study/level`.
  Run — `bunx playwright test e2e/onboarding-study.e2e.ts`; fix the test from what each failure shows (the product is built; a failure that is the product's, not the test's, is reported, not worked around).
- [ ] Step 3: update the existing specs that walk step 02 to the new screens, changing only what step 02 changed (URLs now end in a slug, step 02's headings are its questions, Back on step 02 is a button, step 02's way on is "Leave the rest for now: go to Where and how you'd live" or the last question's "Next: Where and how you'd live"): `opening.e2e.ts` (the "Back keeps answers" passage and the move to screen 3), `onboarding.e2e.ts` (the retired `/opening/study` lands on `/onboarding/study/know`; add `/onboarding/study/nope` to the not-found list; the resume test expects `/onboarding/study/know`), `coins-and-return.e2e.ts` (both step 02 passages; the Back chain from the futures passes `/onboarding/study/length`), `futures.e2e.ts` (the Health area via `answerStudy`), the three-futures QA spec's AC30 (`/onboarding/study/know`, Back is a button). Run each changed file — `bunx playwright test e2e/opening.e2e.ts e2e/onboarding.e2e.ts e2e/coins-and-return.e2e.ts e2e/futures.e2e.ts e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts e2e/dark-mode/dark-mode.e2e.ts -g "AC10|AC30|opening|onboarding|retired|resumes|coming back|after the futures|area"` (adjust `-g` to the tests you touched) — until green.
- [ ] Step 4: docs. `PRODUCT.md`: the 02 row reads `/onboarding/study/<question>`: `know`, `field`, `areas`, `level`, `learning`, `length`; the resume bullet says a bare step opens its first unanswered question for facts and study ("her first unanswered question when that step is facts or study"). `CLAUDE.md` "Student URLs": the example becomes "(`/onboarding/facts/who-pays`, `/onboarding/study/learning`)"; nothing else.
- [ ] Step 5: commit — `test(e2e): step 02 one question per screen` (the docs in the same commit, or a second `docs: step 02's slugs in the URL map`).

## Integration
`e2e/onboarding-study.e2e.ts` proves criteria 1, 8, 9, 11, 12, 16 and 17 in the browser against the database; the updated specs prove 18 (the flows through step 02 still reach the futures). Command: `bun run test:e2e` (full, once before the push); `bunx playwright test e2e/onboarding-study.e2e.ts` while building.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 · slugs, marks the step, unknown slug 404 | 1, 5, 6 | `onboarding.test.ts` (slugs) · `onboarding-study.e2e.ts` tests 1 and 3 |
| 2 · order by her first answer | 1, 5 | `onboarding.test.ts` (`askedQuestions`) · `QuestionScreen.test.tsx` · e2e test 1 |
| 3 · "n of N", live | 1, 5 | `onboarding.test.ts` (`stepProgress`) · `QuestionScreen.test.tsx` (1 of 4 → 1 of 5) |
| 4 · group labels, headings, why lines | 1, 5 | `onboarding.test.ts` · `QuestionScreen.test.tsx` (field screen) |
| 5 · single-choice cards, Not sure assumes | 5 | `QuestionScreen.test.tsx` (the step 01 tests run for both steps' cards; field Not sure) |
| 6 · line copy, lines before an answer on field/areas | 1, 5 | `impact.test.ts` · `QuestionScreen.test.tsx` |
| 7 · the areas as checkboxes, notes, no Not sure | 4 | `AreaChecks.test.tsx` |
| 8 · a fourth refused | 4, 6 | `AreaChecks.test.tsx` · e2e test 2 (nothing stored) |
| 9 · removing the last clears | 2, 4, 5, 6 | `actions.test.ts`, `profile.test.ts` (DB), `answer-save.test.tsx`, `AreaChecks.test.tsx`, `QuestionScreen.test.tsx` · e2e test 2 |
| 10 · notes | 5 | `QuestionScreen.test.tsx` |
| 11 · Back, Skip/Continue, Next, Leave | 5, 6 | `QuestionScreen.test.tsx` · e2e test 1 |
| 12 · links into step 02 and step 03's Back | 1, 5, 6 | `onboarding.test.ts` (`forwardPath`) · `QuestionScreen.test.tsx` (step 01's last) · e2e test 1 |
| 13 · the panel on step 02 | 1, 3 | `OnboardingPanel.test.tsx` · e2e test 1 (desktop list) |
| 14 · focus, Tab, menu | 5 | `QuestionScreen.test.tsx` (focus test kept for both steps); the menu is the shell's (unchanged) |
| 15 · matches the boards | — | Not automatable: compared in screenshots at the ten widths and in dark by the controller after task 5; recorded in `smoke.md` |
| 16 · bare step and a question not asked | 1, 5, 6 | `onboarding.test.ts` (`firstOpenQuestion`) · e2e test 3 |
| 17 · `/`, `/onboarding`, `/opening/study` | 6 | e2e test 3 · `onboarding.e2e.ts` (retired path) |
| 18 · docs; suites pass | 6 | the full `bun run test:run` and `bun run test:e2e` before the push |
