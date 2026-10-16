# Bloat audit, 12 Oct 2026

Branch `refactor/cleanup` (same as `dev`, clean tree). Read-only audit: nothing in the code was changed. `bun run type-check` passes on the tree as audited. The evidence is grep and reading. "Importers" means non-test files that import the module, unless a line says otherwise.

## Totals

| What | Lines | Notes |
| --- | --- | --- |
| Source (`src`, non-test `.ts/.tsx/.css/.sql`) | 15,591 | includes shadcn `ui` 1,616, design systems 479, `catalogue.ts` 817 |
| Unit tests (`src/**/*.test.*`) | 10,296 | 61 files, 827 `it`/`test` cases |
| End-to-end (`e2e/`, specs + helpers + manual notes) | 4,385 | 15 specs, 5 helpers, 4 markdown files |

Estimated lines removable, by category. "Now" needs no product call. "If decided" needs one of the decisions at the end.

| Category | Source | Tests | e2e | When |
| --- | --- | --- | --- | --- |
| 1a. Dead now (no live importer) | ~40 | ~45 | – | now |
| 1b. Unused shadcn components (starter inventory) | 885 | 35 | – | if decided (D2) |
| 1c. Parked futures cluster | ~1,600 | ~1,350 | see 5 | if decided (D1) |
| 2. Legacy question model (old long-screen fields) | ~30 now, ~120 more with a merge | ~15 | – | now / simplify |
| 3. Duplication | ~200 | – | – | merge |
| 4. Test bloat (outside the futures cluster) | – | ~400 | – | now |
| 5. Stale and duplicate e2e | – | – | ~500 (+165 with D1) | now |
| 6. Other (deps, docs, config) | ~10 + 1 dep + 9 deps if D2 | – | – | now |

Without the two decisions: roughly 300 source, 450 test and 500 e2e lines. With both: roughly 2,800 source, 1,850 test and 665 e2e.

## Ranked candidates

Ranked by lines removable.

| # | What | Category | Evidence | Lines removable | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | The parked futures cluster: `/futures` page, `FuturesScreen` and the components, engine modules, model helpers, actions and tests only it uses | 1c | `src/app/(app)/futures/page.tsx` is the only importer of `FuturesScreen` and `buildFutures`; nothing in onboarding links there (PRODUCT.md, `landing.ts:30-44`); the cluster's members have no other importer (section 1c) | ~1,600 src + ~1,350 tests + e2e (section 5) | medium: it is the product's result, coming back "likely from a new design"; git keeps it | Decision D1. If deleted, delete code only; keep the `seen_futures` and `reminders` columns and `'futures'` in `STEPS` (no migration) |
| 2 | 14 shadcn components no file imports (avatar, badge, checkbox, command, drawer, empty, field, popover, progress, scroll-area, skeleton, spinner, tabs, tooltip) | 1b | 0 importers each (grep for `components/ui/<name>'`); `src/shared/components/ui/inventory.test.ts:4-30` requires them as "the shadcn components the starter ships" | 885 src + 35 test, and deps `cmdk`, `vaul`, 7 `@radix-ui/*` | low: re-added by `shadcn add` in seconds | Decision D2: delete, or keep as the starter's kit |
| 3 | Stale e2e specs and helpers (old step 03/04 long page, `/attention` coins page, futures as the end of onboarding, "Step N of 6", the old welcome copy) | 5 | section 5 | ~500 e2e (+165 with D1) | low: e2e runs only when asked; the stale ones fail today | Delete the fully stale specs and helpers; rewrite the flows worth keeping when QA next runs |
| 4 | Config-mirror and copy-pinning unit tests | 4 | `onboarding.test.ts:119-126, 221-262, 264-427`; `questions.test.ts:26-111`; `WelcomeScreen.test.tsx`; class assertions in `AnswerCards.test.tsx:99-107`, `DuckLoader.test.tsx:58-65`; `globals.test.ts` | ~400 test | low | Delete the tests that restate a table; keep the ones that pin a rule (order, visibility, resume) |
| 5 | Repeated step-screen markup and motion CSS (failure alert, sticky actions bar, kicker + h1, impact and note lines; `sign-in.module.css` vs `onboarding.module.css` vs `picture.module.css`) | 3 | section 3 | ~200 src | low to medium: visual; check against the boards | Merge into a few small shared pieces (section 3) |
| 6 | Legacy fields on `SCREENS` (`step`, `number`, `title`, `sub`, `next`) and the two-file question model | 2 | `questions.ts:30-37, 63-68, 125-130, 163-168, 183-188`; only `questions.test.ts:27-36` reads them | ~30 now; ~120 with one table | low now; medium for the merge (`impact.ts` reads items) | Delete the five fields now; simplify into one table later (section 2) |
| 7 | Small dead exports and branches | 1a | section 1a | ~40 src + ~45 test | low | Delete |
| 8 | `cn` npm package | 6 | `package.json:43`; no file imports `'cn'` (the `cn` used everywhere is `src/shared/lib/utils.ts`) | 1 dep | low | Delete |
| 9 | Docs that contradict the code | 6 | `CLAUDE.md:32` says "`/futures` and `/attention` sit outside onboarding, since a returning student lives there"; PRODUCT.md and `next.config.ts:16` say `/attention` redirects to step 05 and a returning student lands on `/onboarding/done` | 0 (edits) | low | Fix the CLAUDE.md line and the stale comments listed in section 6 |

