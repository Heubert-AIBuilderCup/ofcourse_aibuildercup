# Student tweaks, admin loaders, feed and Skip pictures — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 3 MEDIUM · 9 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/student-tweaks`, uncommitted working tree over `origin/main` at `4e474c8` · 77 files (66 tracked, 11 new), +2667 −514 · 2026-10-16 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `industry/DESIGN.md` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing (package.json and bun.lock unchanged) · code N/A (semgrep not installed) |
| Not applicable | none |
| Failed to load | none |
| Read outside the diff | 12, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | A | LOW · `feed-actions.ts:36` · whole feed re-read per page | optional |
| CLAUDE.md | B | MEDIUM · `e2e/onboarding-study.e2e.ts:37` · spec contradicts the auto-advance | update the onboarding specs |
| industry DESIGN.md | A | LOW · `FeedHeader.tsx:38` · per-breakpoint sizes | optional |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | LOW · `FeedHeader.tsx:38` · `px-6` beside `px-gutter` | optional |
| fdd-architecture | A | — | — |
| Quality | B | MEDIUM · `FeedList.tsx:73` · rejected page call swallowed | catch it, show Try again |
| Criteria | A | 2 partly covered, 3 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Single-choice tap answers and moves on; last question, re-tap; arrows stay | `QuestionScreen.test.tsx:610`, `onboarding.test.ts` `nextPath` | covered |
| 2 | Own words under the options | — | not automatable |
| 3 | "Why this road?" map button toggles the panel; no row; none when exact | `RoadBoard.test.tsx:1363` | covered (look: manual) |
| 4 | Feed in place of Ask and Compare, header and bar | `RoadBoard.test.tsx:626`, `RoadHeader.test.tsx:53` | covered |
| 5a | Student header on the feed, Feed current; staff keep their bar | `FeedHeader.test.tsx` | covered |
| 5b | One column of cards with swipeable slides | `FeedList.test.tsx` (cards, `slideAt`) | covered (look: manual) |
| 5c | Next cards load on scroll | `FeedList.test.tsx:1725`, `feed-actions.test.ts`, `feed.test.ts` `feedPage` | covered |
| 5d | One row: search plus a dropdown per group, same rules | `FeedFilters.test.tsx` | covered |
| 6 | Spinner and words on the pressed control only; slide placeholder on redraw; no gap to the polled loader | SourceForm, IdeasStep, OutlineStep, ImagesStep, RenderStep, SocialWorkbench, ModelsScreen tests | partly covered |
| 7 | A failed step says so, and why; a slide's "Could not draw" names its reason | `failure.test.ts`, `client.test.ts:815`, `ImagesStep.test.tsx:2458`, `images.test.ts` (429 reason) | covered |
| 8 | Skip pictures: no image call, keeps drawn art, gated, text-only, no migration | `images.test.ts` (4 DB tests), `comics.test.ts`, `ImagesStep.test.tsx` "Skip pictures", `steps.test.ts` | covered (DB tests run only under `DB_TESTS=1`) |
| 9 | Image call waits 60 s | `client.test.ts` "the image timeout" | covered |

Row 6: the agreed brief asked for a representative set; Make the set, Character studio, Describe the style, the blog links, version and slide chips, Another take and Save and remake have no test. The "no gap" hand-off depends on `router.refresh()` timing and is a manual check (see Blind spots). Row 1: Continue still shows on single-choice questions during the 350 ms pause. "Multi-choice and the person form keep Continue" relies on code this diff does not touch. Rows 2, 3 and 5b: their layout is checked against the boards by eye.

