# Step 05, Your attention: the last onboarding step — Implementation Plan

**Intent:** docs/onboarding-attention/intent.md
**Goal:** Your attention is step 05 on the onboarding shell at `/onboarding/attention`, onboarding ends on "You're all set" at `/onboarding/done`, and nothing in onboarding leads to the futures any more.
**Approach:** The rules move first: the step list loses "Three futures" (00–05), step 04 leads to step 05, the panel copy per step, the canvas's coin lines and even spread, and landing keyed on stored coins. Then the screens: a new AttentionScreen and DoneScreen on the shell replace the old CoinsScreen page, the welcome takes the Welcome board's copy, and `/attention` redirects.
**Test layers:** Unit only (`bun test <files>` per task; `bun run test:run` once at the end by the controller). Stored coins keep their shape and the write path (`saveCoinsAction`) is unchanged; the new pages sit under `src/app/(app)/onboarding/(shell)` behind `requireStudent` like every step, so no access path is added. Criterion 17 is a screenshot check by the controller. No e2e (CLAUDE.md: only when asked).
**Constraints:** CLAUDE.md in full; in short: Bun only; server actions return `ActionResult` and never throw; Tailwind 4 semantic tokens, container-query variants (`@max-xl:`, `@5xl:`), type/spacing roles, `size-icon*` for icons, no arbitrary values; student URLs as named slugs; "test the brain, not the beauty"; never `bun run test:db`, `db:reset`, `test:e2e` or a dev server; read `src/design-systems/industry/DESIGN.md` before UI work and `node_modules/next/dist/docs` before Next.js code; commit after each task with Conventional Commits, never a co-author line.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/features/opening/model/onboarding.ts` (+ test) | modify | Steps 00–05, step 04's forward, panel copy per step, `ATTENTION_PATH`, `DONE_PATH`, `stepOfPath` for 5, `WELCOME_MINUTES` 6 |
| `src/features/opening/model/coins.ts` (+ test) | modify | The canvas's pile lines, even spread, refusals and the Done line |
| `src/features/opening/model/landing.ts` (+ test) | modify | Finished (coins stored) lands on `/onboarding/done`; futures never |
| `src/features/opening/components/OnboardingPanel.tsx` (+ test) | modify | Step 05's band and badge; six segments |
| `src/features/opening/components/AttentionScreen.tsx` (+ test) | create | Step 05 on the shell |
| `src/features/opening/components/DoneScreen.tsx` | create | "You're all set" |
| `src/app/(app)/onboarding/(shell)/attention/page.tsx`, `(shell)/done/page.tsx` | create | The two pages |
| `src/app/(app)/attention/page.tsx`, `CoinsScreen.tsx` (+ test), `coins.module.css` | delete (or move what the new screen reuses) | The old coins page |
| `next.config.ts` | modify | `/attention` → `/onboarding/attention`, permanent |
| `src/features/opening/components/WelcomeScreen.tsx` (+ test) | modify | The Welcome board's copy |
| `src/features/opening/index.ts`, `PRODUCT.md` | modify | Exports; URL map and resume rules |

## Task 1: The rules — six steps, step 05's coins, the panel and landing
**Delivers:** criteria 3, 4, 5, 6 (the lines), 11, 12, 13 (minutes), 14.
**Files:** modify `src/features/opening/model/onboarding.ts`, `onboarding.test.ts`, `src/features/opening/model/coins.ts`, `coins.test.ts`, `src/features/opening/model/landing.ts`, `landing.test.ts`, `src/features/opening/components/OnboardingPanel.tsx`, `OnboardingPanel.test.tsx`; fix any existing test the step 04 change breaks (`QuestionScreen.test.tsx` expects "Show me three futures" and `/futures` on step 04).
**Kind:** judgement

Read first: `onboarding.ts` (all), `coins.ts` (all), `landing.ts` (all), `OnboardingPanel.tsx` (all), their tests, and the canvas script `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/Coins.dc.html` lines 170-187 (PILES, EVEN, `lineFor`) and lines 56-71 (step 05's panel), `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/Grad.dc.html` lines 58-76 (the panel on steps 00–04).

- [ ] Step 1: write the failing tests:
  - `ONBOARDING_STEPS` is the six names 00–05, ending "After you graduate", "Your attention".
  - `PANEL_COPY[n]` for n 0–4 is `{ title: 'Five short steps', lead: 'Each step says why it asks, and “Not sure” is always a fine answer.' }`; `PANEL_COPY[5]` is `{ title: 'The last step', lead: 'Optional. It never changes your routes; it shapes what we show you on them later.' }`; the welcome's stays.
  - `QUESTION_STEPS[4].nextName` is "Your attention" and it sets no `lastLabel`/`leaveLabel` (so the screen reads "Next: Your attention" and "Leave the rest for now: go to Your attention"); `forwardPath(4, answers)` is `'/onboarding/attention'`.
  - `stepOfPath('/onboarding/attention')` and `stepOfPath('/onboarding/done')` are 5; `stepProgress` there is null (no question count).
  - `WELCOME_MINUTES` is 6.
  - coins: `coinLine(i, 0)` is "<Pile> at 0: nothing extra shown for it."; `coinLine(0, 1)` and `coinLine(0, 2)` are "Health at <n>: health cover basics appear on every route."; `coinLine(0, 3)` to `(0, 5)` "Health at <n>: we'll show clinics, sport and health cover on each route."; every pile's two texts exactly as `Coins.dc.html` PILES (use the typographic apostrophe the canvas uses, ’, as the app's copy does elsewhere — check `coins.ts` today and keep its convention). `NOT_SURE_SPREAD` is `[2, 1, 2, 1, 1, 1, 1, 1]` (LIFE_VALUES order). `refusal(piles, i)`: "Five is the most on one pile. Take one from here, or place it on another pile." when the pile holds five, "All ten are placed. Take one from another pile first." when ten are placed, else null. `doneLine(piles)`: "All ten placed. Done finishes onboarding." at ten, else "Place all ten to finish · <n> left.".
  - landing (`Resumable` gains `coins`): persona null → `/onboarding/welcome` from both functions; coins `{ state: 'later' }` or spent → `/onboarding/done` from both; `lastStep` 'attention' or 'futures' (or `seenFutures` true) with no coins → `/onboarding/attention`; otherwise as today. Neither function ever returns `/futures`.
  - panel at `/onboarding/attention` and `/onboarding/done`: title "The last step"; 00–04 read Done, 05 current with badge "Now · optional"; band "Now: 05 Your attention · optional" and "Then: you're all set"; "Step 5 of 5." in the document; six segments, all six lit. At `/onboarding/after/focus`: "Step 4 of 5.", "Next: Your attention", title "Five short steps".
- [ ] Step 2: run — `bun test src/features/opening/model src/features/opening/components/OnboardingPanel.test.tsx`; expected: FAIL.
- [ ] Step 3: implement.
  - `onboarding.ts`: drop "Three futures" from `ONBOARDING_STEPS`; `OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5` (`QuestionStep` stays 1–4); `FIVE_STEPS` and `LAST_STEP` copy as above; `export const ATTENTION_PATH = \`\${ONBOARDING_PATH}/attention\`` and `DONE_PATH = \`\${ONBOARDING_PATH}/done\``; step 4: `nextName: 'Your attention'`, remove `lastLabel`/`leaveLabel` from step 4 (keep the optional fields on the type only if anything still sets them; if nothing does, remove the fields and their reads in `QuestionScreen.tsx`, which then always uses the defaults); `forwardPath(4)` → `ATTENTION_PATH`; `stepOfPath`: `ATTENTION_PATH` and `DONE_PATH` → 5; `WELCOME_MINUTES = 6` (its comment: steps 00–04 hold 24 to 27 one-tap questions, about 15 seconds each; step 05 is optional). `FUTURES_PATH` stays exported (the futures page and its screen still use it). Update comments that say "seven" or "six steps".
  - `coins.ts`: replace `EFFECTS` with the canvas's two texts per pile and `coinLine` with the canvas's rule (0 / 1–2 / 3–5); `NOT_SURE_SPREAD` as above; add `refusal` and `doneLine` (pure; exported); keep `COINS_INTRO`, `COINS_HINT`, `COINS_ASSUMED` (they already match the canvas; check).
  - `landing.ts`: as the tests; update both doc comments. The two callers pass `getProfile`'s profile, which has `coins`.
  - `OnboardingPanel.tsx`: step 5 has no count: badge "Now · optional" (as step 00), band "Now: 05 Your attention · optional" / "Then: you're all set"; segments follow `ONBOARDING_STEPS` (six); comments that say "seven" updated.