## 1. Dead or unreachable code

### 1a. Dead now

| Item | Evidence | Lines |
| --- | --- | --- |
| `FUTURES_PATH` | `src/features/opening/model/onboarding.ts:230`; no other reference in `src` or `e2e` | 1 |
| `SITE_URL` | `src/shared/lib/site.ts:6-8`; no other reference | 3 |
| `initialsOf` and its test | `src/shared/lib/initials.ts` (12) is imported only by `initials.test.ts` (23); no avatar uses it | 35 |
| `isAppPath` | `src/shared/lib/auth/gate.ts:34-36`; only `gate.test.ts:7, 20-33` uses it (the proxy uses `isAdminPath` and `isAdminSignInPath`) | 3 + ~14 test |
| `isOnline` | `src/shared/lib/presence.ts:9-11`; only `presence.test.ts`; the admin uses `lastSeenLabel` and `ONLINE_WINDOW_MS` | 3 + test cases |
| `markStep`'s `'futures'` branch | `src/features/opening/server/profile.ts:128-134`; the only callers pass `facts`, `study`, `living`, `after`, `attention` (the five `page.tsx` files); `'futures'` only in `profile.test.ts:75` | 2 |
| Barrel exports nothing imports through the barrel | `src/features/opening/index.ts`: `Hero` (only `FuturesScreen` imports it, from `./Hero`), `PICTURE_PATH`, `WELCOME_PATH`, `SCREENS` (only `impact.ts`/`onboarding.ts`, relative), `questionOf` (only `catalogue.test.ts:2`); `src/features/engine/index.ts:15-16` exports test fixtures `ANJALI`, `PRIYA_ANSWERS` from production code | ~8 |
| Unused types | `SessionUser` (`session.ts`), `SigninMessageKey` (`gate.ts`), `AnswerState` (only `student.ts` itself), `OnboardingStep` (only `onboarding.ts`) | ~5 |
| `/attention` in `APP_PATHS` and the proxy matcher | `gate.ts:26`, `proxy.ts:45`; `next.config.ts:16` redirects `/attention` before the proxy runs, so the entry only lets `?next=/attention` survive sign-in | 2 (+ `gate.test.ts` rows) |
| A leftover mock | `QuestionScreen.test.tsx:23` mocks `auth/client` `signOut`; `QuestionScreen` never signs out | 1 |
| `test` and `test:run` | `package.json:13-14`, both `bun test` (CLAUDE.md names `test:run`) | 1 |