## Read outside the diff
- `src/features/content/server/commands/structures.ts:351` — the only caller that branches on `AI_ERRORS.failed` text; caption, draft, extract and market only return it (finding below).
- grep for `Spin`/`Working` imported from `parts` — none left.
- `src/app/admin/(console)/posts/[id]/page.tsx:28` — still calls `failedSteps`, now a wrapper over `failedNow`.
- `src/shared/lib/auth/session.ts:24-47` — `getSession` returns null for a suspended account, which matches the feed rule `requireAppPage` applies.
- `src/features/content/components/usePostAction.ts:29-45` — `router.refresh()` runs inside the transition without being awaited, so the press-to-poll hand-off is unverified.
- `src/features/content/server/store.ts:813` — `listLive` is bounded by `FEED_LIMIT`.
- `parts.tsx:308-358`, `server/commands/images.ts:383-388` — a look render's cover fallback is null, so Review and Live tag no skipped slide.
- `QuestionScreen.tsx:167-174, 206-221, 433` — Continue has its own copy of the next-question rule; `goTo` changes `item.key`, so the timer is cleared; `leave` does not change it.
- `ExactScore.tsx:24-38` — it opens from its own button, so the auto-advance does not strand it.
- `e2e/` greps — `content-student-feed` matches the new feed; the onboarding specs press Continue after a tap; no spec names Ask, Compare or the closest-road row.
- `src/features/opening/server/own-words.ts:53-75` — the student path ignores the error text, so the new busy and timeout wording never reaches a student.
- `RoadBoard.tsx:445-501`, `PhoneMap.tsx:46` — `match` reaches the phone map through `mapProps`.

## Findings, by file

### `src/features/content/components/feed/FeedList.tsx`

**MEDIUM · line 73 · rejected page call swallowed**
- What: `next()` awaits `loadPage` with no catch. A server-action call that rejects (offline, a deploy that dropped the action id) leaves `status: 'loading'` for good, with no Try again, and `void next()` drops the rejection.
- Why: the action never throws, but its transport can, and the brief asks for a failure line with Try again.
- Rule: Quality, errors surfaced not swallowed · a test would have caught it: yes, a `loadPage` that rejects.
- Fix: wrap the call in try/catch and set `{ status: 'failed', error: 'We couldn’t load more posts.' }`, then add that test.

### `e2e/onboarding-study.e2e.ts`

**MEDIUM · lines 37-56 (and `e2e/onboarding.e2e.ts:119-120`) · standing spec contradicts the app**
- What: the specs tap a single-choice card, then press Continue and expect the next URL. The tap now moves on by itself after 350 ms, so Continue races it and can land on the next question, where the button reads Skip.
- Why: the e2e suite goes flaky or red on the behaviour this branch adds.
- Rule: CLAUDE.md, "standing specs under e2e/ are updated … when a change alters what they cover" · a test would have caught it: yes, running these specs.
- Fix: drop the Continue after each single-choice tap and wait on the URL. Keep Continue for multi-choice and the person form.

### `src/features/content/components/steps/ImagesStep.tsx`

**MEDIUM · line 80 (and IdeasStep, OutlineStep, RenderStep, SocialWorkbench, SourcePane, SourceForm, BlogLinks, PageStyles, StructuresStep, ChosenVersion) · repetition**
- What: about 11 components each add their own "which press is running" state (`busy`, `busyWith`, `via`, `making`, `press`) and their own wrapper around `run`. `SocialWorkbench` passes `undefined` by position to reach it.
- Why: eleven copies of one rule drift. The next control that calls Gemini will get it wrong in a twelfth way.
- Rule: Quality, no duplicated logic; severity table, repetition (three or more) · a test would have caught it: no, structure.
- Fix: move `usePressed` beside `usePostAction` as `run(work, done, { onDone, press })` plus `pressed(press)`, and use it in each step.

### `src/features/content/server/commands/structures.ts`