- [ ] Step 4: run — `bun test src/features/opening src/shared` and `bun run type-check`; expected: PASS.
- [ ] Step 5: commit — `feat(onboarding): six steps, ending on your attention`.

## Task 2: Step 05 and "You're all set" on the shell, the welcome, the redirect
**Delivers:** criteria 1, 2, 3–6 (on screen), 7, 8, 9, 10, 12 (screen), 13, 15, 16; 17 is checked by the controller afterwards.
**Files:** create `src/features/opening/components/AttentionScreen.tsx` (+ `AttentionScreen.test.tsx`), `src/features/opening/components/DoneScreen.tsx`, `src/app/(app)/onboarding/(shell)/attention/page.tsx`, `src/app/(app)/onboarding/(shell)/done/page.tsx`; delete `src/app/(app)/attention/page.tsx`, `src/features/opening/components/CoinsScreen.tsx` and `CoinsScreen.test.tsx` (carry over to the new test whatever behaviour it pins that the intent keeps: the save failure and Try again), and `coins.module.css` unless the new screen reuses its hatched coin; modify `next.config.ts`, `src/features/opening/components/WelcomeScreen.tsx` (+ test), `src/features/opening/index.ts`, `PRODUCT.md`.
**Kind:** judgement

Read first: `CoinsScreen.tsx` and its test (the behaviour to keep, the save path), `QuestionScreen.tsx` (the shell column's kicker, heading, impact line, note, failure block, sticky phone actions: reuse its classes and patterns, not a new look), `AnswerCards.tsx` (radiogroup and buttons on the shell), `src/app/(app)/onboarding/(shell)/after/[question]/page.tsx` (the page pattern), task 1's diff (`git show HEAD`), `src/design-systems/industry/DESIGN.md`.
Design: renders in `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/design-05/`: `coins-<state>-<width>.png` (states `live` none placed, `partly` 7 with Closeness to family last, `pile-full` a refused sixth, `ten` Done enabled, `not-sure` the spread, `returning`; widths 390, 768, 1440, 1920) and `welcome-live-<390|1440>.png`. The static renderer misses some bundle styles (the "Spend them later" ghost button shows a box it does not have). Markup, copy and states: `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/Coins.dc.html` (lines 80-161 and its script), `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/Welcome.dc.html` (lines 64-112); styles: `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/facts.css` (search `cn-` for the coins block) and `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/0d50f3de-5f77-4f34-9004-b49228cd0772/scratchpad/artifact-files/60828ddf-c380-4cdc-ac53-d05a393fea6d/project/pq.css` (`fx-leave`, `pq-river`, `pq-float` for the end screen). The canvas's light accents are the brand blue; the app's stay steel in this slice (the accent sync is the next branch), so accent colour is not a difference to fix. The panel's light ground is #0062c4 in the app.

- [ ] Step 1: write the failing tests (behaviour only), `AttentionScreen.test.tsx`:
  - empty: "0 of 10 placed"; Done is unavailable (`aria-disabled="true"`, a tap saves nothing) with "Place all ten to finish · 10 left."; the hint shows; no back note.
  - + on Closeness to family three times: its count reads 3 and the line "Closeness to family at 3: we'll show trip times home on each route." shows; "3 of 10 placed"; − takes one off and the line follows.
  - a sixth coin on a pile at five is refused with the five-coin text and the count stays 5; with ten placed, + on another pile shows the all-ten text.
  - Not sure: the spread (Health 2, Financial life 2, the rest 1), "10 of 10 placed", "Assumed: an even spread. You can change it any time."; moving a coin clears the assumed line.
  - ten placed: Done is the strong button, "All ten placed. Done finishes onboarding."; Done calls the save action with `{ state: 'spent', piles, assumed }` (assumed true for the untouched spread) and pushes `/onboarding/done`.
  - "Spend them later: finish without placing coins" saves `{ state: 'later' }` and pushes `/onboarding/done`.
  - a refused save keeps her on the screen with the failure message and Try again, which retries.
  - Back pushes `/onboarding/after/long-term`.
  - `initial` spent coins: the piles show them and the back note "Here's where you placed them last time. Move any, or keep them as they are." shows.
  - WelcomeScreen: the heading reads "About 6 minutes of short questions"; the three point titles are the Welcome board's.
- [ ] Step 2: run — `bun test src/features/opening/components/AttentionScreen.test.tsx src/features/opening/components/WelcomeScreen.test.tsx`; expected: FAIL.
- [ ] Step 3: implement.
  - **AttentionScreen** `{ initial: Extract<Coins, { state: 'spent' }> | null; saveCoinsAction }`: the shell column as `QuestionScreen`'s (`max-w-2xl` may widen to the board's content width if the piles need it; check the 1440 render), kicker "Your attention · optional", heading, intro, hint note, back note when `initial`, the tray (ten coins, "<n> of 10 placed" in a polite live region, "Not sure" ghost action with the "?" mark as AnswerCards draws it), the assumed line (the dashed impact style `QuestionScreen` uses for assume), the eight piles in a two-column grid (one column on a phone): name, a five-coin stack, − count + (44px targets; − `aria-disabled` at 0; + reads capped at five or ten), the refusal under a pile (status role) and the last-changed pile's line (the impact style), then "Your routes stay exactly as they are, whatever you place here." with a lock icon, the Done line (`aria-describedby` on Done), the "Spend them later" link-style button, and Back / Done in the sticky phone bar like `QuestionScreen`'s. Rules from `coins.ts` (`addCoin`, `removeCoin`, `refusal`, `doneLine`, `coinLine`, `NOT_SURE_SPREAD`, `canFinish`), no copies of them. Save as `CoinsScreen` does today (pending state, `SAVE_FAILED` on a throw), then `router.push(DONE_PATH)`.
  - **DoneScreen** `{ spent: boolean }`: kicker "Onboarding · done", heading "You're all set" (takes focus on arrival), the text per criterion 10, the duck on the river with "Keep floating." (reuse the step screens' leave/river look if the app has one; else the board's `pq-river` translated to tokens, motion only under `prefers-reduced-motion: no-preference`), and "Back to Your attention" as an outline button linking to `ATTENTION_PATH`.
  - **Pages**: `(shell)/attention/page.tsx`: `requireStudent`, `getProfile`, `markStep(user.id, 'attention')`, `<AttentionScreen initial={coins?.state === 'spent' ? coins : null} saveCoinsAction={saveCoinsAction} />`. `(shell)/done/page.tsx`: `requireStudent`, `getProfile`; no coins stored → `redirect(ATTENTION_PATH)`; else `<DoneScreen spent={coins.state === 'spent'} />`. Run `bunx next typegen` before type-check.
  - Delete the old `/attention` page and `CoinsScreen`; `next.config.ts` gains `{ source: '/attention', destination: '/onboarding/attention', permanent: true }` beside the retired paths; keep `'/attention'` in `APP_PATHS` and the proxy matcher (the redirect runs before the proxy; the gate still treats it as a student path). `FuturesScreen`'s own links stay as they are (the futures are parked, not rebuilt). Remove `Progress`/`Hero` only if nothing imports them any more (FuturesScreen still does).
  - **WelcomeScreen**: the Welcome board's copy: heading "About {WELCOME_MINUTES} minutes of short questions"; the line "Your answers shape what OfCourse shows you: what you'd study, where you'd live, and what could come after."; points "Five short steps, one question at a time" / "Everything saves as you go, so you can stop and pick up where you left off.", "Each question says why it asks" / (today's text), "Nothing ranked or recommended" / "We show what each choice would give you and what it would cost you. You decide what matters." (icon: keep Columns3).
  - **PRODUCT.md**: steps 00–05 in the URL map with 05 "Your attention (the ten coins) | `/onboarding/attention`" and the end "You're all set | `/onboarding/done`"; the futures row moves out of the onboarding table to a line: "The three futures (`/futures`) are parked outside onboarding, as their own feature later; nothing in onboarding links there."; the resume and landing bullets per criterion 14; `/attention` added to the retired paths.