Checked and live, so not flagged: every CSS module class is referenced by an importer (script over all six `*.module.css`); `geo.ts` `minutesBetween`, `whoOf`, `haversineKm` (step 03's person line, `impact.ts:239`); `catalogue.ts` `CITIES`, `PLACES`, `CAMPUSES`, `COURSES`, `AREA_FIELDS` (impact lines, `PersonForm`, `AreaChecks`, `actions.ts`); `effective`, `isAssumed` (`weights.ts`, `futures.ts`, `questions.ts`); admin and auth modules.

### 1b. Unused shadcn components

0 importers each (grep `components/ui/<name>'` over `src`): avatar 47, badge 33, checkbox 28, command 142, drawer 100, empty 94, field 231, popover 31, progress 25, scroll-area 46, skeleton 7, spinner 16, tabs 55, tooltip 30 = 885 lines. Used: button, card, dialog, input, label, select, separator, sheet, sonner, switch, table. `inventory.test.ts` asserts the starter ships all 25, so deleting them is a decision about the starter, not just this app (D2). Their packages would go too: `cmdk` (command), `vaul` (drawer), `@radix-ui/react-avatar`, `-checkbox`, `-popover`, `-progress`, `-scroll-area`, `-tabs`, `-tooltip`.

### 1c. Used only by the parked futures page

One cluster. Its one entry is `src/app/(app)/futures/page.tsx` (30), which nothing in onboarding links to (PRODUCT.md "The three futures (`/futures`) are parked"; `landing.ts:30-44` never returns it).

Source (~1,600 lines):

| Piece | Lines | Only importer |
| --- | --- | --- |
| `components/FuturesScreen.tsx` | 285 | `futures/page.tsx` |
| `components/FutureCard.tsx` | 204 | `FuturesScreen.tsx:34` |
| `components/ChipEditor.tsx` | 110 | `FuturesScreen.tsx:33` |
| `components/OptionButtons.tsx` | 119 (keep `labelOf`, 2 lines, which `AnswerCards.tsx:8` uses) | `ChipEditor.tsx:15` |
| `components/WeightsPlaque.tsx` | 67 | `FuturesScreen.tsx:38` |
| `components/SealedView.tsx` | 40 | `FuturesScreen.tsx:37` |
| `components/Progress.tsx` (the old "Step n of 6" bar) | 23 | `FuturesScreen.tsx:36` |
| `components/Hero.tsx` | 20 | `FuturesScreen.tsx:35` |
| `engine/futures.ts` | 397 | `futures/page.tsx`, `FuturesScreen.tsx` |
| `engine/weights.ts` | 108 | `futures.ts:28` |
| `engine/feel.ts` | 26 | `futures.ts:16` |
| `engine/geo.ts` `distanceLine`, `flightHours`, `formatFlight`, flight constants | ~41 (lines 13-18, 36-47, 63-85) | `futures.ts` |
| `engine/types.ts` `DIMENSIONS`, `DIMENSION_LABELS`, `Weight(s)`, `Feel`, `FEELS`, `BANDS` | ~20 | `futures.ts`, `weights.ts`, `FutureCard`, `WeightsPlaque` |
| `model/questions.ts` `chipText`, `CHIPS`, `fieldChip`, `fieldAssumed`, `editLabel`, `EDIT_LABELS`, `ITEM_TITLES`, `fieldsChosen` | ~82 (lines 239-244, 252-261, 321-389) | `ChipEditor`, `FuturesScreen`, `futures.ts:6,165` |
| `actions.ts` `addReminderAction`, `reminderInputSchema` | ~21 (lines 30-33, 122-137) | `futures/page.tsx` |
| `server/profile.ts` `addReminder`, `REMINDERS_MAX` | ~20 (lines 107-126) | `actions.ts` |
| `engine/fixtures.ts` | 27 | tests only (move to a test helper; `QuestionScreen.test.tsx` uses `ANJALI`) |

Tests (~1,350 lines): `FuturesScreen.test.tsx` 367, `Hero.test.tsx` 12, `engine/futures.test.ts` 564, `weights.test.ts` 128, `feel.test.ts` 44, `geo.test.ts:56-151` 96, `questions.test.ts:248-314` (chipText, editLabel) 67, `actions.test.ts:269-319` 51, `profile.test.ts:135-154` 20. End-to-end: see section 5 (`futures.e2e.ts` and the futures parts of four other specs).

What deleting it takes:

- Routes: delete `src/app/(app)/futures/`.
- Proxy and paths: `'/futures/:path*'` in `proxy.ts:44`; `'/futures'` in `APP_PATHS`, `gate.ts:26`, and its rows in `gate.test.ts:28, 79-81, 103`; `STUDENT_APP_URL` in `e2e/helpers/student.ts:9`; `FUTURES_PATH` (`onboarding.ts:230`). A permanent redirect `/futures` → `/onboarding` in `next.config.ts` would keep old links working.
- Barrels: `FuturesScreen`, `Hero` from `opening/index.ts`; `buildFutures`, `diffFutures`, the futures types, `BANDS`, `DIMENSION*`, `FEELS`, fixtures from `engine/index.ts`.
- Types and data: keep `Reminder`, `reminderSchema`, `FUTURE_IDS` and `Profile.reminders` while the `reminders` column exists (they parse it), or drop only the read in `getProfile` (`profile.ts:53, 66-69`); keep `'futures'` in `STEPS` (`student.ts:51`): it feeds the `student_profile_last_step_check` constraint (`schema.ts:160`), so removing it needs a migration, and old rows may hold it (`landing.ts:21` reads it).
- DB columns: keep `seen_futures` (read by `landing.ts:21` to resume students who reached the futures before 12 Oct) and `reminders` (holds saved reminders). Dropping either needs a migration and loses data; recommend keeping both and removing code only.
- Unaffected: `catalogue.ts` stays (impact lines, `PersonForm`, `AreaChecks`, `actions.ts`, `profile.ts` read it); its claims and `keepOpen` texts would become unread data, but the catalogue is out of scope by instruction.

## 2. Legacy layers in the question model

`src/features/opening/model/questions.ts` still describes the four old long screens, and `onboarding.ts` rebuilds the one-question screens from it.

- `Screen` fields read by no live code: `step`, `number`, `title`, `sub`, `next` (`questions.ts:30-37` and each screen's header, e.g. `63-68`). Only `questions.test.ts:27-36` reads them, and it pins `next: 'Show me three futures'`, copy no screen shows. `onboarding.ts` reads only `SCREENS[i].items` (`onboarding.ts:250, 269, 284, 303`).
- `Item` (the old grouped card: "Your budget per year", "Timing", "Your qualifications and scores") is still load-bearing: `impact.ts:57, 295-349` keys one line per item, so the budget line reads amount, covers, who pays and the limit together, and `onboarding.ts:255` derives step 01's `group` from the item title. `Question.label` is the step 01 heading (`onboarding.ts:257`).
- `onboarding.ts` holds the new layer as five side tables keyed by stored key (`WHY` 91-104, `FACT_SLUGS` 110-122, `STUDY` 127-166, `LIVING` 171-186, `AFTER` 191-205) and four near-identical derivations (`QUESTION_STEPS` 233-318, about 85 lines), with casts (`question.key as FactKey`) where a typo would only show at runtime.
- Step 01 has its own wrapper API over the generic one: `FACT_QUESTIONS`, `factPath`, `factKey`, `firstUnanswered` (`onboarding.ts:320-323, 390-406`) wrap `QUESTION_STEPS[1].questions`, `questionPath(1, …)`, `questionBySlug(1, …)`, `firstOpenQuestion(1, …)`; the facts pages use the wrappers (`facts/page.tsx:2`, `facts/[question]/page.tsx:2`) while steps 02–04 use the generic calls.
- `landingPath` is `onboardingResumePath` under a second name (`landing.ts:42-44`); `/start` uses one, `/onboarding` the other.
- `WELCOME_PATH` names two different URLs: `'/'` in `gate.ts:6` and `'/onboarding/welcome'` in `onboarding.ts:219`.

A simpler single source, not written: one ordered table per step in one module, one row per screen with everything a screen needs (`key`, `slug`, `heading`, `why`, `group`, `options`, `notSure`, `control`, `default`, `itemId` for the impact line, `askedWhen`), and `QUESTION_STEPS`, `questionOf`, `DEFAULTS` and `isVisible` read from it. The `Screen` wrapper and its five fields go; `Item` survives only as the `itemId` the impact lines group by; the step 01 wrappers go in favour of the generic calls. Estimated saving about 120 lines (most of `QUESTION_STEPS` and the casts), with the tests on order, slugs and visibility kept.

## 3. Duplication

| # | Where | Smallest shared piece | Lines saved |
| --- | --- | --- | --- |
| 3.1 | Save-failure alert with Try again: `QuestionScreen.tsx:311-331` and `AttentionScreen.tsx:293-313` (same classes, icon, button); `PictureQuestion.tsx:172-186` (same box, no button) | a `SaveFailed` component (`message`, optional `onRetry`, `pending`) | ~35 |
| 3.2 | Sticky actions bar, the same 190-character class string: `QuestionScreen.tsx:353-360`, `AttentionScreen.tsx:330-337`, `PictureQuestion.tsx:189-196`, `WelcomeScreen.tsx:111-116` | a `StepActions` wrapper (or one exported class constant) | ~20 |
| 3.3 | Step heading: kicker `m-0 text-overline uppercase text-accent-700` in `AttentionScreen`, `DoneScreen`, `PictureQuestion`, `QuestionScreen`; h1 `font-heading text-h1 font-semibold tracking-[-0.015em] outline-none` in five screens; focus-on-arrival `useEffect` in `DoneScreen.tsx:19-21`, `PictureQuestion.tsx:52-54`, `WelcomeScreen.tsx:43-45` | a `StepKicker` + `StepHeading` (h1 with the focus effect) | ~25 |
| 3.4 | Impact and note lines: accent line `border-l-2 border-accent-700 bg-accent-100/70` in `QuestionScreen.tsx:257`, `AttentionScreen.tsx:36` (`IMPACT`), `WelcomeScreen.tsx:100`; grey note `border-l-2 border-neutral-600 bg-neutral-100` in `AttentionScreen.tsx:34` (`NOTE`) and `AreaChecks.tsx`; caption-with-Info note in `QuestionScreen.tsx:333-339`, `PictureQuestion.tsx:161-170`, `AttentionScreen.tsx:113-122, 288-291`. The step 05 intent names this follow-up ("a shared note component across four screens") | `Note` with `tone="impact" \| "limit" \| "hint"` | ~40 |
| 3.5 | One-shot save with pending, failure and retry, written twice by hand: `AttentionScreen.tsx:71-93` and `PictureQuestion.tsx:56-74`, beside the per-tap `useKeyedSave` (`answer-save.ts:20-102`) | a `useSubmit(action)` hook returning `{ pending, failed, submit, retry }`; keep `useKeyedSave` for taps | ~25 |
| 3.6 | Motion CSS copied between modules: `.page` easing, `.grid`/`.grid::before` grid paper, `.onPanel`, `.rise` + `.d1`–`.d8`, `@keyframes rise` and `drift` in both `sign-in.module.css` (lines 12-57, the reduced-motion block from 115, keyframes 228 and 266) and `onboarding.module.css` (lines 11-47, the block from 74, keyframes 125 and 135); `errorIn` and `spin` in both `sign-in.module.css` and `picture.module.css:256-270`; `QuestionScreen.tsx:37` and `AttentionScreen.tsx:26` import `picture.module.css` (step 00's figures) only for `errorIn` and `spin` | one shared motion module (easings, grid paper, onPanel, rise/d1–d8, errorIn, spin) | ~70 |
| 3.7 | Failure copy three ways: `SAVE_FAILED` and `ANSWER_SAVE_FAILED` (`messages.ts`), `PERSON_SAVE_FAILED` (`QuestionScreen.tsx:65-66`) | keep two strings in `messages.ts` | ~3 |
| 3.8 | Limits restated: `AREAS_MAX = 3` in `questions.ts:45`, `OptionButtons.tsx:8`, `student.ts:107`; `COINS = 10`, `PILE_MAX = 5` in `student.ts:103-104` and `COINS_TOTAL`, `MAX_PER_PILE` in `coins.ts:7-8` | export once from `student.ts` | ~4 |
| 3.9 | Two import paths for `FrameMarks`: `Frame.tsx` (a 3-line re-export used by `ui/button`, `card`, `dialog`) and `Blueprint.tsx` (used by features) | import from `Blueprint` everywhere | 3 |

Not flagged as duplication: the four `[question]/page.tsx` files (24–31 lines each) and three bare-step redirects. A single dynamic route would save ~60 lines but trade away the named-step folders CLAUDE.md asks for.

## 4. Test bloat

Profile of the 61 test files (counts by grep): 827 cases; 6 assertions on class names or `data-theme`; the largest suites are `impact.test.ts` 920 (85 cases), `onboarding.test.ts` 732 (84), `QuestionScreen.test.tsx` 581 (37, 47 copy queries), `engine/futures.test.ts` 564 (parked), `access.test.ts` 508 (59).

Worst files, with examples:

- `src/features/opening/model/onboarding.test.ts` (~200 of 732 lines restate tables): "the step URLs" (119-126) re-asserts four path constants; "the panel" (221-262) copies `ONBOARDING_STEPS` and every `PANEL_COPY` string; `QUESTION_STEPS` (264-427) copies each step's title, path, back, nextName, every `why` line and every heading. A change to the copy has to be made twice and no rule is tested. Keep: slugs both ways, `askedQuestions`, `firstOpenQuestion`, `forwardPath`, `shownQuestion`, `stepProgress` (rules).
- `src/features/opening/model/questions.test.ts` (~95 lines): the `SCREENS` block (26-111) pins unused fields (`step`, `number`, `next`, including `'Show me three futures'`) and option lists; `chipText`/`editLabel` (248-314) test futures-only code (counted in 1c).
- Copy asserted twice across files: `QuestionScreen.test.tsx:149-155` ("says what Not sure assumes") and `:157-166` (partner line) repeat `impact.test.ts:22-34` and `:327-333`; `OnboardingPanel.test.tsx:47-65` repeats the welcome panel copy that `onboarding.test.ts:251-256` pins.
- Look, not behaviour (CLAUDE.md "the look is checked against the design boards"): `AnswerCards.test.tsx:99-107` asserts `grid-cols-2` / `grid-cols-3`; `DuckLoader.test.tsx:58-65` asserts `-scale-x-100`; `src/app/globals.test.ts` (22) asserts five px values in `globals.css`; `Hero.test.tsx` and `OnboardingPanel.test.tsx:104-110`, `SignInPanel.test.tsx:28` assert `data-theme="light"` (borderline: it is how the panel stays steel in dark).
- `WelcomeScreen.test.tsx` (69): four of five cases are the welcome's copy read back from constants at the top of the test file; the behaviour is "Welcome." with no name, Start's href, and focus.
- Pass-through: `landing.test.ts:30-71` runs every case through both `landingPath` and `onboardingResumePath`, which are the same function (section 2).
- `inventory.test.ts` (35) pins the starter's shadcn list (D2).

Estimate outside the futures cluster: ~400 lines removable with no loss of a rule.

## 5. Stale end-to-end specs

Read, not run (e2e runs only when asked). Copy and URLs asserted were grepped against `src`. Test-body lines: 2,035 current, 619 partly stale, 129 fully stale. Everything stale traces to five changes: steps 03 and 04 are one question per screen with radio cards (no button groups, no "Next: after you graduate", no "Show me three futures"); the coins page moved to `/onboarding/attention` and ends on `/onboarding/done`; the band reads "Step N of 5." (`OnboardingPanel.tsx:186`) and the panel lists 6 steps (`onboarding.ts:10-17`); the welcome copy changed (`WelcomeScreen.tsx:15, 27, 61, 70`; `WELCOME_MINUTES = 6`); bare `/onboarding/living` and `/onboarding/after` redirect to a question.

| Spec | Lines | Verdict | Evidence |
| --- | --- | --- | --- |
| `coins-and-return.e2e.ts` | 226 | 3 of 5 tests stale | 30-67 and 69-96 walk the old coins page: `Add a coin to …` (line 18; now `Place a coin on …`, `AttentionScreen.tsx:244`), "10 coins left to place" (39, 48, 87; gone), Done and "Spend them later" expected to land on `/futures` (57, 83; now `/onboarding/done`). 164-226 expects `/` to land on `/futures` (180; `landing.ts` never returns it) and clicks "Next: after you graduate", "Show me three futures" (211-212). 98-128 and 130-162 are current |
| `opening.e2e.ts` | 191 | partly stale, and duplicate | One test at two sizes. 126-186 walk the old step 03/04 long page through `tap()` and end on `/futures`; 49 and 110 expect "of 6". Lines 26-118 repeat `student-opening-three-futures` AC14, AC22, AC23, AC24, AC26, AC27, AC30 one for one |
| `futures.e2e.ts` | 165 | partly stale | Both tests reach `/futures` through `answerOpening(PRIYA)` (24, 109), which cannot pass; the bodies test the parked page, whose copy still exists. Goes with D1 |
| `onboarding-welcome.e2e.ts` | 189 | partly stale | The heading helper (12) is "About 10 minutes, then three futures"; now "About 6 minutes of short questions". Old lede and points (23, 28, 30), "about 10 min" (114), 7 steps (134). Lines 100, 173, 185 now pass vacuously (they assert that the old heading is absent) |
| `student-opening-three-futures/…e2e.ts` | 680 | mostly current | Partly stale: 293-307 and 584-594 ("of 6"), 366-388 (`answerOpening`, futures chip), 600-624 (7 steps). The rest is current |
| `onboarding-study.e2e.ts` | 154 | one test partly stale | 66 expects `/onboarding/living$` (now redirects to `/destination`); 67 clicks a Back link (a button, `QuestionScreen.tsx:361-370`) |
| `dark-mode/dark-mode.e2e.ts` | 744 | one test partly stale | 625-650: `answerOpening` (638), `/attention` and "10 coins left to place" (644-646) |
| `onboarding.e2e.ts` | 379 | one line stale | 101 expects 7 steps |
| `dark-mode.e2e.ts` (root) | 121 | current, duplicate | All five tests are covered by `dark-mode/dark-mode.e2e.ts` AC4, AC5, AC6, AC7, AC11 (that spec says so at 338, 421, 444) |
| `smoke.e2e.ts` | 11 | current, duplicate | Covered by `student-sign-in.e2e.ts` 36-47 and 155-156 |
| `sign-in.e2e.ts` | 35 | current, partly duplicate | 7-14 = `welcome.e2e.ts` 23-27; 30-35 = `student-sign-in.e2e.ts` 36-47; 16-28 (reduced-motion splash) is unique |
| `welcome.e2e.ts`, `student-sign-in.e2e.ts`, `admin-sign-in.e2e.ts`, `user-management.e2e.ts` | 60, 237, 92, 259 | current | Sign-in gate and admin; small overlaps only |

Helpers (`e2e/helpers/student.ts`, 211): stale `SCREENS` (55-58), `answerOpening` (167-181), the button-group branch of `tap` (76-80), `PRIYA`'s `living` and `after` lists (198-210) and the header comments (1-3, 53-54); about 45 lines. `answerOpening` is called by `futures.e2e.ts`, `coins-and-return.e2e.ts`, `dark-mode/dark-mode.e2e.ts:638` and `student-opening-three-futures…:381`. The other helpers are current.

Manual checklists with stale lines: `onboarding-welcome/onboarding-welcome.manual.md:6, 13, 14` ("10 min", "then three futures", "steps 04–06"); `dark-mode/dark-mode.manual.md:13, 20, 21` (`/futures`, `/attention`, panel "00"–"06"); `student-opening-three-futures/…manual.md:22, 33` (seven segments, "Step N of 6.").

Removable without losing coverage: the three stale tests in `coins-and-return` (129), `opening.e2e.ts` (191, its live parts are duplicated and its tail is stale), the root `dark-mode.e2e.ts` (121), `smoke.e2e.ts` (11) and the stale helpers (~45): about 500 lines. With D1, `futures.e2e.ts` (165) too. The partly stale tests elsewhere need one-line fixes ("of 5", 6 steps, the new welcome copy), not deletion. Step 03, step 04, step 05 and "You're all set" have no current e2e at all.

## 6. Other

- `cn` in `package.json:43` dependencies: no import anywhere (the `cn` helper is `src/shared/lib/utils.ts`).
- Arbitrary container queries, which CLAUDE.md forbids ("never an arbitrary `@max-[…]`, `@min-[…]`"), exist only in the parked cluster: `FuturesScreen.tsx:213, 244`, `Hero.tsx:11`, `SealedView.tsx:26`. One arbitrary type size outside it: `SignInPanel.tsx:145` `@max-xl:text-[2.375rem]` (CLAUDE.md: sizes through the type roles).
- Docs and comments that contradict the code:
  - `CLAUDE.md:32`: "`/futures` and `/attention` sit outside onboarding, since a returning student lives there"; its step list omits `attention` and `done`. Code: `next.config.ts:16` redirects `/attention`; `landing.ts:30-44` lands a finished student on `/onboarding/done`.
  - `QuestionScreen.tsx:100-101`: "Step 04's last question leads out of onboarding, to the futures"; it leads to step 05 (`onboarding.ts:387`).
  - `FuturesScreen.tsx:40, 91, 209` and `Progress.tsx:3`: "Screen 5 … Step 5 of 6", Next links to `/attention` (now a redirect).
  - `questions.ts:1-3` ("opening screens 1–4 … how each answer reads as a chip on the futures"), `student.ts:48` ("Screens 1–4"), `PictureQuestion.tsx:33-38` ("screen 1"), `profile.ts:128` ("Reaching the futures marks them seen"): describe the old flow.
  - The sign-in lede `src/app/page.tsx:50` still promises "Three futures from your own answers" (a known follow-up in the step 05 intent).
  - `e2e/README.md:3` says one folder per ticket; 13 of 15 specs are flat files in `e2e/`.
- Oversized files that mix concerns, flagged for value rather than size: `QuestionScreen.tsx` (384) holds the note tables per question, the person-save fallback and the full layout of four steps; moving the `NOTES` tables (`39-74`) next to the question model would leave the screen as layout. Admin (`UserPage.tsx` 424, `UsersList.tsx` 417) is split into small local components and is not flagged. `splash.module.css` (611) and `Splash.tsx` (282) are the brand splash and are left alone.

## Decisions for Jenish

- **D1. The parked futures.** Delete the futures cluster now (about 1,600 source and 1,350 test lines, plus its e2e) and rebuild from the new design when the feature returns, or keep it parked as is. If deleted: code only, keep the `seen_futures` and `reminders` columns and `'futures'` in `STEPS`, and add a `/futures` → `/onboarding` redirect.
- **D2. The starter's unused shadcn components.** Delete the 14 unused components (885 lines), `inventory.test.ts` and 9 packages, or keep them because this repo is also the Heubert starter.
- **D3. The e2e suite.** Delete the stale specs now and write fresh ones for steps 03–05 when QA next runs, or rewrite them in this cleanup.
- **D4. Copy in unit tests.** Agree that tests stop restating copy and config tables (criteria that quote copy are checked against the boards and by e2e), so section 4's deletions are in scope.