**LOW · line 351 · changed contract, caller branches on text**
- What: `nudgeFailed` swaps in "Couldn't apply “Shorter”. Try again." only when `error === AI_ERRORS.failed`. A chip that ends on a 429 or a timeout now shows the raw "The model is busy right now (429)…" without the chip's name.
- Why: the change works, but the copy now differs by failure kind, and nobody chose that.
- Rule: changed-contract check · a test would have caught it: yes, a nudge test with a rate-limited fake.
- Fix: keep the label in all three cases, e.g. "Couldn't apply “Shorter”." followed by the reason sentence.

### `src/features/opening/components/QuestionScreen.tsx`

**LOW · lines 101-103 · comment no longer matches**
- What: `ADVANCE_MS` was inserted between `IMPACT_ICONS`'s doc comment and `IMPACT_ICONS`. Two doc comments now stack over the constant, and the icons have none.
- Why: the comment now describes the wrong thing.
- Rule: LOW, a comment that no longer matches · a test would have caught it: no.
- Fix: move the impact-icons comment back above `IMPACT_ICONS`.

**LOW · line 248 · Continue and the tap's timer run apart**
- What: Continue keeps its own copy of the next-question rule (lines 167-174) instead of `nextPath`. It does not clear `advance`, so Continue pressed during the pause on a step's last question calls `router.push` twice.
- Why: it pushes a duplicate history entry, and the tap and Continue can drift onto different rules.
- Rule: Quality, no duplicated logic · a test would have caught it: yes, tap the last card, press Continue, count `push`.
- Fix: route Continue through `nextPath` and `clearTimeout(advance.current)` in `goTo` and `leave`.

### `src/features/content/feed-actions.ts`

**LOW · line 36 · whole feed re-read per page**
- What: each scroll page re-reads every live post and blog (up to `FEED_LIMIT`) and the profile, then orders and filters them in application code, to return 8.
- Why: the cost grows with live posts times pages scrolled: 13 full reads for a 100-post feed.
- Rule: `performance.md` §1, §2 · a test would have caught it: no.
- Fix: optional for now. Cache the live list (`'use cache'` with a tag revalidated on publish), or page in the query once the feed grows.

### `src/features/content/ai/client.ts`

**LOW · line 159 · longer worst case for a background draw**
- What: `IMAGE_TIMEOUT_MS` goes from 20 s to 60 s. `drawEach` draws slides one after another with retries in `after()`, so the worst case for 6 slides is now well past 6 minutes.
- Why: if it outlives the Cloud Run request timeout, the run is cut off and the lock waits to go stale.
- Rule: `performance.md` §3; `security-llm.md` §3 bounds on model loops · a test would have caught it: no.
- Fix: confirm the service's request timeout covers slides × 60 s × attempts, or cap the run's total time.

### `src/features/content/components/feed/FeedPostCard.tsx`

**LOW · line 48 · slides unreachable by keyboard**
- What: the snap strip sits inside the card's link, so focus only reaches the link and a keyboard user cannot move to slide 2 onwards in the feed.
- Why: a mouse or keyboard user without a trackpad sees only the first slide.
- Rule: fdd-architecture §Accessibility · a test would have caught it: no, manual.
- Fix: optional. Add previous and next buttons outside the link, or accept that the post page shows every slide.

### `src/features/content/components/feed/FeedHeader.tsx`

**LOW · line 38 · per-breakpoint sizes**
- What: `px-6 @max-5xl:px-4` and `min-h-16 @max-5xl:min-h-14` are copied from `RoadHeader`. The feed's `main` uses `px-gutter`, so the header's edges do not line up with the content.
- Why: CLAUDE.md says page sides use `px-gutter`, never a size per breakpoint.
- Rule: CLAUDE.md §Code (fluid roles), DESIGN.md §Sizing · a test would have caught it: no, look.
- Fix: `px-gutter`, and one min-height.

### `src/features/road/components/RoadMap.tsx`