- [ ] Step 4: run — `bun test src/features/opening`, `bunx next typegen`, `bun run type-check`, `bun run lint`; expected: PASS.
- [ ] Step 5: commit — `feat(onboarding): step 05 your attention on the shell`.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 shell, copy, marks step | 2 | `AttentionScreen.test.tsx` (copy); page: smoke test |
| 2 tray | 2 | `AttentionScreen.test.tsx` |
| 3 piles, counts, lines | 1, 2 | `coins.test.ts` (every line); `AttentionScreen.test.tsx` |
| 4 refusals | 1, 2 | `coins.test.ts` (`refusal`); `AttentionScreen.test.tsx` |
| 5 Not sure spread | 1, 2 | `coins.test.ts`; `AttentionScreen.test.tsx` |
| 6 Done gate and lines | 1, 2 | `coins.test.ts` (`doneLine`); `AttentionScreen.test.tsx` |
| 7 Done, later, failure | 2 | `AttentionScreen.test.tsx` |
| 8 Back | 2 | `AttentionScreen.test.tsx` |
| 9 returning | 2 | `AttentionScreen.test.tsx` |
| 10 all set | 2 | Smoke test (pass-through copy and a link; no decision beyond the page's redirect) |
| 11 panel | 1 | `OnboardingPanel.test.tsx`, `onboarding.test.ts` |
| 12 step 04 forward | 1 | `onboarding.test.ts`, `QuestionScreen.test.tsx` |
| 13 welcome | 1, 2 | `onboarding.test.ts` (minutes); `WelcomeScreen.test.tsx` |
| 14 landing and resume | 1 | `landing.test.ts` |
| 15 redirect, futures unlinked | 1, 2 | `landing.test.ts` (never /futures); redirect: smoke test |
| 16 docs, suite | 2 | PRODUCT.md; `bun run test:run` |
| 17 boards | — | Not automatable: screenshots at 390, 768, 1440, 1920, both themes, by the controller |