**LOW · line 213 · disclosure not tied to its panel**
- What: "Why this road?" sets `aria-expanded`, but `MatchStrip` has no id for `aria-controls`. No test opens the key and the panel in turn.
- Why: a screen reader does not learn which region opened, and the mutual exclusion is unpinned.
- Rule: fdd-architecture §Accessibility · a test would have caught it: yes, open Map key then Why this road and count notes.
- Fix: give `MatchStrip` an id, set `aria-controls`, and add that test.

### `src/features/road/components/RoadBoard.test.tsx`

**LOW · lines 1385-1398 · assertions that print an element**
- What: the new tests use `expect(panel()).not.toBeInTheDocument()`, which prints the element's markup when it fails.
- Why: CLAUDE.md names a failing assertion that prints DOM as the trigger that pushed `bun test` past 29 GB.
- Rule: CLAUDE.md §Commands, compare strings, counts and attributes · a test would have caught it: n/a.
- Fix: `expect(panel() === null).toBe(true)`, or a count.

## Top 3 priority fixes
1. `FeedList.tsx:73` — catch a rejected `loadPage` and show the failure line with Try again.
2. `e2e/onboarding-study.e2e.ts:37`, `e2e/onboarding.e2e.ts:120` — remove Continue after single-choice taps.
3. `ImagesStep.tsx:80` — lift `usePressed` beside `usePostAction` and use it in every step.

## Done well
- `loadFeedPageAction` takes the account from the session, validates the query with zod and its bounds, and sends only `feedCardOf`'s shaped card. Its test proves an id in the call is ignored.
- `skipPictures` runs under the images step's lock, is gated by the same action rules as Draw images, needs no migration (a JSON enum value), and has DB tests for zero image calls, kept art, refusal and idempotence.
- `failureReason` is pure, and `client.test.ts` ties it to the real `AI_ERRORS` texts, so the classifier and the client cannot drift apart.

## Built but not asked for
- Skip pictures is refused for blogs (`SLIDE_ACTIONS`) and comics. The brief allowed the blog variant "where the blog has slide images". This was a scope decision; record it in the PR.

## Blind spots
- The hand-off from a press's loader to the polled one rests on `router.refresh()` inside the transition. Only a manual run or an e2e step would show a gap.
- `images.test.ts` and `comics.test.ts` skip without `DB_TESTS=1`. Recommend `bun run db:dump`, then `bun run test:db`, which wipes the dev database.
- `skipPictures` takes the `images` lock but not `scene_plan`, so a plan running in another tab could land after a skip. A DB test would need to start a plan and press Skip while it is held.
- After fixing the specs, recommend running only the onboarding e2e specs, not the full suite.

---
Stack: TypeScript, React 19 and Next.js App Router (server actions, `after()`), Tailwind 4, Radix Select, Drizzle on Postgres, Zod, bun test with happy-dom, Playwright. Passes applied shallowly: none in this review. Next's own transition semantics around `router.refresh()` were not verified against `node_modules/next/dist/docs`.

## Fixes applied
- MEDIUM `FeedList.tsx:73` — `next()` catches a rejected `loadPage` and shows the failed line, "We couldn’t load more posts.", with Try again; new test with a `loadPage` that throws.
- MEDIUM `e2e/` onboarding specs — `answerFact`/`answerStudy` (helpers/student.ts) tap a card, wait for its save's POST and for the URL to move on (the areas keep their Saved wait); the Continue or "Next: …" after a single-choice tap is gone from `onboarding-study.e2e.ts` (know → field, field → level, know → areas), `onboarding.e2e.ts:119` and `student-opening-three-futures.e2e.ts` (AC30 question to question, AC30 step 02 to step 01), each waiting on the URL instead. Continue stays where nothing was tapped, for the areas and for the person form. Not run.
- MEDIUM `ImagesStep.tsx:80` and the steps — `usePress(pending)` (`mark`, `pressed`, `current`, `last`) and `usePressedAction()` (`run(work, done, { onDone, press })`) beside `usePostAction`; ImagesStep, IdeasStep, OutlineStep, RenderStep, SocialWorkbench (no positional `undefined` left), SourcePane, BlogLinks and StructuresStep use `usePressedAction`; SourceForm and PageStyles, which run their own transitions, use `usePress`; ChosenVersion's `via` now travels in StructuresStep's press (`onNudge(…, via)`). The existing loader tests pass unchanged.
- LOW `structures.ts:351` — `nudgeFailed` goes through `chipFailed` (lib/failure.ts): "Couldn't apply “Shorter”." for every failure, then the reason's sentence (busy, timeout, daily limit), else the refusal's own words, else Try again. Tests cover the rate-limited and timed-out texts.
- LOW `QuestionScreen.tsx:101` — the impact-icons comment is back above `IMPACT_ICONS`.
- LOW `QuestionScreen.tsx:248` — Continue goes through `nextPath` (one rule with the tap; `nextKey` and its copy are gone), and `goTo` and `leave` clear the waiting move; tests: tap then Next on the last question pushes once, and tap then Continue moves once.
- LOW `feed-actions.ts:36` — scroll pages read the live posts and blogs through `readFeedPage`, which reuses the list read in the last 30 s (`keptFor`, server/kept-for.ts); the feed page's `readFeed` always reads afresh and primes it. The profile is still read per page. Test: two page reads within the TTL read the store once.
- LOW `client.ts:159` — `drawEach` starts no new slide and no retry past `DRAW_BUDGET_MS` (300 s request timeout − 60 s image timeout − 30 s for the save = 210 s, `drawBudget` in server/draw-budget.ts); the slides not reached stay undrawn, never marked failed, so "Draw remaining" draws them. Test with an injected clock.
- LOW `FeedPostCard.tsx:48` — Previous slide and Next slide buttons over the strip's sides, outside the link (the card is a grid the link shares through subgrid), shown only with more than one slide; they wrap at the ends; the dots carry `aria-current`. Test that they move the slide shown, sit outside the link and are absent for one slide.
- LOW `FeedHeader.tsx:38` — `px-gutter` and `min-h-16`, with no per-breakpoint sizes.
- LOW `RoadMap.tsx:213` — `MatchStrip` takes an id from `useId`, and "Why this road?" sets `aria-controls` to it; tests: the button names its panel, and Map key then Why this road (and back) shows one note at a time.
- LOW `RoadBoard.test.tsx:1385` — the branch's new assertions there and in FeedList, ImagesStep, FeedHeader and RoadHeader tests compare `=== null`, `!== null` and `getAttribute(…)` instead of `toBeInTheDocument()` and `toHaveAttribute()` on elements.
- Follow-up (developer's yes), the other standing specs — `chooseAndComeBack` (helpers/student.ts) taps a card, waits for its save and the move on, then presses Back and checks the card is still checked; the tapped screen's checks run there. Used in `dark-mode.e2e.ts` (AC2 card, AC8 impact lines, the AC10 step 01 states) and `student-opening-three-futures.e2e.ts` (AC2, AC3, AC24, AC26, AC27). Within a step the saved note is still asserted; from the step's last question (English test) Back opens the question afresh, so the checked card and the stored profile stand in for the note. The save-failure checks (dark-mode AC10, three-futures "save failure") stay where she tapped and now also assert the URL did not move. Not run.
- Follow-up (developer's yes), advance only after the save lands — a single-choice tap sends its save at once (`useAnswerSave().saveNow`, which returns `saved`/`failed` and replaces any debounced save; other callers keep the debounce) and moves on only once that save is `saved` and at least ADVANCE_MS after the tap. A refused save keeps her on the question with the save-failed alert and Try again. Only the latest tap may move, and Back, Continue, a question change or unmount drops the move. Tests: refused save stays with the alert, save held then accepted moves once, a second tap wins whatever order the saves return in, leaving first drops the move; "shows what a tap does at once" now holds its save to see "Saving…", since the save is no longer debounced.
